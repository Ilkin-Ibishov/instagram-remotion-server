# Patterns — Long-Term Memory

**Purpose:** Established code patterns, conventions, and template contracts. Reference before implementing.

---

## Template Data Contracts

### `HOOK_A`
- `headline` (string), `subheadline` (string)
- `imageUrl` (optional) — full-bleed grayscale bg with motion

### `CONTENT_GENERIC`
- `title` (string), `body` (string)
- `highlight` (optional string) — styled callout block

### `CONTENT_LISTICLE`
- `title` (string), `items` (string[]), defaults to []
- `footnote` (optional) — **NOT** `footer`

### `CONTENT_VIDEO`
- `title` (string), `videoUrl` (string)
- `caption`, `source` (optional strings)

### `CTA_FINAL`
- `callToAction` (string), `subtext` (string)

---

## Adding New Templates

1. Create component in `src/templates/NewTemplate.tsx`
2. Import in `src/remotion/SlideComposition.tsx`
3. Add `templateMap` entry
4. Document `data` shape in this file

---

## Styling Conventions

- Fixed 1080×1080 canvas, inline styles
- Typography: Montserrat (ensure webfonts available at render time)
- `HookA` uses `Img` for remote images
- `ContentVideo` uses `Video` for remote video
- Effects overlay is post-composite sibling, not per-template

---

## Animation Conventions

- Use `useCurrentFrame`, `interpolate`, `spring` from `remotion`
- 30 fps assumed unless template defines own constant

---

## Render Pipeline Pattern

```
inputProps = { templateId, data, branding: globalBranding }
→ selectComposition("Slide")
→ renderStill (PNG) or renderMedia (MP4)
→ output to /tmp/renders/render-{batchId}-{index}.{ext}
```
