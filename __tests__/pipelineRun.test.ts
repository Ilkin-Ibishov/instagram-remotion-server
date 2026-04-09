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

import { runPipeline } from '../src/pipelineRun';
import { publishToInstagram } from '../src/automation/instagramPublisher';
import { fetchTopNews, fetchSearchNews } from '../src/pipeline/newsService';
import { filterAndRankArticles, selectBestArticle } from '../src/pipeline/newsFiltering';
import { loadAccountProfile, getAccountKeywords } from '../src/pipeline/accountProfile';
import { generatePostContentAI } from '../src/pipeline/aiService';

const mockedFetchTopNews = vi.mocked(fetchTopNews);
const mockedFetchSearchNews = vi.mocked(fetchSearchNews);
const mockedFilterAndRankArticles = vi.mocked(filterAndRankArticles);
const mockedSelectBestArticle = vi.mocked(selectBestArticle);
const mockedLoadAccountProfile = vi.mocked(loadAccountProfile);
const mockedGetAccountKeywords = vi.mocked(getAccountKeywords);
const mockedPublishToInstagram = vi.mocked(publishToInstagram);
const mockedGeneratePostContentAI = vi.mocked(generatePostContentAI);

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

    mockedLoadAccountProfile.mockReturnValue({
      handle: '@theinitial.dev',
      displayName: 'The Initial Dev',
      bio: 'Tech news, dev tools, startup insights for developers',
      niche: ['technology', 'development', 'startup'],
      accentColor: '#3b82f6',
      effects: ['vignette'],
    });
    mockedGetAccountKeywords.mockReturnValue(['technology', 'development', 'startup']);
    // Default: search fallback also returns nothing (overridden per test as needed)
    mockedFetchSearchNews.mockResolvedValue([]);
  });

  it('throws when no relevant articles pass scoring and does not publish', async () => {
    mockedFetchTopNews.mockResolvedValue([mockArticle]);
    // Both top-headlines pass and search fallback return nothing relevant
    mockedFilterAndRankArticles.mockReturnValue([]);

    await expect(runPipeline()).rejects.toThrow('No relevant articles found');
    expect(mockedFetchSearchNews).toHaveBeenCalledOnce();
    expect(mockedSelectBestArticle).not.toHaveBeenCalled();
    expect(mockedGeneratePostContentAI).not.toHaveBeenCalled();
    expect(mockedPublishToInstagram).not.toHaveBeenCalled();
  });

  it('uses search fallback when top-headlines yield no relevant articles', async () => {
    const scoredArticle = { article: mockArticle, score: 15, reasons: ['startup in title'], matchedKeywords: [], scoreBreakdown: { titleMatches: 10, descriptionMatches: 0, baseScore: 5 } };
    mockedFetchTopNews.mockResolvedValue([mockArticle]);
    // First call (top-headlines) → no results; second call (search fallback) → match
    mockedFilterAndRankArticles
      .mockReturnValueOnce([])
      .mockReturnValueOnce([scoredArticle]);
    mockedFetchSearchNews.mockResolvedValue([mockArticle]);
    mockedSelectBestArticle.mockReturnValue(scoredArticle);
    mockedGeneratePostContentAI.mockResolvedValue({
      manifest: {
        globalBranding: { accentColor: '#3b82f6', handle: '@theinitial.dev', effects: ['vignette'] },
        carousel: [],
      },
      postCaption: 'Test caption',
    });

    // render + publish are not the focus here — mock them to avoid errors
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, images: ['/tmp/renders/img.png'] }),
    } as Response);

    await runPipeline().catch(() => {}); // may fail at publish step — that's fine

    expect(mockedFetchSearchNews).toHaveBeenCalledOnce();
    expect(mockedFetchSearchNews).toHaveBeenCalledWith(
      'technology OR development OR startup',
      { sortby: 'relevance' }
    );
    // filterAndRankArticles called twice: once for top-headlines, once for search results
    expect(mockedFilterAndRankArticles).toHaveBeenCalledTimes(2);
  });
});
