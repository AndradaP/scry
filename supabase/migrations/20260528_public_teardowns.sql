-- Allow teardowns to be shared publicly via a link
ALTER TABLE teardowns ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- Allow anyone to read a teardown that has been marked public
CREATE POLICY "Public teardowns are viewable by anyone"
ON teardowns
FOR SELECT
USING (is_public = true);
