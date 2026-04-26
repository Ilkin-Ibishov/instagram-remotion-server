export const VALID_TEMPLATE_IDS = [
  'HOOK_A',
  'CONTENT_LISTICLE',
  'CONTENT_GENERIC',
  'CONTENT_STAT_SNAPSHOT',
  'CONTENT_MYTH_VS_FACT',
  'CONTENT_VIDEO',
  'CTA_FINAL'
] as const;

export type TemplateId = typeof VALID_TEMPLATE_IDS[number];

export interface SlideData {
  templateId: TemplateId;
  data: Record<string, unknown>;
}

export interface GlobalBranding {
  accentColor: string;
  handle: string;
  effects: string[];
}

export interface CarouselManifest {
  format: string;
  globalBranding: GlobalBranding;
  carousel: SlideData[];
}

export interface GeneratedContent {
  manifest: CarouselManifest;
  caption: string;
  hashtags: string;
}

export interface NewsArticle {
  articleId?: string;
  title: string;
  description: string;
  content: string;
  url: string;
  imageUrl?: string;
  publishedAt: string;
  source: string;
}

export type PipelineStatus = 'pending' | 'generating' | 'rendering' | 'publishing' | 'done' | 'error';

export interface PipelineResult {
  status: PipelineStatus;
  content?: GeneratedContent;
  error?: string;
}

export interface PublishablePost {
  id?: string;
  mediaPaths: string[];
  caption: string;
  isCarousel: boolean;
}

export interface InstagramPublishResult {
  confirmed: boolean;
  permalink?: string;
  verificationMethod: 'profile_permalink' | 'dom_confirmation' | 'url_confirmation' | 'ui_confirmation';
  baselinePermalinkCount?: number;
  newPermalinkDetectedAt?: string;
  publishDurationMs: number;
}
