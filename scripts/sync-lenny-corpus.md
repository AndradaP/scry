# Lenny corpus sync — quarterly runbook

Scry generates teardowns grounded in Lenny Rachitsky's archive. That archive used
to be queried live over the LennyData MCP (`https://mcp.lennysdata.com/mcp`), which
needed a bearer token that expired every ~30 days — when it lapsed, `searchLennyData`
silently returned nothing and teardowns generated ungrounded.

Now the archive lives in Postgres (`public.lenny_corpus`) and is searched with
full-text search (`search_lenny_corpus()` RPC). No token, no live dependency. The
only maintenance is refreshing the copy every few months.

## Refresh (do this ~quarterly)

1. Go to <https://www.lennysdata.com/access/mcp> (sign in — this is what proves the
   subscription is active) and download **"Full newsletter and podcast markdown
   files ZIP"**.
2. Unzip it. You get a folder like `lennys-newsletterpodcastdata-all/` containing
   `01-start-here/`, `02-newsletters/`, `03-podcasts/`.
3. Dry run to see what changed:
   ```bash
   npm run sync:corpus -- --dir ~/Downloads/lennys-newsletterpodcastdata-all --dry-run
   ```
4. If it looks right, run it for real:
   ```bash
   npm run sync:corpus -- --dir ~/Downloads/lennys-newsletterpodcastdata-all
   ```
   Add `--prune` to also delete rows for files that no longer exist in the archive.

You can also point `--zip` straight at the `.zip` and let the script extract it.

## What the script does

- Reads `01-start-here/index.json` (the archive's own manifest: title, date, tags,
  word_count, source url, per file).
- For each file: strips YAML frontmatter, keeps the markdown body, hashes the raw
  file (sha256).
- Compares hashes against `lenny_corpus.content_hash` and upserts only new/changed
  rows. Unchanged files are skipped. Idempotent — safe to re-run.

Needs `SUPABASE_URL` (or `VITE_SUPABASE_URL`) and `SUPABASE_SERVICE_ROLE_KEY` in
`.env.local`. It writes with the service role, so it's local-only — never bundled
or deployed.

## Notes

- Newsletters land in the archive on a ~3-month delay (upstream policy). The most
  recent ~quarter of newsletters simply won't be present; nothing to fix here.
- Retrieval is lexical, matching the character of the old MCP's `search_content`.
  A semantic `embedding vector` column can be added to `lenny_corpus` later without
  touching the schema or the sync script.
- If teardowns ever come back with an empty "Lenny's Archive" section, check
  `select count(*) from lenny_corpus;` and the `_eval_debug.corpus_retrieval`
  block on a `debug: true` teardown call (dev user only).
