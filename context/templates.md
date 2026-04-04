# Slide templates and data contracts

All templates receive **`{ data, branding }`**. **`branding`** includes **`accentColor`**, **`handle`**, and **`effects`** (see [effects.md](./effects.md)).

## Registry (`templateId` → component)

| `templateId` | Component file | Role |
|--------------|----------------|------|
| `HOOK_A` | `HookA.tsx` | Opening “breaking” style hook with optional background image |
| `CONTENT_GENERIC` | `ContentGeneric.tsx` | Title + body + optional highlight |
| `CONTENT_LISTICLE` | `ContentListicle.tsx` | Numbered list with optional footnote |
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

### `CONTENT_LISTICLE`

- **`title`:** string
- **`items`:** `string[]` (code defaults to `[]` if missing)
- **`footnote`:** optional string (not `footer` — automation prompts may use the wrong key; see [lesson-learned.md](./lesson-learned.md))

### `CONTENT_VIDEO`

- **`title`:** string
- **`videoUrl`:** string (remote mp4); if missing, placeholder UI
- **`caption`**, **`source`:** optional strings

### `CTA_FINAL`

- **`callToAction`:** string (main headline)
- **`subtext`:** string

## Design notes

- Layouts are **fixed 1080×1080** with inline styles; typography often references **Montserrat** (ensure webfonts if rendering off a machine without them — not configured in-repo).
- **HookA** uses **`Img`** for remote images; **ContentVideo** uses **`Video`** for remote video — both require reachable URLs at render time.
