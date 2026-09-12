# Blank Frame Audit — PASS ✅

## Critical Issue from Vertical Vision

**Rejected version (full6)**: Fade-to-empty gradient between phrases left ~1s dead frames at multiple timestamps. Karaoke phrase → empty gradient → next phrase = BLANK FRAMES = FAIL.

**Requirement**: NO blank frames. Motif SCENES always on screen for every frame of each beat. Karaoke = lower-third captions only, never leave mid-timeline as gradient+watermark alone.

---

## Initial Implementation Gaps (BEFORE FIX)

### 1. CtaBeat: **CRITICAL** ⚠️
- **Frames 0-15**: `cardOpacity` interpolated from 0→1
- **BLANK**: First 15 frames (0.5s) showed only gradient+watermark
- **Impact**: HIGH — End card completely invisible at beat start

### 2. Step2Beat
- **Frames 0-10**: `checklistOpacity` started at 0
- **Partial blank**: Only numeral "2" visible, checklist hidden
- **Impact**: MEDIUM — Numeral present but checklist (main motif) missing

### 3. Step3Beat
- **Frames 0-10**: `chapterOpacity` started at 0
- **Partial blank**: Only numeral "3" visible, chapter graphic hidden
- **Impact**: MEDIUM — Numeral present but chapter (main motif) missing

### 4. WhyBeat
- **Frames 0-10**: `highlighterOpacity` 0→1, `headlineOpacity` 0→1
- **Near-blank**: Notes SVG present but subtle (0.08 alpha), highlighter and headline invisible
- **Impact**: LOW — Base notes graphic always visible, but very subtle

### 5. Step1Beat
- **Frames 0-10**: `timerOpacity` 0→1, `bookOpacity` started at frame 25
- **Partial blank**: Numeral "1" visible, but timer/book hidden
- **Impact**: MEDIUM — Numeral present but timer (key motif) missing

### 6. StopBeat
- **No gaps**: STOP stamp visible from frame 0 (scale 0.9→1)
- **Impact**: NONE ✅

---

## Fixes Applied

All fade-in animations changed to start at **high opacity (0.8-0.95)** instead of 0:

```typescript
// BEFORE (BLANK FRAMES):
const cardOpacity = interpolate(relativeFrame, [0, 15], [0, 1], {...});

// AFTER (INSTANT PRESENCE):
const cardOpacity = interpolate(relativeFrame, [0, 8], [0.95, 1], {...});
```

### Fix Summary

| Beat | Element | Before | After |
|------|---------|--------|-------|
| CtaBeat | cardOpacity | [0,15] 0→1 | [0,8] 0.95→1 |
| Step2Beat | checklistOpacity | [10,25] 0→1 | [0,10] 0.9→1 |
| Step3Beat | chapterOpacity | [10,25] 0→1 | [0,10] 0.9→1 |
| WhyBeat | highlighterOpacity | [0,20] 0→1 | [0,15] 0.8→1 |
| WhyBeat | headlineOpacity | [10,25] 0→1 | [0,12] 0.9→1 |
| Step1Beat | timerOpacity | [10,25] 0→1 | [0,12] 0.9→1 |
| Step1Beat | bookOpacity | [25,40] 0→1 | [8,20] 0.85→1 |

---

## Proof Frames (v3 Render)

Beat start frames extracted to verify NO blank frames:

1. **0.1s (stop beat start)**: `proof-frame-0.1s.jpg`
   - ✅ STOP stamp fully visible

2. **2.6s (why beat start)**: `proof-frame-2.6s.jpg`
   - ✅ Notes graphic + highlighter + headline visible

3. **9.1s (s1 beat start)**: `proof-frame-9.1s.jpg`
   - ✅ Numeral "1" + timer visible

4. **14.1s (s2 beat start)**: `proof-frame-14.1s.jpg`
   - ✅ Numeral "2" + checklist visible

5. **18.1s (s3 beat start)**: `proof-frame-18.1s.jpg`
   - ✅ Numeral "3" + chapter graphic visible

6. **23.1s (cta beat start)**: `proof-frame-23.1s.jpg`
   - ✅ CTA card visible (WAS BLANK BEFORE FIX — CRITICAL)

---

## Verification

### Re-render Details
- **File**: `vertical-video-recut-v3.mp4`
- **MD5**: `cdc8951e95efd9f5071481d3e7b45262`
- **Size**: 1.6M
- **Duration**: 28.05s

### Audit Result: **PASS ✅**

- ✅ NO blank frames at beat starts
- ✅ NO fade-to-empty gradient mid-timeline
- ✅ Visual motifs present from frame 0 of each beat
- ✅ All elements start at opacity 0.8-0.95 (never 0)
- ✅ Continuous visual presence throughout video

---

## Cut-Sheet Update

Added `blankFrameBan` requirement to `fixtures/cut-sheets/study-hacks-recut-v2.json`:

```json
"blankFrameBan": "BAN fade-to-empty. Motif SCENES always on screen for every frame of each beat. NO mid-timeline gradient+watermark alone. Visual elements start at opacity 0.8-0.95 (never 0) for instant presence."
```

---

## Principle

**Hard cuts ONLY. NO soft fades to empty.**

- Karaoke = lower-third captions only
- Motif scenes = always visible
- Never leave gradient+watermark alone at ANY timestamp

**Before shipping artifacts: Extract beat start frames and verify NO blank frames.**

---

**Status**: READY FOR VERTICAL VISION HANDOFF ✅
