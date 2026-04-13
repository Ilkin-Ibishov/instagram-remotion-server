import { describe, expect, it, vi } from 'vitest';

describe('postHistory path resolution', () => {
  it('uses POST_HISTORY_PATH when provided', async () => {
    vi.resetModules();
    process.env.POST_HISTORY_PATH = '/tmp/custom-post-history.json';

    const mod = await import('../src/pipeline/postHistory');
    expect(mod.getHistoryPath()).toBe('/tmp/custom-post-history.json');

    delete process.env.POST_HISTORY_PATH;
  });

  it('defaults to repository post-history.json path when env var is not set', async () => {
    vi.resetModules();
    delete process.env.POST_HISTORY_PATH;

    const mod = await import('../src/pipeline/postHistory');
    expect(mod.getHistoryPath().replace(/\\/g, '/')).toMatch(/\/post-history\.json$/);
    expect(mod.getHistoryPath().replace(/\\/g, '/').includes('/tmp/post-history.json')).toBe(false);
  });
});
