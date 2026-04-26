import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool, type PoolClient } from 'pg';
import Logger from '../utils/logger';
import { normalizeArticleUrl } from '../utils/normalizeUrl';
import { createTitleFingerprint, calculateSimilarity } from '../utils/titleFingerprint';

/**
 * Post History Tracker: Prevents duplicate news articles from being posted.
 * Backends: JSON file (default) or Postgres (`POST_HISTORY_STORE=postgres`).
 */

export interface PostRecord {
  articleId?: string;
  articleTitle: string;
  articleUrl: string;
  titleFingerprint?: string;
  postedAt: string;
  batchId: string;
}

type HistoryLoadResult =
  | { ok: true; history: PostRecord[] }
  | { ok: false; history: PostRecord[]; reason: 'corrupted' };

export type PostHistoryStoreKind = 'file' | 'postgres';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_HISTORY_FILE = path.resolve(MODULE_DIR, '../../post-history.json');
const HISTORY_FILE = process.env.POST_HISTORY_PATH || DEFAULT_HISTORY_FILE;

const FINGERPRINT_SIMILARITY_THRESHOLD = 0.55;

function parseMaxRows(): number {
  const raw = process.env.POST_HISTORY_MAX_ROWS;
  if (raw === undefined || raw === '') {
    return 500;
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 50_000) {
    throw new Error(`POST_HISTORY_MAX_ROWS must be an integer in [1, 50000], got: ${raw}`);
  }
  return n;
}

function getStoreKind(): PostHistoryStoreKind {
  const raw = (process.env.POST_HISTORY_STORE || 'file').toLowerCase();
  if (raw === 'file' || raw === 'json') {
    return 'file';
  }
  if (raw === 'postgres' || raw === 'pg') {
    return 'postgres';
  }
  throw new Error(`POST_HISTORY_STORE must be "file" or "postgres", got: ${process.env.POST_HISTORY_STORE}`);
}

/** True when post history uses Postgres (multi-instance safe URL claims). */
export function isPostgresPostHistory(): boolean {
  return getStoreKind() === 'postgres';
}

function sanitizeText(value: string): string {
  return value.replace(/\0/g, '');
}

function sanitizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const sanitized = sanitizeText(value).trim();
  return sanitized.length > 0 ? sanitized : undefined;
}

export function getHistoryPath(): string {
  return HISTORY_FILE;
}

let pgPool: Pool | null = null;
let pgSchemaReady = false;

function getPostHistoryPool(): Pool {
  if (pgPool) {
    return pgPool;
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required when POST_HISTORY_STORE=postgres');
  }
  pgPool = new Pool({ connectionString });
  return pgPool;
}

async function ensurePostHistorySchema(client: PoolClient): Promise<void> {
  if (pgSchemaReady) {
    return;
  }
  await client.query(`
    CREATE TABLE IF NOT EXISTS post_history (
      id BIGSERIAL PRIMARY KEY,
      article_title TEXT NOT NULL,
      article_url TEXT NOT NULL,
      title_fingerprint TEXT,
      posted_at TIMESTAMPTZ NOT NULL,
      batch_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`ALTER TABLE post_history ADD COLUMN IF NOT EXISTS article_id TEXT`);
  await client.query(`ALTER TABLE post_history ADD COLUMN IF NOT EXISTS normalized_url TEXT`);
  await client.query(`ALTER TABLE post_history ADD COLUMN IF NOT EXISTS status TEXT`);
  await client.query(`UPDATE post_history SET normalized_url = article_url WHERE normalized_url IS NULL`);
  await client.query(`UPDATE post_history SET status = 'posted' WHERE status IS NULL`);
  await client.query(`ALTER TABLE post_history ALTER COLUMN normalized_url SET NOT NULL`);
  await client.query(`ALTER TABLE post_history ALTER COLUMN status SET NOT NULL`);
  await client.query(`ALTER TABLE post_history ALTER COLUMN status SET DEFAULT 'posted'`);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_post_history_posted_at_desc ON post_history (posted_at DESC)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_post_history_article_url ON post_history (article_url)
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_post_history_normalized_url ON post_history (normalized_url)
  `);
  pgSchemaReady = true;
}

function rowToRecord(row: {
  article_id?: string | null;
  article_title: string;
  article_url: string;
  title_fingerprint: string | null;
  posted_at: Date;
  batch_id: string;
}): PostRecord {
  return {
    articleId: row.article_id ?? undefined,
    articleTitle: row.article_title,
    articleUrl: row.article_url,
    titleFingerprint: row.title_fingerprint ?? undefined,
    postedAt: row.posted_at instanceof Date ? row.posted_at.toISOString() : String(row.posted_at),
    batchId: row.batch_id,
  };
}

