/**
 * Multi-niche brand configuration
 * 
 * HARD CONSTRAINT: These 5 niche IDs are locked by product owner.
 * Do NOT invent or add other niches.
 */

export const LOCKED_NICHE_IDS = [
  'psychology-micro',
  'history-flash',
  'legal-rights-az',
  'study-hacks',
  'ai-tools-daily',
] as const;

export type NicheId = typeof LOCKED_NICHE_IDS[number];

/**
 * Niche brand profile: visual identity + voice + content focus
 */
export interface NicheBrandProfile {
  nicheId: NicheId;
  handle: string;
  displayName: string;
  bio: string;
  accentColor: string;
  effects: string[];
  keywords: string[];
  contentFocus: string;
}

/**
 * Complete niche brand configuration
 * Product owner locked these 5 niches - do not modify IDs
 */
export const NICHE_CONFIGS: Record<NicheId, NicheBrandProfile> = {
  'psychology-micro': {
    nicheId: 'psychology-micro',
    handle: '@psychmicro',
    displayName: 'Psychology Micro',
    bio: 'Quick psychology insights you can use today. Cognitive biases, behavioral patterns, mental models.',
    accentColor: '#8B5CF6', // Purple
    effects: ['scanlines', 'grain'],
    keywords: [
      'psychology',
      'cognitive bias',
      'behavioral science',
      'mental health',
      'emotional intelligence',
      'decision making',
      'mindset',
      'social psychology',
    ],
    contentFocus: 'Practical psychology insights, cognitive biases, mental models, emotional intelligence',
  },

  'history-flash': {
    nicheId: 'history-flash',
    handle: '@historyflash',
    displayName: 'History Flash',
    bio: 'History that hits different. Forgotten events, wild stories, the context they never taught you.',
    accentColor: '#D97706', // Amber
    effects: ['chromatic', 'vignette'],
    keywords: [
      'history',
      'historical events',
      'forgotten stories',
      'world history',
      'historical context',
      'ancient history',
      'modern history',
      'hidden history',
    ],
    contentFocus: 'Forgotten historical events, wild historical stories, contextual deep dives',
  },

  'legal-rights-az': {
    nicheId: 'legal-rights-az',
    handle: '@legalrightsaz',
    displayName: 'Legal Rights A-Z',
    bio: 'Your legal rights explained in plain English. Know your rights, protect yourself, stay informed.',
    accentColor: '#0EA5E9', // Sky blue
    effects: ['scanlines'],
    keywords: [
      'legal rights',
      'consumer rights',
      'employment law',
      'tenant rights',
      'civil rights',
      'legal advice',
      'your rights',
      'law explained',
    ],
    contentFocus: 'Legal rights education, consumer protection, employment rights, plain-language law',
  },

  'study-hacks': {
    nicheId: 'study-hacks',
    handle: '@studyhacks',
    displayName: 'Study Hacks',
    bio: 'Learn faster, remember longer. Science-backed study techniques for students who want results.',
    accentColor: '#10B981', // Emerald green
    effects: ['grain', 'chromatic'],
    keywords: [
      'study tips',
      'learning techniques',
      'memory',
      'productivity',
      'exam prep',
      'note-taking',
      'retention',
      'spaced repetition',
    ],
    contentFocus: 'Evidence-based study techniques, memory strategies, learning optimization',
  },

  'ai-tools-daily': {
    nicheId: 'ai-tools-daily',
    handle: '@aitoolsdaily',
    displayName: 'AI Tools Daily',
    bio: 'New AI tools every day. Productivity boosters, creative helpers, automation wizards.',
    accentColor: '#3B82F6', // Blue
    effects: ['scanlines', 'chromatic'],
    keywords: [
      'AI tools',
      'artificial intelligence',
      'productivity',
      'automation',
      'machine learning',
      'ChatGPT',
      'AI apps',
      'tech tools',
    ],
    contentFocus: 'AI tool discovery, productivity automation, creative AI applications',
  },
};

/**
 * Get all configured niche IDs
 */
export function getAllNicheIds(): NicheId[] {
  return [...LOCKED_NICHE_IDS];
}

/**
 * Get brand profile for a specific niche
 */
export function getNicheBrandProfile(nicheId: NicheId): NicheBrandProfile {
  const profile = NICHE_CONFIGS[nicheId];
  if (!profile) {
    throw new Error(`Invalid niche ID: ${nicheId}. Must be one of: ${LOCKED_NICHE_IDS.join(', ')}`);
  }
  return profile;
}

/**
 * Validate niche ID against locked list
 */
export function isValidNicheId(id: string): id is NicheId {
  return LOCKED_NICHE_IDS.includes(id as NicheId);
}

/**
 * Get brand profile by niche ID with fallback
 */
export function getNicheBrandProfileSafe(nicheId: string): NicheBrandProfile | null {
  if (!isValidNicheId(nicheId)) {
    return null;
  }
  return NICHE_CONFIGS[nicheId];
}
