# Lessons learned (AI and contributors)

**Purpose:** Short, dated entries when something was misunderstood, broken, or corrected. Append new items at the **top** so the latest lessons are easy to find.

## How to use

- One paragraph per lesson; link to files or `context/*.md` sections when useful.
- Prefer **specific** notes (symptom → cause → fix) over generic advice.
- Agents: after a mistake is caught, add a line here **in the same session** when feasible.

---

### Template

```text
## YYYY-MM-DD — Short title

Context: …
Mistake: …
Correction: …
```

---

## Entries

### 2026-04-13 — MP4 templates must be readable at frame 0 for Instagram grid previews

Context: Published MP4 carousel posts appeared as black tiles on profile grid despite valid renders.
Mistake: Several templates animated from fully transparent foreground over near-black backgrounds, making frame 0 effectively blank.
Correction: Updated all active templates to use non-zero baseline foreground visibility and non-flat dark backgrounds at frame 0; documented the rule in `context/remotion.md`, `context/templates.md`, and `.github/instructions/remotion-templates.instructions.md`.

### 2026-04-13 — CONTENT_GENERIC limits must track real layout capacity, not theoretical text allowance

Context: A published carousel rendered with visibly cut-off words on middle slides using `CONTENT_GENERIC`, even though payloads were still schema-valid.
Mistake: Allowing `body <= 260` and `highlight <= 110` exceeded practical fit for the typography/spacing in `src/templates/ContentGeneric.tsx`, so copy could clip in production visuals.
Correction: Reduced `CONTENT_GENERIC` limits to `body <= 220` and `highlight <= 90` in both AI normalization/validation and render validation (`src/pipeline/aiService.ts`, `src/render/renderService.ts`) and added explicit overflow-safe line clamping in the template.

### 2026-04-13 — Normalize overlength AI fields before strict slide validation

Context: Production scheduler runs started failing when Gemini occasionally returned valid template IDs but text values slightly above per-field limits (for example `CONTENT_STAT_SNAPSHOT.context > 120`).
Mistake: Treating small length overshoots as hard-fail validation errors caused avoidable pipeline failures even when payload structure and factual content were otherwise usable.
Correction: Added `normalizeGeneratedPayloadForValidation()` in `src/pipeline/aiService.ts` to trim/clean per-template text fields, cap caption lines/length, and normalize hashtag lists before running existing strict validation.

### 2026-04-13 — Internal render calls should stay in-process, not loop through localhost HTTP

Context: Production scheduler runs could render all slides but still fail the pipeline with `TypeError: fetch failed` when `pipelineRun.ts` posted to `http://localhost:3000/api/render` and waited on a long-running HTTP response.
Mistake: Treating in-process rendering as a network call introduced transport-level timeout/connection failure risk inside the same service, causing false pipeline failures before publish.
Correction: Moved pipeline rendering to shared in-process logic in `src/render/renderService.ts` and made both `server.ts` (`POST /api/render`) and `src/pipelineRun.ts` use that shared service so internal runs no longer depend on loopback HTTP.

### 2026-04-13 — Random template sequencing should be steerable by content intent

Context: After adding more middle-slide templates, fully random sequence selection made narrative pacing inconsistent between runs.
Mistake: Treating all valid template plans as equally suitable regardless of post goal creates unnecessary variability in storytelling quality.
Correction: Added `CONTENT_INTENT`-aware sequence pools in `src/pipeline/aiService.ts` (`balanced`, `educate`, `debate`, `newsflash`, `visual_proof`) and covered normalization + intent-specific selection behavior in `__tests__/aiTemplateSequence.test.ts`.

### 2026-04-13 — Carousel quality improves when template roles are explicit and validated in both AI + API paths

Context: Template/content audit showed that prompt-only instructions were not enough to prevent generic middle slides or weak CTA copy.
Mistake: Keeping middle-slide intent implicit (and only loosely validated) allowed structurally valid but low-retention output to pass into rendering.
Correction: Added role-based middle templates (`CONTENT_STAT_SNAPSHOT`, `CONTENT_MYTH_VS_FACT`), expanded sequence plans, and enforced per-template text limits plus CTA question validation in both `src/pipeline/aiService.ts` and `server.ts` so generation and render validation stay aligned.

### 2026-04-13 — Hosted session bootstrap must normalize UTF-16LE secrets before writing storage.json

Context: Railway production scheduler runs started failing with `Unexpected token` JSON parse errors from `storage.json`, followed by Postgres `invalid byte sequence for encoding "UTF8": 0x00` errors during failure-state persistence.
Mistake: Decoding `INSTAGRAM_SESSION_B64` straight to raw bytes assumed the secret always contained UTF-8 JSON, but the production value was UTF-16LE-style JSON with embedded NUL bytes.
Correction: Updated `bootstrapInstagramSession()` in `server.ts` to validate and normalize the base64 payload as JSON, accepting UTF-8 or UTF-16LE input, stripping NULs, and always writing UTF-8 JSON to `storage.json`. Kept `scheduleState` string sanitization as a defensive guard and added regression coverage in `__tests__/server.test.ts`.

### 2026-04-12 — AI output should pass a lightweight quality gate before render and publish, not just schema validation

Context: Audit task BIZ-06 reviewed why the pipeline would publish any structurally valid Gemini output regardless of engagement-readiness or obvious weakness.
Mistake: Treating schema-valid output as automatically publishable lets empty/weak slide data, very short captions, or poor hashtag sets flow straight into render and Instagram posting.
Correction: Added a small pre-publish content quality score in `src/pipeline/contentGenerator.ts` covering slide population, template variety, caption shape, and hashtag validity; `runPipeline()` now goes through that wrapper so low-quality AI output fails before rendering or publishing, with focused content-generator and pipeline tests.

### 2026-04-12 — Template registries should stay aligned with AI sequence generation, not leave render-only slide types orphaned

Context: Audit task BIZ-04 reviewed why `CONTENT_VIDEO` existed in render/template registries but never appeared in AI-generated carousel plans.
Mistake: Keeping a slide type renderable but unreachable from the generation pipeline turns it into maintenance-only dead code and drifts prompt examples away from the real template surface area.
Correction: Added `CONTENT_VIDEO`-inclusive AI template plans, taught prompt examples to emit the correct video slide shape, extended validation for `CONTENT_VIDEO` data, and added sequence tests proving the planner can now select video-inclusive manifests.

### 2026-04-12 — Shared connection singletons must clear cached failures so later calls can recover

Context: Audit task SRV-08 reviewed the shared Redis helper used by caches, scheduler locking, and RSS telemetry state.
Mistake: Caching a rejected `connect()` promise permanently poisons all future callers because the singleton keeps returning the same failure with no retry path.
Correction: Updated `src/utils/redisClient.ts` to clear the cached promise on connect failure before rethrowing, and added a direct unit test proving a second call can create a fresh client and recover.

### 2026-04-12 — Selection helpers should clamp boundary randomness and callers should keep explicit null guards

Context: Audit task RSS-17 reviewed article selection null-safety around `selectBestArticle()` and `runPipeline()`.
Mistake: Even when the pipeline guards against a null selected article, a selection helper that can produce an out-of-range index from injected randomness leaves an avoidable undefined/dereference edge case in the selection layer itself.
Correction: Clamped the diverse-strategy index to a valid top-N range, kept the pipeline's explicit null guard as the caller-side safety net, and added tests for both the random boundary case and the null-selection pipeline error path.

### 2026-04-12 — RSS title dedup normalization must preserve Unicode letters and numbers

