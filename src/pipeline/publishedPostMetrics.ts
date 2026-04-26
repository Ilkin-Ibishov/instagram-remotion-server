import crypto from 'crypto';
import type { GeneratedContent, NewsArticle } from './types';
import type { RenderManifestInput } from '../render/renderService';

export type PostQualityMetrics = {
  slideCount: number;
  templateSequence: string[];
  templateSequenceHash: string;
  captionLength: number;
  hashtagCount: number;
  hasQuestionCta: boolean;
  hookText: string;
  hookFingerprint: string;
  topicFingerprint: string;
  articleAgeHours: number | null;
  sourceDomain: string | null;
  contentQualityScore: number;
  reasons: string[];
};

export type PostQualitySnapshot = PostQualityMetrics;

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sourceDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function articleAgeHours(article: NewsArticle, now: Date): number | null {
  const publishedAt = Date.parse(article.publishedAt);
  if (!Number.isFinite(publishedAt)) {
    return null;
  }
  return Math.max(0, Math.round(((now.getTime() - publishedAt) / 3_600_000) * 10) / 10);
}

function qualityReasons(metrics: Omit<PostQualityMetrics, 'contentQualityScore' | 'reasons'>): string[] {
  const reasons: string[] = [];
  if (metrics.slideCount >= 3 && metrics.slideCount <= 5) reasons.push('slide_count_ok');
  if (new Set(metrics.templateSequence).size >= 3) reasons.push('template_variety_ok');
  if (metrics.captionLength >= 40 && metrics.captionLength <= 2200) reasons.push('caption_length_ok');
  if (metrics.hashtagCount >= 3 && metrics.hashtagCount <= 30) reasons.push('hashtag_count_ok');
  if (metrics.hasQuestionCta) reasons.push('question_cta_ok');
  return reasons;
}

export function computePostQualityMetrics(
  article: NewsArticle,
  content: GeneratedContent,
  now = new Date()
): PostQualityMetrics {
  const slides = content.manifest.carousel as RenderManifestInput['carousel'];
  const templateSequence = slides.map((slide) => slide.templateId);
  const hookSlide = slides.find((slide) => slide.templateId === 'HOOK_A');
  const hookText = String(hookSlide?.data?.headline ?? hookSlide?.data?.title ?? '');
  const ctaSlide = slides.find((slide) => slide.templateId === 'CTA_FINAL');
  const ctaText = String(ctaSlide?.data?.callToAction ?? '');
  const hashtags = content.hashtags.split(/\s+/).filter((tag) => tag.startsWith('#'));
  const base = {
    slideCount: slides.length,
    templateSequence,
    templateSequenceHash: sha256(templateSequence.join('>')),
    captionLength: content.caption.length,
    hashtagCount: hashtags.length,
    hasQuestionCta: ctaText.trim().endsWith('?'),
    hookText,
    hookFingerprint: sha256(normalizeText(hookText)),
    topicFingerprint: sha256(normalizeText(`${article.title} ${article.description}`)),
    articleAgeHours: articleAgeHours(article, now),
    sourceDomain: sourceDomain(article.url),
  };
  const reasons = qualityReasons(base);
  return {
    ...base,
    contentQualityScore: reasons.length,
    reasons,
  };
}

export function summarizeTemplateSequence(slides: RenderManifestInput['carousel']): string[] {
  return slides.map((slide) => slide.templateId);
}

export function buildCreativeFingerprints({
  articleTitle,
  content,
}: {
  articleTitle: string;
  content: GeneratedContent;
}): {
  hookFingerprint: string;
  topicFingerprint: string;
  templateSequenceHash: string;
  captionFingerprint: string;
} {
  const slides = content.manifest.carousel as RenderManifestInput['carousel'];
  const hookSlide = slides.find((slide) => slide.templateId === 'HOOK_A');
  const hookText = String(hookSlide?.data?.headline ?? hookSlide?.data?.title ?? '');
  return {
    hookFingerprint: sha256(normalizeText(hookText)),
    topicFingerprint: sha256(normalizeText(articleTitle)),
    templateSequenceHash: sha256(summarizeTemplateSequence(slides).join('>')),
    captionFingerprint: sha256(normalizeText(content.caption)),
  };
}

export function scorePublishedPostQuality({
  articlePublishedAt,
  content,
  now = new Date(),
}: {
  articlePublishedAt?: string;
  content: GeneratedContent;
  now?: Date;
}): PostQualityMetrics {
  return computePostQualityMetrics(
    {
      title: '',
      description: '',
      content: '',
      url: '',
      publishedAt: articlePublishedAt || '',
      source: '',
    },
    content,
    now
  );
}

export function buildQualitySnapshot({
  article,
  content,
}: {
  article: NewsArticle;
  content: GeneratedContent;
  selectedScore?: number;
  selectedReasons?: string[];
}): PostQualitySnapshot {
  return computePostQualityMetrics(article, content);
}
