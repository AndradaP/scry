// Minimal Gemini client for the judge backend. No Gemini API call existed
// anywhere in this codebase before this file (confirmed 2026-08-29) — this
// is the first one.
//
// Model choice is discovered at runtime via ListModels rather than
// hardcoded, since orchestration-design.md's example ("gemini-2.5-pro") was
// illustrative pseudocode, not a confirmed-current model id, and guessing
// wrong would fail every judge call silently-ish. Picks the first model
// that supports generateContent, prefers one with a real free tier and
// "pro" in the name for judging quality over speed.
//
// Fixed 2026-09-04: preference previously ranked "gemini-3.1-pro-preview"
// top (newest "pro" name), but per ai.google.dev/gemini-api/docs/pricing
// that model's Free Tier is "Not available" — paid-only, and this account's
// linked Cloud project has $0 prepay balance, so every call 429'd
// regardless of whether the model id was valid. NO_FREE_TIER_PATTERN below
// excludes that whole family (and other paid-only/non-text model families)
// from consideration so discovery lands on a model that actually works on
// a free-tier (no-billing) API key. Also fixed: discoverModel() was called
// by getModel() but never defined anywhere in this file — a bug that had
// never been exercised because every prior test called generateContent
// directly with a hardcoded model name, bypassing discovery entirely.

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

let _modelPromise;

// Families with no free tier at all (Pro preview models, computer-use,
// robotics, live/audio, image/tts/transcribe, embeddings) — excluded by
// pattern rather than an exhaustive allowlist so this doesn't need updating
// every time Google ships a new preview model under the same convention.
const NO_FREE_TIER_PATTERN = /-pro-preview|computer-use|robotics|-live|image|tts|transcribe|embedding/i;

function versionRank(name) {
  const m = name.match(/gemini-(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

async function listCandidates(apiKey) {
  const res = await fetch(`${API_BASE}/models?key=${apiKey}`);
  if (!res.ok) {
    throw new Error(`Gemini ListModels failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  const usable = (data.models ?? []).filter((m) =>
    (m.supportedGenerationMethods ?? []).includes("generateContent")
    && !/embedding|vision|tts|image/i.test(m.name)
  );
  if (usable.length === 0) throw new Error("No Gemini models support generateContent");

  const names = usable.map((m) => m.name.replace(/^models\//, ""));

  // Free-tier-eligible names first (see NO_FREE_TIER_PATTERN), then "pro"
  // over "flash" among those (judging quality over speed), then newest
  // version first.
  return names.sort((a, b) => {
    const freeA = NO_FREE_TIER_PATTERN.test(a) ? 0 : 1;
    const freeB = NO_FREE_TIER_PATTERN.test(b) ? 0 : 1;
    if (freeA !== freeB) return freeB - freeA;
    const proA = /pro/i.test(a) ? 1 : 0;
    const proB = /pro/i.test(b) ? 1 : 0;
    if (proA !== proB) return proB - proA;
    return versionRank(b) - versionRank(a);
  });
}

// Tries ranked candidates in order, memoizing whichever one actually
// completes a real generateContent call. A model can be listed but still
// fail — delisted from new-user access (404), no free tier / billing
// exhausted (429), etc. — so this doesn't trust the first-ranked name
// blindly; it probes with a trivial cheap call before committing.
async function discoverModel(apiKey) {
  const candidates = await listCandidates(apiKey);
  const errors = [];
  for (const model of candidates) {
    const res = await fetch(`${API_BASE}/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Reply with exactly: ok" }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 10 },
      }),
    });
    if (res.ok) return model;
    errors.push(`${model}: ${res.status}`);
  }
  throw new Error(`No candidate Gemini model completed a real generateContent call. Tried: ${errors.join(", ")}`);
}

async function getModel(apiKey) {
  if (!_modelPromise) _modelPromise = discoverModel(apiKey);
  return _modelPromise;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Confirmed empirically 2026-09-04: the free-tier key hits a 429 after
// roughly 2 real generateContent calls in quick succession — a per-minute
// rate limit, not the dead-billing 429 the old paid-only model produced.
// This one is worth waiting out. Fixed backoff schedule rather than reading
// a retry-after header, since the error body didn't reliably include one.
const RATE_LIMIT_BACKOFFS_MS = [15_000, 30_000, 60_000];

export function createGeminiBackend(apiKey = process.env.GEMINI_API_KEY) {
  return {
    name: "gemini",
    async complete(promptText) {
      const model = await getModel(apiKey);
      let lastError;
      for (let attempt = 0; attempt <= RATE_LIMIT_BACKOFFS_MS.length; attempt++) {
        const res = await fetch(`${API_BASE}/models/${model}:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: { temperature: 0 },
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
          if (!text) throw new Error(`Gemini returned no text: ${JSON.stringify(data)}`);
          return text;
        }
        const bodyText = await res.text();
        // Confirmed 2026-09-04: this free-tier key's 429 body includes a
        // quotaId of "GenerateRequestsPerDayPerProjectPerModel-FreeTier" —
        // a PER-DAY cap (20/day on this account). Google's own error still
        // includes a "retryDelay": "42s"-style hint alongside that, which is
        // misleading for a daily cap — waiting under a minute cannot help a
        // quota that resets on a ~24h cycle. Retrying that would burn the
        // full backoff schedule (up to ~105s) on every remaining call for
        // the rest of the run, for nothing. Fail fast on that specific
        // shape; only retry 429s that don't carry a per-day quotaId (a
        // genuine short-lived rate limit) and 503s (Google's own transient
        // overload, "usually temporary" per their error text).
        const isPerDayQuota = res.status === 429 && /PerDay/i.test(bodyText);
        if (isPerDayQuota) {
          throw new Error(`Gemini generateContent failed (429, per-day quota exhausted — will not reset for hours, not retrying): ${bodyText}`);
        }
        if ((res.status === 429 || res.status === 503) && attempt < RATE_LIMIT_BACKOFFS_MS.length) {
          const wait = RATE_LIMIT_BACKOFFS_MS[attempt];
          console.warn(`  [gemini] ${res.status}, waiting ${wait / 1000}s before retry ${attempt + 1}/${RATE_LIMIT_BACKOFFS_MS.length}`);
          lastError = new Error(`Gemini generateContent failed (${res.status}): ${bodyText}`);
          await sleep(wait);
          continue;
        }
        throw new Error(`Gemini generateContent failed (${res.status}): ${bodyText}`);
      }
      throw lastError;
    },
  };
}
