# Pipeline architecture map

## Overview

This document visualizes the end-to-end content pipeline and the new **MCP platform layer** for bot-driven multi-platform publishing.

## Architecture layers

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
              │
              ▼
    ┌──────────────────────────────────────────────────┐
    │        EXISTING INSTAGRAM PIPELINE                │
    │                                                    │
    │  Playwright Publisher (src/automation/           │
    │    instagramPublisher.ts)                        │
    │  - Session validation (storage.json)             │
    │  - DOM automation + upload                       │
    │  - Profile verification (baseline permalink)     │
    │                                                    │
    │  Metrics Store (src/pipeline/                    │
    │    publishedPostStore.ts)                        │
    │  - Postgres: published_posts, post_events        │
    │  - Quality scoring, engagement snapshots         │
    └──────────────────────────────────────────────────┘
```

## Existing scheduled pipeline (RSS/GNews → Instagram)

```
┌─────────────────────────────────────────────────────────────────┐
│                    SCHEDULED AUTOMATION                          │
│            (Railway cron → POST /api/schedule/run)              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   PIPELINE ORCHESTRATION                         │
│                  (src/pipelineRun.ts)                           │
│                                                                   │
│  1. RSS ingestion (rssService.ts)                               │
│     - Fetch from sources (techcrunch, wired, etc.)              │
│     - Cache + dedup via Redis                                   │
│     - Source-health cooldowns                                   │
│     - Fallback: GNews search if RSS yields no articles          │
│                                                                   │
│  2. Article selection (newsFiltering.ts)                        │
│     - Score by niche keyword relevance                          │
│     - Dedup vs post history (trigram + URL)                     │
│     - Recency + quality signals                                 │
│                                                                   │
│  3. AI content generation (aiService.ts)                        │
│     - Gemini 2.5 Flash: article → manifest                      │
│     - Template sequence + captions                              │
│     - Niche-aware prompts (account profile)                     │
│                                                                   │
│  4. Remotion render (server.ts → POST /api/render)             │
│     - Bundle Remotion compositions                              │
│     - Render slides (1080×1080 PNG or MP4)                      │
│     - Save to RENDER_DIR (/tmp/renders)                         │
│                                                                   │
│  5. Instagram publish (instagramPublisher.ts)                   │
│     - Playwright automation                                     │
│     - Upload media, caption, share                              │
│     - Profile verification (detect new permalink)               │
│                                                                   │
│  6. Analytics persistence (publishedPostStore.ts)               │
│     - Record to Postgres (published_posts table)                │
│     - Quality snapshot, template sequence                       │
│     - Post events timeline                                      │
└─────────────────────────────────────────────────────────────────┘
```

## MCP platform integration

The **MCP platform layer** exposes the same render + publish capabilities to external bots via stdio protocol:

### Bot workflow (via MCP)

```
Bot (e.g., niche-voice agent)
  │
  ├─► list_niches()
  │     └─> [technology, business, startup, ai, science]
  │
  ├─► render_niche_voice({ niche: 'technology', manifest, format: 'mp4' })
  │     └─> { batchId, renderUrls, mediaPaths }
  │
  ├─► publish_post({ platform: 'instagram', mediaPaths, caption, niche })
  │     └─> { permalink, verificationMethod, publishDurationMs }
  │
  └─► list_published_posts({ platform: 'instagram', days: 7 })
        └─> [{ batchId, permalink, status, ... }]
```

### Growth analyst workflow (via MCP)

```
Analyst bot
  │
  ├─► list_published_posts({ days: 30, limit: 50 })
  │     └─> [post1, post2, ...]
  │
  └─► For each post:
        get_post_metrics({ platform, permalink })
          └─> { likes, comments, views, saves, capturedAt }
              (Phase 1: not yet implemented, returns not_available)
```

## Render pipeline details

### Entry: POST /api/render

```
{
  globalBranding: { accentColor, handle, effects },
  carousel: [
    { templateId: 'HOOK_A', data: { headline, subheadline, imageUrl } },
    { templateId: 'CONTENT_GENERIC', data: { title, body, highlight } },
    { templateId: 'CTA_FINAL', data: { callToAction, subtext } }
  ],
  format: 'mp4'  // or 'png'
}
```

### Remotion composition flow

```
server.ts (ensureBundle)
  └─> @remotion/bundler: bundle src/remotion/index.tsx
       └─> src/remotion/SlideComposition.tsx
            └─> templateMap[templateId] → template component
                 └─> src/templates/{HookA,ContentGeneric,CtaFinal,...}.tsx
                      └─> src/components/EffectsOverlay.tsx (branding.effects)
```

### Render output

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

## Platform adapter contract

Each platform (Instagram, TikTok, YouTube Shorts) implements:

```typescript
interface PlatformAdapter {
  name: string;
  supportedFormats: ('square' | 'vertical')[];
  
  canPublish(): boolean;
  publish(post, niche) → { success, permalink, ... }
  
  canFetchMetrics(): boolean;
  getMetrics(identifier) → { likes, comments, views, ... } | null
  
