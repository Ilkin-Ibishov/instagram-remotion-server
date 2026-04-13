# Fix Commit Audit — `71d2815`
**Parent:** `83603f6` (original RSS implementation)  
**Message:** `fix: harden RSS fallback, timeout handling, and telemetry flow`  
**Scope:** +204 / -30 lines across 7 files  
**Auditor:** Senior developer review  
**Date:** 2026-04-12

---

## What was fixed (from prior audit)

| Original Finding | Fix Applied | Verdict |
|---|---|---|
| **BUG-1** — HTML in description fallback | `stripHtml()` function added, applied to summary/description/content fallback | ✅ Fixed |
| **BUG-2** — Sequential telemetry awaits | Telemetry calls collected into `telemetryTasks[]`, awaited via `Promise.allSettled` after loop | ✅ Fixed |
| **BUG-3** — Global timeout timer leak | `clearTimeout(timeoutId)` added when normal path wins the race | ✅ Partially fixed (see below) |
| **BUG-4** — GNews top-headlines fallback unreachable | Three-tier fallback: RSS → GNews top-headlines → GNews search. Check moved to post-filter `scoredArticles.length` | ✅ Fixed |
| **CONCERN-3** — pg Pool never closed | `closeTelemetryPool()` exported, called in `gracefulShutdown()` | ✅ Fixed |
| **CONCERN-4** — Telemetry internals in barrel export | All telemetry function exports removed from `index.ts` | ✅ Fixed |
| **CONCERN-7** — Log verbosity in fetchFeedCached | 4 `logger.info` calls downgraded to `logger.debug` for cache lookups | ✅ Fixed |
| Testing gap: HTML description | Test added: `strips HTML from fallback description fields` | ✅ Covered |
| Testing gap: nested media fields | Test added: `resolves image from nested media fields` | ✅ Covered |
| Testing gap: global timeout | Two tests added: timeout-fires path and timer-cleared path | ✅ Covered |
| Testing gap: sentence truncation | Test added: sentence boundary truncation at 500 chars | ✅ Covered |

**CONCERN-2** (no migration versioning) and **CONCERN-5** (deleted GNews docs) were not addressed. Both were "should fix before production" — acceptable to defer.

---

## New Issues Found

### ISSUE-1: `stripHtml` entity replacement loses semantic content (Low)

**File:** `rssService.ts:95-101`
```typescript
function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[^;]+;/g, ' ')   // ← replaces ALL entities with a space
    .replace(/\s+/g, ' ')
    .trim();
}
```

The entity regex `&[^;]+;` replaces HTML entities with a single space instead of decoding them. `&amp;` becomes ` ` instead of `&`, `&lt;` becomes ` ` instead of `<`. RSS feeds from tech sources will contain strings like `AT&amp;T`, `R&amp;D`, `&ldquo;quoted text&rdquo;` — these all become garbled: `AT T`, `R D`, ` quoted text `.

This only affects the fallback path (when `contentSnippet` is absent), so the blast radius is limited. But when it does fire, the Gemini prompt receives subtly mangled text.

**Fix:** Decode common entities before the catch-all strip:
```typescript
function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&[^;]+;/g, ' ')   // catch-all for remaining entities
    .replace(/\s+/g, ' ')
    .trim();
}
```

**Severity:** Low — only triggers on fallback path, and mangled entities degrade but don't break Gemini output.

---

### ISSUE-2: BUG-3 fix is incomplete — in-flight fetches still orphaned (Low, acknowledged)

The fix adds `clearTimeout` when the normal path wins the race. This prevents the timer from firing after completion — correct.

However, when the timeout *does* fire, the in-flight fetch promises still run to completion in the background. Each `fetchFeedCached` call writes to Redis cache on success. Post-timeout, these background completions produce valid cache entries for a run that's already finished.

This is the "soft-cutoff" approach vs the "hard-cancel" (`AbortController`) approach. For v1, soft-cutoff is acceptable — the orphaned cache writes contain valid data and will be used by subsequent runs. The only downside is holding HTTP connections open for up to 10s after the pipeline has moved on.

**Verdict:** Acceptable for now. Document this as a known behavior. Consider `AbortController` if timeout frequency increases in production.

---

### ISSUE-3: BUG-4 fix causes redundant `filterAndRankArticles` call when RSS throws (Low)

**File:** `pipelineRun.ts:63-106`

When RSS throws an exception, `articles` is set to `[]` (catch block at line 72). The pipeline then:

1. Line 96: `filterAndRankArticles([], ...)` → always returns `[]` (no-op)
2. Line 100: `useRssFeeds && scoredArticles.length === 0` → true → calls `fetchTopNews`
3. Line 104: `filterAndRankArticles(gnewsArticles, ...)` → real filtering

Step 1 is a wasted call — filtering an empty array. Functionally correct but a pointless computation. The previous code avoided this by checking `articles.length === 0` before filtering.

