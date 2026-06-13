CREATE TABLE teardown_feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  teardown_id uuid NOT NULL REFERENCES teardowns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating IN (0, 1, 2)),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teardown_id, user_id)
);

ALTER TABLE teardown_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own feedback"
ON teardown_feedback
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
