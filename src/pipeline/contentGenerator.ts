import { generatePostContentAI } from './aiService';
import type { NewsArticle, GeneratedContent } from './types';
import type { AccountProfile } from './accountProfile';

/**
 * AI-powered content generator — uses Gemini 2.5 Flash to create a structured manifest.
 * Replaces the old mock logic with dynamic social media strategy.
 * Now includes account context for relevance-aware content generation.
 */
export async function generateContent(
  article: NewsArticle,
  accountProfile?: AccountProfile
): Promise<GeneratedContent> {
  // Call the AI Service to generate structured manifestation, caption, and hashtags
  const content = await generatePostContentAI(article, accountProfile);

  return content;
}
