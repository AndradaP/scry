-- STAGED / PENDING MIGRATION — NOT YET APPLIED.
-- This file is for human review only. It deliberately does NOT follow the
-- repo's date-prefixed migration filename convention (e.g. 20260726_*.sql)
-- so it will not be picked up automatically by the Supabase CLI or any
-- migration runner. Once reviewed, rename it to a proper timestamped
-- filename to promote it to a real migration.

-- Relates to eval_runs (see 20260726_eval_runs.sql): each eval_runs row is
-- one generation run (product, arm, prompt, raw_output, model,
-- coverage_tier). The tables below record judgments comparing two arms and
-- citation-verification results for a given run.

CREATE TABLE eval_judgments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product text NOT NULL,
  arm_a text NOT NULL,
  arm_b text NOT NULL,
  dimension text NOT NULL,
  judge_model text NOT NULL,
  position_swapped boolean NOT NULL DEFAULT false,
  winner text NOT NULL CHECK (winner IN ('A', 'B', 'tie')),
  justification text NOT NULL,
  -- Populated only for the insight_novelty dimension: the list of claims the
  -- judge identified as unique to the winning arm. Null for all other
  -- dimensions.
  unique_claims jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eval_judgments ENABLE ROW LEVEL SECURITY;

-- Not user-facing: no anon/authenticated policies at all (RLS blocks them).
-- service_role bypasses RLS but still needs an explicit GRANT on this
-- project — confirmed by a 42501 permission-denied error without it.
GRANT INSERT, SELECT ON eval_judgments TO service_role;

CREATE TABLE eval_citations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  eval_run_id uuid NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
  claim_text text NOT NULL,
  attributed_source text NOT NULL,
  verification_status text NOT NULL CHECK (
    verification_status IN (
      'verified-verbatim',
      'verified-paraphrase',
      'misattributed',
      'fabricated'
    )
  ),
  evidence text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eval_citations ENABLE ROW LEVEL SECURITY;

-- Not user-facing: no anon/authenticated policies at all (RLS blocks them).
-- service_role bypasses RLS but still needs an explicit GRANT on this
-- project — confirmed by a 42501 permission-denied error without it.
GRANT INSERT, SELECT ON eval_citations TO service_role;
