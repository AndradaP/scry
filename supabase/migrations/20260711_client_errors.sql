CREATE TABLE client_errors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message text NOT NULL,
  stack text,
  route text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE client_errors ENABLE ROW LEVEL SECURITY;

-- Anyone (authenticated or anonymous) can insert their own errors
CREATE POLICY "Allow error inserts"
ON client_errors
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- No SELECT/UPDATE/DELETE policies — only service_role can read (bypasses RLS)

-- Explicit grants so PostgREST will accept INSERT from both roles
GRANT INSERT ON client_errors TO anon;
GRANT INSERT ON client_errors TO authenticated;
