/**
 * Instagram Platform Adapter
 * 
 * Wraps existing Instagram automation and metrics for MCP platform.
 */

import { publishToInstagram } from '../../automation/instagramPublisher';
import { getRecentPublishedPosts } from '../../pipeline/publishedPostStore';
import type {
  PlatformAdapter,
  PublishablePost,
  PublishResult,
  PostMetrics,
  PostSummary,
  ListOptions,
} from '../types';

export class InstagramAdapter implements PlatformAdapter {
  name = 'instagram';
  supportedFormats = ['square' as const];

  canPublish(): boolean {
    // Instagram publish available if storage.json exists
    return true;
  }

  async publish(post: PublishablePost, _niche: string): Promise<PublishResult> {
    try {
      const result = await publishToInstagram({
        id: post.mediaPaths.join(','),
        mediaPaths: post.mediaPaths,
        caption: post.caption,
        isCarousel: post.isCarousel,
      });

      return {
        success: result.confirmed,
        permalink: result.permalink,
        verificationMethod: result.verificationMethod,
        publishDurationMs: result.publishDurationMs,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  canFetchMetrics(): boolean {
    // Metrics read available from published_posts store
    return true;
  }

  async getMetrics(identifier: string): Promise<PostMetrics | null> {
    // Phase 1: Return null (metrics not yet scraped live)
    // Phase 2: Implement live scraping via Playwright or Graph API
    // For now, metrics are captured at publish time in publishedPostStore
    return null;
  }

  async listPosts(opts: ListOptions): Promise<PostSummary[]> {
    try {
      const rows = await getRecentPublishedPosts(opts.limit ?? 10, opts.days);
      
      return rows.map((row) => ({
        batchId: row.batch_id,
        platform: 'instagram',
        permalink: row.instagram_permalink ?? undefined,
        caption: row.caption ?? undefined,
        hashtags: row.hashtags ?? undefined,
        publishedAt: row.published_at ? new Date(row.published_at).toISOString() : undefined,
        createdAt: new Date(row.created_at).toISOString(),
        status: row.status,
        templateSequence: row.template_sequence ?? undefined,
      }));
    } catch (error) {
      console.error('[instagram-adapter] Failed to list posts:', error);
      return [];
    }
  }
}