  listPosts(opts) → [{ batchId, permalink, ... }]
}
```

### Phase 1 status

| Adapter | canPublish | canFetchMetrics | Notes |
|---------|------------|-----------------|-------|
| Instagram | ✅ true | ✅ true (store only) | Playwright + session, metrics from DB |
| TikTok | ❌ false | ❌ false | Returns `notImplemented: true` |
| YouTube | ❌ false | ❌ false | Returns `notImplemented: true` |

### Phase 2 roadmap

- **9:16 templates:** Add vertical (1080×1920) templates for TikTok/Shorts/Reels
- **TikTok automation:** Playwright upload flow + session management
- **YouTube Data API v3:** OAuth + video.insert for Shorts
- **Live metrics scraping:** Instagram Playwright scrape, TikTok Analytics API, YouTube Analytics API

## Niche system

### Niche sources

- **5 locked niches:** `technology`, `business`, `startup`, `ai`, `science`
- **Registry:** `src/pipeline/rssSourceRegistry.ts` (RSS sources per niche)
- **Account profile:** `src/pipeline/accountProfile.ts` (BRAND_NICHE env)
- **MCP tool:** `list_niches()` returns niche metadata for bot discovery

### Per-niche publishing (Phase 2)

```
Bot → list_niches() → { id: 'technology', platforms: ['instagram', 'tiktok'] }
Bot → publish_post({ platform: 'instagram', niche: 'technology', ... })
      └─> Adapter loads storage_technology.json (per-niche session)
```

**Phase 1:** Single Instagram account session (`storage.json`), niche param ignored.

## Metrics and analytics

### Published posts store (Postgres)

```
published_posts
  ├─ batch_id (unique)
  ├─ status (selected, generated, rendered, published, failed)
  ├─ article_title, article_url, article_source
  ├─ caption, hashtags, template_sequence
  ├─ quality_snapshot (JSON: slideCount, hashtagCount, hookFingerprint, ...)
  ├─ instagram_permalink
  ├─ publish_confirmation (JSON: verificationMethod, publishDurationMs, ...)
  └─ published_at, created_at

post_events
  ├─ event_type (article_selected, ai_generated, render_completed, publish_confirmed)
  ├─ stage (selection, generation, render, publish)
  └─ payload (JSON)

post_engagement_snapshots (future)
  ├─ likes, comments, views, saves, shares
  └─ captured_at
```

### Metrics read path

```
MCP Tool: get_post_metrics({ platform, permalink })
  └─> InstagramAdapter.getMetrics(permalink)
       └─> (Phase 1) Returns null (live scraping not implemented)
       └─> (Phase 2) Playwright scrape → { likes, comments, views, saves }
```

## Security and credentials

### Instagram session

- **File:** `storage.json` (Playwright session state)
- **Bootstrap:** `INSTAGRAM_SESSION_B64` env (Railway deployment)
- **Validation:** `validateInstagramSessionExpiry()` checks cookie expiry
- **Re-auth:** Run `scripts/saveSession.ts` to refresh session

### TikTok/YouTube (Phase 2)

- **TikTok:** Session cookies in env or secure store
- **YouTube:** OAuth 2.0 refresh token in env or secure store

**Never log credentials.** MCP tools never return session tokens or cookies in responses.

## Error handling

All MCP tools return structured errors:

```json
{
  "success": false,
  "error": "Human-readable message",
  "errorCode": "NOT_IMPLEMENTED" | "INVALID_NICHE" | "SESSION_EXPIRED" | ...,
  "notImplemented": true  // For platform stubs
}
```

## Deployment

### HTTP server (existing)

```
Railway → Express server (server.ts)
  - POST /api/render
  - POST /api/schedule/run (cron trigger)
  - GET /api/renders/:filename (static serve)
```

### MCP server (new)

```
MCP host (Claude Desktop, n8n, automation) → stdio
  └─> tsx src/mcp/server.ts
       └─> Reads same .env, DATABASE_URL, storage.json
       └─> Shares RENDER_DIR with HTTP server
```

**Can run side-by-side:** Both servers use same resources (Postgres, Redis, Remotion bundle, render cache).

## File references

| Layer | Files |
|-------|-------|
| MCP server | `src/mcp/server.ts` |
| MCP tools | `src/mcp/tools/*.ts` |
| Platform adapters | `src/mcp/adapters/{instagram,tiktok,youtube}.ts` |
| Render pipeline | `server.ts`, `src/remotion/`, `src/templates/` |
| Instagram automation | `src/automation/instagramPublisher.ts` |
| Metrics store | `src/pipeline/publishedPostStore.ts` |
| Scheduled pipeline | `src/pipelineRun.ts`, `src/pipeline/{rssService,aiService,newsFiltering}.ts` |

## Related documentation

- MCP platform architecture: [context/mcp-platform.md](./context/mcp-platform.md)
- API server and render: [context/api-server.md](./context/api-server.md)
- Template contracts: [context/templates.md](./context/templates.md)
- Instagram publisher: `src/automation/instagramPublisher.ts` (inline docs)
