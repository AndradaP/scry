-- 2026-09-05 incident follow-up: grounded_insight_value rows computed under
-- the old uncapped-claims/one-fact-check-per-claim code need to be deleted
-- so run-judgments.mjs's idempotency check re-runs them under the fixed
-- code, instead of skipping them as "already judged" forever. service_role
-- had only INSERT/SELECT on eval_judgments (see 20260830_eval_judgments.sql)
-- — this adds DELETE, needed for exactly this kind of stale-methodology
-- cleanup. Applied directly via the Supabase MCP (2026-09-06); this file
-- mirrors that change into the repo's migration history.
GRANT DELETE ON eval_judgments TO service_role;