**Fix (optional):**
```typescript
if (useRssFeeds && articles.length === 0) {
  // RSS failed or returned nothing — skip directly to GNews top-headlines
  articles = await fetchTopNews(NEWS_CATEGORY);
}

let scoredArticles = filterAndRankArticles(articles, accountKeywords, logger, MIN_RELEVANCE_SCORE);

// RSS returned articles but none relevant — try top-headlines
if (useRssFeeds && scoredArticles.length === 0 && articles.length > 0) {
  articles = await fetchTopNews(NEWS_CATEGORY);
  scoredArticles = filterAndRankArticles(articles, ...);
}
```

**Severity:** Low — no runtime impact. One extra function call on an empty array.

---

### ISSUE-4: Step 0c log message is misleading when RSS threw (Low)

**File:** `pipelineRun.ts:101`
```typescript
logger.info('pipeline', '--- Step 0c: Top-Headlines Fallback (RSS yielded no relevant articles) ---');
```

When RSS throws (network error, parse failure), the log says "RSS yielded no relevant articles." The actual cause is "RSS fetch failed entirely." These are different failure modes with different debugging implications.

**Fix:** Either differentiate the message based on `articles.length` vs RSS-threw, or use a neutral message like `"Top-Headlines Fallback (no relevant articles from primary source)"`.

**Severity:** Low — misleading log line during debugging, not a runtime bug.

---

### ISSUE-5: Global timeout test hardcodes 15000ms magic number (Low)

**File:** `__tests__/rssService.test.ts` (timeout test)
```typescript
await vi.advanceTimersByTimeAsync(15_000);
```

This hardcodes the default `RSS_GLOBAL_TIMEOUT_MS` value. If the default changes in `rssService.ts`, the test silently breaks (either fires too early or doesn't trigger timeout). Should reference the same constant or set the env var explicitly in the test.

**Fix:**
```typescript
process.env.RSS_GLOBAL_TIMEOUT_MS = '15000';
// ... then advance by 15_000
```

**Severity:** Low — test brittleness, not a runtime issue.

---

### ISSUE-6: `closeTelemetryPool` resets `schemaInitialized` but doesn't guard against concurrent calls (Low)

**File:** `rssTelemetryStore.ts:354-363`
```typescript
export async function closeTelemetryPool(): Promise<void> {
  if (!pool) return;
  const activePool = pool;
  pool = null;
  schemaInitialized = false;
  await activePool.end();
}
```

If `closeTelemetryPool` is called while a telemetry write is in-flight (which is possible since `Promise.allSettled` telemetry tasks may still be running when shutdown triggers), `pool` becomes null mid-query. The in-flight query will still use the pool reference it captured, but subsequent queries will try to create a new pool via `getPool()` — after shutdown has been initiated.

In practice, this is a shutdown race condition that only matters if Railway sends SIGTERM during a pipeline run. The worst case is a `pool.end()` error logged during shutdown, which is already caught by the `.catch` in `server.ts:471`.

**Severity:** Low — edge case during shutdown only, already error-handled.

---

## Test Coverage Assessment

| New Test | What It Validates | Verdict |
|---|---|---|
| `strips HTML from fallback description fields` | `<p>`, `<a>`, `&nbsp;` removed from summary field | ✅ Good — directly tests BUG-1 fix |
| `resolves image from nested media fields` | `mediaContent.$.url` extraction path | ✅ Good — covers previously untested resolveRssImage path |
| `truncates long descriptions at sentence boundary` | 500-char clip with period boundary > 200 | ✅ Good — covers truncation edge case |
| `returns on global timeout when source fetches hang` | Timeout fires, returns `[]`, records `globalTimeoutTriggered: true` | ✅ Good — validates BUG-3 timeout path |
| `clears global timeout timer when all sources finish before timeout` | Timer count is 0 after normal completion | ✅ Good — validates timer cleanup |
| `falls back to GNews top-headlines when RSS returns only irrelevant articles` | RSS returns articles → filter zeros them → GNews called → no search fallback | ✅ Good — directly tests BUG-4 fix |
| Updated `falls back to GNews when RSS primary fetch throws` | Now correctly expects 2 filterAndRankArticles calls | ✅ Good — updated for three-tier flow |
| Updated `uses search fallback...` | Now expects 3 filterAndRankArticles calls (RSS → headlines → search) | ✅ Good — updated for three-tier flow |

**Missing:** No test for `closeTelemetryPool()`. Not blocking — it's a simple shutdown utility.

---

## Overall Verdict

The fix commit addresses all "must fix before merge" and "should fix before merge" items from the original audit. The implementation is clean and follows the recommended approaches (parallel telemetry, HTML stripping, three-tier fallback, timer cleanup, barrel export cleanup, pool shutdown).

**Remaining items are all Low severity.** ISSUE-1 (entity decoding) is the most impactful of the group — it will produce occasional garbled text in Gemini prompts when `contentSnippet` is absent. The rest are test hygiene, logging clarity, and edge-case race conditions.

**Merge readiness:** Yes. The branch is ready to merge. The Low-severity items can be addressed in a follow-up commit.
