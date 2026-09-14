import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const DEV_EMAIL = "ioana.andrada.api@gmail.com";

function getTimezoneAbbr(timezone: string | undefined): string {
  if (!timezone) return "UTC";
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "short" }).formatToParts(new Date());
    return parts.find(p => p.type === "timeZoneName")?.value ?? "UTC";
  } catch {
    return "UTC";
  }
}

function getLocalDate(timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function getUserFromJwt(authHeader: string | null): { userId: string | null; userEmail: string | null } {
  if (!authHeader?.startsWith("Bearer ")) return { userId: null, userEmail: null };
  const token = authHeader.slice(7);
  const parts = token.split(".");
  if (parts.length !== 3) return { userId: null, userEmail: null };
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return { userId: payload.sub ?? null, userEmail: payload.email ?? null };
  } catch {
    return { userId: null, userEmail: null };
  }
}

const DIMENSION_SEEDS = [
  "positioning|differentiation|competitive moat",
  "feature design|usability|interaction design",
  "growth loops|go-to-market|PLG|distribution",
  "retention|habit|engagement|churn|stickiness",
  "business model|monetization|pricing|revenue model",
  "onboarding|UX|activation|aha moment|time to value",
];

// focus: optional upfront narrowing from the user (free text, e.g. "pricing
// against competitors") added 2026-09, serving the PM comp-analysis use case
// where the analyst already knows what they care about most. An additive
// hint, not a restriction — all 6 dimension queries still get populated
// regardless, so the teardown never loses full-spectrum coverage just
// because a focus was given.
async function generateSearchQueries(
  productName?: string,
  focus?: string,
): Promise<string[]> {
  const focusInstruction = focus
    ? `\n\nThe user wants this teardown to focus on: "${focus}". Weight whichever dimension queries are actually relevant to this more heavily with specific terms, but still populate all 6 — never drop a dimension entirely.`
    : "";

  const prompt = `You are preparing search queries for a product teardown of: "${productName}"

Each query targets a specific analytical dimension. For each dimension, you are given seed terms that always work. Extend each seed with 2-3 pipe-delimited terms specific to "${productName}"'s category, business model, and competitive context. Use your knowledge of the product. If the product is unfamiliar, return the seed terms unchanged.

Output ONLY a valid JSON array of exactly 6 strings, one per dimension, in this order:
1. Strategy & Positioning — seed: positioning|differentiation|competitive moat
2. Feature Breakdown — seed: feature design|usability|interaction design
3. Growth & Acquisition — seed: growth loops|go-to-market|PLG|distribution
4. Retention & Engagement — seed: retention|habit|engagement|churn|stickiness
5. Business & Revenue — seed: business model|monetization|pricing|revenue model
6. UX & Onboarding — seed: onboarding|UX|activation|aha moment|time to value
${focusInstruction}

No explanation. No markdown. No preamble. Valid JSON array only.
Scry analyzes digital products only — software, apps, and SaaS. Do not generate terms related to hardware, manufacturing, supply chain, or physical products.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  const text = data?.content?.[0]?.text?.trim();
  if (!text) {
    console.error("generateSearchQueries API error:", JSON.stringify(data));
    return DIMENSION_SEEDS;
  }

  try {
    const clean = text.replace(/```json\n?|\n?```/g, "").trim();
    const queries = JSON.parse(clean);
    if (Array.isArray(queries) && queries.length === 6) return queries;
  } catch {
    console.error("Failed to parse generate query list:", text);
  }

  return DIMENSION_SEEDS;
}

async function generateCritiqueContext(
  productName: string,
  userTeardown: string,
): Promise<{ scope: string; queries: string[] }> {
  const prompt = `You are analyzing a product teardown to prepare it for structured critique.
Read the full teardown text below and produce three things:

1. SUMMARY: 4-5 sentences covering what product is analyzed, which analytical angles the author took, and what appears missing or thin. Descriptive, not evaluative.

2. SCOPE: Classify as exactly one of: feature, product, company.
   - feature = specific feature or flow (e.g. onboarding, a checkout experience, a single modal)
   - product = full product or app, including core use cases, UX, and value proposition
   - company = company-level strategy, business model, competitive positioning
   Default to product if ambiguous.

3. QUERIES: Using your summary, extend each seed below with 2-3 product-specific pipe-delimited terms. Same 6 dimensions in order.
   1. Strategy & Positioning — seed: positioning|differentiation|competitive moat
   2. Feature Breakdown — seed: feature design|usability|interaction design
   3. Growth & Acquisition — seed: growth loops|go-to-market|PLG|distribution
   4. Retention & Engagement — seed: retention|habit|engagement|churn|stickiness
   5. Business & Revenue — seed: business model|monetization|pricing|revenue model
   6. UX & Onboarding — seed: onboarding|UX|activation|aha moment|time to value

Return ONLY valid JSON in this exact shape. No explanation. No markdown. No preamble.

{
  "summary": "...",
  "scope": "feature" | "product" | "company",
  "queries": ["...", "...", "...", "...", "...", "..."]
}

TEARDOWN TEXT:
${userTeardown}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  const text = data?.content?.[0]?.text?.trim();

  try {
    const clean = text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(clean);
    if (parsed.scope && Array.isArray(parsed.queries) && parsed.queries.length === 6) {
      return { scope: parsed.scope, queries: parsed.queries };
    }
  } catch {
    console.error("Failed to parse critique context:", text);
  }

  return { scope: "product", queries: DIMENSION_SEEDS };
}


