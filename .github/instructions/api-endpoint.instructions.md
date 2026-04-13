---
description: Rules for maintaining API stability in server.ts and the /api/render endpoint
applyTo: "server.ts"
---

# API Endpoint Stability & Render Pipeline

This guide ensures the Express server and rendering pipeline remain stable, backward-compatible, and performant.

## Render Endpoint: POST `/api/render`

### Request Validation

**Required Fields:**
```typescript
interface RenderRequest {
  globalBranding: {
    accentColor: string;     // Hex color
    handle: string;          // Instagram handle
    effects: string[];       // Applied effects
  };
  carousel: Array<{
    templateId: string;      // Must match registered templates
    data: Record<string, any>; // Template-specific data
  }>;
  format?: 'png' | 'mp4';    // Defaults to 'png'
  webhookUrl?: string;       // For async rendering
}
```

**Validation Rules:**
- Return **400 Bad Request** if `globalBranding` or `carousel` is missing
- Return **400** if `carousel` is not an array
- Return **400** if `templateId` doesn't match registered templates
- Return **413** if payload exceeds 50MB limit (expressJson limit)

### Response Behavior

#### Sync Mode (no webhookUrl)
```http
HTTP 200 OK
Content-Type: application/json

{
  "success": true,
  "images": [
    "/api/renders/render-a1b2c3d4-0.png",
    "/api/renders/render-a1b2c3d4-1.png"
  ]
}
```

#### Async Mode (with webhookUrl)
```http
HTTP 202 Accepted
Content-Type: application/json

{
  "success": true,
  "status": "processing",
  "batchId": "a1b2c3d4"
}
```

Then POST results to your webhook:
```http
POST https://your-webhook-url
Content-Type: application/json

{
  "success": true,
  "batchId": "a1b2c3d4",
  "images": ["/api/renders/render-a1b2c3d4-0.png"]
}
```

### Payload Limits
- **JSON Body Limit**: 50MB (do not decrease)
- **MP4 Render Concurrency**: Defaults to `1` for stability, configurable via `RENDER_CONCURRENCY`
- **File Naming**: Use 8-character hex batchId: `render-{batchId}-{slideIndex}.{ext}`

Example batch ID generation:
```typescript
const batchId = crypto.randomBytes(4).toString('hex'); // "a1b2c3d4"
```

## Caching & Bundling

### Bundle Cache (ensureBundle)
The Remotion bundle is expensive to create. It's cached in memory:

```typescript
// In server.ts, before rendering:
const bundle = await ensureBundle('src/remotion/index.tsx', { cacheDir: '.cache' });
```

**Rules:**
- Don't clear the bundle cache on every request
- Invalidate cache only when `src/remotion/**` or `src/templates/**` changes
- Watch for **24-hour** stale bundle warnings in production

### Remix Bundler Options
```typescript
const options = {
  cachePath: '.cache',           // Persist for faster rebuilds
  chromiumOptions: [
    '--no-sandbox',             // For Docker environments
    '--disable-gpu',            // Optional, for headless servers
  ],
};
```

## Storage & File Serving

### Render Directory
- **Location**: `/tmp/renders` (currently fixed in `server.ts`)
- **Cleanup**: Remove files after 24 hours to avoid disk bloat
- **Serving**: Use Express static middleware:
  ```typescript
  app.use('/api/renders', express.static(RENDER_DIR));
  ```

### File Naming Scheme
```
render-{batchId}-{slideIndex}.{ext}

Examples:
- render-a1b2c3d4-0.png
- render-a1b2c3d4-1.png
- render-a1b2c3d4-0.mp4
```

## Environment & Deployment

### Chromium & Headless Mode
Remotion uses Chromium for rendering. In containerized environments:

```typescript
const chromiumOptions = [
  '--no-sandbox',              // ✓ Required in Docker
  '--disable-dev-shm-usage',   // ✓ Prevents shared memory exhaustion
  '--disable-gpu',             // ✓ Often needed in headless servers
];
```

### Concurrency & Resource Limits
- **Default Concurrency**: 4 (h264 encoder limit)
- **CPU-bound**: Adjust down if CPU spikes (e.g., to 2 on limited VMs)
- **Memory**: Ensure 2-4GB available for concurrent renders

### Environment Variables
```bash
# .env or container secrets
RENDER_DIR=/tmp/renders
GEMINI_API_KEY=<your-api-key>
NODE_ENV=production
```

### Hosted Instagram Session Bootstrap
- `server.ts` bootstraps `storage.json` from `INSTAGRAM_SESSION_B64` when present.
- The payload is expected to be JSON storage state encoded as base64, but production secrets may arrive as UTF-8 or UTF-16LE JSON bytes.
- Preserve the normalization path: decode base64, strip embedded NUL characters, accept UTF-8 or UTF-16LE JSON, and write normalized UTF-8 JSON to `storage.json`.
- Do not revert to writing raw decoded bytes directly; malformed session files can cascade into scheduler failures and Postgres UTF8 errors when failure text contains NULs.

## Error Handling

### Common Errors & Responses

| Error | Status | Action |
|-------|--------|--------|
| Missing `globalBranding` | 400 | Return error message in JSON |
| Invalid template ID | 400 | List valid IDs in response |
| Bundle compilation failed | 500 | Log error; instruct user to check templates |
| Chrome crash / OOM | 500 | Retry once; if persistent, return 503 |
| Webhook URL unreachable | 202 + log | Background render continues; webhook failure logged |

Example error response:
```json
{
  "error": "slide[0].templateId invalid: \"UNKNOWN_TEMPLATE\""
}
```

## Testing the Render Endpoint

Mock Remotion for route tests:
```typescript
// In __tests__/server.test.ts
vi.mock('@remotion/bundler', () => ({
  bundle: vi.fn().mockResolvedValue('/cache/bundle.zip'),
  ensureBundle: vi.fn().mockResolvedValue('/cache/bundle.zip'),
}));

vi.mock('@remotion/renderer', () => ({
  renderStill: vi.fn().mockResolvedValue(),
  renderMedia: vi.fn().mockResolvedValue(),
}));
```

Full render tests should be in a separate integration suite (not blocking the API test suite).

## API Versioning & Deprecation

If you need to change the API contract:
1. Add new endpoint (e.g., `/api/v2/render`)
2. Keep old endpoint working for **at least 3 months**
3. Document deprecation in `context/lesson-learned.md`
4. Return deprecation warning header:
   ```
   Deprecation: true
   Sunset: Wed, 21 Dec 2024 00:00:00 GMT
   ```

## Resource Cleanup

After rendering completes:
```typescript
// Clean up old renders (>24 hours)
const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
fs.readdirSync(RENDER_DIR).forEach(file => {
  const stat = fs.statSync(path.join(RENDER_DIR, file));
  if (stat.mtimeMs < oneDayAgo) {
    fs.unlinkSync(path.join(RENDER_DIR, file));
  }
});
```

Schedule this cleanup to run **daily** (via cron or init task).
