# Current State — Instagram Auto-Sharing

## Pipeline Status
**Overall:** Deployed and running on Railway (instagram-remotion-server)
**Scheduler:** Firing every ~2 min (configured for 30 min) — scheduler interval bug exists
**Content duplication:** Active production bug (BUG-001, P0)

## Code State
- `titleFingerprint.ts`: ✅ Trigram similarity implemented (threshold 0.35)
- `postHistory.ts`: ✅ Dual-check (URL + fingerprint), records `pre-gen` before AI transform
- `postHistory.ts`: ✅ Postgres + file backends (`POST_HISTORY_STORE`, migration `scripts/migrations/001_post_history.sql`); ❌ atomic multi-instance claim not yet implemented
- `newsFiltering.ts`: ✅ Uses fingerprint dedup
- `selectBestArticle`: ✅ Fixed to `'diverse'` strategy
- `pipelineRun.ts`: ✅ Empty-slide guard added
- `pipelineRun.ts`: ❌ Race condition on lock loss (no abort signal)
- `package.json`: ❌ `start` may still run via tsx
- `newsService.ts`: ❌ GNews API key in URL query param
- `rss-parser`: ❌ XXE not hardened

## Deployment
- **Platform:** Railway
- **Service:** instagram-remotion-server
- **Status:** Live, publishing content (with duplication)
- **Redis:** Configured (needs REDIS_URL verified)
- **Postgres:** RSS telemetry + optional **post history** when `POST_HISTORY_STORE=postgres`
- **Docker:** Production image

## Security Items
- SEC-01: Instagram session cookies committed to git — needs human action to rotate
- SEC-03: GNews API key exposed in URL — in progress
- RSS-01: XXE hardening — in progress

## ClickUp Tasks Summary
- **Total backlog:** 80 tasks (from "Automated Content Sharing System" list)
- **Completed:** ~71
- **In progress:** 6 (TEST-01, TEST-02, TEST-05, RSS-01, SEC-03, SRV-01)
- **To do:** 4 (BUG-001 parent + 3 subtasks)

## Agent Context
- `.agent/memory/` — architecture, decisions, constraints, patterns, current-state
- `.agent/rules/` — testing-standards, api-stability, remotion-template-patterns, agent-behavior, token-control
- `.agent/working/` — active-context.md (handover document)
- `.agent/system/` — core, interceptor, memory, modes, thinking, tools
- `.agent/workflows/` — fix-lint
- `.cursor/mcp.json` — Railway MCP + ClickUp MCP configured
