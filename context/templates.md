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

## Design notes

- Layouts are **fixed 1080×1080** with inline styles; typography often references **Montserrat** (ensure webfonts if rendering off a machine without them — not configured in-repo).
- Dynamic headline/body fields use shared overflow helpers from `src/templates/textOverflow.ts` for max-width, line-clamp, and ellipsis behavior. Keep new template copy inside these helpers so long real-world headlines do not spill outside the 1080×1080 frame.
- **HookA** uses **`Img`** for remote images; **ContentVideo** uses **`Video`** for remote video — both require reachable URLs at render time.
- For MP4 publishing, keep frame 0 visually informative: avoid fully black opening frames and avoid starting all foreground layers at `opacity: 0`.
