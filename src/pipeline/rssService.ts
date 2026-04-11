import Parser from 'rss-parser';

import type { NewsArticle } from './types';
import { getSourcesForNiche, type RssSource } from './rssSourceRegistry';
import { executeWithRetry } from './retryPolicy';
import {
  classifyRssErrorType,
  noteSourceFetchFailure,
  noteSourceFetchSuccess,
  recordRssRunTelemetry,
  recordRssSourceTelemetry,
  shouldSkipSourceByCooldown,
} from './rssTelemetryStore';
import { normalizeArticleUrl } from '../utils/normalizeUrl';
import { getRedisClient } from '../utils/redisClient';
import Logger from '../utils/logger';

type RssMediaNode = {
  url?: string;
  $?: {
    url?: string;
    href?: string;
  };
};

type RssItem = {
  title?: string;
  link?: string;
  guid?: string;
  contentSnippet?: string;
  summary?: string;
  description?: string;
  content?: string;
  pubDate?: string;
  isoDate?: string;
  enclosure?: RssMediaNode;
  mediaContent?: RssMediaNode;
  mediaThumbnail?: RssMediaNode;
  itunesImage?: RssMediaNode;
};

type FeedLiveResult = {
  articles: NewsArticle[];
  rawItemCount: number;
};

type SourceFetchResult = {
  sourceId: string;
  sourceName: string;
  status: 'success' | 'failed' | 'skipped_cooldown';
  articles: NewsArticle[];
  articlesBeforeFilter: number;
  articlesAfterFilter: number;
  cacheHit: boolean;
  retryCount: number;
  durationMs: number;
  errorType?: 'timeout' | 'network' | 'parse' | 'unknown';
  errorMessage?: string;
};

const FETCH_TIMEOUT_MS = 10_000;
const GLOBAL_FETCH_TIMEOUT_MS = Number(process.env.RSS_GLOBAL_TIMEOUT_MS) || 15_000;
const EPOCH_FALLBACK_DATE = '1970-01-01T00:00:00Z';
const TITLE_SIMILARITY_THRESHOLD = Number(process.env.RSS_TITLE_DEDUP_THRESHOLD || '0.6');
const parser = new Parser({
  timeout: FETCH_TIMEOUT_MS,
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: false }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: false }],
      ['itunes:image', 'itunesImage', { keepArray: false }],
    ],
  },
});

