-- Eval-only instrumentation: per-run corpus retrieval sizes and archive-citation
-- write/survive counts from generate-teardown, so future eval runs answer "did the
-- archive return anything" / "did the scrubber delete valid citations" without
-- needing edge function logs or dashboard access.
ALTER TABLE eval_runs ADD COLUMN debug_metadata jsonb;
