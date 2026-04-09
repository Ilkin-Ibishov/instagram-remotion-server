# Implementation Walkthrough

Autonomous implementation of all ClickUp backlog tasks identified in the GNews integration audit (2026-04-08).  
Tasks were implemented in priority order: P0 → P1 bugs → infrastructure → P2 enhancements.

---

## Task 1 — Fix Misleading Mock Fallback Log [P0]
**ClickUp:** `86ex6717z`  
**File:** `src/pipeline/newsService.ts`

The log that fired when `GNEWS_API_KEY` was absent said "Falling back to mock news", implying a mock result would be returned. In reality the function returns `[]` and the pipeline aborts. Changed the message to:  
`"GNEWS_API_KEY not configured — returning empty result. Pipeline will abort with no articles."`

---

## Task 2 — Remove DEBUG console.log Dumps [P1]
**ClickUp:** `86ex6718y`  
**File:** `src/pipelineRun.ts`

Removed two unconditional `console.log` statements that `JSON.stringify`-dumped the full render manifest and API response on every pipeline run. These could log large payloads and any sensitive data embedded in article content. Also replaced all remaining `console.log` / `console.error` calls in `pipelineRun.ts` with structured `logger.info` / `logger.error` calls.

---

## Task 3 — Filter Articles Without Image at Source [P1]
**ClickUp:** `86ex671at`  
**File:** `src/pipeline/newsService.ts`

Added `.filter(a => a.imageUrl && a.title)` after `.map()` in both `fetchTopNews` and `fetchSearchNews`. The `HOOK_A` template requires `imageUrl` to render; articles without one previously caused silent render crashes deep in the pipeline. Rejecting them at source is both safer and gives a clearer failure point. Updated test fixtures to provide image URLs where they were missing (`image: null` → `image: 'https://...'`).

---

## Task 4 — Document Content Truncation + Replace console.log in aiService [P1]
**ClickUp:** `86ex671bk`  
**File:** `src/pipeline/aiService.ts`

Confirmed the Gemini prompt already uses `${article.description}` instead of `${article.content}`. Added an inline comment explaining the deliberate choice: GNews free tier truncates `content` at ~260 characters with a `[N chars]` suffix, making it unsuitable for AI context; `description` is the full editorial summary. Also replaced all `console.log` and `console.error` calls in `generatePostContentAI` with structured `Logger` calls (`debug` for raw response preview, `error` for parse failures), and imported `Logger` at the top of `aiService.ts`.

---

## Task 5 — Normalize Article URLs [P1]
**ClickUp:** `86ex6719p`  
**Files:** `src/utils/normalizeUrl.ts` (new), `src/pipeline/newsFiltering.ts`, `src/pipeline/postHistory.ts`, `__tests__/normalizeUrl.test.ts` (new)

Created `normalizeArticleUrl(url)` which applies the following rules in order:
1. Lowercase the entire URL
2. Normalise scheme to `https`
3. Strip `www.` subdomain
4. Remove tracking query params (`utm_*`, `ref`, `fbclid`, `gclid`, etc.)
5. Remove URL fragment (`#…`)
6. Strip trailing slash on pathname

Applied in:
- `newsFiltering.ts`: `hasBeenPosted(normalizeArticleUrl(article.url))`
- `postHistory.ts`: both `hasBeenPosted` and `recordPost` normalise before compare/store so history entries are consistent regardless of how the URL was originally received

Added 13 unit tests covering all edge cases (invalid URLs, empty strings, combined params).

---

## Task 6 — Lock TTL Renewal Heartbeat [P1]
**ClickUp:** `86ex5m4fn`  
**Files:** `src/pipeline/schedulerLock.ts`, `src/pipeline/schedulerRunner.ts`, `src/utils/redisClient.ts` (new)

Added two new exports to `schedulerLock.ts`:
- `renewDistributedLock(handle, ttlSeconds)` — Lua atomic script: `if get(key) == token then expire(key, ttl)` — only extends the TTL when we still own the lock.
- `runWithLockHeartbeat(handle, ttlSeconds, fn)` — wraps a long-running async function. A `setInterval` fires at `ttlSeconds / 2` intervals to call `renewDistributedLock`. If the lock is lost (returns false), the interval is cleared and an error is thrown after `fn` completes.

Applied in `schedulerRunner.ts`: the `executeWithRetry(runPipeline)` call is now wrapped with `runWithLockHeartbeat(lock, lockTtlSeconds, ...)`.

