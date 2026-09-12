/**
 * List Niches Tool
 * 
 * Lists available account niches.
 */

import type { ListNichesOutput, NicheInfo, Niche } from '../types';

const NICHES: Array<{ id: Niche; displayName: string; platforms: string[] }> = [
  { id: 'technology', displayName: 'Technology', platforms: ['instagram'] },
  { id: 'business', displayName: 'Business', platforms: ['instagram'] },
  { id: 'startup', displayName: 'Startup', platforms: ['instagram'] },
  { id: 'ai', displayName: 'AI', platforms: ['instagram'] },
  { id: 'science', displayName: 'Science', platforms: ['instagram'] },
];

export async function listNiches(): Promise<ListNichesOutput> {
  try {
    const niches: NicheInfo[] = NICHES.map(n => ({
      id: n.id,
      displayName: n.displayName,
      platforms: [...n.platforms],
    }));

    return {
      success: true,
      niches,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
