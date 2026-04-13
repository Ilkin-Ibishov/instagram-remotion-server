# Remotion composition

## Root entry

- **File:** `src/remotion/index.tsx`
- Calls **`registerRoot`** with a single **`Composition`**:
  - **`id`:** `"Slide"` — must stay in sync with `COMPOSITION_ID` in `server.ts`.
  - **`component`:** `SlideComposition`
  - **Dimensions:** 1080×1080
  - **`fps`:** 30
  - **`durationInFrames`:** `COMPOSITION_DURATION_SECONDS * 30` (default 720 / 24 seconds)
  - **`defaultProps`:** Example `templateId`, `data`, `branding` for Studio preview

## Slide router

- **File:** `src/remotion/SlideComposition.tsx`
- Maps **`templateId`** string → React template component.
- Unknown `templateId` renders a full-frame fallback message **"Unknown template: …"** on dark background.
- Wraps every template with a 1080×1080 container and renders **`EffectsOverlay`** with **`branding.effects`**.

### Props type (`SlideProps`)

- **`templateId`:** string
- **`data`:** `Record<string, any>` (per-template shape; see [templates.md](./templates.md))
- **`branding`:** `{ accentColor, handle, effects: string[] }`

## Local preview (Studio)

- **`package.json`** script: `npx remotion studio src/remotion/index.tsx`
- Entry file: **`src/remotion/index.tsx`**

## Animation conventions

- Templates use **`useCurrentFrame`**, **`interpolate`**, and sometimes **`spring`** / **`Video`** / **`Img`** from `remotion`.
- Timing assumes **30 fps** unless a template defines its own constant.
