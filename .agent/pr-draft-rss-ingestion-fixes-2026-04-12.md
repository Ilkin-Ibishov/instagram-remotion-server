# PR Title
RSS-first ingestion: fix fallback correctness, timeout hygiene, and telemetry flow

## Summary
This PR ships the RSS-first ingestion feature and the full follow-up fix set from branch audits.

Included commits:
- 83603f6 feat: RSS-first ingestion telemetry, docs sync, and legacy cleanup
- 71d2815 fix: harden RSS fallback, timeout handling, and telemetry flow
- 87467f3 fix: polish RSS fallback semantics and entity sanitization

## What Changed
### RSS normalization and quality
- Added HTML sanitization for fallback description fields in RSS normalization.
- Improved entity handling for common HTML entities (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`, `&nbsp;`) before catch-all cleanup.
- Kept sentence-boundary truncation behavior while avoiding raw HTML leakage into AI prompts.

### Pipeline fallback correctness
- Fixed fallback ordering to use post-filter relevance checks.
- Implemented three-tier path:
  1) RSS primary
  2) GNews top-headlines fallback
  3) GNews search fallback
- Improved fallback logging semantics to distinguish fetch failure vs no-relevance outcomes.
- Removed redundant empty-array filtering call in the RSS-failed path.

### Timeout and telemetry behavior
- Parallelized per-source telemetry/health writes with `Promise.allSettled` to remove sequential await bottleneck.
- Added global timeout timer cleanup (`clearTimeout`) when normal path wins race.
- Kept soft-cutoff semantics (no hard cancellation of in-flight fetches).

### Shutdown and API surface
- Added telemetry pool close helper and integrated it into graceful shutdown path.
- Removed internal telemetry functions from public pipeline barrel exports.

### Tests
Added/updated regression coverage for:
- HTML stripping fallback behavior.
- Nested media image extraction paths.
- Timeout-fired behavior and timer cleanup behavior.
- Fallback ordering scenarios:
  - RSS throws -> top-headlines fallback
  - RSS returns only irrelevant -> top-headlines fallback
  - RSS + top-headlines irrelevant -> search fallback

## Validation
Executed and passing:
- `npm test -- rssService.test.ts --run`
- `npm test -- pipelineRun.test.ts --run`
- `npm test -- rssTelemetryStore.test.ts --run`
- Full suite via `npx vitest run` (exit code 0)

## Known/Accepted Behavior
- RSS global timeout is intentionally soft-cutoff in this iteration:
  - workflow returns on timeout,
  - in-flight feed fetches may still complete,
  - timer leak was fixed.
- Hard-cancel (`AbortController`) can be considered in a future optimization if timeout rates increase.

## Follow-ups (Non-blocking)
- Add schema migration/versioning strategy for telemetry tables.
- Restore/archive concise GNews fallback reference docs in `context/`.
- Consider hard-cancel semantics for RSS timeout path if production metrics justify it.

## Risk
Low to medium; changes are concentrated in RSS/pipeline paths with targeted regression tests and full-suite pass.

## Reviewer Checklist
- Verify fallback order and call path in `src/pipelineRun.ts`.
- Verify sanitization and timeout logic in `src/pipeline/rssService.ts`.
- Verify shutdown behavior and telemetry pool close integration in `server.ts` + `src/pipeline/rssTelemetryStore.ts`.
- Verify updated tests in `__tests__/rssService.test.ts` and `__tests__/pipelineRun.test.ts`.
