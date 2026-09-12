/**
 * Bot-produced content manifest contract
 * 
 * This is the input format that teammate bots (niche voice, trend scout)
 * or Cursor/Grok agents should produce to bypass Gemini AI generation.
 * 
 * The manifest includes both the Remotion render instructions and
 * Instagram publish metadata (caption, hashtags).
 */

import type { GeneratedContent } from './types';

/**
 * Bot manifest: Complete content ready for render + publish
 * 
 * Matches the GeneratedContent type exactly, but explicitly documents
 * that this comes from a bot/agent, not from Gemini.
 */
export interface BotProducedManifest extends GeneratedContent {
  // Inherited from GeneratedContent:
  // manifest: CarouselManifest (with globalBranding + carousel slides)
  // caption: string (Instagram caption text)
  // hashtags: string (space-separated hashtags)
}

/**
 * Optional: Source article metadata for tracking/context
 * Not required for render, but useful for dedup/history tracking
 */
export interface BotManifestSourceArticle {
  title: string;
  url: string;
  description?: string;
  source?: string;
  publishedAt?: string;
}

/**
 * Complete bot intake payload: manifest + niche + optional source tracking
 */
export interface BotIntakePayload {
  nicheId: string; // One of: psychology-micro, history-flash, legal-rights-az, study-hacks, ai-tools-daily
  manifest: BotProducedManifest;
  sourceArticle?: BotManifestSourceArticle;
}

/**
 * JSON Schema for bot-produced manifests (for external bot validation)
 * 
 * Template IDs:
 * - HOOK_A: Opening hook with optional background image
 * - CONTENT_LISTICLE: Numbered list (exactly 4 items)
 * - CONTENT_GENERIC: Title + body + highlight
 * - CONTENT_STAT_SNAPSHOT: Data-focused slide with metric
 * - CONTENT_MYTH_VS_FACT: Contrast slide (myth vs fact)
 * - CONTENT_VIDEO: Video frame with title overlay
 * - CTA_FINAL: Closing call-to-action (must end with "?")
 * 
 * Field length limits are documented in context/templates.md
 */
export const BOT_MANIFEST_JSON_SCHEMA = {
  type: 'object',
  required: ['manifest', 'caption', 'hashtags'],
  properties: {
    manifest: {
      type: 'object',
      required: ['format', 'globalBranding', 'carousel'],
      properties: {
        format: { 
          type: 'string',
          enum: ['instagram_carousel', 'png', 'mp4'],
          description: 'Output format (use "mp4" for video, "png" for stills)'
        },
        globalBranding: {
          type: 'object',
          required: ['accentColor', 'handle', 'effects'],
          properties: {
            accentColor: { 
              type: 'string',
              pattern: '^#[0-9A-Fa-f]{6}$',
              description: 'Hex color (e.g. "#3B82F6")'
            },
            handle: { 
              type: 'string',
              minLength: 1,
              description: 'Instagram handle (e.g. "@technewsbot")'
            },
            effects: {
              type: 'array',
              items: { type: 'string' },
              description: 'Visual effects overlay (e.g. ["scanlines", "chromatic"])'
            }
          }
        },
        carousel: {
          type: 'array',
          minItems: 3,
          maxItems: 5,
          items: {
            type: 'object',
            required: ['templateId', 'data'],
            properties: {
              templateId: {
                type: 'string',
                enum: ['HOOK_A', 'CONTENT_LISTICLE', 'CONTENT_GENERIC', 
                       'CONTENT_STAT_SNAPSHOT', 'CONTENT_MYTH_VS_FACT', 
                       'CONTENT_VIDEO', 'CTA_FINAL']
              },
              data: {
                type: 'object',
                description: 'Template-specific data (see context/templates.md for per-template schemas)'
              }
            }
          }
        }
      }
    },
    caption: {
      type: 'string',
      minLength: 40,
      maxLength: 2200,
      description: 'Instagram caption (4-8 lines, use \\n for line breaks)'
    },
    hashtags: {
      type: 'string',
      minLength: 1,
      description: 'Space-separated hashtags (3-30 tags, e.g. "#tech #ai #startup")'
    }
  }
} as const;
