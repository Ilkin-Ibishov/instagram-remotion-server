import { Pool, type PoolClient } from 'pg';
import type { GeneratedContent, NewsArticle, PublishablePost } from './types';
import type { InstagramPublishResult } from './types';
import Logger from '../utils/logger';
import {
  buildQualitySnapshot,
  type PostQualitySnapshot,
} from './publishedPostMetrics';

export type PublishedPostStatus =
  | 'selected'
  | 'generated'
  | 'rendered'
  | 'publish_started'
  | 'published'
  | 'failed';

export type PublishedPostStage =
  | 'selection'
  | 'generation'
  | 'render'
  | 'publish'
  | 'unknown';

export interface PublishedPostContext {
  batchId: string;
  accountId: string;
  contentIntent: string;
  pipelineVersion: string;
  modelName: string;
  sourceStrategy: string;
  selectionStrategy: string;
  renderFormat: string;
}

export interface RenderedPostMetadata {
  renderUrls: string[];
  mediaPaths: string[];
  mediaCount: number;
  renderFormat: string;
}

export interface PublishedPostRecentRow {
  id: string;
  batch_id: string;
  status: PublishedPostStatus;
  article_title: string;
  article_url: string;
  article_source: string | null;
  caption: string | null;
  hashtags: string | null;
  template_sequence: string[] | null;
  quality_snapshot: PostQualitySnapshot | null;
  instagram_permalink: string | null;
  published_at: Date | string | null;
  created_at: Date | string;
}

export interface PublishedPostEventRow {
  id: string;
  event_type: string;
  stage: PublishedPostStage | null;
  payload: unknown;
  created_at: Date | string;
}

export interface PublishedPostEngagementSnapshotRow {
  id: string;
  captured_at: Date | string;
  likes: number | null;
  comments: number | null;
  views: number | null;
  saves: number | null;
  shares: number | null;
  raw_payload: unknown;
}

const logger = new Logger('published-post-store');

let pool: Pool | null = null;
let schemaReady = false;

function isConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function getPool(): Pool {
  if (pool) {
    return pool;
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for published post storage');
  }
  pool = new Pool({ connectionString });
  return pool;
}

function sanitizeText(value: string | undefined | null): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const cleaned = value.replace(/\0/g, '').trim();
  return cleaned.length > 0 ? cleaned : null;
}

function toJson(value: unknown): unknown {
  return value === undefined ? null : value;
}

function stageFromStatus(status: PublishedPostStatus): PublishedPostStage {
  if (status === 'selected') return 'selection';
  if (status === 'generated') return 'generation';
  if (status === 'rendered') return 'render';
  if (status === 'publish_started' || status === 'published') return 'publish';
  return 'unknown';
}

async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await ensurePublishedPostSchema(client);
    return await fn(client);
  } finally {
    client.release();
  }
}

async function safeWrite(action: string, fn: () => Promise<void>): Promise<void> {
  if (!isConfigured()) {
    return;
  }
  try {
    await fn();
  } catch (error) {
    logger.warn('published-post-store', `Best-effort analytics write failed: ${action}`, {
      error: error instanceof Error ? { name: error.name, message: error.message } : error,
    });
  }
}

