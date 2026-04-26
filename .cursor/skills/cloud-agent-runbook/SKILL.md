---
name: cloud-agent-runbook
description: Practical setup, execution, and testing runbook for Cloud agents working on this Instagram Remotion content generator. Use when starting work, validating changes, running the app, or testing API, Remotion, pipeline, scheduler, RSS, Instagram, or Railway behavior.
---

# Cloud Agent Runbook

Use this skill before changing or validating this repo. Keep commands rooted at the project root.

## First 5 minutes

1. Read `context/README.md`, then load the area-specific context file for the task.
2. Install dependencies with `npm ci`.
3. For most unit tests, do not create `.env`; tests set `VITEST` and mock external services where needed.
4. For manual app runs, create local env from `.env.example` and replace only the values needed for the workflow. Never commit `.env`, `storage.json`, `post-history.json`, render outputs, or logs.
5. Use `npm run build` as the compile gate before shipping non-trivial TypeScript changes.

## Login and external service setup

- GitHub CLI is usually authenticated in Cloud agents. Use it for read-only investigation such as `gh pr view` or `gh run view --log`.
- Railway workflows require a logged-in Railway CLI. Run `railway login` before using Railway CLI or Railway MCP, then confirm the repo is linked to the intended Railway project.
- Instagram publishing requires a valid Playwright storage state. Prefer `INSTAGRAM_SESSION_B64` in environment for hosted/server startup; for local debugging, use an uncommitted `storage.json`.
- Gemini/GNews live pipeline runs require `GEMINI_API_KEY` and `GNEWS_API_KEY`. Avoid repeated live runs because quota can be low; prefer mocked or targeted tests first.
- Scheduler/RSS telemetry paths use `DATABASE_URL` and `REDIS_URL` only when testing durable state, locks, or cooldown behavior. Keep them unset for tests that should exercise fail-open behavior.

## API server and render endpoint

Primary files: `server.ts`, `src/render/renderService.ts`, `context/api-server.md`.

Run locally:

1. Start the server with `npm run dev`.
2. Check readiness with `curl -i http://localhost:3000/health`.
3. Smoke test PNG rendering with a one-slide `/api/render` payload before testing MP4. Use `format: "png"` first because it is faster and lower memory.
4. Verify generated paths under `/api/renders/...`; files are written under `/tmp/renders`.

Targeted tests:

- `npx vitest run __tests__/server.test.ts`
- `npx vitest run __tests__/serverConfigParsing.test.ts`
- `npm run build`

Testing notes:

- Server tests import `app`; they must not bind port 3000.
- Full Remotion rendering is expensive. Route and validation tests should mock Remotion; use one manual render smoke test when render behavior itself changed.
- For webhook mode, assert the immediate `202` response and mock the outbound callback unless explicitly validating an integration endpoint.

## Remotion templates and Studio

Primary files: `src/remotion/index.tsx`, `src/remotion/SlideComposition.tsx`, `src/templates/*.tsx`, `context/remotion.md`, `context/templates.md`.

Run locally:

1. Start Studio with `npm run preview`.
2. Open the Studio URL in the browser.
3. Select composition `Slide` and preview representative `templateId`/`data` combinations.
4. For MP4-facing template changes, scrub frame 0 and confirm foreground content is readable.

Targeted tests:

- `npm run build`
- `npx vitest run __tests__/aiTemplateSequence.test.ts __tests__/aiServiceNormalization.test.ts` when template IDs or data constraints change.
- Manual Studio preview is required for visual/layout changes; capture a screenshot or video for review evidence.

Testing notes:

- Keep composition id `Slide` aligned with the server.
- Keep canvas assumptions at 1080x1080.
- If text layout changes, test max-length examples from `context/templates.md`, not only short demo copy.

## Content pipeline, AI, and article selection

Primary files: `src/pipelineRun.ts`, `src/pipeline/*.ts`, `context/development.md`, `context/templates.md`.

Run locally:

1. Prefer focused tests first: `npx vitest run __tests__/pipelineRun.test.ts __tests__/contentGenerator.test.ts`.
2. For live pipeline execution, set `GEMINI_API_KEY`, `GNEWS_API_KEY`, account branding env, and any ingestion flags, then run `npm run pipeline`.
3. To force GNews instead of RSS, set `USE_RSS_FEEDS=false`.
4. To steer AI template sequencing, set `CONTENT_INTENT=balanced|educate|debate|newsflash|visual_proof`.
5. To reduce render pressure during live runs, keep `RENDER_FORMAT=png` for smoke checks and `RENDER_CONCURRENCY=1` for MP4 checks.

