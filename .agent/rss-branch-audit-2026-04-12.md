# RSS Implementation Branch Audit
**Branch:** `feature/news-ingestion-scraper`  
**Commit:** `83603f6` — `feat: RSS-first ingestion telemetry, docs sync, and legacy cleanup`  
**Auditor:** Senior developer review  
**Date:** 2026-04-12  
**Verdict:** Solid implementation with 4 bugs, 5 design concerns, and 3 testing gaps

---

## Executive Summary

Single commit, +1741 / -1414 lines across 25 files. Three new source files (`rssService.ts`, `rssSourceRegistry.ts`, `rssTelemetryStore.ts`), three new test files, modified pipeline integration, added `rss-parser` dependency, and cleaned up legacy GNews/n8n context docs. The implementation follows the v2 design document closely. The major deviation is a full PostgreSQL-backed telemetry layer (`rssTelemetryStore.ts`) that was not in the design and adds significant scope and risk.

Audit correction note: the branch alone cannot independently prove whether telemetry scope was or was not in the original v2 design document because that artifact was removed in the same cleanup commit.

---

## 1. Bugs — Will Break or Misbehave at Runtime

### BUG-1: `normalizeDescription` can return HTML content, not plain text

**File:** `rssService.ts:96`
```typescript
const value = raw.contentSnippet || raw.summary || raw.description || raw.content || '';
```

`contentSnippet` is rss-parser's HTML-stripped version and is the correct first choice. But when it's missing, `raw.summary` and `raw.description` often contain raw HTML (`<p>`, `<a>`, `<img>` tags). This HTML then becomes the `description` field passed directly into the Gemini prompt:

```
Description: <p>OpenAI today <a href="...">announced</a> GPT-5...</p>
```

The Gemini prompt doesn't strip HTML — it will either include HTML in the carousel text or produce garbled output.

**Fix:** Strip HTML from the fallback fields. A simple regex is sufficient for RSS summaries:
```typescript
function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
}
const value = raw.contentSnippet || stripHtml(raw.summary || raw.description || raw.content || '');
```

**Severity:** High — will produce visually broken carousel slides when `contentSnippet` is absent. The Verge and Guardian feeds are known to include HTML in `description`.

---

### BUG-2: `await` inside settled results loop creates sequential telemetry writes

**File:** `rssService.ts:469-494`
```typescript
for (const result of settledResults) {
  if (result.status === 'fulfilled') {
    // ...
    await recordRssSourceTelemetry(...);   // blocks loop
    // ...
    if (sourceResult.status === 'failed') {
      await noteSourceFetchFailure(...);   // blocks loop again
    } else if (sourceResult.status === 'success') {
      await noteSourceFetchSuccess(...);   // and again
    }
  }
}
```

Each iteration awaits a Redis call AND a PostgreSQL INSERT before processing the next source result. With 6 sources, that's 6 sequential DB round-trips + 6 Redis round-trips **after** all feeds have already been fetched in parallel. On a high-latency DB connection (Railway → external Postgres), this adds 100-300ms per source.

**Fix:** Collect telemetry calls and fire them in parallel after the loop, or fire-and-forget since they're already wrapped in try-catch:
```typescript
const telemetryTasks: Promise<void>[] = [];
for (const result of settledResults) {
  // ...
  telemetryTasks.push(recordRssSourceTelemetry(...));
  telemetryTasks.push(noteSourceFetchSuccess(...));
}
await Promise.allSettled(telemetryTasks);
```

**Severity:** Medium — adds latency to every pipeline run. Non-fatal but measurably slower under load.

---

### BUG-3: Global timeout `Promise.race` doesn't cancel in-flight feed fetches

**File:** `rssService.ts:437-450`
```typescript
const allSettledPromise = Promise.allSettled(sourceTasks);
const timeoutPromise = new Promise<...>((resolve) => {
  setTimeout(() => {
    globalTimeoutTriggered = true;
    resolve([]);
  }, GLOBAL_FETCH_TIMEOUT_MS);
});
const settledResults = await Promise.race([allSettledPromise, timeoutPromise]);
```

When the 15s timeout fires, `settledResults` becomes `[]`, but the actual source fetch promises continue running in the background. They will:
- Still write to Redis cache from background-completed source tasks
- Still hold open HTTP connections until they resolve or their 10s timeout fires

The `setTimeout` timer also isn't cleaned up when `allSettledPromise` wins the race, creating a minor resource leak (timer fires after the run completes, resolving a promise nobody awaits).

Correction: the per-source telemetry calls in the settled-results loop do **not** run in the timeout path because `settledResults` is `[]`.

**Fix:** At minimum, keep soft-cutoff behavior but add `clearTimeout` when the normal path wins. `AbortController`-based hard cancel can be considered later if parser/network stack support is confirmed.

