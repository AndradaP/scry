// Section 6 of citation-verification.md, implemented — the archive lookup
// interface the extraction/classification stages plug into.
//
// Honest limitation, stated up front: this is lexical matching layered with
// a word-overlap heuristic, not real semantic/embedding similarity. That's
// consistent with the rest of the codebase — generate-teardown's own
// retrieval (search_lenny_corpus) is Postgres full-text search, and no
// embeddings/pgvector code exists anywhere in this repo (confirmed
// 2026-08-29). This lookup does not pretend otherwise; `match_type:
// "semantic"` below means "word-overlap above a threshold," not "compared
// via embeddings."

import { createClient } from "@supabase/supabase-js";

let _client;
function db() {
  if (!_client) {
    _client = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return _client;
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

  const { data: candidates, error } = await db().rpc("search_lenny_corpus", {
    q,
    match_limit: 5,
    filter_type: "",
  });
  if (error || !Array.isArray(candidates) || candidates.length === 0) return [];

  const results = [];
  const normalizedClaim = normalizeForCompare(claim_text);

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
    } else {
      const overlap = wordOverlapConfidence(claim_text, bodyForMatch);
      // Raised from an initial 0.34 after a manual spot-check of the first
      // verification run: at 0.34, plain word-overlap (no real embeddings —
      // the same limitation flagged throughout this session) was confidently
      // matching claims to plausible-sounding but wrong episodes, inflating
      // the misattributed count with false positives rather than reflecting
      // real Scry defects. 0.55 is still a heuristic, not true semantic
      // matching, but it's conservative enough that a "found" result means
      // something — a weak/ambiguous match now falls through to fabricated
      // (no confident content match) instead of a confident wrong verdict.
      if (overlap < 0.55) continue;
      matchType = "semantic";
      confidence = Math.min(0.95, overlap);
      matchedSnippet = cand.headline; // best available excerpt when not exact
      // Position for speaker lookup, fixed 2026-09-06: this used to take the
      // first occurrence of the first significant claim word anywhere in the
      // whole transcript — in a multi-speaker document that's essentially
      // arbitrary (common words recur throughout, early occurrences skew
      // toward the host's intro). Confirmed concretely: a Katie Dill quote,
      // verified verbatim in the transcript, got resolved to "Lenny" because
      // an earlier unrelated occurrence of one claim word sat near the
      // transcript's start. Now: find the position whose surrounding window
      // contains the most of the claim's OTHER significant words too — the
      // real matching passage should have several cluster together, not
      // just one coincidental hit — and use that instead.
      if (full?.content) {
        matchIdx = bestMatchPosition(full.content, significantWords(claim_text));
      }
    }

    let realSpeaker = null;
    let speakerRole = null;
    if (full?.content && matchIdx >= 0) {
      const speaker = nearestPrecedingSpeaker(full.content, matchIdx);
      if (speaker) {
        realSpeaker = speaker;
        speakerRole = HOST_NAME_VARIANTS.test(speaker) ? "host" : "guest";
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
