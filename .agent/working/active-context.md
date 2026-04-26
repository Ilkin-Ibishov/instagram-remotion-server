# Active Context — Instagram Auto-Sharing Project

## Current Session
**Date:** 2026-04-26  
**Primary agent:** Cursor AI (İlkin)

### ClickUp verification
ClickUp MCP is listed in `.cursor/mcp.json`, but **this agent session had no callable ClickUp MCP tools** (no task read/write surfaced). Re-verify statuses in Cursor with MCP attached or via `scripts/clickup-audit.ts` / API.

Expected tree (from handover): **BUG-001** (86excuc9a) + subtasks **86excud7h**, **86excud7p**, **86excud80** to do; cross-cutting items in progress (TEST-*, RSS-01, SEC-03, SRV-01).

---

## BUG-001 — Detailed implementation plan by subtask

### Subtask 1 — Content fingerprint dedup + Postgres history (86excud7h) P0
**Goal:** Shared dedup state across Railway instances; durable history.

| Step | Status | Notes |
|------|--------|--------|
| Trigram dedup in filtering | Done (earlier) | `titleFingerprint.ts`, `isArticlePostedInHistory` |
| Pre-gen `recordPost` before AI | Done (earlier) | `pipelineRun.ts` |
| Postgres `post_history` schema + migration | **Done (this session)** | `scripts/migrations/001_post_history.sql`; runtime `ensurePostHistorySchema` mirrors it |
| Config-driven file vs Postgres | **Done** | `POST_HISTORY_STORE=file\|postgres`, `POST_HISTORY_MAX_ROWS`, uses `DATABASE_URL` for Postgres |
| Single snapshot load per filter pass | **Done** | `loadPostHistoryDedupSnapshot` + `filterAndRankArticles` async |
| Atomic multi-instance “claim” | **Done** | `claimArticle()` + `ON CONFLICT (normalized_url) DO NOTHING`; `filterAndRankArticles` claims in score order when `POST_HISTORY_STORE=postgres`; `recordPost` upserts by `normalized_url` |

**Railway:** Set `POST_HISTORY_STORE=postgres` (and existing `DATABASE_URL`). Apply migration once: `psql "$DATABASE_URL" -f scripts/migrations/001_post_history.sql` (optional if relying on auto-create).

### Subtask 2 — Diverse selection + race condition (86excud7p) P1
| Item | Plan |
|------|------|
| `selectBestArticle` `'diverse'` | Done — verify in prod logs |
| `REDIS_URL` on Railway | Ops: confirm variable in service |
| Abort on scheduler lock loss | Add `AbortSignal` from lock renewal failure; thread through `runPipeline` / scheduler runner |
| JSON post-history races | Mitigated for Postgres; file mode still last-writer-wins — document “don’t use file with multi-worker” |

### Subtask 3 — Hard filter + empty-slide guard (86excud80) P2
| Item | Plan |
|------|------|
| Empty-slide guard | Done in `pipelineRun.ts` |
| Repetitive topic | `newsFiltering` already hard-skips when `sameTopicRecentCount >= threshold` — add edge-case tests and tune threshold copy |
| Extra tests | Cover null/empty manifest branches |

### Cross-cutting (backlog)
- **SRV-01:** `start:prod` + Docker `CMD` → `node dist/server.js` after `npm run build`
- **SEC-03:** Move GNews key to header or server-side proxy
- **RSS-01:** RSS parser XXE / entity limits
- **TEST-01/02/05:** Reduce over-mocking; happy path; async lock test

---

## Code changes this session (Subtask 1 partial)
- `scripts/migrations/001_post_history.sql` — idempotent DDL
- `src/pipeline/postHistory.ts` — file + Postgres backends, `isArticlePostedInHistory`, async `recordPost` / `getRecentPosts` / `clearHistory`
- `src/pipeline/newsFiltering.ts` — `filterAndRankArticles` async; one dedup snapshot per call
- `src/pipelineRun.ts` — await filter + `recordPost`
- Tests: `__tests__/postHistory.postgres.test.ts`, extended `postHistory.test.ts`, `newsFiltering.test.ts` mocks updated
- `.env.example` — `POST_HISTORY_STORE`, `POST_HISTORY_MAX_ROWS`

---

## Next actions (priority)
1. Subtask 1: **atomic claim** before AI (DB constraint + conflict handling)
2. Subtask 2: **abort signal** on lock loss
3. Deploy: Postgres history + env on Railway
4. SRV-01 / SEC-03 / RSS-01 as scheduled
