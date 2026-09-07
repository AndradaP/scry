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
  const matches = [...content.matchAll(SPEAKER_TAG)];
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
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requests }),
      }
    );
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

// ---- main ----

async function main() {
  const { data: rows, error } = await supabase.from("lenny_corpus").select("*").order("filename");
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
  const { data: existingRows, error: existingErr } = await supabase.from("lenny_corpus_chunks").select("source_id, chunk_index");
  if (existingErr) throw existingErr;
  const existing = new Set(existingRows.map((r) => `${r.source_id}::${r.chunk_index}`));
  const remaining = allChunks.filter((c) => !existing.has(`${c.source_id}::${c.chunk_index}`));
  console.log(`${existing.size} chunks already embedded, ${remaining.length} remaining.`);

  const BATCH = 50; // Gemini batchEmbedContents supports up to 100; staying conservative
  let embedded = 0;
  for (let i = 0; i < remaining.length; i += BATCH) {
    const batch = remaining.slice(i, i + BATCH);
    const vectors = await embedBatch(batch.map((c) => c.chunk_text));
    const toInsert = batch.map((c, j) => ({ ...c, embedding: JSON.stringify(vectors[j]) }));
    const { error: insErr } = await supabase.from("lenny_corpus_chunks").insert(toInsert);
    if (insErr) throw insErr;
    embedded += batch.length;
    console.log(`  embedded ${embedded}/${remaining.length} (${existing.size + embedded}/${allChunks.length} total)`);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
