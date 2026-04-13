import { describe, expect, it } from 'vitest';

import { normalizeGeneratedPayloadForValidation } from '../src/pipeline/aiService';

describe('normalizeGeneratedPayloadForValidation', () => {
  it('trims overlength template fields to known limits', () => {
    const payload = {
      manifest: {
        format: 'instagram_carousel',
        globalBranding: {
          accentColor: '#ff0000',
          handle: '@test',
          effects: [],
        },
        carousel: [
          {
            templateId: 'HOOK_A',
            data: {
              headline: 'H'.repeat(90),
              subheadline: 'S'.repeat(140),
            },
          },
          {
            templateId: 'CONTENT_STAT_SNAPSHOT',
            data: {
              kicker: 'K'.repeat(50),
              stat: '1'.repeat(40),
              context: 'C'.repeat(180),
              takeaway: 'T'.repeat(140),
            },
          },
          {
            templateId: 'CTA_FINAL',
            data: {
              callToAction: 'Q'.repeat(120),
              subtext: 'Z'.repeat(120),
            },
          },
        ],
      },
      caption: 'line 1\n\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8\nline 9',
      hashtags: '#a #a #b #bad-tag! #c #d #e #f #g #h #i #j #k #l',
    };

    const sequence = ['HOOK_A', 'CONTENT_STAT_SNAPSHOT', 'CTA_FINAL'] as const;
    const normalized = normalizeGeneratedPayloadForValidation(payload, sequence) as any;

    expect(normalized.manifest.carousel[0].data.headline).toHaveLength(72);
    expect(normalized.manifest.carousel[0].data.subheadline).toHaveLength(120);
    expect(normalized.manifest.carousel[1].data.kicker).toHaveLength(36);
    expect(normalized.manifest.carousel[1].data.stat).toHaveLength(24);
    expect(normalized.manifest.carousel[1].data.context).toHaveLength(120);
    expect(normalized.manifest.carousel[1].data.takeaway).toHaveLength(100);
    expect(normalized.manifest.carousel[2].data.callToAction.endsWith('?')).toBe(true);
    expect(normalized.manifest.carousel[2].data.callToAction.length).toBeLessThanOrEqual(100);
    expect(normalized.manifest.carousel[2].data.subtext).toHaveLength(84);

    const captionLines = normalized.caption.split(/\r?\n/);
    expect(captionLines).toHaveLength(8);

    const hashtags = normalized.hashtags.split(/\s+/);
    expect(hashtags).toHaveLength(12);
    expect(new Set(hashtags).size).toBe(hashtags.length);
    expect(hashtags.every((tag: string) => /^#[A-Za-z0-9_]+$/.test(tag))).toBe(true);
  });

  it('does not alter slides that do not match required template order', () => {
    const payload = {
      manifest: {
        carousel: [
          {
            templateId: 'CONTENT_GENERIC',
            data: {
              title: 'A'.repeat(100),
            },
          },
        ],
      },
    };

    const normalized = normalizeGeneratedPayloadForValidation(payload, ['HOOK_A']) as any;

    expect(normalized.manifest.carousel[0].data.title).toHaveLength(100);
  });
});