Context: Audit task RSS-12 reviewed cross-source title dedup behavior for non-English headlines.
Mistake: Regexes built around `[a-z0-9]` strip accented and non-Latin characters before tokenization, which distorts title fingerprints and dedup similarity for international content.
Correction: Switched RSS title normalization to Unicode-aware character classes with `NFKC` normalization, reused that normalized form for token sets, and added regression coverage for accented Turkish titles and distinct Unicode titles that should not dedup.

### 2026-04-12 — Persisted history corruption should hard-stop writes, not fall back to empty state

Context: Audit task PIPE-05 reviewed how `src/pipeline/postHistory.ts` behaves when `post-history.json` contains invalid JSON.
Mistake: Treating parse failures as an empty history lets the next `recordPost()` call overwrite the corrupted file and permanently erase recoverable history.
Correction: Changed history loading to surface corruption state explicitly, made `recordPost()` refuse destructive writes while logging an actionable error, and added a temp-file regression test that preserves the corrupted file contents.

### 2026-04-12 — Debug file writes should ensure parent directory existence first

Context: Audit task AI-05 reviewed parse-failure logging in Gemini response handling.
Mistake: Writing debug output directly to a relative logs path can fail when the directory is absent, masking the original parse error.
Correction: Added parent-directory creation helper and call before `writeFileSync`, with focused unit coverage for recursive directory creation.

### 2026-04-12 — Account profile env parsing should enforce non-empty niches and filter unknown effects

Context: Audit task AI-07 reviewed startup config validation for branding niche/effects values.
Mistake: Passing split/trimmed env arrays through without validation allowed empty niche sets and unsupported effect tokens to silently degrade behavior.
Correction: Added strict niche validation (must contain at least one non-empty value), filtered effects against allowed tokens, and logged warnings for ignored effect values.

### 2026-04-12 — Composition duration should be configurable, not fixed in code

Context: Audit task TPL-05 reviewed fixed 720-frame registration in Remotion root.
Mistake: Hardcoding duration can silently truncate longer visual narratives and makes environment-specific tuning harder.
Correction: Switched composition duration to `COMPOSITION_DURATION_SECONDS * 30` with safe default/fallback behavior, and documented the env variable in project context.

### 2026-04-12 — Frame-invariant overlay styles should be hoisted out of render functions

Context: Audit task TPL-06 reviewed rendering overhead in `EffectsOverlay` during Remotion encoding.
Mistake: Recreating large inline style objects for static overlays on each render frame adds avoidable allocation/reconciliation overhead.
Correction: Hoisted CRT/noise/vignette/chromatic/halftone style objects to module-level constants so frame rendering reuses stable objects with no visual behavior changes.

### 2026-04-12 — One-shot modal checks are fragile in Instagram SPA transitions

Context: Audit task IG-04 reviewed Reels informational modal timing during upload/edit transitions.
Mistake: Checking modal visibility only once can miss delayed modal appearance and let overlays block subsequent button clicks.
Correction: Replaced one-shot check with short polling-based modal dismissal and re-checks before critical `Next` transitions to absorb delayed render timing.

### 2026-04-12 — Session validation must hard-gate publish flow before browser launch

Context: Audit task IG-05 reviewed why expired Instagram sessions still progressed into Playwright automation.
Mistake: Validating session expiry without enforcing the result leads to late-stage DOM failures that hide the real root cause.
Correction: Added an explicit pre-publish session guard that throws on invalid session state before browser launch, with actionable re-auth context and configurable minimum remaining session time via env.

### 2026-04-12 — Instagram publish automation should verify authenticated UI state immediately after landing

Context: Audit task IG-06 reviewed failure modes where expired sessions surfaced later as generic selector errors.
Mistake: Relying on URL checks alone after `instagram.com` load can miss unauthenticated states in SPA flows and delay root-cause detection.
Correction: Added explicit post-load auth signal checks (login-form presence vs feed/create UI), capture screenshot on auth failure, and throw a clear re-authentication error pointing to `scripts/saveSession.ts`.

### 2026-04-12 — Repetition penalties should target same-topic recurrence, not total posting volume

Context: Audit task BIZ-02 reviewed why repeated topics could still win article selection.
Mistake: Applying a small penalty based only on total recent post count does not reliably suppress repeated-topic candidates and can behave like a no-op.
Correction: Switched anti-repetition scoring to use same-topic recent post counts (keyword overlap against recent post titles) with configurable controls (`REPETITION_WINDOW_DAYS`, `REPETITION_THRESHOLD`, `REPETITION_PENALTY`), and added ranking regression coverage.

### 2026-04-12 — Carousel variety should be controlled by explicit sequence plans, not unconstrained AI ordering

Context: Audit task BIZ-03 found repetitive fixed carousel structure and poor format diversity.
Mistake: Forcing a single hardcoded template sequence on every post causes repetitive output, while fully unconstrained ordering risks invalid slide contracts.
Correction: Added env-bounded sequence selection (`MIN_SLIDES`, `MAX_SLIDES`, 3-5 range) using predefined valid plans with `HOOK_A` always first and `CTA_FINAL` always last; middle slides vary between `CONTENT_LISTICLE` and `CONTENT_GENERIC`. Validation now enforces the request-specific chosen sequence.

### 2026-04-12 — Random scheduler jitter should still respect a timezone-aware posting window

Context: Audit task BIZ-05 reviewed schedule timing quality for audience reach optimization.
Mistake: Jittered delay scheduling had no time-of-day guard, allowing runs during low-engagement hours.
Correction: Added posting-window checks in `runScheduledPipeline` using `POSTING_TIMEZONE`, `POSTING_HOURS_START`, and `POSTING_HOURS_END`; scheduler now skips outside the window with explicit reason logging. Added coverage in `__tests__/schedulerRunner.test.ts` and documented vars in `.env.example` and `context/development.md`.

### 2026-04-12 — Integration clients should treat 429 as retryable and honor Retry-After

Context: Audit task INT-02 reviewed ClickUp API retry behavior in `src/automation/clickupClient.ts`.
Mistake: Retry loops only handled `>=500`, so rate-limit (`429`) responses failed immediately during burst operations.
Correction: Added `429` retry handling to ClickUp comment/status operations, propagated `Retry-After` from failed responses, used header-based delay when available, and defaulted to 60s when absent. Added dedicated unit tests for header delay, default delay, and exhausted retry failure.

### 2026-04-12 — Retry policy tests should validate delay timing, not only retry counts

Context: Audit task TEST-03 reviewed `executeWithRetry` test coverage around retry backoff behavior.
Mistake: Existing tests asserted retry attempts but did not prove that `retryDelayMs` actually delayed the subsequent retry call.
Correction: Added a fake-timer test that confirms no second attempt occurs before the configured delay and that retry proceeds immediately after delay expiration.

### 2026-04-12 — Retry policy tests must assert exhausted-retry failure behavior explicitly

Context: Audit task TEST-04 reviewed `__tests__/retryPolicy.test.ts` coverage for terminal retry outcomes.
Mistake: Tests covered immediate success, single retry success, and non-retryable fast-fail, but did not assert behavior when retryable errors persist until retries are exhausted.
Correction: Added a dedicated test that forces persistent retryable failure, verifies final throw message, and asserts exact attempt counts (`initial + maxRetries`) and `onRetry` invocation count.

### 2026-04-12 — Cache-enabled modules need explicit hit/miss/fallback tests, not just no-cache behavior

Context: Audit task TEST-06 reviewed GNews Redis cache coverage in `__tests__/newsService.test.ts`.
Mistake: Existing tests mocked Redis as permanently unavailable, so cache-hit and cache-write behavior could regress without test failures.
Correction: Added focused tests for Redis cache hit (no fetch call), cache miss (live fetch + set), and Redis read failure fallback (live fetch path), with `REDIS_URL` toggled per test.

