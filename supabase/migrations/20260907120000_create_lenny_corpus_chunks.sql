-- Semantic-search layer for the Lenny archive (2026-09-07). Chunks are the
-- real unit of retrieval, not whole documents — a full podcast transcript
-- covers too many topics for one embedding to represent well. Speaker is
-- stored as real metadata AT CHUNKING TIME (speaker-turn-aware chunking),
-- not inferred after the fact the way archive-lookup.mjs's old position
-- heuristics did — this structurally removes the whole misattribution bug
-- class, not just patches it.
--
-- Applied directly via the Supabase MCP; this file mirrors that change.
CREATE TABLE lenny_corpus_chunks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id uuid NOT NULL REFERENCES lenny_corpus(id) ON DELETE CASCADE,
  filename text NOT NULL,
  content_type text NOT NULL,
  title text,
  published_date date,
  source_url text,
  chunk_index int NOT NULL,
  chunk_text text NOT NULL,
  -- Only populated for podcast chunks built around a coherent speaker turn
  -- (or turn-pair). Null for newsletter chunks and any podcast chunk that
  -- couldn't be cleanly attributed to one speaker.
  speaker text,
  speaker_role text CHECK (speaker_role IS NULL OR speaker_role IN ('host', 'guest')),
  -- gemini-embedding-2, confirmed 3072-dim via a real embedContent call
  -- (2026-09-07) — corpus is small enough (683 source rows) that a brute-
  -- force ORDER BY distance scan is plenty fast; no ANN index needed or
  -- built at this scale.
  embedding vector(3072),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lenny_corpus_chunks ENABLE ROW LEVEL SECURITY;
-- Not user-facing directly (yet — production wiring is a separate, later
-- decision, see docs/scry-eval-status.md). service_role only for now,
-- matching eval_judgments/eval_citations' pattern.
GRANT SELECT, INSERT, DELETE ON lenny_corpus_chunks TO service_role;

CREATE INDEX idx_lenny_corpus_chunks_source ON lenny_corpus_chunks(source_id);

-- Cosine-similarity nearest-neighbor search over chunks. <=> is pgvector's
-- cosine distance operator; similarity = 1 - distance for reporting.
CREATE OR REPLACE FUNCTION search_lenny_corpus_semantic(query_embedding vector(3072), match_limit int DEFAULT 5)
RETURNS TABLE (
  id uuid, filename text, content_type text, title text, published_date date, source_url text,
  chunk_index int, chunk_text text, speaker text, speaker_role text, similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT id, filename, content_type, title, published_date, source_url, chunk_index, chunk_text, speaker, speaker_role,
         1 - (embedding <=> query_embedding) AS similarity
  FROM lenny_corpus_chunks
  WHERE embedding IS NOT NULL
  ORDER BY embedding <=> query_embedding
  LIMIT match_limit;
$$;

GRANT EXECUTE ON FUNCTION search_lenny_corpus_semantic(vector(3072), int) TO service_role;
