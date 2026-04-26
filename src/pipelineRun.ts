import { publishToInstagram } from './automation/instagramPublisher';
import { generateContent } from './pipeline/contentGenerator';
import { fetchTopNews, fetchSearchNews } from './pipeline/newsService';
import { fetchRssNews } from './pipeline/rssService';
import { filterAndRankArticles, selectBestArticle, printScoringResults } from './pipeline/newsFiltering';
import { isPostgresPostHistory, recordPost } from './pipeline/postHistory';
import { loadAccountProfile, getAccountKeywords } from './pipeline/accountProfile';
import type { GeneratedContent, InstagramPublishResult, NewsArticle, PublishablePost } from './pipeline/types';
import path from 'path';
import Logger from './utils/logger';
import { closeTelemetryPool } from './pipeline/rssTelemetryStore';
import { renderManifest, validateRenderManifest, type RenderManifestInput } from './render/renderService';
import {
  buildPublishedPostContext,
  recordFailedPost,
  recordGeneratedPost,
  recordPublishedPost,
  recordPublishStartedPost,
  recordRenderedPost,
  recordSelectedPost,
} from './pipeline/publishedPostStore';
import { computePostQualityMetrics } from './pipeline/publishedPostMetrics';
import * as dotenv from 'dotenv';
import { pathToFileURL } from 'url';

dotenv.config();

const RENDER_FORMAT = process.env.RENDER_FORMAT || 'mp4';
const NEWS_CATEGORY = process.env.NEWS_CATEGORY || 'technology';
const MIN_RELEVANCE_SCORE = parseInt(process.env.MIN_RELEVANCE_SCORE || '10', 10);

export type PipelineRunResult =
  | {
      status: 'skipped_no_articles';
      category: string;
      minRelevanceScore: number;
    }
  | {
      status: 'published';
      article: NewsArticle;
      articleUrl: string;
      content: GeneratedContent;
      slides: RenderManifestInput['carousel'];
      mediaPaths: string[];
      renderUrls: string[];
      post: PublishablePost;
      caption: string;
      hashtags: string;
      postId: string;
      publishResult: InstagramPublishResult;
    };

/**
 * Renders the given manifest in-process using the shared render service.
 * Returns an array of relative API asset paths.
 */
async function renderMedia(manifest: any, format: string = 'mp4', signal?: AbortSignal): Promise<string[]> {
  const logger = new Logger();
  logger.info('render', `Rendering manifest in-process (format: ${format})`);

  const validation = validateRenderManifest({
    ...manifest,
    format,
  });

  if (validation.error || !validation.normalized) {
    throw new Error(`Render failed: ${validation.error ?? 'invalid manifest format'}`);
  }

  const result = await renderManifest(validation.normalized as RenderManifestInput, undefined, signal);
  return result.images;
}

