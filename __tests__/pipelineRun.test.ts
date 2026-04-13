import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/utils/logger', () => {
  class MockLogger {
    info = vi.fn();
    warn = vi.fn();
    error = vi.fn();
    debug = vi.fn();
    getLogPath = vi.fn(() => 'logs/test.log.json');
  }

  return { default: MockLogger };
});

vi.mock('../src/automation/instagramPublisher', () => ({
  publishToInstagram: vi.fn(),
}));

vi.mock('../src/pipeline/contentGenerator', () => ({
  generateContent: vi.fn(),
}));

vi.mock('../src/pipeline/newsService', () => ({
  fetchTopNews: vi.fn(),
  fetchSearchNews: vi.fn(),
}));

vi.mock('../src/pipeline/rssService', () => ({
  fetchRssNews: vi.fn(),
}));

vi.mock('../src/pipeline/newsFiltering', () => ({
  filterAndRankArticles: vi.fn(),
  selectBestArticle: vi.fn(),
  printScoringResults: vi.fn(),
}));

vi.mock('../src/pipeline/postHistory', () => ({
  recordPost: vi.fn(),
}));

vi.mock('../src/pipeline/accountProfile', () => ({
  loadAccountProfile: vi.fn(),
  getAccountKeywords: vi.fn(),
}));

vi.mock('../src/pipeline/aiService', () => ({
  generatePostContentAI: vi.fn(),
}));

vi.mock('../src/render/renderService', () => ({
  renderManifest: vi.fn(),
  validateRenderManifest: vi.fn((payload: unknown) => ({ error: null, normalized: payload })),
}));

import { runPipeline } from '../src/pipelineRun';
import { publishToInstagram } from '../src/automation/instagramPublisher';
import { fetchTopNews, fetchSearchNews } from '../src/pipeline/newsService';
import { fetchRssNews } from '../src/pipeline/rssService';
import { filterAndRankArticles, selectBestArticle } from '../src/pipeline/newsFiltering';
import { loadAccountProfile, getAccountKeywords } from '../src/pipeline/accountProfile';
import { generateContent } from '../src/pipeline/contentGenerator';
import { renderManifest } from '../src/render/renderService';

const mockedFetchTopNews = vi.mocked(fetchTopNews);
const mockedFetchSearchNews = vi.mocked(fetchSearchNews);
const mockedFetchRssNews = vi.mocked(fetchRssNews);
const mockedFilterAndRankArticles = vi.mocked(filterAndRankArticles);
const mockedSelectBestArticle = vi.mocked(selectBestArticle);
const mockedLoadAccountProfile = vi.mocked(loadAccountProfile);
const mockedGetAccountKeywords = vi.mocked(getAccountKeywords);
const mockedPublishToInstagram = vi.mocked(publishToInstagram);
const mockedGenerateContent = vi.mocked(generateContent);
const mockedRenderManifest = vi.mocked(renderManifest);