### 2026-04-12 — Graceful shutdown should explicitly close Redis clients before process exit

Context: Audit task SRV-06 reviewed infrastructure cleanup on `SIGTERM`/`SIGINT`.
Mistake: The process shutdown path closed telemetry resources but did not explicitly close the shared Redis client connection, leaving connection cleanup to server-side timeouts.
Correction: Added `closeRedisClient()` in `src/utils/redisClient.ts` with graceful `quit()` and `disconnect()` fallback behavior, and invoked it in `server.ts` graceful shutdown before telemetry pool close and process exit.

### 2026-04-12 — Scheduler polling loops should chain with timeout scheduling to avoid async overlap

Context: Audit task SRV-05 reviewed interval-based scheduler polling.
Mistake: Using `setInterval` with async work can trigger overlapping ticks when execution time exceeds interval period.
Correction: Replaced interval polling with recursive `setTimeout` scheduling plus a running-flag/stop-flag guard, and updated stop logic to clear timeout handles safely.

### 2026-04-12 — Numeric env vars should be strictly parsed and range-validated, not leniently parsed

Context: Audit task SRV-04 reviewed server configuration parsing for `PORT` and `RENDER_CONCURRENCY`.
Mistake: Lenient integer parsing accepts malformed inputs and can silently bind to unintended ports or invalid concurrency values.
Correction: Added strict `parseEnvInt` utility with integer + range validation, applied it to server port and render concurrency, and added focused parsing tests for valid/default/non-integer/out-of-range cases.

### 2026-04-12 — Deduplication sets must use canonicalized URLs, not raw URL strings

Context: Audit task NEWS-01 reviewed article merge/dedup logic for top-headlines + search result pools.
Mistake: Raw URL string comparison misses canonical-equivalent variants (scheme, www, trailing slash, tracking params), allowing duplicate content through.
Correction: Updated `mergeAndDedupeArticles` to use `normalizeArticleUrl` for both candidate pools and added regression test for URL variant deduplication.

### 2026-04-12 — Lock heartbeat renewal failures should be observable and treated as lock-loss signals

Context: Audit task PIPE-03 reviewed distributed lock renewal behavior during scheduler runs.
Mistake: Silently swallowing heartbeat renewal exceptions hides lock-loss conditions and increases concurrent-run risk.
Correction: Added explicit error logging with lock key and error context in `runWithLockHeartbeat`, set `lockLost = true` on renewal exceptions, and clear heartbeat interval immediately to prevent futile retries.

### 2026-04-12 — Persistence file paths should be module-relative or env-configured, never cwd-dependent

Context: Audit task PIPE-04 reviewed post-history storage path behavior across different launch directories.
Mistake: Building persistence paths from `process.cwd()` can split reads/writes across unintended files when process launch directory changes.
Correction: Switched post-history default path to module-relative project path with optional `POST_HISTORY_PATH` override, and added path-resolution tests for both override and default behavior.

### 2026-04-12 — Thin AI wrapper layers should add article-context error messages before bubbling failures

Context: Audit task AI-06 reviewed `contentGenerator.ts` behavior when Gemini generation fails.
Mistake: Directly rethrowing upstream AI exceptions without article context makes pipeline failure triage slower and ambiguous.
Correction: Added try/catch context wrapping in `generateContent` with article title/URL and a null-result guard; added focused tests for throw and null-return paths.

### 2026-04-12 — Template list rendering should validate array shape, not just fallback on falsy values

Context: Audit task TPL-02 reviewed listicle rendering for malformed AI payloads.
Mistake: Using `data.items || []` does not protect against truthy non-array values and can still crash at `.map()`.
Correction: Switched to `Array.isArray(data.items)` guard in `ContentListicle.tsx` and added explicit empty-state fallback rendering so malformed payloads degrade gracefully instead of crashing render jobs.

### 2026-04-12 — Remotion rendering does not require disabling browser web security for local compositions

Context: Audit task SEC-05 reviewed Chromium options used by `renderMedia`/`renderStill` in `server.ts`.
Mistake: Enabling `disableWebSecurity` unnecessarily weakens browser isolation for renderer execution.
Correction: Removed `disableWebSecurity` from both render paths, kept container-required sandbox flags (`--no-sandbox`, `--disable-setuid-sandbox`) with explicit rationale comments, and validated server tests + compile.

### 2026-04-12 — Logger pipelines should redact sensitive keys before both console and file writes

Context: Audit task SEC-06 reviewed logging of arbitrary `data` payloads.
Mistake: Raw serialization of log payloads can persist credentials/secrets in plaintext logs.
Correction: Added recursive `redactSensitiveFields` in `src/utils/logger.ts` with depth guard and key-based masking, and applied it consistently to console `[data]` output and JSON log-file writes.

### 2026-04-12 — Secret checks on scheduler endpoints should use timing-safe comparison

Context: Audit task SEC-04 reviewed `/api/schedule/run` secret verification.
Mistake: Direct string equality on secrets can leak comparison timing characteristics.
Correction: Switched to normalized-buffer comparison with `crypto.timingSafeEqual`, preserving 401 behavior for invalid/missing secrets while reducing timing side-channel risk.

### 2026-04-12 — Instagram publish confirmation should use layered signals, not a single race

Context: Audit task IG-01 found false publish failures from strict `Promise.race` success detection in SPA transitions.
Mistake: Racing transient DOM signals can reject on normal UI transitions and incorrectly classify successful posts as failures.
Correction: Replaced race with sequential multi-signal confirmation (`Close` dialog presence, shared text variants, success checkmark, URL pattern fallback), and explicit ambiguous-failure error when confirmation cannot be established.

### 2026-04-12 — Instagram automation should sanitize captions before UI typing

Context: Audit task IG-02 identified that raw AI captions were inserted into Instagram without platform-limit checks.
Mistake: Skipping pre-validation can exceed Instagram limits (2,200 chars / 30 hashtags), causing truncation ambiguity or publish instability in UI automation.
Correction: Added `sanitizeInstagramCaption` in `instagramPublisher.ts` to cap hashtags at 30, truncate captions to 2,200 chars with ellipsis, and log warnings when modifications occur. Wired sanitized caption into `page.keyboard.insertText` and added focused unit tests.

### 2026-04-12 — Distributed lock heartbeat cadence should leave multiple renewal attempts before TTL expiry

Context: Audit task PIPE-02 reviewed lock-renewal timing in scheduler lock heartbeat.
Mistake: Renewing at `TTL/2` left too little recovery margin for delayed renewals under transient load or Redis jitter.
Correction: Changed heartbeat interval to `TTL/3` in `schedulerLock.ts` (plus doc comments), providing additional renewal opportunities before lock expiration.

### 2026-04-12 — Video templates need runtime media-failure fallback, not only missing-URL fallback

Context: Audit task TPL-03 found `CONTENT_VIDEO` only handled empty `videoUrl`, but not unreachable/invalid video media during render.
Mistake: Rendering assumed a provided `videoUrl` is always playable; when media fails, output can degrade to a black frame without explicit fallback.
Correction: Added `VideoWithFallback` in `ContentVideo.tsx` with `onError` handling to switch from `Video` to fallback `Img`, and final gradient placeholder when neither valid video nor fallback image is available.

### 2026-04-12 — Redis news cache reads must validate article schema before reuse

