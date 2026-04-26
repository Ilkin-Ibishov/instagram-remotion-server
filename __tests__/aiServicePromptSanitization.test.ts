import { describe, expect, it } from 'vitest';

import { sanitizeForPrompt, stripNulBytesFromAiResponseText } from '../src/pipeline/aiService';

describe('sanitizeForPrompt', () => {
  it('returns empty string for nullish values', () => {
    expect(sanitizeForPrompt(undefined)).toBe('');
    expect(sanitizeForPrompt(null)).toBe('');
  });

  it('strips control chars and normalizes whitespace', () => {
    const value = 'Line1\nLine2\t\u0000Line3';

    expect(sanitizeForPrompt(value)).toBe('Line1 Line2 Line3');
  });

  it('replaces backticks and escapes backslashes', () => {
    const value = '`quote` path\\segment';

    expect(sanitizeForPrompt(value)).toBe("'quote' path\\\\segment");
  });

  it('enforces max length', () => {
    expect(sanitizeForPrompt('abcdefgh', 5)).toBe('abcde');
  });
});

describe('stripNulBytesFromAiResponseText', () => {
  it('removes raw NUL bytes so JSON.parse can succeed', () => {
    const raw = '{"manifest":\0{"x":1}}\0';
    const stripped = stripNulBytesFromAiResponseText(raw);
    expect(stripped).toBe('{"manifest":{"x":1}}');
    expect(() => JSON.parse(stripped)).not.toThrow();
  });

  it('leaves normal JSON unchanged', () => {
    const j = '{"a":1}';
    expect(stripNulBytesFromAiResponseText(j)).toBe(j);
  });
});