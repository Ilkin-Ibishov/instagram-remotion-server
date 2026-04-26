import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Account Profile: Defines the Instagram account's identity, niche, and preferences.
 * This helps the pipeline select relevant news and guide AI content generation.
 */
export interface AccountProfile {
  handle: string;
  displayName: string;
  bio: string;
  niche: string[];
  accentColor: string;
  effects: string[];
}

const ALLOWED_EFFECTS = new Set(['crt', 'noise', 'vignette', 'chromatic', 'halftone']);

function parseNicheValues(raw: string): string[] {
  const niche = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);

  if (niche.length === 0) {
    throw new Error('BRAND_NICHE must contain at least one non-empty value');
  }

  return niche;
}

function parseEffectValues(raw: string): string[] {
  const candidates = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);

  const invalid = candidates.filter((effect) => !ALLOWED_EFFECTS.has(effect));
  if (invalid.length > 0) {
    console.warn(
      `[account-profile] Ignoring unknown BRAND_EFFECTS values: ${invalid.join(', ')}. Allowed: ${[
        ...ALLOWED_EFFECTS,
      ].join(', ')}`
    );
  }

  return candidates.filter((effect) => ALLOWED_EFFECTS.has(effect));
}

/**
 * Load account profile from environment variables.
 * Allows runtime configuration without code changes.
 */
export function loadAccountProfile(): AccountProfile {
  const handle = process.env.BRAND_HANDLE || '@breaking_news';
  const displayName = process.env.BRAND_DISPLAY_NAME || 'Breaking News';
  const bio = process.env.BRAND_BIO || 'Latest tech and business news';
  const nicheString = process.env.BRAND_NICHE || 'technology,business,startup';
  const accentColor = process.env.BRAND_ACCENT_COLOR || '#ef4444';
  const effectsString = process.env.BRAND_EFFECTS || 'vignette,chromatic,halftone';

  const niche = parseNicheValues(nicheString);
  const effects = parseEffectValues(effectsString);

  return {
    handle,
    displayName,
    bio,
    niche,
    accentColor,
    effects,
  };
}

/**
 * Extract keywords from account bio for relevance scoring.
 * Also includes niche keywords.
 * Filters out generic/common words that don't discriminate.
 */
export function getAccountKeywords(profile: AccountProfile): string[] {
  const keywords = new Set<string>();

  // Add niche categories
  profile.niche.forEach(n => keywords.add(n));

  // Common English words that don't help with discrimination
  // These match too many articles and create false positives
  const commonWords = new Set([
    // Generic tech terms
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'our', 'can', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'end', 'let', 'put', 'say', 'she', 'too', 'use',
    // Too generic tech keywords
    'tech',                // Matches "technology", "technique", "technical" — too broad
    'news',                // Matches any article with "news" (not a discriminator)
    'dev',                 // Ambiguous: "developer", "device", "devops", "development"
    'it',                  // Matches "IT" (too generic)
    'web',                 // Too generic for web development
    'app',                 // Too generic
    'data',                // Too generic
    'new',                 // Matches nearly every article
    'ai',                  // Matches "AI", "aid", "aim" (too ambiguous)
  ]);

  // Extract words from bio (min 3 chars, exclude common words)
  const bioWords = profile.bio
    .toLowerCase()
    .split(/[\s,\-.!?]+/)
    .filter(w => w.length >= 3 && !commonWords.has(w));

  bioWords.forEach(w => keywords.add(w));

  const allKeywords = Array.from(keywords);
  
  // Sort by specificity: longer/more specific terms first
  allKeywords.sort((a, b) => b.length - a.length);

  return allKeywords;
}
