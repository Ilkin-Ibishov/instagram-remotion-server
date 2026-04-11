# API server and rendering pipeline

## Entry and lifecycle

- **`server.ts`** exports `app` (Express) and `startServer()`.
- Server listens on **port 3000**, host **`0.0.0.0`**.
- **`NODE_ENV === 'test'`** or **`VITEST`** skips `startServer()` so tests can import `app` without binding the port.

## Bundle cache

- **`ensureBundle()`** calls `@remotion/bundler` **`bundle()`** once with entry **`./src/remotion/index.tsx`** and caches the result for all subsequent renders.
- **`startServer()`** pre-warms the bundle asynchronously (failures log to console).

## POST `/api/render`

**Content-Type:** `application/json` (large payloads supported via `express.json({ limit: '50mb' })`).

### Request body

| Field | Required | Description |
|-------|----------|-------------|
| `globalBranding` | Yes | Passed to every slide (see [effects.md](./effects.md)) |
| `carousel` | Yes | Array of slides: `{ templateId, data }` |
| `format` | No | `'png'` (default) or `'mp4'` |
| `webhookUrl` | No | If set, changes response behavior (below) |

**Validation:**
- Returns **400** with `{ error: 'Invalid manifest format' }` if `globalBranding` or `carousel` is missing, or `carousel` is not an array.
- Returns **400** for unknown `templateId` values.
- Returns **400** when slide `data` is missing required per-template fields.

Current per-template required fields:
- `HOOK_A`: `headline`, `subheadline` (non-empty strings), `imageUrl` (string/null/undefined)
- `CONTENT_LISTICLE`: `title`, `footnote` (non-empty strings), `items` (exactly 4 non-empty strings)
- `CONTENT_GENERIC`: `title`, `body`, `highlight` (non-empty strings)
- `CTA_FINAL`: `callToAction`, `subtext` (non-empty strings)

### Render behavior

- For each slide, builds **`inputProps`:** `{ templateId, data, branding: globalBranding }`.
- Selects composition id **`Slide`** via `selectComposition`.
- **PNG:** `renderStill` — last frame (`composition.durationInFrames - 1`), `scale: 2`, Chromium options (no-sandbox, angle GL, etc.).
- **MP4:** `renderMedia` — `h264`, per-slide `concurrency` defaults to `1` (override via `RENDER_CONCURRENCY`), same Chromium options.
- Slides are rendered **sequentially** within a batch to reduce Chromium/x264 memory pressure.

### Output storage and URLs

- Files written under **`RENDER_DIR`** (currently **`/tmp/renders`** in code — see [development.md](./development.md) for deployment notes).
- Filenames: `render-{batchId}-{index}.{png|mp4}`; **`batchId`** is 8 hex chars.
- **Static serving:** `GET` paths under **`/api/renders`** map to files in `RENDER_DIR`; response JSON returns paths like **`/api/renders/render-....png`**.

### Webhook mode

If **`webhookUrl`** is present:

1. Responds immediately **202** with `{ success, status: 'processing', batchId }`.
2. Renders in the background; on success POSTs JSON `{ success: true, batchId, images: [...] }` to the webhook.
3. On failure POSTs `{ success: false, batchId, error }`.

This avoids gateway timeouts for external automation tools.

## POST `/api/schedule/run`

Scheduler endpoint for Railway cron ticks. This endpoint is separate from the render contract and orchestrates gated pipeline execution.

### Behavior

- Calls scheduler orchestration in `src/pipeline/schedulerRunner.ts`.
- Uses persisted schedule state from Postgres to decide if the run is due.
- Uses Redis distributed lock to prevent overlapping runs.
- Runs pipeline with bounded retry (single retry by default).
- Pipeline article sourcing is RSS-first (`src/pipeline/rssService.ts`) with GNews fallback behavior in `src/pipelineRun.ts`.
- RSS source-health cooldowns are tracked in Redis and RSS run/source telemetry is best-effort persisted when `DATABASE_URL` is set.
- Performs Instagram session preflight before execution.
- If `SCHEDULE_RUN_SECRET` is configured, request must include header `x-scheduler-secret` with matching value.

### Response shape

- `200` for `executed`, `skipped_due_to_time`, and `skipped_lock_held`
- `401` for missing/invalid scheduler secret when `SCHEDULE_RUN_SECRET` is enabled
- `500` for `failed`

Example success:

```json
{
	"success": true,
	"status": "executed",
	"accountId": "default",
	"nextRunAt": "2026-04-06T23:00:00.000Z"
}
```

Example skip:

```json
{
	"success": true,
	"status": "skipped_due_to_time",
	"reason": "not_due",
	"accountId": "default",
	"nextRunAt": "2026-04-06T23:00:00.000Z"
}
```

Example failure:

```json
{
	"success": false,
	"status": "failed",
	"reason": "Session expires too soon",
	"accountId": "default"
}
```

## Code references

- Bundle + render loop: `server.ts` (`ensureBundle`, `app.post('/api/render', ...)`).
