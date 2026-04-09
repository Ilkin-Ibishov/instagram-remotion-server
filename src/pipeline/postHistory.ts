import fs from 'fs';
import path from 'path';
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

const HISTORY_FILE = path.join(process.cwd(), 'post-history.json');

/**
 * Load post history from JSON file.
 */
function loadHistory(): PostRecord[] {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    new Logger().warn('history', `Failed to load post history: ${e}`);
  }
  return [];
}

/**
 * Check if an article has already been posted.
 */
export function hasBeenPosted(articleUrl: string): boolean {
  const normalised = normalizeArticleUrl(articleUrl);
  const history = loadHistory();
  return history.some(record => normalizeArticleUrl(record.articleUrl) === normalised);
}

/**
 * Record a newly posted article.
 */
export function recordPost(article: { title: string; url: string }, batchId: string): void {
  const history = loadHistory();
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

  const logger = new Logger();
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
  const history = loadHistory();
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