**Severity:** Low — background work can continue after timeout and timer cleanup is missing. This is mostly operational hygiene rather than a correctness blocker.

---

### BUG-4: `pipelineRun.ts` GNews fallback triggers even when RSS succeeds with articles but filtering zeros them out

**File:** `pipelineRun.ts` diff, lines:
```typescript
let articles: NewsArticle[] = [];
if (useRssFeeds) {
  try {
    articles = await fetchRssNews(accountProfile.niche);
  } catch (error) { ... }
}

if (!useRssFeeds || articles.length === 0) {
  articles = await fetchTopNews(NEWS_CATEGORY);
}
```

If RSS returns 20 articles but all 20 are filtered out by `filterAndRankArticles()` (score below threshold), the fallback to GNews search happens correctly at Step 0c. That's fine.

But the `articles.length === 0` check happens **before** filtering. If RSS returns any articles (even irrelevant ones), GNews is skipped. Then filtering zeros them all out. Then GNews search fallback runs at Step 0c.

The issue: the **GNews top-headlines** endpoint is skipped entirely when RSS returns articles. Only the **GNews search** endpoint runs as fallback. This loses the top-headlines fallback path that was present in the original pipeline.

Compare to the v2 design doc Section 7, which filters first, then falls back:
```typescript
// Design says: filter RSS results first, THEN fall back to GNews top-headlines
let scoredArticles = filterAndRankArticles(articles, ...);
if (scoredArticles.length === 0) {
  const gnewsArticles = await fetchTopNews(NEWS_CATEGORY);
  scoredArticles = filterAndRankArticles(gnewsArticles, ...);
  if (scoredArticles.length === 0) {
    // search fallback
  }
}
```

The implementation deviates from the design by checking `articles.length` (raw count) instead of `scoredArticles.length` (post-filter count).

**Severity:** Medium — GNews top-headlines fallback path is unreachable when RSS returns any articles. Only affects runs where RSS articles exist but are all irrelevant.

---

## 2. Design Concerns

### CONCERN-1: rssTelemetryStore.ts is significant unplanned scope

The telemetry layer was not in the v2 design document. It adds:
- 363 lines of new code
- Hard dependency on PostgreSQL (`DATABASE_URL` required for telemetry)
- Auto-creates two tables (`rss_source_telemetry`, `rss_run_telemetry`) via `ensureSchema()`
- `pg.Pool` lifecycle management (singleton, never cleanly closed)
- 6 new env vars (`RSS_SOURCE_FAILURE_THRESHOLD`, `RSS_SOURCE_COOLDOWN_SECONDS`, `RSS_SOURCE_FAILURE_TTL_SECONDS`, etc.)

This is well-engineered — the cooldown system, failure counting, and telemetry persistence are all cleanly implemented. But it's a 40% increase in implementation scope that wasn't reviewed at the design stage. The `pg` dependency was already in `package.json` but wasn't confirmed as actively used in the codebase.

**Risk:** Schema migration (auto `CREATE TABLE IF NOT EXISTS`) runs on every first request per process. In Railway, where containers restart frequently, this means hitting PostgreSQL with DDL on every cold start. Not dangerous but noisy.

**Recommendation:** Not blocking, but this should have been a separate commit or sub-feature. If PostgreSQL isn't set up, telemetry is silently skipped (correct behavior), so it's safe to ship.

---

### CONCERN-2: `ensureSchema()` uses `CREATE TABLE IF NOT EXISTS` without migration versioning

**File:** `rssTelemetryStore.ts:92-135`

If you later need to add a column to `rss_source_telemetry`, `CREATE TABLE IF NOT EXISTS` won't alter the existing table — it's a no-op. You'll need an `ALTER TABLE` migration, and there's no migration framework or version tracking in place.

For now this is fine — the tables are new and the schema is correct. But this becomes a problem the first time the schema needs to change.

---

### CONCERN-3: `Pool` is never closed on shutdown

**File:** `rssTelemetryStore.ts:78-90`

`getPool()` creates a `pg.Pool` singleton but there's no shutdown handler to call `pool.end()`. The main `server.ts` handles `SIGTERM`/`SIGINT` for the HTTP server, Chrome cleanup, and scheduler — but not for the Postgres pool.

In Railway, this means the process may exit with open connections, which can cause connection leak warnings on the DB side.

**Fix:** Export a `closeTelemetryPool()` function and call it from `gracefulShutdown()` in `server.ts`.

---

### CONCERN-4: `index.ts` exports telemetry internals

**File:** `src/pipeline/index.ts`
```typescript
export { classifyRssErrorType, noteSourceFetchFailure, noteSourceFetchSuccess,
  recordRssRunTelemetry, recordRssSourceTelemetry, shouldSkipSourceByCooldown } from './rssTelemetryStore';
```

