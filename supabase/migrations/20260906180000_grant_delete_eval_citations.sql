-- 2026-09-06: citation-verification bug fixes (archive-lookup speaker
-- resolution, extract-citations decimal regex) mean existing eval_citations
-- rows reflect the old, buggy classification and need to be cleared before
-- re-running verification. service_role had only INSERT/SELECT on
-- eval_citations (see 20260830_eval_judgments.sql) — this adds DELETE.
-- Applied directly via the Supabase MCP; this file mirrors that change.
GRANT DELETE ON eval_citations TO service_role;
