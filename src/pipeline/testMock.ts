/**
 * Smoke test: run `npx tsx src/pipeline/testMock.ts`
 * Verifies the mock content generator produces valid carousel manifests.
 */

// Bypass config validation for this test — we only need branding defaults
process.env.GNEWS_API_KEY = 'test';
process.env.GEMINI_API_KEY = 'test';
process.env.IG_ACCESS_TOKEN = 'test';
process.env.IG_ACCOUNT_ID = 'test';

import { generateContent } from './contentGenerator';
import type { NewsArticle } from './types';

const mockArticle: NewsArticle = {
  title: 'OpenAI Releases GPT-5 With Groundbreaking Reasoning Capabilities',
  description:
    'OpenAI has announced GPT-5, its most advanced model yet. The new system demonstrates significantly improved reasoning, reduced hallucinations, and can process multimodal inputs natively.',
  content:
    'OpenAI has announced GPT-5, its most advanced model yet. The new system demonstrates significantly improved reasoning. It reduces hallucinations by 80% compared to GPT-4. The model can process text, images, and audio natively. Enterprise pricing starts at $0.03 per 1K tokens. OpenAI expects the model to reshape how businesses use AI.',
  url: 'https://example.com/gpt5-release',
  imageUrl: 'https://example.com/gpt5.jpg',
  publishedAt: '2026-03-30T12:00:00Z',
  source: 'TechCrunch',
};

async function runTest() {
  try {
    const result = await generateContent(mockArticle);

    console.log('=== Generated Content ===\n');
    console.log('📋 Carousel slides:', result.manifest.carousel.length);
    console.log('📐 Format:', result.manifest.format);
    console.log(
      '🎨 Branding:',
      result.manifest.globalBranding.handle,
      result.manifest.globalBranding.accentColor
    );
    console.log('\n--- Slides ---');
    for (const [i, slide] of result.manifest.carousel.entries()) {
      console.log(`\n  [${i + 1}] ${slide.templateId}`);
      console.log(`      data keys: ${Object.keys(slide.data).join(', ')}`);
    }
    console.log('\n--- Caption ---');
    console.log(result.caption);
    console.log('\n--- Hashtags ---');
    console.log(result.hashtags);

    // Validate structure
    const templateOrder = result.manifest.carousel.map((s: any) => s.templateId);
    const valid =
      templateOrder[0] === 'HOOK_A' &&
      templateOrder[templateOrder.length - 1] === 'CTA_FINAL' &&
      result.manifest.carousel.length >= 3;

    console.log(`\n✅ Valid structure: ${valid}`);
    if (!valid) {
      console.error('❌ VALIDATION FAILED');
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  }
}

runTest();
