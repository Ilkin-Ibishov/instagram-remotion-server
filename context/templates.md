# Slide templates and data contracts

All templates receive **`{ data, branding }`**. **`branding`** includes **`accentColor`**, **`handle`**, and **`effects`** (see [effects.md](./effects.md)).

## Registry (`templateId` → component)

| `templateId` | Component file | Role |
|--------------|----------------|------|
| `HOOK_A` | `HookA.tsx` | Opening “breaking” style hook with optional background image |
| `CONTENT_GENERIC` | `ContentGeneric.tsx` | Title + body + optional highlight |
| `CONTENT_LISTICLE` | `ContentListicle.tsx` | Numbered list with optional footnote |
| `CONTENT_STAT_SNAPSHOT` | `ContentStatSnapshot.tsx` | Data-focused slide with kicker + stat + interpretation |
| `CONTENT_MYTH_VS_FACT` | `ContentMythVsFact.tsx` | Contrast slide that debunks a myth with evidence |
| `CONTENT_VIDEO` | `ContentVideo.tsx` | Embedded video frame with title overlay |
| `CTA_FINAL` | `CtaFinal.tsx` | Closing CTA with social-style icons |

Adding a new slide type: implement a component, import it in `SlideComposition.tsx`, and add a **`templateMap`** entry.

## Expected `data` shapes (by template)

### `HOOK_A`

- **`headline`**, **`subheadline`:** strings
- **`imageUrl`:** optional; if present, shown as full-bleed grayscale background with motion

### `CONTENT_GENERIC`

- **`title`**, **`body`:** strings
- **`highlight`:** optional string (styled callout block)
- Recommended limits: `title <= 76`, `body <= 220`, `highlight <= 90` to avoid text clipping in the 1080x1080 layout

### `CONTENT_LISTICLE`

- **`title`:** string
- **`items`:** `string[]` (code defaults to `[]` if missing)
- **`footnote`:** optional string (not `footer` — automation prompts may use the wrong key; see [lesson-learned.md](./lesson-learned.md))

### `CONTENT_VIDEO`

- **`title`:** string
- **`videoUrl`:** string (remote mp4); if missing, placeholder UI
- **`caption`**, **`source`:** optional strings

### `CONTENT_STAT_SNAPSHOT`

- **`kicker`:** short string label (context category)
- **`stat`:** short metric string (for example `47%`, `2x`, `3 in 5`)
- **`context`:** single concise line explaining the signal
- **`takeaway`:** concise implication for the audience

### `CONTENT_MYTH_VS_FACT`

- **`myth`:** common claim or assumption
- **`fact`:** grounded correction from the article
- **`proof`:** short evidence/source-backed sentence

### `CTA_FINAL`

- **`callToAction`:** string (main headline)
- **`subtext`:** string

Validation note: `CTA_FINAL.callToAction` is now expected to end with `?` so the final card invites an explicit audience response.

### `HOOK_VERTICAL_NATIVE`

- **`karaoke`:** array of `{startFrame, endFrame, text}` objects (optional; auto-generated from hookLines if missing)
- **`hookLines`:** `string[]` (fallback phrases for karaoke animation)
- **`cta`:** string (end card call-to-action)

Karaoke-style vertical video (9:16) with word-by-word animation. Each word appears with hard-cut punch timing. Uses design tokens from `branding.niche`. Safe zones enforced (top 150px, bottom 220px).

### `VERTICAL_BEAT_SCENES`

- **`beats`:** array of beat objects with:
  - **`id`:** string (beat identifier: `stop`, `why`, `s1`, `s2`, `s3`, `cta`)
  - **`sec`:** `[number, number]` (start and end time in seconds)
  - **`captionKaraoke`:** `string[]` (lower-third captions)

TikTok-native vertical composition (9:16) with 6 distinct visual beat scenes. Each beat renders a unique motif:
- **stop**: Giant red STOP stamp with rotation
- **why**: Highlighter FAIL animation (yellow mark, X, gray-out)
- **s1**: Big '1' + timer (8:00) + book/handwriting animation
- **s2**: Checklist with glowing GAP highlights + Big '2'
- **s3**: Crosshair target on chapter blank spots + Big '3'
- **cta**: End card with "Try tonight" + chips (cooked/not cooked) + handle

Duration calculated from beat timings via `calculateMetadata`. Captions in lower-third safe zone (bottom ~220px). Uses study-hacks design tokens (#06b6d4 cyan).

## Design notes

- Layouts are **fixed 1080×1080** with inline styles; typography uses **Montserrat** (ensure webfonts if rendering off a machine without them — not configured in-repo).
- Dynamic headline/body fields use shared overflow helpers from `src/templates/textOverflow.ts` for max-width, line-clamp, and ellipsis behavior. Keep new template copy inside these helpers so long real-world headlines do not spill outside the 1080×1080 frame.
- **HookA** uses **`Img`** for remote images; **ContentVideo** uses **`Video`** for remote video — both require reachable URLs at render time.
- For MP4 publishing, keep frame 0 visually informative: avoid fully black opening frames and avoid starting all foreground layers at `opacity: 0`.

### Design Token System (v2)

All templates now consume **design tokens** from `src/remotion/designTokens.ts` based on **`branding.niche`**:

- **Supported niches:** `psychology-micro`, `history-flash`, `legal-rights-az`, `study-hacks`, `ai-tools-daily`
- Each niche has a distinct color palette, background gradient, and accent color.
- **Safe zones** enforced for 9:16 vertical platforms (TikTok/IG/Shorts):
  - **Top:** 120px (profile pics, status bars)
  - **Bottom:** 140px (captions, CTA overlays)
  - **Sides:** 64px (text margins)
- **Typography:** Hook size (88px), title (58px), body (36px), caption (24px) — optimized for phone readability.
- **Motion timings:** Hook duration (~0.6s), transitions (~0.8s), stagger delay (~0.2s) — calibrated for retention.
- If `branding.niche` is missing or invalid, defaults to `psychology-micro`.
- See **`DESIGN_SYSTEM.md`** for full token reference and usage guide.