export async function runPipelineWithResult(signal?: AbortSignal): Promise<PipelineRunResult> {
  const logger = new Logger();
  const accountProfile = loadAccountProfile();
  const accountKeywords = getAccountKeywords(accountProfile);
  const useRssFeeds = process.env.USE_RSS_FEEDS !== 'false';
  const batchId = `batch-${Date.now()}`;
  const publishedPostContext = buildPublishedPostContext(batchId);
  let rssFetchFailed = false;
  let currentStage: 'selection' | 'generation' | 'render' | 'publish' | 'unknown' = 'unknown';
  
  try {
    signal?.throwIfAborted();
    logger.info('pipeline', `--- Step 0: Fetching News (${useRssFeeds ? 'RSS primary + GNews fallback' : `GNews category: ${NEWS_CATEGORY}`}) ---`);
    logger.info('pipeline', `Account: ${accountProfile.handle} | Niche: ${accountProfile.niche.join(', ')}`);

    let articles: NewsArticle[] = [];
    if (useRssFeeds) {
      try {
        articles = await fetchRssNews(accountProfile.niche);
        logger.info('news-fetch', `RSS fetched ${articles.length} articles`, { count: articles.length });
      } catch (error) {
        logger.warn('pipeline', 'RSS fetch failed entirely; falling back to GNews.', {
          error: error instanceof Error ? error.message : error,
        });
        rssFetchFailed = true;
        articles = [];
      }
    } else {
      articles = await fetchTopNews(NEWS_CATEGORY);
      logger.info('news-fetch', `GNews fetched ${articles.length} articles from API`, { count: articles.length });
    }

    // Log keyword extraction
    logger.info('pipeline', '--- Step 0a: Extract Keywords from Account ---');
    
    logger.debug('keywords', 'Extracted keywords', {
      nicheKeywords: accountProfile.niche,
      bioLength: accountProfile.bio.length,
      totalKeywords: accountKeywords.length,
      allKeywords: accountKeywords,
    });

    // Step 1: Filter & rank articles by relevance to account profile
    logger.info('pipeline', '--- Step 0b: Filtering & Ranking Articles ---');
    logger.info('filtering-config', `Using minimum relevance score: ${MIN_RELEVANCE_SCORE}`, {
      minScore: MIN_RELEVANCE_SCORE,
      explanation: 'Articles must score ≥ this to be selected. Score = keyword matches (weighted by specificity) + 5 base points',
    });
    
    let scoredArticles =
      articles.length > 0
        ? (await filterAndRankArticles(articles, accountKeywords, logger, MIN_RELEVANCE_SCORE)) ?? []
        : [];
    if (articles.length > 0) {
      printScoringResults(scoredArticles, logger);
    }

    // Trigger top-headlines fallback when RSS failed entirely or produced no relevant articles.
    if (useRssFeeds && (rssFetchFailed || scoredArticles.length === 0)) {
      logger.info(
        'pipeline',
        `--- Step 0c: Top-Headlines Fallback (${rssFetchFailed ? 'RSS fetch failed' : 'no relevant articles from RSS'}) ---`
      );
      articles = await fetchTopNews(NEWS_CATEGORY);
      logger.info('news-fetch', `GNews fetched ${articles.length} articles from API`, { count: articles.length });
      scoredArticles =
        (await filterAndRankArticles(articles, accountKeywords, logger, MIN_RELEVANCE_SCORE)) ?? [];
      printScoringResults(scoredArticles, logger);
    }

    // Fallback: current source yielded 0 relevant results → retry with a keyword search
    if (scoredArticles.length === 0) {
      logger.info('pipeline', '--- Step 0d: Search Fallback (no relevant results from primary/top-headlines fetch) ---');
      const searchQuery = accountProfile.niche.map(k => k.replace(/-/g, ' ')).join(' OR ');
      logger.info('search-fallback', `Searching GNews with niche keywords: "${searchQuery}"`);
      const searchArticles = await fetchSearchNews(searchQuery, { sortby: 'relevance' });
      logger.info('news-fetch', `Search fallback fetched ${searchArticles.length} articles`, { count: searchArticles.length });
      scoredArticles =
        (await filterAndRankArticles(searchArticles, accountKeywords, logger, MIN_RELEVANCE_SCORE)) ?? [];
      printScoringResults(scoredArticles, logger);
    }

    if (scoredArticles.length === 0) {
      logger.info(
        'pipeline',
        'No articles available for posting after RSS/GNews fetch and search fallback. All candidates were filtered out (low relevance score vs threshold, already posted, repetitive topic, or lost atomic URL claim). Skipping AI, render, and publish.',
        {
          category: NEWS_CATEGORY,
          minRelevanceScore: MIN_RELEVANCE_SCORE,
        }
      );
      return {
        status: 'skipped_no_articles',
        category: NEWS_CATEGORY,
        minRelevanceScore: MIN_RELEVANCE_SCORE,
      };
    }

    signal?.throwIfAborted();
    // Select from top N with randomness (strategy: "diverse" in newsFiltering)
    const selectedArticleItem = selectBestArticle(scoredArticles, 'diverse', logger);
    
    if (!selectedArticleItem) {
      throw new Error('No articles available to post');
    }

    const article = selectedArticleItem.article;
    currentStage = 'selection';
    logger.info(
      'news-selection',
      `Selected: "${article.title}"`,
      { 
        relevanceScore: selectedArticleItem.score,
        reasons: selectedArticleItem.reasons,
        source: article.source 
      }
    );
    logger.info('pipeline', `Selected article (score: ${selectedArticleItem.score}): "${article.title}"`);
    await recordSelectedPost(publishedPostContext, selectedArticleItem);

    // ── BUG-001 FIX: Dedup guard BEFORE AI transformation ──────────────────
    // File store: recordPost inserts a new row (URL + fingerprint) before Gemini runs.
    // Postgres: filterAndRankArticles() already claimed normalized_url; recordPost
    // upserts title/batch/fingerprint onto that row (ON CONFLICT DO UPDATE).
    // ────────────────────────────────────────────────────────────────────────
    await recordPost(article, `${batchId}-pre-gen`);
    logger.info(
      'history',
      `${isPostgresPostHistory() ? 'Postgres pre-gen upsert' : 'Pre-generation dedup record'}: "${article.title}"`,
      { batchId }
    );

    signal?.throwIfAborted();
    currentStage = 'generation';
    logger.info('pipeline', '--- Step 1: AI Content Generation ---');
    const aiData = await generateContent(article, accountProfile, signal);
    const qualityMetrics = computePostQualityMetrics(article, aiData);
    await recordGeneratedPost(publishedPostContext, article, aiData, qualityMetrics);
    logger.info('ai-generation', `Generated ${aiData.manifest.carousel.length} slides with account context`, {
      account: accountProfile.handle,
      slideCount: aiData.manifest.carousel.length,
    });
    
    // Validate that all slides have populated data
    let hasEmptySlides = false;
    aiData.manifest.carousel.forEach((slide, index) => {
      if (!slide.data || Object.keys(slide.data).length === 0) {
        logger.warn('ai-generation', `⚠️ EMPTY DATA: Slide ${index} (${slide.templateId}) has no data object!`);
        hasEmptySlides = true;
      }
    });
    
    // BUG-001 FIX: Hard block on empty slides — don't publish blank content
    if (hasEmptySlides) {
      const errorMsg = `AI returned ${aiData.manifest.carousel.filter((s: any) => !s.data || Object.keys(s.data).length === 0).length} empty slides. Aborting pipeline — would publish blank content.`;
      logger.error('ai-generation', '❌ CRITICAL: ' + errorMsg, {
        carousel: aiData.manifest.carousel,
      });
      throw new Error(errorMsg);
    }
    
    // Debug: Log the full manifest for inspection
    logger.debug('ai-generation', 'Full manifest:', aiData.manifest);
    logger.debug('ai-generation', 'Caption:', aiData.caption);
    logger.debug('ai-generation', 'Hashtags:', aiData.hashtags);

    signal?.throwIfAborted();
    currentStage = 'render';
    logger.info('pipeline', `--- Step 2: Rendering (Format: ${RENDER_FORMAT}) ---`);
    // Ensure the server is running on port 3000 before executing this script!
    const localFileUrls = await renderMedia(aiData.manifest, RENDER_FORMAT, signal);
    
    // The server returns URLs like `/api/renders/render-xyz-0.png` or `/api/renders/render-xyz-0.mp4`
    // Map these back to actual file paths
    const mediaPaths = localFileUrls.map(url => {
        const filename = url.split('/').pop();
        if (!filename) throw new Error("Invalid output URL from renderer");
        const localDir = process.platform === 'win32' ? 'C:/tmp/renders' : '/tmp/renders';
        return path.resolve(localDir, filename);
    });
    
    logger.info('rendering', 'Render complete', { media_count: mediaPaths.length, format: RENDER_FORMAT });
    logger.debug('rendering', 'Rendered media paths:', mediaPaths);
    await recordRenderedPost(publishedPostContext, {
      renderFormat: RENDER_FORMAT,
      renderUrls: localFileUrls,
      mediaPaths,
      mediaCount: mediaPaths.length,
    });

    logger.info('pipeline', '--- Step 3: Assembly ---');
    const post: PublishablePost = {
      id: `post_${Date.now()}`,
      mediaPaths: mediaPaths,
      caption: `${aiData.caption}\n\n${aiData.hashtags}`,
      isCarousel: mediaPaths.length > 1,
    };
    
    logger.debug('assembly', 'Assembled post:', post);

    signal?.throwIfAborted();
    currentStage = 'publish';
    logger.info('pipeline', '--- Step 4: Publishing to Instagram ---');
    // Uncomment this line to actually publish to Instagram.
    // Make sure storage.json has valid session!
    await recordPublishStartedPost(publishedPostContext, post);
    const publishResult = await publishToInstagram(post, signal);
    
    logger.info('publishing', 'Publish completed successfully');
    logger.info('pipeline', `✅ Pipeline completed successfully!\n📊 Logs: ${logger.getLogPath()}`);
    await recordPublishedPost(publishedPostContext, publishResult);

    return {
      status: 'published',
      article,
      articleUrl: article.url,
      content: aiData,
      slides: aiData.manifest.carousel,
      mediaPaths,
      renderUrls: localFileUrls,
      post,
      caption: aiData.caption,
      hashtags: aiData.hashtags,
      postId: post.id ?? '',
      publishResult,
    };

  } catch (error) {
    logger.error('pipeline', 'Pipeline failed', error);
    await recordFailedPost(publishedPostContext, currentStage, error);
    throw error;
  } finally {
    if (process.env.SERVER_MODE !== 'true') {
      try {
        await closeTelemetryPool();
      } catch (closeError) {
        logger.warn('rss-telemetry', 'Failed to close telemetry pool after pipeline run', {
          error: closeError instanceof Error ? closeError.message : closeError,
        });
      }
    }
  }
}

export async function runPipeline(signal?: AbortSignal): Promise<void> {
  await runPipelineWithResult(signal);
}

// Run the pipeline when executed directly from CLI.
const isDirectExecution = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isDirectExecution) {
  runPipeline().catch(() => {
    process.exit(1);
  });
}
