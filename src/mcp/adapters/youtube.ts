/**
 * YouTube Shorts Platform Adapter (Stub)
 * 
 * Phase 1: Returns notImplemented for all operations.
 * Phase 2: Implement YouTube Data API v3 upload with 9:16 format support.
 */

import type {
  PlatformAdapter,
  PublishablePost,
  PublishResult,
  PostMetrics,
  PostSummary,
  ListOptions,
} from '../types';

export class YouTubeAdapter implements PlatformAdapter {
  name = 'youtube_shorts';
  supportedFormats = ['vertical' as const];

  canPublish(): boolean {
    return false;
  }

  async publish(_post: PublishablePost, _niche: string): Promise<PublishResult> {
    return {
      success: false,
      error: 'YouTube Shorts publishing not implemented (requires 9:16 format + OAuth + Data API v3)',
    };
  }

  canFetchMetrics(): boolean {
    return false;
  }

  async getMetrics(_identifier: string): Promise<PostMetrics | null> {
    return null;
  }

  async listPosts(_opts: ListOptions): Promise<PostSummary[]> {
    return [];
  }
}
