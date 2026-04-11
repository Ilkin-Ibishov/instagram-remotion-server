import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  parseURL: vi.fn(),
  redisGet: vi.fn(),
  redisSet: vi.fn(),
  shouldSkipSourceByCooldown: vi.fn(),
  noteSourceFetchSuccess: vi.fn(),
  noteSourceFetchFailure: vi.fn(),
  recordRssSourceTelemetry: vi.fn(),
  recordRssRunTelemetry: vi.fn(),
}));

vi.mock('rss-parser', () => ({
  default: vi.fn(class MockParser {
    parseURL = mocks.parseURL;
  }),
}));

vi.mock('../src/utils/redisClient', () => ({
  getRedisClient: vi.fn(async () => ({
    get: mocks.redisGet,
    set: mocks.redisSet,
    del: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
  })),
}));

vi.mock('../src/pipeline/rssTelemetryStore', () => ({
  classifyRssErrorType: vi.fn(() => 'timeout'),
  shouldSkipSourceByCooldown: mocks.shouldSkipSourceByCooldown,
  noteSourceFetchSuccess: mocks.noteSourceFetchSuccess,
  noteSourceFetchFailure: mocks.noteSourceFetchFailure,
  recordRssSourceTelemetry: mocks.recordRssSourceTelemetry,
  recordRssRunTelemetry: mocks.recordRssRunTelemetry,
}));

import { __testing, crossSourceDedup, fetchRssNews, normalizeItem } from '../src/pipeline/rssService';
import Logger from '../src/utils/logger';