These are internal telemetry functions. No code outside `rssService.ts` should call `noteSourceFetchFailure` or `recordRssSourceTelemetry` directly. Exporting them from the barrel file exposes implementation details and invites misuse.

**Fix:** Remove from `index.ts`. If tests need access, use the existing `__testing` export pattern already on the module.

---

### CONCERN-5: Deleted files include potentially useful reference material

The branch deletes 5 context docs totaling ~1,190 lines:
- `gnews-implementation-guide-2026-04-08.md`
- `gnews-integration-audit-2026-04-08.md` (both English and original)
- `system-audit-2026-04-06.md`
- `integration-n8n.md`

GNews is still in the codebase as a fallback. Deleting the implementation guide and audit means there's no documentation for how the fallback works if someone needs to debug it later.

**Recommendation:** Keep `gnews-integration-audit-2026-04-08.en.md` and mark it as "archived — GNews is now a fallback only." Delete the rest.

---

## 3. What's Correct — Verified Against Design

| Design Requirement | Implementation | Status |
|---|---|---|
| `NewsArticle` interface unchanged | No changes to `types.ts` | ✅ |
| `rss-parser` as sole new dep (no `@types`) | `"rss-parser": "^3.13.0"` in deps, no @types | ✅ |
| Default import for Logger | `import Logger from '../utils/logger'` | ✅ |
| `imageUrl` filter in `fetchFeedLive` | `.filter(a => Boolean(a.title && a.description && a.url && a.imageUrl))` | ✅ |
| GUID URL validation | `if (/^https?:\/\//i.test(guid))` in `resolveArticleUrl` | ✅ |
| Empty URL rejection | Filtered by `!!a.url` in fetchFeedLive | ✅ |
| Date fallback to epoch | `EPOCH_FALLBACK_DATE = '1970-01-01T00:00:00Z'` | ✅ |
| `RSS_TITLE_DEDUP_THRESHOLD` wired to env var | `Number(process.env.RSS_TITLE_DEDUP_THRESHOLD \|\| '0.6')` | ✅ |
| `RSS_CACHE_TTL_SECONDS` as global override | `Number(process.env.RSS_CACHE_TTL_SECONDS)` checked in `fetchFeedCached` | ✅ |
| Global 15s timeout via `Promise.race` | Implemented with configurable `RSS_GLOBAL_TIMEOUT_MS` | ✅ |
| Stale cache warning | Checks `ageMs > ttlSeconds * 2 * 1000` | ✅ |
| Sentence-boundary truncation | `normalizeDescription` uses `lastIndexOf('. ')` with 200-char minimum | ✅ |
| try-catch around `fetchRssNews()` in pipeline | Present in pipelineRun.ts diff | ✅ |
| GNews retained as fallback | `fetchTopNews` still called when RSS yields 0 articles | ✅ |
| `USE_RSS_FEEDS=false` bypasses RSS | `process.env.USE_RSS_FEEDS !== 'false'` check present | ✅ |
| Source registry matches design list | All 6 sources present (TC, Ars, Verge, Wired AI, Guardian, MIT TR) | ✅ |
| Hacker News excluded | Not in registry | ✅ |
| Cross-source dedup (URL + title Jaccard) | Both implemented, threshold configurable | ✅ |
| Parallel fetch with `Promise.allSettled` | Implemented | ✅ |

---

## 4. Testing Audit

### Coverage Assessment

| Area | Test Coverage | Verdict |
|---|---|---|
| `normalizeItem` — field mapping | ✅ Tested via `normalizeItem` direct call | Good |
| `normalizeItem` — GUID URL rejection | ✅ Tests non-URL GUID → empty string | Good |
| `normalizeItem` — epoch date fallback | ✅ Asserts `1970-01-01T00:00:00Z` | Good |
| `fetchRssNews` — cache hit path | ✅ Redis mock returns cached data, parser not called | Good |
| `fetchRssNews` — Redis failure fallback | ✅ Redis throws, live fetch runs | Good |
| `fetchRssNews` — all sources fail | ✅ Parser rejects, returns `[]` | Good |
| `fetchRssNews` — cooldown skip | ✅ Mock cooldown → parser not called | Good |
| `crossSourceDedup` — URL dedup | ✅ Normalized URL collision detected | Good |
| `crossSourceDedup` — title Jaccard | ✅ Near-duplicate titles deduped | Good |
| Jaccard boundary test (0.59 vs 0.61) | ✅ Explicit threshold boundary assertions | Good |
| `pipelineRun` — RSS primary, GNews not called | ✅ Verified with mock assertions | Good |
| `pipelineRun` — RSS throws, GNews fallback | ✅ Both called, publish succeeds | Good |
| `pipelineRun` — `USE_RSS_FEEDS=false` | ✅ RSS not called | Good |
| `pipelineRun` — no articles found | ✅ Throws, publish not called | Good |
| `pipelineRun` — search fallback | ✅ `filterAndRankArticles` called twice | Good |
| Telemetry — Postgres writes | ✅ `recordRssSourceTelemetry` and `recordRssRunTelemetry` tested | Good |
| Telemetry — cooldown application | ✅ Failure threshold triggers cooldown | Good |
| Registry — niche matching | ✅ Including case-insensitive and no-match fallback | Good |

