/**
 * List Published Posts Tool
 * 
 * Lists recent published posts with basic metadata.
 */

import { getAdapter } from '../adapters';
import type { ListPublishedPostsInput, ListPublishedPostsOutput, PostSummary } from '../types';

export async function listPublishedPosts(input: ListPublishedPostsInput): Promise<ListPublishedPostsOutput> {
  try {
    const limit = Math.max(1, Math.min(input.limit ?? 10, 100));
    const days = input.days ? Math.max(1, Math.min(input.days, 365)) : undefined;

    let allPosts: PostSummary[] = [];

    if (input.platform) {
      // Query specific platform
      const adapter = getAdapter(input.platform);
      if (!adapter) {
        return {
          success: false,
          error: `Unknown platform: ${input.platform}`,
          errorCode: 'INVALID_PLATFORM',
        };
      }

      allPosts = await adapter.listPosts({ limit, days, niche: input.niche });
    } else {
      // Query all platforms (Instagram only in Phase 1)
      const instagram = getAdapter('instagram');
      if (instagram) {
        allPosts = await instagram.listPosts({ limit, days, niche: input.niche });
      }
    }

    // Filter by niche if provided (case-insensitive partial match in caption/hashtags)
    if (input.niche) {
      const nicheLower = input.niche.toLowerCase();
      allPosts = allPosts.filter(post => {
        const caption = (post.caption ?? '').toLowerCase();
        const hashtags = (post.hashtags ?? '').toLowerCase();
        return caption.includes(nicheLower) || hashtags.includes(nicheLower);
      });
    }

    // Sort by publishedAt or createdAt descending
    allPosts.sort((a, b) => {
      const aDate = new Date(a.publishedAt ?? a.createdAt).getTime();
      const bDate = new Date(b.publishedAt ?? b.createdAt).getTime();
      return bDate - aDate;
    });

    // Apply limit
    const posts = allPosts.slice(0, limit);

    return {
      success: true,
      posts,
      total: posts.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      errorCode: 'LIST_FAILED',
    };
  }
}
