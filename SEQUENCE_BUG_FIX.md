# CRITICAL: Remotion Sequence Timing Bug Fixed

## Issue Reported

v3 render (MD5 `cdc8951e95efd9f5071481d3e7b45262`) had **black frames** after 9s:
- Frames at 9.1s, 11s, 14.1s, 16s, 18.1s, 20s, 23.1s, 25s, 27s all had **identical MD5** `d7f53fd0c0ff03376d6eb6c1dce31728`
- All showed solid black + watermark only
- Published proof frames (14.1s, 23.1s) were blank

**Beats after ~9s never appeared** → Sequence/timing/composition bug.

---

## Root Cause

Inside `<Sequence from={X}>`, `useCurrentFrame()` returns frames **relative to the sequence start** (0, 1, 2...), NOT absolute composition frames.

### Buggy Code (v3)
```typescript
// VerticalBeatScenes.tsx
const startFrame = Math.floor(beat.sec[0] * fps); // e.g., 270 for 9s
<Sequence key={beat.id} from={startFrame} durationInFrames={duration}>
    <StopBeat startFrame={startFrame} endFrame={endFrame} ... />
</Sequence>

// StopBeat.tsx
const frame = useCurrentFrame(); // Returns 0, 1, 2... (relative!)
const relativeFrame = frame - startFrame; // 0 - 270 = -270 ❌
if (frame < startFrame || frame >= endFrame) return null; // Always true! ❌
```

When beat started at frame 270:
- Sequence positioned beat at absolute frame 270
- Inside beat, `useCurrentFrame()` returned 0, 1, 2... (sequence-relative)
- Beat checked `if (0 < 270)` → **always returned null immediately**
- Result: **black frame**

---

## Fix Applied

Removed frame offset calculation and early return check from ALL beat components since they're already inside Sequences with controlled duration:

```typescript
// BEFORE (v3):
const relativeFrame = frame - startFrame;
if (frame < startFrame || frame >= endFrame) return null;

// AFTER (v4):
const relativeFrame = frame; // Already relative inside Sequence
// No early return check needed
```

### Files Fixed
- `src/templates/beats/StopBeat.tsx`
- `src/templates/beats/WhyBeat.tsx`
- `src/templates/beats/Step1Beat.tsx`
- `src/templates/beats/Step2Beat.tsx`
- `src/templates/beats/Step3Beat.tsx`
- `src/templates/beats/CtaBeat.tsx`

---

## Verification

### Test Stills (before full render)
```bash
npx remotion still ... --frame=270  # Frame at 9s (s1 beat)
npx remotion still ... --frame=420  # Frame at 14s (s2 beat)
npx remotion still ... --frame=690  # Frame at 23s (cta beat)
```

**Results**:
- Frame 270: 638K PNG, MD5 `d0c43cabe57d24e8c7a3cad7424e505c` ✅
- Frame 420: 652K PNG, MD5 `1f25859aa2c57fead49c457501c7c552` ✅
- Frame 690: 697K PNG, MD5 `8f60de7c6be8d129615838aca7bd3c8c` ✅

All **unique MD5s**, reasonable file sizes → beats render correctly.

### v4 Full Render
**File**: `vertical-video-recut-v4.mp4`  
**MD5**: `b88ab84333d45677eb1180b267fe5eba`  
**Size**: 2 MB  
**Duration**: 28.05s

### Extracted Frames (v4)
All frames now have **unique MD5s** and show **distinct visual content**:

| Timestamp | Beat | MD5 | Size | Content |
|-----------|------|-----|------|---------|
| 9s | s1 start | `5d6316bdeb3261d30e3d7726ca30e117` | 28K | Numeral "1" + timer ✅ |
| 11s | s1 mid | `b10868097abd250148d5f42052918ee2` | 40K | Timer + book animation ✅ |
| 14s | s2 start | `8c2907d38ccec43acb11ad022abc3d8b` | 33K | Numeral "2" + checklist ✅ |
| 16s | s2 mid | `144bf645edd354225a0ef1685961f4fc` | 50K | Glowing gaps ✅ |
| 18s | s3 start | `398f91b3dff7a9133a79ab9980b20aba` | 35K | Numeral "3" + chapter ✅ |
| 20s | s3 mid | `2a7946d489db7752d49ab45ecacebf5c` | 45K | Crosshair target ✅ |
| 23s | cta start | `ab2e8d18e50d0558865e952424f02a8a` | 40K | CTA card ✅ |
| 25s | cta mid | `bf494a4fa0e86ef1d0493598e5759cbc` | 41K | Chips visible ✅ |
| 27s | cta end | `939b60b8658c1ed54b6264e0eb9131a6` | 41K | End card hold ✅ |

**NO black frames** (would be ~1-2K with identical MD5 `d7f53fd0c0ff03376d6eb6c1dce31728`).

---

## Status: v4 READY FOR HANDOFF ✅

- ✅ Sequence timing bug fixed
- ✅ All 6 beats render with unique visual content
- ✅ NO black frames after 9s
- ✅ File sizes vary (28K-50K), not tiny identical black frames
- ✅ MD5s unique across all beats
- ✅ Verified with still renders before full render
- ✅ v4 full render complete: `b88ab84333d45677eb1180b267fe5eba`

**v3 FAIL**: Black after 9s (MD5 `d7f53fd0c0ff03376d6eb6c1dce31728` repeated)  
**v4 PASS**: All beats render correctly with unique content
