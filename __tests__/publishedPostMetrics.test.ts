import { describe, expect, it } from 'vitest';
import {
  buildCreativeFingerprints,
  scorePublishedPostQuality,
  summarizeTemplateSequence,
} from '../src/pipeline/publishedPostMetrics';

const content = {
  manifest: {
    format: 'instagram_carousel',
    globalBranding: { accentColor: '#ef4444', handle: '@test', effects: [] },
    carousel: [
      { templateId: 'HOOK_A', data: { headline: 'AI changes developer work fast', subheadline: 'Why teams should care' } },
      { templateId: 'CONTENT_LISTICLE', data: { title: 'What changed', items: ['Faster tools', 'Less setup', 'More leverage', 'New workflows'], footnote: 'Source context' } },
      { templateId: 'CTA_FINAL', data: { callToAction: 'Would you use this?', subtext: 'Tell us below' } },
    ],
  },
  caption: 'AI is changing developer work.\n\nTeams can ship internal tools faster now.\n\nWould you use this?',
  hashtags: '#developers #automation #startup',
} as any;

describe('published post metrics', () => {
  it('summarizes template sequence', () => {
    expect(summarizeTemplateSequence(content.manifest.carousel)).toEqual([
      'HOOK_A',
      'CONTENT_LISTICLE',
      'CTA_FINAL',
    ]);
  });

  it('builds stable creative fingerprints without media payloads', () => {
    const fingerprints = buildCreativeFingerprints({
      articleTitle: 'AI changes developer work fast',
      content,
    });

    expect(fingerprints.hookFingerprint).toBeTruthy();
    expect(fingerprints.topicFingerprint).toBeTruthy();
    expect(fingerprints.templateSequenceHash).toHaveLength(64);
    expect(fingerprints.captionFingerprint).toHaveLength(64);
  });

  it('scores quality metrics useful for SMM review', () => {
    const metrics = scorePublishedPostQuality({
      articlePublishedAt: '2026-04-26T12:00:00.000Z',
      content,
      now: new Date('2026-04-26T18:00:00.000Z'),
    });

    expect(metrics.slideCount).toBe(3);
    expect(metrics.hashtagCount).toBe(3);
    expect(metrics.hasQuestionCta).toBe(true);
    expect(metrics.contentQualityScore).toBeGreaterThanOrEqual(4);
    expect(metrics.articleAgeHours).toBe(6);
  });
});
