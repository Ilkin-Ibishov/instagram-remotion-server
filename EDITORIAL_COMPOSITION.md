# Editorial Composition Guide

## Overview

The **Editorial Composition** system provides cinematic templates inspired by high-retention editorial design patterns with dramatic image windows, thin accent dividers, and bold black-slab typography.

**Two formats available:**

1. **EditorialSlide (4:5)** — 1080×1350 for **Instagram Feed posts and carousels**
2. **EditorialReel (9:16)** — 1080×1920 for **Instagram Reels, TikTok, and YouTube Shorts**

---

## Composition IDs

### EditorialSlide (4:5 Feed)
Use composition ID `EditorialSlide` for Instagram Feed posts (1080×1350).

```bash
# Render single frame
npx remotion still src/remotion/index.tsx EditorialSlide output.png --props='props.json'

# Render video
npx remotion render src/remotion/index.tsx EditorialSlide output.mp4 --props='props.json'
```

### EditorialReel (9:16 Reels/Shorts)
Use composition ID `EditorialReel` for Instagram Reels, TikTok, Shorts (1080×1920).

```bash
# Render single frame
npx remotion still src/remotion/index.tsx EditorialReel output.png --props='props.json'

# Render video
npx remotion render src/remotion/index.tsx EditorialReel output.mp4 --props='props.json'
```

---

## Available Templates

### `HOOK_EDITORIAL` (4:5 Feed)

Cinematic hook template for Feed posts:
- **Top 70%**: High-quality image with subtle Ken Burns zoom
- **Profile tag**: Straddles divider, sits in image area with dark plate
- **Thin divider**: Niche-colored accent line (3px) at 70% mark
- **Handle**: Below divider (e.g., `@mindHacks`)
- **Bottom 30%**: Solid black slab with bold white ALL-CAPS headline (3–5 lines)
- **CTA footer**: "SWIPE FOR MORE" or custom (20px)

### `HOOK_EDITORIAL_REEL` (9:16 Reels/Shorts)

Cinematic hook template for Reels/TikTok/Shorts:
- **Safe zones**: Top ~150px, bottom ~200px for platform UI
- **Upper ~55%**: High-quality image with subtle Ken Burns zoom
- **Profile tag**: Straddles divider, sits in image area with dark plate
- **Thin divider**: Niche-colored accent line (3px) at ~55% mark
- **Handle**: Below divider (e.g., `@mindHacks`)
- **Lower ~35%**: Solid black slab with bold white ALL-CAPS headline (3–5 lines)
- **CTA footer**: "FOLLOW FOR MORE" or custom (18px), respects bottom safe zone

---

## Props Schema

```typescript
{
  "templateId": "HOOK_EDITORIAL",
  "data": {
    "headline": string,        // Multi-line headline (use \n for line breaks)
    "microLabel": string,      // Optional micro-label (defaults to niche handle)
    "cta": string,             // Optional CTA text (defaults to "SWIPE FOR MORE")
    "imageUrl": string         // Optional custom image URL (falls back to niche defaults)
  },
  "branding": {
    "niche": string,           // One of: psychology-micro, legal-rights-az, study-hacks, history-flash, ai-tools-daily
    "accentColor": string,     // Hex color for divider/CTA accents
    "handle": string,          // Social media handle
    "effects": string[]        // Optional effects overlay
  }
}
```

---

## Example Manifests

### Psychology Micro
```json
{
  "templateId": "HOOK_EDITORIAL",
  "data": {
    "headline": "YOUR BRAIN\nLIES TO YOU\nEVERY DAY",
    "microLabel": "PSYCHOLOGY",
    "cta": "SWIPE FOR MORE"
  },
  "branding": {
    "niche": "psychology-micro",
    "accentColor": "#8b5cf6",
    "handle": "@mindHacks",
    "effects": []
  }
}
```

