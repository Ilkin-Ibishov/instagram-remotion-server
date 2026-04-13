import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/pipeline/aiService', () => ({
  generatePostContentAI: vi.fn(),
}));

import { generateContent, scoreGeneratedContentQuality } from '../src/pipeline/contentGenerator';
import { generatePostContentAI } from '../src/pipeline/aiService';

const mockedGeneratePostContentAI = vi.mocked(generatePostContentAI);

describe('generateContent', () => {
  const article = {
    title: 'Test article',
    description: 'desc',
    content: 'content',
    url: 'https://example.com/article',
    imageUrl: 'https://example.com/image.jpg',
    publishedAt: '2026-04-12T00:00:00Z',
    source: 'Example',
  };

  const validContent = {
    manifest: {
      format: 'png',
      globalBranding: { accentColor: '#3b82f6', handle: '@test', effects: [] },
      carousel: [
        { templateId: 'HOOK_A', data: { headline: 'Test hook', subheadline: 'Why this matters right now' } },
        { templateId: 'CONTENT_GENERIC', data: { title: 'Why it matters', body: 'This is a meaningful body for the content quality gate.', highlight: 'Useful context' } },
        { templateId: 'CTA_FINAL', data: { callToAction: 'What do you think?', subtext: 'Share your take below' } },
      ],
    },
    caption: 'This launch matters more than it looks at first glance.\n\nHere is the practical shift and why teams should care today.',
    hashtags: '#ai #automation #developers',
  } as any;

  it('scores strong generated content above the default quality threshold', () => {
    expect(scoreGeneratedContentQuality(validContent).score).toBeGreaterThanOrEqual(4);
  });

  it('throws contextual error when AI service throws', async () => {
    mockedGeneratePostContentAI.mockRejectedValueOnce(new Error('Gemini unavailable'));

    await expect(generateContent(article as any)).rejects.toThrow(
      'Content generation failed for article "Test article" (https://example.com/article): Gemini unavailable'
    );
  });

  it('throws descriptive error when AI service returns null', async () => {
    mockedGeneratePostContentAI.mockResolvedValueOnce(null as unknown as any);

    await expect(generateContent(article as any)).rejects.toThrow(
      'Content generation returned null for article "Test article" (https://example.com/article)'
    );
  });

  it('returns generated content when it passes the quality gate', async () => {
    mockedGeneratePostContentAI.mockResolvedValueOnce(validContent);

    await expect(generateContent(article as any)).resolves.toEqual(validContent);
  });

  it('throws when generated content falls below the quality threshold', async () => {
    mockedGeneratePostContentAI.mockResolvedValueOnce({
      manifest: {
        format: 'png',
        globalBranding: { accentColor: '#3b82f6', handle: '@test', effects: [] },
        carousel: [
          { templateId: 'HOOK_A', data: {} },
          { templateId: 'HOOK_A', data: {} },
          { templateId: 'CTA_FINAL', data: {} },
        ],
      },
      caption: 'Too short',
      hashtags: '#one',
    } as any);

    await expect(generateContent(article as any)).rejects.toThrow('Content quality score');
  });
});