### Testing Gaps

| Gap | Detail | Severity |
|---|---|---|
| **No test for HTML in description** | `normalizeDescription` is never tested with HTML input. BUG-1 means broken output when `contentSnippet` is absent. | High |
| **No test for `imageUrl` extraction from nested media fields** | `resolveRssImage` handles 12 candidate paths but no test exercises `mediaContent.$.url` or `mediaThumbnail.$.href`. Real feeds use these patterns. | Medium |
| **No test for global timeout behavior** | The 15s `Promise.race` timeout path is untested. Important because BUG-3 means background work continues after timeout. | Medium |
| **`truncateAtSentence` not directly tested** | Tested only indirectly through `normalizeItem`. No edge case test for boundary < 200 chars fallback or text exactly at 500 chars. | Low |

---

## 5. Code Quality Observations

**Positive:**
- Telemetry types are well-defined (`RssSourceTelemetryInput`, `RssRunTelemetryInput`, `SourceFetchResult`)
- `resolveRssImage` handles all common RSS media patterns in one function — cleaner than the design's inline approach
- `RssItem` type is explicitly defined instead of using `any` from rss-parser
- `__testing` export pattern for accessing private helpers is a good test-access pattern
- Filter diagnostics in `fetchFeedLive` (counting `missingTitle`, `missingDescription`, `missingUrl`, `missingImage` separately) — excellent for debugging per-source image hit rates
- `classifyRssErrorType` is cleanly separated and tested

**Negative:**
- Excessive `logger.info` calls. `fetchFeedCached` has 7 info-level log statements for a single source fetch. At 6 sources per run, that's 42+ info lines per cycle just from caching logic. Most of these should be `debug`.
- `rssService.ts` is 547 lines — reasonable but approaching the point where `fetchFeedCached` (which handles cache + live + retry + error classification + telemetry recording) should be decomposed.
- The telemetry module (`rssTelemetryStore.ts`) at 363 lines is longer than both `rssSourceRegistry.ts` (70 lines) and the pipeline integration changes combined. The supporting infrastructure outweighs the core feature.

---

## 6. Risk Assessment

| Component | Risk | Notes |
|---|---|---|
| `rssService.ts` core path | 🟡 Medium | HTML in descriptions (BUG-1) and sequential telemetry (BUG-2) |
| `rssSourceRegistry.ts` | 🟢 Low | Clean, minimal, correct |
| `rssTelemetryStore.ts` | 🟡 Medium | Unplanned scope, no pool shutdown, DDL on cold start |
| `pipelineRun.ts` integration | 🟡 Medium | GNews top-headlines fallback unreachable (BUG-4) |
| Test coverage | 🟢 Low | Good coverage, but missing HTML/media extraction/timeout tests |
| Deleted context docs | 🟡 Medium | GNews fallback has no remaining documentation |
| `.env.example` | 🟢 Low | All new vars documented with comments |
| `package.json` | 🟢 Low | Only `rss-parser` added, correct version |

---

## 7. Recommended Fixes — Priority Ordered

### Must fix before merge

| # | Finding | Effort |
|---|---|---|
| 1 | **BUG-1** — Strip HTML from description fallback fields | 15 min |
| 2 | **BUG-4** — Fix GNews top-headlines fallback logic to check `scoredArticles.length` not `articles.length` | 10 min |
| 3 | Add test for HTML description stripping | 10 min |

### Should fix before merge

| # | Finding | Effort |
|---|---|---|
| 4 | **BUG-2** — Parallelize telemetry writes instead of sequential await | 20 min |
| 5 | **CONCERN-4** — Remove telemetry internals from `index.ts` barrel export | 5 min |
| 6 | Add test for `resolveRssImage` with nested `$.url` and `$.href` patterns | 15 min |
| 7 | Reduce log verbosity in `fetchFeedCached` (info → debug for cache lookups) | 10 min |

### Should fix before production

| # | Finding | Effort |
|---|---|---|
| 8 | **BUG-3** — Clean up global timeout timer and document/accept soft-cutoff background completion semantics | 20 min |
| 9 | **CONCERN-3** — Add `pool.end()` to shutdown handler | 10 min |
| 10 | **CONCERN-5** — Keep GNews audit doc as archived reference | 5 min |
| 11 | **CONCERN-2** — Plan for schema migration strategy (not urgent, but before first schema change) | — |
