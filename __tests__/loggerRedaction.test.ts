import { describe, expect, it } from 'vitest';
import { redactSensitiveFields } from '../src/utils/logger';

describe('redactSensitiveFields', () => {
  it('redacts sensitive fields recursively and keeps safe fields', () => {
    const input = {
      apikey: 'x',
      nested: {
        token: 'y',
        safe: 'z',
      },
      list: [{ password: 'p1' }, { ok: true }],
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
      safeTopLevel: 'visible',
    });
  });
});