Targeted tests:

- `npx vitest run __tests__/aiServicePromptSanitization.test.ts __tests__/aiServiceNormalization.test.ts __tests__/aiServiceTimeout.test.ts`
- `npx vitest run __tests__/newsFiltering.test.ts __tests__/postHistory.test.ts __tests__/pipelineRun.test.ts`
- `npm run test:integration` for integration checks; Railway endpoint tests auto-skip unless `RAILWAY_TEST_URL` and `SCHEDULER_SECRET` are set.

Testing notes:

- Mock Gemini for validation and sequencing tests; use live Gemini only when debugging model behavior.
- When changing generated slide contracts, validate both AI normalization and render validation.
- Keep `POST_HISTORY_PATH` pointed at a temp file for local or test runs that should not touch real history.

## RSS, Redis, Postgres, and scheduler

Primary files: `src/pipeline/rssService.ts`, `src/pipeline/rssTelemetryStore.ts`, `src/pipeline/schedulerRunner.ts`, `src/pipeline/schedulerLock.ts`, `context/development.md`.

Run locally:

1. Leave `DATABASE_URL` and `REDIS_URL` unset when checking fail-open behavior.
2. Set both variables only when validating distributed locks, persisted schedule state, RSS source cooldowns, or telemetry pruning.
3. Trigger the scheduler endpoint with `curl -i -X POST http://localhost:3000/api/schedule/run`; include `-H "x-scheduler-secret: $SCHEDULE_RUN_SECRET"` when `SCHEDULE_RUN_SECRET` is set.
4. Keep `SCHEDULER_ENABLED=false` for ordinary server testing. Set it to `true` only when validating the internal polling loop.

Targeted tests:

- `npx vitest run __tests__/rssService.test.ts __tests__/rssTelemetryStore.test.ts __tests__/rssSourceRegistry.test.ts`
- `npx vitest run __tests__/schedulerRunner.test.ts __tests__/schedulerLock.test.ts`
- `npx vitest run __tests__/redisClient.test.ts`

Testing notes:

- Scheduler success can be `executed`, `skipped_due_to_time`, or `skipped_lock_held`; assert the status that matches setup.
- Redis and Postgres failures should not block RSS ingestion unless the code path explicitly requires scheduling state or locks.

## Instagram and browser automation

Primary files: `src/automation/instagramPublisher.ts`, session validation tests, `context/lesson-learned.md`.

Run locally:

1. Confirm `storage.json` exists or `INSTAGRAM_SESSION_B64` is set.
2. Keep `PLAYWRIGHT_HEADLESS=true` in Cloud unless doing intentional headed debugging through the browser.
3. Run session and caption tests before any live publish attempt.
4. Use live Instagram publishing only when explicitly required and credentials/session are known valid.

Targeted tests:

- `npx vitest run __tests__/instagramAuthState.test.ts __tests__/sessionValidation.test.ts __tests__/instagramSessionGuard.test.ts`
- `npx vitest run __tests__/instagramCaptionValidation.test.ts __tests__/instagramPublishVerification.test.ts`

Testing notes:

- Auth failures should stop before browser automation proceeds.
- Capture screenshots only for debugging auth/UI failures; do not commit them.

## Common validation bundles

- Fast confidence: `npx vitest run __tests__/server.test.ts __tests__/pipelineRun.test.ts`
- Pipeline confidence: `npx vitest run __tests__/contentGenerator.test.ts __tests__/aiTemplateSequence.test.ts __tests__/newsFiltering.test.ts __tests__/pipelineRun.test.ts`
- Scheduler/RSS confidence: `npx vitest run __tests__/rssService.test.ts __tests__/schedulerRunner.test.ts __tests__/schedulerLock.test.ts`
- Full automated check: `npx vitest run && npm run build`

## Updating this skill

When a new runbook trick, environment workaround, login step, feature flag, or reliable test workflow is discovered:

1. Add the practical instruction to the smallest matching section in this file.
2. Cross-check `context/development.md` and the relevant `context/*.md`; update those docs when scripts, env vars, endpoints, template contracts, or runtime behavior changed.
3. If the discovery came from a mistake or production/debugging incident, add a dated entry to `context/lesson-learned.md`.
4. Keep this skill short and executable. Prefer exact commands and env names over background explanation.
