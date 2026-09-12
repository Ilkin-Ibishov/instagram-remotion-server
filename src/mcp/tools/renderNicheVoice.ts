/**
 * Render Niche Voice Tool
 * 
 * Renders content for a specific niche using account branding.
 */

import type { RenderNicheVoiceInput, RenderNicheVoiceOutput, Niche } from '../types';

const VALID_NICHES: Set<Niche> = new Set(['technology', 'business', 'startup', 'ai', 'science']);

export async function renderNicheVoice(input: RenderNicheVoiceInput): Promise<RenderNicheVoiceOutput> {
  try {
    // Validate niche
    if (!VALID_NICHES.has(input.niche)) {
      return {
        success: false,
        error: `Invalid niche "${input.niche}". Must be one of: ${Array.from(VALID_NICHES).join(', ')}`,
        errorCode: 'INVALID_NICHE',
      };
    }

    // Validate manifest structure
    if (!input.manifest?.globalBranding || !Array.isArray(input.manifest?.carousel)) {
      return {
        success: false,
        error: 'Invalid manifest: must include globalBranding and carousel array',
        errorCode: 'INVALID_MANIFEST',
      };
    }

    const format = input.format || 'mp4';

    // Delegate to existing render endpoint
    const renderHost = process.env.RENDER_HOST || 'http://localhost:3000';
    const response = await fetch(`${renderHost}/api/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        globalBranding: input.manifest.globalBranding,
        carousel: input.manifest.carousel,
        format,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Render failed: ${response.status} ${response.statusText} - ${errorText}`,
        errorCode: 'RENDER_FAILED',
      };
    }

    const result = await response.json() as {
      success: boolean;
      batchId?: string;
      images?: string[];
      videos?: string[];
      error?: string;
    };

    if (!result.success || !result.batchId) {
      return {
        success: false,
        error: result.error || 'Render failed without error message',
        errorCode: 'RENDER_FAILED',
      };
    }

    const renderUrls = format === 'mp4' ? result.videos : result.images;
    const mediaPaths = renderUrls?.map(url => {
      // Convert /api/renders/render-{batchId}-{i}.{ext} to local path
      const filename = url.split('/').pop();
      const renderDir = process.env.RENDER_DIR || '/tmp/renders';
      return `${renderDir}/${filename}`;
    }) ?? [];

    return {
      success: true,
      batchId: result.batchId,
      renderUrls: renderUrls ?? [],
      mediaPaths,
      format,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      errorCode: 'RENDER_FAILED',
    };
  }
}
