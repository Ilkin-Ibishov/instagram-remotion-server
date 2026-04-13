# Remotion composition

## Root entry

- **File:** `src/remotion/index.tsx`
- Calls **`registerRoot`** with a single **`Composition`**:
  - **`id`:** `"Slide"` — must stay in sync with `COMPOSITION_ID` in `server.ts`.
  - **`component`:** `SlideComposition`
  - **Dimensions:** 1080×1080
  - **`fps`:** `COMPOSITION_FPS` (default `30`, valid range `1..120`)
  - **`durationInFrames`:** `COMPOSITION_DURATION_SECONDS * COMPOSITION_FPS` (default 720 / 24 seconds)
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
- Timing should use `useVideoConfig().fps` so animation pacing stays consistent when `COMPOSITION_FPS` changes.
- For MP4 posts, frame 0 must show readable foreground content (text or card UI) and should not start from fully black/fully transparent states, because Instagram grid previews frequently use the first frame as the visible thumbnail.
