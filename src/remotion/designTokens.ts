/**
 * Design Token System for High-Retention Short-Form Video
 * 
 * Optimized for TikTok/Instagram Reels/YouTube Shorts:
 * - 9:16 safe zones for critical content
 * - Niche-specific color palettes and typography
 * - Motion grammar for <3s hook retention
 * - Phone-first readability (tested for 375px viewport equivalent)
 */

export interface DesignTokens {
  colors: {
    primary: string;
    primaryDark: string;
    primaryLight: string;
    background: string;
    backgroundGradient: string;
    text: string;
    textSecondary: string;
    accent: string;
    surface: string;
    border: string;
  };
  typography: {
    hookSize: number;
    titleSize: number;
    bodySize: number;
    captionSize: number;
    lineHeight: {
      tight: number;
      normal: number;
      relaxed: number;
    };
    weight: {
      normal: number;
      medium: number;
      semibold: number;
      bold: number;
      black: number;
    };
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  motion: {
    hookDuration: number; // frames
    transitionDuration: number;
    staggerDelay: number;
    easing: {
      type: 'spring' | 'interpolate';
      config?: { stiffness: number; damping: number };
    };
  };
  safeZones: {
    top: number;
    bottom: number;
    sides: number;
  };
}

/**
 * 9:16 Safe Zones for 1080x1080 canvas
 * Critical content must stay within these bounds for vertical video platforms
 * 
 * Top/Bottom zones avoid UI overlays (profile pic, captions, action buttons)
 * Side margins ensure readability on all phone screens
 */
export const SAFE_ZONES = {
  // For 1080x1080 targeting 9:16 visible area
  top: 120,      // Avoid top UI (60px from actual top for breathing room)
  bottom: 140,   // Avoid caption/CTA overlays
  sides: 64,     // Side margins for text readability
  
  // Critical "hook zone" - must be readable within first 1s on phone
  hookZone: {
    top: 120,
    bottom: 600,  // Upper 2/3 of safe vertical space
    sides: 64,
  },
};

/**
 * Base tokens shared across all niches
 */
const BASE_TOKENS: Omit<DesignTokens, 'colors'> = {
  typography: {
    hookSize: 88,      // Large, instantly readable
    titleSize: 58,     // Section headers
    bodySize: 36,      // Main content
    captionSize: 24,   // Supporting text
    lineHeight: {
      tight: 1.1,
      normal: 1.4,
      relaxed: 1.6,
    },
    weight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      black: 900,
    },
  },
  spacing: {
    xs: 8,
    sm: 16,
    md: 24,
    lg: 32,
    xl: 48,
    xxl: 64,
  },
  motion: {
    hookDuration: 18,        // ~0.6s @ 30fps - instant impact
    transitionDuration: 24,  // ~0.8s @ 30fps
    staggerDelay: 6,         // ~0.2s between items
    easing: {
      type: 'spring',
      config: { stiffness: 120, damping: 18 },
    },
  },
  safeZones: SAFE_ZONES,
};

/**
 * Niche-specific color palettes and visual identity
 * Each niche has distinct colors optimized for its content type
 */