/**
 * Pure duplicate check (URL normalize + trigram fingerprint), shared by file and Postgres paths.
 */
export function isArticlePostedInHistory(
  history: PostRecord[],
  articleUrl: string,
  articleTitle?: string,
  articleId?: string
): boolean {
  const normalizedUrl = normalizeArticleUrl(articleUrl);
  const currentFingerprint = articleTitle ? createTitleFingerprint(articleTitle) : null;
  const currentArticleId = sanitizeOptionalText(articleId);

  return history.some(record => {
    if (currentArticleId && sanitizeOptionalText(record.articleId) === currentArticleId) {
      return true;
    }
    if (normalizeArticleUrl(record.articleUrl) === normalizedUrl) {
      return true;
    }
    if (currentFingerprint && record.titleFingerprint) {
      const similarity = calculateSimilarity(currentFingerprint, record.titleFingerprint);
      if (similarity > FINGERPRINT_SIMILARITY_THRESHOLD) {
        return true;
      }
    }
    return false;
  });
}

function loadHistoryFromFile(): HistoryLoadResult {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return { ok: true, history: parsed as PostRecord[] };
      }
      new Logger().warn('history', 'Post history file is not an array; refusing to use corrupted history');
      return { ok: false, history: [], reason: 'corrupted' };
    }
  } catch (e) {
    new Logger().warn('history', `Failed to load post history: ${e}`);
    return { ok: false, history: [], reason: 'corrupted' };
  }
  return { ok: true, history: [] };
}

async function loadDedupSnapshotPostgres(): Promise<PostRecord[]> {
  const maxRows = parseMaxRows();
  const client = await getPostHistoryPool().connect();
  try {
    await ensurePostHistorySchema(client);
    const res = await client.query<{
      article_id: string | null;
      article_title: string;
      article_url: string;
      title_fingerprint: string | null;
      posted_at: Date;
      batch_id: string;
    }>(
      `
      SELECT article_id, article_title, article_url, title_fingerprint, posted_at, batch_id
      FROM post_history
      ORDER BY posted_at DESC
      LIMIT $1
      `,
      [maxRows]
    );
    return res.rows.map(rowToRecord);
  } finally {
    client.release();
  }
}

