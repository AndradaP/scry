-- Track daily teardown usage per user
CREATE TABLE IF NOT EXISTS usage_limits (
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  teardown_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

-- Atomic increment for daily teardown count
CREATE OR REPLACE FUNCTION increment_usage(p_user_id TEXT, p_date DATE)
RETURNS void AS $$
BEGIN
  INSERT INTO usage_limits (user_id, date, teardown_count)
  VALUES (p_user_id, p_date, 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET teardown_count = usage_limits.teardown_count + 1;
END;
$$ LANGUAGE plpgsql;

-- Track chat message count per teardown
ALTER TABLE teardowns ADD COLUMN IF NOT EXISTS chat_message_count INTEGER NOT NULL DEFAULT 0;

-- Atomic increment for chat message count
CREATE OR REPLACE FUNCTION increment_chat_count(p_teardown_id TEXT)
RETURNS void AS $$
BEGIN
  UPDATE teardowns SET chat_message_count = chat_message_count + 1
  WHERE id = p_teardown_id;
END;
$$ LANGUAGE plpgsql;