Context: Audit task NEWS-03 found cached GNews payloads were trusted after `JSON.parse`, allowing malformed or stale-shape entries to flow into scoring and prompts.
Mistake: Returning parsed cache data without shape checks let non-array payloads, corrupt JSON, and invalid article objects silently bypass runtime safeguards.
Correction: Added cache parsing + validation in `src/pipeline/newsService.ts` (`parseAndValidateCachedArticles`) to reject corrupt/non-array cache entries (forcing live fetch), filter invalid article objects (`title` + `url` checks), and emit warning logs when invalid cached entries are discarded.

### 2026-04-12 — Retry-After handling must support both numeric seconds and HTTP-date formats

Context: Audit task NEWS-02 identified that GNews 429 retries only parsed numeric `Retry-After` values, while RFC-compliant servers can return HTTP-date strings.
Mistake: Parsing `Retry-After` with `Number()` alone ignored valid date headers, causing fallback delays and less predictable retry timing.
Correction: Added shared `parseRetryAfterMs()` in `src/pipeline/newsService.ts` that supports numeric seconds and RFC 1123 dates, wired it into both top-headlines and search retry paths, and added regression tests in `__tests__/newsService.test.ts`.

### 2026-04-12 — Randomized selection logic should expose injectable randomness for deterministic tests

Context: Audit task TEST-10 targeted missing coverage in the `selectBestArticle` diverse strategy branch.
Mistake: Using `Math.random()` directly in branching logic made deterministic assertions difficult and left critical selection behavior under-tested.
Correction: Added optional `randomFn` parameter (defaulting to `Math.random`) in `selectBestArticle` and added tests proving diverse mode selects only from top-3, returns null for empty input, and yields deterministic picks for fixed random values.

### 2026-04-12 — Global fetch test isolation requires per-test spies, not direct global assignment

Context: Audit task TEST-07 addressed cross-test pollution risk in `__tests__/newsService.test.ts`.
Mistake: Direct `global.fetch = vi.fn()` mutation and a one-time spy can leak or stop intercepting after `vi.restoreAllMocks()`, which leads to flaky tests and accidental real network calls.
Correction: Use `vi.spyOn(global, 'fetch')` with a fresh spy created in `beforeEach`, then restore in `afterEach` via `vi.restoreAllMocks()` so each test has isolated fetch behavior.

### 2026-04-12 — Scheduler account env var names must stay aligned across code and `.env.example`

Context: Audit task SRV-03 identified mismatch between runtime code and documented scheduler account env configuration.
Mistake: `server.ts` status endpoint used `process.env.ACCOUNT_ID`, while environment contract uses `SCHEDULE_ACCOUNT_ID`, causing silent fallback to `default` and breaking intended multi-account scoping.
Correction: Replaced the remaining `ACCOUNT_ID` read with `SCHEDULE_ACCOUNT_ID` in `server.ts` and verified no other `process.env.ACCOUNT_ID` reads remain.

### 2026-04-12 — Image presence should affect ranking, not ingestion eligibility

Context: Audit task NEWS-04 found GNews top-headlines and search flows were still hard-filtering out imageless articles in `newsService.ts`.
Mistake: Rejecting items with `!imageUrl` at ingest stage over-constrained candidate pools for niche topics and could cause no-article failures before scoring.
Correction: Removed hard image filters from `fetchTopNews` and `fetchSearchNews`, added a `-5` scoring penalty in `scoreArticleRelevance` for missing images, and added regression tests to ensure imageless articles remain eligible but rank lower.

### 2026-04-12 — Session validity must be based on the earliest critical cookie expiry

Context: Audit task TEST-08 expanded session validation coverage for boundary and multi-cookie cases in Instagram auth storage.
Mistake: Validation used the maximum cookie expiry and strict `<` comparison, which could mark sessions valid when one critical cookie was already expired and could miss exact-threshold expiry cases.
Correction: Updated `validateInstagramSessionExpiry` to prioritize critical cookies (`sessionid`, `csrftoken`, `ds_user_id`), validate against the minimum expiry among those cookies, and treat boundary equality as invalid (`<=`). Added boundary and multi-cookie tests in `__tests__/sessionValidation.test.ts`.

### 2026-04-12 — Manual verification scripts must be migrated into Vitest to be CI-enforced

Context: Audit task TEST-09 required converting ad-hoc verification scripts into maintainable tests that run inside CI and local test workflows.
Mistake: Keeping `src/pipeline/testMock.ts` and `test-railway-endpoint.ts` as standalone scripts meant their checks were never executed by `vitest`, so regressions could ship without detection.
Correction: Replaced both with integration tests under `__tests__/integration/` (`mockValidation.test.ts`, `railwayEndpoint.test.ts`), made Railway test conditional via `describe.skipIf(!RAILWAY_TEST_URL || !SCHEDULER_SECRET)`, removed manual scripts, and added `test:integration` script to `package.json`.

### 2026-04-11 — RSS telemetry must be non-blocking and source-health checks must fail open

Context: Added Postgres RSS telemetry persistence and Redis source cooldown guardrails to improve RSS operational visibility and source reliability handling.
Mistake: A strict dependency on telemetry/health infrastructure would make pipeline publishing depend on Postgres/Redis availability and could block content generation during transient infra outages.
Correction: Implemented non-fatal telemetry writes (log and continue) and fail-open cooldown checks (if Redis errors, do not skip source solely due to health read failure). This preserves publishing path reliability while still capturing operational state when infrastructure is healthy.

### 2026-04-10 — RSS-first ingestion must enforce image and URL quality gates before scoring

Context: Implemented RSS as primary news source with GNews fallback in `src/pipelineRun.ts` and new RSS modules. RSS feeds often include items without usable media or canonical links, unlike the stricter GNews mapping flow.
Mistake: Treating all RSS items with title/description as valid would allow imageless slides and empty/non-URL links into dedup and post history, causing weak or broken carousel outputs.
Correction: Added strict filters in `src/pipeline/rssService.ts` requiring `title + description + imageUrl + url`, validated GUID fallback only when it is an HTTP URL, used epoch fallback for missing dates to avoid sort bias, and wrapped RSS fetch in try/catch so fallback to GNews is always preserved.

### 2026-04-09 — Railway cron is wrong for always-on servers; use internal polling

Context: The scheduler (`POST /api/schedule/run`) required an external trigger but no cron was configured on Railway, so the automation never ran automatically.
Mistake: Assumed Railway cron could hit the HTTP endpoint on a schedule. Railway cron actually **restarts the service's start command** on a schedule and expects it to exit. For an always-on Express server this would restart the entire container every poll cycle, and Railway would skip subsequent cron runs while the process is alive.
Correction: Added an internal `setInterval` polling loop in `server.ts` behind `SCHEDULER_ENABLED=true`. The loop calls `runScheduledPipeline()` directly (no HTTP hop). All existing guards (`shouldRunNow()`, distributed lock, jittered `next_run_at`) remain unchanged. Railway cron should only be used for short-lived start-run-exit services. See `context/development.md` → Scheduler environment.

### 2026-04-08 — GNews API error handling must be status-specific for robust integration

Context: GNews free plan has rate limits (429, 1 req/s) and quota exhaustion (403, 100 req/day). Generic error handling masks these and causes unnecessary retries or silent failures.
Mistake: Initial implementation threw generic errors for all GNews responses; no differentiation between retryable (429, 500, 503) and terminal errors (401, 403). This caused retries on quota exhaustion and no special handling of Retry-After headers.
Correction: Implemented status-specific error handling: retry on 429/500/503 with exponential backoff + Retry-After support, fail fast on 401/403 with clear logging. Used `isRetryableGNewsError` function to detect retryable errors. Also wrapped `fetchTopNews` and `fetchSearchNews` with `executeWithRetry` for consistency. Key decision: 401 and 403 are not retried — they indicate config issues or quota limits that require manual intervention.

