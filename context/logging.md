---
description: Logging and debugging guide for analyzing pipeline issues
---

# Logging & Debugging Guide

The instagram-content-generator-remotion project now has a **structured logging system** to help diagnose issues during rendering, generation, and publishing.

## Enabling Debug Logging

Set the `DEBUG` environment variable in `.env`:

```bash
# .env
DEBUG=1              # Enable verbose debug output
LOG_DIR=./logs       # Directory where log files are stored (default: ./logs)
```

Then run the pipeline:
```bash
npm run pipeline
```

## Log Output

Logs are written to **two places**:

1. **Console (terminal)**: Colored, human-readable output
   - 🟢 Green: INFO level
   - 🟡 Yellow: WARN level
   - 🔵 Cyan: DEBUG level (only if `DEBUG=1`)
   - 🔴 Red: ERROR level

2. **File**: JSON-format logs in `./logs/run-{timestamp}.log.json`

### Example Console Output
```
[2026-04-04T12:34:56.789Z] [INFO] [pipeline] --- Step 0: Fetching News ---
[2026-04-04T12:34:57.123Z] [INFO] [news-fetch] Successfully fetched: "AI Breakthrough Announced"
[2026-04-04T12:34:58.456Z] [DEBUG] [ai-generation] Full manifest:
{
  "format": "png",
  "globalBranding": { "accentColor": "#FF5733", "handle": "@techjournal", ... },
  "carousel": [
    { "templateId": "HOOK_A", "data": { "headline": "AI Breakthrough", ... } },
    ...
  ]
}
```

## Log Files

Logs are saved as **JSON Lines** (one JSON object per line) in `./logs/`:

```
./logs/
├── run-1712234096789.log.json
├── run-1712234156021.log.json
└── ...
```

### Log File Format

Each line is a structured log entry:
```json
{
  "timestamp": "2026-04-04T12:34:56.789Z",
  "level": "DEBUG",
  "runId": "run-1712234096789",
  "step": "ai-generation",
  "message": "Full manifest:",
  "data": { "manifest": {...} }
}
```

### Sample Log Analysis

To inspect logs from your last run:
```bash
# Find the latest log file
ls -la logs/ | tail -1

# Pretty-print the JSON logs
cat logs/run-1712234096789.log.json | jq '.'

# Filter by step
cat logs/run-1712234096789.log.json | jq 'select(.step == "ai-generation")'

# Filter by error level
cat logs/run-1712234096789.log.json | jq 'select(.level == "ERROR")'
```

## Debugging Carousel Rendering Issues

