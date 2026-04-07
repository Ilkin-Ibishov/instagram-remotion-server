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
import { fetchTopNews } from '../src/pipeline/newsService';
import { filterAndRankArticles, selectBestArticle } from '../src/pipeline/newsFiltering';
import { loadAccountProfile, getAccountKeywords } from '../src/pipeline/accountProfile';
import { generatePostContentAI } from '../src/pipeline/aiService';

const mockedFetchTopNews = vi.mocked(fetchTopNews);
const mockedFilterAndRankArticles = vi.mocked(filterAndRankArticles);
const mockedSelectBestArticle = vi.mocked(selectBestArticle);
const mockedLoadAccountProfile = vi.mocked(loadAccountProfile);
const mockedGetAccountKeywords = vi.mocked(getAccountKeywords);
const mockedPublishToInstagram = vi.mocked(publishToInstagram);
const mockedGeneratePostContentAI = vi.mocked(generatePostContentAI);

describe('runPipeline', () => {
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
  });

  it('throws when no relevant articles pass scoring and does not publish', async () => {
    mockedFetchTopNews.mockResolvedValue([
      {
        title: 'Macro economic story',
        description: 'Not relevant to developer niche',
        content: '...',
        url: 'https://example.com/article-1',
        publishedAt: '2026-04-08T00:00:00.000Z',
        source: 'Example',
      },
    ]);
    mockedFilterAndRankArticles.mockReturnValue([]);

    await expect(runPipeline()).rejects.toThrow('No relevant articles found');
    expect(mockedSelectBestArticle).not.toHaveBeenCalled();
    expect(mockedGeneratePostContentAI).not.toHaveBeenCalled();
    expect(mockedPublishToInstagram).not.toHaveBeenCalled();
  });
});
