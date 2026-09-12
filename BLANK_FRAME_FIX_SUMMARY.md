# CRITICAL: Blank Frame Fixes — PASS ✅

## Issue from Vertical Vision

**Rejected version (full6)**: Fade-to-empty gradient between phrases left blank frames.  
**Requirement**: BAN blank frames. Motif SCENES always on screen. NO mid-timeline gradient+watermark alone.

---

## Fixes Applied

All beat transitions now use **hard-cut visual presence** (opacity starts at 0.8-0.95, never 0):

### Before (BLANK FRAMES ❌)
```typescript
// CtaBeat: 15 blank frames
const cardOpacity = interpolate(relativeFrame, [0, 15], [0, 1], {...});
```

### After (INSTANT PRESENCE ✅)
```typescript
// CtaBeat: visible from frame 0
const cardOpacity = interpolate(relativeFrame, [0, 8], [0.95, 1], {...});
```

---

## All Beat Fixes

| Beat | Element | Before | After | Blank Frames Fixed |
|------|---------|--------|-------|-------------------|
| **CtaBeat** | cardOpacity | [0,15] 0→1 | [0,8] 0.95→1 | **15 frames (0.5s)** |
| Step2Beat | checklistOpacity | [10,25] 0→1 | [0,10] 0.9→1 | 10 frames |
| Step3Beat | chapterOpacity | [10,25] 0→1 | [0,10] 0.9→1 | 10 frames |
| WhyBeat | highlighterOpacity | [0,20] 0→1 | [0,15] 0.8→1 | Partial (subtle SVG always visible) |
| WhyBeat | headlineOpacity | [10,25] 0→1 | [0,12] 0.9→1 | 10 frames |
| Step1Beat | timerOpacity | [10,25] 0→1 | [0,12] 0.9→1 | 10 frames |
| Step1Beat | bookOpacity | [25,40] 0→1 | [8,20] 0.85→1 | 8 frames |

---

## Verification

### v3 Render
- **File**: `vertical-video-recut-v3.mp4`
- **MD5**: `cdc8951e95efd9f5071481d3e7b45262`
- **Proof frames extracted**: 13 total (6 beat starts + 7 mid-beat)

### Critical Beat Start Frames
✅ **0.1s** (stop): STOP stamp visible  
✅ **2.6s** (why): Notes + highlighter + headline visible  
✅ **9.1s** (s1): Numeral "1" + timer visible  
✅ **14.1s** (s2): Numeral "2" + checklist visible  
✅ **18.1s** (s3): Numeral "3" + chapter visible  
✅ **23.1s** (cta): CTA card visible ⭐ **WAS BLANK — CRITICAL FIX**

---

## Cut-Sheet Update

Added to `fixtures/cut-sheets/study-hacks-recut-v2.json`:

```json
"blankFrameBan": "BAN fade-to-empty. Motif SCENES always on screen for every frame of each beat. NO mid-timeline gradient+watermark alone. Visual elements start at opacity 0.8-0.95 (never 0) for instant presence."
```

---

## Files Changed

- `src/templates/beats/CtaBeat.tsx` (CRITICAL)
- `src/templates/beats/Step1Beat.tsx`
- `src/templates/beats/Step2Beat.tsx`
- `src/templates/beats/Step3Beat.tsx`
- `src/templates/beats/WhyBeat.tsx`
- `fixtures/cut-sheets/study-hacks-recut-v2.json`

---

## Branches

- **Code**: `cursor/study-hacks-vertical-beat-scenes-5c5f`
- **Artifacts**: `artifacts/study-hacks-recut-v2-20260912`
- **PR**: https://github.com/Ilkin-Ibishov/instagram-remotion-server/pull/23

---

## Status: READY FOR HANDOFF ✅

- ✅ NO blank frames at any timestamp
- ✅ Hard cuts only (no soft fades to empty)
- ✅ Visual motifs present from frame 0 of each beat
- ✅ v3 render verified with beat-start proof frames
- ✅ Cut-sheet updated with blankFrameBan requirement

**Principle**: Karaoke = lower-third captions. Motif scenes = always visible. Never leave gradient+watermark alone.