export async function ensurePublishedPostSchema(client?: PoolClient): Promise<void> {
  if (schemaReady) {
    return;
  }

  const run = async (target: PoolClient) => {
    await target.query(`
      CREATE TABLE IF NOT EXISTS published_posts (
        id BIGSERIAL PRIMARY KEY,
        batch_id TEXT NOT NULL UNIQUE,
        account_id TEXT NOT NULL DEFAULT 'default',
        status TEXT NOT NULL,
        article_id TEXT,
        article_title TEXT NOT NULL,
        article_url TEXT NOT NULL,
        article_source TEXT,
        article_published_at TIMESTAMPTZ,
        selected_score NUMERIC,
        selection_reasons JSONB,
        generated_manifest JSONB,
        caption TEXT,
        hashtags TEXT,
        template_sequence JSONB,
        quality_snapshot JSONB,
        render_format TEXT,
        render_urls JSONB,
        media_metadata JSONB,
        instagram_permalink TEXT,
        publish_confirmation JSONB,
        publish_error TEXT,
        source_strategy TEXT,
        selection_strategy TEXT,
        content_intent TEXT,
        pipeline_version TEXT,
        model_name TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        published_at TIMESTAMPTZ
      )
    `);
    await target.query(`
      CREATE TABLE IF NOT EXISTS post_events (
        id BIGSERIAL PRIMARY KEY,
        published_post_id BIGINT REFERENCES published_posts(id) ON DELETE CASCADE,
        batch_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        stage TEXT,
        payload JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await target.query(`
      CREATE TABLE IF NOT EXISTS post_quality_scores (
        id BIGSERIAL PRIMARY KEY,
        published_post_id BIGINT REFERENCES published_posts(id) ON DELETE CASCADE,
        batch_id TEXT NOT NULL,
        quality_snapshot JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await target.query(`
      CREATE TABLE IF NOT EXISTS post_engagement_snapshots (
        id BIGSERIAL PRIMARY KEY,
        published_post_id BIGINT REFERENCES published_posts(id) ON DELETE CASCADE,
        batch_id TEXT NOT NULL,
        captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        likes INTEGER,
        comments INTEGER,
        views INTEGER,
        saves INTEGER,
        shares INTEGER,
        raw_payload JSONB
      )
    `);
    await target.query(`CREATE INDEX IF NOT EXISTS idx_published_posts_status ON published_posts(status)`);
    await target.query(`CREATE INDEX IF NOT EXISTS idx_published_posts_published_at ON published_posts(published_at DESC)`);
    await target.query(`CREATE INDEX IF NOT EXISTS idx_published_posts_article_url ON published_posts(article_url)`);
    await target.query(`CREATE INDEX IF NOT EXISTS idx_published_posts_permalink ON published_posts(instagram_permalink)`);
    await target.query(`CREATE INDEX IF NOT EXISTS idx_post_events_batch ON post_events(batch_id, created_at)`);
    await target.query(`CREATE INDEX IF NOT EXISTS idx_post_events_post ON post_events(published_post_id, created_at)`);
    await target.query(`CREATE INDEX IF NOT EXISTS idx_post_quality_batch ON post_quality_scores(batch_id, created_at)`);
    await target.query(`CREATE INDEX IF NOT EXISTS idx_post_engagement_post ON post_engagement_snapshots(published_post_id, captured_at DESC)`);
    schemaReady = true;
  };

  if (client) {
    await run(client);
    return;
  }

  await withClient(async () => undefined);
}

async function appendEvent(
  client: PoolClient,
  batchId: string,
  eventType: string,
  stage: PublishedPostStage,
  payload: unknown
): Promise<void> {
  const post = await client.query<{ id: string }>(
    `SELECT id FROM published_posts WHERE batch_id = $1`,
    [batchId]
  );
  await client.query(
    `
    INSERT INTO post_events (published_post_id, batch_id, event_type, stage, payload)
    VALUES ($1, $2, $3, $4, $5::jsonb)
    `,
    [post.rows[0]?.id ?? null, batchId, eventType, stage, JSON.stringify(toJson(payload))]
  );
}

export function buildPublishedPostContext(batchId: string): PublishedPostContext {
  return {
    batchId,
    accountId: process.env.ACCOUNT_ID || process.env.SCHEDULE_ACCOUNT_ID || 'default',
    contentIntent: process.env.CONTENT_INTENT || 'balanced',
    pipelineVersion: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || 'local',
    modelName: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    sourceStrategy: process.env.USE_RSS_FEEDS === 'false' ? 'gnews' : 'rss_with_gnews_fallback',
    selectionStrategy: 'diverse',
    renderFormat: process.env.RENDER_FORMAT || 'mp4',
  };
}

export function buildQualitySnapshotForPost(
  article: NewsArticle,
  content: GeneratedContent,
  selectedScore?: number,
  selectedReasons?: string[]
): PostQualitySnapshot {
  return buildQualitySnapshot({
    article,
    content,
    selectedScore,
    selectedReasons,
  });
}

export async function recordSelectedPost(
  context: PublishedPostContext,
  selected: { article: NewsArticle; score: number; reasons: string[] }
): Promise<void> {
  await safeWrite('record selected post', async () => {
    await withClient(async (client) => {
      const article = selected.article;
      await client.query(
        `
        INSERT INTO published_posts (
          batch_id, account_id, status, article_id, article_title, article_url,
          article_source, article_published_at, selected_score, selection_reasons,
          source_strategy, selection_strategy, content_intent, pipeline_version, model_name,
          render_format, updated_at
        )
        VALUES ($1,$2,'selected',$3,$4,$5,$6,$7::timestamptz,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,NOW())
        ON CONFLICT (batch_id) DO UPDATE SET
          status = 'selected',
          article_id = EXCLUDED.article_id,
          article_title = EXCLUDED.article_title,
          article_url = EXCLUDED.article_url,
          article_source = EXCLUDED.article_source,
          article_published_at = EXCLUDED.article_published_at,
          selected_score = EXCLUDED.selected_score,
          selection_reasons = EXCLUDED.selection_reasons,
          source_strategy = EXCLUDED.source_strategy,
          selection_strategy = EXCLUDED.selection_strategy,
          content_intent = EXCLUDED.content_intent,
          pipeline_version = EXCLUDED.pipeline_version,
          model_name = EXCLUDED.model_name,
          render_format = EXCLUDED.render_format,
          updated_at = NOW()
        `,
        [
          context.batchId,
          context.accountId,
          sanitizeText(article.articleId),
          sanitizeText(article.title) || '',
          sanitizeText(article.url) || '',
          sanitizeText(article.source),
          sanitizeText(article.publishedAt),
          selected.score,
          JSON.stringify(selected.reasons),
          context.sourceStrategy,
          context.selectionStrategy,
          context.contentIntent,
          context.pipelineVersion,
          context.modelName,
          context.renderFormat,
        ]
      );
      await appendEvent(client, context.batchId, 'article_selected', 'selection', {
        article,
        score: selected.score,
        reasons: selected.reasons,
      });
    });
  });
}

export async function recordGeneratedPost(
  context: PublishedPostContext,
  article: NewsArticle,
  content: GeneratedContent,
  qualitySnapshot: PostQualitySnapshot
): Promise<void> {
  await safeWrite('record generated post', async () => {
    await withClient(async (client) => {
      const templateSequence = content.manifest.carousel.map((slide) => slide.templateId);
      const res = await client.query<{ id: string }>(
        `
        UPDATE published_posts
        SET status='generated',
            generated_manifest=$2::jsonb,
            caption=$3,
            hashtags=$4,
            template_sequence=$5::jsonb,
            quality_snapshot=$6::jsonb,
            updated_at=NOW()
        WHERE batch_id=$1
        RETURNING id
        `,
        [
          context.batchId,
          JSON.stringify(content.manifest),
          sanitizeText(content.caption),
          sanitizeText(content.hashtags),
          JSON.stringify(templateSequence),
          JSON.stringify(qualitySnapshot),
        ]
      );
      const postId = res.rows[0]?.id;
      if (postId) {
        await client.query(
          `
          INSERT INTO post_quality_scores (published_post_id, batch_id, quality_snapshot)
          VALUES ($1, $2, $3::jsonb)
          `,
          [postId, context.batchId, JSON.stringify(qualitySnapshot)]
        );
      }
      await appendEvent(client, context.batchId, 'ai_generated', 'generation', {
        article,
        manifest: content.manifest,
        caption: content.caption,
        hashtags: content.hashtags,
        qualitySnapshot,
      });
    });
  });
}

export async function recordRenderedPost(
  context: PublishedPostContext,
  rendered: RenderedPostMetadata
): Promise<void> {
  await safeWrite('record rendered post', async () => {
    await withClient(async (client) => {
      const mediaMetadata = {
        mediaCount: rendered.mediaCount,
        renderFormat: rendered.renderFormat,
        // Store metadata/paths only. Never store image or video bytes in Postgres.
        mediaPaths: rendered.mediaPaths,
      };
      await client.query(
        `
        UPDATE published_posts
        SET status='rendered',
            render_format=$2,
            render_urls=$3::jsonb,
            media_metadata=$4::jsonb,
            updated_at=NOW()
        WHERE batch_id=$1
        `,
        [
          context.batchId,
          rendered.renderFormat,
          JSON.stringify(rendered.renderUrls),
          JSON.stringify(mediaMetadata),
        ]
      );
      await appendEvent(client, context.batchId, 'render_completed', 'render', {
        renderFormat: rendered.renderFormat,
        renderUrls: rendered.renderUrls,
        mediaCount: rendered.mediaCount,
      });
    });
  });
}

export async function recordPublishStartedPost(
  context: PublishedPostContext,
  post: PublishablePost
): Promise<void> {
  await safeWrite('record publish started', async () => {
    await withClient(async (client) => {
      await client.query(
        `
        UPDATE published_posts
        SET status='publish_started', updated_at=NOW()
        WHERE batch_id=$1
        `,
        [context.batchId]
      );
      await appendEvent(client, context.batchId, 'publish_started', 'publish', {
        postId: post.id,
        isCarousel: post.isCarousel,
        mediaCount: post.mediaPaths.length,
        captionLength: post.caption.length,
      });
    });
  });
}

export async function recordPublishedPost(
  context: PublishedPostContext,
  result: InstagramPublishResult
): Promise<void> {
  await safeWrite('record published post', async () => {
    await withClient(async (client) => {
      await client.query(
        `
        UPDATE published_posts
        SET status='published',
            instagram_permalink=$2,
            publish_confirmation=$3::jsonb,
            published_at=NOW(),
            updated_at=NOW()
        WHERE batch_id=$1
        `,
        [
          context.batchId,
          sanitizeText(result.permalink),
          JSON.stringify(result),
        ]
      );
      await appendEvent(client, context.batchId, 'publish_confirmed', 'publish', result);
    });
  });
}

export async function recordFailedPost(
  context: PublishedPostContext,
  stage: PublishedPostStage,
  error: unknown
): Promise<void> {
  await safeWrite('record failed post', async () => {
    const message = error instanceof Error ? error.message : String(error);
    await withClient(async (client) => {
      await client.query(
        `
        UPDATE published_posts
        SET status='failed',
            publish_error=$2,
            updated_at=NOW()
        WHERE batch_id=$1
        `,
        [context.batchId, sanitizeText(message) || 'Unknown error']
      );
      await appendEvent(client, context.batchId, 'pipeline_failed', stage, {
        error: { message: sanitizeText(message) || 'Unknown error' },
      });
    });
  });
}

export async function getRecentPublishedPosts(limit = 10, days?: number): Promise<PublishedPostRecentRow[]> {
  if (!isConfigured()) {
    return [];
  }
  return withClient(async (client) => {
    const safeLimit = Math.max(1, Math.min(Math.floor(limit), 100));
    const safeDays = days === undefined ? null : Math.max(1, Math.min(Math.floor(days), 365));
    const res = await client.query<PublishedPostRecentRow>(
      `
      SELECT id, batch_id, status, article_title, article_url, article_source,
             caption, hashtags, template_sequence, quality_snapshot, instagram_permalink,
             published_at, created_at
      FROM published_posts
      WHERE ($2::int IS NULL OR created_at >= NOW() - ($2::int * INTERVAL '1 day'))
      ORDER BY COALESCE(published_at, created_at) DESC
      LIMIT $1
      `,
      [safeLimit, safeDays]
    );
    return res.rows;
  });
}

export async function getPostEvents(postId: string): Promise<PublishedPostEventRow[]> {
  if (!isConfigured()) {
    return [];
  }
  return withClient(async (client) => {
    const res = await client.query<PublishedPostEventRow>(
      `
      SELECT id, event_type, stage, payload, created_at
      FROM post_events
      WHERE published_post_id = $1
      ORDER BY created_at ASC
      `,
      [postId]
    );
    return res.rows;
  });
}

export async function getPostQualityScore(postId: string): Promise<PostQualitySnapshot | null> {
  if (!isConfigured()) {
    return null;
  }
  return withClient(async (client) => {
    const res = await client.query<{ quality_snapshot: PostQualitySnapshot }>(
      `
      SELECT quality_snapshot
      FROM post_quality_scores
      WHERE published_post_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [postId]
    );
    return res.rows[0]?.quality_snapshot ?? null;
  });
}

export async function getPostEngagementSnapshots(
  postId: string,
  limit = 10
): Promise<PublishedPostEngagementSnapshotRow[]> {
  if (!isConfigured()) {
    return [];
  }
  return withClient(async (client) => {
    const safeLimit = Math.max(1, Math.min(Math.floor(limit), 100));
    const res = await client.query<PublishedPostEngagementSnapshotRow>(
      `
      SELECT id, captured_at, likes, comments, views, saves, shares, raw_payload
      FROM post_engagement_snapshots
      WHERE published_post_id = $1
      ORDER BY captured_at DESC
      LIMIT $2
      `,
      [postId, safeLimit]
    );
    return res.rows;
  });
}

export const __testing = {
  resetPublishedPostStoreForTests(): void {
    if (pool) {
      void pool.end();
    }
    pool = null;
    schemaReady = false;
  },
  isConfigured,
};
