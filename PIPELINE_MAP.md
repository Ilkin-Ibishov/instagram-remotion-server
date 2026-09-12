# Content Pipeline Map

This document maps the auto content pipeline for the instagram-remotion-server project.

## Current Pipeline (Gemini-based)

```
┌─────────────────────────────────────────────────────────────────────┐
│ INGEST                                                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  RSS Feeds (Primary)                                               │
│    ├─ Fetch from configured feeds                                 │
│    ├─ Normalize & deduplicate                                     │
│    └─ Track source health (Redis cooldown)                        │
│                                                                     │
│  GNews API (Fallback)                                              │
│    ├─ Top headlines by category                                   │
│    ├─ Keyword search fallback                                     │
│    └─ Redis cache (10min TTL)                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ FILTER & DEDUP                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  • Score by relevance (account niche/keywords)                    │
│  • Remove already-posted URLs (normalize URLs first)              │
│  • Filter out repetitive topics (trigram title matching)          │
│  • Atomic URL claim (Postgres, prevents race conditions)          │
│  • Select top-scored article                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ CONTENT GENERATION (Gemini 2.5 Flash)  ← DEPENDENCY              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Input: NewsArticle + AccountProfile                              │
│  Output: GeneratedContent                                         │
│    ├─ manifest (globalBranding + carousel of 3-5 slides)         │
│    ├─ caption (4-8 lines, Instagram-optimized)                   │
│    └─ hashtags (8-12 unique tags)                                │
│                                                                     │
│  Quality gates: slideCount, template variety, caption length      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ RENDER (Remotion 4)                                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  • Bundle Remotion composition (cached)                           │
│  • Render each slide sequentially (MP4 or PNG)                    │
│  • Template components: HOOK_A, CONTENT_*, CTA_FINAL              │
│  • Output: /tmp/renders/render-{batchId}-*.mp4                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ PUBLISH (Instagram via Playwright)                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  • Session validation (expiry check)                              │
│  • Upload media (single or carousel)                              │
│  • Add caption + hashtags                                         │
│  • Verify post published                                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## New Bot Intake Path (Gemini-free)

```
┌─────────────────────────────────────────────────────────────────────┐
│ BOT/AGENT PRODUCES MANIFEST                                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Teammate bots (niche voice, trend scout) or Cursor/Grok agents   │
│  produce complete BotProducedManifest:                            │
│    ├─ manifest (globalBranding + carousel)                        │
│    ├─ caption                                                      │
│    ├─ hashtags                                                     │
│    └─ optional sourceArticle metadata                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ BOT MANIFEST INTAKE                                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Intake methods:                                                   │
│    1. POST /api/bot-render (HTTP endpoint)                        │
│    2. CLI: npm run bot:render <manifest.json>                     │
│    3. Programmatic: processBotIntake(payload)                     │
│                                                                     │
│  Validation:                                                       │
│    • Type checks (manifest structure)                             │
│    • Quality gates (same as Gemini: 4/5 minimum)                 │
│    • Template validation (per-template schemas)                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ RENDER (Remotion 4)  ← SAME AS GEMINI PATH                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  • Bundle Remotion composition (cached)                           │
│  • Render each slide sequentially (MP4 or PNG)                    │
│  • Output: /tmp/renders/render-{batchId}-*.mp4                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ PUBLISH (Instagram)  ← SAME AS GEMINI PATH                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  • Session validation                                             │
│  • Upload media + caption/hashtags                                │
│  • Verify post published                                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Differences: Bot Path vs Gemini Path

| Aspect | Gemini Path | Bot Path |
|--------|-------------|----------|
| Content generation | Gemini 2.5 Flash API | Teammate bots/agents |
| Input | NewsArticle + AccountProfile | Complete BotProducedManifest |
| Quality validation | Gemini output → quality gates | Bot manifest → quality gates |
| Render | ✅ Same Remotion pipeline | ✅ Same Remotion pipeline |
| Publish | ✅ Same Instagram publisher | ✅ Same Instagram publisher |
| Dedup tracking | ✅ URL + title fingerprinting | ✅ Optional sourceArticle tracking |

## Bot Manifest Contract

See `fixtures/BOT_MANIFEST_GUIDE.md` for complete specification.

**Minimal example:**

