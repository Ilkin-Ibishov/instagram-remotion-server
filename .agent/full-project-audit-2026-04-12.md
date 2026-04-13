# Full Project Audit — instagram-remotion-server

**Date:** 2026-04-12
**Scope:** Code quality (senior dev) + Business logic (content manager)
**Method:** Source-level review of all .ts/.tsx files, tests, config, workflows, and data files
**Branch:** main (latest — commit `498e32a`, includes RSS integration)
**Rule:** Problems and bugs ONLY — nothing verified/good is listed.

---

## Table of Contents

1. [CRITICAL: Security](#1-critical-security)
2. [Server & Infrastructure](#2-server--infrastructure)
3. [Pipeline Orchestration & Scheduling](#3-pipeline-orchestration--scheduling)
4. [News Service & Filtering (GNews)](#4-news-service--filtering-gnews)
5. [RSS Integration (NEW)](#5-rss-integration-new)
6. [AI Content Generation](#6-ai-content-generation)
7. [Remotion Templates & Rendering](#7-remotion-templates--rendering)
8. [Instagram Publishing Automation](#8-instagram-publishing-automation)
9. [Test Suite Quality](#9-test-suite-quality)
10. [Business Logic & Content Strategy](#10-business-logic--content-strategy)
11. [Summary Matrix](#11-summary-matrix)

---

## 1. CRITICAL: Security

### SEC-01: Instagram session cookies committed to Git (CRITICAL)
- **File:** `storage.json`
- **Detail:** Full Instagram session including `sessionid`, `csrftoken`, `ds_user_id`, reCAPTCHA tokens, and device fingerprinting cookies are in version control.
- **Impact:** Anyone with repo access can impersonate the Instagram account. Account takeover possible.
- **Action:** Change Instagram password immediately to invalidate session. Run `git filter-repo` to purge from history. Add `storage.json` to `.gitignore`.

### SEC-02: .gitignore missing critical entries (HIGH)
- **File:** `.gitignore`
- **Missing:** `storage.json`, `post-history.json`. Also has duplicate entries (`node_modules` listed twice, `dist/` listed twice).
- **Action:** Add `storage.json` and `post-history.json` to `.gitignore`.

### SEC-03: API key exposed in URL query parameters (HIGH)
- **File:** `src/pipeline/newsService.ts` — lines 72, 177
- **Detail:** GNews API key is appended to URL as `&apikey=...`. Appears in network logs, proxy servers, error messages. Logging redacts it, but the raw URL is passed to `fetch()`.

### SEC-04: Scheduler secret comparison is not timing-safe (MEDIUM)
- **File:** `server.ts` — lines 372-379
- **Detail:** Uses `!==` for secret comparison instead of `crypto.timingSafeEqual()`. Timing side-channel attack possible.

### SEC-05: Remotion render disables all browser security (MEDIUM)
- **File:** `server.ts` — lines 557, 584
- **Detail:** `disableWebSecurity: true`, `--no-sandbox`, `--disable-setuid-sandbox`. If any untrusted content reaches the renderer, this is exploitable.

### SEC-06: Logger writes sensitive data without filtering (MEDIUM)
- **File:** `src/utils/logger.ts` — line 55, 65
- **Detail:** All `data` fields are logged to file and console unfiltered. API keys, session tokens, or credentials in `data` will be written to disk in plaintext with world-readable permissions (default 644).

---

## 2. Server & Infrastructure

### SRV-01: Running tsx in production Docker image (HIGH)
- **File:** `Dockerfile` — line 51
- **Detail:** `npm start` runs `tsx server.ts` — TypeScript is interpreted at runtime. Higher memory, slower cold start, no ahead-of-time type checking. Should compile to JS with a build step.

### SRV-02: ensureBundle() failure doesn't block server startup (HIGH)
- **File:** `server.ts` — lines 414-416
- **Detail:** If Remotion bundling fails, server still starts and listens. All subsequent render requests will fail or hang because `bundleLocation` is undefined.

### SRV-03: ACCOUNT_ID vs SCHEDULE_ACCOUNT_ID env var mismatch (MEDIUM)
- **File:** `server.ts` — line 340 vs `.env.example`
- **Detail:** Code reads `process.env.ACCOUNT_ID` but `.env.example` defines `SCHEDULE_ACCOUNT_ID`. Will always fall back to `'default'`.

### SRV-04: parseInt() without bounds validation (MEDIUM)
- **File:** `server.ts` — lines 287, 551
- **Detail:** `parseInt(process.env.PORT)` and `parseInt(process.env.RENDER_CONCURRENCY)` accept garbage inputs like `"3000abc"` → 3000. No validation for negative numbers or NaN.

### SRV-05: Scheduler interval doesn't protect against overlapping runs (MEDIUM)
- **File:** `server.ts` — line 233
- **Detail:** `setInterval(async () => { await runSchedulerTick() })` — if a tick takes longer than the interval period, a new tick starts concurrently. No debounce/guard.

### SRV-06: Redis client never gracefully disconnected (MEDIUM)
- **File:** `src/utils/redisClient.ts`
- **Detail:** No `client.quit()` on process shutdown. Redis connection leaks on restarts.

### SRV-07: Redis client uses `as any` type cast (LOW)
- **File:** `src/utils/redisClient.ts` — line 21
- **Detail:** `client.connect().then(() => client as any)` defeats TypeScript type safety.

### SRV-08: Failed Redis connection is cached forever (MEDIUM)
- **File:** `src/utils/redisClient.ts` — lines 8-23
- **Detail:** If `client.connect()` rejects, `redisClientPromise` stays set to the rejected promise. All subsequent calls return the same failed promise. No retry.

### SRV-09: Config hardcodes renderFormat but server accepts dynamic format (LOW)
- **File:** `src/pipeline/config.ts` vs `server.ts` line 480
- **Detail:** Config says `renderFormat: 'mp4'` but the `/api/render` endpoint accepts a `format` query parameter. Inconsistent.

### SRV-10: Missing build script in package.json (LOW)
- **File:** `package.json`
- **Detail:** No `build` script. `verify` script references non-existent `verify-option-b.ts`.

---

## 3. Pipeline Orchestration & Scheduling

### PIPE-01: Lock-loss detection happens AFTER pipeline completes (HIGH)
- **File:** `src/pipeline/schedulerLock.ts` — line 99
- **Detail:** `lockLost` flag is checked after `await fn()`. If another process steals the lock mid-pipeline, the current process finishes unaware, potentially causing duplicate posts.

### PIPE-02: Heartbeat renewal interval too infrequent (HIGH)
- **File:** `src/pipeline/schedulerLock.ts` — line 80
- **Detail:** With 2-hour TTL, heartbeat interval is `TTL/2 = 1 hour`. Lock is renewed only once per hour. If a pipeline run exceeds 1 hour, there's a window where the lock could expire before the next renewal.

### PIPE-03: Silent Redis errors in heartbeat (MEDIUM)
- **File:** `src/pipeline/schedulerLock.ts` — lines 91-93
- **Detail:** Transient Redis errors during lock renewal are caught but not logged. If Redis goes down, the lock silently expires while the operation continues.

### PIPE-04: post-history.json uses process.cwd() for path (MEDIUM)
- **File:** `src/pipeline/postHistory.ts` — line 18
- **Detail:** `path.join(process.cwd(), 'post-history.json')` — if working directory changes at runtime, history reads/writes go to the wrong location. Could cause duplicate posts.

### PIPE-05: Corrupted post-history.json silently wiped on next write (MEDIUM)
- **File:** `src/pipeline/postHistory.ts` — lines 23-33
- **Detail:** If JSON parsing fails, returns empty array. Next `recordPost()` call overwrites the file. All historical data lost permanently.

### PIPE-06: Synchronous file I/O in postHistory (LOW)
- **File:** `src/pipeline/postHistory.ts` — lines 25-27, 65
- **Detail:** `readFileSync` and `writeFileSync` block the event loop during pipeline execution.

### PIPE-07: retryPolicy naming confusion (LOW)
- **File:** `src/pipeline/retryPolicy.ts` — line 35
- **Detail:** `maxRetries: 1` means 2 total attempts (initial + 1 retry). The parameter name suggests 1 total attempt.

### PIPE-08: Windows path handling fragile in pipelineRun (LOW)
- **File:** `src/pipelineRun.ts` — lines 153-157
- **Detail:** Hardcoded `C:/tmp/renders` path with `path.resolve()` and forward slashes. Fragile on Windows.

---

## 4. News Service & Filtering

### NEWS-01: mergeAndDedupeArticles doesn't normalize URLs (MEDIUM)
- **File:** `src/pipeline/newsService.ts` — line 268
- **Detail:** `normalizeUrl` is imported but NOT used in the merge/dedup function. Articles from different sources with the same content but slightly different URLs (trailing slash, www, protocol) won't be deduplicated.

### NEWS-02: Retry-After header only handles numeric format (MEDIUM)
- **File:** `src/pipeline/newsService.ts` — lines 98-104
- **Detail:** `Number(retryAfter)` fails on RFC 1123 date strings (valid Retry-After format). Returns NaN and falls back to default delay.

### NEWS-03: Cached data from Redis not validated against schema (MEDIUM)
- **File:** `src/pipeline/newsService.ts` — line 33
- **Detail:** `JSON.parse(cached)` returns whatever is stored. If cache is corrupted or contains unexpected shape, invalid data propagates silently.

### NEWS-04: Image-required filter too aggressive (MEDIUM — Business Logic)
- **File:** `src/pipeline/newsService.ts` — lines 115, 223
- **Detail:** Articles without `imageUrl` are entirely discarded. This can severely limit the article pool, especially for niche topics. No fallback to placeholder images.

### NEWS-05: Recent post penalty is ineffective (MEDIUM — Business Logic)
- **File:** `src/pipeline/newsFiltering.ts` — lines 131-134
- **Detail:** Threshold of 5+ recent posts with only -5 penalty. A single keyword match overcomes this. Anti-repetition logic is essentially non-functional.

### NEWS-06: getRecentPosts() return value not null-checked (LOW)
- **File:** `src/pipeline/newsFiltering.ts` — line 161
- **Detail:** If `getRecentPosts()` returns null/undefined, `recent.length` will crash.

### NEWS-07: Non-deterministic article selection (LOW)
- **File:** `src/pipeline/newsFiltering.ts` — line 286
- **Detail:** `Math.random()` in "diverse" strategy makes article selection non-reproducible. Impossible to debug or audit which article was selected and why.

---

## 5. RSS Integration (NEW — rssService, rssSourceRegistry, rssTelemetryStore)

### RSS-01: XXE attack vector — RSS parser not hardened (CRITICAL)
- **File:** `src/pipeline/rssService.ts` — line 65-74
- **Detail:** `rss-parser` is used without disabling external entity expansion. Malicious RSS feeds can trigger XXE attacks (data exfiltration, billion-laughs DoS).
- **Action:** Configure parser with `{ xml2js: { strict: false, normalize: true } }` and disable entity expansion.

### RSS-02: Global timeout returns empty array instead of error state (CRITICAL)
- **File:** `src/pipeline/rssService.ts` — line 462
- **Detail:** When `GLOBAL_FETCH_TIMEOUT_MS` (15s) fires, `resolve([])` returns an empty settled-results array. Pipeline treats this as "no news today" not "fetch failed." Orphaned source tasks continue running in background, writing telemetry after timeout.
- **Impact:** Silent zero-article days. Memory leaks from orphaned promises. Corrupted telemetry.

### RSS-03: O(n²) dedup algorithm on unbounded article count (HIGH)
- **File:** `src/pipeline/rssService.ts` — lines 179-222
- **Detail:** `crossSourceDedup()` compares each article's title Set against ALL previously seen Sets. With 10 sources × 100 articles = 1,000 items, that's ~500K comparisons. `seenTitleSets` array grows unbounded with no size limit.
- **Impact:** Severe slowdown and memory growth on high-volume feeds.

### RSS-04: JSON.parse() on untrusted Redis cache with no validation (HIGH)
- **File:** `src/pipeline/rssService.ts` — line 285
- **Detail:** `JSON.parse(cached)` with no try-catch and no schema validation. Corrupted cache crashes the pipeline.

### RSS-05: Stale cache used indefinitely (HIGH)
- **File:** `src/pipeline/rssService.ts` — lines 292-303
- **Detail:** Cache age > TTL × 2 triggers a warning log but the stale data is still returned and used. Week-old articles can be re-served.

### RSS-06: Default timeout values nearly guarantee global timeout (HIGH)
- **File:** `src/pipeline/rssService.ts` — lines 61-62
- **Detail:** `FETCH_TIMEOUT_MS = 10_000` (per source), `GLOBAL_FETCH_TIMEOUT_MS = 15_000` (total). With 6+ RSS sources, the 15s global timeout fires before most sources complete. Most runs will hit RSS-02.

### RSS-07: Niche matching is case-sensitive despite lowercase conversion (HIGH)
- **File:** `src/pipeline/rssSourceRegistry.ts` — line 68
- **Detail:** Input niches are lowercased but source niches are NOT lowercased in comparison. If caller passes `['Technology']`, it won't match `'technology'` in source config. Falls back to returning ALL sources.
- **Impact:** Niche filtering is silently bypassed.

### RSS-08: Telemetry tables grow unbounded — no retention/cleanup (HIGH)
- **File:** `src/pipeline/rssTelemetryStore.ts` — lines 100-130
- **Detail:** `rss_source_telemetry` and `rss_run_telemetry` tables have no TTL, no cleanup, no partitioning. Insert-only with no DELETE. Missing index on `run_id`.
- **Impact:** Database bloat over months. Query degradation.

### RSS-09: Race condition in failure counter (MEDIUM)
- **File:** `src/pipeline/rssTelemetryStore.ts` — lines 211-212
- **Detail:** `INCR` + threshold check is not atomic. Two concurrent failures can both hit threshold and apply duplicate cooldowns.

### RSS-10: Invalid date parsing in cooldown check (MEDIUM)
- **File:** `src/pipeline/rssTelemetryStore.ts` — lines 163-164
- **Detail:** `new Date(cooldownUntil).getTime()` on malformed string returns NaN. Check passes silently — source is never skipped and invalid key is never cleaned up.

### RSS-11: ON CONFLICT silently overwrites run telemetry (MEDIUM)
- **File:** `src/pipeline/rssTelemetryStore.ts` — line 319
- **Detail:** `ON CONFLICT (run_id) DO UPDATE` replaces previous run data. If retries cause duplicate runIds, metrics are silently overwritten.

### RSS-12: titleWordSet regex strips all non-ASCII (MEDIUM)
- **File:** `src/pipeline/rssService.ts` — line 163
- **Detail:** `[^a-z0-9\s]` removes all unicode characters. Non-English titles lose all meaningful content before dedup, causing false-positive duplicate detection.

### RSS-13: Jaccard similarity returns 1 for two empty sets (MEDIUM)
- **File:** `src/pipeline/rssService.ts` — lines 170-171
- **Detail:** Two articles with only stopwords in titles get similarity = 1.0 (perfect match) and are deduplicated. Valid articles dropped.

### RSS-14: HTML injection possible in normalized content (MEDIUM)
- **File:** `src/pipeline/rssService.ts` — line 107, 146
- **Detail:** `stripHtml()` handles common entities but not all injection vectors. Unicode/HTML escapes in RSS content can pass through to downstream systems.

### RSS-15: Pool connection never closed in CLI mode (MEDIUM)
- **File:** `src/pipeline/rssTelemetryStore.ts` — lines 78-90
- **Detail:** `closeTelemetryPool()` only called in server.ts shutdown. CLI pipeline execution leaks database connections.

### RSS-16: pipelineRun.ts `rssFetchFailed` flag set but never used in conditions (MEDIUM)
- **File:** `src/pipelineRun.ts` — lines 73, 107
- **Detail:** Flag is set on RSS exception (line 73) but the fallback condition (line 107) only checks `scoredArticles.length === 0`. The flag is logged but doesn't influence flow — the fallback works by accident because failed RSS = empty articles = empty scores.

### RSS-17: selectBestArticle null dereference risk (MEDIUM)
- **File:** `src/pipelineRun.ts` — line 141
- **Detail:** `selectedArticleItem.article` accessed without null check. If `selectBestArticle()` returns null after the line 137 check, this throws.

---

## 6. AI Content Generation

### AI-01: Prompt injection via article data (CRITICAL)
- **File:** `src/pipeline/aiService.ts` — lines 409-411
- **Detail:** Article `title`, `source.name`, and `description` are injected directly into the Gemini prompt with no escaping. A malicious article title like `"]\"},\"callToAction\":\"HACKED"` could break the JSON schema or manipulate output.

### AI-02: Prompt injection via account profile (HIGH)
- **File:** `src/pipeline/aiService.ts` — lines 227-230
- **Detail:** `account.handle`, `account.bio`, `account.niche` are injected into the prompt unsanitized. If bio contains `"Ignore the above instructions..."`, it could manipulate AI output.

### AI-03: Unescaped imageUrl breaks JSON in prompt (MEDIUM)
- **File:** `src/pipeline/aiService.ts` — line 431
- **Detail:** `"${article.imageUrl}"` — if URL contains quotes or special characters, the JSON template in the prompt becomes invalid. Should use `JSON.stringify()`.

### AI-04: No timeout on Gemini API call (MEDIUM)
- **File:** `src/pipeline/aiService.ts` — line 477
- **Detail:** `generateContent()` has no timeout. If Gemini hangs, the entire pipeline hangs indefinitely.

### AI-05: Log directory not ensured before write (MEDIUM)
- **File:** `src/pipeline/aiService.ts` — line 497
- **Detail:** `fs.writeFileSync('./logs/gemini-response-...')` — if `./logs` directory doesn't exist, this crashes.

### AI-06: contentGenerator.ts has no error handling (HIGH)
- **File:** `src/pipeline/contentGenerator.ts`
- **Detail:** Thin wrapper around `generatePostContentAI()` with zero try-catch, no fallback, no null checking on returned content.

### AI-07: Niche/effects values never validated (MEDIUM)
- **File:** `src/pipeline/accountProfile.ts` — lines 30-38
- **Detail:** Niche strings and effects are split/trimmed but never validated against allowed values. Empty arrays after filtering are not caught.

### AI-08: Keyword specificity sorted by string length (LOW)
- **File:** `src/pipeline/accountProfile.ts` — lines 86-91
- **Detail:** Keywords sorted by length as a proxy for specificity. "ai" (2 chars, very specific) ranks below "technology" (10 chars, generic). Inverted priority.

---

## 6. Remotion Templates & Rendering

### TPL-01: Text overflow in ALL templates — no max-width or truncation (CRITICAL)
- **Files:** `HookA.tsx` line 150, `ContentListicle.tsx` line 156, `ContentGeneric.tsx` line 140, `ContentVideo.tsx` line 203, `CtaFinal.tsx` line 109
- **Detail:** Headlines at 64-96px font size with no `overflow: hidden`, `textOverflow: 'ellipsis'`, `maxWidth`, or `WebkitLineClamp`. Long text overflows the 1080px container, producing broken layouts on Instagram.
- **Impact:** Any article with a headline over ~40 characters at 96px will overflow. This is the majority of news headlines.

### TPL-02: ContentListicle.tsx crashes on missing items array (HIGH)
- **File:** `src/templates/ContentListicle.tsx` — line 42
- **Detail:** If `data.items` is undefined (from AI generating malformed data), `.map()` throws TypeError. No default or guard.

### TPL-03: ContentVideo.tsx has no video error fallback (HIGH)
- **File:** `src/templates/ContentVideo.tsx` — lines 114-122
- **Detail:** If `data.videoUrl` is 404, unsupported codec, or unreachable, the Video component renders nothing. User sees a black rectangle on Instagram. No fallback image or error indicator.

### TPL-04: Error slides render on Instagram (MEDIUM)
- **File:** `src/remotion/SlideComposition.tsx` — lines 35-49
- **Detail:** If template ID is unknown, a white-on-black error message renders. This would be posted to Instagram as an actual slide.

### TPL-05: Fixed 720-frame duration for all compositions (MEDIUM)
- **File:** `src/remotion/index.tsx` — line 14
- **Detail:** Hardcoded 24-second duration. If video content is longer, it gets cut off.

### TPL-06: Effects performance issue in batch renders (MEDIUM)
- **File:** `src/components/EffectsOverlay.tsx` — lines 29, 44
- **Detail:** CRT scanlines (repeating 4px gradient) and noise SVG filter cause constant repaints during Remotion encoding. Slows batch renders significantly.

### TPL-07: No validation of effects combinations (LOW)
- **File:** `src/components/EffectsOverlay.tsx`
- **Detail:** "crt" + "halftone" together create unintended visual artifacts. No compatibility matrix or documentation.

### TPL-08: Halftone dot size too large for 1080px (LOW)
- **File:** `src/components/EffectsOverlay.tsx` — line 108
- **Detail:** 8x8px dots at 1080x1080 resolution create visibly pixelated output. Not suitable for news content.

---

## 7. Instagram Publishing Automation

### IG-01: Race condition in post success detection (HIGH)
- **File:** `src/automation/instagramPublisher.ts` — lines 214-217
- **Detail:** `Promise.race()` between "shared text" and "success image" watchers. If "has been shared" text disappears before success image appears (common in Instagram's SPA), the race rejects. Post may actually succeed but code reports failure.

### IG-02: No caption length validation (HIGH)
- **File:** `src/automation/instagramPublisher.ts` — line 181
- **Detail:** `page.keyboard.insertText()` for caption with no length check. Instagram limit is 2,200 characters. Exceeding causes silent failure or truncation.

### IG-03: Share button polling has no final error (MEDIUM)
- **File:** `src/automation/instagramPublisher.ts` — lines 187-203
- **Detail:** 15-iteration loop (15s total) looking for Share button. If not found within window, no error thrown — behavior undefined.

### IG-04: Reel modal detection is one-shot (MEDIUM)
- **File:** `src/automation/instagramPublisher.ts` — line 156
- **Detail:** Checks for "OK" dismissal button only once. If modal appears after the check, publish continues with wrong element in focus.

### IG-05: Session expiry validation is optional (MEDIUM)
- **File:** `src/automation/instagramPublisher.ts` — line 91
- **Detail:** `validateInstagramSessionExpiry()` is called but its result doesn't block publishing. Expired session proceeds and fails later with cryptic Playwright errors.

### IG-06: No login-state validation after page load (MEDIUM)
- **File:** `src/automation/instagramPublisher.ts` — line 98-100
- **Detail:** Uses `domcontentloaded` + 5s fixed delay. No check for "login required" or "session expired" state before proceeding with upload.

---

## 8. Test Suite Quality

### TEST-01: pipelineRun.test.ts is over-mocked to the point of uselessness (HIGH)
- **Detail:** Mocks 9+ modules. Tests verify mock call counts, not actual pipeline logic. If implementation was rewritten, tests would still pass. No happy-path test exists.

### TEST-02: No test for happy-path pipeline execution (HIGH)
- **Detail:** Only edge cases tested (no articles found, fallback triggered). The main success path (fetch → filter → generate → render → publish) has zero test coverage.

### TEST-03: Retry delay is never verified (MEDIUM)
- **File:** `__tests__/retryPolicy.test.ts`
- **Detail:** Tests mock 1ms delay but never assert the delay actually occurred. If delay code was deleted, test still passes.

### TEST-04: Missing test for all-retries-exhausted scenario (MEDIUM)
- **File:** `__tests__/retryPolicy.test.ts`
- **Detail:** Only tests immediate success and one retry. Never tests what happens when max retries are reached.

### TEST-05: Scheduler concurrency test doesn't test real concurrency (MEDIUM)
- **File:** `__tests__/schedulerRunner.test.ts` — lines 152-193
- **Detail:** Uses synchronous `locked = true/false` state. Doesn't test actual async lock contention.

### TEST-06: newsService cache behavior untested (MEDIUM)
- **File:** `__tests__/newsService.test.ts`
- **Detail:** Redis caching wraps all requests but no test verifies cache hit/miss behavior or Redis-down fallback.

### TEST-07: global.fetch mock not properly isolated (MEDIUM)
- **File:** `__tests__/newsService.test.ts` — line 10
- **Detail:** Sets `global.fetch` directly. `vi.restoreAllMocks()` may not properly clean up, causing cross-test pollution.

### TEST-08: Session validation missing boundary and multi-cookie tests (LOW)
- **File:** `__tests__/sessionValidation.test.ts`
- **Detail:** No test for expiry exactly at the minimum threshold. No test for multiple cookies with different expiry times.

### TEST-09: testMock.ts and test-railway-endpoint.ts not integrated (LOW)
- **Detail:** Manual scripts not in test suite. Regressions they could catch go undetected in CI.

### TEST-10: selectBestArticle "diverse" strategy has zero test coverage (MEDIUM)
- **File:** `__tests__/newsFiltering.test.ts`
- **Detail:** Random selection from top 3 is never tested. Keyword weight system only tested implicitly.

---

## 9. External Integrations

### INT-01: n8n-workflow.json deleted but referenced in docs (LOW)
- **Detail:** The n8n workflow file was removed in the RSS integration merge, but may still be referenced in context docs or external systems.

### INT-02: ClickUp client doesn't retry on 429 rate limits (MEDIUM)
- **File:** `src/automation/clickupClient.ts` — lines 65, 88
- **Detail:** Only retries on 5xx errors. 429 (Too Many Requests) fails immediately.

---

## 10. Business Logic & Content Strategy

### BIZ-01: Image-required filter eliminates too many articles (HIGH)
- **Detail:** Articles without `imageUrl` are completely discarded (newsService.ts lines 115, 223). For niche topics, this can reduce the pool to zero. No placeholder image fallback, no soft preference.

### BIZ-02: Anti-repetition scoring is non-functional (MEDIUM)
- **Detail:** 5+ recent posts threshold with -5 penalty (newsFiltering.ts lines 131-134). A single keyword match (+3 to +15) overcomes the penalty. The system will repeatedly post about the same dominant topic.

### BIZ-03: Fixed 4-slide sequence limits content variety (MEDIUM)
- **Detail:** HOOK_A → CONTENT_LISTICLE → CONTENT_GENERIC → CTA_FINAL is hardcoded. Every post looks identical in structure. Instagram algorithm deprioritizes repetitive formats. No variation in slide count or template order.

### BIZ-04: CONTENT_VIDEO template exists but is never generated by AI (MEDIUM)
- **Detail:** Template code exists but Gemini prompt only generates the fixed 4-slide sequence. Dead code that wastes maintenance effort and confuses the architecture.

### BIZ-05: Post scheduling has no time-of-day optimization (MEDIUM)
- **Detail:** Random 3-5 hour intervals with no awareness of audience timezone, peak engagement hours, or day-of-week patterns. Posts at 3 AM get minimal engagement.

### BIZ-06: No content quality scoring or engagement feedback loop (MEDIUM)
- **Detail:** System publishes whatever AI generates with no quality gate. No tracking of which content types perform well. No A/B testing. No engagement-based learning.

### BIZ-07: Single GNews category limits content diversity (LOW)
- **Detail:** Default category is `technology`. System only queries one category per run. No rotation through niches, no trending topic detection.

### BIZ-08: Caption/hashtag strategy not validated (LOW)
- **Detail:** AI generates captions but no validation that hashtags are relevant, not banned, properly formatted, or within Instagram's 30-hashtag limit.

---

## 11. Summary Matrix

| ID | Severity | Category | Issue |
|----|----------|----------|-------|
| SEC-01 | CRITICAL | Security | Instagram session in Git |
| RSS-01 | CRITICAL | Security | XXE attack vector in RSS parser |
| RSS-02 | CRITICAL | Reliability | Global timeout returns empty instead of error |
| AI-01 | CRITICAL | Security | Prompt injection via article data |
| TPL-01 | CRITICAL | UI | Text overflow in ALL templates |
| SEC-03 | HIGH | Security | API key in URL params |
| AI-02 | HIGH | Security | Prompt injection via account profile |
| RSS-03 | HIGH | Performance | O(n²) dedup on unbounded articles |
| RSS-04 | HIGH | Reliability | Uncaught JSON.parse on Redis cache |
| RSS-05 | HIGH | Logic | Stale cache served indefinitely |
| RSS-06 | HIGH | Config | Default timeouts guarantee global timeout |
| RSS-07 | HIGH | Logic | Niche matching case-sensitivity bypass |
| RSS-08 | HIGH | Data | Telemetry tables grow unbounded |
| SRV-01 | HIGH | Infra | tsx in production Docker |
| SRV-02 | HIGH | Infra | Bundle failure doesn't block startup |
| PIPE-01 | HIGH | Concurrency | Lock-loss detected after pipeline completes |
| PIPE-02 | HIGH | Concurrency | Heartbeat renewal too infrequent |
| IG-01 | HIGH | Automation | Race condition in success detection |
| IG-02 | HIGH | Automation | No caption length validation |
| TPL-02 | HIGH | Rendering | ContentListicle crashes on missing items |
| TPL-03 | HIGH | Rendering | ContentVideo no error fallback |
| AI-06 | HIGH | Pipeline | contentGenerator zero error handling |
| BIZ-01 | HIGH | Business | Image filter too aggressive |
| TEST-01 | HIGH | Quality | Pipeline tests are over-mocked |
| TEST-02 | HIGH | Quality | No happy-path test coverage |
| SEC-02 | HIGH | Security | .gitignore missing critical files |
| SEC-04 | MEDIUM | Security | Timing-unsafe secret comparison |
| SEC-05 | MEDIUM | Security | Browser security disabled in renderer |
| SEC-06 | MEDIUM | Security | Unfiltered sensitive data in logs |
| SRV-03 | MEDIUM | Config | ACCOUNT_ID env var mismatch |
| SRV-04 | MEDIUM | Config | parseInt without validation |
| SRV-05 | MEDIUM | Concurrency | Scheduler interval overlap |
| SRV-06 | MEDIUM | Infra | Redis never disconnected |
| SRV-08 | MEDIUM | Infra | Failed Redis cached forever |
| PIPE-03 | MEDIUM | Concurrency | Silent Redis errors in heartbeat |
| PIPE-04 | MEDIUM | Data | postHistory uses mutable cwd |
| PIPE-05 | MEDIUM | Data | Corrupted history silently wiped |
| NEWS-01 | MEDIUM | Logic | Dedup doesn't normalize URLs |
| NEWS-02 | MEDIUM | Logic | Retry-After only handles numbers |
| NEWS-03 | MEDIUM | Logic | Cached data not schema-validated |
| NEWS-04 | MEDIUM | Business | Image filter discards too many articles |
| NEWS-05 | MEDIUM | Business | Anti-repetition penalty ineffective |
| AI-03 | MEDIUM | Security | Unescaped imageUrl in prompt JSON |
| AI-04 | MEDIUM | Reliability | No timeout on Gemini API |
| AI-05 | MEDIUM | Reliability | Log dir not ensured before write |
| AI-07 | MEDIUM | Validation | Niche/effects never validated |
| TPL-04 | MEDIUM | UI | Error slides render on Instagram |
| TPL-05 | MEDIUM | Rendering | Fixed 720-frame duration |
| TPL-06 | MEDIUM | Performance | Effects cause slow renders |
| IG-03 | MEDIUM | Automation | Share button polling no final error |
| IG-04 | MEDIUM | Automation | Reel modal one-shot detection |
| IG-05 | MEDIUM | Automation | Session validation is optional |
| IG-06 | MEDIUM | Automation | No login-state check after load |
| RSS-09 | MEDIUM | Concurrency | Race condition in failure counter |
| RSS-10 | MEDIUM | Reliability | Invalid date in cooldown check |
| RSS-11 | MEDIUM | Data | ON CONFLICT overwrites run telemetry |
| RSS-12 | MEDIUM | Logic | Regex strips non-ASCII in dedup |
| RSS-13 | MEDIUM | Logic | Jaccard returns 1 for empty sets |
| RSS-14 | MEDIUM | Security | HTML injection in normalized content |
| RSS-15 | MEDIUM | Resources | Pool connection leak in CLI mode |
| RSS-16 | MEDIUM | Logic | rssFetchFailed flag unused in conditions |
| RSS-17 | MEDIUM | Null Safety | selectBestArticle null dereference risk |
| INT-02 | MEDIUM | Integration | ClickUp no 429 retry |
| BIZ-02 | MEDIUM | Business | Anti-repetition non-functional |
| BIZ-03 | MEDIUM | Business | Fixed slide sequence, no variety |
| BIZ-04 | MEDIUM | Business | CONTENT_VIDEO dead code |
| BIZ-05 | MEDIUM | Business | No time-of-day scheduling |
| BIZ-06 | MEDIUM | Business | No content quality feedback loop |
| TEST-03-10 | MEDIUM | Quality | 8 test coverage/isolation issues |

**Totals: 5 CRITICAL, 25 HIGH, 45+ MEDIUM**

---

## Immediate Action Items (Priority Order)

1. **NOW:** Change Instagram password → invalidates SEC-01
2. **NOW:** Add `storage.json` and `post-history.json` to `.gitignore` → SEC-02
3. **NOW:** Run `git filter-repo` to purge session from history → SEC-01
4. **This week:** Harden RSS parser against XXE → RSS-01
5. **This week:** Fix global timeout to return error state, not empty array → RSS-02
6. **This week:** Increase GLOBAL_FETCH_TIMEOUT_MS or reduce source count → RSS-06
7. **This week:** Add text overflow protection to all templates → TPL-01
8. **This week:** Sanitize article/profile data before AI prompt injection → AI-01, AI-02
9. **This week:** Add try-catch around JSON.parse in RSS cache → RSS-04
10. **This week:** Fix niche matching case sensitivity in registry → RSS-07
11. **This week:** Add Dockerfile build step (compile TS → JS) → SRV-01
12. **This week:** Fix lock-loss detection to be pre-emptive, not post-hoc → PIPE-01
13. **This week:** Add caption length validation → IG-02
14. **Next sprint:** Add retention/cleanup for telemetry tables → RSS-08
15. **Next sprint:** Replace O(n²) dedup with hash-based approach → RSS-03
16. **Next sprint:** Write happy-path integration test for pipeline → TEST-02
17. **Next sprint:** Add RSS-specific test coverage for exception paths → TEST gaps
