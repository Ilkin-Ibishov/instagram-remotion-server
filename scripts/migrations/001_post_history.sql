-- Post history for duplicate detection (URL + title fingerprint).
-- Apply with: psql "$DATABASE_URL" -f scripts/migrations/001_post_history.sql
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS post_history (
  id BIGSERIAL PRIMARY KEY,
  article_title TEXT NOT NULL,
  article_url TEXT NOT NULL,
  title_fingerprint TEXT,
  posted_at TIMESTAMPTZ NOT NULL,
  batch_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE post_history ADD COLUMN IF NOT EXISTS normalized_url TEXT;
ALTER TABLE post_history ADD COLUMN IF NOT EXISTS status TEXT;

UPDATE post_history SET normalized_url = article_url WHERE normalized_url IS NULL;
UPDATE post_history SET status = 'posted' WHERE status IS NULL;

ALTER TABLE post_history ALTER COLUMN normalized_url SET NOT NULL;
ALTER TABLE post_history ALTER COLUMN status SET NOT NULL;
ALTER TABLE post_history ALTER COLUMN status SET DEFAULT 'posted';

CREATE INDEX IF NOT EXISTS idx_post_history_posted_at_desc ON post_history (posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_history_article_url ON post_history (article_url);
CREATE UNIQUE INDEX IF NOT EXISTS uq_post_history_normalized_url ON post_history (normalized_url);