describe('rssService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.REDIS_URL;
    delete process.env.RSS_CACHE_TTL_SECONDS;
    mocks.shouldSkipSourceByCooldown.mockResolvedValue({ shouldSkip: false, cooldownUntil: null });
    mocks.noteSourceFetchSuccess.mockResolvedValue(undefined);
    mocks.noteSourceFetchFailure.mockResolvedValue({ failureCount: 1, cooldownApplied: false, cooldownUntil: null });
    mocks.recordRssSourceTelemetry.mockResolvedValue(undefined);
    mocks.recordRssRunTelemetry.mockResolvedValue(undefined);
  });

  it('normalizes items and filters invalid records through fetchRssNews', async () => {
    mocks.parseURL.mockResolvedValue({
      items: [
        {
          title: 'AI tooling update for developers',
          link: 'https://example.com/article?utm_source=test',
          contentSnippet: 'This is a summary sentence. More details here.',
          pubDate: '2026-04-10T10:00:00.000Z',
          enclosure: { url: 'https://example.com/image.jpg' },
        },
        {
          title: 'Missing image should be dropped',
          link: 'https://example.com/no-image',
          contentSnippet: 'summary',
        },
      ],
    });

    const result = await fetchRssNews(['technology']);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].title).toBe('AI tooling update for developers');
    expect(result[0].description.length).toBeGreaterThan(0);
    expect(result[0].content).toBe(result[0].description);
    expect(result[0].imageUrl).toBe('https://example.com/image.jpg');
    expect(result[0].url).toContain('https://example.com/article');
  });

  it('deduplicates by normalized URL and keeps one article', async () => {
    let call = 0;
    mocks.parseURL.mockImplementation(async () => {
      call += 1;
      if (call === 1) {
        return {
          items: [
            {
              title: 'OpenAI launches new model for enterprise',
              link: 'https://news.example.com/post?utm_source=a',
              contentSnippet: 'desc one',
              pubDate: '2026-04-10T09:00:00.000Z',
              enclosure: { url: 'https://news.example.com/image1.jpg' },
            },
          ],
        };
      }

      if (call === 2) {
        return {
          items: [
            {
              title: 'OpenAI launches new model for enterprise customers',
              link: 'https://www.news.example.com/post',
              contentSnippet: 'desc two',
              pubDate: '2026-04-10T08:00:00.000Z',
              enclosure: { url: 'https://news.example.com/image2.jpg' },
            },
          ],
        };
      }

      return { items: [] };
    });

    const result = await fetchRssNews(['technology']);

    expect(result).toHaveLength(1);
    expect(result[0].url).toContain('news.example.com/post');
  });

  it('uses redis cache when available and skips live parser calls', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    mocks.redisGet.mockResolvedValue(JSON.stringify([
      {
        title: 'Cached article',
        description: 'cached description',
        content: 'cached description',
        url: 'https://cached.example.com/post',
        imageUrl: 'https://cached.example.com/image.jpg',
        publishedAt: '2026-04-10T07:00:00.000Z',
        source: 'Cached Source',
      },
    ]));

    const result = await fetchRssNews(['technology']);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Cached article');
    expect(mocks.parseURL).not.toHaveBeenCalled();
    expect(mocks.redisGet).toHaveBeenCalled();
  });

  it('falls back to live fetch when Redis read fails', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    mocks.redisGet.mockRejectedValue(new Error('redis unavailable'));
    mocks.parseURL.mockResolvedValue({
      items: [
        {
          title: 'Live fetch fallback article',
          link: 'https://fallback.example.com/post',
          contentSnippet: 'fallback description',
          pubDate: '2026-04-10T10:00:00.000Z',
          enclosure: { url: 'https://fallback.example.com/image.jpg' },
        },
      ],
    });

    const result = await fetchRssNews(['technology']);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Live fetch fallback article');
    expect(mocks.parseURL).toHaveBeenCalled();
  });

  it('returns empty array when parser fails for all sources', async () => {
    mocks.parseURL.mockRejectedValue(new Error('timeout'));

    const result = await fetchRssNews(['technology']);

    expect(result).toEqual([]);
    expect(mocks.noteSourceFetchFailure).toHaveBeenCalled();
  });

  it('skips source fetch when cooldown is active', async () => {
    mocks.shouldSkipSourceByCooldown.mockResolvedValue({
      shouldSkip: true,
      cooldownUntil: '2026-04-12T00:00:00.000Z',
    });

    const result = await fetchRssNews(['technology']);

    expect(result).toEqual([]);
    expect(mocks.parseURL).not.toHaveBeenCalled();
    expect(mocks.recordRssSourceTelemetry).toHaveBeenCalled();
  });

  it('records run telemetry on completion', async () => {
    mocks.parseURL.mockResolvedValue({
      items: [
        {
          title: 'Telemetry test article',
          link: 'https://telemetry.example.com/post',
          contentSnippet: 'description',
          pubDate: '2026-04-10T10:00:00.000Z',
          enclosure: { url: 'https://telemetry.example.com/image.jpg' },
        },
      ],
    });

    await fetchRssNews(['technology']);

    expect(mocks.recordRssRunTelemetry).toHaveBeenCalledTimes(1);
    expect(mocks.recordRssSourceTelemetry).toHaveBeenCalled();
    expect(mocks.noteSourceFetchSuccess).toHaveBeenCalled();
  });

  it('normalizeItem uses safe URL and epoch fallback for missing date', () => {
    const normalized = normalizeItem(
      {
        title: 'Test title',
        guid: 'urn:uuid:abcd',
        contentSnippet: 'Test description',
      },
      {
        id: 'x',
        name: 'X Source',
        feedUrl: 'https://x.test/feed',
        niches: ['technology'],
        cacheTtlSeconds: 900,
        enabled: true,
      }
    );

    expect(normalized.url).toBe('');
    expect(normalized.publishedAt).toBe('1970-01-01T00:00:00Z');
  });

  it('normalizeItem strips HTML from fallback description fields', () => {
    const normalized = normalizeItem(
      {
        title: 'HTML fallback test',
        link: 'https://example.com/html',
        summary: '<p>Hello <a href="https://example.com">world</a>&nbsp;from RSS.</p>',
        enclosure: { url: 'https://example.com/image.jpg' },
      },
      {
        id: 'x',
        name: 'X Source',
        feedUrl: 'https://x.test/feed',
        niches: ['technology'],
        cacheTtlSeconds: 900,
        enabled: true,
      }
    );

    expect(normalized.description).toBe('Hello world from RSS.');
    expect(normalized.description).not.toContain('<');
  });

  it('normalizeItem resolves image from nested media fields', () => {
    const normalized = normalizeItem(
      {
        title: 'Nested media test',
        link: 'https://example.com/media',
        contentSnippet: 'description',
        mediaContent: { $: { url: 'https://example.com/media-content.jpg' } },
      },
      {
        id: 'x',
        name: 'X Source',
        feedUrl: 'https://x.test/feed',
        niches: ['technology'],
        cacheTtlSeconds: 900,
        enabled: true,
      }
    );

    expect(normalized.imageUrl).toBe('https://example.com/media-content.jpg');
  });

  it('normalizeItem truncates long descriptions at sentence boundary', () => {
    const long = `${'A'.repeat(210)}. ${'B'.repeat(350)}`;
    const normalized = normalizeItem(
      {
        title: 'Sentence boundary test',
        link: 'https://example.com/long',
        contentSnippet: long,
        enclosure: { url: 'https://example.com/image.jpg' },
      },
      {
        id: 'x',
        name: 'X Source',
        feedUrl: 'https://x.test/feed',
        niches: ['technology'],
        cacheTtlSeconds: 900,
        enabled: true,
      }
    );

    expect(normalized.description.endsWith('.')).toBe(true);
    expect(normalized.description.length).toBeLessThanOrEqual(500);
  });

  it('jaccard helper returns expected similarity', () => {
    const a = __testing.titleWordSet('OpenAI launches enterprise AI model');
    const b = __testing.titleWordSet('OpenAI launches new enterprise model');

    expect(__testing.jaccardSimilarity(a, b)).toBeGreaterThan(0.6);
  });

  it('jaccard helper captures boundary behavior around dedup threshold', () => {
    const highA = __testing.titleWordSet('Nvidia announces next gen AI chip roadmap datacenter launch');
    const highB = __testing.titleWordSet('Nvidia announces next gen AI chip roadmap datacenter rollout');
    const lowA = __testing.titleWordSet('Apple unveils iOS accessibility updates for iPhone users');
    const lowB = __testing.titleWordSet('SpaceX schedules next starship orbital launch test');

    expect(__testing.jaccardSimilarity(highA, highB)).toBeGreaterThanOrEqual(0.6);
    expect(__testing.jaccardSimilarity(lowA, lowB)).toBeLessThan(0.6);
  });

  it('crossSourceDedup removes near-duplicate titles across sources', () => {
    const logger = new Logger('test-run');
    const result = crossSourceDedup(
      [
        {
          title: 'Nvidia announces next gen AI chip roadmap datacenter launch',
          description: 'desc',
          content: 'desc',
          url: 'https://a.example.com/nvidia-chip',
          imageUrl: 'https://a.example.com/image.jpg',
          publishedAt: '2026-04-10T10:00:00.000Z',
          source: 'A',
        },
        {
          title: 'Nvidia announces next gen AI chip roadmap datacenter rollout',
          description: 'desc',
          content: 'desc',
          url: 'https://b.example.com/nvidia-chip',
          imageUrl: 'https://b.example.com/image.jpg',
          publishedAt: '2026-04-10T09:00:00.000Z',
          source: 'B',
        },
      ],
      logger
    );

    expect(result).toHaveLength(1);
  });

  it('returns on global timeout when source fetches hang', async () => {
    vi.useFakeTimers();
    try {
      mocks.parseURL.mockImplementation(() => new Promise(() => {}));

      const pending = fetchRssNews(['technology']);
      await vi.advanceTimersByTimeAsync(15_000);

      const result = await pending;
      expect(result).toEqual([]);
      expect(mocks.recordRssRunTelemetry).toHaveBeenCalledWith(
        expect.objectContaining({ globalTimeoutTriggered: true }),
        expect.anything()
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears global timeout timer when all sources finish before timeout', async () => {
    vi.useFakeTimers();
    try {
      mocks.parseURL.mockResolvedValue({ items: [] });

      const pending = fetchRssNews(['technology']);
      await vi.runAllTimersAsync();
      await pending;

      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
