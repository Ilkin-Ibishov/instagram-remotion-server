# Architecture — Long-Term Memory

## Project: instagram-content-generator-remotion

**Purpose:** Remotion 4 + Express service rendering Instagram-style carousel frames (1080×1080) as PNG/MP4.

**Flow:** Automation tool (n8n) → fetches content → builds JSON manifest → POST `/api/render` → renders slides → returns URLs or webhooks result.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node (ES modules), `tsx` for dev |
| API | Express 4, JSON up to ~50MB |
| Rendering | Remotion 4 (`@remotion/bundler`, `@remotion/renderer`) |
| UI | React 18, inline styles, `lucide-react` icons |
| Tests | Vitest + Supertest |

---

## Repository Layout

| Path | Role |
|------|------|
| `server.ts` | Express app, bundle cache, render pipeline |
| `src/remotion/index.tsx` | Remotion root: registers `Slide` composition |
| `src/remotion/SlideComposition.tsx` | Routes `templateId` → template component + effects |
| `src/templates/*.tsx` | One React component per slide type |
| `src/components/EffectsOverlay.tsx` | Post-process visual effects overlay |
| `__tests__/server.test.ts` | API validation tests (no full render) |

---

## API: POST `/api/render`

| Field | Required | Description |
|-------|----------|-------------|
| `globalBranding` | Yes | `{ accentColor, handle, effects: string[] }` |
| `carousel` | Yes | Array of `{ templateId, data }` |
| `format` | No | `'png'` (default) or `'mp4'` |
| `webhookUrl` | No | Async mode: returns 202 immediately, POSTs result to webhook |

**Render:** Per slide → `renderStill` (PNG) or `renderMedia` (MP4, h264, concurrency 4).
**Output:** Files at `/tmp/renders/render-{batchId}-{index}.{ext}`, served via `/api/renders/`.

---

## Composition

- **ID:** `Slide` (must match `COMPOSITION_ID` in `server.ts`)
- **Canvas:** 1080×1080, 30 fps, 720 frames (24s)

---

## Template Registry

| `templateId` | Component | Purpose |
|--------------|-----------|---------|
| `HOOK_A` | `HookA.tsx` | Opening hook with optional bg image |
| `CONTENT_GENERIC` | `ContentGeneric.tsx` | Title + body + optional highlight |
| `CONTENT_LISTICLE` | `ContentListicle.tsx` | Numbered list + optional footnote |
| `CONTENT_VIDEO` | `ContentVideo.tsx` | Video frame with title overlay |
| `CTA_FINAL` | `CtaFinal.tsx` | Closing CTA with social icons |

---

## Effects Overlay

| Token | Effect |
|-------|--------|
| `crt` | Scanlines + RGB fringing |
| `noise` | SVG turbulence grain |
| `vignette` | Radial darkening |
| `chromatic` | Split RGB glow |
| `halftone` | Dot pattern |

Unknown tokens ignored. Overlay is post-composite (z-index 40–50), `pointerEvents: none`.

---

## External Integration (n8n)

- Workflow files in repo (`n8n-workflow*.json`) are templates — URLs/keys are placeholders.
- Pattern: Schedule → HTTP fetch content → LLM formats JSON → POST `/api/render`.
- Use `webhookUrl` to avoid n8n timeout on long jobs.
- **Critical:** LLM output field names must match template contracts (e.g. `footnote` not `footer`).

---

## Development

- **Dev server:** `tsx server.ts` (port 3000, host 0.0.0.0)
- **Preview:** `npx remotion studio src/remotion/index.tsx`
- **Tests:** `npx vitest run`
- **`RENDER_DIR`:** `/tmp/renders` — adjust for Windows deployments
- **CI:** Use `npm ci` (lock file present)
