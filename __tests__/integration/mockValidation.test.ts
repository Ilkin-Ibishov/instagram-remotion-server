import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/pipeline/aiService', () => ({
  generatePostContentAI: vi.fn(async () => ({
    manifest: {
      format: 'png',
      globalBranding: {
        accentColor: '#3b82f6',
        handle: '@railway-test',
        effects: [],
      },
      carousel: [
        { templateId: 'HOOK_A', data: { headline: 'OpenAI Releases GPT-5' } },
        { templateId: 'CONTENT_LISTICLE', data: { title: 'Highlights', items: ['Reasoning', 'Multimodal'], footnote: 'Source: TechCrunch' } },
        { templateId: 'CONTENT_GENERIC', data: { title: 'Why It Matters', body: 'Improved reliability and lower hallucinations.' } },
        { templateId: 'CTA_FINAL', data: { callToAction: 'Follow for more', subtext: 'Daily tech insights' } },
      ],
    },
    caption: 'OpenAI unveils GPT-5 with stronger reasoning and multimodal support.',
    hashtags: '#ai #openai #gpt5 #tech',
  })),
}));

import { generateContent } from '../../src/pipeline/contentGenerator';

describe('mock content validation integration', () => {
  it('returns a valid 4-slide manifest shape for pipeline smoke checks', async () => {
    const result = await generateContent({
      title: 'OpenAI Releases GPT-5 With Groundbreaking Reasoning Capabilities',
      description: 'OpenAI announced GPT-5 with significantly improved reasoning and reduced hallucinations.',
      content: 'OpenAI announced GPT-5, its most advanced model yet, with multimodal support and lower hallucinations.',
      url: 'https://example.com/gpt5-release',
      imageUrl: 'https://example.com/gpt5.jpg',
      publishedAt: '2026-03-30T12:00:00Z',
      source: 'TechCrunch',
    });

    expect(result.manifest.carousel).toHaveLength(4);
    expect(result.manifest.format).toBe('png');
    expect(result.manifest.globalBranding.handle).toBe('@railway-test');

    const templateOrder = result.manifest.carousel.map((slide) => slide.templateId);
    expect(templateOrder).toEqual(['HOOK_A', 'CONTENT_LISTICLE', 'CONTENT_GENERIC', 'CTA_FINAL']);

    expect(result.caption.length).toBeGreaterThan(0);
    expect(result.hashtags.length).toBeGreaterThan(0);
  });
});