function resolveRssImage(item: RssItem): string | undefined {
  const candidates = [
    item.mediaContent?.url,
    item.mediaContent?.$?.url,
    item.mediaContent?.$?.href,
    item.mediaThumbnail?.url,
    item.mediaThumbnail?.$?.url,
    item.mediaThumbnail?.$?.href,
    item.enclosure?.url,
    item.enclosure?.$?.url,
    item.enclosure?.$?.href,
    item.itunesImage?.url,
    item.itunesImage?.$?.url,
    item.itunesImage?.$?.href,
  ];

  return candidates.find((candidate) => typeof candidate === 'string' && candidate.length > 0);
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[^;]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDescription(raw: RssItem): string {
  const fallback = stripHtml(raw.summary || raw.description || raw.content || '');
  const value = raw.contentSnippet || fallback;
  const clipped = value.substring(0, 500).trim();
  if (!clipped) {
    return '';
  }

  const boundary = clipped.lastIndexOf('. ');
  if (boundary > 200) {
    return clipped.substring(0, boundary + 1).trim();
  }
  return clipped;
}

function resolveArticleUrl(item: RssItem): string {
  if (item.link) {
    return item.link.trim();
  }

  if (item.guid) {
    const guid = item.guid.trim();
    if (/^https?:\/\//i.test(guid)) {
      return guid;
    }
  }

  return '';
}

export function normalizeItem(item: RssItem, source: RssSource): NewsArticle {
  const description = normalizeDescription(item);
  const publishedAt = item.pubDate || item.isoDate || EPOCH_FALLBACK_DATE;

  return {
    title: (item.title || '').trim(),
    description,
    content: description,
    url: resolveArticleUrl(item),
    imageUrl: resolveRssImage(item),
    publishedAt,
    source: source.name,
  };
}

function titleWordSet(title: string): Set<string> {
  const stopWords = new Set([
    'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'is', 'it', 'its', 'this', 'that',
    'with', 'are', 'was', 'by', 'as', 'be', 'or', 'from', 'has', 'have', 'not', 'but', 'your',
  ]);

  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word))
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) {
    return 1;
  }

  const intersection = [...a].filter((word) => b.has(word)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

export function crossSourceDedup(articles: NewsArticle[], logger: Logger): NewsArticle[] {
  const seenUrls = new Set<string>();
  const seenTitleSets: Set<string>[] = [];
  const deduped: NewsArticle[] = [];
  let droppedByUrl = 0;
  let droppedByTitleSimilarity = 0;

  logger.info('rss-dedup', 'Starting cross-source deduplication', {
    totalInput: articles.length,
    threshold: TITLE_SIMILARITY_THRESHOLD,
  });

  for (const article of articles) {
    const normalizedUrl = normalizeArticleUrl(article.url);
    if (seenUrls.has(normalizedUrl)) {
      droppedByUrl += 1;
      continue;
    }

    const currentTitleSet = titleWordSet(article.title);
    const isTitleDuplicate = seenTitleSets.some(
      (existingTitleSet) => jaccardSimilarity(existingTitleSet, currentTitleSet) >= TITLE_SIMILARITY_THRESHOLD
    );

    if (isTitleDuplicate) {
      droppedByTitleSimilarity += 1;
      logger.debug('rss-dedup', `Dropped cross-source duplicate: ${article.title.substring(0, 60)}`);
      continue;
    }

    seenUrls.add(normalizedUrl);
    seenTitleSets.push(currentTitleSet);
    deduped.push(article);
  }

  logger.info('rss-dedup', 'Cross-source deduplication complete', {
    kept: deduped.length,
    droppedByUrl,
    droppedByTitleSimilarity,
    totalDropped: droppedByUrl + droppedByTitleSimilarity,
  });

  return deduped;
}

async function fetchFeedLive(source: RssSource, logger: Logger): Promise<FeedLiveResult> {
  logger.info('rss-fetch', `Fetching live RSS feed: ${source.id}`, {
    feedUrl: source.feedUrl,
    timeoutMs: FETCH_TIMEOUT_MS,
  });

  const startedAt = Date.now();
  const feed = await parser.parseURL(source.feedUrl);
  const rawItems = feed.items as RssItem[];
  const normalized = rawItems.map((item) => normalizeItem(item, source));
  const filtered = normalized.filter((article) => Boolean(article.title && article.description && article.url && article.imageUrl));

  let missingTitle = 0;
  let missingDescription = 0;
  let missingUrl = 0;
  let missingImage = 0;
  for (const article of normalized) {
    if (!article.title) missingTitle += 1;
    if (!article.description) missingDescription += 1;
    if (!article.url) missingUrl += 1;
    if (!article.imageUrl) missingImage += 1;
  }

  logger.info('rss-fetch', `Live RSS fetch complete: ${source.id}`, {
    sourceId: source.id,
    rawItemCount: rawItems.length,
    normalizedCount: normalized.length,
    acceptedCount: filtered.length,
    droppedCount: normalized.length - filtered.length,
    droppedReasons: {
      missingTitle,
      missingDescription,
      missingUrl,
      missingImage,
    },
    durationMs: Date.now() - startedAt,
  });

  return {
    articles: filtered,
    rawItemCount: rawItems.length,
  };
}

async function fetchFeedCached(source: RssSource, logger: Logger): Promise<SourceFetchResult> {
  const cacheKey = `rss:feed:${source.id}`;
  const ttlOverride = Number(process.env.RSS_CACHE_TTL_SECONDS);
  const ttlSeconds = Number.isFinite(ttlOverride) && ttlOverride > 0 ? ttlOverride : source.cacheTtlSeconds;
  const startedAt = Date.now();

  logger.debug('rss-cache', `Starting cache lookup for ${source.id}`, {
    cacheKey,
    ttlSeconds,
    redisEnabled: Boolean(process.env.REDIS_URL),
  });

  if (process.env.REDIS_URL) {
    try {
      const redis = await getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        const cachedArticles = JSON.parse(cached) as NewsArticle[];
        logger.debug('rss-cache', `Cache hit for ${source.id}`, { count: cachedArticles.length, cacheKey });

        const newestArticleDate = cachedArticles.reduce<number>((maxDate, article) => {
          const value = new Date(article.publishedAt).getTime();
          return Number.isNaN(value) ? maxDate : Math.max(maxDate, value);
        }, 0);
        if (newestArticleDate > 0) {
          const ageMs = Date.now() - newestArticleDate;
          if (ageMs > ttlSeconds * 2 * 1000) {
            logger.warn('rss-cache', `Stale cache detected for ${source.id}`, { ageMs, ttlSeconds });
          }
        }

        return {
          sourceId: source.id,
          sourceName: source.name,
          status: 'success',
          articles: cachedArticles,
          articlesBeforeFilter: cachedArticles.length,
          articlesAfterFilter: cachedArticles.length,
          cacheHit: true,
          retryCount: 0,
          durationMs: Date.now() - startedAt,
        };
      }
      logger.debug('rss-cache', `Cache miss for ${source.id}`, { cacheKey });
    } catch (error) {
      logger.warn('rss-cache', `Redis read failed for ${source.id}. Falling back to live fetch.`, {
        error: error instanceof Error ? error.message : error,
      });
    }
  } else {
    logger.debug('rss-cache', `Redis disabled, skipping cache for ${source.id}`);
  }

  logger.info('rss-fetch', `Executing live fetch with retry for ${source.id}`, {
    maxRetries: 1,
    retryDelayMs: 2000,
  });

  let retryCount = 0;
  let liveResult: FeedLiveResult;

  try {
    liveResult = await executeWithRetry(
      async () => {
        try {
          return await fetchFeedLive(source, logger);
        } catch (error) {
          logger.warn('rss-fetch', `Failed to fetch source ${source.id}`, {
            feedUrl: source.feedUrl,
            error: error instanceof Error ? error.message : error,
          });
          throw error;
        }
      },
      {
        maxRetries: 1,
        retryDelayMs: 2000,
        isRetryable: (error) => {
          const message = String(error instanceof Error ? error.message : error).toLowerCase();
          return /timeout|network|econnreset|econnrefused|etimedout/.test(message);
        },
        onRetry: (attempt, error) => {
          retryCount = attempt;
          logger.warn('rss-retry', `Retrying feed ${source.id} (attempt ${attempt})`, {
            error: error instanceof Error ? error.message : error,
          });
        },
      }
    );
  } catch (error) {
    return {
      sourceId: source.id,
      sourceName: source.name,
      status: 'failed',
      articles: [],
      articlesBeforeFilter: 0,
      articlesAfterFilter: 0,
      cacheHit: false,
      retryCount,
      durationMs: Date.now() - startedAt,
      errorType: classifyRssErrorType(error),
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  if (process.env.REDIS_URL && liveResult.articles.length > 0) {
    try {
      const redis = await getRedisClient();
      await redis.set(cacheKey, JSON.stringify(liveResult.articles), { EX: ttlSeconds });
      logger.info('rss-cache', `Cached live RSS results for ${source.id}`, {
        cacheKey,
        count: liveResult.articles.length,
        ttlSeconds,
      });
    } catch (error) {
      logger.warn('rss-cache', `Redis write failed for ${source.id}. Continuing without cache.`, {
        error: error instanceof Error ? error.message : error,
      });
    }
  } else if (liveResult.articles.length === 0) {
    logger.info('rss-cache', `No articles to cache for ${source.id}`, { cacheKey });
  }

  return {
    sourceId: source.id,
    sourceName: source.name,
    status: 'success',
    articles: liveResult.articles,
    articlesBeforeFilter: liveResult.rawItemCount,
    articlesAfterFilter: liveResult.articles.length,
    cacheHit: false,
    retryCount,
    durationMs: Date.now() - startedAt,
  };
}

export async function fetchRssNews(niches: string[]): Promise<NewsArticle[]> {
  const logger = new Logger();
  const runStartedAt = Date.now();
  const runId = `rss-${runStartedAt}-${Math.random().toString(16).slice(2, 8)}`;
  const sources = getSourcesForNiche(niches);
  let globalTimeoutTriggered = false;

  logger.info('rss', 'Starting RSS workflow', {
    runId,
    niches,
    threshold: TITLE_SIMILARITY_THRESHOLD,
    globalTimeoutMs: GLOBAL_FETCH_TIMEOUT_MS,
    redisEnabled: Boolean(process.env.REDIS_URL),
    ttlOverride: process.env.RSS_CACHE_TTL_SECONDS || null,
  });

  if (sources.length === 0) {
    logger.warn('rss', 'No enabled RSS sources found');
    return [];
  }

  logger.info('rss', `Fetching RSS from ${sources.length} source(s)`, {
    sources: sources.map((source) => source.id),
  });

  const sourceTasks = sources.map(async (source): Promise<SourceFetchResult> => {
    const cooldown = await shouldSkipSourceByCooldown(source.id, logger);
    if (cooldown.shouldSkip) {
      logger.info('rss-health', `Skipping source ${source.id} due to cooldown`, {
        sourceId: source.id,
        cooldownUntil: cooldown.cooldownUntil,
      });
      return {
        sourceId: source.id,
        sourceName: source.name,
        status: 'skipped_cooldown',
        articles: [],
        articlesBeforeFilter: 0,
        articlesAfterFilter: 0,
        cacheHit: false,
        retryCount: 0,
        durationMs: 0,
      };
    }

    return fetchFeedCached(source, logger);
  });

  const allSettledPromise = Promise.allSettled(
    sourceTasks
  );
  let timeoutId: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<PromiseSettledResult<SourceFetchResult>[]>((resolve) => {
    timeoutId = setTimeout(() => {
      globalTimeoutTriggered = true;
      logger.warn('rss', 'RSS global timeout reached before all sources settled', {
        globalTimeoutMs: GLOBAL_FETCH_TIMEOUT_MS,
      });
      resolve([]);
    }, GLOBAL_FETCH_TIMEOUT_MS);
  });

  const settledResults = await Promise.race([allSettledPromise, timeoutPromise]);
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
  const merged: NewsArticle[] = [];
  let fulfilledSources = 0;
  let rejectedSources = 0;
  let skippedSources = 0;
  const telemetryTasks: Promise<unknown>[] = [];

  for (const result of settledResults) {
    if (result.status === 'fulfilled') {
      const sourceResult = result.value;
      merged.push(...sourceResult.articles);

      if (sourceResult.status === 'skipped_cooldown') {
        skippedSources += 1;
      } else if (sourceResult.status === 'failed') {
        rejectedSources += 1;
      } else {
        fulfilledSources += 1;
      }

      telemetryTasks.push(recordRssSourceTelemetry(
        {
          runId,
          sourceId: sourceResult.sourceId,
          sourceName: sourceResult.sourceName,
          status: sourceResult.status,
          articlesBeforeFilter: sourceResult.articlesBeforeFilter,
          articlesAfterFilter: sourceResult.articlesAfterFilter,
          cacheHit: sourceResult.cacheHit,
          retryCount: sourceResult.retryCount,
          durationMs: sourceResult.durationMs,
          errorType: sourceResult.errorType,
          errorMessage: sourceResult.errorMessage,
        },
        logger
      ));

      if (sourceResult.status === 'failed') {
        telemetryTasks.push(noteSourceFetchFailure(
          sourceResult.sourceId,
          sourceResult.errorType ?? 'unknown',
          logger
        ));
      } else if (sourceResult.status === 'success') {
        telemetryTasks.push(noteSourceFetchSuccess(sourceResult.sourceId, logger));
      }

      logger.info('rss-source', `Source ${sourceResult.sourceId} completed`, {
        sourceId: sourceResult.sourceId,
        status: sourceResult.status,
        articleCount: sourceResult.articles.length,
      });
      continue;
    }

    rejectedSources += 1;
    logger.warn('rss', 'Source task failed unexpectedly', {
      reason: result.reason instanceof Error ? result.reason.message : result.reason,
    });
  }

  if (telemetryTasks.length > 0) {
    await Promise.allSettled(telemetryTasks);
  }

  const deduped = crossSourceDedup(merged, logger);
  deduped.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  logger.info('rss', 'RSS workflow complete', {
    runId,
    totalSources: sources.length,
    fulfilledSources,
    rejectedSources,
    skippedSources,
    globalTimeoutTriggered,
    mergedCount: merged.length,
    dedupedCount: deduped.length,
    durationMs: Date.now() - runStartedAt,
  });

  await recordRssRunTelemetry(
    {
      runId,
      niches,
      totalSources: sources.length,
      fulfilledSources,
      failedSources: rejectedSources,
      skippedSources,
      mergedCount: merged.length,
      dedupedCount: deduped.length,
      globalTimeoutTriggered,
      durationMs: Date.now() - runStartedAt,
    },
    logger
  );

  return deduped;
}

export const __testing = {
  titleWordSet,
  jaccardSimilarity,
};