### 2026-04-08 — Hardcoded API parameters must be environment-configurable for multi-plan deployments

Context: Free plan limits are different from paid plans (max articles, languages, countries). Hard-coded values make plan upgrades require code changes and complicate multi-tenant or multi-region deployments.
Mistake: `lang=en`, `country=us`, `max=10` were hardcoded in `newsService.ts`, making them impossible to customize without modifying source code.
Correction: Moved all parameters to `.env` variables with safe defaults: `GNEWS_LANG`, `GNEWS_COUNTRY`, `GNEWS_MAX_ARTICLES`, `GNEWS_URL`. Added validation and warning logs for missing values. Migration: existing deployments should set these env vars or accept defaults; backward-compatible.

### 2026-04-08 — Dual-endpoint strategy improves relevance but doubles quota cost

Context: Top-headlines endpoint returns general trending news; account niche keywords don't automatically filter at API level. Client-side scoring can miss high-quality niche articles in the initial pool.
Decision: Implemented `fetchSearchNews(query)` for niche-specific search using AND/OR/NOT operators, and `mergeAndDedupeArticles()` for combining results. Default stays top-headlines only (backward-compatible), but pipeline can optionally use both endpoints for higher relevance articles. Tradeoff: doubles quota usage (now 2 API calls per cycle) but improves article quality before AI generation.
Benefit: Search endpoint + top-headlines + deduplication provides a best-of-both-worlds pool — trending coverage + niche relevance. Useful for accounts with very specific niches (e.g., "AI startups" or "DevOps tooling"). Not recommended for free plan due to quota pressure.

### 2026-04-08 — Do not force fallback to first article when relevance filter returns zero

Context: Scheduled runs could fetch a category that doesn't match the account niche and still continue by selecting the first available article, producing off-brand posts despite strict scoring.  
Mistake: `runPipeline()` fell back to synthetic scored candidates (`score: 1`) when no article passed `MIN_RELEVANCE_SCORE`, which also made logs inconsistent with normal scoring semantics (`baseScore: 5`).  
Correction: Removed forced first-article fallback in `src/pipelineRun.ts`; pipeline now throws a clear "No relevant articles found" error and exits safely. Also hardened relevance scoring input in `src/pipeline/newsFiltering.ts` and `src/pipeline/newsService.ts` to tolerate null/empty descriptions without crashes.

### 2026-04-07 — Railway SIGTERM logs can look like npm failure without explicit shutdown hooks

Context: Deployment logs showed repeated `npm error signal SIGTERM` after long healthy uptime, which looked like an app crash at first glance.  
Mistake: We had no explicit process signal logging in `server.ts`, so orchestrator-driven stop events (deploy rotation/removal) were hard to distinguish from runtime faults.  
Correction: Added graceful shutdown hooks for `SIGTERM` and `SIGINT` in `server.ts` that log shutdown start/completion, clear cleanup timers, close the HTTP server, and force-exit only on timeout. Also analyzed removed Railway deployments to confirm many stop events were orchestrator-driven and separate from app-level errors.

### 2026-04-07 — Malformed AI payloads must be rejected before render

Context: Production logs showed mixed/garbled hashtag output and malformed slide payloads reaching `/api/render`, followed by unstable mp4 rendering behavior.  
Mistake: We relied on prompt-only JSON compliance and permissive runtime checks (`data` object existence) rather than strict contract validation. We also rendered all slides in parallel and emitted multi-line pretty logs that can interleave under load.  
Correction: Added strict runtime validation in `src/pipeline/aiService.ts` (shape, template order, required fields, non-empty strings), strict per-template `slide.data` validation in `server.ts`, switched batch slide rendering to sequential processing to reduce memory pressure, and changed logger/pipeline debug output to single-line JSON-friendly entries.

### 2026-04-06 — Scheduler endpoint must be guarded in production

Context: Added `POST /api/schedule/run` for Railway cron-driven automation.  
Mistake: Initial implementation allowed unauthenticated trigger calls when exposed publicly.  
Correction: Added optional secret guard in `server.ts` using `SCHEDULE_RUN_SECRET` and `x-scheduler-secret` header; endpoint now returns 401 for missing/invalid secret when configured. Added API tests for both unauthorized cases in `__tests__/server.test.ts`.

### 2026-04-06 — Scheduler integration requires import-safe pipeline execution

Context: Added a new `POST /api/schedule/run` endpoint that calls into pipeline logic from `server.ts`.  
Mistake: `src/pipelineRun.ts` always executed immediately on import and called `process.exit(1)` in its catch block. Importing it from scheduler code would terminate the server process on errors.  
Correction: Exported `runPipeline()` and gated CLI execution behind direct-entry detection (`import.meta.url === pathToFileURL(process.argv[1]).href`). Runtime failures now throw to callers; CLI mode still exits with status 1. Added endpoint tests for scheduler outcomes in `__tests__/server.test.ts`.

### 2026-04-04 — Over-Aggressive Niche Post Penalty & FFmpeg Encoding Optimization

Context: After changing NEWS_CATEGORY to 'business', pipeline still failed. Log showed ALL articles scored only 1 point (not 5), causing zero relevant articles to pass MIN_RELEVANCE_SCORE=10 threshold. Root cause: scoring penalty logic was too aggressive.

Problems Fixed:
1. **Over-aggressive niche penalty** — `if (recentPostCount >= 3) score -= 10`
   - With 3 recent posts, all articles penalized to score 1 (5 base - 10 penalty)
   - Solution: Increased threshold to 5+ posts, reduced penalty to -5 instead of -10
   - Result: Never drops below base score (prevents score collapse)

2. **FFmpeg x264 thread exhaustion** — Encoder still using 24 threads despite concurrency=1
   - Issue: Remotion's `concurrency` doesn't control x264's thread count
   - Solution: Added `x264Preset: 'veryfast'` to reduce encoding intensity
   - 'veryfast' preset: Uses fewer threads, lower memory (~50% reduction)

**Files Changed:**
- `src/pipeline/newsFiltering.ts`: Adjusted recentPostCount threshold (5 → 3) and penalty (-5 vs -10)
- `server.ts`: Added x264Preset='veryfast' to renderMedia() options

**Testing:** Run `npm run pipeline` — should now pass MIN_RELEVANCE_SCORE=10 threshold and render without malloc errors.

