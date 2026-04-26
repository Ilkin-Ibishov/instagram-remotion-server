/**
 * Generates a character n-gram fingerprint for a title to detect duplicates
 * even after significant rewrites or synonym substitution (e.g. Gemini transformations).
 * 
 * Uses trigrams (3-character sliding window) which captures structural similarity
 * even when every word changes — critical for catching GNews syndication duplicates
 * that Gemini rewrites with entirely different vocabulary.
 */

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'when',
  'at', 'from', 'by', 'for', 'with', 'about', 'against', 'between',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'to', 'of', 'in', 'on', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'its', 'it', 'has', 'have', 'had', 'not', 'no', 'can', 'will', 'than',
  'that', 'this', 'these', 'those', 'which', 'who', 'whom', 'what',
]);

/**
 * Normalize a title for comparison:
 * - Lowercase
 * - Strip common prefixes ("Breaking:", "[Breaking]", etc.)
 * - Remove punctuation and special characters
 * - Collapse whitespace
 */
function normalizeTitle(title: string): string {
  if (!title) return '';
  
  let t = title.toLowerCase();
  
  // Strip common prefixes that add noise
  t = t.replace(/^\[?(breaking|urgent|developing|exclusive|update)\]?:?\s*/i, '');
  
  // Remove punctuation (keep spaces and alphanumeric)
  t = t.replace(/[^\w\s]|_/g, '');
  
  // Collapse whitespace
  t = t.replace(/\s+/g, ' ').trim();
  
  return t;
}

/**
 * Extract character trigrams from normalized text.
 * Pads with spaces to handle short titles.
 */
function extractTrigrams(text: string): Set<string> {
  // Optional: remove stop words to reduce noise in trigram matching
  const filtered = text.split(/\s+/)
    .filter(w => w.length > 0 && !STOP_WORDS.has(w))
    .join(' ');
  
  const padded = `  ${filtered} `; // front-pad 2, back-pad 1
  const trigrams = new Set<string>();
  
  for (let i = 0; i < padded.length - 2; i++) {
    trigrams.add(padded.substring(i, i + 3));
  }
  
  return trigrams;
}

/**
 * Create a trigram-based fingerprint for a title.
 */
export function createTitleFingerprint(title: string): string {
  if (!title) return '';
  const normalized = normalizeTitle(title);
  const trigrams = extractTrigrams(normalized);
  return [...trigrams].sort().join(' ');
}

/**
 * Calculate similarity between two title fingerprints using trigram overlap.
 * Returns a value between 0 (completely different) and 1 (identical).
 * 
 * Typical thresholds:
 *   > 0.80  — near-identical (same headline, minor formatting)
 *   > 0.55  — same story, Gemini-rewritten (typical rewrite range)
 *   > 0.35  — same topic, different angles
 *   < 0.20  — different stories
 * 
 * `postHistory.ts` uses **0.35** (`FINGERPRINT_SIMILARITY_THRESHOLD`): a **lower** bar than
 * the 0.55 “Gemini rewrite” band above, so more pairs count as duplicates (more aggressive
 * dedup, with some risk of suppressing legitimately different angles). Tune in `postHistory.ts` if needed.
 */
export function calculateSimilarity(fp1: string, fp2: string): number {
  const set1 = new Set(fp1.split(' ').filter(Boolean));
  const set2 = new Set(fp2.split(' ').filter(Boolean));
  
  if (set1.size === 0 || set2.size === 0) return 0;
  
  // Intersection / max (not min) — penalizes length disparity
  let intersection = 0;
  for (const item of set1) {
    if (set2.has(item)) intersection++;
  }
  
  return intersection / Math.max(set1.size, set2.size);
}
