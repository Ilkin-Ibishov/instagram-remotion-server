import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  pgQuery: vi.fn(),
  pgRelease: vi.fn(),
  pgConnect: vi.fn(),
}));

vi.mock('pg', () => ({
  Pool: vi.fn(function MockPool() {
    return {
      connect: mocks.pgConnect,
      end: vi.fn().mockResolvedValue(undefined),
    };
  }),
}));

describe('publishedPostStore', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/test';
    mocks.pgRelease.mockReturnValue(undefined);
    mocks.pgQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    mocks.pgConnect.mockResolvedValue({
      query: mocks.pgQuery,
      release: mocks.pgRelease,
    });
  });

  afterEach(async () => {
    delete process.env.DATABASE_URL;
    const mod = await import('../src/pipeline/publishedPostStore');
    await mod.__testing.resetPublishedPostStoreForTests();
    vi.resetModules();
  });

  it('records selected post and appends event metadata without media binaries', async () => {
    const mod = await import('../src/pipeline/publishedPostStore');

    const context = mod.buildPublishedPostContext('batch-1');
    await mod.recordSelectedPost(context, {
      article: {
        articleId: 'gnews-1',
        title: 'Article title',
        description: 'desc',
        content: 'content',
        url: 'https://example.com/a',
        publishedAt: '2026-04-01T00:00:00.000Z',
        source: 'Example',
      },
      score: 42,
      reasons: ['reason'],
    });

    const sql = mocks.pgQuery.mock.calls.map(([query]) => String(query)).join('\n');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS published_posts');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS post_events');
    expect(sql).toContain('INSERT INTO published_posts');
    expect(sql).toContain('INSERT INTO post_events');

    const allParams = mocks.pgQuery.mock.calls.flatMap((call) => Array.isArray(call[1]) ? call[1] : []);
    expect(allParams.some((value) => String(value).includes('data:image'))).toBe(false);
  });

  it('stores publish success metadata with permalink and media metadata only', async () => {
    const mod = await import('../src/pipeline/publishedPostStore');

    await mod.recordPublishedPost(mod.buildPublishedPostContext('batch-1'), {
      confirmed: true,
      permalink: 'https://instagram.com/p/test',
      verificationMethod: 'profile_permalink',
      baselinePermalinkCount: 2,
      publishDurationMs: 12345,
    });

    const sql = mocks.pgQuery.mock.calls.map(([query]) => String(query)).join('\n');
    expect(sql).toContain('instagram_permalink=$2');
    expect(sql).toContain('publish_confirmation=$3::jsonb');
    expect(sql).toContain('published_at=NOW()');
  });

  it('returns recent published post rows', async () => {
    mocks.pgQuery.mockImplementation((sql: string) => {
      if (sql.includes('SELECT id, batch_id') && sql.includes('FROM published_posts')) {
        return Promise.resolve({
          rows: [
            {
              id: '1',
              batch_id: 'batch-1',
              status: 'published',
              article_title: 'A',
              article_url: 'https://example.com/a',
              published_at: new Date('2026-04-01T00:00:00Z'),
            },
          ],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const mod = await import('../src/pipeline/publishedPostStore');
    const rows = await mod.getRecentPublishedPosts(5);

    expect(rows).toHaveLength(1);
    expect(rows[0].batch_id).toBe('batch-1');
    expect(mocks.pgRelease).toHaveBeenCalled();
  });
});