// ---- Chunk-based semantic retrieval + self-correcting citations ----
// Added 2026-09-09 to fix a confirmed, measured bug: archive citations were
// only 20% precise (18/90 verified) because the model had to infer, from raw
// undifferentiated transcript text, who said what — and it systematically
// confused the host's paraphrased commentary for the guest's original words
// (a claim's generated wording is summary-shaped, and so is the host's own
// commentary, so the two keep matching each other in similarity space). The
// fix: retrieve real chunks with real speaker metadata attached as actual
// data (lenny_corpus_chunks.speaker/speaker_role, captured once when the
// corpus was chunked, not inferred per-citation), and never trust the
// model's own claimed attribution — always resolve it against that data
// after generation. See scripts/eval/lib/archive-lookup.mjs for the
// original, validated version of this same approach (built for the eval;
// this ports it into live generation).
//
// Known, deliberate limitation, not fixed here: this corrects misattribution
// (wrong person) and fabrication (no real source) — it cannot catch a claim
// that cites the *right* person while distorting the actual content, since
// similarity measures topical closeness, not factual correctness. See
// docs/scry-eval-status.md's backlog for why that's a separate mechanism,
// deliberately out of scope this week.

const GEMINI_EMBED_MODEL = "gemini-embedding-2";
const GEMINI_EMBED_DIM = 3072;

interface ArchiveChunk {
  text: string;
  speaker: string | null;
  speaker_role: string | null;
  title: string;
  content_type: string;
  published_date: string | null;
  filename: string;
  embedding: number[];
}

