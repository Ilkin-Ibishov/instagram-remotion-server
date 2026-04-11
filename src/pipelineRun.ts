import { publishToInstagram } from './automation/instagramPublisher';
import { generateContent } from './pipeline/contentGenerator';
import { fetchTopNews, fetchSearchNews } from './pipeline/newsService';
import { fetchRssNews } from './pipeline/rssService';
import { filterAndRankArticles, selectBestArticle, printScoringResults } from './pipeline/newsFiltering';
import { recordPost } from './pipeline/postHistory';
import { loadAccountProfile, getAccountKeywords } from './pipeline/accountProfile';
import type { NewsArticle, PublishablePost } from './pipeline/types';
import path from 'path';
import Logger from './utils/logger';
import { generatePostContentAI } from './pipeline/aiService';
import * as dotenv from 'dotenv';
import { pathToFileURL } from 'url';

dotenv.config();

const RENDER_FORMAT = process.env.RENDER_FORMAT || 'mp4';
const NEWS_CATEGORY = process.env.NEWS_CATEGORY || 'technology';
const MIN_RELEVANCE_SCORE = parseInt(process.env.MIN_RELEVANCE_SCORE || '10', 10);

/**
 * Renders the given manifest by making a local HTTP request to the Remotion server.
 * Sends format parameter to control PNG or MP4 output.
 * Returns an array of relative paths from the server response.
 */
async function renderMedia(manifest: any, format: string = 'mp4'): Promise<string[]> {
  const logger = new Logger();
  logger.info('render', `Sending manifest to local Remotion server for rendering (format: ${format})`);

  const response = await fetch('http://localhost:3000/api/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...manifest,
      format: format, // Pass format to server for MP4 or PNG rendering
    }),
  });

  if (!response.ok) {
    throw new Error(`Render failed: ${await response.text()}`);
  }

  const result = await response.json();

  if (!result.success || !result.images) {
    throw new Error('Render response format is invalid');
  }

  return result.images;
}

export async function runPipeline() {
  const logger = new Logger();
  const accountProfile = loadAccountProfile();
  const accountKeywords = getAccountKeywords(accountProfile);
  const useRssFeeds = process.env.USE_RSS_FEEDS !== 'false';
  const batchId = `batch-${Date.now()}`;
  
  try {
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
    
    let scoredArticles = filterAndRankArticles(articles, accountKeywords, logger, MIN_RELEVANCE_SCORE);
    printScoringResults(scoredArticles, logger);

    // RSS returned articles but none were relevant: retry with top-headlines before search fallback.
    if (useRssFeeds && scoredArticles.length === 0) {
      logger.info('pipeline', '--- Step 0c: Top-Headlines Fallback (RSS yielded no relevant articles) ---');
      articles = await fetchTopNews(NEWS_CATEGORY);
      logger.info('news-fetch', `GNews fetched ${articles.length} articles from API`, { count: articles.length });
      scoredArticles = filterAndRankArticles(articles, accountKeywords, logger, MIN_RELEVANCE_SCORE);
      printScoringResults(scoredArticles, logger);
    }

    // Fallback: current source yielded 0 relevant results → retry with a keyword search
    if (scoredArticles.length === 0) {
      logger.info('pipeline', '--- Step 0d: Search Fallback (no relevant results from primary/top-headlines fetch) ---');
      const searchQuery = accountProfile.niche.map(k => k.replace(/-/g, ' ')).join(' OR ');
      logger.info('search-fallback', `Searching GNews with niche keywords: "${searchQuery}"`);
      const searchArticles = await fetchSearchNews(searchQuery, { sortby: 'relevance' });
      logger.info('news-fetch', `Search fallback fetched ${searchArticles.length} articles`, { count: searchArticles.length });
      scoredArticles = filterAndRankArticles(searchArticles, accountKeywords, logger, MIN_RELEVANCE_SCORE);
      printScoringResults(scoredArticles, logger);
    }

    if (scoredArticles.length === 0) {
      logger.warn('pipeline', `⚠️ No relevant articles found even after search fallback! All articles have score < ${MIN_RELEVANCE_SCORE} or were already posted.`);
      throw new Error(`No relevant articles found for category '${NEWS_CATEGORY}' (threshold: ${MIN_RELEVANCE_SCORE})`);
    }

    // Select best article
    const selectedArticleItem = selectBestArticle(scoredArticles, 'top', logger);
    
    if (!selectedArticleItem) {
      throw new Error('No articles available to post');
    }

    const article = selectedArticleItem.article;
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

    logger.info('pipeline', '--- Step 1: AI Content Generation ---');
    const aiData = await generatePostContentAI(article, accountProfile);
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
    
    if (hasEmptySlides) {
      logger.error('ai-generation', '❌ CRITICAL: One or more slides have empty data. The carousel will render blank.', {
        carousel: aiData.manifest.carousel,
      });
    }
    
    // Debug: Log the full manifest for inspection
    logger.debug('ai-generation', 'Full manifest:', aiData.manifest);
    logger.debug('ai-generation', 'Caption:', aiData.caption);
    logger.debug('ai-generation', 'Hashtags:', aiData.hashtags);

    logger.info('pipeline', `--- Step 2: Rendering (Format: ${RENDER_FORMAT}) ---`);
    // Ensure the server is running on port 3000 before executing this script!
    const localFileUrls = await renderMedia(aiData.manifest, RENDER_FORMAT);
    
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

    logger.info('pipeline', '--- Step 3: Assembly ---');
    const post: PublishablePost = {
      id: `post_${Date.now()}`,
      mediaPaths: mediaPaths,
      caption: `${aiData.caption}\n\n${aiData.hashtags}`,
      isCarousel: mediaPaths.length > 1,
    };
    
    logger.debug('assembly', 'Assembled post:', post);

    logger.info('pipeline', '--- Step 4: Publishing to Instagram ---');
    // Uncomment this line to actually publish to Instagram.
    // Make sure storage.json has valid session!
    await publishToInstagram(post);
    
    // Record this article as posted to prevent duplicates
    recordPost(article, batchId);
    logger.info('history', `Recorded post to history`, { batchId, articleTitle: article.title });
    
    logger.info('publishing', 'Publish completed successfully');
    logger.info('pipeline', `✅ Pipeline completed successfully!\n📊 Logs: ${logger.getLogPath()}`);

  } catch (error) {
    logger.error('pipeline', 'Pipeline failed', error);
    throw error;
  }
}

// Run the pipeline when executed directly from CLI.
// NOTE: Make sure `npm run start` is running in another terminal so the server on port 3000 takes the render request.
const isDirectExecution = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isDirectExecution) {
  runPipeline().catch(() => {
    process.exit(1);
  });
}
