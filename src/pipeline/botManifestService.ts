/**
 * Bot manifest intake service
 * 
 * Accepts bot-produced content manifests and validates them for render + publish.
 * Bypasses Gemini AI generation entirely.
 */

import type { GeneratedContent } from './types';
import type { BotProducedManifest, BotIntakePayload } from './botManifestTypes';
import { scoreGeneratedContentQuality } from './contentGenerator';
import { isValidNicheId, getNicheBrandProfile, type NicheId } from './nicheConfig';
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
 * Process a bot intake payload: validate niche + manifest + extract source article
 */
export function processBotIntake(payload: BotIntakePayload): {
  valid: boolean;
  nicheId?: NicheId;
  content?: GeneratedContent;
  sourceArticle?: BotIntakePayload['sourceArticle'];
  errors?: string[];
} {
  logger.info('bot-intake', 'Processing bot-produced manifest', {
    nicheId: payload.nicheId,
    hasSourceArticle: Boolean(payload.sourceArticle),
    slideCount: payload.manifest?.manifest?.carousel?.length,
  });

  // Validate niche ID
  if (!payload.nicheId || !isValidNicheId(payload.nicheId)) {
    logger.error('bot-intake', 'Invalid niche ID', {
      nicheId: payload.nicheId,
      validNiches: ['psychology-micro', 'history-flash', 'legal-rights-az', 'study-hacks', 'ai-tools-daily'],
    });
    return {
      valid: false,
      errors: [`Invalid nicheId: "${payload.nicheId}". Must be one of: psychology-micro, history-flash, legal-rights-az, study-hacks, ai-tools-daily`],
    };
  }

  // Get niche brand profile
  const brandProfile = getNicheBrandProfile(payload.nicheId);

  // Validate manifest structure
  const validation = validateBotManifest(payload.manifest);
  
  if (!validation.valid) {
    logger.error('bot-intake', 'Bot manifest validation failed', {
      nicheId: payload.nicheId,
      errors: validation.errors,
    });
    return {
      valid: false,
      errors: validation.errors,
    };
  }

  // Merge bot manifest with niche branding
  const content: GeneratedContent = {
    manifest: {
      ...payload.manifest.manifest,
      globalBranding: {
        accentColor: brandProfile.accentColor,
        handle: brandProfile.handle,
        effects: brandProfile.effects,
      },
    },
    caption: payload.manifest.caption,
    hashtags: payload.manifest.hashtags,
  };

  logger.info('bot-intake', 'Bot manifest validated successfully', {
    nicheId: payload.nicheId,
    handle: brandProfile.handle,
    qualityScore: validation.score,
    slideCount: content.manifest.carousel.length,
  });

  return {
    valid: true,
    nicheId: payload.nicheId,
    content,
    sourceArticle: payload.sourceArticle,
  };
}