// Never throws — a missing key, a down API, or a malformed response all
// degrade to null so retrieval/correction can fall back to the old
// FTS-only / name-presence-only behavior rather than breaking generation
// outright. Reliability of the live product matters more than this specific
// improvement always firing.
async function embedText(text: string): Promise<number[] | null> {
  const apiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBED_MODEL}:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: { parts: [{ text: text.slice(0, 8000) }] } }),
      },
    );
    if (!res.ok) {
      console.error("embedText failed:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const vec = data?.embedding?.values;
    if (!Array.isArray(vec) || vec.length !== GEMINI_EMBED_DIM) {
      console.error("embedText: unexpected embedding shape", vec?.length);
      return null;
    }
    return vec;
  } catch (e) {
    console.error("embedText error:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Chunk-based retrieval: the same FTS RPC as searchLennyData narrows to
// candidate documents first (cheap, unchanged), then real chunks (with real
// speaker metadata) are fetched for those candidates and reranked by
// embedding similarity to the query. Kept to 5 candidate documents (not the
// 15 used in the offline eval matcher) to bound per-request latency/DB
// payload in a live, user-facing request — this is a live-traffic tradeoff,
// not a correctness one; worth re-measuring once real latency is observed.
// Returns [] (never throws) if the query couldn't be embedded or nothing
// matched — the caller falls back to the old flat-text path in that case.
async function searchLennyChunks(
  query: string,
  contentType = "",
  limit = 5,
): Promise<ArchiveChunk[]> {
  const queryVec = await embedText(query);
  if (!queryVec) return [];

  const { data: candidates, error } = await supabase.rpc("search_lenny_corpus", {
    q: query,
    match_limit: 5,
    filter_type: contentType,
  });
  if (error || !Array.isArray(candidates) || candidates.length === 0) return [];

  const scored: Array<ArchiveChunk & { _sim: number }> = [];
  for (const cand of candidates as { filename: string; title: string; content_type: string; published_date: string | null }[]) {
    // Capped, not unbounded: confirmed for real, 2026-09-10 — some podcast
    // transcripts have 300+ chunks (each a 3072-float embedding), and
    // fetching every chunk for every one of 5 candidates across 7 queries
    // per generation crashed the Edge Function outright with
    // WORKER_RESOURCE_LIMIT on 2 of 12 real products. Ordered by
    // chunk_index for a deterministic (if imperfect) subset rather than an
    // arbitrary one. The real fix is ranking by similarity *in Postgres*,
    // scoped to this one filename (cheap — a few hundred rows at most, not
    // the whole 46k-row corpus that timed out earlier tonight) instead of
    // transferring every embedding over the network to rank in JS; that
    // needs a new scoped RPC (a migration), not available in this session
    // — noted in docs/scry-eval-status.md backlog.
    const { data: chunks } = await supabase
      .from("lenny_corpus_chunks")
      .select("chunk_text, speaker, speaker_role, embedding")
      .eq("filename", cand.filename)
      .order("chunk_index")
      .limit(60);
    if (!chunks) continue;
    for (const ch of chunks as { chunk_text: string; speaker: string | null; speaker_role: string | null; embedding: string }[]) {
      let vec: number[];
      try {
        vec = JSON.parse(ch.embedding);
      } catch {
        continue;
      }
      scored.push({
        text: ch.chunk_text,
        speaker: ch.speaker,
        speaker_role: ch.speaker_role,
        title: cand.title,
        content_type: cand.content_type,
        published_date: cand.published_date,
        filename: cand.filename,
        embedding: vec,
        _sim: cosineSimilarity(queryVec, vec),
      });
    }
  }

  scored.sort((a, b) => b._sim - a._sim);
  return scored.slice(0, limit);
}

// Full-text search over the local Lenny corpus mirror (public.lenny_corpus),
// through the search_lenny_corpus() RPC. Returns SOURCE-delimited excerpt blocks
// in the same shape the retired LennyData MCP produced, or "" when nothing hits.
// The corpus is refreshed from the ZIP export by scripts/sync-lenny-corpus.mjs.
//
// `query` is a pipe-delimited keyword string (e.g. "pricing|monetization|tier");
// `contentType` is "podcast" | "newsletter" | "" (no filter).
// diag, when passed, is filled in as a side effect for eval instrumentation only.
async function searchLennyData(
  query: string,
  limit = 5,
  contentType = "",
  diag?: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await supabase.rpc("search_lenny_corpus", {
    q: query,
    match_limit: limit,
    filter_type: contentType,
  });

  if (diag) {
    diag.rpc_error = error?.message ?? null;
    diag.parsed_result_count = Array.isArray(data) ? data.length : 0;
  }

  if (error) {
    console.error(`lenny_corpus [${query}] error:`, error.message);
    return "";
  }
  if (!Array.isArray(data) || data.length === 0) {
    console.log(`lenny_corpus [${query}]: 0 results`);
    return "";
  }

  console.log(`lenny_corpus [${query}]: ${data.length} results`);

  return (data as {
    title: string;
    content_type: string;
    published_date: string | null;
    headline: string;
  }[])
    .map((r) =>
      `SOURCE: ${r.title} (${r.content_type}, ${r.published_date ?? "n.d."})\n${r.headline}`
    )
    .join("\n\n---\n\n");
}

function isVerifiedInCorpus(name: string, corpus: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const speakerPattern = new RegExp(`\\*\\*${escaped}\\*\\*\\s*\\(\\d`, "i");
  const sourceTitlePattern = new RegExp(`^SOURCE:.*${escaped}`, "im");
  return speakerPattern.test(corpus) || sourceTitlePattern.test(corpus);
}

function verifyArchiveCitations(text: string, corpus: string): string {
  const blockRegex = /\(([^)]+·\s*Lenny's Archive[^)]*)\)/g;
  let result = text;
  const blocks: Array<{ full: string; inner: string }> = [];
  let match;
  while ((match = blockRegex.exec(text)) !== null) {
    blocks.push({ full: match[0], inner: match[1] });
  }

  const strippedNames: string[] = [];

  for (const { full, inner } of blocks) {
    const parts = inner.split(";").map(p => p.trim());
    const verified: string[] = [];

    for (const part of parts) {
      // Extract name: before comma if present, otherwise before the · marker
      const nameMatch = part.match(/^([^,·]+)[,·]/);
      if (!nameMatch) {
        console.log(`Stripping malformed citation: ${part.trim()}`);
        continue;
      }
      const name = nameMatch[1].trim();
      if (isVerifiedInCorpus(name, corpus)) {
        verified.push(part);
      } else {
        strippedNames.push(name);
        console.log(`Stripping unverified citation: ${part.trim()}`);
      }
    }

    if (verified.length === 0) {
      result = result.replace(new RegExp("\\s*" + full.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "");
    } else if (verified.length < parts.length) {
      result = result.replace(full, `(${verified.join("; ")})`);
    }
  }

  // Replace orphaned stripped names in prose with "the team"
  for (const name of strippedNames) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`\\b${escaped}'s\\b`, "gi"), "the team's");
    result = result.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "the team");
  }

  return result.trim();
}

function verifyTrainingKnowledgeCitations(text: string): string {
  // Strip (Name, Role) citations that are neither archive badges nor valid web citations.
  // Matches: two+ capitalized words followed by comma and non-month-year content.
  const suspectRegex = /\(([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+),\s*([^)]+)\)/g;
  const monthYearPattern = /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/i;
  const yearOnlyPattern = /^\d{4}/;

  let result = text;
  const toStrip: string[] = [];
  let match;

  while ((match = suspectRegex.exec(text)) !== null) {
    const full = match[0];
    const secondPart = match[2].trim();
    if (full.includes("Lenny's Archive")) continue;
    if (monthYearPattern.test(secondPart)) continue;
    if (yearOnlyPattern.test(secondPart)) continue;
    console.log(`Stripping training-knowledge citation: ${full}`);
    toStrip.push(full);
  }

  for (const citation of toStrip) {
    result = result.replace(new RegExp("\\s*" + citation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "");
  }

  return result;
}

function stripBareArchiveCitations(text: string): string {
  // Strip (Lenny's Archive, year) or (Lenny's Archive · anything) with no person name
  return text.replace(/\s*\(Lenny's Archive[^)]*\)/g, (match) => {
    // Keep it only if it contains a · preceded by a name (handled by verifyArchiveCitations)
    if (/·/.test(match)) return match;
    console.log(`Stripping bare archive citation: ${match.trim()}`);
    return "";
  });
}

// Defensive safety net, not a fix for a known-understood cause: observed once
// (2026-09-09, real deployed test) that a citation's name portion could end up
// as the literal stripped-name placeholder "the team" instead of the whole
// citation block being removed cleanly — e.g. "(the team, VP of Marketing and
// Partnerships · Lenny's Archive)". Reproduction attempts (3 further local
// generations, including one that hit the same strip path) did not repeat it,
// and the block-removal regex works correctly in isolation against the exact
// failing text, so the precise trigger is unconfirmed — possibly a rare
// overlap between two citations' literal text in the same field. "the team"
// is never a legitimate citation name under any circumstance, so this is
// removed categorically regardless of root cause, as a last-resort net rather
// than a targeted fix.
function stripMalformedTeamCitations(text: string): string {
  return text.replace(/\s*\(the team,[^)]*\)/gi, (match) => {
    console.log(`Stripping malformed leftover citation: ${match.trim()}`);
    return "";
  });
}

// Eval-only observation: counts archive-format citations `(Name, Role · Lenny's
// Archive)` across all string fields. Read-only — does not affect verifyArchiveCitations
// or any scrubbing behavior. Called before and after verifyParsedCitations to answer
// "how many citations did the scrubber remove" without guessing about regex behavior.
function countArchiveCitations(parsed: Record<string, unknown>): number {
  const blockRegex = /\(([^)]+·\s*Lenny's Archive[^)]*)\)/g;
  let count = 0;
  for (const value of Object.values(parsed)) {
    if (typeof value !== "string") continue;
    let match;
    while ((match = blockRegex.exec(value)) !== null) {
      count += match[1].split(";").length;
    }
  }
  return count;
}

function verifyParsedCitations(parsed: Record<string, unknown>, corpus: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string") {
      let v = verifyArchiveCitations(value, corpus);
      v = verifyTrainingKnowledgeCitations(v);
      v = stripBareArchiveCitations(v);
      v = stripMalformedTeamCitations(v);
      result[key] = v;
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ---- Self-correcting archive citations (chunk pool required) ----
// Replaces name-presence checking (verifyArchiveCitations, kept above as the
// fallback for when no chunk pool is available) with real resolution: match
// each citation's claim against the actual chunks retrieved for this
// generation, and force the byline to whatever that chunk's real speaker is
// — never trust the model's own claimed attribution as final.

const CITATION_SIMILARITY_THRESHOLD = 0.72; // same value validated 2026-09-09 in archive-lookup.mjs

function namesRoughlyMatch(a: string, b: string): boolean {
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  return na === nb || na.includes(nb) || nb.includes(na);
}

// Walks back from a citation to the nearest sentence boundary to isolate the
// substantive claim being cited, capped at a fixed window so one long
// run-on paragraph can't pull in unrelated prior sentences.
function extractClaimBeforeCitation(text: string, citationStart: number): string {
  const WINDOW = 400;
  const start = Math.max(0, citationStart - WINDOW);
  const preceding = text.slice(start, citationStart);
  const lastBreak = Math.max(
    preceding.lastIndexOf(". "),
    preceding.lastIndexOf("! "),
    preceding.lastIndexOf("? "),
    preceding.lastIndexOf("\n"),
  );
  return (lastBreak >= 0 ? preceding.slice(lastBreak + 2) : preceding).trim();
}

async function verifyAndCorrectArchiveCitations(text: string, chunkPool: ArchiveChunk[]): Promise<string> {
  const blockRegex = /\(([^)]+·\s*Lenny's Archive[^)]*)\)/g;
  const blocks: Array<{ full: string; inner: string; index: number }> = [];
  let match;
  while ((match = blockRegex.exec(text)) !== null) {
    blocks.push({ full: match[0], inner: match[1], index: match.index });
  }

  let result = text;
  const strippedNames: string[] = [];

  for (const { full, inner, index } of blocks) {
    const parts = inner.split(";").map((p) => p.trim());
    const claim = extractClaimBeforeCitation(text, index);
    if (!claim) continue; // no usable context — leave this citation untouched rather than guess

    const claimVec = await embedText(claim);
    if (!claimVec) continue; // embedding failed; leave untouched rather than strip on a false negative

    let best: { chunk: ArchiveChunk; sim: number } | null = null;
    for (const chunk of chunkPool) {
      const sim = cosineSimilarity(claimVec, chunk.embedding);
      if (!best || sim > best.sim) best = { chunk, sim };
    }

    const resolvedParts: string[] = [];
    for (const part of parts) {
      const nameMatch = part.match(/^([^,·]+)[,·]/);
      if (!nameMatch) continue; // malformed, drop silently — same as verifyArchiveCitations
      const claimedName = nameMatch[1].trim();

      if (best && best.sim >= CITATION_SIMILARITY_THRESHOLD && best.chunk.speaker) {
        if (namesRoughlyMatch(claimedName, best.chunk.speaker)) {
          // Already correct — keep the model's own (more specific) role text.
          resolvedParts.push(part);
        } else {
          // Misattributed — override. Real data only gives a coarse
          // host/guest role, not a specific title; a generic but CORRECT
          // role beats a specific but WRONG one, so don't invent a fake title.
          const roleLabel = best.chunk.speaker_role === "host" ? "Host" : "Guest";
          resolvedParts.push(`${best.chunk.speaker}, ${roleLabel} · Lenny's Archive`);
          console.log(`Corrected citation: "${claimedName}" -> "${best.chunk.speaker}" (sim ${best.sim.toFixed(2)})`);
        }
      } else {
        strippedNames.push(claimedName);
        console.log(`Stripping unsupported citation: ${part} (best sim ${best?.sim?.toFixed(2) ?? "n/a"})`);
      }
    }

    if (resolvedParts.length === 0) {
      result = result.replace(new RegExp("\\s*" + full.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "");
    } else if (resolvedParts.length !== parts.length || resolvedParts.some((p, i) => p !== parts[i])) {
      result = result.replace(full, `(${resolvedParts.join("; ")})`);
    }
  }

  for (const name of strippedNames) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`\\b${escaped}'s\\b`, "gi"), "the team's");
    result = result.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "the team");
  }

  return result.trim();
}

// Drop-in replacement for verifyParsedCitations: uses the chunk pool when
// available (real speaker data, self-correcting); gracefully degrades to the
// old name-presence check when it isn't (Gemini down, no API key, or
// genuinely nothing retrieved at the chunk level for this whole generation).
async function verifyAndCorrectParsedCitations(
  parsed: Record<string, unknown>,
  chunkPool: ArchiveChunk[],
  fallbackCorpusText: string,
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string") {
      let v = chunkPool.length > 0
        ? await verifyAndCorrectArchiveCitations(value, chunkPool)
        : verifyArchiveCitations(value, fallbackCorpusText);
      v = verifyTrainingKnowledgeCitations(v);
      v = stripBareArchiveCitations(v);
      v = stripMalformedTeamCitations(v);
      result[key] = v;
    } else {
      result[key] = value;
    }
  }
  return result;
}

