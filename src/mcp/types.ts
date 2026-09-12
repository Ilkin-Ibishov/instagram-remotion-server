/**
 * MCP Platform Types
 * 
 * Shared types for MCP tools and platform adapters.
 */

import type { CarouselManifest } from '../pipeline/types';

export type Platform = 'instagram' | 'tiktok' | 'youtube_shorts';
export type Niche = 'technology' | 'business' | 'startup' | 'ai' | 'science';
export type RenderFormat = 'png' | 'mp4';

export interface RenderNicheVoiceInput {
  niche: Niche;
  manifest: CarouselManifest;
  format?: RenderFormat;
}

export interface RenderNicheVoiceOutput {
  success: boolean;
  batchId?: string;
  renderUrls?: string[];
  mediaPaths?: string[];
  format?: RenderFormat;
  error?: string;
  errorCode?: string;
}

export interface PublishPostInput {
  platform: Platform;
  mediaPaths: string[];
  caption: string;
  niche: string;
  metadata?: {
    hashtags?: string[];
    location?: string;
    schedule?: string;
  };
}

export interface PublishPostOutput {
  success: boolean;
  platform: string;
  permalink?: string;
  verificationMethod?: string;
  publishDurationMs?: number;
  error?: string;
  errorCode?: string;
  notImplemented?: boolean;
}

export interface PostMetrics {
  likes?: number;
  comments?: number;
  views?: number;
  saves?: number;
  shares?: number;
  holds3s?: number;
  follows?: number;
  profileVisits?: number;
  capturedAt: string;
}

export interface GetPostMetricsInput {
  platform: Platform;
  permalink?: string;
  batchId?: string;
  niche?: string;
}

export interface GetPostMetricsOutput {
  success: boolean;
  platform: string;
  permalink?: string;
  metrics?: PostMetrics;
  error?: string;
  errorCode?: string;
  notImplemented?: boolean;
}

export interface ListPublishedPostsInput {
  platform?: Platform;
  niche?: string;
  limit?: number;
  days?: number;
}

export interface PostSummary {
  batchId: string;
  platform: string;
  permalink?: string;
  caption?: string;
  hashtags?: string;
  publishedAt?: string;
  createdAt: string;
  status: string;
  templateSequence?: string[];
}

export interface ListPublishedPostsOutput {
  success: boolean;
  posts?: PostSummary[];
  total?: number;
  error?: string;
  errorCode?: string;
}

export interface NicheInfo {
  id: string;
  displayName: string;
  platforms: string[];
}

export interface ListNichesOutput {
  success: boolean;
  niches?: NicheInfo[];
  error?: string;
}

// Platform adapter interface
export interface PublishablePost {
  mediaPaths: string[];
  caption: string;
  isCarousel: boolean;
}

export interface PublishResult {
  success: boolean;
  permalink?: string;
  verificationMethod?: string;
  publishDurationMs?: number;
  error?: string;
}

export interface ListOptions {
  limit?: number;
  days?: number;
  niche?: string;
}

export interface PlatformAdapter {
  name: string;
  supportedFormats: ('square' | 'vertical')[];
  
  canPublish(): boolean;
  publish(post: PublishablePost, niche: string): Promise<PublishResult>;
  
  canFetchMetrics(): boolean;
  getMetrics(identifier: string): Promise<PostMetrics | null>;
  
  listPosts(opts: ListOptions): Promise<PostSummary[]>;
}
