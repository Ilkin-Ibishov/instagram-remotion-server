import type { NewsArticle } from './types';
import { hasBeenPosted, getRecentPosts } from './postHistory';
import type { AccountProfile } from './accountProfile';
import Logger from '../utils/logger';
import { normalizeArticleUrl } from '../utils/normalizeUrl';

/**
 * News Relevance Scoring System
 * Scores articles based on keyword matches to account profile.
 * Higher score = more relevant to the account's niche and audience.
 */

interface ScoredArticle {
  article: NewsArticle;
  score: number;
  reasons: string[];
  matchedKeywords: Array<{ keyword: string; location: 'title' | 'description'; weight: number }>;
  scoreBreakdown: {
    titleMatches: number;
    descriptionMatches: number;
    baseScore: number;
  };
}

/**
 * Keyword specificity weights.
 * More specific keywords get higher weight to prefer them over generic matches.
 * Prevents false positives like matching "news" in every article.
 */
const KEYWORD_WEIGHTS: Record<string, number> = {
  // Highly specific keywords (strong signals)
  'dev-tools': 15,
  'devtools': 15,
  'software-engineering': 12,
  'startup': 10,
  'developer': 10,
  'developers': 10,
  
  // Specific keywords
  'development': 8,
  'engineering': 8,
  'tools': 7,
  'technology': 6,
  'innovation': 6,
  'insights': 6,
  'software': 5,
  
  // Generic keywords (lower weight to prevent bias)
  'news': 2,                      // Matches any article
  'tech': 3,                      // Too broad
  'dev': 4,                       // Ambiguous
};

/**
 * Get weight for a keyword (higher = more important).
 * Keywords without explicit weight default to 5.
 */
function getKeywordWeight(keyword: string): number {
  return KEYWORD_WEIGHTS[keyword.toLowerCase()] ?? 5;
}

/**
 * Calculate relevance score for an article based on account profile.
 * Considers:
 * - Keyword matches in title (weighted by specificity)
 * - Keyword matches in description (weighted, lower priority than title)
 * - Recent post frequency (penalty if posting too much same niche)
 */
export function scoreArticleRelevance(
  article: NewsArticle,
  accountKeywords: string[],
  recentPostCount: number = 0
): {
  score: number;
  reasons: string[];
  matchedKeywords: Array<{ keyword: string; location: 'title' | 'description'; weight: number }>;
  scoreBreakdown: { titleMatches: number; descriptionMatches: number; baseScore: number };
} {
  let score = 0;
  const reasons: string[] = [];
  const matchedKeywords: Array<{ keyword: string; location: 'title' | 'description'; weight: number }> = [];

  const titleLower = (article.title || '').toLowerCase();
  const descLower = (article.description || '').toLowerCase();

  // Keywords in title (high weight, weighted by specificity)
  let titleScore = 0;
  let titleMatchCount = 0;
  for (const keyword of accountKeywords) {
    if (titleLower.includes(keyword)) {
      const weight = getKeywordWeight(keyword);
      score += weight;
      titleScore += weight;
      titleMatchCount++;
      matchedKeywords.push({ keyword, location: 'title', weight });
    }
  }
  if (titleMatchCount > 0) {
    reasons.push(`${titleMatchCount} keyword(s) in title (+${titleScore})`);
  }

  // Keywords in description (medium weight, but don't double-count)
  let descScore = 0;
  let descMatchCount = 0;
  for (const keyword of accountKeywords) {
    if (descLower.includes(keyword) && !titleLower.includes(keyword)) {
      const weight = Math.ceil(getKeywordWeight(keyword) * 0.6); // Description matches worth 60% of title
      score += weight;
      descScore += weight;
      descMatchCount++;
      matchedKeywords.push({ keyword, location: 'description', weight });
    }
  }
  if (descMatchCount > 0) {
    reasons.push(`${descMatchCount} keyword(s) in description (+${descScore})`);
  }

  // Base relevance score (article exists and has content)
  const baseScore = 5;
  if (article.title && article.description) {
    score += baseScore;
    reasons.push('Has title and description (+5)');
  } else {
    // If missing title/description, still give minimal base score
    score += 1;
  }

  // If posting too frequently from same niche, apply mild penalty (not too aggressive)
  // Only penalize if we have 5+ recent posts (threshold higher than before)
  // And reduce penalty to -5 instead of -10 (prevent over-penalization)
  if (recentPostCount >= 5) {
    score = Math.max(baseScore, score - 5); // Never go below base score
    reasons.push('⚠️ Many recent posts from this niche (-5)');
  }

  return {
    score,
    reasons,
    matchedKeywords,
    scoreBreakdown: {
      titleMatches: titleMatchCount,
      descriptionMatches: descMatchCount,
      baseScore,
    },
  };
}

/**
 * Filter and rank articles by relevance to account profile.
 * Removes:
 * - Already posted articles
 * - Articles with score below minScore threshold
 * Updates scoring based on recent post frequency
 */
