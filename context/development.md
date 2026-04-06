# Development, tests, and tooling

## Scripts (`package.json`)

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` / `start` | `tsx server.ts` | Run API server |
| `preview` | `npx remotion studio src/remotion/index.tsx` | Remotion Studio (see [remotion.md](./remotion.md)) |

## Tests

- **Framework:** Vitest (`vitest` in devDependencies).
- **API tests:** `__tests__/server.test.ts` — Supertest against `app` import; checks **400** for invalid `/api/render` payloads only (no full Remotion render in CI).

Run (from project root):

```bash
npx vitest run
```

## TypeScript

- **`tsconfig.json`:** `module` / `moduleResolution` for bundler, `jsx: react-jsx`, `strict: true`.
- **`include`:** `src/**/*`, `server.ts` (root-level scripts).

## Environment and paths

- **`RENDER_DIR`** in `server.ts` is set to **`/tmp/renders`**. On **Linux/macOS** this is standard. On **Windows**, absolute POSIX-style paths can behave differently depending on Node version and environment; validate output directory when deploying to Windows or use a cross-platform `path.join` + `os.tmpdir()` if you change this in code.
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
- `SCHEDULE_LOCK_TTL_SECONDS` (default: `7200`)
- `SCHEDULE_RETRY_COUNT` (default: `1`)
- `SCHEDULE_RETRY_DELAY_MS` (default: `5000`)
- `PLAYWRIGHT_HEADLESS` (default: `true`; set to `false` only for local debugging with a display server)

For Railway cron usage, trigger `POST /api/schedule/run` on a fixed cadence (for example every 30 minutes). The endpoint decides run vs skip based on persisted `next_run_at`.

## Railway (CLI + MCP)

- **CLI:** Install from [Railway CLI docs](https://docs.railway.com/cli); authenticate with `railway login`. The MCP server expects a logged-in CLI ([Railway MCP reference](https://docs.railway.com/reference/mcp-server)).
- **MCP (Cursor):** Project config is **`.cursor/mcp.json`** — runs `@railway/mcp-server` via `npx`. Reload Cursor or restart MCP after adding it. In Cursor Settings → MCP, confirm **Railway** is enabled.
- **Usage:** From a linked repo directory you can deploy, list services, variables, logs, etc., through MCP tools; destructive operations are limited by design (see Railway docs).

## Git ignore

- **`node_modules`**, **`dist/`**, env files, and common **image** extensions are ignored (see `.gitignore`). Generated renders under a temp dir are typically not committed.
