/**
 * List Niches Tool
 * 
 * Lists available account niches.
 */

import type { ListNichesOutput, NicheInfo, Niche } from '../types';

const NICHES: Array<{ id: Niche; displayName: string; platforms: string[] }> = [
  { id: 'psychology-micro', displayName: 'Psychology Micro', platforms: ['instagram'] },
  { id: 'history-flash', displayName: 'History Flash', platforms: ['instagram'] },
  { id: 'legal-rights-az', displayName: 'Legal Rights A-Z', platforms: ['instagram'] },
  { id: 'study-hacks', displayName: 'Study Hacks', platforms: ['instagram'] },
  { id: 'ai-tools-daily', displayName: 'AI Tools Daily', platforms: ['instagram'] },
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
