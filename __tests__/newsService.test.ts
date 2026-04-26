import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchTopNews, fetchSearchNews, mergeAndDedupeArticles, __testing } from '../src/pipeline/newsService';
import { getRedisClient } from '../src/utils/redisClient';
import { Logger } from '../src/utils/logger';

// Prevent real Redis connections in tests — cache should always bypass
vi.mock('../src/utils/redisClient', () => ({
  getRedisClient: vi.fn().mockRejectedValue(new Error('Redis not available in tests')),
}));

let fetchSpy: ReturnType<typeof vi.spyOn>;
const getRedisClientMock = vi.mocked(getRedisClient);

describe('GNews newsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(global, 'fetch');
    process.env.GNEWS_API_KEY = 'test-api-key';
    process.env.GNEWS_LANG = 'en';
    process.env.GNEWS_COUNTRY = 'us';
    process.env.GNEWS_MAX_ARTICLES = '10';
    delete process.env.REDIS_URL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchTopNews', () => {
    it('should return cached top-headlines data on Redis cache hit without calling fetch', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const redisGet = vi.fn().mockResolvedValue(JSON.stringify([
        {
          title: 'Cached headline',
          description: 'cached',
          content: 'cached',
          url: 'https://example.com/cached-headline',
          imageUrl: 'https://example.com/cached.jpg',
          publishedAt: '2026-04-08T00:00:00Z',
          source: 'Cached Source',
        },
      ]));
      const redisSet = vi.fn();
      getRedisClientMock.mockResolvedValue({
        get: redisGet,
        set: redisSet,
      } as any);

      const result = await fetchTopNews('technology');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Cached headline');
      expect(redisGet).toHaveBeenCalledTimes(1);
      expect(redisSet).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should ignore non-array cached payload and fetch live data', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const redisGet = vi.fn().mockResolvedValue('{"broken":"data"}');
      const redisSet = vi.fn().mockResolvedValue('OK');
      getRedisClientMock.mockResolvedValue({
        get: redisGet,
        set: redisSet,
      } as any);

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          articles: [
            {
              title: 'Live after invalid cache',
              description: 'desc',
              content: 'content',
              url: 'https://example.com/live-after-invalid-cache',
              image: 'https://example.com/live.jpg',
              publishedAt: '2026-04-08T00:00:00Z',
              source: { name: 'Live Source' },
            },
          ],
        }),
      } as any);

      const result = await fetchTopNews('technology');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Live after invalid cache');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(redisSet).toHaveBeenCalledTimes(1);
    });

    it('should ignore corrupted cached JSON and fetch live data', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const redisGet = vi.fn().mockResolvedValue('{not-json');
      const redisSet = vi.fn().mockResolvedValue('OK');
      getRedisClientMock.mockResolvedValue({
        get: redisGet,
        set: redisSet,
      } as any);

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          articles: [
            {
              title: 'Live after corrupt cache',
              description: 'desc',
              content: 'content',
              url: 'https://example.com/live-after-corrupt-cache',
              image: 'https://example.com/live.jpg',
              publishedAt: '2026-04-08T00:00:00Z',
              source: { name: 'Live Source' },
            },
          ],
        }),
      } as any);

      const result = await fetchTopNews('technology');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Live after corrupt cache');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(redisSet).toHaveBeenCalledTimes(1);
    });

    it('should fetch live data and cache result on Redis cache miss', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const redisGet = vi.fn().mockResolvedValue(null);
      const redisSet = vi.fn().mockResolvedValue('OK');
      getRedisClientMock.mockResolvedValue({
        get: redisGet,
        set: redisSet,
      } as any);

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          articles: [
            {
              title: 'Live headline',
              description: 'desc',
              content: 'content',
              url: 'https://example.com/live-headline',
              image: 'https://example.com/live.jpg',
              publishedAt: '2026-04-08T00:00:00Z',
              source: { name: 'Live Source' },
            },
          ],
        }),
      } as any);

      const result = await fetchTopNews('technology');

      expect(result).toHaveLength(1);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(redisSet).toHaveBeenCalledTimes(1);
      expect(redisSet.mock.calls[0][0]).toContain('gnews:top:technology');
      expect(redisSet.mock.calls[0][2]).toEqual({ EX: 600 });
    });

    it('should fall back to live fetch when Redis read throws', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      getRedisClientMock.mockResolvedValue({
        get: vi.fn().mockRejectedValue(new Error('redis read failure')),
        set: vi.fn(),
      } as any);

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          articles: [
            {
              title: 'Fallback headline',
              description: 'desc',
              content: 'content',
              url: 'https://example.com/fallback-headline',
              image: 'https://example.com/fallback.jpg',
              publishedAt: '2026-04-08T00:00:00Z',
              source: { name: 'Fallback Source' },
            },
          ],
        }),
      } as any);

      const result = await fetchTopNews('technology');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Fallback headline');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

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
      fetchSpy.mockResolvedValueOnce(mockResponse as any);

      const result = await fetchTopNews('technology');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Test Article');
      expect(result[0].description).toBe('Test description');
      expect(result[0].url).toBe('https://example.com/article');
    });

    it('sends the API key in headers, not the top-headlines URL', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ articles: [] }),
      } as any);

      await fetchTopNews('technology');

      const [url, init] = fetchSpy.mock.calls[0];
      expect(String(url)).not.toContain('apikey=');
      expect(init).toMatchObject({
        headers: {
          'X-Api-Key': 'test-api-key',
          'User-Agent': 'instagram-content-generator/1.0',
        },
      });
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

      fetchSpy
        .mockResolvedValueOnce(tooManyResponse as any)
        .mockResolvedValueOnce(successResponse as any);

      const result = await fetchTopNews('technology');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Success Article');
      expect(fetchSpy.mock.calls).toHaveLength(2);
    });

    it('should throw and not retry on 401 unauthorized', async () => {
      const unauthorizedResponse = {
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue('Unauthorized'),
      };
      fetchSpy.mockResolvedValueOnce(unauthorizedResponse as any);

      await expect(fetchTopNews('technology')).rejects.toThrow('GNews API Error: 401');
      expect(fetchSpy.mock.calls).toHaveLength(1);
    });

    it('should throw and not retry on 403 forbidden (quota)', async () => {
      const forbiddenResponse = {
        ok: false,
        status: 403,
        text: vi.fn().mockResolvedValue('Quota exceeded'),
      };
      fetchSpy.mockResolvedValueOnce(forbiddenResponse as any);

      await expect(fetchTopNews('technology')).rejects.toThrow('GNews API Error: 403');
      expect(fetchSpy.mock.calls).toHaveLength(1);
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

      fetchSpy
        .mockResolvedValueOnce(errorResponse as any)
        .mockResolvedValueOnce(successResponse as any);

      const result = await fetchTopNews('technology');
      expect(result).toEqual([]);
      expect(fetchSpy.mock.calls.length).toBeGreaterThan(1);
    });

    it('should handle invalid response structure gracefully', async () => {
      const invalidResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ notArticles: [] }),
      };
      fetchSpy.mockResolvedValueOnce(invalidResponse as any);

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
      fetchSpy.mockResolvedValueOnce(mockResponse as any);

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
      fetchSpy.mockResolvedValueOnce(mockResponse as any);

      const result = await fetchTopNews('technology');
      expect(result[0].source).toBe('Unknown Source');
    });

    it('should keep articles without imageUrl in top-headlines results', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          articles: [
            {
              title: 'Imageless Article',
              description: 'No image in payload',
              content: 'content',
              url: 'https://example.com/no-image',
              image: null,
              publishedAt: '2026-04-08T00:00:00Z',
              source: { name: 'Example' },
            },
          ],
        }),
      };

      fetchSpy.mockResolvedValueOnce(mockResponse as any);

      const result = await fetchTopNews('technology');
      expect(result).toHaveLength(1);
      expect(result[0].imageUrl).toBeUndefined();
    });
  });

  describe('Retry-After parsing', () => {
    it('parses numeric Retry-After seconds', () => {
      expect(__testing.parseRetryAfterMs('2', 0)).toBe(2000);
    });

    it('parses HTTP-date Retry-After header', () => {
      const now = Date.parse('Sun, 12 Apr 2026 10:00:00 GMT');
      const retryAt = 'Sun, 12 Apr 2026 10:00:05 GMT';
      expect(__testing.parseRetryAfterMs(retryAt, now)).toBe(5000);
    });

    it('returns undefined for invalid Retry-After header', () => {
      expect(__testing.parseRetryAfterMs('not-a-valid-header')).toBeUndefined();
    });
  });

  describe('Cached article schema validation', () => {
    it('filters invalid cached articles and logs a warning', () => {
      const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
      const parsed = __testing.parseAndValidateCachedArticles(JSON.stringify([
        {
          title: 'Valid cached article',
          url: 'https://example.com/valid',
          description: 'desc',
          content: 'content',
          source: 'Example',
        },
        {
          title: '',
          url: 'not-a-url',
        },
      ]), new Logger());

      expect(parsed).toHaveLength(1);
      expect(parsed?.[0].title).toBe('Valid cached article');
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
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
      fetchSpy.mockResolvedValueOnce(mockResponse as any);

      const result = await fetchSearchNews('startup AND technology');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Search Result');
    });

    it('should support sortby and date range options', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ articles: [] }),
      };
      fetchSpy.mockResolvedValueOnce(mockResponse as any);

      await fetchSearchNews('test', {
        sortby: 'relevance',
        from: '2026-04-01T00:00:00Z',
        to: '2026-04-08T23:59:59Z',
        maxResults: 25,
      });

      const callUrl = fetchSpy.mock.calls[0][0] as string;
      expect(callUrl).toContain('sortby=relevance');
      expect(callUrl).toContain('from=2026-04-01T00%3A00%3A00Z');
      expect(callUrl).toContain('to=2026-04-08T23%3A59%3A59Z');
      expect(callUrl).toContain('max=25');
      expect(callUrl).not.toContain('apikey=');
      expect(fetchSpy.mock.calls[0][1]).toMatchObject({
        headers: {
          'X-Api-Key': 'test-api-key',
          'User-Agent': 'instagram-content-generator/1.0',
        },
      });
    });

    it('should return empty array when API key is missing', async () => {
      delete process.env.GNEWS_API_KEY;
      const result = await fetchSearchNews('test query');
      expect(result).toEqual([]);
    });

    it('should keep imageless articles in search results', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          articles: [
            {
              title: 'Search result without image',
              description: 'No image provided',
              content: 'content',
              url: 'https://example.com/search-no-image',
              image: null,
              publishedAt: '2026-04-08T00:00:00Z',
              source: { name: 'Search Source' },
            },
          ],
        }),
      };

      fetchSpy.mockResolvedValueOnce(mockResponse as any);

      const result = await fetchSearchNews('test query');
      expect(result).toHaveLength(1);
      expect(result[0].imageUrl).toBeUndefined();
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

    it('deduplicates normalized URL variants (http/https, www, trailing slash, utm)', () => {
      const headlines = [
        {
          title: 'Canonical story',
          description: '',
          content: '',
          url: 'https://example.com/story',
          imageUrl: undefined,
          publishedAt: '2026-04-08T00:00:00Z',
          source: 'Source',
        },
      ];

      const search = [
        {
          title: 'Variant story URL',
          description: '',
          content: '',
          url: 'http://www.example.com/story/?utm_source=test',
          imageUrl: undefined,
          publishedAt: '2026-04-08T00:00:00Z',
          source: 'Source',
        },
      ];

      const result = mergeAndDedupeArticles(headlines, search);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Variant story URL');
    });
  });
});
