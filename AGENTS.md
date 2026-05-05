## Cursor Cloud specific instructions

### Quick Reference

- **Dev server:** `npm run dev` (Express + Remotion on port 3000)
- **Tests:** `npx vitest run` (236 tests, all mocked — no API keys needed)
- **Build:** `npm run build` (tsc + tsc-alias)
- **Remotion Studio:** `npm run preview`
- **Full validation:** `npx vitest run && npm run build`
- See `context/development.md` for full env var reference and `context/api-server.md` for endpoint contracts.
- See `.cursor/skills/cloud-agent-runbook/SKILL.md` for detailed per-area testing runbooks.

### Environment Notes

- **Node.js 20** is required. The VM does not ship with Node pre-installed; the update script installs it via nodesource.
- **Chromium system libraries** are required for both Remotion rendering and Playwright browser automation. These are installed by the update script (matching the Dockerfile's apt-get list).
- **Playwright Chromium** must be installed after `npm ci` via `npx playwright install chromium`.
- No ESLint or Prettier is configured in this project — there is no lint command to run.
- Tests use `VITEST` env var and mock all external services; you do not need `.env` or API keys for `npx vitest run`.
- For manual app runs (dev server, pipeline), copy `.env.example` to `.env`. The dev server starts without real API keys but the pipeline/scheduler features need `GEMINI_API_KEY`, `DATABASE_URL`, and `REDIS_URL`.

### Gotchas

- The dev server takes ~4s to create the Remotion bundle at startup before it accepts requests. Wait for the `Server listening` log line before sending requests.
- PNG renders via `/api/render` take ~10-30s depending on slide complexity. MP4 renders are significantly slower.
- The `/api/status` endpoint will return `"unavailable"` without Postgres configured — this is expected for local dev focused on rendering.
- The `server.ts` file is large (~29K). It's the Express app entry point containing all routes, bundle cache, and render logic.
