# Editorial Composition Guide

## Overview

The **Editorial Composition** is a cinematic 1080×1350 (4:5 portrait) template system inspired by high-retention editorial design patterns. It features a dramatic image window, thin accent divider, and bold black-slab typography optimized for Instagram/TikTok/Shorts.

---

## Composition ID

Use composition ID `EditorialSlide` when rendering via Remotion CLI or API.

```bash
# Example: render a single frame
npx remotion still src/remotion/index.tsx EditorialSlide output.png --props='props.json'

# Example: render video
npx remotion render src/remotion/index.tsx EditorialSlide output.mp4 --props='props.json'
```

---

## Available Templates

### `HOOK_EDITORIAL`

Cinematic hook template with:
- **Top 70%**: High-quality image with subtle Ken Burns zoom
- **Thin divider**: Niche-colored accent line (3px)
- **Micro-label**: Niche handle or custom label in ALL-CAPS
- **Bottom 30%**: Solid black slab with bold white ALL-CAPS headline (3–5 lines)
- **CTA footer**: Small configurable call-to-action (e.g. "SWIPE FOR MORE")

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

## Notes

- Original **1080×1080 square** `Slide` composition remains fully functional.
- Use `EditorialSlide` for Instagram Feed / TikTok portrait formats.
- Use `Slide` for Instagram Reels / YouTube Shorts 1:1 crops.
- Custom images via `data.imageUrl` always override niche defaults.
- Headlines should be **3–5 lines** of bold ALL-CAPS text for maximum impact.
