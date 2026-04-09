import type { NewsArticle } from './types';

import { executeWithRetry } from './retryPolicy';
import { Logger } from '../utils/logger';
import { getRedisClient } from '../utils/redisClient';
import * as dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.GNEWS_API_KEY;
const GNEWS_URL = process.env.GNEWS_URL || 'https://gnews.io/api/v4/top-headlines';
const GNEWS_LANG = process.env.GNEWS_LANG || 'en';
const GNEWS_COUNTRY = process.env.GNEWS_COUNTRY || 'us';
const GNEWS_MAX_ARTICLES = Number(process.env.GNEWS_MAX_ARTICLES) || 10;
// Cache TTL in seconds — controls how long GNews results are cached in Redis
const GNEWS_CACHE_TTL_SECONDS = Number(process.env.GNEWS_CACHE_TTL_SECONDS) || 600; // 10 min default

/**
 * Cache GNews API results in Redis to avoid redundant API calls and respect rate limits.
 * Falls back gracefully when Redis is unavailable.
 */
async function fetchWithCache<T>(cacheKey: string, fn: () => Promise<T>): Promise<T> {
  const logger = new Logger();
  if (!process.env.REDIS_URL) {
    // Redis not configured — skip cache, call live API directly
    return fn();
  }
  try {
    const redis = await getRedisClient();
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.debug('gnews-cache', `Cache hit for key: ${cacheKey}`);
      return JSON.parse(cached) as T;
    }
    const result = await fn();
    await redis.set(cacheKey, JSON.stringify(result), { EX: GNEWS_CACHE_TTL_SECONDS });
    logger.debug('gnews-cache', `Cached result for key: ${cacheKey} (TTL: ${GNEWS_CACHE_TTL_SECONDS}s)`);
    return result;
  } catch (err) {
    // Redis unavailable — fall through to live API call
    logger.warn('gnews-cache', 'Redis cache error, fetching live', { err: err instanceof Error ? err.message : err });
    return fn();
  }
}

/**
 * Fetches the latest news articles from GNews.
 * @param category Default is 'technology'
 * @returns An array of mapped NewsArticle objects
 */

export async function fetchTopNews(category: string = 'technology'): Promise<NewsArticle[]> {
  const logger = new Logger();
  // Read at call-time so test env manipulation (delete process.env.GNEWS_API_KEY) is respected
  if (!process.env.GNEWS_API_KEY) {
    logger.warn('gnews', 'GNEWS_API_KEY not configured — returning empty result. Pipeline will abort with no articles.');
    return [];
  }

  // Validate env values and log warnings if needed
  if (!process.env.GNEWS_LANG) logger.warn('gnews-config', 'GNEWS_LANG not set, defaulting to "en"');
  if (!process.env.GNEWS_COUNTRY) logger.warn('gnews-config', 'GNEWS_COUNTRY not set, defaulting to "us"');
  if (!process.env.GNEWS_MAX_ARTICLES) logger.warn('gnews-config', 'GNEWS_MAX_ARTICLES not set, defaulting to 10');
  if (!process.env.GNEWS_URL) logger.warn('gnews-config', 'GNEWS_URL not set, defaulting to top-headlines endpoint');

  const cacheKey = `gnews:top:${category}:${GNEWS_LANG}:${GNEWS_COUNTRY}:${GNEWS_MAX_ARTICLES}`;
  return fetchWithCache(cacheKey, () => _fetchTopNewsLive(category, logger));
}

