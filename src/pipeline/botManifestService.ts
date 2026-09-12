/**
 * Bot manifest intake service
 * 
 * Accepts bot-produced content manifests and validates them for render + publish.
 * Bypasses Gemini AI generation entirely.
 */

import type { GeneratedContent } from './types';
import type { BotProducedManifest, BotIntakePayload } from './botManifestTypes';
import { scoreGeneratedContentQuality } from './contentGenerator';
import Logger from '../utils/logger';

const logger = new Logger('bot-manifest-service');

/**
 * Validate a bot-produced manifest against quality gates
 * (same gates used for Gemini-generated content)
 */
export function validateBotManifest(manifest: BotProducedManifest): {
  valid: boolean;
  errors: string[];
  score?: number;
  reasons?: string[];
} {
  const errors: string[] = [];

  // Type-level validation
  if (!manifest.manifest) {
    errors.push('Missing manifest.manifest field');
  }
  if (!manifest.manifest?.globalBranding) {
    errors.push('Missing manifest.manifest.globalBranding');
  }
  if (!manifest.manifest?.carousel || !Array.isArray(manifest.manifest.carousel)) {
    errors.push('manifest.manifest.carousel must be an array');
  }
  if (!manifest.caption || typeof manifest.caption !== 'string') {
    errors.push('caption must be a non-empty string');
  }
  if (!manifest.hashtags || typeof manifest.hashtags !== 'string') {
    errors.push('hashtags must be a non-empty string');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Quality scoring (same as AI-generated content)
  try {
    const content: GeneratedContent = {
      manifest: manifest.manifest,
      caption: manifest.caption,
      hashtags: manifest.hashtags,
    };
    const quality = scoreGeneratedContentQuality(content);
    
    if (quality.score < 4) {
      return {
        valid: false,
        errors: [`Content quality score ${quality.score}/5 below minimum (4)`, ...quality.reasons],
        score: quality.score,
        reasons: quality.reasons,
      };
    }

    logger.info('bot-manifest-validation', 'Bot manifest passed quality gates', {
      score: quality.score,
      slideCount: manifest.manifest.carousel.length,
    });

    return {
      valid: true,
      errors: [],
      score: quality.score,
      reasons: quality.reasons,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      valid: false,
      errors: [`Quality validation failed: ${message}`],
    };
  }
}

/**
 * Process a bot intake payload: validate manifest + extract source article
 */
export function processBotIntake(payload: BotIntakePayload): {
  valid: boolean;
  content?: GeneratedContent;
  sourceArticle?: BotIntakePayload['sourceArticle'];
  errors?: string[];
} {
  logger.info('bot-intake', 'Processing bot-produced manifest', {
    hasSourceArticle: Boolean(payload.sourceArticle),
    slideCount: payload.manifest?.manifest?.carousel?.length,
  });

  const validation = validateBotManifest(payload.manifest);
  
  if (!validation.valid) {
    logger.error('bot-intake', 'Bot manifest validation failed', {
      errors: validation.errors,
    });
    return {
      valid: false,
      errors: validation.errors,
    };
  }

  const content: GeneratedContent = {
    manifest: payload.manifest.manifest,
    caption: payload.manifest.caption,
    hashtags: payload.manifest.hashtags,
  };

  logger.info('bot-intake', 'Bot manifest validated successfully', {
    qualityScore: validation.score,
    slideCount: content.manifest.carousel.length,
  });

  return {
    valid: true,
    content,
    sourceArticle: payload.sourceArticle,
  };
}
