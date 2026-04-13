# Project overview

## Purpose

**instagram-content-generator-remotion** is a small **Remotion 4** + **Express** service that renders **Instagram-style carousel frames** (1080×1080) as **PNG stills** or **MP4** segments. Content is driven by a JSON **manifest**: shared **global branding** plus a **carousel** array of slides, each with a `templateId` and `data`.

Typical flow: an automation service fetches news or LLM output, builds the manifest, and POSTs to `/api/render`. Optional **webhook** delivery avoids HTTP timeouts on long renders.

Current pipeline behavior is **RSS-first ingestion with GNews fallback** for article sourcing during scheduled runs, including Redis-backed source cooldown guardrails and optional Postgres telemetry persistence for RSS runs.

## Tech stack

| Layer | Technology |
|-------|------------|
| Runtime | Node (ES modules), `tsx` for dev |
| API | Express 4, JSON body up to ~50MB |
| Video / images | Remotion 4 (`@remotion/bundler`, `@remotion/renderer`, `remotion`) |
| UI in compositions | React 18, inline styles, `lucide-react` icons |
| Tests | Vitest + Supertest |

## Repository layout

| Path | Role |
|------|------|
| `server.ts` | Express app, bundle cache, render pipeline, export for tests |
| `src/pipelineRun.ts` | News-to-publish orchestration (RSS primary, GNews fallback) |
| `src/pipeline/rssService.ts` | RSS fetch/cache/normalize/dedup workflow |
| `src/pipeline/rssTelemetryStore.ts` | RSS telemetry persistence + source-health cooldown helpers |
| `src/remotion/index.tsx` | Remotion root: registers composition |
| `src/remotion/SlideComposition.tsx` | Routes `templateId` → template component + effects |
| `src/templates/*.tsx` | One React component per slide type |
| `src/components/EffectsOverlay.tsx` | Post-process visual effects |
| `__tests__/server.test.ts` | API validation tests (no full render) |
| `__tests__/rssService.test.ts` | RSS ingestion and fallback behavior tests |
| `__tests__/rssTelemetryStore.test.ts` | RSS telemetry and source-health guardrail tests |

## Single composition

- **ID:** `Slide` (must match `COMPOSITION_ID` in `server.ts`).
- **Canvas:** 1080×1080, 30 fps, duration defaults to 720 frames (24s) and is configurable via `COMPOSITION_DURATION_SECONDS`.

## Related docs

- API and render pipeline: [api-server.md](./api-server.md)
- Template contracts: [templates.md](./templates.md)
