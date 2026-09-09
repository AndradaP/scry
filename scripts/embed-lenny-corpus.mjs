#!/usr/bin/env node
/**
 * Chunk + embed the lenny_corpus table into lenny_corpus_chunks, powering
 * real semantic search over the archive (see
 * supabase/migrations/20260907120000_create_lenny_corpus_chunks.sql).
 *
 * Built 2026-09-07 after archive-lookup.mjs's plain word-overlap matching
 * was proven — not assumed — to have a real ceiling: a genuinely correct
 * match scored 0.43, a wrong one scored 0.538, no threshold could separate
 * them. See docs/scry-eval-status.md and docs/LEARNING.md entry 12.
 *
 * Chunking strategy differs by content type:
 *   - Newsletters: split by paragraph into ~1500-char chunks. Every
 *     newsletter in this corpus is Lenny-authored (confirmed directly
 *     against the data, 2026-09-06/07 — no separate `author` column
 *     exists at all), so speaker is always "Lenny Rachitsky" / host.
 *   - Podcasts: SPEAKER-TURN-AWARE chunking. Parse the transcript's speaker
 *     tags ("**Name** (HH:MM:SS):"), merge consecutive same-speaker
 *     segments into one running turn, then split only within a single
 *     speaker's turn if it's long — chunks NEVER mix speakers. Speaker is
 *     stored as real metadata captured AT CHUNKING TIME, not inferred
 *     after the fact the way the old word-overlap matcher had to — this is
 *     what structurally removes the misattribution bug class (see entry
 *     12's diagram), not just patches it again.
 *
 * Usage: node scripts/embed-lenny-corpus.mjs [--dry-run]
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = process.argv.includes("--dry-run");

const EMBED_MODEL = "gemini-embedding-2"; // confirmed live 2026-09-07, 3072-dim
const EMBED_DIM = 3072;
const CHUNK_TARGET_CHARS = 1500;
const HOST_NAME_VARIANTS = /^lenny(\s+rachitsky)?$/i;
const SPEAKER_TAG = /\*\*([^*]{2,60})\*\*\s*\(\d{2}:\d{2}:\d{2}\):\s*/g;
// Fallback for transcripts with no timestamps at all, e.g. "**Adriel
// Frederick**:\n" — confirmed for real, 2026-09-09: one file in the corpus
// (03-podcasts/adriel-frederick.md, 155 turns) uses only this format and was
// silently producing zero chunks under SPEAKER_TAG alone. Requires the colon
// immediately after the closing "**" (no space before it), which a
// timestamped tag never has — mutually exclusive with SPEAKER_TAG by
// construction, so trying this second only when the first finds nothing is
// safe and won't double-match a timestamped transcript.
const SPEAKER_TAG_NO_TIMESTAMP = /\*\*([^*]{2,60})\*\*:\s*\n/g;

// ---- chunking ----

