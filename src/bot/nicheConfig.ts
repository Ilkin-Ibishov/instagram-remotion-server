import type { NicheConfig } from './types';

/**
 * Niche configurations - locked niches with their branding
 */
export const NICHE_CONFIGS: Record<string, NicheConfig> = {
    'psychology-micro': {
        nicheId: 'psychology-micro',
        accentColor: '#ef4444',
        handle: '@psych.bites',
        effects: ['grain', 'vignette'],
    },
    'history-flash': {
        nicheId: 'history-flash',
        accentColor: '#f59e0b',
        handle: '@history.flash',
        effects: ['grain'],
    },
    'legal-rights-az': {
        nicheId: 'legal-rights-az',
        accentColor: '#3b82f6',
        handle: '@rights.az',
        effects: ['vignette'],
    },
    'study-hacks': {
        nicheId: 'study-hacks',
        accentColor: '#8b5cf6',
        handle: '@study.hacks',
        effects: ['grain', 'vignette'],
    },
    'ai-tools-daily': {
        nicheId: 'ai-tools-daily',
        accentColor: '#06b6d4',
        handle: '@ai.tools.daily',
        effects: ['grain'],
    },
};

/**
 * Get niche configuration by niche ID
 */
export function getNicheConfig(nicheId: string): NicheConfig {
    const config = NICHE_CONFIGS[nicheId];
    if (!config) {
        throw new Error(`Unknown niche: ${nicheId}. Valid niches: ${Object.keys(NICHE_CONFIGS).join(', ')}`);
    }
    return config;
}
