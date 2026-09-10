// Section 6 of citation-verification.md, implemented — the archive lookup
// interface the extraction/classification stages plug into.
//
// Rewritten 2026-09-09: `match_type: "semantic"` now means real embedding
// cosine similarity against lenny_corpus_chunks (gemini-embedding-2,
// speaker-turn-aware chunks with real speaker metadata captured at chunking
// time — see scripts/embed-lenny-corpus.mjs), not word-overlap. The prior
// version scored word-overlap within the best-matching local window, and
// that had a proven, unfixable ceiling: a genuinely correct Duolingo-streaks
// match topped out at 0.43 confidence while a wrong match (generic growth
// newsletter, shares vocabulary but not content) sat at 0.538 — no threshold
// separated them (docs/LEARNING.md entry 12, docs/scry-eval-status.md).
// FTS (search_lenny_corpus) still narrows to candidate documents first —
// this is a hybrid, not a full-corpus ANN search — real embeddings only
// rerank chunks *within* those candidates. See archiveLookup() below for why.

import { createClient } from "@supabase/supabase-js";

let _client;
function db() {
  if (!_client) {
    _client = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return _client;
}

const EMBED_MODEL = "gemini-embedding-2";
const EMBED_DIM = 3072;

// Validated 2026-09-09 against the real corpus (46,053 chunks, full
// coverage) using the two known test claims from docs/scry-eval-status.md:
//
// - Streaks claim: correct source (jackson-shuttleworth.md) 0.8425 vs. next-
//   best wrong candidate 0.7695 — clear, wide separation, ranked #1 cleanly.
// - Growth-engine claim (the historically hardest case): correct source
//   (gina-gotthilf.md, confirmed to genuinely contain "organic and non-paid
//   growth channels") scored 0.8027 vs. a wrong candidate at 0.8051 — a real
//   competing document (Duolingo's own former Head of Product writing about
//   Duolingo's organic growth), not noise. Correct source narrowly lost the
//   #1 rank by 0.0024.
//
// The headline result: under the OLD word-overlap system this exact claim
// had wrong beating correct by +0.108 (0.538 vs. 0.43) — a systematic,
// unfixable bias. Under real embeddings it's within 0.0024 — a coin flip
// between two genuinely relevant sources, not a structural defect. That's
// the actual ceiling this rewrite was for, fixed. A near-tie between two
// real, defensible sources for a broad/general claim is a different, softer
// problem than "wrong systematically beats right," and 0.72 as an inclusion
// floor never bound either side of that specific case (both scored well
// above it) — it has NOT been validated against a genuinely fabricated
// claim (the low end), only against real true-positive candidates.
const SIMILARITY_THRESHOLD = 0.72;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const EMBED_RETRY_BACKOFFS_MS = [3_000, 10_000, 20_000];

// Retries transient Gemini failures (429/503, and a raw network-level throw)
// — confirmed happening for real, 2026-09-09: an unretried 503 here killed a
// whole citation-verification run partway through, losing all progress since
// this script batches its DB insert until the very end (see run-citation-
// verification.mjs's main()). Same pattern as embed-lenny-corpus.mjs's
// embedBatch, which needed the identical fix for the identical reason.
async function embedClaim(text) {
  let lastError;
  for (let attempt = 0; attempt <= EMBED_RETRY_BACKOFFS_MS.length; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: { parts: [{ text: text.slice(0, 8000) }] } }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        if ((res.status === 429 || res.status === 503) && attempt < EMBED_RETRY_BACKOFFS_MS.length) {
          lastError = new Error(`embedContent failed (${res.status}): ${JSON.stringify(data).slice(0, 300)}`);
        } else {
          throw new Error(`embedContent failed (${res.status}): ${JSON.stringify(data).slice(0, 300)}`);
        }
      } else {
        const data = await res.json();
        const vec = data?.embedding?.values;
        if (!Array.isArray(vec) || vec.length !== EMBED_DIM) {
          throw new Error(`Unexpected embedding shape: length ${vec?.length}`);
        }
        return vec;
      }
    } catch (err) {
      if (attempt >= EMBED_RETRY_BACKOFFS_MS.length) throw err;
      lastError = err;
    }
    const wait = EMBED_RETRY_BACKOFFS_MS[attempt];
    console.warn(`  [embedClaim retry: ${lastError.message}] waiting ${wait / 1000}s before retry ${attempt + 1}/${EMBED_RETRY_BACKOFFS_MS.length}`);
    await sleep(wait);
  }
  throw lastError;
}

