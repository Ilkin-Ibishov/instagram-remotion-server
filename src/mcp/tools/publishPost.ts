/**
 * Publish Post Tool
 * 
 * Publishes rendered media to a platform.
 */

import { getAdapter } from '../adapters';
import type { PublishPostInput, PublishPostOutput } from '../types';
import { existsSync } from 'fs';

export async function publishPost(input: PublishPostInput): Promise<PublishPostOutput> {
  try {
    // Get platform adapter
    const adapter = getAdapter(input.platform);
    if (!adapter) {
      return {
        success: false,
        platform: input.platform,
        error: `Unknown platform: ${input.platform}`,
        errorCode: 'INVALID_PLATFORM',
      };
    }

    // Check if platform can publish
    if (!adapter.canPublish()) {
      return {
        success: false,
        platform: input.platform,
        error: `${adapter.name} publishing not implemented`,
        errorCode: 'NOT_IMPLEMENTED',
        notImplemented: true,
      };
    }

    // Validate media paths exist
    const missingPaths = input.mediaPaths.filter(path => !existsSync(path));
    if (missingPaths.length > 0) {
      return {
        success: false,
        platform: input.platform,
        error: `Media files not found: ${missingPaths.join(', ')}`,
        errorCode: 'MEDIA_NOT_FOUND',
      };
    }

    // Publish via adapter
    const result = await adapter.publish({
      mediaPaths: input.mediaPaths,
      caption: input.caption,
      isCarousel: input.mediaPaths.length > 1,
    }, input.niche);

    return {
      success: result.success,
      platform: input.platform,
      permalink: result.permalink,
      verificationMethod: result.verificationMethod,
      publishDurationMs: result.publishDurationMs,
      error: result.error,
      errorCode: result.error ? 'PUBLISH_FAILED' : undefined,
    };
  } catch (error) {
    return {
      success: false,
      platform: input.platform,
      error: error instanceof Error ? error.message : String(error),
      errorCode: 'PUBLISH_FAILED',
    };
  }
}
