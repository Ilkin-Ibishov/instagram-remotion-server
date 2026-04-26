import { describe, expect, it } from 'vitest';

import { buildRequiredTemplateSequence, resolveContentIntent, resolveSlideBoundsFromEnv } from '../src/pipeline/aiService';

describe('ai template sequence selection', () => {
  it('resolves env bounds with clamping and ordering', () => {
    process.env.MIN_SLIDES = '5';
    process.env.MAX_SLIDES = '3';

    const { minSlides, maxSlides } = resolveSlideBoundsFromEnv();

    expect(minSlides).toBe(3);
    expect(maxSlides).toBe(5);

    delete process.env.MIN_SLIDES;
    delete process.env.MAX_SLIDES;
  });

  it('falls back to defaults for invalid env values', () => {
    process.env.MIN_SLIDES = 'invalid';
    process.env.MAX_SLIDES = 'invalid';

    const { minSlides, maxSlides } = resolveSlideBoundsFromEnv();

    expect(minSlides).toBe(3);
    expect(maxSlides).toBe(5);

    delete process.env.MIN_SLIDES;
    delete process.env.MAX_SLIDES;
  });

  it('builds a bounded sequence with HOOK_A first and CTA_FINAL last', () => {
    const sequence = buildRequiredTemplateSequence(3, 5, () => 0.9999);

    expect(sequence.length).toBeGreaterThanOrEqual(3);
    expect(sequence.length).toBeLessThanOrEqual(5);
    expect(sequence[0]).toBe('HOOK_A');
    expect(sequence[sequence.length - 1]).toBe('CTA_FINAL');

    const middle = sequence.slice(1, -1);
    expect(
      middle.every(
        (id) =>
          id === 'CONTENT_LISTICLE' ||
          id === 'CONTENT_GENERIC' ||
          id === 'CONTENT_STAT_SNAPSHOT' ||
          id === 'CONTENT_MYTH_VS_FACT' ||
          id === 'CONTENT_VIDEO'
      )
    ).toBe(true);
  });

  it('respects exact length bounds when min and max are equal', () => {
    const sequence = buildRequiredTemplateSequence(5, 5, () => 0.25);

    expect(sequence).toHaveLength(5);
    expect(sequence[0]).toBe('HOOK_A');
    expect(sequence[4]).toBe('CTA_FINAL');
  });

  it('can select a CONTENT_VIDEO-inclusive plan when bounds allow it', () => {
    const sequence = buildRequiredTemplateSequence(4, 4, () => 0.9999);

    expect(sequence).toContain('CONTENT_VIDEO');
    expect(sequence[0]).toBe('HOOK_A');
    expect(sequence[sequence.length - 1]).toBe('CTA_FINAL');
  });

  it('can select a stat or myth plan when bounds allow it', () => {
    const sequence = buildRequiredTemplateSequence(3, 5, () => 0.5);

    expect(sequence[0]).toBe('HOOK_A');
    expect(sequence[sequence.length - 1]).toBe('CTA_FINAL');
    expect(
      sequence.includes('CONTENT_STAT_SNAPSHOT') || sequence.includes('CONTENT_MYTH_VS_FACT')
    ).toBe(true);
  });

  it('normalizes configured content intent values', () => {
    expect(resolveContentIntent('visual proof')).toBe('visual_proof');
    expect(resolveContentIntent('NEWSFLASH')).toBe('newsflash');
    expect(resolveContentIntent('invalid-intent')).toBe('balanced');
  });

  it('debate intent prefers myth-vs-fact plans', () => {
    const sequence = buildRequiredTemplateSequence(3, 5, () => 0.4, 'debate');

    expect(sequence).toContain('CONTENT_MYTH_VS_FACT');
    expect(sequence[0]).toBe('HOOK_A');
    expect(sequence[sequence.length - 1]).toBe('CTA_FINAL');
  });

  it('visual-proof intent prefers video-inclusive plans', () => {
    const sequence = buildRequiredTemplateSequence(3, 5, () => 0.5, 'visual_proof');

    expect(sequence).toContain('CONTENT_VIDEO');
    expect(sequence[0]).toBe('HOOK_A');
    expect(sequence[sequence.length - 1]).toBe('CTA_FINAL');
  });
});
