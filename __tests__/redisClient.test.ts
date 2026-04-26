import { beforeEach, describe, expect, it, vi } from 'vitest';

const redisMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock('redis', () => ({
  createClient: redisMocks.createClient,
}));

describe('redisClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.REDIS_URL = 'redis://localhost:6379';
  });

  it('reports when Redis URL is not configured', async () => {
    vi.resetModules();
    delete process.env.REDIS_URL;
    const mod = await import('../src/utils/redisClient');
    expect(mod.isRedisUrlConfigured()).toBe(false);
    await expect(mod.getRedisClient()).rejects.toThrow('REDIS_URL');
  });

  it('treats empty REDIS_URL as not configured', async () => {
    vi.resetModules();
    process.env.REDIS_URL = '   ';
    const mod = await import('../src/utils/redisClient');
    expect(mod.isRedisUrlConfigured()).toBe(false);
  });

  it('retries creating a Redis client after an initial connect failure', async () => {
    const firstClient = {
      connect: vi.fn().mockRejectedValue(new Error('connect failed')),
      disconnect: vi.fn(),
      isOpen: false,
      quit: vi.fn(),
    };
    const secondClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      isOpen: true,
      quit: vi.fn().mockResolvedValue(undefined),
    };

    redisMocks.createClient
      .mockReturnValueOnce(firstClient)
      .mockReturnValueOnce(secondClient);

    const mod = await import('../src/utils/redisClient');

    await expect(mod.getRedisClient()).rejects.toThrow('connect failed');
    await expect(mod.getRedisClient()).resolves.toBe(secondClient);
    expect(redisMocks.createClient).toHaveBeenCalledTimes(2);

    await mod.closeRedisClient();
    expect(secondClient.quit).toHaveBeenCalledTimes(1);
  });
});