### Legal Rights (Azerbaijani)
```json
{
  "templateId": "HOOK_EDITORIAL",
  "data": {
    "headline": "BU HAQQI\nBİLMƏSƏNİZ\nİTİRƏRSİNİZ",
    "microLabel": "HÜQUQLARINIZ",
    "cta": "DAVAM EDIN"
  },
  "branding": {
    "niche": "legal-rights-az",
    "accentColor": "#3b82f6",
    "handle": "@haqlarınız",
    "effects": []
  }
}
```

---

## Motion Timing

- **Frame 0–3**: Hard visual appears (image fades from 85% → 100% opacity)
- **Frame 0–8**: Micro-label snaps in
- **Frame 6+**: Headline lines stagger in (3 frames offset per line)
- **Frame 20–28**: CTA fades in
- **Throughout**: Subtle Ken Burns zoom on background image

All text is **readable at frame 0** for high retention.

---

## Pipeline Integration

### Option 1: CLI Rendering
```bash
# Save props to manifest.json
npx remotion still src/remotion/index.tsx EditorialSlide output.png --props='manifest.json'
```

### Option 2: Programmatic Rendering
```typescript
import { renderMedia } from '@remotion/renderer';

await renderMedia({
  composition: 'EditorialSlide',
  serveUrl: bundleLocation,
  codec: 'h264',
  outputLocation: 'out/video.mp4',
  inputProps: {
    templateId: 'HOOK_EDITORIAL',
    data: { /* ... */ },
    branding: { /* ... */ }
  }
});
```

---

## Design Tokens

Editorial templates use the same niche-specific design tokens as square compositions:

| Niche | Accent Color | Default Background |
|-------|--------------|-------------------|
| `psychology-micro` | Purple `#8b5cf6` | Neurons/brain abstract |
| `legal-rights-az` | Blue `#3b82f6` | Courthouse/scales |
| `study-hacks` | Cyan `#06b6d4` | Study desk/notes |
| `history-flash` | Amber `#f59e0b` | Ancient manuscripts |
| `ai-tools-daily` | Teal `#14b8a6` | Circuit board/tech |

---

## Proofs

Editorial proof frames are located in:
```
proof-frames/editorial/{niche}/editorial-frame-0.png   # Initial hard visual
proof-frames/editorial/{niche}/editorial-frame-24.png  # Settled with all lines
```

All frames are **1080×1350 pixels** (4:5 portrait).

---

## Format Selection Guide

| Platform | Composition | Aspect Ratio | Dimensions | Template |
|----------|-------------|--------------|------------|----------|
| Instagram Feed | `EditorialSlide` | 4:5 | 1080×1350 | `HOOK_EDITORIAL` |
| Instagram Carousel | `EditorialSlide` | 4:5 | 1080×1350 | `HOOK_EDITORIAL` |
| Instagram Reels | `EditorialReel` | 9:16 | 1080×1920 | `HOOK_EDITORIAL_REEL` |
| TikTok | `EditorialReel` | 9:16 | 1080×1920 | `HOOK_EDITORIAL_REEL` |
| YouTube Shorts | `EditorialReel` | 9:16 | 1080×1920 | `HOOK_EDITORIAL_REEL` |
| Square posts | `Slide` | 1:1 | 1080×1080 | `HOOK_A`, etc. |

## Notes

- Original **1080×1080 square** `Slide` composition remains fully functional for 1:1 content.
- **Do NOT use 4:5 editorial for Reels/Shorts** — use `EditorialReel` (9:16) instead.
- **Safe zones** in 9:16 reel template account for TikTok/IG Reels/Shorts platform UI.
- Custom images via `data.imageUrl` always override niche defaults.
- Headlines should be **3–5 lines** of bold ALL-CAPS text for maximum impact.
- Profile tag (micro-label) acts as brand identifier (evolving.ai style) — use niche handle or short niche name.
- CTA text adapts to format: "SWIPE FOR MORE" for Feed/carousel, "FOLLOW FOR MORE" for Reels/Shorts.
