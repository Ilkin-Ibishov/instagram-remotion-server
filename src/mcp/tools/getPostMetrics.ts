/**
 * Get Post Metrics Tool
 * 
 * Retrieves engagement metrics for a published post.
 */

import { getAdapter } from '../adapters';
import type { GetPostMetricsInput, GetPostMetricsOutput } from '../types';

export async function getPostMetrics(input: GetPostMetricsInput): Promise<GetPostMetricsOutput> {
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

    // Check if platform can fetch metrics
    if (!adapter.canFetchMetrics()) {
      return {
        success: false,
        platform: input.platform,
        error: `Metrics scraping not implemented for ${adapter.name}`,
        errorCode: 'NOT_IMPLEMENTED',
        notImplemented: true,
      };
    }

    // Require either permalink or batchId
    const identifier = input.permalink || input.batchId;
    if (!identifier) {
      return {
        success: false,
        platform: input.platform,
        error: 'Either permalink or batchId is required',
        errorCode: 'MISSING_IDENTIFIER',
      };
    }

    // Fetch metrics via adapter
    const metrics = await adapter.getMetrics(identifier);

    if (!metrics) {
      // Phase 1: Instagram adapter returns null (metrics not yet scraped)
      return {
        success: false,
        platform: input.platform,
        error: 'Metrics not available for this post (live scraping not yet implemented)',
        errorCode: 'METRICS_NOT_AVAILABLE',
      };
    }

    return {
      success: true,
      platform: input.platform,
      permalink: input.permalink,
      metrics,
    };
  } catch (error) {
    return {
      success: false,
      platform: input.platform,
      error: error instanceof Error ? error.message : String(error),
      errorCode: 'METRICS_FETCH_FAILED',
    };
  }
}
