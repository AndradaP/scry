CREATE TABLE eval_runs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product text NOT NULL,
  arm text NOT NULL,
  prompt text NOT NULL,
  raw_output jsonb,
  model text,
  coverage_tier text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eval_runs ENABLE ROW LEVEL SECURITY;

-- Not user-facing: no anon/authenticated policies at all (RLS blocks them).
-- service_role bypasses RLS but still needs an explicit GRANT on this
-- project — confirmed by a 42501 permission-denied error without it.
GRANT INSERT, SELECT ON eval_runs TO service_role;