async function generateLennysLens(
  productName: string,
  mode: string,
  lennyCorpus: string,
  teardownContext: string,
): Promise<string> {
  const context = mode === "critique"
    ? `a critique of a product teardown for ${productName}`
    : `a product teardown of ${productName}`;

  const corpusBlock = lennyCorpus.length > 0
    ? `LENNY'S ARCHIVE:\n${lennyCorpus}`
    : `LENNY'S ARCHIVE:\nNo relevant archive content found.`;

  const prompt = `You are writing the "Lenny's Lens" section for ${context}.

This section applies Lenny Rachitsky's perspective specifically to this product's situation. Use the archive excerpts and the product analysis below as your source material.

PRODUCT ANALYSIS:
${teardownContext}

${corpusBlock}

RULES:
- Do not include a title, heading, or label of any kind. The very first character of your response must be the start of the content itself. If your response begins with #, *, or any markdown syntax, that is a violation — start directly with a word.
- Do not mention any person by name — no guest names, no expert names, no one. Do not use inline citations of any kind.
- Do not draw comparisons to other companies by name. The section is about ${productName} specifically, not about what Atlassian or HubSpot or anyone else did.
- Ground every observation in something visible in the archive or the product analysis above. Do not import outside knowledge.
- Be specific about ${productName}'s situation — generic product wisdom that applies to any company is not acceptable.
- 3-5 sentences. No em dashes. No sycophancy. No AI filler phrases. Write with conviction.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  if (!data?.content?.[0]?.text) {
    console.error("Lenny's Lens API error:", JSON.stringify(data));
    return "";
  }
  return data.content[0].text.trim();
}

async function callMainModel(systemPrompt: string, userMessage: string): Promise<Record<string, unknown>> {
  const mainResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 3500,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  }).then(r => r.json());

  const text = mainResponse?.content?.[0]?.text;
  if (!text) {
    console.error("callMainModel API error:", JSON.stringify(mainResponse));
    throw new Error("No content in Claude response");
  }
  const clean = text.replace(/```json\n?|\n?```/g, "").trim();

  try {
    return JSON.parse(clean);
  } catch (e) {
    console.error("JSON parse failed, attempting salvage:", e.message);
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`Failed to parse Claude response: ${e.message}`);
  }
}

// Zero-coverage fallback: when the archive has no real hits for a product
// by name (small/unknown companies), pull category + business-model signal
// out of the web search results instead, so a follow-up archive query can
// surface a real ANALOGOUS discussion (e.g. usage-based pricing at a
// different vertical SaaS company) rather than leaving the model with
// nothing — which is what led it to fabricate archive citations for
// products like Arena Physica. Returns null when the web results don't
// give it enough to work with.
async function extractCategorySignal(
  productName: string,
  webContext: string,
): Promise<string | null> {
  const prompt = `You are preparing a fallback search query for a product-strategy podcast/newsletter archive.

The archive has no coverage of "${productName}" by name — it's a small or obscure company. Below are web search results about it. Extract its product category, business model, and market segment, then produce a pipe-delimited keyword query (4-6 terms) that would surface ANALOGOUS discussions in the archive — other companies in the same category or with the same business model — even though the archive never mentions "${productName}" itself.

Do not include "${productName}" or any competitor's proper name in the query. Use general category/business-model/market terms only, e.g. "vertical SaaS|usage-based pricing|clinical software|physical therapy".

WEB RESULTS:
${webContext.slice(0, 4000)}

Output ONLY the pipe-delimited query string. No explanation, no markdown, no quotes. If the web results give you nothing to work with, output exactly: UNKNOWN`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  const text = data?.content?.[0]?.text?.trim();
  if (!text || text === "UNKNOWN" || !text.includes("|")) {
    if (text && text !== "UNKNOWN") console.error("extractCategorySignal unexpected output:", text);
    return null;
  }
  return text;
}

async function searchWeb(query: string): Promise<{ text: string; firstUrl: string }> {
  const apiKey = Deno.env.get("EXA_API_KEY") ?? "";

  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query,
      num_results: 5,
      use_autoprompt: true,
      contents: {
        text: {
          max_characters: 1000,
        },
      },
    }),
  });

  console.log(`Exa search [${query}] status:`, response.status);

  if (!response.ok) {
    console.error("Exa search failed:", await response.text());
    return { text: "", firstUrl: "" };
  }

  const data = await response.json();

  if (!data.results?.length) {
    console.log(`Exa search [${query}]: 0 results`);
    return { text: "", firstUrl: "" };
  }

  console.log(`Exa search [${query}]: ${data.results.length} results`);

  const firstUrl: string = data.results[0]?.url ?? "";
  const text = data.results.map((r: {
    title: string;
    url: string;
    publishedDate?: string;
    text?: string;
  }) => {
    const date = r.publishedDate ? ` (${r.publishedDate.slice(0, 10)})` : "";
    return `WEB SOURCE: ${r.title}${date}\nURL: ${r.url}\n${r.text ?? ""}`;
  }).join("\n\n---\n\n");

  return { text, firstUrl };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { productName, mode, userTeardown, chatMessages, teardownContext, teardownId, timezone, debug, focus } = body;

    const { userId, userEmail } = getUserFromJwt(req.headers.get("Authorization"));
    const isDevUser = userEmail === DEV_EMAIL;
    // Eval-only instrumentation (corpus retrieval + citation scrub counts). Gated to the
    // dev-bypass user so ordinary product traffic never carries this extra payload.
    const includeDebug = debug === true && isDevUser;
    const tz = getTimezoneAbbr(typeof timezone === "string" ? timezone : undefined);
    const today = getLocalDate(typeof timezone === "string" ? timezone : "UTC");

    // ── Chat mode ────────────────────────────────────────────────────────────
    if (mode === "chat") {
      // Chat rate limit: 10 messages per teardown
      if (!isDevUser && teardownId) {
        const { data: teardownRow } = await supabase
          .from("teardowns")
          .select("chat_message_count")
          .eq("id", teardownId)
          .single();

        if ((teardownRow?.chat_message_count ?? 0) >= 10) {
          return new Response(JSON.stringify({
            error: "chat_limit_exceeded",
            message: `You've reached the 10 message limit for this teardown. Your limit resets at midnight ${tz}.`,
          }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      const systemPrompt = `You are a product expert. The user has received a product teardown or critique shown below. Answer their follow-up questions using the teardown as your primary reference. Be concise, specific, and insightful. Build on the teardown rather than repeating it. No em dashes. Topic-locked to product strategy.

TEARDOWN CONTEXT:
${teardownContext}`;

      const messages = chatMessages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      }));

      const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 2000,
          stream: true,
          system: systemPrompt,
          messages,
        }),
      });

      if (!anthropicResponse.body) {
        throw new Error("No streaming body from Anthropic");
      }

      if (teardownId) {
        await supabase.rpc("increment_chat_count", { p_teardown_id: teardownId });
      }

      const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      (async () => {
        const reader = anthropicResponse.body!.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
                  await writer.write(encoder.encode(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`));
                }
              } catch { /* skip malformed */ }
            }
          }
          await writer.write(encoder.encode("data: [DONE]\n\n"));
        } catch (e) {
          console.error("Chat stream error:", e);
        } finally {
          await writer.close();
        }
      })();

      return new Response(readable, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    }

    // ── Daily teardown rate limit ────────────────────────────────────────────
    if (userId && !isDevUser) {
      const { data: usageRow } = await supabase
        .from("usage_limits")
        .select("teardown_count")
        .eq("user_id", userId)
        .eq("date", today)
        .single();

      if ((usageRow?.teardown_count ?? 0) >= 5) {
        return new Response(JSON.stringify({
          error: "daily_limit_exceeded",
          message: `You've used all 5 of your teardowns today. Your limit resets at midnight ${tz}.`,
        }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ── Input validation for critique mode ───────────────────────────────────
    if (mode === "critique") {
      const text = userTeardown?.trim() ?? "";

      if (text.length < 150) {
        return new Response(JSON.stringify({
          error: "Your teardown is too short to critique. Please provide more analysis.",
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const nonPrintable = text.split("").filter(
        (c: string) => c.charCodeAt(0) < 32 || c.charCodeAt(0) > 126
      ).length;
      if (nonPrintable / text.length > 0.1) {
        return new Response(JSON.stringify({
          error: "We couldn't read your teardown. Please paste the text directly.",
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const words = text.split(/\s+/).filter((w: string) => w.length > 2);
      if (words.length < 30) {
        return new Response(JSON.stringify({
          error: "This doesn't look like a product teardown. Please write or paste your analysis.",
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ── Step 1: Generate search queries ─────────────────────────────────────
    let searchQueries: string[];
    let scope = "product";

    if (mode === "generate") {
      console.log("Generating search queries for:", productName, focus ? `(focus: ${focus})` : "");
      searchQueries = await generateSearchQueries(productName, focus);
    } else {
      console.log("Generating critique context for:", productName);
      const critiqueContext = await generateCritiqueContext(productName ?? "", userTeardown ?? "");
      scope = critiqueContext.scope;
      searchQueries = critiqueContext.queries;
    }

    console.log("Scope:", scope);
    console.log("Generated queries:", searchQueries);

    // ── Step 2: Search LennyData + web in parallel ───────────────────────────
    const webQuery = `${productName} product strategy 2026`;

    const allLennyQueries = [productName ?? "", ...searchQueries];
    // diags[i] is filled in as a side effect of the matching resolveLennyQuery
    // call when includeDebug is on; it never alters the request or returned text.
    const lennyDiags: Record<string, unknown>[] = allLennyQueries.map(() => ({}));

    // Chunk-based retrieval first (real speaker metadata, used for both the
    // prompt and the post-generation citation correction below); falls back
    // per-query to the old flat-text FTS path if embedding fails or nothing
    // matched at the chunk level, so retrieval never hard-fails.
    async function resolveLennyQuery(
      query: string,
      diag?: Record<string, unknown>,
    ): Promise<{ text: string; chunks: ArchiveChunk[] }> {
      const chunks = await searchLennyChunks(query, "", 5);
      if (chunks.length > 0) {
        if (diag) {
          diag.mode = "semantic_chunks";
          diag.parsed_result_count = chunks.length;
        }
        const text = chunks
          .map((c) => {
            const speakerLabel = c.speaker ? ` — speaker: ${c.speaker} (${c.speaker_role ?? "unknown"})` : "";
            return `SOURCE: ${c.title} (${c.content_type}, ${c.published_date ?? "n.d."}${speakerLabel})\n${c.text}`;
          })
          .join("\n\n---\n\n");
        return { text, chunks };
      }
      const fallbackText = await searchLennyData(query, 5, "", diag);
      if (diag) diag.mode = "fts_fallback";
      return { text: fallbackText, chunks: [] };
    }

    const [lennyResolved, webSearchResult] = await Promise.all([
      Promise.all(allLennyQueries.map((q, i) => resolveLennyQuery(q, includeDebug ? lennyDiags[i] : undefined))),
      searchWeb(webQuery),
    ]);

    const lennyResults = lennyResolved.map((r) => r.text);
    // Pooled across every query for this generation — reused by the citation
    // correction step below with zero extra retrieval cost, since it's the
    // same context Sonnet is about to read. The zero-coverage fallback below
    // (Step 2b) pushes into this same pool too, via the same resolver.
    const chunkPool: ArchiveChunk[] = lennyResolved.flatMap((r) => r.chunks);
    let lennyCorpus = lennyResults.filter(Boolean).join("\n\n===\n\n");
    console.log("Lenny corpus length:", lennyCorpus.length, "| chunk pool size:", chunkPool.length);
    console.log("Web context length:", webSearchResult.text.length);

    // ── Step 2b: Zero-coverage fallback ──────────────────────────────────────
    // The 6 dimension queries above always use working seed terms (e.g.
    // "positioning|differentiation|competitive moat"), so they almost always
    // return *something* from the archive even for a product it has never
    // heard of — that generic content is real, but it's not about this
    // product. The actual "does the archive know this company" signal is the
    // plain product-name query (allLennyQueries[0] / lennyResults[0]). When
    // that comes back empty (or with only a stray coincidental keyword hit —
    // e.g. "Resolve AI" spuriously matching on the common words "resolve"
    // and "ai" in unrelated transcripts), extract category/business-model
    // signal from the web results and run one follow-up archive query with
    // that instead, then fold its results into the corpus alongside the
    // dimension-query material. See extractCategorySignal above for why.
    const nameQueryResultCount = (lennyResults[0]?.match(/^SOURCE: /gm) ?? []).length;
    const nameQueryIsThin = nameQueryResultCount < 2;
    let fallbackQuery: string | null = null;
    let fallbackResult = "";
    const fallbackDiag: Record<string, unknown> = {};
    if (nameQueryIsThin && webSearchResult.text.length > 0) {
      fallbackQuery = await extractCategorySignal(productName ?? "", webSearchResult.text);
      if (fallbackQuery) {
        console.log("Thin/no archive coverage for product name — fallback category query:", fallbackQuery);
        // Same chunk-aware resolver as the dimension queries above, not the
        // raw flat-text search directly — so a zero-coverage product's
        // fallback content also gets real speaker metadata and benefits
        // from the citation-correction step, instead of reintroducing the
        // old undifferentiated-text path for exactly the products that
        // most needed the misattribution fix.
        const resolved = await resolveLennyQuery(fallbackQuery, includeDebug ? fallbackDiag : undefined);
        fallbackResult = resolved.text;
        if (fallbackResult) {
          lennyCorpus = [lennyCorpus, fallbackResult].filter(Boolean).join("\n\n===\n\n");
          chunkPool.push(...resolved.chunks);
          console.log("Lenny corpus length (post-fallback):", lennyCorpus.length, "| chunk pool size:", chunkPool.length);
        }
      } else {
        console.log("Thin/no archive coverage for product name — no usable category signal from web results");
      }
    }

    // Eval-only diagnostics: per-query retrieval size/counts plus the RPC error
    // (if any), so a zero-result run can be told apart from a query bug without
    // needing edge function logs.
    let corpusRetrieval: Record<string, unknown> | undefined;
    if (includeDebug) {
      corpusRetrieval = Object.fromEntries(allLennyQueries.map((q, i) => {
        const result = lennyResults[i] ?? "";
        return [`query_${i + 1}`, {
          query: q,
          result_chars: result.length,
          result_count: result ? (result.match(/^SOURCE: /gm) ?? []).length : 0,
          ...lennyDiags[i],
        }];
      }));
      corpusRetrieval.fallback = {
        triggered: nameQueryIsThin && webSearchResult.text.length > 0,
        name_query_result_count: nameQueryResultCount,
        query: fallbackQuery,
        result_chars: fallbackResult.length,
        result_count: fallbackResult ? (fallbackResult.match(/^SOURCE: /gm) ?? []).length : 0,
        ...fallbackDiag,
      };
    }

    const lennySection = lennyCorpus.length > 0
      ? `LENNY'S ARCHIVE — FRAMEWORKS & PHILOSOPHY:\n${lennyCorpus}`
      : `LENNY'S ARCHIVE — FRAMEWORKS & PHILOSOPHY:\nNo direct archive coverage found. In Lenny's Lens, identify relevant frameworks or patterns from the corpus by name, citing the guest or episode theme, and explain why each applies.`;

    const webSection = webSearchResult.text.length > 0
      ? `CURRENT WEB CONTEXT (use for facts, recent developments, current state):\n${webSearchResult.text}`
      : `CURRENT WEB CONTEXT:\nNo recent web results found. Note where current information would strengthen the analysis.`;

    // ── Step 3: Generate teardown/critique + isolated Lenny's Lens in parallel ─

    const sourceInstruction = `You have two knowledge sources:
1. LENNY'S ARCHIVE — use for frameworks, philosophy, mental models, and strategic patterns. Only use ideas and frameworks that appear directly in the provided excerpts.
2. CURRENT WEB CONTEXT — use for current facts, recent developments, and anything time-sensitive.

CITATION FORMAT — apply to every section:
- Archive: (Full Name, Role · Lenny's Archive) — use the person's full first and last name, always. Never use last name only. The person's full name always comes first — never lead with the outlet, source, or product name. Never write a bare (Lenny's Archive, year) reference without a person's full name. Only cite an archive guest when the retrieved excerpt explicitly and directly supports the specific claim — do not attribute a framework by name based on general expertise. Only attribute a concept to the person who explicitly originated it in the excerpt — do not attribute ideas to other people merely mentioned nearby. Cite at most 3 archive sources per section.
- Web: (Outlet, Month Year) — outlet name only, never an individual's name. Only cite a web source if it directly covers ${productName ?? "this product"}. Do not cite web sources whose primary subject is a different company, product, or industry.
- Training knowledge: welcome for analysis and frameworks. Never attach a person's name to it.
- Do not present case studies from the archive about other companies as if they happened to the product you are analyzing.

When sources conflict, trust web context for facts and the archive for frameworks.

CRITICAL: Your response must be valid JSON only. Do not use unescaped quotes inside string values. Do not use backticks inside strings. Escape any apostrophes or special characters properly. Never output markdown outside of the JSON structure.`;

    const digitalProductsConstraint = `Scry analyzes digital products only — software, apps, and SaaS. If a submission references hardware, manufacturing, or physical products, note this is outside scope and redirect analysis to the digital product layer only.`;

    const scopeConditionalBlock = `The user's teardown has been classified as scope: ${scope}.

Apply scope-aware evaluation inside gaps_and_blind_spots and framework_alignment only. suggested_improvements follows from gaps — stay within the same scope boundary.

If scope is "feature": evaluate against UX quality, interaction design, user flow, edge cases, usability. Do not flag missing growth model, business model, or company-level strategy.
If scope is "product": evaluate against product strategy, positioning, UX, onboarding, growth model, retention. Flag missing business model or pricing only if monetization is clearly central to the product being analyzed.
If scope is "company": evaluate against the full spectrum — strategy, competitive positioning, business model, distribution, growth loops, retention, UX quality. No restrictions.

strengths and lennys_lens are unconditional regardless of scope.`;

    const critiqueSourceConstraint = `ADDITIONAL CITATION RULE FOR CRITIQUE MODE: Do not cite any person whose name appears in the user's submitted teardown — names inherited from the user's text do not qualify as Lenny's Archive sources regardless of whether they are real experts. The citation rules in sourceInstruction above apply in full.`;

    // Optional upfront narrowing (generate mode only) — additive, not
    // restrictive: deepens treatment of whichever section(s) the user's
    // focus text is actually about, without letting any of the 6 sections
    // go thin just because they weren't it.
    const focusConstraint = (mode === "generate" && focus)
      ? `\nUSER-REQUESTED FOCUS: "${focus}". Give whichever section(s) this is actually about deeper, more specific treatment than the rest — more concrete detail, more direct opinions — while still fully covering all 6 sections. Do not force it into a section where it doesn't fit, and don't thin out unrelated sections just because they weren't the focus.\n`
      : "";

    const systemPrompt = mode === "critique"
      ? `You are a world-class product coach with access to insights from Lenny Rachitsky's podcast and newsletter archive, plus current web context.

${sourceInstruction}

${critiqueSourceConstraint}

${lennySection}

${webSection}

Using both sources, produce a structured critique with exactly 5 sections. Be direct and specific. No em dashes. No sycophancy. No superlatives. No AI filler phrases. Write factually, like a sharp analyst. Each section must be 3-5 sentences maximum. Prioritize insight density over coverage. Be ruthlessly concise.

Format your response as a JSON object with these exact keys: overall_assessment, strengths, gaps_and_blind_spots, framework_alignment, suggested_improvements.

Throughout each section, attribute insights inline using the formats defined above: (Name, Role · Lenny's Archive) for corpus guests, (Outlet, Month Year) for web sources.

${scopeConditionalBlock}

${digitalProductsConstraint}`
      : `You are a world-class product analyst with access to insights from Lenny Rachitsky's podcast and newsletter archive, plus current web context.

${sourceInstruction}

${lennySection}

${webSection}

Using both sources, produce a comprehensive full-stack product teardown with exactly 6 sections. Be specific and opinionated. No em dashes. No sycophancy. No superlatives. No AI filler phrases. Write factually, like a sharp analyst. Each section must be 3-5 sentences maximum. Prioritize insight density over coverage. Be ruthlessly concise.

Format your response as a JSON object with these exact keys: product_url, product_overview, strategy_and_positioning, feature_breakdown, growth_model, design_analysis, key_insights. For product_url, provide the official product homepage URL (e.g. "https://figma.com"). If unknown, use an empty string.

Throughout each section, attribute insights inline using the formats defined above: (Name, Role · Lenny's Archive) for corpus guests, (Outlet, Month Year) for web sources.

Where the archive contains differing perspectives between experts, surface that tension explicitly rather than flattening it.

If the input refers to a specific feature or flow rather than a full product or company, scope all sections to that feature. Do not extrapolate to company-level strategy or growth models beyond what directly relates to the feature being analyzed.
${focusConstraint}
${digitalProductsConstraint}`;

    const userMessage = mode === "critique"
      ? `Please critique this product teardown:\n\n${userTeardown}`
      : `Please produce a full-stack teardown of: ${productName}`;

    let parsed: Record<string, unknown>;
    try {
      parsed = await callMainModel(systemPrompt, userMessage);
    } catch (firstError) {
      console.error("Main call failed, retrying once:", firstError.message);
      parsed = await callMainModel(systemPrompt, userMessage);
    }

    // ── Verify + self-correct archive citations across all sections ──────────
    const citationsWritten = includeDebug ? countArchiveCitations(parsed) : undefined;
    parsed = await verifyAndCorrectParsedCitations(parsed, chunkPool, lennyCorpus);
    const citationsSurvived = includeDebug ? countArchiveCitations(parsed) : undefined;

    // ── Lenny's Lens: sequential, informed by main teardown output ────────────
    const lensContext = [
      parsed.strategy_and_positioning,
      parsed.key_insights,
      parsed.overall_assessment,
    ].filter(Boolean).join("\n\n");

    let lennysLens = await generateLennysLens(
      productName ?? "",
      mode,
      lennyCorpus,
      lensContext,
    );
    lennysLens = lennysLens.replace(/^#[^\n]*\n+/, "").trim();
    parsed.lennys_lens = lennysLens;

    if (userId && !isDevUser) {
      await supabase.rpc("increment_usage", { p_user_id: userId, p_date: today });
    }

    if (includeDebug) {
      parsed._eval_debug = {
        corpus_retrieval: corpusRetrieval,
        archive_citations: { written: citationsWritten, survived: citationsSurvived },
      };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error.message, error.stack);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});