function chunkNewsletter(content) {
  const paragraphs = content.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let current = "";
  for (const p of paragraphs) {
    if (current && (current.length + p.length) > CHUNK_TARGET_CHARS) {
      chunks.push(current.trim());
      current = "";
    }
    current += (current ? "\n\n" : "") + p;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.map((text) => ({ text, speaker: "Lenny Rachitsky", speaker_role: "host" }));
}

function chunkPodcast(content) {
  // Parse into ordered {speaker, text} turns, merging consecutive
  // same-speaker timestamped segments (a speaker often has several
  // consecutive timestamped lines that are really one continuous turn).
  let matches = [...content.matchAll(SPEAKER_TAG)];
  if (matches.length === 0) matches = [...content.matchAll(SPEAKER_TAG_NO_TIMESTAMP)];
  if (matches.length === 0) return [];

  const rawTurns = [];
  for (let i = 0; i < matches.length; i++) {
    const speaker = matches[i][1].trim();
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : content.length;
    const text = content.slice(start, end).trim();
    if (text) rawTurns.push({ speaker, text });
  }

  const merged = [];
  for (const turn of rawTurns) {
    const last = merged[merged.length - 1];
    if (last && last.speaker === turn.speaker) {
      last.text += "\n\n" + turn.text;
    } else {
      merged.push({ ...turn });
    }
  }

  // Real interviews alternate speakers on nearly every turn (confirmed:
  // 207 tag occurrences in one transcript alone), so same-speaker merging
  // above barely helps — most turns stay as tiny standalone chunks. A short
  // host question ("what's the biggest lesson from your time at Stripe?")
  // would become its own near-empty chunk, stripping the guest's answer of
  // the question it's actually answering. Fold a short host interjection
  // into the immediately-following turn as context — attribution stays
  // with the substantive speaker (the one being quoted), it's just given
  // the question it's responding to, not diluted across two people.
  const SHORT_INTERJECTION_CHARS = 200;
  const mergedTurns = [];
  for (let i = 0; i < merged.length; i++) {
    const turn = merged[i];
    const next = merged[i + 1];
    const isShortHostQuestion = HOST_NAME_VARIANTS.test(turn.speaker) && turn.text.length <= SHORT_INTERJECTION_CHARS && next;
    if (isShortHostQuestion) {
      mergedTurns.push({ speaker: next.speaker, text: `[${turn.speaker}]: ${turn.text}\n\n[${next.speaker}]: ${next.text}` });
      i++; // the next turn's content is now folded in, don't push it again
    } else {
      mergedTurns.push(turn);
    }
  }

  // Split any single-speaker turn that's still too long into sequential
  // chunks — never merges across a speaker boundary, so speaker metadata
  // stays unambiguous no matter how chunks get sized.
  const chunks = [];
  for (const turn of mergedTurns) {
    const speaker_role = HOST_NAME_VARIANTS.test(turn.speaker) ? "host" : "guest";
    if (turn.text.length <= CHUNK_TARGET_CHARS) {
      chunks.push({ text: turn.text, speaker: turn.speaker, speaker_role });
      continue;
    }
    const paragraphs = turn.text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    let current = "";
    for (const p of paragraphs) {
      if (current && (current.length + p.length) > CHUNK_TARGET_CHARS) {
        chunks.push({ text: current.trim(), speaker: turn.speaker, speaker_role });
        current = "";
      }
      current += (current ? "\n\n" : "") + p;
    }
    if (current.trim()) chunks.push({ text: current.trim(), speaker: turn.speaker, speaker_role });
  }
  return chunks;
}

function chunkDocument(row) {
  const raw = row.content_type === "newsletter" ? chunkNewsletter(row.content) : chunkPodcast(row.content);
  return raw.map((c, i) => ({
    source_id: row.id,
    filename: row.filename,
    content_type: row.content_type,
    title: row.title,
    published_date: row.published_date,
    source_url: row.source_url,
    chunk_index: i,
    chunk_text: c.text,
    speaker: c.speaker,
    speaker_role: c.speaker_role,
  }));
}

// ---- embedding ----

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const RATE_LIMIT_BACKOFFS_MS = [10_000, 30_000, 60_000];

async function embedBatch(texts) {
  const requests = texts.map((text) => ({
    model: `models/${EMBED_MODEL}`,
    content: { parts: [{ text: text.slice(0, 8000) }] }, // defensive cap, well under any real limit
  }));
  let lastError;
  for (let attempt = 0; attempt <= RATE_LIMIT_BACKOFFS_MS.length; attempt++) {
    let res;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requests }),
        }
      );
    } catch (err) {
      // A dead/stale HTTP/2 connection can make fetch() itself reject
      // (undici UND_ERR_INFO "stream timeout") rather than resolve with a
      // non-ok response — confirmed for real, 2026-09-09, killing a run
      // mid-batch on both this call and the Supabase insert (see
      // insertBatch). Same retry schedule as a 429/503; this isn't a
      // rate-limit specifically, just any transient network failure.
      if (attempt < RATE_LIMIT_BACKOFFS_MS.length) {
        const wait = RATE_LIMIT_BACKOFFS_MS[attempt];
        console.warn(`  [network error: ${err.message}] waiting ${wait / 1000}s before retry ${attempt + 1}/${RATE_LIMIT_BACKOFFS_MS.length}`);
        lastError = err;
        await sleep(wait);
        continue;
      }
      throw err;
    }
    if (res.ok) {
      const data = await res.json();
      const vectors = (data.embeddings ?? []).map((e) => e.values);
      if (vectors.length !== texts.length) throw new Error(`Expected ${texts.length} embeddings, got ${vectors.length}`);
      for (const v of vectors) {
        if (!Array.isArray(v) || v.length !== EMBED_DIM) throw new Error(`Unexpected embedding shape: length ${v?.length}`);
      }
      return vectors;
    }
    const bodyText = await res.text();
    // Confirmed live 2026-09-07: batchEmbedContents rate-limits under
    // sustained load. Worth waiting out, same as gemini.mjs's judge-call
    // backoff — not a per-request problem.
    if ((res.status === 429 || res.status === 503) && attempt < RATE_LIMIT_BACKOFFS_MS.length) {
      const wait = RATE_LIMIT_BACKOFFS_MS[attempt];
      console.warn(`  [rate-limited ${res.status}] waiting ${wait / 1000}s before retry ${attempt + 1}/${RATE_LIMIT_BACKOFFS_MS.length}`);
      lastError = new Error(`batchEmbedContents failed (${res.status}): ${bodyText.slice(0, 300)}`);
      await sleep(wait);
      continue;
    }
    throw new Error(`batchEmbedContents failed (${res.status}): ${bodyText.slice(0, 500)}`);
  }
  throw lastError;
}