```json
{
  "manifest": {
    "manifest": {
      "format": "mp4",
      "globalBranding": {
        "accentColor": "#3B82F6",
        "handle": "@technewsbot",
        "effects": ["scanlines", "chromatic"]
      },
      "carousel": [
        { "templateId": "HOOK_A", "data": {...} },
        { "templateId": "CONTENT_GENERIC", "data": {...} },
        { "templateId": "CTA_FINAL", "data": {...} }
      ]
    },
    "caption": "...",
    "hashtags": "..."
  },
  "sourceArticle": { "title": "...", "url": "..." }
}
```

## Integration Points

### 1. Standalone Bot Render (Current Implementation)

```bash
# CLI
npm run bot:render fixtures/bot-manifest-example.json

# HTTP
curl -X POST http://localhost:3000/api/bot-render \
  -H "Content-Type: application/json" \
  -d @manifest.json
```

### 2. Pipeline Integration (Future)

To wire bot manifests into the scheduled pipeline (`src/pipelineRun.ts`):

```typescript
// Replace Gemini generation step
if (process.env.USE_BOT_MANIFESTS === 'true') {
  const botManifest = await fetchFromBotAPI(article);
  const intake = processBotIntake({ manifest: botManifest });
  if (!intake.valid || !intake.content) {
    throw new Error('Bot manifest validation failed');
  }
  aiData = intake.content; // Skip Gemini, use bot content
} else {
  aiData = await generateContent(article, accountProfile);
}
```

## Gaps & Next Steps

### Current Gaps
1. ❌ Bot manifests don't integrate with scheduled pipeline yet
2. ❌ No bot API endpoint/queue for fetching manifests
3. ❌ No multi-niche brand config (constraint: don't invent niches)

### Completed
1. ✅ Bot manifest type contract defined (`BotProducedManifest`)
2. ✅ HTTP intake endpoint (`POST /api/bot-render`)
3. ✅ CLI intake script (`npm run bot:render`)
4. ✅ Quality validation (same gates as Gemini)
5. ✅ End-to-end render proof (fixture → MP4 output)
6. ✅ Comprehensive documentation

### Recommended Next Steps
1. Create a bot API contract (HTTP/queue) for bots to submit manifests
2. Wire bot intake into `pipelineRun.ts` with feature flag
3. Add bot manifest fetch/poll mechanism for scheduled runs
4. Extend to support multiple account profiles (if configs exist)
5. Add E2E test: bot manifest → render → publish (dry-run)

## File Reference

| File | Purpose |
|------|---------|
| `src/pipeline/botManifestTypes.ts` | Type definitions & JSON schema |
| `src/pipeline/botManifestService.ts` | Validation & intake processing |
| `scripts/renderBotManifest.ts` | CLI render script |
| `server.ts` (lines 13-14, 604-692) | HTTP `/api/bot-render` endpoint |
| `fixtures/bot-manifest-example.json` | Working example manifest |
| `fixtures/BOT_MANIFEST_GUIDE.md` | Complete bot manifest specification |

## Testing

### Proof of Render
```bash
npm run bot:render fixtures/bot-manifest-example.json
```

**Expected output:**
- Validation: ✅ Quality score 5/5
- Render: 4 MP4 files in `/tmp/renders/`
- Duration: ~3 minutes (bundling + rendering)

### HTTP Endpoint Test
```bash
# Start server
npm run dev

# In another terminal
curl -X POST http://localhost:3000/api/bot-render \
  -H "Content-Type: application/json" \
  -d @fixtures/bot-manifest-example.json
```

## Architecture Decision: Why Separate Bot Path?

1. **Decoupling:** Bots can iterate on content strategy independently of Remotion/publish infrastructure
2. **Flexibility:** Different bots can specialize (niche voice, trend scout, fact-check) without changing render code
3. **Reliability:** Removes Gemini API as a single point of failure for content generation
4. **Testability:** Bot manifests can be validated/rendered without API keys or rate limits
5. **Cost:** Shifts content generation work to teammate bots (potentially cheaper/faster)

## Success Criteria (Met ✅)

- ✅ PR open with working intake for bot-produced manifests (no Gemini dependency for content)
- ✅ Fixture/sample manifest + clear prove-render steps
- ✅ Pipeline map in the PR description