describe('runPipeline', () => {
  const mockArticle = {
    title: 'Dev tools article',
    description: 'A startup built a new developer tool',
    content: '...',
    url: 'https://example.com/dev-tools',
    imageUrl: 'https://example.com/img.jpg',
    publishedAt: '2026-04-08T00:00:00.000Z',
    source: 'Example',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USE_RSS_FEEDS = 'true';

    mockedLoadAccountProfile.mockReturnValue({
      handle: '@theinitial.dev',
      displayName: 'The Initial Dev',
      bio: 'Tech news, dev tools, startup insights for developers',
      niche: ['technology', 'development', 'startup'],
      accentColor: '#3b82f6',
      effects: ['vignette'],
    });
    mockedGetAccountKeywords.mockReturnValue(['technology', 'development', 'startup']);
    mockedFetchRssNews.mockResolvedValue([]);
    // Default: search fallback also returns nothing (overridden per test as needed)
    mockedFetchSearchNews.mockResolvedValue([]);
    mockedRenderManifest.mockResolvedValue({ images: ['/api/renders/render-test-0.png'], batchId: 'render-test' } as any);
  });

  it('uses RSS as primary source when available and does not call GNews top fetch', async () => {
    const scoredArticle = {
      article: mockArticle,
      score: 15,
      reasons: ['startup in title'],
      matchedKeywords: [],
      scoreBreakdown: { titleMatches: 1, descriptionMatches: 0, baseScore: 5 },
    };

    mockedFetchRssNews.mockResolvedValue([mockArticle]);
    mockedFilterAndRankArticles.mockReturnValue([scoredArticle]);
    mockedSelectBestArticle.mockReturnValue(scoredArticle);
    mockedGenerateContent.mockResolvedValue({
      manifest: {
        globalBranding: { accentColor: '#3b82f6', handle: '@theinitial.dev', effects: ['vignette'] },
        carousel: [],
      },
      caption: 'This is a strong enough caption for the pipeline quality gate to accept.',
      hashtags: '#test #developers #automation',
    } as any);

    await runPipeline();

    expect(mockedFetchRssNews).toHaveBeenCalledOnce();
    expect(mockedFetchTopNews).not.toHaveBeenCalled();
    expect(mockedRenderManifest).toHaveBeenCalledOnce();
    expect(mockedPublishToInstagram).toHaveBeenCalledOnce();
  });

  it('falls back to GNews when RSS primary fetch throws', async () => {
    const scoredArticle = {
      article: mockArticle,
      score: 15,
      reasons: ['startup in title'],
      matchedKeywords: [],
      scoreBreakdown: { titleMatches: 1, descriptionMatches: 0, baseScore: 5 },
    };

    mockedFetchRssNews.mockRejectedValue(new Error('RSS failed'));
    mockedFetchTopNews.mockResolvedValue([mockArticle]);
    mockedFilterAndRankArticles
      .mockReturnValueOnce([scoredArticle]);
    mockedSelectBestArticle.mockReturnValue(scoredArticle);
    mockedGenerateContent.mockResolvedValue({
      manifest: {
        globalBranding: { accentColor: '#3b82f6', handle: '@theinitial.dev', effects: ['vignette'] },
        carousel: [],
      },
      caption: 'This is a strong enough caption for the pipeline quality gate to accept.',
      hashtags: '#test #developers #automation',
    } as any);

    await runPipeline();

    expect(mockedFetchRssNews).toHaveBeenCalledOnce();
    expect(mockedFetchTopNews).toHaveBeenCalledOnce();
    expect(mockedPublishToInstagram).toHaveBeenCalledOnce();
  });

  it('falls back to GNews top-headlines when RSS returns only irrelevant articles', async () => {
    const scoredArticle = {
      article: mockArticle,
      score: 15,
      reasons: ['startup in title'],
      matchedKeywords: [],
      scoreBreakdown: { titleMatches: 1, descriptionMatches: 0, baseScore: 5 },
    };

    mockedFetchRssNews.mockResolvedValue([mockArticle]);
    mockedFetchTopNews.mockResolvedValue([mockArticle]);
    mockedFilterAndRankArticles
      .mockReturnValueOnce([])
      .mockReturnValueOnce([scoredArticle]);
    mockedSelectBestArticle.mockReturnValue(scoredArticle);
    mockedGenerateContent.mockResolvedValue({
      manifest: {
        globalBranding: { accentColor: '#3b82f6', handle: '@theinitial.dev', effects: ['vignette'] },
        carousel: [],
      },
      caption: 'This is a strong enough caption for the pipeline quality gate to accept.',
      hashtags: '#test #developers #automation',
    } as any);

    await runPipeline();

    expect(mockedFetchRssNews).toHaveBeenCalledOnce();
    expect(mockedFetchTopNews).toHaveBeenCalledOnce();
    expect(mockedFetchSearchNews).not.toHaveBeenCalled();
  });

  it('bypasses RSS when USE_RSS_FEEDS is false and uses GNews directly', async () => {
    process.env.USE_RSS_FEEDS = 'false';
    const scoredArticle = {
      article: mockArticle,
      score: 15,
      reasons: ['startup in title'],
      matchedKeywords: [],
      scoreBreakdown: { titleMatches: 1, descriptionMatches: 0, baseScore: 5 },
    };

    mockedFetchTopNews.mockResolvedValue([mockArticle]);
    mockedFilterAndRankArticles.mockReturnValue([scoredArticle]);
    mockedSelectBestArticle.mockReturnValue(scoredArticle);
    mockedGenerateContent.mockResolvedValue({
      manifest: {
        globalBranding: { accentColor: '#3b82f6', handle: '@theinitial.dev', effects: ['vignette'] },
        carousel: [],
      },
      caption: 'This is a strong enough caption for the pipeline quality gate to accept.',
      hashtags: '#test #developers #automation',
    } as any);

    await runPipeline();

    expect(mockedFetchRssNews).not.toHaveBeenCalled();
    expect(mockedFetchTopNews).toHaveBeenCalledOnce();
  });

  it('throws when no relevant articles pass scoring and does not publish', async () => {
    mockedFetchTopNews.mockResolvedValue([mockArticle]);
    // Both top-headlines pass and search fallback return nothing relevant
    mockedFilterAndRankArticles.mockReturnValue([]);

    await expect(runPipeline()).rejects.toThrow('No relevant articles found');
    expect(mockedFetchSearchNews).toHaveBeenCalledOnce();
    expect(mockedSelectBestArticle).not.toHaveBeenCalled();
    expect(mockedGenerateContent).not.toHaveBeenCalled();
    expect(mockedPublishToInstagram).not.toHaveBeenCalled();
  });

  it('uses search fallback when RSS and top-headlines yield no relevant articles', async () => {
    const scoredArticle = { article: mockArticle, score: 15, reasons: ['startup in title'], matchedKeywords: [], scoreBreakdown: { titleMatches: 10, descriptionMatches: 0, baseScore: 5 } };
    mockedFetchRssNews.mockResolvedValue([]);
    mockedFetchTopNews.mockResolvedValue([mockArticle]);
    // First call (top-headlines) -> no results; second call (search) -> match
    mockedFilterAndRankArticles
      .mockReturnValueOnce([])
      .mockReturnValueOnce([scoredArticle]);
    mockedFetchSearchNews.mockResolvedValue([mockArticle]);
    mockedSelectBestArticle.mockReturnValue(scoredArticle);
    mockedGenerateContent.mockResolvedValue({
      manifest: {
        globalBranding: { accentColor: '#3b82f6', handle: '@theinitial.dev', effects: ['vignette'] },
        carousel: [],
      },
      caption: 'This is a strong enough caption for the pipeline quality gate to accept.',
      hashtags: '#test #developers #automation',
    });

    await runPipeline().catch(() => {}); // may fail at publish step — that's fine

    expect(mockedFetchSearchNews).toHaveBeenCalledOnce();
    expect(mockedFetchSearchNews).toHaveBeenCalledWith(
      'technology OR development OR startup',
      { sortby: 'relevance' }
    );
    // filterAndRankArticles called twice: top-headlines fallback, then search fallback
    expect(mockedFilterAndRankArticles).toHaveBeenCalledTimes(2);
  });

  it('throws a clear error when article selection returns null', async () => {
    const scoredArticle = {
      article: mockArticle,
      score: 15,
      reasons: ['startup in title'],
      matchedKeywords: [],
      scoreBreakdown: { titleMatches: 1, descriptionMatches: 0, baseScore: 5 },
    };

    mockedFetchRssNews.mockResolvedValue([mockArticle]);
    mockedFilterAndRankArticles.mockReturnValue([scoredArticle]);
    mockedSelectBestArticle.mockReturnValue(null);

    await expect(runPipeline()).rejects.toThrow('No articles available to post');
    expect(mockedGenerateContent).not.toHaveBeenCalled();
    expect(mockedPublishToInstagram).not.toHaveBeenCalled();
  });

  it('bubbles content quality gate failures before rendering or publishing', async () => {
    const scoredArticle = {
      article: mockArticle,
      score: 15,
      reasons: ['startup in title'],
      matchedKeywords: [],
      scoreBreakdown: { titleMatches: 1, descriptionMatches: 0, baseScore: 5 },
    };

    mockedFetchRssNews.mockResolvedValue([mockArticle]);
    mockedFilterAndRankArticles.mockReturnValue([scoredArticle]);
    mockedSelectBestArticle.mockReturnValue(scoredArticle);
    mockedGenerateContent.mockRejectedValue(new Error('Content quality score 2/5 below minimum 4'));

    await expect(runPipeline()).rejects.toThrow('Content quality score 2/5 below minimum 4');
    expect(mockedPublishToInstagram).not.toHaveBeenCalled();
  });
});
