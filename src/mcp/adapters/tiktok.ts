/**
 * TikTok Platform Adapter (Stub)
 * 
 * Phase 1: Returns notImplemented for all operations.
 * Phase 2: Implement TikTok automation with 9:16 format support.
 */

import type {
  PlatformAdapter,
  PublishablePost,
  PublishResult,
  PostMetrics,
  PostSummary,
  ListOptions,
} from '../types';

export class TikTokAdapter implements PlatformAdapter {
  name = 'tiktok';
  supportedFormats = ['vertical' as const];

  canPublish(): boolean {
    return false;
  }

  async publish(_post: PublishablePost, _niche: string): Promise<PublishResult> {
    return {
      success: false,
      error: 'TikTok publishing not implemented (requires 9:16 format + platform automation)',
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