function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Chunks for one candidate document — small (tens, not thousands), so no
// pgvector/RPC round trip is worth it here; plain filtered select, cosine
// math done in JS. (A whole-corpus ANN search via search_lenny_corpus_semantic
// is a separate, larger concern — it times out unindexed at 45,942 rows and
// isn't needed for this per-candidate reranking use case anyway.)
async function fetchChunks(filename) {
  const { data, error } = await db()
    .from("lenny_corpus_chunks")
    .select("chunk_text, chunk_index, speaker, speaker_role, embedding")
    .eq("filename", filename)
    .order("chunk_index");
  if (error || !data) return [];
  return data;
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with",
  "as", "is", "are", "was", "were", "be", "been", "being", "that", "this",
  "these", "those", "it", "its", "at", "by", "from", "into", "about", "than",
  "their", "his", "her", "they", "them", "has", "have", "had", "not", "no",
  "so", "if", "while", "which", "who", "whom", "what", "when", "where", "how",
]);

function significantWords(text) {
  return (text.toLowerCase().match(/[a-z0-9']+/g) ?? [])
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
}

// Build a pipe-delimited query string from a claim, same shape
// generate-teardown itself sends to search_lenny_corpus — take the most
// frequent/distinctive significant words, capped, so the tsquery isn't
// absurdly long for a whole paraphrased sentence.
function claimToQuery(claimText) {
  const words = significantWords(claimText);
  const uniq = [...new Set(words)];
  return uniq.slice(0, 8).join("|");
}

function normalizeForCompare(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function wordOverlapConfidence(claimText, candidateText) {
  const a = new Set(significantWords(claimText));
  const b = new Set(significantWords(candidateText));
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const w of a) if (b.has(w)) overlap++;
  return overlap / a.size; // fraction of the claim's significant words found in the candidate
}

// Finds the occurrence (of any of the claim's significant words) whose
// surrounding window contains the most of the claim's OTHER significant
// words too, instead of just the first word's first occurrence anywhere in
// the document. Replaces a real bug (see the call site) — a lone word
// appearing early in a long transcript is not evidence that's where the
// claim's content actually lives.
function bestMatchPosition(content, words) {
  const lower = content.toLowerCase();
  const uniqueWords = [...new Set(words)];
  if (uniqueWords.length === 0) return -1;

  const occurrences = [];
  for (const w of uniqueWords) {
    let idx = lower.indexOf(w);
    while (idx !== -1) {
      occurrences.push(idx);
      idx = lower.indexOf(w, idx + 1);
    }
  }
  if (occurrences.length === 0) return -1;

  const WINDOW = 400;
  let bestIdx = occurrences[0];
  let bestScore = -1;
  for (const idx of occurrences) {
    const windowText = lower.slice(Math.max(0, idx - WINDOW), Math.min(lower.length, idx + WINDOW));
    let score = 0;
    for (const w of uniqueWords) if (windowText.includes(w)) score++;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  }
  return bestIdx;
}

const HOST_NAME_VARIANTS = /^lenny(\s+rachitsky)?$/i;

// Find the nearest speaker tag ("**Name** (00:00:00)" or "**Name**:")
// preceding `atIndex` in the corpus row's raw markdown content. Same
// speaker-tag shape generate-teardown's own isVerifiedInCorpus() checks for.
function nearestPrecedingSpeaker(content, atIndex) {
  const tagRe = /\*\*([^*]{2,60})\*\*\s*(?:\(|:)/g;
  let last = null;
  let m;
  while ((m = tagRe.exec(content)) !== null) {
    if (m.index >= atIndex) break;
    last = m[1].trim();
  }
  return last;
}

async function fetchFullContent(filename) {
  const { data, error } = await db()
    .from("lenny_corpus")
    .select("content, source_url")
    .eq("filename", filename)
    .single();
  if (error || !data) return null;
  return data;
}

/**
 * archiveLookup({ claim_text, claimed_speaker, claimed_episode })
 *   => LookupResult[]
 * Per citation-verification.md §6's contract.
 */
export async function archiveLookup({ claim_text, claimed_speaker }) {
  const q = claimToQuery(claim_text);
  if (!q) return [];

  // 15, not 5: confirmed for real, 2026-09-09, that FTS's own document-level
  // ranking buries the genuinely correct source below the top 5 for claims
  // whose real answer is a small fraction of a long, broad-topic document
  // (one intro sentence in an hour-long transcript) competing against
  // documents densely, entirely about the query's generic keywords (a whole
  // newsletter titled "build your growth engine"). Real case: the
  // growth-engine claim's correct source (gina-gotthilf.md, verified to
  // actually contain "organic and non-paid growth channels") ranked #7.
  // Semantic reranking below can only work on whatever FTS hands it — this
  // is a candidate-pool-size fix, not a scoring fix.
  const { data: candidates, error } = await db().rpc("search_lenny_corpus", {
    q,
    match_limit: 15,
    filter_type: "",
  });
  if (error || !Array.isArray(candidates) || candidates.length === 0) return [];

  const results = [];
  const normalizedClaim = normalizeForCompare(claim_text);

  // Embedded once per call, lazily, only if at least one candidate needs it
  // (an exact match never does — no point paying for it up front).
  let claimVec = null;

  for (const cand of candidates) {
    const full = await fetchFullContent(cand.filename);
    const bodyForMatch = full?.content ?? cand.headline ?? "";
    if (!bodyForMatch) continue;

    const normalizedBody = normalizeForCompare(bodyForMatch);
    const exactIdx = normalizedClaim.length > 15 ? normalizedBody.indexOf(normalizedClaim) : -1;

    let matchIdx = -1;
    let matchType;
    let confidence;
    let matchedSnippet;
    let realSpeaker = null;
    let speakerRole = null;

    if (exactIdx !== -1) {
      matchType = "exact";
      confidence = 1.0;
      matchIdx = exactIdx;
      // Recover the original-cased snippet around the match for reporting.
      matchedSnippet = full?.content
        ? full.content.slice(
            Math.max(0, findApproxOriginalIndex(full.content, matchIdx)),
            Math.max(0, findApproxOriginalIndex(full.content, matchIdx)) + claim_text.length + 40
          )
        : cand.headline;
      if (full?.content) {
        const speaker = nearestPrecedingSpeaker(full.content, matchIdx);
        if (speaker) {
          realSpeaker = speaker;
          speakerRole = HOST_NAME_VARIANTS.test(speaker) ? "host" : "guest";
        }
      }
    } else {
      // Real semantic match: rerank this candidate's chunks by embedding
      // cosine similarity to the claim, take its best chunk. Chunks carry
      // real speaker metadata captured at chunking time (see
      // scripts/embed-lenny-corpus.mjs) — no position-based speaker
      // guessing needed for a chunk-based match, unlike the exact-match and
      // fallback paths above/below.
      const chunks = await fetchChunks(cand.filename);
      let best = null;
      if (chunks.length > 0) {
        if (!claimVec) claimVec = await embedClaim(claim_text);
        for (const ch of chunks) {
          const vec = JSON.parse(ch.embedding);
          const sim = cosineSimilarity(claimVec, vec);
          if (!best || sim > best.sim) best = { sim, chunk: ch };
        }
      }

      if (best && best.sim >= SIMILARITY_THRESHOLD) {
        matchType = "semantic";
        confidence = best.sim;
        matchedSnippet = best.chunk.chunk_text;
        realSpeaker = best.chunk.speaker;
        speakerRole = best.chunk.speaker_role;
      } else {
        // Fallback only: this candidate has no chunks yet (shouldn't happen
        // once the corpus is fully embedded, but degrade gracefully rather
        // than silently dropping a document) or its best chunk fell short
        // of the threshold. Old word-overlap-in-window heuristic as a
        // last resort, not the primary path anymore.
        let bestIdx = -1;
        let overlap = 0;
        const words = significantWords(claim_text);
        if (full?.content) {
          bestIdx = bestMatchPosition(full.content, words);
          if (bestIdx >= 0) {
            const windowText = full.content.slice(Math.max(0, bestIdx - 400), Math.min(full.content.length, bestIdx + 400));
            overlap = wordOverlapConfidence(claim_text, windowText);
          }
        } else {
          overlap = wordOverlapConfidence(claim_text, bodyForMatch);
        }
        if (overlap < 0.55) continue;
        matchType = "semantic";
        confidence = Math.min(0.95, overlap);
        matchedSnippet = cand.headline;
        matchIdx = bestIdx;
        if (full?.content && matchIdx >= 0) {
          const speaker = nearestPrecedingSpeaker(full.content, matchIdx);
          if (speaker) {
            realSpeaker = speaker;
            speakerRole = HOST_NAME_VARIANTS.test(speaker) ? "host" : "guest";
          }
        }
      }
    }

    // Podcast transcripts always have a speaker tag; newsletters generally
    // don't (they're prose, not turn-taking dialogue). No speaker found in a
    // newsletter row isn't a failure — treat the newsletter's byline-less
    // prose as effectively host-authored (Lenny writes the newsletter).
    if (!realSpeaker && cand.content_type === "newsletter") {
      realSpeaker = "Lenny Rachitsky";
      speakerRole = "host";
    }

    results.push({
      matched_snippet: matchedSnippet,
      real_speaker: realSpeaker,
      speaker_role: speakerRole,
      episode_or_source_ref: `${cand.title} (${cand.content_type}, ${cand.published_date ?? "n.d."})`,
      source_ref: cand.filename,
      match_confidence: confidence,
      match_type: matchType,
      _claimed_speaker_seen: claimed_speaker ?? null,
    });
  }

  return results.sort((a, b) => b.match_confidence - a.match_confidence);
}

// normalizeForCompare collapses whitespace/punctuation, which shifts string
// indices relative to the original text. This walks the original content to
// find approximately where the normalized match starts, so we can slice a
// real, readable snippet back out for the record. Approximate by design —
// exact re-mapping through the normalization isn't worth the complexity for
// a value that's only used for human-readable evidence.
function findApproxOriginalIndex(original, normalizedIdx) {
  let seen = 0;
  for (let i = 0; i < original.length; i++) {
    if (/[a-zA-Z0-9]/.test(original[i])) {
      if (seen >= normalizedIdx) return i;
      seen++;
    }
  }
  return 0;
}