async function _fetchTopNewsLive(category: string, logger: Logger): Promise<NewsArticle[]> {

  const url = `${GNEWS_URL}?category=${category}&lang=${GNEWS_LANG}&country=${GNEWS_COUNTRY}&max=${GNEWS_MAX_ARTICLES}&apikey=${API_KEY}`;
  // Used only for logging — strips sensitive apikey param
  const safeUrl = `${GNEWS_URL}?category=${category}&lang=${GNEWS_LANG}&country=${GNEWS_COUNTRY}&max=${GNEWS_MAX_ARTICLES}&apikey=REDACTED`;

  const isRetryableGNewsError = (error: unknown): boolean => {
    if (typeof error === 'object' && error && 'message' in error) {
      const msg = String((error as any).message);
      if (/GNews API Error: (429|500|503)/.test(msg)) return true;
      // Retry for network errors as well
      if (/timeout|network|econnreset|econnrefused|etimedout/i.test(msg)) return true;
    }
    return false;
  };


  let lastRetryDelay = 2000;
  const fetchFn = async () => {
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      // Check for Retry-After header on 429
      let retryAfterMs: number | undefined;
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        if (retryAfter) {
          const retrySeconds = Number(retryAfter);
          if (!isNaN(retrySeconds)) {
            retryAfterMs = retrySeconds * 1000;
            lastRetryDelay = retryAfterMs;
            logger.warn('gnews', `Received 429. Using Retry-After: ${retryAfter}s`, { retryAfterMs });
          }
        }
      }
      logger.error('gnews', `GNews API Error: ${response.status}`, { status: response.status, error: errorText, url: safeUrl, retryAfterMs });
      throw new Error(`GNews API Error: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    if (!data.articles || !Array.isArray(data.articles)) {
      logger.error('gnews', 'GNews API returned invalid response structure', { data });
      throw new Error('GNews API returned invalid response structure');
    }
    return data.articles
      .map((article: any) => mapToNewsArticle(article))
      .filter((a) => a.imageUrl && a.title); // reject articles without image — unusable for HOOK_A template
  };

  try {
    return await executeWithRetry(fetchFn, {
      maxRetries: 2,
      retryDelayMs: () => lastRetryDelay,
      isRetryable: isRetryableGNewsError,
      onRetry: (attempt, error) => {
        logger.warn('gnews-retry', `Retrying GNews API call (attempt ${attempt})`, { error: error instanceof Error ? error.message : error, retryDelayMs: lastRetryDelay });
      },
    });
  } catch (error) {
    logger.error('gnews', 'Failed to fetch news from GNews after retries', { error });
    throw error;
  }
}

/**
 * Fetches news articles from GNews Search endpoint with niche keywords.
 * Supports AND/OR/NOT query operators and relevance sorting.
 * @param query Search query (e.g. "startup AND (technology OR developer)")
 * @param options Sorting and date filtering options
 * @returns An array of mapped NewsArticle objects
 */
export async function fetchSearchNews(
  query: string,
  options?: {
    sortby?: 'publishedAt' | 'relevance';
    from?: string; // ISO 8601 date
    to?: string;   // ISO 8601 date
    maxResults?: number;
  }
): Promise<NewsArticle[]> {
  const logger = new Logger();
  // Read at call-time so test env manipulation is respected
  if (!process.env.GNEWS_API_KEY) {
    logger.warn('gnews-search', 'GNEWS_API_KEY not found in .env. Cannot fetch search results.');
    return [];
  }

  const maxResults = options?.maxResults || GNEWS_MAX_ARTICLES;
  const sortby = options?.sortby || 'relevance';
  const cacheKey = `gnews:search:${query}:${GNEWS_LANG}:${GNEWS_COUNTRY}:${maxResults}:${sortby}:${options?.from ?? ''}:${options?.to ?? ''}`;
  return fetchWithCache(cacheKey, () => _fetchSearchNewsLive(query, options, logger));
}

async function _fetchSearchNewsLive(
  query: string,
  options: { sortby?: 'publishedAt' | 'relevance'; from?: string; to?: string; maxResults?: number } | undefined,
  logger: Logger
): Promise<NewsArticle[]> {
  const searchEndpoint = 'https://gnews.io/api/v4/search';
  const sortby = options?.sortby || 'relevance';
  const maxResults = options?.maxResults || GNEWS_MAX_ARTICLES;

  const params = new URLSearchParams({
    q: query,
    lang: GNEWS_LANG,
    country: GNEWS_COUNTRY,
    max: String(maxResults),
    sortby,
    apikey: API_KEY,
  });

  if (options?.from) params.append('from', options.from);
  if (options?.to) params.append('to', options.to);

  const url = `${searchEndpoint}?${params.toString()}`;
  // Redact apikey from logged URL
  const safeSearchUrl = url.replace(/apikey=[^&]+/, 'apikey=REDACTED');

  const isRetryableGNewsError = (error: unknown): boolean => {
    if (typeof error === 'object' && error && 'message' in error) {
      const msg = String((error as any).message);
      if (/GNews API Error: (429|500|503)/.test(msg)) return true;
      if (/timeout|network|econnreset|econnrefused|etimedout/i.test(msg)) return true;
    }
    return false;
  };

  let lastRetryDelay = 2000;
  const fetchFn = async () => {
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      let retryAfterMs: number | undefined;
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        if (retryAfter) {
          const retrySeconds = Number(retryAfter);
          if (!isNaN(retrySeconds)) {
            retryAfterMs = retrySeconds * 1000;
            lastRetryDelay = retryAfterMs;
            logger.warn('gnews-search', `Received 429. Using Retry-After: ${retryAfter}s`, { retryAfterMs });
          }
        }
      }
      logger.error('gnews-search', `GNews API Error: ${response.status}`, { status: response.status, error: errorText, url: safeSearchUrl, retryAfterMs });
      throw new Error(`GNews API Error: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    if (!data.articles || !Array.isArray(data.articles)) {
      logger.error('gnews-search', 'GNews API returned invalid response structure', { data });
      throw new Error('GNews API returned invalid response structure');
    }
    return data.articles
      .map((article: any) => mapToNewsArticle(article))
      .filter((a) => a.imageUrl && a.title); // reject articles without image
  };

  try {
    return await executeWithRetry(fetchFn, {
      maxRetries: 2,
      retryDelayMs: () => lastRetryDelay,
      isRetryable: isRetryableGNewsError,
      onRetry: (attempt, error) => {
        logger.warn('gnews-search-retry', `Retrying GNews search (attempt ${attempt})`, { error: error instanceof Error ? error.message : error, retryDelayMs: lastRetryDelay });
      },
    });
  } catch (error) {
    logger.error('gnews-search', 'Failed to fetch search results after retries', { error });
    throw error;
  }
}

