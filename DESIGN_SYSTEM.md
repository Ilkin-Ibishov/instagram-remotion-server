# Remotion Visual Design System

**High-retention short-form video design for TikTok / Instagram Reels / YouTube Shorts**

## Overview

This design system provides niche-specific visual identities optimized for faceless, high-retention content across 5 locked niches:

1. **psychology-micro** — Purple/pink palette, introspective feel
2. **history-flash** — Amber/red palette, timeless archive aesthetic  
3. **legal-rights-az** — Blue/green palette, authority and trust
4. **study-hacks** — Cyan/purple palette, focus and clarity
5. **ai-tools-daily** — Teal/orange palette, tech innovation

## Key Features

### ✅ 9:16 Safe Zones for Vertical Platforms
- Critical content stays within safe zones to avoid UI overlays
- Top: 120px (profile pictures, status bars)
- Bottom: 140px (captions, CTA buttons, action icons)
- Sides: 64px (text readability margins)

### ✅ Hook Frame Optimization
- Content readable within ~1 second on mobile
- Hook zone: upper 2/3 of vertical safe space
- Minimal motion at frame 0 (Instagram thumbnail-friendly)
- Large, instantly scannable typography

### ✅ Niche-Specific Color Palettes
Each niche has a distinct visual identity:
- Primary color (main brand accent)
- Supporting colors (text, background, surfaces)
- Semantic accent colors (for emphasis, contrast)

### ✅ Motion Grammar for Retention
- Hook duration: ~0.6s (18 frames @ 30fps)
- Transition duration: ~0.8s (24 frames)
- Stagger delay: ~0.2s between list items (6 frames)
- Spring-based easing for natural feel

### ✅ Phone-First Typography
- Hook size: 88px (instantly readable)
- Title size: 58px (section headers)
- Body size: 36px (main content)
- Caption size: 24px (supporting text)

## Using the Design System

### Passing Niche to Templates

The design system automatically detects niche from the `branding` object:

```typescript
// In your manifest
{
  "branding": {
    "niche": "psychology-micro",  // <- System reads this
    "handle": "@mindHacks",
    "accentColor": "#8b5cf6"  // Optional override
  }
}
```

**Supported niche values:**
- `psychology-micro`
- `history-flash`
- `legal-rights-az`
- `study-hacks`
- `ai-tools-daily`

If niche is not specified or invalid, defaults to `psychology-micro`.

### Template Usage

All templates automatically consume the design tokens:

```typescript
import { getDesignTokens, getNicheFromBranding } from '../remotion/designTokens';

export default function MyTemplate({ data, branding }) {
  const niche = getNicheFromBranding(branding);
  const tokens = getDesignTokens(niche);
  
  // Use tokens.colors, tokens.typography, tokens.spacing, etc.
  return (
    <div style={{ 
      background: tokens.colors.backgroundGradient,
      paddingTop: tokens.safeZones.top 
    }}>
      {/* content */}
    </div>
  );
}
```

## Design Token Reference

### Colors (per niche)

```typescript
tokens.colors = {
  primary: string;           // Main brand color
  primaryDark: string;       // Darker shade
  primaryLight: string;      // Lighter shade
  background: string;        // Base background
  backgroundGradient: string; // Pre-composed gradient
  text: string;              // Primary text color
  textSecondary: string;     // Secondary/muted text
  accent: string;            // Contrast accent color
  surface: string;           // Card/surface background
  border: string;            // Border color
}
```

### Typography

```typescript
tokens.typography = {
  hookSize: 88,      // Large hook headlines
  titleSize: 58,     // Section titles
  bodySize: 36,      // Main body text
  captionSize: 24,   // Small captions/labels
  lineHeight: {
    tight: 1.1,      // Headlines
    normal: 1.4,     // Body text
    relaxed: 1.6,    // Reading content
  },
  weight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    black: 900,
  },
}
```

### Spacing

```typescript
tokens.spacing = {
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
  xxl: 64,
}
```

### Safe Zones

```typescript
tokens.safeZones = {
  top: 120,       // Avoid profile pics, status
  bottom: 140,    // Avoid captions, CTAs
  sides: 64,      // Text margin
  hookZone: {
    top: 120,
    bottom: 600,  // Upper 2/3 of vertical space
    sides: 64,
  },
}
```

### Motion Timing

```typescript
tokens.motion = {
  hookDuration: 18,        // Frames for hook reveal (~0.6s @ 30fps)
  transitionDuration: 24,  // Frames for transitions (~0.8s)
  staggerDelay: 6,         // Frames between staggered items (~0.2s)
  easing: {
    type: 'spring',
    config: { stiffness: 120, damping: 18 }
  }
}
```

## Example Manifest

```json
{
  "global": {
    "branding": {
      "niche": "psychology-micro",
      "handle": "@mindHacks",
      "effects": ["vignette", "chromatic"]
    }
  },
  "carousel": [
    {
      "templateId": "HOOK_A",
      "data": {
        "badge": "NEW",
        "headline": "Why We Procrastinate",
        "subheadline": "The psychology behind task avoidance"
      }
    },
    {
      "templateId": "CONTENT_GENERIC",
      "data": {
        "title": "Temporal Discounting",
        "body": "Your brain values immediate rewards far more than future ones—even when the future reward is objectively better.",
        "highlight": "This is why deadline pressure works"
      }
    },
    {
      "templateId": "CTA_FINAL",
      "data": {
        "callToAction": "Want more psychology tips?",
        "subtext": "Follow for daily micro-lessons"
      }
    }
  ]
}
```

