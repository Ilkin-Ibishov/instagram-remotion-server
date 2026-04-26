import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import { Logger, redactSensitiveFields, redactSensitiveText, sanitizeUrlForLogging } from '../src/utils/logger';

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.LOG_FORMAT;
  delete process.env.NODE_ENV;
});

describe('redactSensitiveFields', () => {
  it('redacts sensitive fields recursively and keeps safe fields', () => {
    const input = {
      apikey: 'x',
      nested: {
        token: 'y',
        safe: 'z',
      },
      list: [{ password: 'p1' }, { ok: true }],
      access_token: 'access',
      safeTopLevel: 'visible',
    };

    const output = redactSensitiveFields(input) as any;

    expect(output).toEqual({
      apikey: '[REDACTED]',
      nested: {
        token: '[REDACTED]',
        safe: 'z',
      },
      list: [{ password: '[REDACTED]' }, { ok: true }],
      access_token: '[REDACTED]',
      safeTopLevel: 'visible',
    });
  });

  it('redacts sensitive free-text values', () => {
    expect(redactSensitiveText('token=abc123 Bearer secret-token')).toBe('token=[REDACTED] Bearer [REDACTED]');
  });

  it('sanitizes sensitive URL query parameters', () => {
    const output = sanitizeUrlForLogging('https://example.com/hook?token=abc&safe=value&access_token=xyz');

    expect(output).toBe('https://example.com/hook?token=%5BREDACTED%5D&safe=value&access_token=%5BREDACTED%5D');
  });

  it('emits one redacted JSON line to console in production log mode', () => {
    process.env.LOG_FORMAT = 'json';
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(fs, 'appendFileSync').mockImplementation(() => undefined);

    const logger = new Logger('test-run', { requestId: 'req-1' });
    logger.info('test-step', 'Webhook token=abc', { secret: 'hidden', safe: 'visible' });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(String(logSpy.mock.calls[0][0]));
    expect(entry).toMatchObject({
      level: 'INFO',
      runId: 'test-run',
      requestId: 'req-1',
      step: 'test-step',
      message: 'Webhook token=[REDACTED]',
      data: {
        secret: '[REDACTED]',
        safe: 'visible',
      },
    });
  });
});