See [newsFiltering.ts penalty logic](src/pipeline/newsFiltering.ts#L128) and [server.ts x264 preset](server.ts#L168).

### 2026-04-04 — FFmpeg Memory & News Category Fix

Context: Pipeline failed with two issues: (1) FFmpeg x264 encoder malloc error during rendering, (2) all 10 articles scored only 5 points (no keyword matches found). Log analysis showed articles were gaming/consumer tech (Nintendo Switch, AirPods, 3D printers), not developer/startup content.

Root Causes & Fixes:
1. **FFmpeg Memory Error** — `x264 [error]: malloc of size 4194624 failed`
   - Cause: Rendering concurrency=2 too aggressive for x264 encoder memory usage
   - Fix: Changed default concurrency to 1 (serialize rendering for stability)
   - Tunable: Set `RENDER_CONCURRENCY=2` or 3 in .env if system has high RAM
   - See: [server.ts line 165](server.ts#L165)

2. **No Relevant Articles** — All articles scored 5 (base score only)
   - Cause: `NEWS_CATEGORY='technology'` returns gaming/consumer tech, not dev/startup
   - Fix: Changed to `NEWS_CATEGORY='business'` for entrepreneur/founder stories
   - Result: Better article quality aligned with @theinitial.dev niche
   - See: [.env section 6-7](.env)

**Verification:** Run `npm run pipeline` to test both fixes (should get startup articles and complete rendering).

### 2026-04-04 — Keyword Specificity Weighting & Scoring Refinement

Context: Enhanced logging revealed false positives in article selection. Log analysis showed "Rising Oil Prices" article (gaming hardware) selected over better candidates because generic keyword "news" matched. Root cause: keywords too broad, no minimum threshold, no weight differentiation.

Problems Fixed:
1. **Generic keywords filtered** — Removed 24 words: "tech", "news", "dev", "it", "web", "app", "data", "ai", etc.
   - These matched any article regardless of relevance
   - "news" alone was a false positive (matches everything)
   - "dev" ambiguous (developer, device, development, devops)

2. **Added keyword specificity weights:**
   - `dev-tools`: 15 points (highly specific, strong signal)
   - `startup`: 10 points (specific)
   - `development`: 8 points (specific)
   - `technology`: 6 points (generic)
   - `tech`: 3 points (too broad)
   - `news`: 2 points (matches too many articles)

3. **Implemented minimum score threshold** — `MIN_RELEVANCE_SCORE=10`
   - Only articles with ≥1 real keyword match pass (score 10+)
   - Filters out articles with only base score (5 points for having content)
   - Configurable via `.env` for tuning

4. **Enhanced logging shows exact keywords matched:**
   - Which keyword triggered match (title or description)
   - Weight of each keyword match
   - Score breakdown: `10 (keyword) + 5 (base) = 15`

**Results:**
- ✅ Generic articles now filtered (Nintendo Switch, 3D printers pass with only 5 points)
- ✅ Better article selection quality
- ✅ False positives eliminated
- ✅ Configurable strictness via MIN_RELEVANCE_SCORE

See [newsFiltering.ts](src/pipeline/newsFiltering.ts) KEYWORD_WEIGHTS map and `MIN_RELEVANCE_SCORE` config.

### 2026-04-04 — Enhanced Article Filtering Logging

Context: Option B implementation (smart filtering, deduplication, keyword scoring) was working but logs didn't show filtering decisions transparently. User couldn't see which articles were filtered, why they were filtered, or what the scoring looked like.  
Problem: Key information missing from logs:
- No keyword extraction logging
- No duplicate article filtering shown
- No article scoring comparison (just won article shown)
- No ranking visibility (why was article X selected over Y?)

Solution Implemented: Added comprehensive logging to `src/pipeline/newsFiltering.ts`:
- All filtering functions now accept optional `logger?: Logger` parameter
- New `filterResults` object tracks duplicates, low-score, and passed articles
- Logging at each decision point:
  - `[filter-duplicates]` — Each skipped duplicate article
  - `[filter-score]` — Each zero-score article filtered
  - `[filtering]` — Final summary with count and ranked articles
  - `[scoring]` — Prints top 10 scored articles
  - `[keywords]` — Logs all extracted keywords before filtering
  - `[selection]` — Logs selected article and why

Updated `src/pipelineRun.ts`:
- Added **Step 0a: Extract Keywords** with full logging
- Passes logger to all filtering functions
- Console output shows human-readable progress
- JSON logs contain full structured data for analysis

**Result:**
- ✅ Full transparency into article filtering decisions
- ✅ Debugging info for keyword extraction
- ✅ Complete scoring rankings (not just winner)
- ✅ JSON logs capture filter results, skip reasons, and scores
- ✅ Can trace exactly why each article accepted/rejected

See [ENHANCED_LOGGING.md](ENHANCED_LOGGING.md) for complete documentation and usage.

### 2026-04-04 — Full Option B Implementation: Smart Filtering + Account Awareness

Context: User identified three production issues: (1) hardcoded account handle, (2) PNG output instead of MP4, (3) repeated news articles with no relevance filtering.  
Solution Implemented: Complete refactor to add account profile system, post history tracking, and news relevance scoring.  

**New Components:**
- `src/pipeline/accountProfile.ts` — Load account identity from `.env` (handle, bio, niche, branding)
- `src/pipeline/postHistory.ts` — JSON-based post tracking to prevent duplicate articles
- `src/pipeline/newsFiltering.ts` — Score articles by keyword relevance to account niche, rank by score
- Updated `src/pipeline/config.ts` — Load all branding from `.env` instead of hardcoding
- Updated `src/pipeline/aiService.ts` — Accept account profile, pass account context to Gemini prompt
- Updated `src/pipelineRun.ts` — Use smart filtering, pass account to AI, pass format to render server
- Updated `.env` — Added account configuration

**Result:**
- ✅ Account handle configurable via `BRAND_HANDLE` env var (user set to `@theinitial.dev`)
- ✅ Render format now `mp4` (video carousel) instead of `png` (individual images)
- ✅ Post history prevents repeated articles (file: `post-history.json`)
- ✅ Article scoring by niche keywords eliminates generic selection
- ✅ AI receives account context for personality-aligned content

**Reference:** [.github/instructions/smart-filtering.instructions.md](.github/instructions/smart-filtering.instructions.md) for complete system design.

### 2026-04-04 — Chrome Process Leak (Resource Exhaustion)

Context: Rendering worked for 1-2 slides, then crashed with "Failed to launch browser process". After killing processes, `taskkill` terminated **25+ zombie Chrome instances**.  
Mistake: Remotion/Puppeteer doesn't automatically clean up browser instances between concurrent renders. With `concurrency: 2`, each batch created 2-3 processes that accumulated without cleanup.  
Root Cause: Remotion's internal browser cleanup wasn't functioning properly on Windows (likely file handle exhaustion or process pool corruption).  
Correction: Added explicit cleanup functions to `server.ts`:  
- `cleanupChromeProcesses()`: Runs after each render batch to force-kill remaining Chrome processes  
- `warnIfTooManyChromeProcesses()`: Detects runaway Chrome and warns user  
- Added `cleanupChromeProcessesWithRetries()` to retry post-render cleanup up to 3 times if Chrome processes are still detected  
- Post-render cleanup + retry logic runs in both synchronous and webhook render paths (success or failure)  
- Periodic safety cleanup interval tuned to 1 hour (`setInterval(..., 3_600_000)`) to reduce overhead while retaining protection  
Reference: See [server.ts](server.ts) for updated cleanup implementation.  
**Fix Status: ✅ APPLIED** — Next pipeline run should complete all 4 slides without process accumulation.

### 2026-04-04 — Rendering Timeout: Dev Server Not Running

Context: AI generation now works perfectly (populated data for all slides), but rendering fails with "timeout 33000ms exceeded".  
Symptom: Remotion waits 33 seconds then times out during `renderStill()` or `renderMedia()`.  
Cause: The pipeline sends render requests to `http://localhost:3000/api/render`, but the dev server (`npm run dev`) isn't running.  
Solution:
  - **MUST run two terminals:**
    1. Terminal 1: `npm run dev` (starts Express server on port 3000)
    2. Terminal 2: `npm run pipeline` (sends render requests to the server)
  - The server bundles Remotion and renders slides via Chrome/Puppeteer
  - If the server isn't running, all render requests timeout
  
Reference: `server.ts` (Express app listening on 3000), `.github/copilot-instructions.md` (Quick Commands)

### 2026-04-04 — Gemini API Quota Exceeded (429 Rate Limit) [RESOLVED]

Context: After fixing the empty data issue, pipeline failed with quota errors during test runs.  
Symptom: `[429 Too Many Requests] You exceeded your current quota` from Google Generative AI API.  
Cause: Gemini API has limited quota on free tier. Multiple pipeline test runs exhausted the daily quota limit.  
Solution:
  - Quota resets daily for free tier
  - Monitor usage at: https://ai.dev/rate-limit
  - Use `src/pipeline/testMock.ts` mock data for development to avoid hitting API limits
  - `newsService.ts` already handles API failures gracefully: returns empty array → falls back to mock data
  
Reference: `.env` (GEMINI_API_KEY), `src/pipeline/testMock.ts` (mock data), `src/pipeline/newsService.ts` (fallback logic)

### 2026-04-04 — Gemini returns empty slide data (RESOLVED)

Context: AI-generated carousel slides were rendering blank (especially Slide 2 "Details") even though 4 slides were created.  
Symptom: Logs showed `manifest.carousel[].data = {}` (empty objects) for all slides, AND `caption` and `hashtags` were empty strings.  
Cause: The JSON schema constraint was too permissive - it defined `data: { type: SchemaType.OBJECT }` without specifying required properties inside. Gemini satisfied the schema by returning empty objects. Also, the prompt wasn't explicit enough about JSON-only response format.  
Fix: 
  1. **Removed responseSchema** from Gemini config - relied on prompt alone instead
  2. **Enhanced prompt** with concrete JSON template showing exactly where content should go
  3. **Added markdown extraction** in error handling (sometimes Gemini returns ```json...```)
  4. **Better error logging** to capture raw Gemini response if failures occur
  5. **Added fallback validation** to detect and warn about empty slides
  
  Reference: `src/pipeline/aiService.ts` (lines 45-170, prompt redesign + schema removal + error handling)

### 2026-03-28 — Context pack initial creation

Context: New `context/` modular docs for agent use.  
Mistake: (N/A — bootstrap)  
Correction: Keep [templates.md](./templates.md) as the single source of truth for `data` field names; automation prompts may use **`footer`** while `ContentListicle` reads **`footnote`** — align prompts or map fields in the automation layer.

### 2026-03-28 — `package.json` Remotion Studio entry extension

Context: `preview` script pointed at `src/remotion/index.ts`.  
Mistake: The Remotion root file is `index.tsx`; a wrong extension breaks `npm run preview`.  
Correction: `package.json` `preview` script updated to `src/remotion/index.tsx`.

### 2026-04-12 - Gemini call timeout guard for hung upstream requests [RESOLVED]

Context: AI generation could hang indefinitely when Gemini requests stalled, leaving pipeline runs blocked until external lock expiry.
Symptom: `generatePostContentAI()` awaited `model.generateContent(prompt)` without a bounded wait.
Cause: No request timeout boundary existed for the Gemini call path.
Fix:
   1. Added `GEMINI_TIMEOUT_MS` configuration (default `60000`, minimum `1`).
   2. Wrapped Gemini generation in a `withTimeout(...)` Promise race with descriptive timeout errors.
   3. Added unit coverage for timeout parsing and timeout rejection behavior.

Reference: `src/pipeline/aiService.ts` (`resolveGeminiTimeoutMs`, `withTimeout`, `generatePostContentAI`), `__tests__/aiServiceTimeout.test.ts`, `.env.example`.

### 2026-04-12 - Fallback flags must influence control flow, not just log labels [RESOLVED]

Context: RSS-first pipeline already tracked `rssFetchFailed`, but top-headlines fallback execution depended only on `scoredArticles.length === 0`.
Symptom: Failure flags were reflected in logs yet not explicitly encoded in fallback condition.
Cause: `rssFetchFailed` was only used in message text, creating implicit behavior coupling to empty article arrays.
Fix:
   1. Updated top-headlines fallback condition to `useRssFeeds && (rssFetchFailed || scoredArticles.length === 0)`.
   2. Added explicit comment documenting fallback intent for throw and no-relevance paths.

Reference: `src/pipelineRun.ts` (Step 0c fallback condition), `__tests__/pipelineRun.test.ts`.

### 2026-04-12 - CLI and server resource lifecycles must be handled separately [RESOLVED]

Context: RSS telemetry pool was only closed via server shutdown handlers, leaving CLI pipeline executions without deterministic pool teardown.
Symptom: One-off pipeline runs could keep Node alive due to open Postgres pool resources.
Cause: `runPipeline()` lacked a non-server cleanup path for telemetry resources.
Fix:
   1. Added `runPipeline()` finally cleanup for `closeTelemetryPool()` when `SERVER_MODE !== 'true'`.
   2. Set `process.env.SERVER_MODE = 'true'` in `server.ts` so long-lived server/scheduler paths retain server-managed lifecycle.
   3. Added cleanup warning logging to avoid masking primary pipeline failures.

Reference: `src/pipelineRun.ts`, `server.ts`, `context/development.md`.

### 2026-04-12 - Sanitization must handle encoded tags and entity decoding in RSS text [RESOLVED]

Context: RSS descriptions can contain direct HTML, encoded tags (for example `&#x3C;script&#x3E;`), and entity-encoded plain text.
Symptom: Regex-based stripping left bypass gaps and inconsistent decoded output in normalized article text.
Cause: Custom `stripHtml` logic was not a robust sanitizer and did not safely normalize encoded-tag cases.
Fix:
   1. Replaced custom strip logic with `sanitize-html` using no allowed tags/attributes.
   2. Added explicit HTML entity decode before sanitize (to neutralize encoded-tag payloads) and after sanitize (to produce readable text).
   3. Added regression test for script stripping + escaped entity decoding path.

Reference: `src/pipeline/rssService.ts`, `__tests__/rssService.test.ts`, `package.json`.

### 2026-04-12 - Empty token sets should not imply semantic duplicate titles [RESOLVED]

Context: Cross-source dedup uses Jaccard similarity on tokenized article titles.
Symptom: Two titles reduced to empty token sets were treated as perfect matches and one article was dropped.
Cause: Similarity logic returned `1` for empty-vs-empty sets.
Fix:
   1. Updated Jaccard helper to return `0` when both sets are empty.
   2. Added explicit `one empty set => 0` guard for clarity.
   3. Added unit tests for empty-empty and empty-nonempty cases.

Reference: `src/pipeline/rssService.ts`, `__tests__/rssService.test.ts`.

### 2026-04-12 - Telemetry conflict policy should preserve first-write evidence [RESOLVED]

Context: RSS run telemetry records are used for debugging retries and failure progression.
Symptom: Re-insert on the same `run_id` could silently replace prior metrics, erasing first-attempt evidence.
Cause: `ON CONFLICT (run_id) DO UPDATE` mutated existing rows.
Fix:
   1. Switched conflict handling to `ON CONFLICT (run_id) DO NOTHING` for run telemetry inserts.
   2. Kept unique run IDs in RSS workflow (`rss-{timestamp}-{random}`), so natural collisions remain unlikely while preserving idempotent safety.

Reference: `src/pipeline/rssTelemetryStore.ts`, `src/pipeline/rssService.ts`.

### 2026-04-12 - Prompt context should sanitize untrusted article fields before interpolation [RESOLVED]

Context: News article metadata comes from external RSS/GNews sources and is untrusted input.
Symptom: Raw article fields could be embedded directly into prompt text, increasing prompt-structure manipulation risk.
Cause: Prompt interpolation previously accepted unsanitized `title`, `source`, and `description` values.
Fix:
   1. Added `sanitizeForPrompt(...)` helper in `aiService.ts` to strip control chars, normalize whitespace, replace backticks, escape backslashes, and enforce max length.
   2. Applied sanitization to article `title`, `source`, and `description` prompt fields.
   3. Added dedicated unit tests for prompt sanitization behavior.

Reference: `src/pipeline/aiService.ts`, `__tests__/aiServicePromptSanitization.test.ts`.

### 2026-04-12 - Configuration-derived prompt fields also need sanitization [RESOLVED]

Context: Account profile fields are environment-derived but still untrusted from a prompt-safety perspective.
Symptom: Handle/displayName/bio/niche values could be interpolated raw into Gemini prompt text.
Cause: Prompt hardening focused initially on article payload fields only.
Fix:
   1. Applied `sanitizeForPrompt(...)` to account `handle`, `displayName`, `bio`, and joined `niche` string before prompt injection.
   2. Reused sanitized values in both account block and relevance-note block.

Reference: `src/pipeline/aiService.ts`.

### 2026-04-12 - Distributed lock loss must abort before publish boundary [RESOLVED]

Context: Scheduler lock heartbeat previously detected lock loss but only raised after pipeline completion.
Symptom: A run could proceed through Instagram publish even after lock ownership was lost mid-execution.
Cause: Lock-loss state was checked after awaited work instead of being propagated during execution.
Fix:
   1. Updated `runWithLockHeartbeat(...)` to pass an `AbortSignal` to the protected function.
   2. Heartbeat now aborts the signal when lock renewal fails or ownership is lost.
   3. `runPipeline(...)` now accepts optional signal and abort-checks right before `publishToInstagram(...)`.
   4. Added scheduler lock unit tests covering abort-on-loss and success path.

Reference: `src/pipeline/schedulerLock.ts`, `src/pipeline/schedulerRunner.ts`, `src/pipelineRun.ts`, `__tests__/schedulerLock.test.ts`.

### 2026-04-12 - Global RSS timeout should fail loudly, not masquerade as empty data [RESOLVED]

Context: Parallel RSS fetches can exceed the global timeout budget even when feeds would otherwise return articles later.
Symptom: Timeout path returned an empty settled-results array, making the caller treat timeout as "no articles" instead of fetch failure.
Cause: Global timeout branch resolved `[]` instead of rejecting with an explicit timeout error.
Fix:
   1. Added `RssGlobalTimeoutError` in `rssService.ts`.
   2. Changed the global timeout race branch to reject with the typed error.
   3. Updated timeout test to assert explicit failure instead of silent empty fallback.

Reference: `src/pipeline/rssService.ts`, `__tests__/rssService.test.ts`.

### 2026-04-12 - Cross-source dedup should use cheap fingerprints, not quadratic title-set scans [RESOLVED]

Context: RSS aggregation can grow across multiple sources and retries, making pairwise near-duplicate checks expensive.
Symptom: Cross-source title dedup previously compared each article against all previously seen title word-sets.
Cause: Dedup used an O(n^2) Jaccard scan over an unbounded seen-title array.
Fix:
   1. Kept URL dedup as the first linear pass.
   2. Replaced title-set pairwise comparison with a normalized title fingerprint set.
   3. Preserved correctness for empty/short titles by skipping fingerprint dedup when no meaningful fingerprint exists.

Reference: `src/pipeline/rssService.ts`, `__tests__/rssService.test.ts`.

### 2026-04-12 - Timeout configuration must be resolved at runtime, not frozen at import [RESOLVED]

Context: RSS timeout budgets are environment-driven operational controls and are frequently overridden in tests and deployments.
Symptom: Import-time constants froze timeout values before env overrides could take effect.
Cause: RSS timeout defaults were read once during module initialization.
Fix:
   1. Added runtime timeout resolvers for per-source and global RSS budgets.
   2. Switched parser creation to use current runtime timeout values.
   3. Raised default global RSS budget to 75s and documented both preferred and legacy env names.

Reference: `src/pipeline/rssService.ts`, `.env.example`, `context/development.md`.

### 2026-04-12 - Case-insensitive matching should normalize both lookup and source values [RESOLVED]

Context: Registry-driven niche filtering is intended to be case-insensitive.
Symptom: Caller inputs were normalized to lowercase, but source niche values were compared as stored.
Cause: Matching logic normalized only one side of the comparison.
Fix:
   1. Lowercased `source.niches` values during comparison in `getSourcesForNiche(...)`.
   2. Added explicit uppercase input coverage in registry tests.

Reference: `src/pipeline/rssSourceRegistry.ts`, `__tests__/rssSourceRegistry.test.ts`.

### 2026-04-12 - Durable telemetry needs retention and prune-friendly indexes [RESOLVED]

Context: RSS telemetry is durable Postgres data, so unlike Redis cooldown keys it does not expire automatically.
Symptom: Source/run telemetry could grow without bound and future prune or lookup queries would get progressively slower.
Cause: Schema setup created the tables but did not add prune logic or the supporting indexes for `run_id` and `created_at`.
Fix:
   1. Backfilled `created_at` columns defensively for older tables and added indexes on `rss_source_telemetry.run_id`, `rss_source_telemetry.created_at`, and `rss_run_telemetry.created_at`.
   2. Added `pruneTelemetry()` with a configurable 30-day default retention window.
   3. Triggered pruning once per week after a successful scheduled run so retention stays bounded without a separate cron path.

Reference: `src/pipeline/rssTelemetryStore.ts`, `src/pipeline/schedulerRunner.ts`, `__tests__/rssTelemetryStore.test.ts`, `__tests__/schedulerRunner.test.ts`.

### 2026-04-12 - Hosted Instagram publishing should bootstrap session state from env, not git [RESOLVED]

Context: Playwright publishing needs a valid Instagram session, but committing `storage.json` exposes account cookies and tokens.
Symptom: Runtime session state was tracked in git with no hosted bootstrap path for replacing it from secrets.
Cause: The repo relied on a checked-in `storage.json` instead of decoding session state from deployment config.
Fix:
   1. Added `.gitignore` entries for `storage.json` and `post-history.json`.
   2. Added `bootstrapInstagramSession()` in `server.ts` to decode `INSTAGRAM_SESSION_B64` into `storage.json` at startup.
   3. Added server tests covering both the write and warning paths.

Reference: `.gitignore`, `server.ts`, `__tests__/server.test.ts`.

### 2026-04-12 - Production containers should run compiled JavaScript, not tsx [RESOLVED]

Context: Railway and Docker start the long-lived API server on every deploy and restart.
Symptom: The production path invoked `tsx server.ts`, which adds runtime transpilation overhead to every cold start.
Cause: Package scripts and Docker CMD pointed production startup at the development TypeScript runner.
Fix:
   1. Added a dedicated `build` script and `start:prod` script in `package.json`.
   2. Updated the Dockerfile to compile with `npm run build` during image creation.
   3. Switched the production container CMD to `node dist/server.js`.

Reference: `package.json`, `Dockerfile`, `context/development.md`.

### 2026-04-12 - Render server readiness must block on bundle creation [RESOLVED]

Context: The API server depends on a valid Remotion bundle before it can serve `/api/render` successfully.
Symptom: Startup previously swallowed bundle-prewarm failures and still accepted traffic, leaving render requests to fail later against an uninitialized bundle.
Cause: `startServer()` kicked off `ensureBundle()` asynchronously and ignored the rejection.
Fix:
   1. Made startup await bundle initialization and exit with code `1` on failure.
   2. Added a bundle-aware `/health` response so readiness reflects actual render capability.
   3. Added tests covering both the fatal bundle failure path and the ready/not-ready health responses.

Reference: `server.ts`, `__tests__/server.test.ts`, `context/api-server.md`.

---

*(Add new entries above this line.)*
