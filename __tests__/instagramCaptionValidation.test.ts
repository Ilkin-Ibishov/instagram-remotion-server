import { describe, expect, it } from 'vitest';
import { sanitizeInstagramCaption } from '../src/automation/instagramPublisher';

describe('sanitizeInstagramCaption', () => {
  it('truncates captions longer than 2200 characters with trailing ellipsis', () => {
    const input = 'x'.repeat(2300);
    const output = sanitizeInstagramCaption(input);

    expect(output.length).toBeLessThanOrEqual(2200);
    expect(output.endsWith('...')).toBe(true);
  });

  it('keeps at most 30 hashtags in caption', () => {
    const hashtags = Array.from({ length: 35 }, (_, i) => `#tag${i + 1}`).join(' ');
    const output = sanitizeInstagramCaption(`Intro text ${hashtags}`);

    const outputHashtags = output.match(/#[A-Za-z0-9_]+/g) ?? [];
    expect(outputHashtags.length).toBe(30);
    expect(outputHashtags.includes('#tag31')).toBe(false);
  });

  it('keeps caption unchanged when within instagram limits', () => {
    const input = 'Launch update! #news #automation';
    const output = sanitizeInstagramCaption(input);

    expect(output).toBe(input);
  });
});
