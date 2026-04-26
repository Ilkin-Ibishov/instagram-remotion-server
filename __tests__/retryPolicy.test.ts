import { describe, it, expect, vi } from 'vitest';
import { executeWithRetry } from '../src/pipeline/retryPolicy';

describe('executeWithRetry', () => {
  it('returns immediately when first attempt succeeds', async () => {
    const fn = vi.fn().mockResolvedValue('ok');

    const result = await executeWithRetry(fn, { maxRetries: 1, retryDelayMs: 1 });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries once on retryable failure and then succeeds', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('ECONNRESET transient error'))
      .mockResolvedValueOnce('ok');

    const onRetry = vi.fn();
    const result = await executeWithRetry(fn, {
      maxRetries: 1,
      retryDelayMs: 1,
      onRetry,
    });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not retry non-retryable errors', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('Validation failed'));

    await expect(
      executeWithRetry(fn, { maxRetries: 1, retryDelayMs: 1 })
    ).rejects.toThrow('Validation failed');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws after max retries are exhausted for retryable errors', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue(new Error('ECONNRESET persistent error'));

    const onRetry = vi.fn();

    await expect(
      executeWithRetry(fn, {
        maxRetries: 2,
        retryDelayMs: 1,
        onRetry,
      })
    ).rejects.toThrow('ECONNRESET persistent error');

    // Initial attempt + 2 retries
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('waits for retryDelayMs before the next retry attempt', async () => {
    vi.useFakeTimers();
    try {
      const fn = vi
        .fn<() => Promise<string>>()
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockResolvedValueOnce('ok');

      const resultPromise = executeWithRetry(fn, {
        maxRetries: 1,
        retryDelayMs: 50,
      });

      await Promise.resolve();
      expect(fn).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(49);
      expect(fn).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      await expect(resultPromise).resolves.toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