## Template Adaptations

### HookA (Opening Hook)
- Badge with niche color
- Large headline (88px, readable in ~1s)
- Optional background image (grayscale, subtle motion)
- Bottom-left brand handle

### ContentGeneric (Body Content)
- Top accent bar (niche color)
- Title + divider + body text
- Optional highlight callout
- Bottom-right brand handle

### ContentListicle (Numbered Lists)
- Left accent stripe
- Numbered badges with niche color
- Staggered item entrance
- Optional footnote

### ContentStatSnapshot (Data Cards)
- Large stat display (niche color)
- Kicker + context + takeaway
- Card UI with niche border

### ContentMythVsFact (Contrast Slides)
- "Myth" card (accent color)
- "Fact" card (primary color, emphasized)
- Proof/evidence text below

### CtaFinal (Closing CTA)
- Brand icon with entrance animation
- Call-to-action headline
- Social action icons (Like/Comment/Share)

### ContentVideo (Video Embed)
- Video frame with niche border
- Title overlay on video
- Optional caption and source credit

## Pipeline Integration

### Bot Manifest Structure

When generating manifests via automation/AI:

```typescript
{
  "global": {
    "branding": {
      "niche": string,  // REQUIRED: one of 5 locked niches
      "handle": string, // Account handle
      "effects": string[] // Visual effects
    }
  },
  "carousel": [
    {
      "templateId": string,  // Template identifier
      "data": Record<string, any>  // Template-specific props
    }
  ]
}
```

### Rendering

```bash
# Local preview (Remotion Studio)
npm run preview

# Render via API
POST /api/render
Content-Type: application/json

{
  "manifest": { ... },
  "format": "mp4",  # or "png"
  "webhook": "https://..." # optional
}
```

## Composition API

The Remotion composition is registered as:

- **ID:** `Slide`
- **Dimensions:** 1080×1080 (square canvas, content in 9:16 safe zones)
- **FPS:** 30 (configurable via `COMPOSITION_FPS`)
- **Duration:** 24 seconds (configurable via `COMPOSITION_DURATION_SECONDS`)

### Props Structure

```typescript
{
  templateId: string;
  data: Record<string, any>;
  branding: {
    niche?: string;      // NEW: niche identifier
    handle: string;
    accentColor: string; // Optional override
    effects: string[];
  }
}
```

## Design Principles

### 1. Hook First
The first frame must be readable and compelling within 1 second. Avoid:
- Black/empty opening frames
- Slow fade-ins
- Text that's too small

### 2. Safe Zones Enforced
All critical text and graphics must respect the safe zones. Platform UI overlays vary by device and app version—safe zones provide consistent results.

### 3. Niche Consistency
Each niche has a distinct color palette and tone. Don't mix niches within a single post. The visual identity helps with brand recognition.

### 4. Motion Efficiency
Animations should enhance, not distract. Keep transitions under 1 second. Use spring-based easing for natural feel.

### 5. Phone Readability
Test on a phone simulator (375px viewport width equivalent). If the hook isn't instantly readable at that size, increase font size or reduce text.

## Browser Testing

The design system is optimized for Remotion's Chrome-based renderer. All templates use:
- Web-safe fonts (Montserrat via webfont or system fallback)
- CSS properties supported in Chromium
- Inline styles (no external stylesheets)

## Migration from Old Templates

**What changed:**
- ❌ Hardcoded colors → ✅ Design tokens
- ❌ Generic backgrounds → ✅ Niche-specific gradients
- ❌ No safe zones → ✅ 9:16 safe zone enforcement
- ❌ Generic motion → ✅ Optimized hook retention timing
- ❌ One-size typography → ✅ Phone-first sizing

**Backward compatibility:**
- Existing manifests work (fallback to `psychology-micro` palette)
- `branding.accentColor` still respected (overrides token primary)
- All template IDs unchanged
- Data shapes unchanged

## Troubleshooting

### Colors not showing
- Check `branding.niche` is one of the 5 supported values
- Verify casing (lowercase: `psychology-micro` not `Psychology-Micro`)

### Text cut off on mobile
- Ensure content respects `tokens.safeZones`
- Use `lineClamp` helper from `textOverflow.ts`

### Motion too fast/slow
- Adjust `COMPOSITION_FPS` (default 30)
- Motion timings scale with FPS automatically

### Niche not detected
- Pass `niche` in `branding` object at manifest level
- Falls back to `psychology-micro` if missing/invalid

## Future Enhancements

Potential additions (not in scope for this PR):
- Per-niche font pairing
- Animated background patterns
- Custom badge labels per niche
- Accessibility color contrast validation
- Dark/light mode per niche

## Support

For questions or issues:
1. Check this documentation
2. Review `src/remotion/designTokens.ts` source
3. Inspect template implementations in `src/templates/`
4. Test in Remotion Studio: `npm run preview`