const INSERT_RETRY_BACKOFFS_MS = [3_000, 10_000, 20_000];

// Retries transient network failures on the insert itself — confirmed happening
// for real, twice, 2026-09-09: a long-lived Node process's HTTP/2 connection to
// Supabase went stale mid-run and failed with "stream timeout after 300000"
// (undici UND_ERR_INFO), unrelated to Gemini rate limits and not covered by
// embedBatch's own retry logic. Previously this had no retry at all — any
// insert error immediately threw and killed the whole run. A fresh
// createClient() per retry, not just a retried call on the same client,
// since a stale HTTP/2 connection is exactly what's suspected to be at fault.
async function insertBatch(toInsert) {
  let lastError;
  for (let attempt = 0; attempt <= INSERT_RETRY_BACKOFFS_MS.length; attempt++) {
    const client = attempt === 0 ? supabase : createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    // A dead HTTP/2 connection (the exact failure this exists for) can make
    // the underlying fetch() reject outright rather than resolve with
    // {error} — confirmed for real, 2026-09-09, surviving a lid-close/sleep
    // right through the first version of this retry wrapper because it only
    // handled the resolved-with-error shape. try/catch covers both.
    try {
      const { error } = await client.from("lenny_corpus_chunks").insert(toInsert);
      if (!error) return;
      lastError = error;
    } catch (err) {
      lastError = err;
    }
    if (attempt < INSERT_RETRY_BACKOFFS_MS.length) {
      const wait = INSERT_RETRY_BACKOFFS_MS[attempt];
      console.warn(`  [insert failed: ${lastError.message}] waiting ${wait / 1000}s before retry ${attempt + 1}/${INSERT_RETRY_BACKOFFS_MS.length}`);
      await sleep(wait);
    }
  }
  throw lastError;
}

// ---- main ----