If rendered slides have layout or content problems (like the "Details" slide you're seeing):

### Step 1: Check AI-Generated Manifest

Look for this in the logs:
```json
{
  "step": "ai-generation",
  "message": "Full manifest:",
  "data": {
    "carousel": [
      {
        "templateId": "CONTENT_LISTICLE",
        "data": {
          "title": "Key Points",
          "items": ["Item 1", "Item 2", ...],
          "footnote": "Source info"
        }
      }
    ]
  }
}
```

**Check:**
- ✓ Is `items` array populated? (if empty, Gemini may have failed)
- ✓ Are text lengths reasonable? (very long text may cause layout overflow)
- ✓ Is `footnote` present?

### Step 2: Check Render Payload

Look for this entry:
```json
{
  "step": "render",
  "message": "Sending to /api/render",
  "data": { /* the full manifest */ }
}
```

**Compare to Step 1:**
- Did the manifest change before being sent to the renderer?
- Are all slides still present?

### Step 3: Check Render Response

Look for:
```json
{
  "step": "rendering",
  "message": "Render Response:",
  "data": {
    "success": true,
    "images": [
      "/api/renders/render-abc123-0.png",
      "/api/renders/render-abc123-1.png",
      ...
    ]
  }
}
```

**Check:**
- ✓ Is `success: true`?
- ✓ Do all slides have corresponding images?
- ✓ Any errors in the response?

## Common Issues Found Through Logging

### Issue: Template Renders But Content is Cut Off

**Root Cause:** Text is too long for the slide template

**What to Check in Logs:**
1. Find the `CONTENT_LISTICLE` or `CONTENT_GENERIC` slide data
2. Check: `data.items` lengths or `data.body` length
3. Look at the manifest: are the text strings excessively long?

**Fix:**
- Update Gemini prompt to limit text lengths
- Edit `.github/instructions/content-pipeline.instructions.md` to document text constraints

### Issue: Missing Data on Slide

**Root Cause:** Gemini failed to generate that field

**What to Check:**
1. Look for empty arrays or `null` values in the manifest
2. Check if Gemini response was truncated or malformed

**Fix:**
- Run pipeline with `DEBUG=1` to see full response
- Adjust Gemini prompt to be more explicit about required fields

### Issue: Wrong Template Rendered

**Root Cause:** `templateId` doesn't match registered templates

**What to Check:**
1. Look for `templateId` values in the manifest
2. Compare to registered templates in `src/remotion/SlideComposition.tsx`

**Fix:**
- Ensure Gemini only uses: `HOOK_A`, `CONTENT_LISTICLE`, `CONTENT_GENERIC`, `CTA_FINAL`
- Update prompt if Gemini is generating custom template names

## Command Reference

### View Latest Logs
```bash
# Watch logs in real-time (if using tail -f)
tail -f logs/run-*.log.json

# Pretty-print latest log
jq '.' logs/run-*.log.json | tail -20
```

### Filter Logs by Error
```bash
# Show all errors
jq 'select(.level == "ERROR")' logs/run-*.log.json

# Show errors with full stack trace
jq 'select(.level == "ERROR") | .data' logs/run-*.log.json
```

### Extract AI Generated Data
```bash
# Show the full manifest that was sent to renderer
jq 'select(.step == "ai-generation" and .message | contains("Full manifest")) | .data' logs/run-*.log.json
```

### Convert JSON Lines to CSV (for spreadsheet analysis)
```bash
# If you have jq installed
jq -r '[.timestamp, .level, .step, .message] | @csv' logs/run-*.log.json > analysis.csv
```

## Logger API

If you want to add logging to other parts of the codebase:

```typescript
import Logger from './utils/logger';

const logger = new Logger(); // Creates logger with auto-generated runId

## RSS workflow log steps

RSS ingestion now emits structured logs for each stage in `src/pipeline/rssService.ts`.

- `rss`:
  - workflow start (env + threshold + timeout metadata)
  - source selection and completion summary (fulfilled/rejected/merged/deduped/duration)
  - global timeout trigger warnings
- `rss-cache`:
  - cache lookup start (key, ttl, redis enabled)
  - cache hit/miss
  - stale cache warning (>2x ttl)
  - cache write success/failure and no-articles-to-cache events
- `rss-fetch`:
  - live fetch start for each source (url, timeout)
  - normalization/filter summary per source
  - retry execution metadata and fetch failures
- `rss-retry`:
  - retry attempt logs with source id and error reason
- `rss-source`:
  - per-source completion logs with article counts
- `rss-dedup`:
  - dedup start parameters and completion summary
  - debug logs for dropped cross-source near duplicates
- `rss-health`:
  - source cooldown skip decisions
  - source health state transitions (failure counters, cooldown applied)
  - fail-open warnings when Redis checks fail
- `rss-telemetry`:
  - warnings when source/run telemetry persistence fails
  - telemetry write failure context per source or run

This logging structure enables end-to-end observability of RSS fetch, cache behavior, filtering, dedup decisions, and timing in a single run log.

// Log at different levels
logger.info('my-step', 'Something happened', { optional: 'data' });
logger.debug('my-step', 'Debug details (only if DEBUG=1)', { payload: {...} });
logger.warn('my-step', 'Warning message', { context: 'data' });
logger.error('my-step', 'Error occurred', error); // Automatically captures stack trace

// Get log file path
const logPath = logger.getLogPath(); // "./logs/run-1712234096789.log.json"
const runId = logger.getRun(); // "run-1712234096789"
```

## Next Steps

After enabling logging and re-running your pipeline:

1. **Run pipeline with DEBUG enabled:**
   ```bash
   npm run pipeline
   ```

2. **Check the generated log file** for the carousel data that was sent to the renderer

3. **Share the log file** if you need help diagnosing the Layout issue on Slide 2

The logs will give us visibility into exactly what data Gemini generated and what the renderer received.
