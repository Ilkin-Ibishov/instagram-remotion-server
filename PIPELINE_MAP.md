# Content Pipeline Map

This document maps the content pipeline architecture including bot-manifest intake, MCP platform layer, and multi-platform publishing.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     SPECIALIST BOTS                              │
│  (Publisher bots, Growth analysts, Niche-voice content engines) │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     MCP PLATFORM SERVER                          │
│              (src/mcp/server.ts - stdio transport)              │
│                                                                   │
│  Tools:                                                          │
│  - render_niche_voice  → Remotion render pipeline               │
│  - publish_post        → Platform adapters                      │
│  - get_post_metrics    → Metrics store + scrape hooks           │
│  - list_published_posts → Postgres analytics                    │
│  - list_niches         → Niche registry                         │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │  Instagram   │  │   TikTok     │  │ YouTube      │
    │  Adapter     │  │   Adapter    │  │ Shorts       │
    │              │  │   (stub)     │  │ Adapter      │
    │  ✅ Publish  │  │   ⏳ Phase 2 │  │ (stub)       │
    │  ✅ Metrics  │  │              │  │ ⏳ Phase 2   │
    └──────────────┘  └──────────────┘  └──────────────┘
```

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

## Bot Manifest Intake Path (Gemini-free)

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
│    3. MCP: render_niche_voice tool                                │
│    4. Programmatic: processBotIntake(payload)                     │
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

## MCP Platform Layer

The **MCP platform server** (`src/mcp/server.ts`) exposes the render + publish pipeline to external bots via stdio protocol.

### MCP Bot Workflow Example

```
Bot (e.g., niche-voice agent)
  │
  ├─► list_niches()
  │     └─> [psychology-micro, history-flash, legal-rights-az, study-hacks, ai-tools-daily]
  │
  ├─► render_niche_voice({ niche: 'psychology-micro', manifest, format: 'mp4' })
  │     └─> { batchId, renderUrls, mediaPaths }
  │
  ├─► publish_post({ platform: 'instagram', mediaPaths, caption, niche })
  │     └─> { permalink, verificationMethod, publishDurationMs }
  │
  └─► list_published_posts({ platform: 'instagram', days: 7 })
        └─> [{ batchId, permalink, status, ... }]
```

### Growth Analyst Workflow (via MCP)

```
Analyst bot
  │
  ├─► list_published_posts({ days: 30, limit: 50 })
  │     └─> [post1, post2, ...]
  │
  └─► For each post:
        get_post_metrics({ platform, permalink })
          └─> { likes, comments, views, saves, capturedAt }
              (Phase 1: metrics from DB, live scraping Phase 2)
```

### MCP Tools

| Tool | Purpose | Status |
|------|---------|--------|
| `render_niche_voice` | Render niche-branded content | ✅ Production |
| `publish_post` | Publish to Instagram/TikTok/YouTube | ✅ IG only (Phase 1) |
| `get_post_metrics` | Fetch engagement metrics | ⚠️ Store only (Phase 1) |
| `list_published_posts` | Query recent posts | ✅ Production |
| `list_niches` | List available niches | ✅ Production |

### Platform Adapter Status

| Platform | Publish | Metrics | Format | Status |
|----------|---------|---------|--------|--------|
| Instagram | ✅ | ⚠️ Store | 1080×1080 | Production |
| TikTok | ❌ | ❌ | 1080×1920 | Phase 2 (stub) |
| YouTube Shorts | ❌ | ❌ | 1080×1920 | Phase 2 (stub) |

## Niche System (LOCKED)

**5 locked niches** (do not invent new ones):

1. `psychology-micro` — Micro-psychology insights
2. `history-flash` — Quick history facts
3. `legal-rights-az` — Legal rights explainers
4. `study-hacks` — Study tips and productivity
5. `ai-tools-daily` — AI tool reviews

**Registry:** These map to account profiles and RSS sources. Do not add niches without updating:
- `src/pipeline/rssSourceRegistry.ts` (RSS feeds per niche)
- `src/pipeline/accountProfile.ts` (BRAND_NICHE env)
- `src/mcp/tools/listNiches.ts` (MCP niche list)

## Key Differences: Bot Path vs Gemini Path

| Aspect | Gemini Path | Bot Path | MCP Path |
|--------|-------------|----------|----------|
| Content generation | Gemini 2.5 Flash API | Teammate bots/agents | External MCP bots |
| Input | NewsArticle + AccountProfile | Complete BotProducedManifest | Niche + Manifest |
| Entry point | Scheduled cron | HTTP/CLI/programmatic | MCP stdio tools |
| Quality validation | Gemini output → gates | Bot manifest → gates | Manifest → gates |
| Render | ✅ Remotion pipeline | ✅ Remotion pipeline | ✅ Remotion pipeline |
| Publish | ✅ Instagram Playwright | ✅ Instagram Playwright | ✅ Instagram (+ stubs) |

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
        "handle": "@psychology_micro",
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

### 1. Standalone Bot Render

```bash
# CLI
npm run bot:render fixtures/bot-manifest-example.json

