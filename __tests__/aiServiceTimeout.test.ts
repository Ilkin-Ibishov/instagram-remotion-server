import { describe, expect, it } from 'vitest';

import { resolveGeminiTimeoutMs, withTimeout } from '../src/pipeline/aiService';

describe('resolveGeminiTimeoutMs', () => {
  it('falls back to default when env value is missing or invalid', () => {
    expect(resolveGeminiTimeoutMs(undefined)).toBe(60000);
    expect(resolveGeminiTimeoutMs('not-a-number')).toBe(60000);
  });

  it('clamps timeout to a minimum of 1ms', () => {
    expect(resolveGeminiTimeoutMs('0')).toBe(1);
    expect(resolveGeminiTimeoutMs('-10')).toBe(1);
  });

  it('uses integer timeout values from env', () => {
    expect(resolveGeminiTimeoutMs('1500.9')).toBe(1500);
  });
});

describe('withTimeout', () => {
  it('resolves when operation finishes before timeout', async () => {
    const result = await withTimeout(Promise.resolve('ok'), 100, 'timeout');

    expect(result).toBe('ok');
  });

  it('rejects with descriptive timeout error when operation hangs', async () => {
    const neverResolves = new Promise<string>(() => {
      // Intentionally never resolve/reject to simulate an upstream hang.
    });

    await expect(withTimeout(neverResolves, 1, 'Gemini API timeout after 1ms')).rejects.toThrow(
      'Gemini API timeout after 1ms'
    );
  });
});