-- Published post analytics and lifecycle tracking.
-- Stores metadata only. Do not store image/video binaries or base64 media in Postgres.
-- Apply with: psql "$DATABASE_URL" -f scripts/migrations/002_published_posts.sql
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS published_posts (
  id BIGSERIAL PRIMARY KEY,
  batch_id TEXT NOT NULL UNIQUE,
  account_id TEXT,
  status TEXT NOT NULL,
  article_id TEXT,
  article_title TEXT,
  article_url TEXT,
  article_source TEXT,
  article_published_at TIMESTAMPTZ,
  selected_score NUMERIC,
  selection_reasons JSONB,
  source_strategy TEXT,
  selection_strategy TEXT,
  content_intent TEXT,
  render_format TEXT,
  generated_manifest JSONB,
  caption TEXT,
  hashtags TEXT,
  template_sequence JSONB,
  media_metadata JSONB,
  render_urls JSONB,
  instagram_permalink TEXT,
  publish_confirmed BOOLEAN,
  publish_verification_method TEXT,
  publish_duration_ms INTEGER,
  publish_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS post_events (
  id BIGSERIAL PRIMARY KEY,
  batch_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_quality_scores (
  id BIGSERIAL PRIMARY KEY,
  batch_id TEXT NOT NULL UNIQUE,
  score NUMERIC,
  metrics JSONB NOT NULL,
  reasons JSONB,
  fingerprints JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_engagement_snapshots (
  id BIGSERIAL PRIMARY KEY,
  batch_id TEXT NOT NULL,
  instagram_permalink TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metrics JSONB NOT NULL,
  raw_payload JSONB
);

CREATE INDEX IF NOT EXISTS idx_published_posts_status ON published_posts (status);
CREATE INDEX IF NOT EXISTS idx_published_posts_published_at_desc ON published_posts (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_published_posts_article_url ON published_posts (article_url);
CREATE INDEX IF NOT EXISTS idx_published_posts_permalink ON published_posts (instagram_permalink) WHERE instagram_permalink IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_post_events_batch_created ON post_events (batch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_post_quality_scores_batch ON post_quality_scores (batch_id);
CREATE INDEX IF NOT EXISTS idx_post_engagement_batch_captured ON post_engagement_snapshots (batch_id, captured_at DESC);