# HTTP
curl -X POST http://localhost:3000/api/bot-render \
  -H "Content-Type: application/json" \
  -d @manifest.json

# MCP
npm run mcp:serve
# Then call render_niche_voice via MCP host
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

## Render Pipeline Details

### Remotion Composition Flow

```
server.ts (ensureBundle)
  └─> @remotion/bundler: bundle src/remotion/index.tsx
       └─> src/remotion/SlideComposition.tsx
            └─> templateMap[templateId] → template component
                 └─> src/templates/{HookA,ContentGeneric,CtaFinal,...}.tsx
                      └─> src/components/EffectsOverlay.tsx (branding.effects)
```

### Render Output

```
/tmp/renders/
  ├─ render-a1b2c3d4-0.mp4
  ├─ render-a1b2c3d4-1.mp4
  └─ render-a1b2c3d4-2.mp4

Served at:
  /api/renders/render-a1b2c3d4-0.mp4
  /api/renders/render-a1b2c3d4-1.mp4
  /api/renders/render-a1b2c3d4-2.mp4
```

## Deployment

### HTTP Server (Existing)

```
Railway → Express server (server.ts)
  - POST /api/render
  - POST /api/bot-render (bot manifest intake)
  - POST /api/schedule/run (cron trigger)
  - GET /api/renders/:filename (static serve)
```

### MCP Server (New)

```
MCP host (Claude Desktop, n8n, automation) → stdio
  └─> tsx src/mcp/server.ts
       └─> Reads same .env, DATABASE_URL, storage.json
       └─> Shares RENDER_DIR with HTTP server
```

**Can run side-by-side:** Both servers use same resources (Postgres, Redis, Remotion).

## File References

| Layer | Files |
|-------|-------|
| MCP server | `src/mcp/server.ts` |
| MCP tools | `src/mcp/tools/*.ts` |
| Platform adapters | `src/mcp/adapters/{instagram,tiktok,youtube}.ts` |
| Bot manifest types | `src/pipeline/botManifestTypes.ts` |
| Bot manifest service | `src/pipeline/botManifestService.ts` |
| Bot render script | `scripts/renderBotManifest.ts` |
| Render pipeline | `server.ts`, `src/remotion/`, `src/templates/` |
| Instagram automation | `src/automation/instagramPublisher.ts` |
| Metrics store | `src/pipeline/publishedPostStore.ts` |
| Scheduled pipeline | `src/pipelineRun.ts`, `src/pipeline/{rssService,aiService,newsFiltering}.ts` |

## Phase 2 Roadmap

- [ ] 9:16 vertical templates for TikTok/Shorts/Reels
- [ ] TikTok Playwright automation
- [ ] YouTube Data API v3 upload
- [ ] Live metrics scraping (Instagram Graph API or Playwright)
- [ ] Per-niche session management
- [ ] Wire bot manifests into scheduled pipeline with feature flag

## Related Documentation

- MCP platform architecture: [context/mcp-platform.md](./context/mcp-platform.md)
- Bot manifest guide: [fixtures/BOT_MANIFEST_GUIDE.md](./fixtures/BOT_MANIFEST_GUIDE.md)
- API server and render: [context/api-server.md](./context/api-server.md)
- Template contracts: [context/templates.md](./context/templates.md)