Also extracted the private `getRedisClient` singleton into `src/utils/redisClient.ts` so the lock module and the new cache module share one connection.

Updated `schedulerRunner.test.ts` to mock `runWithLockHeartbeat` as a transparent pass-through so existing tests remain valid.

---

## Task 7 — GET /api/status Health Endpoint
**ClickUp:** `86ex5m5j7`  
**Files:** `server.ts`, `src/pipeline/scheduleState.ts`

Added `readScheduleState(accountId): Promise<ScheduleState | null>` to `scheduleState.ts` — a read-only SELECT query that returns the current row without modifying it. Returns `null` if the pipeline has never run.

Added `GET /api/status` to `server.ts`:
- Reads state for `process.env.ACCOUNT_ID ?? 'default'`
- Returns `{ last_success_at, last_error_at, last_error_message, next_run_at, last_run_at }`
- Returns `{ status: 'no_data' }` if the pipeline hasn't run yet
- Returns HTTP 503 if Postgres is unavailable (e.g., `DATABASE_URL` missing)

---

## Task 8 — Broader Secrets Audit
**ClickUp:** `86ex5m5ja`  
**Files:** `src/pipeline/newsService.ts`, `src/pipeline/aiService.ts`, `src/pipelineRun.ts`, `src/pipeline/postHistory.ts`, `src/pipeline/newsFiltering.ts`

- `newsService.ts`: Added `safeUrl` and `safeSearchUrl` constants that replace `apikey=<value>` with `apikey=REDACTED` for use in all `logger.error` calls. The real API key is never logged.
- `server.ts`: The `x-scheduler-secret` header value is never logged — only its presence is checked.
- `instagramPublisher.ts`: Session cookies are never logged (only metadata like expiry dates).
- All `console.*` calls in pipeline files replaced with structured `Logger` calls so output flows through the controlled JSON log format.

---

## Task 9 — Redis Cache for GNews API [P2]
**ClickUp:** `86ex671dk`  
**Files:** `src/pipeline/newsService.ts`, `src/utils/redisClient.ts`

Added `fetchWithCache<T>(cacheKey, fn)` in `newsService.ts`:
- If `REDIS_URL` is not set, calls `fn()` directly (no-op bypass for local dev).
- If Redis is available, checks for a cached JSON value.
- On cache miss, calls `fn()`, stores result with `EX: GNEWS_CACHE_TTL_SECONDS` (default 600s / 10 min, configurable via env).
- On any Redis error, logs a warning and falls back to the live API call gracefully.

Both `fetchTopNews` and `fetchSearchNews` are wrapped. Cache keys encode all relevant params (category, lang, country, maxResults, query, sortby, date range) to avoid stale cross-query hits.

`newsService.test.ts` mocks `src/utils/redisClient` to prevent real Redis connections in the test environment, ensuring the live API path is tested via the `fetch` mock.

---

## Already-Implemented Tasks (Marked Complete)

| Task | ID | Description |
|------|-----|-------------|
| Retry logic | `86ex5j8zb` | `executeWithRetry` in `retryPolicy.ts` — used across pipeline |
| Postgres scheduling | `86ex5j8za` | `scheduleState.ts` — tracks `next_run_at`, `last_success_at`, etc. |
| Session expiry check | `86ex5j8z9` | `validateInstagramSessionExpiry` in `instagramPublisher.ts` |
| Redis distributed lock | `86ex5j8z8` | `acquireDistributedLock` / `releaseDistributedLock` in `schedulerLock.ts` |
| Randomized scheduling | `86ex5j8qe` | `computeNextRunAt` with jitter in `schedulerRunner.ts` |

---

## Test Summary

| Test file | Tests | Status |
|-----------|-------|--------|
| `__tests__/retryPolicy.test.ts` | 3 | ✅ |
| `__tests__/normalizeUrl.test.ts` | 13 | ✅ |
| `__tests__/newsFiltering.test.ts` | 2 | ✅ |
| `__tests__/newsService.test.ts` | 15 | ✅ |
| `__tests__/pipelineRun.test.ts` | 1 | ✅ |
| `__tests__/schedulerRunner.test.ts` | 9 | ✅ |
| `__tests__/sessionValidation.test.ts` | 4 | ✅ |
| `__tests__/server.test.ts` | 3 | ✅ |
| **Total** | **50** | ✅ |
