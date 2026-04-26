export { config } from './config';
export { generateContent } from './contentGenerator';
export { generatePostContentAI } from './aiService';
export { fetchRssNews } from './rssService';
export { getSourcesForNiche, RSS_SOURCES } from './rssSourceRegistry';
export type {
  NewsArticle,
  TemplateId,
  SlideData,
  GlobalBranding,
  CarouselManifest,
  GeneratedContent,
  PipelineStatus,
  PipelineResult,
} from './types';
