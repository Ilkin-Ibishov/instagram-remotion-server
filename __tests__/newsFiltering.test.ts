import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/pipeline/postHistory', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/pipeline/postHistory')>();
  return {
    ...actual,
    getRecentPosts: vi.fn(() => Promise.resolve([])),
    loadPostHistoryDedupSnapshot: vi.fn(() => Promise.resolve([])),
    claimArticle: vi.fn(() => Promise.resolve(true)),
  };
});

import { claimArticle, getRecentPosts, loadPostHistoryDedupSnapshot } from '../src/pipeline/postHistory';

import { filterAndRankArticles, scoreArticleRelevance } from '../src/pipeline/newsFiltering';
import { selectBestArticle } from '../src/pipeline/newsFiltering';

const mockedGetRecentPosts = vi.mocked(getRecentPosts);
const mockedClaimArticle = vi.mocked(claimArticle);
const mockedLoadDedupSnapshot = vi.mocked(loadPostHistoryDedupSnapshot);

describe('newsFiltering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.REPETITION_WINDOW_DAYS;
    delete process.env.REPETITION_THRESHOLD;
    delete process.env.REPETITION_PENALTY;
    delete process.env.POST_HISTORY_STORE;
    delete process.env.DATABASE_URL;
  });

  it('hard-skips same-topic articles when recent history hits repetition threshold', async () => {
    process.env.REPETITION_WINDOW_DAYS = '7';
    process.env.REPETITION_THRESHOLD = '3';
    process.env.REPETITION_PENALTY = '25';

    mockedGetRecentPosts.mockResolvedValue([
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

    const scored = await filterAndRankArticles(
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

    expect(scored).toHaveLength(1);
    expect(scored[0].article.title).toContain('Kubernetes');
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

  it('does not throw when filtering articles with null description values', async () => {
    const scored = await filterAndRankArticles(
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

  it('postgres: skips URL/fingerprint matches from dedup snapshot before any claim', async () => {
    process.env.POST_HISTORY_STORE = 'postgres';
    process.env.DATABASE_URL = 'postgres://localhost/test';

    mockedLoadDedupSnapshot.mockResolvedValueOnce([
      {
        articleTitle: 'Already posted kubernetes story',
        articleUrl: 'https://example.com/current-kubernetes',
        postedAt: '2026-04-01T00:00:00.000Z',
        batchId: 'old',
      },
    ]);

    const scored = await filterAndRankArticles(
      [
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
      ['kubernetes'],
      undefined,
      -100
    );

    expect(scored).toBeNull();
    expect(mockedClaimArticle).not.toHaveBeenCalled();
  });

  it('postgres: first successful claim returns one ranked article', async () => {
    process.env.POST_HISTORY_STORE = 'postgres';
    process.env.DATABASE_URL = 'postgres://localhost/test';

    mockedClaimArticle.mockResolvedValueOnce(true);

    const scored = await filterAndRankArticles(
      [
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
      ['kubernetes'],
      undefined,
      -100
    );

    expect(scored).toHaveLength(1);
    expect(scored![0].article.title).toContain('Kubernetes');
    expect(mockedClaimArticle).toHaveBeenCalledTimes(1);
  });

  it('postgres: returns null when every claim loses', async () => {
    process.env.POST_HISTORY_STORE = 'postgres';
    process.env.DATABASE_URL = 'postgres://localhost/test';

    mockedClaimArticle.mockResolvedValue(false);

    const scored = await filterAndRankArticles(
      [
        {
          title: 'Kubernetes reliability update for infrastructure teams',
          description: 'Platform-level improvements',
          content: '...',
          url: 'https://example.com/k8s',
          imageUrl: 'https://example.com/k8s.jpg',
          publishedAt: '2026-04-12T01:00:00.000Z',
          source: 'Example',
        },
      ],
      ['kubernetes'],
      undefined,
      -100
    );

    expect(scored).toBeNull();
    expect(mockedClaimArticle).toHaveBeenCalledTimes(1);
  });

  it('postgres: tries the next candidate when earlier claims lose', async () => {
    process.env.POST_HISTORY_STORE = 'postgres';
    process.env.DATABASE_URL = 'postgres://localhost/test';

    mockedClaimArticle.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const scored = await filterAndRankArticles(
      [
        {
          title: 'Lower ranked story',
          description: 'kubernetes and platform news',
          content: '...',
          url: 'https://example.com/b',
          imageUrl: 'https://example.com/b.jpg',
          publishedAt: '2026-04-12T01:00:00.000Z',
          source: 'Example',
        },
        {
          title: 'Higher ranked kubernetes story',
          description: 'kubernetes platform improvements',
          content: '...',
          url: 'https://example.com/a',
          imageUrl: 'https://example.com/a.jpg',
          publishedAt: '2026-04-12T01:00:00.000Z',
          source: 'Example',
        },
      ],
      ['platform', 'kubernetes'],
      undefined,
      -100
    );

    expect(scored).toHaveLength(1);
    // Higher-scored article is tried first; after that claim loses, the next candidate wins.
    expect(scored![0].article.url).toBe('https://example.com/b');
    expect(mockedClaimArticle).toHaveBeenCalledTimes(2);
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