export const NICHE_PALETTES = {
  'psychology-micro': {
    colors: {
      primary: '#8b5cf6',      // Purple - mind, introspection
      primaryDark: '#6d28d9',
      primaryLight: '#a78bfa',
      background: '#0f0a1e',   // Deep purple-black
      backgroundGradient: 'radial-gradient(circle at 18% 15%, #8b5cf622 0%, transparent 45%), #0f0a1e',
      text: '#f5f3ff',
      textSecondary: '#c4b5fd',
      accent: '#ec4899',       // Pink accent for contrast
      surface: 'rgba(139, 92, 246, 0.08)',
      border: 'rgba(139, 92, 246, 0.3)',
    },
  },
  'history-flash': {
    colors: {
      primary: '#f59e0b',      // Amber - timeless, archive feel
      primaryDark: '#d97706',
      primaryLight: '#fbbf24',
      background: '#1a1410',   // Warm dark brown
      backgroundGradient: 'radial-gradient(circle at 18% 15%, #f59e0b22 0%, transparent 45%), #1a1410',
      text: '#fef3c7',
      textSecondary: '#fcd34d',
      accent: '#ef4444',       // Red for dates/important markers
      surface: 'rgba(245, 158, 11, 0.08)',
      border: 'rgba(245, 158, 11, 0.3)',
    },
  },
  'legal-rights-az': {
    colors: {
      primary: '#3b82f6',      // Blue - authority, trust
      primaryDark: '#1d4ed8',
      primaryLight: '#60a5fa',
      background: '#0a1628',   // Deep navy
      backgroundGradient: 'radial-gradient(circle at 18% 15%, #3b82f622 0%, transparent 45%), #0a1628',
      text: '#f0f9ff',
      textSecondary: '#93c5fd',
      accent: '#10b981',       // Green for "rights secured"
      surface: 'rgba(59, 130, 246, 0.08)',
      border: 'rgba(59, 130, 246, 0.3)',
    },
  },
  'study-hacks': {
    colors: {
      primary: '#06b6d4',      // Cyan - focus, clarity
      primaryDark: '#0891b2',
      primaryLight: '#22d3ee',
      background: '#0c1419',   // Cool dark slate
      backgroundGradient: 'radial-gradient(circle at 18% 15%, #06b6d422 0%, transparent 45%), #0c1419',
      text: '#ecfeff',
      textSecondary: '#67e8f9',
      accent: '#a855f7',       // Purple for "brain boost"
      surface: 'rgba(6, 182, 212, 0.08)',
      border: 'rgba(6, 182, 212, 0.3)',
    },
  },
  'ai-tools-daily': {
    colors: {
      primary: '#14b8a6',      // Teal - tech, innovation
      primaryDark: '#0f766e',
      primaryLight: '#2dd4bf',
      background: '#0a1817',   // Deep teal-black
      backgroundGradient: 'radial-gradient(circle at 18% 15%, #14b8a622 0%, transparent 45%), #0a1817',
      text: '#f0fdfa',
      textSecondary: '#5eead4',
      accent: '#f97316',       // Orange for "new/hot"
      surface: 'rgba(20, 184, 166, 0.08)',
      border: 'rgba(20, 184, 166, 0.3)',
    },
  },
} as const;

export type NicheId = keyof typeof NICHE_PALETTES;

/**
 * Get design tokens for a specific niche
 * Falls back to psychology-micro if niche not found
 */
export function getDesignTokens(niche: string): DesignTokens {
  const normalizedNiche = niche.toLowerCase().trim();
  const palette = NICHE_PALETTES[normalizedNiche as NicheId] || NICHE_PALETTES['psychology-micro'];
  
  return {
    ...BASE_TOKENS,
    ...palette,
  };
}

/**
 * Get niche from branding or account context
 * Format: looks for niche in branding object or falls back to default
 */
export function getNicheFromBranding(branding: any): NicheId {
  const nicheHint = branding?.niche || branding?.category || 'psychology-micro';
  const normalized = nicheHint.toLowerCase().trim();
  
  // Check if it's a valid niche
  if (normalized in NICHE_PALETTES) {
    return normalized as NicheId;
  }
  
  // Fallback
  return 'psychology-micro';
}

/**
 * Utility: Generate background gradient with niche colors
 */
export function getBackgroundStyle(tokens: DesignTokens): React.CSSProperties {
  return {
    background: tokens.colors.backgroundGradient,
    overflow: 'hidden',
  };
}

/**
 * Utility: Safe zone container for critical content
 */
export function getSafeZoneStyle(): React.CSSProperties {
  return {
    paddingTop: SAFE_ZONES.top,
    paddingBottom: SAFE_ZONES.bottom,
    paddingLeft: SAFE_ZONES.sides,
    paddingRight: SAFE_ZONES.sides,
  };
}

/**
 * Utility: Hook zone style for maximum impact in first 1s
 */
export function getHookZoneStyle(): React.CSSProperties {
  return {
    position: 'absolute',
    top: SAFE_ZONES.hookZone.top,
    left: SAFE_ZONES.hookZone.sides,
    right: SAFE_ZONES.hookZone.sides,
    maxHeight: SAFE_ZONES.hookZone.bottom - SAFE_ZONES.hookZone.top,
  };
}
