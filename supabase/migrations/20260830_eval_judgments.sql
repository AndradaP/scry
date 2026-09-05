-- Promoted from pending_eval_judgments.sql on 2026-08-30, with the
-- eval_run_id_a/eval_run_id_b FK fix applied (see docs/scry-eval-status.md)
-- and eval_citations extended with the fields citation-verification.md's
-- extraction/classification/outlet-legitimacy/vendor-source checks need.

-- Relates to eval_runs (see 20260726_eval_runs.sql): each eval_runs row is
-- one generation run (product, arm, prompt, raw_output, model,
-- coverage_tier). The tables below record judgments comparing two arms and
-- citation-verification results for a given run.

CREATE TABLE eval_judgments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product text NOT NULL,
  -- Which two eval_runs rows were actually compared, not just which arm
  -- labels. Without these, re-running a product creates ambiguous judgment
  -- records with no way to tell which generation was scored — arm_a/arm_b
  -- below are kept as a denormalized convenience for readable queries, but
  -- these FKs are the source of truth.
  eval_run_id_a uuid NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
  eval_run_id_b uuid NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
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
  arm text NOT NULL,
  section_key text NOT NULL,
  claim_text text NOT NULL,
  claimed_source_type text NOT NULL CHECK (claimed_source_type IN ('archive', 'web', 'unknown')),
  claimed_speaker text,
  claimed_role text,
  attributed_source text NOT NULL,
  verification_status text NOT NULL CHECK (
    verification_status IN (
      'verified-verbatim',
      'verified-paraphrase',
      'misattributed',
      'fabricated'
    )
  ),
  -- Set only when verification_status = 'misattributed' and the claimed
  -- speaker resolved to a host-name variant but the real speaker was a
  -- guest — see citation-verification.md §3. Null for every other case.
  misattribution_subtype text CHECK (misattribution_subtype IS NULL OR misattribution_subtype = 'guest_to_host'),
  -- Web citations only (citation-verification.md §4/§5). Null for archive
  -- and unattributed-training-knowledge citations.
  outlet_legitimacy text CHECK (outlet_legitimacy IS NULL OR outlet_legitimacy IN ('recognized', 'unfamiliar')),
  vendor_sourced boolean,
  evidence text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eval_citations ENABLE ROW LEVEL SECURITY;

-- Not user-facing: no anon/authenticated policies at all (RLS blocks them).
-- service_role bypasses RLS but still needs an explicit GRANT on this
-- project — confirmed by a 42501 permission-denied error without it.
GRANT INSERT, SELECT ON eval_citations TO service_role;
