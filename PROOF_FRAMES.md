# Visual Design System - Proof Frames

This document explains the proof frames demonstrating the high-retention Remotion visual system across 2 of the 5 supported niches.

## Generated Proof Frames

### Psychology-Micro Niche

**Color Palette:** Purple (#8b5cf6) primary, pink (#ec4899) accent, deep purple-black background

#### 1. Hook Frame (Frame 0) - `hook-frame-0.png`
- **Critical Test:** Must be readable within 1 second on mobile
- **What to check:**
  - ✅ "PSYCH TIP" badge visible with purple border
  - ✅ Headline "Why We Procrastinate" at 88px, instantly readable
  - ✅ Content within safe zones (120px top, 140px bottom, 64px sides)
  - ✅ No black/empty opening (Instagram thumbnail-friendly)
  - ✅ Purple gradient background active from frame 0

#### 2. Hook Frame (Frame 18 - Settled) - `hook-frame-18.png`
- **Purpose:** Show fully animated hook state (~0.6s @ 30fps)
- **What to check:**
  - ✅ All elements at full opacity
  - ✅ Motion settled (smooth reading experience)
  - ✅ Brand handle visible bottom-left

#### 3. Mid Frame (CONTENT_GENERIC) - `mid-CONTENT_GENERIC-frame-24.png`
- **Purpose:** Demonstrate body content layout
- **What to check:**
  - ✅ Purple top accent bar
  - ✅ Title "Temporal Discounting" in safe zone
  - ✅ Purple divider line
  - ✅ Body text with line clamping (6 lines max)
  - ✅ Highlight callout with purple border
  - ✅ Typography hierarchy clear (58px title, 34px body)

#### 4. End Frame (CTA_FINAL) - `end-CTA_FINAL-frame-24.png`
- **Purpose:** Show closing CTA with social actions
- **What to check:**
  - ✅ Purple bookmark icon with spring animation (settled)
  - ✅ CTA headline "Want more psychology tips?" centered
  - ✅ Like/Comment/Share icons with purple accents
  - ✅ Content within safe zones for vertical platforms

---

### Legal-Rights-AZ Niche

**Color Palette:** Blue (#3b82f6) primary, green (#10b981) accent, deep navy background

#### 1. Hook Frame (Frame 0) - `hook-frame-0.png`
- **Critical Test:** Azerbaijani text must be readable immediately
- **What to check:**
  - ✅ "HÜQUQLARINIZ" badge with blue border
  - ✅ Headline "İş Yerində Hüququnuz" at 88px, clear
  - ✅ Blue gradient distinct from psychology niche
  - ✅ No black opening, blue brand identity immediate
  - ✅ Cyrillic/Latin text rendering correctly

#### 2. Hook Frame (Frame 18 - Settled) - `hook-frame-18.png`
- **Purpose:** Full animation settled
- **What to check:**
  - ✅ Blue primary color clearly distinct from purple
  - ✅ All text fully opaque
  - ✅ Brand handle "@haqlarınız" visible

#### 3. Mid Frame (CONTENT_LISTICLE) - `mid-CONTENT_LISTICLE-frame-24.png`
- **Purpose:** Numbered list with blue badges
- **What to check:**
  - ✅ Left blue accent stripe (full height)
  - ✅ Numbered badges (1-4) with blue background
  - ✅ List items in Azerbaijani properly formatted
  - ✅ Footnote "Əmək Məcəlləsi..." visible at bottom
  - ✅ Staggered animation settled (all items visible)

#### 4. End Frame (CTA_FINAL) - `end-CTA_FINAL-frame-24.png`
- **Purpose:** CTA with blue branding
- **What to check:**
  - ✅ Blue bookmark icon (distinct from purple)
  - ✅ Azerbaijani CTA text "Hüquqlarınızı bilin?"
  - ✅ Social icons with blue surface/border colors
  - ✅ Navy background gradient visible

---

## Design System Validation Checklist

Use this checklist when reviewing proof frames:

### ✅ Safe Zones (All Frames)
- [ ] Top safe zone: 120px clear (no critical content)
- [ ] Bottom safe zone: 140px clear (brand handle within)
- [ ] Side safe zones: 64px margins on text content
- [ ] Hook zone: primary message in upper 2/3 of vertical space

### ✅ Niche-Specific Colors
- [ ] Psychology-micro uses purple/pink palette
- [ ] Legal-rights-az uses blue/green palette
- [ ] Colors are distinct between niches
- [ ] Gradient backgrounds match niche
- [ ] Primary color used consistently (badges, borders, accents)

### ✅ Typography Hierarchy
- [ ] Hook headlines: 88px (instantly readable)
- [ ] Titles: 58px
- [ ] Body text: 34-36px
- [ ] Captions: 22-24px
- [ ] Line clamping active (no text overflow)

### ✅ Motion & Timing (Frame Progression)
- [ ] Frame 0: readable immediately (no black frames)
- [ ] Frame 18: hook fully settled (~0.6s)
- [ ] Frame 24: transitions complete (~0.8s)
- [ ] Opacity starts at 0.5-0.7 (visible at frame 0)
- [ ] Smooth progression (no jarring jumps)

### ✅ Phone Readability Test
- [ ] Simulate 375px viewport width (iPhone SE)
- [ ] Hook headline readable without zooming
- [ ] Body text legible at actual size
- [ ] Tap targets (icons) minimum 44x44px

---

## Comparison: Old vs New

### Old Templates (Before This PR)
- ❌ Generic tech aesthetic (one color for all)
- ❌ No safe zone consideration (1080x1080 full bleed)
- ❌ Slow fade-ins (frame 0 often dark/empty)
- ❌ Hardcoded colors (`branding.accentColor` only)
- ❌ Typography not optimized for phone screens

### New Design System (After This PR)
- ✅ 5 distinct niche-specific palettes
- ✅ 9:16 safe zones enforced
- ✅ Hook readable at frame 0 (Instagram thumbnail)
- ✅ Design tokens for all visual properties
- ✅ Phone-first typography sizing

---

## Next Steps for Validation

1. **View Frames:**
   ```bash
   open proof-frames/psychology-micro/hook-frame-0.png
   open proof-frames/legal-rights-az/hook-frame-0.png
   ```

2. **Phone Readability Test:**
   - Resize images to ~375px width in preview
   - Confirm headline is readable without squinting

3. **Niche Comparison:**
   - Compare purple (psychology) vs blue (legal) side-by-side
   - Verify distinct visual identities

4. **Full Manifest Render (Optional):**
   ```bash
   # Render complete video for psychology-micro
   curl -X POST http://localhost:3000/api/render \
     -H "Content-Type: application/json" \
     -d @test-manifests/psychology-micro.json
   ```

---

## Remaining Niches (Not in Proof Frames)

These niches are fully supported in the design token system but don't have test manifests yet:

- **history-flash:** Amber/red, timeless archive feel
- **study-hacks:** Cyan/purple, focus and clarity
- **ai-tools-daily:** Teal/orange, tech innovation

To add proof frames for these, create test manifests in `test-manifests/` and re-run:

```bash
tsx scripts/render-proof-frames.ts
```

---

## Technical Notes

- **Canvas:** 1080×1080 (square, optimized for IG feed + Reels)
- **FPS:** 30 (configurable via `COMPOSITION_FPS`)
- **Duration:** 24 seconds default (configurable)
- **Renderer:** Remotion 4 with Chrome Headless Shell
- **Font:** Montserrat (bold weights for impact)

---

## Files Modified

- `src/remotion/designTokens.ts` — Token system
- `src/templates/*.tsx` — All 7 templates updated
- `test-manifests/` — Example manifests
- `scripts/render-proof-frames.ts` — Proof generation script

---

## Questions?

Refer to [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) for:
- Complete token reference
- Niche palette details
- Pipeline integration guide
- Composition API docs
