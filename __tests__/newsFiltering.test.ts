import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/pipeline/postHistory', () => ({
  hasBeenPosted: vi.fn(() => false),
  getRecentPosts: vi.fn(() => []),
}));

import { getRecentPosts } from '../src/pipeline/postHistory';

import { filterAndRankArticles, scoreArticleRelevance } from '../src/pipeline/newsFiltering';
import { selectBestArticle } from '../src/pipeline/newsFiltering';

const mockedGetRecentPosts = vi.mocked(getRecentPosts);

describe('newsFiltering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.REPETITION_WINDOW_DAYS;
    delete process.env.REPETITION_THRESHOLD;
    delete process.env.REPETITION_PENALTY;
  });

  it('downranks same-topic articles when recent history repeats the topic', () => {
    process.env.REPETITION_WINDOW_DAYS = '7';
    process.env.REPETITION_THRESHOLD = '3';
    process.env.REPETITION_PENALTY = '25';

    mockedGetRecentPosts.mockReturnValue([
      {
        articleTitle: 'ChatGPT for developers keeps growing',
        articleUrl: 'https://example.com/r1',
        postedAt: '2026-04-10T00:00:00.000Z',
        batchId: 'b1',
      },
      {
        articleTitle: 'ChatGPT workflows for startup teams',
        articleUrl: 'https://example.com/r2',
        postedAt: '2026-04-11T00:00:00.000Z',
        batchId: 'b2',
      },
      {
        articleTitle: 'ChatGPT prompt tuning update',
        articleUrl: 'https://example.com/r3',
        postedAt: '2026-04-12T00:00:00.000Z',
        batchId: 'b3',
      },
    ]);

    const scored = filterAndRankArticles(
      [
        {
          title: 'ChatGPT agent improvements for developers',
          description: 'New GPT release with better coding assistance',
          content: '...',
          url: 'https://example.com/current-chatgpt',
          imageUrl: 'https://example.com/chatgpt.jpg',
          publishedAt: '2026-04-12T01:00:00.000Z',
          source: 'Example',
        },
        {
          title: 'Kubernetes reliability update for infrastructure teams',
          description: 'Platform-level improvements for cluster uptime',
          content: '...',
          url: 'https://example.com/current-kubernetes',
          imageUrl: 'https://example.com/k8s.jpg',
          publishedAt: '2026-04-12T01:00:00.000Z',
          source: 'Example',
        },
      ],
      ['chatgpt', 'kubernetes'],
      undefined,
      -100
    );

    expect(scored).toHaveLength(2);
    expect(scored[0].article.title).toContain('Kubernetes');
    expect(scored[1].article.title).toContain('ChatGPT');
  });

  it('handles null description without throwing in scoring', () => {
    const result = scoreArticleRelevance(
      {
        title: 'Startup tooling update',
        description: null as unknown as string,
        content: '...',
        url: 'https://example.com/startup',
        publishedAt: '2026-04-08T00:00:00.000Z',
        source: 'Example',
      },
      ['startup']
    );

    expect(result.score).toBeGreaterThan(0);
    expect(result.matchedKeywords.some((k) => k.keyword === 'startup')).toBe(true);
  });

  it('does not throw when filtering articles with null description values', () => {
    const scored = filterAndRankArticles(
      [
        {
          title: 'General economy update',
          description: null as unknown as string,
          content: '...',
          url: 'https://example.com/economy',
          publishedAt: '2026-04-08T00:00:00.000Z',
          source: 'Example',
        },
      ],
      ['technology'],
      undefined,
      10
    );

    expect(Array.isArray(scored)).toBe(true);
    expect(scored).toHaveLength(0);
  });

  it('applies -5 score penalty when article has no imageUrl', () => {
    const baseArticle = {
      title: 'Startup tooling update',
      description: 'Latest technology news for startup developers',
      content: '...',
      url: 'https://example.com/startup-with-image',
      publishedAt: '2026-04-08T00:00:00.000Z',
      source: 'Example',
    };

    const withImage = scoreArticleRelevance(
      { ...baseArticle, imageUrl: 'https://example.com/image.jpg' },
      ['startup']
    );

    const withoutImage = scoreArticleRelevance(
      { ...baseArticle, url: 'https://example.com/startup-no-image', imageUrl: undefined },
      ['startup']
    );

    expect(withImage.score - withoutImage.score).toBe(5);
  });

  it('diverse strategy always selects from top-3 candidates', () => {
    const articles = [
      { score: 10, article: { url: 'a', title: 'a' }, matchedKeywords: [], scoreBreakdown: { titleMatches: 0, descriptionMatches: 0, baseScore: 5 }, reasons: [] },
      { score: 8, article: { url: 'b', title: 'b' }, matchedKeywords: [], scoreBreakdown: { titleMatches: 0, descriptionMatches: 0, baseScore: 5 }, reasons: [] },
      { score: 6, article: { url: 'c', title: 'c' }, matchedKeywords: [], scoreBreakdown: { titleMatches: 0, descriptionMatches: 0, baseScore: 5 }, reasons: [] },
      { score: 1, article: { url: 'd', title: 'd' }, matchedKeywords: [], scoreBreakdown: { titleMatches: 0, descriptionMatches: 0, baseScore: 5 }, reasons: [] },
    ] as any;

    for (let i = 0; i < 10; i++) {
      const selected = selectBestArticle(articles, 'diverse');
      expect(['a', 'b', 'c']).toContain(selected?.article.url);
    }
  });

  it('applies default -20 repetition penalty when REPETITION_PENALTY env var is not set', () => {
    // No env vars set — uses defaults: threshold=3, penalty=20
    const article = {
      title: 'ChatGPT latest model release',
      description: 'Details on the newest ChatGPT model',
      content: '...',
      url: 'https://example.com/chatgpt-new',
      imageUrl: 'https://example.com/img.jpg',
      publishedAt: '2026-04-12T00:00:00.000Z',
      source: 'Example',
    };
    const keywords = ['chatgpt'];

    const withoutRepetition = scoreArticleRelevance(article, keywords, 0);
    const withRepetition = scoreArticleRelevance(article, keywords, 3); // at threshold

    expect(withoutRepetition.score - withRepetition.score).toBe(20);
    expect(withRepetition.reasons.some((r) => r.includes('repetition'))).toBe(true);
  });

  it('diverse strategy returns null for empty list', () => {
    expect(selectBestArticle([], 'diverse')).toBeNull();
  });

  it('diverse strategy respects injected random function', () => {
    const articles = [
      { score: 10, article: { url: 'a', title: 'a' }, matchedKeywords: [], scoreBreakdown: { titleMatches: 0, descriptionMatches: 0, baseScore: 5 }, reasons: [] },
      { score: 8, article: { url: 'b', title: 'b' }, matchedKeywords: [], scoreBreakdown: { titleMatches: 0, descriptionMatches: 0, baseScore: 5 }, reasons: [] },
      { score: 6, article: { url: 'c', title: 'c' }, matchedKeywords: [], scoreBreakdown: { titleMatches: 0, descriptionMatches: 0, baseScore: 5 }, reasons: [] },
    ] as any;

    const first = selectBestArticle(articles, 'diverse', undefined, () => 0);
    const last = selectBestArticle(articles, 'diverse', undefined, () => 0.99);

    expect(first?.article.url).toBe('a');
    expect(last?.article.url).toBe('c');
  });

  it('diverse strategy clamps out-of-range random values to the last top candidate', () => {
    const articles = [
      { score: 10, article: { url: 'a', title: 'a' }, matchedKeywords: [], scoreBreakdown: { titleMatches: 0, descriptionMatches: 0, baseScore: 5 }, reasons: [] },
      { score: 8, article: { url: 'b', title: 'b' }, matchedKeywords: [], scoreBreakdown: { titleMatches: 0, descriptionMatches: 0, baseScore: 5 }, reasons: [] },
      { score: 6, article: { url: 'c', title: 'c' }, matchedKeywords: [], scoreBreakdown: { titleMatches: 0, descriptionMatches: 0, baseScore: 5 }, reasons: [] },
    ] as any;

    const selected = selectBestArticle(articles, 'diverse', undefined, () => 1);

    expect(selected?.article.url).toBe('c');
  });
});
