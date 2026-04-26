import { generatePostContentAI } from './aiService';
import type { NewsArticle, GeneratedContent } from './types';
import type { AccountProfile } from './accountProfile';

const DEFAULT_MIN_CONTENT_QUALITY_SCORE = 4;
const MAX_CONTENT_QUALITY_SCORE = 5;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function hasMeaningfulSlideData(data: Record<string, unknown>): boolean {
  return Object.values(data).some((value) => {
    if (isNonEmptyString(value)) {
      return true;
    }
    if (Array.isArray(value)) {
      return value.some(isNonEmptyString);
    }
    return false;
  });
}

export function scoreGeneratedContentQuality(content: GeneratedContent): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const slides = content.manifest.carousel;

  if (slides.length >= 3 && slides.length <= 5) {
    score += 1;
  } else {
    reasons.push('carousel must contain between 3 and 5 slides');
  }

  if (slides.every((slide) => slide.data && hasMeaningfulSlideData(slide.data))) {
    score += 1;
  } else {
    reasons.push('all slides must contain meaningful populated data');
  }

  if (new Set(slides.map((slide) => slide.templateId)).size >= 3) {
    score += 1;
  } else {
    reasons.push('carousel should use at least 3 distinct template IDs');
  }

  const captionLines = content.caption.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (content.caption.length >= 40 && content.caption.length <= 2200 && captionLines.length <= 8) {
    score += 1;
  } else {
    reasons.push('caption must be between 40 and 2200 characters with at most 8 non-empty lines');
  }

  const hashtags = content.hashtags.split(/\s+/).filter(Boolean);
  const validHashtags = hashtags.every((tag) => /^#[A-Za-z0-9_]+$/.test(tag));
  const uniqueHashtagCount = new Set(hashtags).size;
  if (hashtags.length >= 3 && hashtags.length <= 30 && validHashtags && uniqueHashtagCount === hashtags.length) {
    score += 1;
  } else {
    reasons.push('hashtags must contain 3-30 unique Instagram-safe tags');
  }

  return { score, reasons };
}

/**
 * AI-powered content generator — uses Gemini 2.5 Flash to create a structured manifest.
 * Replaces the old mock logic with dynamic social media strategy.
 * Now includes account context for relevance-aware content generation.
 */
export async function generateContent(
  article: NewsArticle,
  accountProfile?: AccountProfile,
  signal?: AbortSignal
): Promise<GeneratedContent> {
  signal?.throwIfAborted();
  let content: GeneratedContent | null = null;
  try {
    // Call the AI service to generate structured manifest, caption, and hashtags.
    content = await generatePostContentAI(article, accountProfile, signal);
  } catch (error) {
    if (signal?.aborted) {
      throw signal.reason !== undefined ? signal.reason : error;
    }
    throw new Error(
      `Content generation failed for article "${article.title}" (${article.url}): ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  if (!content) {
    throw new Error(
      `Content generation returned null for article "${article.title}" (${article.url})`
    );
  }

  const minimumQualityScore = Math.min(
    MAX_CONTENT_QUALITY_SCORE,
    parsePositiveInt(process.env.MIN_CONTENT_QUALITY_SCORE, DEFAULT_MIN_CONTENT_QUALITY_SCORE)
  );
  const quality = scoreGeneratedContentQuality(content);
  if (quality.score < minimumQualityScore) {
    throw new Error(
      `Content quality score ${quality.score}/${MAX_CONTENT_QUALITY_SCORE} below minimum ${minimumQualityScore}: ${quality.reasons.join('; ')}`
    );
  }

  return content;
}
