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

describe('postHistory Postgres backend', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.POST_HISTORY_PATH;
    process.env.POST_HISTORY_STORE = 'postgres';
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/test';

    mocks.pgRelease.mockReturnValue(undefined);
    mocks.pgQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    mocks.pgConnect.mockResolvedValue({
      query: mocks.pgQuery,
      release: mocks.pgRelease,
    });
  });

  afterEach(async () => {
    delete process.env.POST_HISTORY_STORE;
    delete process.env.DATABASE_URL;
    const mod = await import('../src/pipeline/postHistory');
    mod.__resetPostHistoryPostgresForTests();
    vi.resetModules();
  });

  it('recordPost inserts then prunes beyond POST_HISTORY_MAX_ROWS', async () => {
    process.env.POST_HISTORY_MAX_ROWS = '500';

    const mod = await import('../src/pipeline/postHistory');

    await mod.recordPost({ title: 'Hello', url: 'https://example.com/a', articleId: 'gnews-1' }, 'batch-1');

    const insertCalls = mocks.pgQuery.mock.calls.filter(args => String(args[0]).includes('INSERT INTO post_history'));
    const deleteCalls = mocks.pgQuery.mock.calls.filter(args => String(args[0]).includes('DELETE FROM post_history'));
    expect(insertCalls.length).toBeGreaterThanOrEqual(1);
    expect(deleteCalls.length).toBeGreaterThanOrEqual(1);

    const insertSql = String(insertCalls[insertCalls.length - 1][0]);
    expect(insertSql).toContain('article_id');
    expect(insertSql).toContain('ON CONFLICT (normalized_url) DO UPDATE');
    expect(insertCalls[insertCalls.length - 1][1]).toContain('gnews-1');

    const deleteSql = String(deleteCalls[0][0]);
    expect(deleteSql).toContain('OFFSET $1');
    expect(deleteCalls[0][1]).toEqual([500]);
  });

  it('claimArticle returns true when INSERT … DO NOTHING returns a row', async () => {
    mocks.pgQuery.mockImplementation((sql: string) => {
      if (sql.includes('ON CONFLICT (normalized_url) DO NOTHING')) {
        return Promise.resolve({ rows: [{ id: '1' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const mod = await import('../src/pipeline/postHistory');
    const won = await mod.claimArticle('https://example.com/a', 'fp1');
    expect(won).toBe(true);
  });

  it('claimArticle returns false when URL is already claimed', async () => {
    mocks.pgQuery.mockImplementation((sql: string) => {
      if (sql.includes('ON CONFLICT (normalized_url) DO NOTHING')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const mod = await import('../src/pipeline/postHistory');
    const won = await mod.claimArticle('https://example.com/a', 'fp1');
    expect(won).toBe(false);
  });

  it('loadPostHistoryDedupSnapshot selects recent rows with limit', async () => {
    process.env.POST_HISTORY_MAX_ROWS = '100';

    mocks.pgQuery.mockImplementation((sql: string) => {
      if (sql.includes('SELECT article_id, article_title') && sql.includes('LIMIT')) {
        return Promise.resolve({
          rows: [
            {
              article_id: 'gnews-2',
              article_title: 'T',
              article_url: 'https://ex.com/x',
              title_fingerprint: 'fp1',
              posted_at: new Date('2026-04-01T12:00:00.000Z'),
              batch_id: 'b1',
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const mod = await import('../src/pipeline/postHistory');
    const rows = await mod.loadPostHistoryDedupSnapshot();

    expect(rows).toHaveLength(1);
    expect(rows[0].articleId).toBe('gnews-2');
    expect(rows[0].articleTitle).toBe('T');
    expect(rows[0].articleUrl).toBe('https://ex.com/x');

    const selectCalls = mocks.pgQuery.mock.calls.filter(args => String(args[0]).includes('LIMIT $1'));
    expect(selectCalls.some(c => c[1] && c[1][0] === 100)).toBe(true);
  });
});
