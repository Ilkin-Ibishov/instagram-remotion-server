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

---

*(Add new entries above this line.)*
