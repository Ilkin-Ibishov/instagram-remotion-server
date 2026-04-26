import { describe, expect, it } from 'vitest';
import { parseEnvInt } from '../src/utils/env';

describe('parseEnvInt', () => {
  it('returns parsed integer when valid', () => {
    process.env.PORT = '3000';

    expect(parseEnvInt('PORT', 4000, 1, 65535)).toBe(3000);
    delete process.env.PORT;
  });

  it('returns default value for empty input', () => {
    process.env.TEST_EMPTY = '';

    expect(parseEnvInt('TEST_EMPTY', 42, 1, 100)).toBe(42);
    delete process.env.TEST_EMPTY;
  });

  it('throws for non-integer env values', () => {
    process.env.TEST_BAD = 'abc3000';

    expect(() => parseEnvInt('TEST_BAD', 3000, 1, 65535)).toThrow(
      'Env var TEST_BAD="abc3000" must be an integer'
    );
    delete process.env.TEST_BAD;
  });

  it('throws for out-of-range values', () => {
    process.env.TEST_RANGE = '-1';

    expect(() => parseEnvInt('TEST_RANGE', 3000, 1, 65535)).toThrow(
      'Env var TEST_RANGE=-1 is out of range [1, 65535]'
    );
    delete process.env.TEST_RANGE;
  });
});
