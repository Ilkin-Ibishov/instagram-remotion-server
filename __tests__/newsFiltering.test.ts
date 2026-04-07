import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/pipeline/postHistory', () => ({
  hasBeenPosted: vi.fn(() => false),
  getRecentPosts: vi.fn(() => []),
}));

import { filterAndRankArticles, scoreArticleRelevance } from '../src/pipeline/newsFiltering';

describe('newsFiltering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