/**
 * Merges two article arrays, deduping by URL and prioritizing by relevance.
 * @param headlines Articles from top-headlines endpoint
 * @param search Articles from search endpoint
 * @returns Merged and deduped array
 */
export function mergeAndDedupeArticles(headlines: NewsArticle[], search: NewsArticle[]): NewsArticle[] {
  const seen = new Set<string>();
  const merged: NewsArticle[] = [];

  // Add all from search first (they're already sorted by relevance)
  for (const article of search) {
    if (!seen.has(article.url)) {
      seen.add(article.url);
      merged.push(article);
    }
  }

  // Add headlines that aren't duplicates
  for (const article of headlines) {
    if (!seen.has(article.url)) {
      seen.add(article.url);
      merged.push(article);
    }
  }

  return merged;
}

/**
 * Determines if content appears to be truncated (GNews Free plan limitation).
 * Truncated content typically ends with "... [NNN chars]" pattern.
 */
function isContentTruncated(content: string): boolean {
  return /\.\.\.\s*\[\d+\s+chars\]/i.test(content) || content.length > 5000 && content.endsWith('...');
}

/**
 * Validates imageUrl for presence and basic URL format.
 */
function isValidImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    new URL(url); // Basic URL validation
    return url;
  } catch {
    return undefined;
  }
}

/**
 * Maps raw GNews API article data to our internal NewsArticle interface.
 * Includes content truncation warnings and image URL validation.
 */
function mapToNewsArticle(raw: any): NewsArticle {
  const logger = new Logger();
  
  let content = raw.content || raw.description || '';
  // Warn if content appears truncated (Free plan indicator)
  if (content && isContentTruncated(content)) {
    logger.warn('gnews-content', 'Article content appears truncated (GNews Free plan)', { title: raw.title });
  }

  const imageUrl = isValidImageUrl(raw.image);
  if (raw.image && !imageUrl) {
    logger.warn('gnews-content', 'Article imageUrl is invalid or malformed', { title: raw.title, providedUrl: raw.image });
  }

  return {
    title: raw.title,
    description: raw.description || '',
    content,
    url: raw.url,
    imageUrl,
    publishedAt: raw.publishedAt,
    source: raw.source?.name || 'Unknown Source'
  };
}