export function filterAndRankArticles(
  articles: NewsArticle[],
  accountKeywords: string[],
  logger?: Logger,
  minScore: number = 10
): ScoredArticle[] {
  const recent = getRecentPosts(7); // Last 7 days
  const recentCount = recent.length;

  if (logger) {
    logger.debug('filtering', `Starting filter with ${articles.length} articles`, {
      recentPostsCount: recentCount,
      keywordCount: accountKeywords.length,
      minimumScoreThreshold: minScore,
    });
  }

  const filterResults = {
    total: articles.length,
    skippedDuplicates: 0,
    skippedLowScore: 0,
    passed: 0,
    skippedArticles: [] as Array<{ title: string; reason: string; score?: number }>,
  };

  const filtered = articles
    .filter(article => {
      // Skip already posted articles (normalise URL before checking to handle www/http variants)
      if (hasBeenPosted(normalizeArticleUrl(article.url))) {
        if (logger) {
          logger.debug('filter-duplicates', `Skipping already posted: "${article.title}"`);
        }
        filterResults.skippedDuplicates++;
        filterResults.skippedArticles.push({
          title: article.title,
          reason: 'Already posted',
        });
        return false;
      }
      return true;
    })
    .map(article => {
      const scored = scoreArticleRelevance(article, accountKeywords, recentCount);
      return {
        article,
        score: scored.score,
        reasons: scored.reasons,
        matchedKeywords: scored.matchedKeywords,
        scoreBreakdown: scored.scoreBreakdown,
      };
    })
    .filter(item => {
      if (item.score < minScore) {
        if (logger) {
          const specificityWarning = 
            item.score > 0 && item.scoreBreakdown.titleMatches === 0 && item.scoreBreakdown.descriptionMatches === 0
              ? ' (low-specificity — no keyword matches, only base score)'
              : '';
          logger.debug(
            'filter-score',
            `Filtering out low-score article: "${item.article.title.substring(0, 60)}"${specificityWarning}`,
            { score: item.score, threshold: minScore }
          );
        }
        filterResults.skippedLowScore++;
        filterResults.skippedArticles.push({
          title: item.article.title,
          reason: `Low score (${item.score} < ${minScore})`,
          score: item.score,
        });
        return false;
      }
      filterResults.passed++;
      return true;
    })
    .sort((a, b) => b.score - a.score); // Rank by relevance (highest first)

  if (logger) {
    logger.info(
      'filtering',
      `Filtering complete: ${filterResults.passed} relevant, ${filterResults.skippedDuplicates} duplicates, ${filterResults.skippedLowScore} low-score`,
      {
        ...filterResults,
        scoredArticles: filtered.map(f => ({
          title: f.article.title.substring(0, 60),
          score: f.score,
          matchedKeywords: f.matchedKeywords.map(k => `${k.keyword}(${k.weight})`).join(', '),
          reasons: f.reasons,
        })),
      }
    );
  }

  return filtered;
}

/**
 * Select best article from ranked list.
 * Prefers high-relevance articles, but allows some variation to keep feed diverse.
 */
export function selectBestArticle(
  scoredArticles: ScoredArticle[],
  strategy: 'top' | 'diverse' = 'top',
  logger?: Logger
): ScoredArticle | null {
  if (scoredArticles.length === 0) {
    if (logger) {
      logger.warn('selection', 'No relevant articles available for selection');
    }
    return null;
  }

  if (strategy === 'top') {
    // Always pick highest relevance
    const selected = scoredArticles[0];
    if (logger) {
      const matchedKeywordsList = selected.matchedKeywords
        .map(k => `'${k.keyword}'(+${k.weight})`)
        .join(', ');
      logger.debug('selection', `Selected top article (strategy: ${strategy})`, {
        selectedTitle: selected.article.title.substring(0, 80),
        score: selected.score,
        matchedKeywords: matchedKeywordsList || 'none',
        scoreBreakdown: selected.scoreBreakdown,
        totalCandidates: scoredArticles.length,
      });
    }
    return selected;
  } else {
    // Diverse strategy: pick from top 3 but with slight randomness
    const topN = Math.min(3, scoredArticles.length);
    const selected = scoredArticles[Math.floor(Math.random() * topN)];
    if (logger) {
      logger.debug('selection', `Selected from top ${topN} articles (strategy: ${strategy})`, {
        selectedTitle: selected.article.title.substring(0, 80),
        score: selected.score,
        topNScores: scoredArticles.slice(0, topN).map(a => ({ score: a.score, title: a.article.title.substring(0, 40) })),
      });
    }
    return selected;
  }
}

/**
 * Debug helper: Print scoring results to console AND return as structured data
 * Now includes detailed keyword match information
 */
export function printScoringResults(scored: ScoredArticle[], logger?: Logger): void {
  if (scored.length === 0) {
    console.log('[scoring] No relevant articles found!');
    if (logger) {
      logger.warn('scoring', 'No relevant articles found');
    }
    return;
  }

  console.log(`\n[scoring] 📊 Ranked ${scored.length} relevant articles:\n`);

  const scoredSummary = scored.slice(0, 10).map((item, idx) => {
    const keywordsSummary = item.matchedKeywords
      .map(k => `${k.keyword}(${k.location},+${k.weight})`)
      .join(' ');
    
    const line = `  ${idx + 1}. [${item.score}] "${item.article.title.substring(0, 70)}"`;
    console.log(line);
    console.log(`     Keywords: ${keywordsSummary || '(none)'}`);
    console.log(`     ${item.reasons.join(' → ')}`);

    return {
      rank: idx + 1,
      score: item.score,
      title: item.article.title.substring(0, 80),
      matchedKeywords: item.matchedKeywords,
      scoreBreakdown: item.scoreBreakdown,
      reasons: item.reasons,
    };
  });

  console.log('');

  if (logger) {
    logger.info('scoring', `Ranked ${scored.length} relevant articles`, {
      topArticles: scoredSummary,
    });
  }
}
