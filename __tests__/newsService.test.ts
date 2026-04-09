import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchTopNews, fetchSearchNews, mergeAndDedupeArticles } from '../src/pipeline/newsService';

// Prevent real Redis connections in tests — cache should always bypass
vi.mock('../src/utils/redisClient', () => ({
  getRedisClient: vi.fn().mockRejectedValue(new Error('Redis not available in tests')),
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('GNews newsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GNEWS_API_KEY = 'test-api-key';
    process.env.GNEWS_LANG = 'en';
    process.env.GNEWS_COUNTRY = 'us';
    process.env.GNEWS_MAX_ARTICLES = '10';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchTopNews', () => {
    it('should successfully fetch and map articles', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          articles: [
            {
              title: 'Test Article',
              description: 'Test description',
              content: 'Test content',
              url: 'https://example.com/article',
              image: 'https://example.com/image.jpg',
              publishedAt: '2026-04-08T00:00:00Z',
              source: { name: 'Example Source' },
            },
          ],
        }),
      };
      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse as any);

      const result = await fetchTopNews('technology');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Test Article');
      expect(result[0].description).toBe('Test description');
      expect(result[0].url).toBe('https://example.com/article');
    });

    it('should return empty array when API key is missing', async () => {
      delete process.env.GNEWS_API_KEY;
      const result = await fetchTopNews('technology');
      expect(result).toEqual([]);
    });

    it('should retry on 429 status and eventually succeed', async () => {
      const successResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          articles: [
            {
              title: 'Success Article',
              description: 'desc',
              content: 'content',
              url: 'https://example.com/success',
              image: 'https://example.com/success.jpg',
              publishedAt: '2026-04-08T00:00:00Z',
              source: { name: 'Example' },
            },
          ],
        }),
      };

      const tooManyResponse = {
        ok: false,
        status: 429,
        headers: new Map([['Retry-After', '1']]),
        text: vi.fn().mockResolvedValue('Too Many Requests'),
      };

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(tooManyResponse as any)
        .mockResolvedValueOnce(successResponse as any);

      const result = await fetchTopNews('technology');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Success Article');
      expect(vi.mocked(global.fetch).mock.calls).toHaveLength(2);
    });

    it('should throw and not retry on 401 unauthorized', async () => {
      const unauthorizedResponse = {
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue('Unauthorized'),
      };
      vi.mocked(global.fetch).mockResolvedValueOnce(unauthorizedResponse as any);

      await expect(fetchTopNews('technology')).rejects.toThrow('GNews API Error: 401');
      expect(vi.mocked(global.fetch).mock.calls).toHaveLength(1);
    });

    it('should throw and not retry on 403 forbidden (quota)', async () => {
      const forbiddenResponse = {
        ok: false,
        status: 403,
        text: vi.fn().mockResolvedValue('Quota exceeded'),
      };
      vi.mocked(global.fetch).mockResolvedValueOnce(forbiddenResponse as any);

      await expect(fetchTopNews('technology')).rejects.toThrow('GNews API Error: 403');
      expect(vi.mocked(global.fetch).mock.calls).toHaveLength(1);
    });

    it('should retry on 500 server error', async () => {
      const successResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ articles: [] }),
      };

      const errorResponse = {
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('Internal Server Error'),
      };

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(errorResponse as any)
        .mockResolvedValueOnce(successResponse as any);

      const result = await fetchTopNews('technology');
      expect(result).toEqual([]);
      expect(vi.mocked(global.fetch).mock.calls.length).toBeGreaterThan(1);
    });

    it('should handle invalid response structure gracefully', async () => {
      const invalidResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ notArticles: [] }),
      };
      vi.mocked(global.fetch).mockResolvedValueOnce(invalidResponse as any);

      await expect(fetchTopNews('technology')).rejects.toThrow('GNews API returned invalid response structure');
    });

    it('should handle null description and content gracefully', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          articles: [
            {
              title: 'No Content Article',
              description: null,
              content: null,
              url: 'https://example.com/nocontent',
              image: 'https://example.com/placeholder.jpg',
              publishedAt: '2026-04-08T00:00:00Z',
              source: { name: 'Example' },
            },
          ],
        }),
      };
      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse as any);

      const result = await fetchTopNews('technology');
      expect(result).toHaveLength(1);
      expect(result[0].description).toBe('');
      expect(result[0].content).toBe('');
    });

    it('should use fallback for null source name', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          articles: [
            {
              title: 'Test',
              description: 'desc',
              content: 'content',
              url: 'https://example.com/test',
              image: 'https://example.com/test.jpg',
              publishedAt: '2026-04-08T00:00:00Z',
              source: null,
            },
          ],
        }),
      };
      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse as any);

      const result = await fetchTopNews('technology');
      expect(result[0].source).toBe('Unknown Source');
    });
  });

  describe('fetchSearchNews', () => {
    it('should successfully fetch and map search results', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          articles: [
            {
              title: 'Search Result',
              description: 'search desc',
              content: 'search content',
              url: 'https://example.com/search',
              image: 'https://example.com/search.jpg',
              publishedAt: '2026-04-08T00:00:00Z',
              source: { name: 'Search Source' },
            },
          ],
        }),
      };
      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse as any);

      const result = await fetchSearchNews('startup AND technology');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Search Result');
    });

    it('should support sortby and date range options', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ articles: [] }),
      };
      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse as any);

      await fetchSearchNews('test', {
        sortby: 'relevance',
        from: '2026-04-01T00:00:00Z',
        to: '2026-04-08T23:59:59Z',
        maxResults: 25,
      });

      const callUrl = vi.mocked(global.fetch).mock.calls[0][0] as string;
      expect(callUrl).toContain('sortby=relevance');
      expect(callUrl).toContain('from=2026-04-01T00%3A00%3A00Z');
      expect(callUrl).toContain('to=2026-04-08T23%3A59%3A59Z');
      expect(callUrl).toContain('max=25');
    });

    it('should return empty array when API key is missing', async () => {
      delete process.env.GNEWS_API_KEY;
      const result = await fetchSearchNews('test query');
      expect(result).toEqual([]);
    });
  });

  describe('mergeAndDedupeArticles', () => {
    it('should merge and dedupe articles by URL', () => {
      const headlines = [
        {
          title: 'Article 1',
          description: '',
          content: '',
          url: 'https://example.com/1',
          imageUrl: undefined,
          publishedAt: '2026-04-08T00:00:00Z',
          source: 'Source 1',
        },
        {
          title: 'Article 2',
          description: '',
          content: '',
          url: 'https://example.com/2',
          imageUrl: undefined,
          publishedAt: '2026-04-08T00:00:00Z',
          source: 'Source 2',
        },
      ];

      const search = [
        {
          title: 'Article 3',
          description: '',
          content: '',
          url: 'https://example.com/3',
          imageUrl: undefined,
          publishedAt: '2026-04-08T00:00:00Z',
          source: 'Source 3',
        },
        {
          title: 'Duplicate Article 1',
          description: '',
          content: '',
          url: 'https://example.com/1',
          imageUrl: undefined,
          publishedAt: '2026-04-08T00:00:00Z',
          source: 'Source 1 Duplicate',
        },
      ];

      const result = mergeAndDedupeArticles(headlines, search);

      expect(result).toHaveLength(3);
      expect(result.map(a => a.url)).toEqual([
        'https://example.com/3',
        'https://example.com/1',
        'https://example.com/2',
      ]);
    });

    it('should prioritize search results (relevance)', () => {
      const headlines = [
        {
          title: 'Headline',
          description: '',
          content: '',
          url: 'https://example.com/headline',
          imageUrl: undefined,
          publishedAt: '2026-04-08T00:00:00Z',
          source: 'Source',
        },
      ];

      const search = [
        {
          title: 'Relevant Search Result',
          description: '',
          content: '',
          url: 'https://example.com/search',
          imageUrl: undefined,
          publishedAt: '2026-04-08T00:00:00Z',
          source: 'Source',
        },
      ];

      const result = mergeAndDedupeArticles(headlines, search);

      expect(result[0].title).toBe('Relevant Search Result');
      expect(result[1].title).toBe('Headline');
    });

    it('should handle empty arrays', () => {
      const result1 = mergeAndDedupeArticles([], []);
      expect(result1).toEqual([]);

      const headlines = [
        {
          title: 'Article',
          description: '',
          content: '',
          url: 'https://example.com/1',
          imageUrl: undefined,
          publishedAt: '2026-04-08T00:00:00Z',
          source: 'Source',
        },
      ];

      const result2 = mergeAndDedupeArticles(headlines, []);
      expect(result2).toEqual(headlines);
    });
  });
});
