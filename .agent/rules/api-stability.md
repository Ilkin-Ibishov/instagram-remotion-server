---
description: Rules for maintaining API stability in server.ts and /api/render
globs: "server.ts"
---

# API Stability and Render Pipeline

This rule ensures that the Express server and its rendering pipeline remain stable and backward-compatible.

## Render Endpoint (`/api/render`)

1. **Payload Limit**: The JSON body limit is **50mb**. Do not decrease this without a strong reason, as manifests can be large.
2. **Manifest Validation**: Always validate that `globalBranding` and `carousel` (as an array) exist. Return **400** on failure.
3. **Webhook Logic**: If `webhookUrl` is provided, the server **must** respond with **202 Accepted** immediately and perform the render in the background.
4. **Caching**: The `ensureBundle()` function caches the Remotion bundle. Ensure that changes to the render logic do not cause unnecessary re-bundling for every request.

## Storage and Paths

- **RENDER_DIR**: Currently configured to use `/tmp/renders`. Ensure that the static file serving via `app.use('/api/renders', ...)` matches this directory.
- **Batch IDs**: Use 8-character hex strings for `batchId` to avoid collisions and keep URLs reasonably short.

## Environment Hazards

- **Headless Chrome**: Remotion uses Chromium. In `server.ts`, ensure `chromiumOptions` include `--no-sandbox` if running in a containerized environment (like Docker).
- **Concurrency**: Default concurrency is **4**. Adjust based on the available CPU threads in the deployment environment.
