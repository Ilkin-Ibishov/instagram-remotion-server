import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Logger } from '../utils/logger';
import { normalizeArticleUrl } from '../utils/normalizeUrl';

/**
 * Post History Tracker: Prevents duplicate news articles from being posted.
 * Uses JSON file for simple persistence (SQLite could be used for scale).
 */

export interface PostRecord {
  articleTitle: string;
  articleUrl: string;
  postedAt: string;
  batchId: string;
}

type HistoryLoadResult =
  | { ok: true; history: PostRecord[] }
  | { ok: false; history: PostRecord[]; reason: 'corrupted' };

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_HISTORY_FILE = path.resolve(MODULE_DIR, '../../post-history.json');
const HISTORY_FILE = process.env.POST_HISTORY_PATH || DEFAULT_HISTORY_FILE;

export function getHistoryPath(): string {
  return HISTORY_FILE;
}

/**
 * Load post history from JSON file.
 */
function loadHistory(): HistoryLoadResult {
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

/**
 * Check if an article has already been posted.
 */
export function hasBeenPosted(articleUrl: string): boolean {
  const normalised = normalizeArticleUrl(articleUrl);
  const { history } = loadHistory();
  return history.some(record => normalizeArticleUrl(record.articleUrl) === normalised);
}

/**
 * Record a newly posted article.
 */
export function recordPost(article: { title: string; url: string }, batchId: string): void {
  const historyResult = loadHistory();
  const logger = new Logger();
  if (!historyResult.ok) {
    logger.error(
      'history',
      'Refusing to overwrite corrupted post history. Fix or replace the history file before recording new posts.'
    );
    return;
  }

  const history = historyResult.history;
  const record: PostRecord = {
    articleTitle: article.title,
    articleUrl: normalizeArticleUrl(article.url),
    postedAt: new Date().toISOString(),
    batchId,
  };

  history.push(record);

  // Keep only last 500 posts to prevent file bloat
  if (history.length > 500) {
    history.splice(0, history.length - 500);
  }

  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    logger.info('history', `Recorded post: "${article.title}"`);
  } catch (e) {
    logger.error('history', `Failed to save post history: ${e}`);
  }
}

/**
 * Get all posted articles in the last N days.
 */
export function getRecentPosts(days: number = 7): PostRecord[] {
  const { history } = loadHistory();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  return history.filter(record => {
    const postDate = new Date(record.postedAt);
    return postDate > cutoffDate;
  });
}

/**
 * Clear all post history (for testing).
 */
export function clearHistory(): void {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      fs.unlinkSync(HISTORY_FILE);
      console.log('[history] ✓ Cleared post history');
    }
  } catch (e) {
    console.error(`[history] Failed to clear post history: ${e}`);
  }
}
