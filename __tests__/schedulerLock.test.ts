import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  eval: vi.fn(),
}));

vi.mock('../src/utils/redisClient', () => ({
  getRedisClient: vi.fn(async () => ({
    eval: mocks.eval,
  })),
}));

import { runWithLockHeartbeat } from '../src/pipeline/schedulerLock';

describe('runWithLockHeartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('aborts operation and rejects when lock renewal reports lost ownership', async () => {
    mocks.eval.mockResolvedValue(0);

    let observedSignal: AbortSignal | null = null;
    const runPromise = runWithLockHeartbeat(
      { key: 'pipeline:schedule:default', token: 'token-1' },
      3,
      async (signal) => {
        observedSignal = signal;
        return await new Promise<string>((resolve) => {
          signal.addEventListener('abort', () => resolve('aborted-by-signal'));
        });
      }
    );
    const rejectionExpectation = expect(runPromise).rejects.toThrow('was lost during execution');

    await vi.advanceTimersByTimeAsync(1000);

    expect(observedSignal?.aborted).toBe(true);
    await rejectionExpectation;
  });

  it('returns operation result when lock renewals continue succeeding', async () => {
    mocks.eval.mockResolvedValue(1);

    const runPromise = runWithLockHeartbeat(
      { key: 'pipeline:schedule:default', token: 'token-1' },
      3,
      async () => {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 1100);
        });
        return 'ok';
      }
    );

    await vi.advanceTimersByTimeAsync(1200);

    await expect(runPromise).resolves.toBe('ok');
  });
});