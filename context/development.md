# Development, tests, and tooling

## Scripts (`package.json`)

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` / `start` | `tsx server.ts` | Run API server in development |
| `build` | `tsc -p tsconfig.json && tsc-alias -p tsconfig.json --resolve-full-paths` | Compile the production server bundle into `dist/` and rewrite runtime import specifiers |
| `start:prod` | `node --experimental-specifier-resolution=node dist/server.js` | Run the compiled production server |
| `preview` | `npx remotion studio src/remotion/index.tsx` | Remotion Studio (see [remotion.md](./remotion.md)) |
| `test:integration` | `vitest run __tests__/integration` | Run integration-oriented tests (Railway test auto-skips without env) |

## Tests

- **Framework:** Vitest (`vitest` in devDependencies).
- **API tests:** `__tests__/server.test.ts` — Supertest against `app` import; checks **400** for invalid `/api/render` payloads only (no full Remotion render in CI).

Run (from project root):

```bash
npx vitest run
```

Integration tests only:

```bash
npm run test:integration
```

## TypeScript

- **`tsconfig.json`:** `module` / `moduleResolution` for bundler, `jsx: react-jsx`, `strict: true`.
- **`include`:** `src/**/*`, `server.ts` (root-level scripts).

## Environment and paths

- **`RENDER_DIR`** in `server.ts` is set to **`/tmp/renders`**. On **Linux/macOS** this is standard. On **Windows**, absolute POSIX-style paths can behave differently depending on Node version and environment; validate output directory when deploying to Windows or use a cross-platform `path.join` + `os.tmpdir()` if you change this in code.
- **`GEMINI_TIMEOUT_MS`** controls the max wait time for a single Gemini generation call in `aiService.ts` (default: `60000`, minimum: `1`). Requests exceeding this budget fail with a descriptive timeout error instead of hanging indefinitely.
- **`CONTENT_INTENT`** steers AI template sequencing by goal in `aiService.ts`: `balanced` (default), `educate`, `debate`, `newsflash`, or `visual_proof`.
- **`SERVER_MODE`** is set internally by `server.ts` for long-lived API/scheduler runs so shared resources remain available between requests. CLI execution via `pipelineRun.ts` leaves this unset and closes RSS telemetry pool on exit.
- Chrome cleanup tuning in `server.ts` (optional):
	- **`CHROME_CLEANUP_INTERVAL_MS`** (default: `3600000` = 1 hour)
	- **`CHROME_CLEANUP_RETRIES`** (default: `3` retries after the initial cleanup attempt)
	- **`CHROME_CLEANUP_RETRY_DELAY_MS`** (default: `1000` ms between retries)
- **`package-lock.json`** present — use `npm ci` for reproducible installs in CI.

## Scheduler environment

The scheduler route (`POST /api/schedule/run`) requires both Postgres and Redis.

Required:

- `DATABASE_URL` — Postgres connection string for persisted schedule state
- `REDIS_URL` — Redis connection string for distributed lock

Optional (defaults in code):

- `SCHEDULE_ACCOUNT_ID` (default: `default`)
- `SCHEDULE_RUN_SECRET` (if set, must be provided as `x-scheduler-secret` header)
- `SCHEDULE_MIN_DELAY_HOURS` (default: `3`)
- `SCHEDULE_MAX_DELAY_HOURS` (default: `5`)
- `POSTING_TIMEZONE` (default: `UTC`)
- `POSTING_HOURS_START` (default: `8`, inclusive, 24h format)
- `POSTING_HOURS_END` (default: `21`, exclusive, 24h format)
- `SCHEDULE_LOCK_TTL_SECONDS` (default: `7200`)
- `SCHEDULE_RETRY_COUNT` (default: `1`)
- `SCHEDULE_RETRY_DELAY_MS` (default: `5000`)
- `PLAYWRIGHT_HEADLESS` (default: `true`; set to `false` only for local debugging with a display server)
- `SCHEDULER_ENABLED` (default: `false`; set to `true` to enable the internal polling loop)
- `SCHEDULER_POLL_INTERVAL_MS` (default: `1800000` = 30 minutes; minimum `60000` = 1 minute)
- `SCHEDULER_STARTUP_RETRY_DELAY_MS` (default: `60000` = 1 minute)
- `SCHEDULER_STARTUP_MAX_RETRIES` (default: `10`)

### Internal scheduler loop

When `SCHEDULER_ENABLED=true`, the server performs one scheduler run immediately after startup and then starts a `setInterval` loop that calls `runScheduledPipeline()` at the configured poll cadence. If the startup run returns `skipped_lock_held`, the server performs short bounded retries before falling back to the normal poll interval. The existing `shouldRunNow()` check decides run vs skip based on persisted `next_run_at` in Postgres, so the poll interval is just a check cadence — the actual run frequency is controlled by `SCHEDULE_MIN_DELAY_HOURS` / `SCHEDULE_MAX_DELAY_HOURS`.

The `POST /api/schedule/run` endpoint remains available for manual triggers and external integrations.

## RSS ingestion environment

RSS is now the primary ingest path for the pipeline when enabled, with GNews as fallback.

Optional (defaults in code):

- `USE_RSS_FEEDS` (default: `true`; set to `false` to force GNews-only behavior)
- `RSS_FETCH_TIMEOUT_MS` (default: `10000`; per-source RSS request timeout)
- `RSS_TITLE_DEDUP_THRESHOLD` (default: `0.6`; Jaccard threshold for cross-source title dedup)
- `RSS_CACHE_TTL_SECONDS` (optional global cache TTL override in seconds; if unset, per-source TTL is used)
- `RSS_GLOBAL_FETCH_TIMEOUT_MS` (default: `75000`; preferred env for total RSS fetch budget)
- `RSS_GLOBAL_TIMEOUT_MS` (legacy alias; still supported for backward compatibility with the same default behavior)
- `RSS_SOURCE_FAILURE_THRESHOLD` (default: `3`; consecutive per-source failures before cooldown is applied)
- `RSS_SOURCE_COOLDOWN_SECONDS` (default: `3600`; cooldown duration for a source that crossed failure threshold)
- `RSS_SOURCE_FAILURE_TTL_SECONDS` (default: `604800`; Redis TTL for source failure counters)
- `RSS_TELEMETRY_RETENTION_DAYS` (default: `30`; retention window in days for Postgres RSS telemetry, pruned weekly after a successful scheduled run)

Optional infrastructure:

- `DATABASE_URL` enables durable RSS telemetry persistence in Postgres (`rss_source_telemetry`, `rss_run_telemetry`)
- `REDIS_URL` enables source-health cooldown state (`rss:health:*` keys)
- `INSTAGRAM_SESSION_B64` can supply Playwright storage state as base64; `server.ts` validates the decoded payload as JSON, accepts UTF-8 or UTF-16LE encodings, strips embedded NULs, and writes normalized UTF-8 to `storage.json` at startup for hosted deployments

## Railway (CLI + MCP)

- **CLI:** Install from [Railway CLI docs](https://docs.railway.com/cli); authenticate with `railway login`. The MCP server expects a logged-in CLI ([Railway MCP reference](https://docs.railway.com/reference/mcp-server)).
- **MCP (Cursor):** Project config is **`.cursor/mcp.json`** — runs `@railway/mcp-server` via `npx`. Reload Cursor or restart MCP after adding it. In Cursor Settings → MCP, confirm **Railway** is enabled.
- **Usage:** From a linked repo directory you can deploy, list services, variables, logs, etc., through MCP tools; destructive operations are limited by design (see Railway docs).

## Git ignore

- **`node_modules`**, **`dist/`**, env files, and common **image** extensions are ignored (see `.gitignore`). Generated renders under a temp dir are typically not committed.
