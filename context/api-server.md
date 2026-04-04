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

**Validation:** Returns **400** with `{ error: 'Invalid manifest format' }` if `globalBranding` or `carousel` is missing, or `carousel` is not an array.

### Render behavior

- For each slide, builds **`inputProps`:** `{ templateId, data, branding: globalBranding }`.
- Selects composition id **`Slide`** via `selectComposition`.
- **PNG:** `renderStill` — last frame (`composition.durationInFrames - 1`), `scale: 2`, Chromium options (no-sandbox, angle GL, etc.).
- **MP4:** `renderMedia` — `h264`, `concurrency: 4`, same Chromium options.

### Output storage and URLs

- Files written under **`RENDER_DIR`** (currently **`/tmp/renders`** in code — see [development.md](./development.md) for deployment notes).
- Filenames: `render-{batchId}-{index}.{png|mp4}`; **`batchId`** is 8 hex chars.
- **Static serving:** `GET` paths under **`/api/renders`** map to files in `RENDER_DIR`; response JSON returns paths like **`/api/renders/render-....png`**.

### Webhook mode

If **`webhookUrl`** is present:

1. Responds immediately **202** with `{ success, status: 'processing', batchId }`.
2. Renders in the background; on success POSTs JSON `{ success: true, batchId, images: [...] }` to the webhook.
3. On failure POSTs `{ success: false, batchId, error }`.

This avoids gateway timeouts for n8n and similar tools.

## Code references

- Bundle + render loop: `server.ts` (`ensureBundle`, `app.post('/api/render', ...)`).