function loadDedupSnapshotFile(): PostRecord[] {
  const { history } = loadHistoryFromFile();
  const maxRows = parseMaxRows();
  const sorted = [...history].sort(
    (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
  );
  return sorted.slice(0, maxRows);
}

/**
 * Rows used for URL + fingerprint dedup (most recent N by posted time).
 */
export async function loadPostHistoryDedupSnapshot(): Promise<PostRecord[]> {
  if (getStoreKind() === 'postgres') {
    return loadDedupSnapshotPostgres();
  }
  return loadDedupSnapshotFile();
}

/**
 * Atomically reserve a normalized URL in Postgres so only one worker can proceed.
 * Uses INSERT … ON CONFLICT (normalized_url) DO NOTHING.
 * @returns true if this worker inserted the row (claim won), false if the URL was already taken.
 */
export async function claimArticle(url: string, fingerprint: string): Promise<boolean> {
  if (getStoreKind() !== 'postgres') {
    return false;
  }
  const normUrl = normalizeArticleUrl(sanitizeText(url || ''));
  const fp = sanitizeText(fingerprint || '');
  const postedAt = new Date().toISOString();
  const client = await getPostHistoryPool().connect();
  try {
    await ensurePostHistorySchema(client);
    const res = await client.query<{ id: string }>(
      `
      INSERT INTO post_history (
        article_title,
        article_url,
        normalized_url,
        title_fingerprint,
        posted_at,
        batch_id,
        status
      )
      VALUES ($1, $2, $3, $4, $5::timestamptz, $6, $7)
      ON CONFLICT (normalized_url) DO NOTHING
      RETURNING id
      `,
      ['', normUrl, normUrl, fp, postedAt, 'claim', 'claimed']
    );
    return res.rows.length > 0;
  } finally {
    client.release();
  }
}

/**
 * @deprecated Prefer loadPostHistoryDedupSnapshot + isArticlePostedInHistory in hot paths (single load per batch).
 */
export async function hasBeenPosted(articleUrl: string, articleTitle?: string): Promise<boolean> {
  const snapshot = await loadPostHistoryDedupSnapshot();
  return isArticlePostedInHistory(snapshot, articleUrl, articleTitle);
}

export async function recordPost(article: { id?: string; articleId?: string; title: string; url: string }, batchId: string): Promise<void> {
  const logger = new Logger();
  const articleId = sanitizeOptionalText(article.articleId ?? article.id);
  const title = sanitizeText(article.title || '');
  const url = normalizeArticleUrl(sanitizeText(article.url || ''));
  const fp = createTitleFingerprint(title);
  const postedAt = new Date().toISOString();
  const safeBatch = sanitizeText(batchId);

  if (getStoreKind() === 'postgres') {
    const client = await getPostHistoryPool().connect();
    try {
      await ensurePostHistorySchema(client);
      const status = safeBatch.includes('pre-gen') ? 'pre-gen' : 'posted';
      await client.query(
        `
        INSERT INTO post_history (
          article_id,
          article_title,
          article_url,
          normalized_url,
          title_fingerprint,
          posted_at,
          batch_id,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7, $8)
        ON CONFLICT (normalized_url) DO UPDATE SET
          article_id = COALESCE(EXCLUDED.article_id, post_history.article_id),
          article_title = EXCLUDED.article_title,
          article_url = EXCLUDED.article_url,
          title_fingerprint = EXCLUDED.title_fingerprint,
          posted_at = EXCLUDED.posted_at,
          batch_id = EXCLUDED.batch_id,
          status = EXCLUDED.status
        `,
        [articleId ?? null, title, url, url, fp, postedAt, safeBatch, status]
      );
      const maxRows = parseMaxRows();
      await client.query(
        `
        DELETE FROM post_history
        WHERE id IN (
          SELECT id FROM post_history
          ORDER BY posted_at DESC
          OFFSET $1
        )
        `,
        [maxRows]
      );
      logger.info('history', `Recorded post with fingerprint (postgres): "${title}"`);
    } catch (e) {
      logger.error('history', `Failed to save post history to Postgres: ${e}`);
    } finally {
      client.release();
    }
    return;
  }

  const historyResult = loadHistoryFromFile();
  if (!historyResult.ok) {
    logger.error(
      'history',
      'Refusing to overwrite corrupted post history. Fix or replace the history file before recording new posts.'
    );
    return;
  }

  const history = historyResult.history;
  const record: PostRecord = {
    articleId,
    articleTitle: title,
    articleUrl: url,
    titleFingerprint: fp,
    postedAt,
    batchId: safeBatch,
  };

  history.push(record);
  const maxRows = parseMaxRows();
  if (history.length > maxRows) {
    history.splice(0, history.length - maxRows);
  }

  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    logger.info('history', `Recorded post with fingerprint: "${title}"`);
  } catch (e) {
    logger.error('history', `Failed to save post history: ${e}`);
  }
}

export async function getRecentPosts(days: number = 7): Promise<PostRecord[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  if (getStoreKind() === 'postgres') {
    const client = await getPostHistoryPool().connect();
    try {
      await ensurePostHistorySchema(client);
      const res = await client.query<{
        article_title: string;
        article_url: string;
        title_fingerprint: string | null;
        posted_at: Date;
        batch_id: string;
      }>(
        `
        SELECT article_title, article_url, title_fingerprint, posted_at, batch_id
        FROM post_history
        WHERE posted_at > $1::timestamptz
        ORDER BY posted_at DESC
        `,
        [cutoff.toISOString()]
      );
      return res.rows.map(rowToRecord);
    } finally {
      client.release();
    }
  }

  const { history } = loadHistoryFromFile();
  return history.filter(record => new Date(record.postedAt) > cutoff);
}

export async function clearHistory(): Promise<void> {
  if (getStoreKind() === 'postgres') {
    const client = await getPostHistoryPool().connect();
    try {
      await ensurePostHistorySchema(client);
      await client.query('DELETE FROM post_history');
    } finally {
      client.release();
    }
    return;
  }
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      fs.unlinkSync(HISTORY_FILE);
    }
  } catch (e) {
    console.error(`Failed to clear history: ${e}`);
  }
}

/** Test hook: reset Postgres schema latch and pool (vitest only). */
export function __resetPostHistoryPostgresForTests(): void {
  pgSchemaReady = false;
  if (pgPool) {
    void pgPool.end();
    pgPool = null;
  }
}
