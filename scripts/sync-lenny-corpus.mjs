#!/usr/bin/env node
/**
 * Sync the Lenny's Data archive export into the `lenny_corpus` table.
 *
 * The archive is a ZIP export from https://www.lennysdata.com/access/mcp
 * ("Full newsletter and podcast markdown files ZIP"). Extract it, then point
 * this script at the folder (or hand it the .zip directly).
 *
 *   npm run sync:corpus -- --dir ~/Downloads/lennys-newsletterpodcastdata-all
 *   npm run sync:corpus -- --zip ~/Downloads/lennys-archive.zip
 *   npm run sync:corpus -- --dir <path> --dry-run     # diff only, no writes
 *   npm run sync:corpus -- --dir <path> --prune       # also delete rows no longer in the archive
 *
 * Reads SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY from
 * .env.local. Service-role only — never bundled or shipped. Runbook:
 * scripts/sync-lenny-corpus.md
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: ".env.local" });

const args = process.argv.slice(2);
const getFlag = (name) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null;
};
const hasFlag = (name) => args.includes(name);

const dirArg = getFlag("--dir");
const zipArg = getFlag("--zip");
const dryRun = hasFlag("--dry-run");
const prune = hasFlag("--prune");

if (!dirArg && !zipArg) {
  console.error("Usage: npm run sync:corpus -- --dir <archive-folder> | --zip <archive.zip> [--dry-run] [--prune]");
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const BATCH = 50;
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

/** Resolve the archive root, extracting the ZIP to a temp dir if needed. */
function resolveArchiveRoot() {
  if (dirArg) {
    const root = resolve(dirArg.replace(/^~/, process.env.HOME));
    if (!existsSync(join(root, "01-start-here", "index.json"))) {
      console.error(`No 01-start-here/index.json under ${root} — is this the extracted archive root?`);
      process.exit(1);
    }
    return { root, cleanup: () => {} };
  }
  const zipPath = resolve(zipArg.replace(/^~/, process.env.HOME));
  if (!existsSync(zipPath)) {
    console.error(`ZIP not found: ${zipPath}`);
    process.exit(1);
  }
  const tmp = mkdtempSync(join(tmpdir(), "lenny-archive-"));
  console.log(`Extracting ${zipPath} → ${tmp}`);
  execFileSync("unzip", ["-q", zipPath, "-d", tmp]);
  // The ZIP may contain a single top-level folder; find the one holding 01-start-here.
  let root = tmp;
  if (!existsSync(join(root, "01-start-here", "index.json"))) {
    const entries = readdirSync(tmp, { withFileTypes: true });
    const nested = entries.find(
      (e) => e.isDirectory() && existsSync(join(tmp, e.name, "01-start-here", "index.json")),
    );
    if (nested) root = join(tmp, nested.name);
  }
  return { root, cleanup: () => rmSync(tmp, { recursive: true, force: true }) };
}

/** Strip YAML frontmatter, return the trimmed markdown body. */
function stripFrontmatter(raw) {
  return raw.replace(FRONTMATTER, "").trim();
}

function buildRows(root) {
  const index = JSON.parse(readFileSync(join(root, "01-start-here", "index.json"), "utf8"));
  const groups = [
    ["newsletter", index.newsletters ?? []],
    ["podcast", index.podcasts ?? []],
  ];

  const rows = [];
  const skipped = [];
  for (const [contentType, entries] of groups) {
    for (const e of entries) {
      const filePath = join(root, e.filename);
      if (!existsSync(filePath)) {
        skipped.push(`${e.filename} (file missing on disk)`);
        continue;
      }
      const raw = readFileSync(filePath, "utf8");
      const content = stripFrontmatter(raw);
      if (!content) {
        skipped.push(`${e.filename} (empty after frontmatter strip)`);
        continue;
      }
      rows.push({
        filename: e.filename,
        content_type: contentType,
        title: e.title ?? e.filename,
        published_date: e.date || null,
        tags: Array.isArray(e.tags) ? e.tags : [],
        source_url: e.post_url || e.youtube_url || null,
        word_count: Number.isFinite(e.word_count) ? e.word_count : null,
        content,
        content_hash: createHash("sha256").update(raw).digest("hex"),
      });
    }
  }
  return { rows, skipped };
}

async function main() {
  const { root, cleanup } = resolveArchiveRoot();
  try {
    const { rows, skipped } = buildRows(root);
    console.log(`Archive: ${rows.length} files (${rows.filter((r) => r.content_type === "newsletter").length} newsletters, ${rows.filter((r) => r.content_type === "podcast").length} podcasts)`);
    if (skipped.length) console.log(`Skipped ${skipped.length}:\n  ${skipped.join("\n  ")}`);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const existing = new Map();
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("lenny_corpus")
        .select("filename, content_hash")
        .range(from, from + 999);
      if (error) throw error;
      data.forEach((r) => existing.set(r.filename, r.content_hash));
      if (data.length < 1000) break;
    }

    const toUpsert = rows.filter((r) => existing.get(r.filename) !== r.content_hash);
    const isNew = (r) => !existing.has(r.filename);
    const archiveFilenames = new Set(rows.map((r) => r.filename));
    const orphans = [...existing.keys()].filter((f) => !archiveFilenames.has(f));

    const newCount = toUpsert.filter(isNew).length;
    const changedCount = toUpsert.length - newCount;
    console.log(
      `\n  New:       ${newCount}` +
      `\n  Updated:   ${changedCount}` +
      `\n  Unchanged: ${rows.length - toUpsert.length}` +
      `\n  Orphaned:  ${orphans.length}${orphans.length ? ` (${prune ? "will delete" : "run with --prune to delete"})` : ""}`,
    );
    if (toUpsert.length) {
      console.log("\nChanged files:\n  " + toUpsert.slice(0, 25).map((r) => (isNew(r) ? "+ " : "~ ") + r.filename).join("\n  "));
      if (toUpsert.length > 25) console.log(`  … and ${toUpsert.length - 25} more`);
    }
    if (orphans.length) console.log("\nOrphans:\n  " + orphans.map((f) => "- " + f).join("\n  "));

    if (dryRun) {
      console.log("\n--dry-run: no writes.");
      return;
    }

    const stamped = toUpsert.map((r) => ({ ...r, synced_at: new Date().toISOString() }));
    for (let i = 0; i < stamped.length; i += BATCH) {
      const batch = stamped.slice(i, i + BATCH);
      const { error } = await supabase.from("lenny_corpus").upsert(batch, { onConflict: "filename" });
      if (error) throw error;
      console.log(`  upserted ${Math.min(i + BATCH, stamped.length)}/${stamped.length}`);
    }

    if (prune && orphans.length) {
      const { error } = await supabase.from("lenny_corpus").delete().in("filename", orphans);
      if (error) throw error;
      console.log(`  pruned ${orphans.length} orphan(s)`);
    }

    console.log("\nDone.");
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