async function main() {
  // Explicit column list, not select("*") — that pulled the fts tsvector
  // column across all 683 rows unnecessarily and took ~18s, right at the
  // edge of PostgREST's statement timeout (confirmed failing once,
  // 2026-09-07). Only these columns are actually used below.
  const { data: rows, error } = await supabase
    .from("lenny_corpus")
    .select("id, filename, content_type, title, published_date, source_url, content")
    .order("filename");
  if (error) throw error;
  console.log(`${rows.length} source rows in lenny_corpus.`);

  let allChunks = [];
  for (const row of rows) {
    allChunks.push(...chunkDocument(row));
  }
  console.log(`${allChunks.length} chunks produced (avg ${(allChunks.length / rows.length).toFixed(1)} per document).`);

  const podcastChunks = allChunks.filter((c) => c.content_type === "podcast");
  const withSpeaker = podcastChunks.filter((c) => c.speaker).length;
  console.log(`Podcast chunks: ${podcastChunks.length}, all with real speaker metadata: ${withSpeaker === podcastChunks.length}`);

  if (DRY_RUN) {
    console.log("\n--dry-run: not embedding or writing. Sample chunks:");
    for (const c of allChunks.slice(0, 3)) {
      console.log(`\n[${c.content_type}] ${c.filename} #${c.chunk_index} speaker=${c.speaker}/${c.speaker_role}`);
      console.log(c.chunk_text.slice(0, 200));
    }
    return;
  }

  // Idempotent resume: skip chunks already embedded from a prior (possibly
  // interrupted) run, keyed on (source_id, chunk_index) — cheap enough to
  // fetch the whole existing set once rather than check row by row.
  //
  // Must page through with .range(): PostgREST silently caps an unpaginated
  // select() at its default response limit (1000 rows). A run against an
  // already-partially-populated table (well past 1000 existing rows) would
  // otherwise see only the first 1000, treat everything else as "not yet
  // embedded," and re-embed + re-insert it as duplicate rows (no unique
  // constraint on (source_id, chunk_index) catches this at the DB level).
  // Confirmed happening for real on 2026-09-08: a resume run against 27,350
  // existing rows saw only 1000 of them and inserted ~20k duplicates before
  // hitting a billing-exhausted 429.
  const existingRows = [];
  {
    const PAGE = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("lenny_corpus_chunks")
        .select("source_id, chunk_index")
        .range(from, from + PAGE - 1);
      if (error) throw error;
      existingRows.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
  }
  const existing = new Set(existingRows.map((r) => `${r.source_id}::${r.chunk_index}`));
  const remaining = allChunks.filter((c) => !existing.has(`${c.source_id}::${c.chunk_index}`));
  console.log(`${existing.size} chunks already embedded, ${remaining.length} remaining.`);

  // Cost tracing: not Gemini's published per-token rate (not confirmed), but
  // an empirical anchor from the first real run's billing (see this
  // script's git history, 2026-09-07: ~500 chunks cost ~$0.03 for real).
  // Approximate, per-chunk rather than per-token, but enough to give a
  // running total instead of finding out the bill after the fact.
  const EST_COST_PER_CHUNK = 0.03 / 500;
  let estSpend = 0;

  const BATCH = 50; // Gemini batchEmbedContents supports up to 100; staying conservative
  let embedded = 0;
  for (let i = 0; i < remaining.length; i += BATCH) {
    const batch = remaining.slice(i, i + BATCH);
    const vectors = await embedBatch(batch.map((c) => c.chunk_text));
    const toInsert = batch.map((c, j) => ({ ...c, embedding: JSON.stringify(vectors[j]) }));
    await insertBatch(toInsert);
    embedded += batch.length;
    estSpend += batch.length * EST_COST_PER_CHUNK;
    console.log(`  embedded ${embedded}/${remaining.length} (${existing.size + embedded}/${allChunks.length} total) — est. spend so far: $${estSpend.toFixed(2)}`);
  }

  console.log(`\nDone. Estimated total spend this run: $${estSpend.toFixed(2)} (approximate — see EST_COST_PER_CHUNK note above).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
