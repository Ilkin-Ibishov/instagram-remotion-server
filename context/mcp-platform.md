# MCP platform architecture

## Purpose

This document describes the **Model Context Protocol (MCP)** server that exposes Instagram/TikTok/YouTube Shorts content generation and publishing as a unified platform for specialist AI bots (publisher bots, growth analysts, niche-voice content pipelines).

## Design goals

1. **Single entrypoint** for all bot-driven content operations (render, publish, metrics)
2. **Platform-agnostic interface** supporting Instagram, TikTok, YouTube Shorts
3. **Niche-aware** rendering using locked account profiles (psychology-micro, history-flash, legal-rights-az, study-hacks, ai-tools-daily)
4. **Metrics read path** for growth analytics and post-performance tracking
5. **Stable error contracts** for unimplemented platforms (no silent failures)

## Platform support matrix

| Platform | Render | Publish | Metrics | Status |
|----------|--------|---------|---------|--------|
| Instagram | ✅ 1080×1080 | ✅ Via Playwright | ✅ Store + scrape hooks | Production |
| TikTok | ⏳ Needs 9:16 | ❌ Stub | ❌ Stub | Planned Phase 2 |
| YouTube Shorts | ⏳ Needs 9:16 | ❌ Stub | ❌ Stub | Planned Phase 2 |

**Note:** Current Remotion templates are 1080×1080 square format only. TikTok/Shorts require 9:16 (1080×1920) vertical templates — P1 gap for Phase 2.

## MCP tools

### `render_niche_voice`

Render content for a specific niche using account branding.

**Input:**
```typescript
{
  niche: 'psychology-micro' | 'history-flash' | 'legal-rights-az' | 'study-hacks' | 'ai-tools-daily',
  manifest: CarouselManifest,  // globalBranding + carousel[]
  format?: 'png' | 'mp4'       // Default: 'mp4'
}
```

**Output:**
```typescript
{
  success: boolean,
  batchId: string,
  renderUrls: string[],     // /api/renders/render-{batchId}-{i}.{ext}
  mediaPaths: string[],     // Local filesystem paths
  format: 'png' | 'mp4',
  error?: string
}
```

**Implementation:** Delegates to existing render pipeline (`POST /api/render`).

### `publish_post`

Publish rendered media to a platform.

**Input:**
```typescript
{
  platform: 'instagram' | 'tiktok' | 'youtube_shorts',
  mediaPaths: string[],
  caption: string,
  niche: string,            // For session selection
  metadata?: {
    hashtags?: string[],
    location?: string,
    schedule?: string       // ISO 8601 (future)
  }
}
```

**Output:**
```typescript
{
  success: boolean,
  platform: string,
  permalink?: string,
  verificationMethod?: string,
  publishDurationMs?: number,
  error?: string,
  notImplemented?: boolean  // True for tiktok/youtube_shorts
}
```

**Implementation:**
- `instagram`: Wraps `publishToInstagram()` from `src/automation/instagramPublisher.ts`
- `tiktok`, `youtube_shorts`: Return `{ success: false, notImplemented: true, error: "TikTok publishing not implemented (requires 9:16 format + platform automation)" }`

**Auth model:** Platform credentials read from environment:
- Instagram: `storage.json` session file (per-niche account session loading planned Phase 2)
- TikTok: `TIKTOK_SESSION_{NICHE}` environment variables (Phase 2)
- YouTube: OAuth tokens in secure store (Phase 2)

### `get_post_metrics`

Retrieve engagement metrics for a published post.

**Input:**
```typescript
{
  platform: 'instagram' | 'tiktok' | 'youtube_shorts',
  permalink?: string,       // Platform-specific post URL
  batchId?: string,         // Internal batch identifier
  niche?: string
}
```

**Output:**
```typescript
{
  success: boolean,
  platform: string,
  permalink?: string,
  metrics?: {
    likes?: number,
    comments?: number,
    views?: number,
    saves?: number,
    shares?: number,
    holds3s?: number,       // 3-second hold rate (TikTok/Shorts)
    follows?: number,       // Follows from post
    profileVisits?: number,
    capturedAt: string      // ISO 8601
  },
  error?: string,
  notImplemented?: boolean
}
```

**Implementation:**
- `instagram`: Reads from `published_posts` table via `publishedPostStore.ts`; live scrape hooks in `publishedPostMetrics.ts` (Phase 2)
- `tiktok`, `youtube_shorts`: Return `{ success: false, notImplemented: true, error: "Metrics scraping not implemented for {platform}" }`

**Real data only:** Never return synthetic or estimated metrics. Return `null` for unavailable fields.

### `list_published_posts`

List recent published posts with basic metadata.

**Input:**
```typescript
{
  platform?: 'instagram' | 'tiktok' | 'youtube_shorts',
  niche?: string,
  limit?: number,           // Default: 10, max: 100
  days?: number             // Filter by recency
}
```

**Output:**
```typescript
{
  success: boolean,
  posts: Array<{
    batchId: string,
    platform: string,
    permalink?: string,
    caption?: string,
    hashtags?: string,
    publishedAt?: string,
    createdAt: string,
    status: string,
    templateSequence?: string[]
  }>,
  total: number
}
```

**Implementation:** Wraps `getRecentPublishedPosts()` from `publishedPostStore.ts`; filter by platform/niche if provided.

### `list_niches`

List available account niches.

**Input:** None

**Output:**
```typescript
{
  success: boolean,
  niches: Array<{
    id: string,              // 'psychology-micro', 'history-flash', etc.
    displayName: string,     // 'Psychology Micro', 'History Flash'
    platforms: string[]      // ['instagram'] (Phase 1)
  }>
}
```

**Implementation:** Returns hardcoded 5 niches from `src/pipeline/rssSourceRegistry.ts` (psychology-micro, history-flash, legal-rights-az, study-hacks, ai-tools-daily). Phase 2 can load from dynamic niche config or multi-account session registry.

## Bot integration patterns

### Publisher bot workflow

```
1. Bot receives article/topic trigger
2. Bot generates manifest via AI (niche-appropriate templates)
3. Bot calls render_niche_voice(niche, manifest, format='mp4')
4. Bot calls publish_post(platform='instagram', mediaPaths, caption, niche)
5. Bot records permalink for growth tracking
```

### Growth analyst workflow

```
1. Analyst calls list_published_posts(days=7, niche='technology')
2. For each post, calls get_post_metrics(platform, permalink)
3. Analyst aggregates metrics (avg engagement, top performers, etc.)
4. Analyst generates growth report
```

### Niche-voice pipeline workflow

```
1. Pipeline calls list_niches() to discover available voices
2. For each niche:
   a. Generate niche-specific content manifest
   b. Call render_niche_voice(niche, manifest)
   c. Call publish_post(platform, mediaPaths, caption, niche)
3. Pipeline tracks publish results for quality scoring
```

## MCP server implementation

- **Transport:** stdio (standard MCP)
- **Location:** `src/mcp/server.ts`
- **Start script:** `npm run mcp:serve` or `node dist/mcp/server.js`
- **Tools registry:** `src/mcp/tools/` (one file per tool)
- **Shared adapters:** `src/mcp/adapters/{instagram,tiktok,youtube}.ts`

## Platform adapter interface

Each platform adapter implements:

```typescript
interface PlatformAdapter {
  name: string;
  supportedFormats: ('square' | 'vertical')[];
  
  canPublish(): boolean;
  publish(post: PublishablePost, niche: string): Promise<PublishResult>;
  
  canFetchMetrics(): boolean;
  getMetrics(identifier: string): Promise<PostMetrics | null>;
  
  listPosts(opts: ListOptions): Promise<PostSummary[]>;
}
```

**Phase 1:** Only `InstagramAdapter` returns `canPublish() = true` and `canFetchMetrics() = true`.

**Phase 2:** TikTok/YouTube adapters implement full publish + metrics flows after 9:16 template work.

## Auth and session model

### Phase 1 (current)
- Instagram: Single account session in `storage.json`
- Session validation on startup via `validateInstagramSessionExpiry()`
- No per-niche session isolation

### Phase 2 (planned)
- Per-niche session loading: `storage_{niche}.json` or secure credential store
- Session rotation for multi-account publishing
- OAuth flow for YouTube API
- TikTok session cookie management

**Security:** Never log session tokens, cookies, or credentials. Never return secrets in MCP tool responses.

## Metrics contract for growth analyst

Growth analyst bots should expect:

- **Completion rate:** Derived from `views` vs `holds3s` (TikTok/Shorts Phase 2)
- **Engagement rate:** `(likes + comments + saves) / views`
- **Follower attribution:** `follows` from post (requires profile scrape Phase 2)
- **Profile visits:** `profileVisits` from post insights (Instagram API Phase 2)

**Phase 1 limitations:**
- Instagram metrics read from `published_posts` table (recorded at publish time)
- No live scraping yet (metrics are point-in-time snapshots)
- TikTok/Shorts metrics return `notImplemented: true`

**Phase 2 enhancements:**
- Live Instagram scraping via Playwright (avoid Graph API rate limits)
- TikTok Analytics API integration for holds3s, traffic source
- YouTube Analytics API for watch time, CTR

## Niche-voice manifest flow

**Bot → MCP:** Bot constructs `CarouselManifest`:

```typescript
{
  globalBranding: {
    accentColor: '#ef4444',  // Niche-specific brand color
    handle: '@tech_insights',
    effects: ['vignette', 'chromatic']
  },
  carousel: [
    { templateId: 'HOOK_A', data: { headline: '...', subheadline: '...', imageUrl: '...' } },
    { templateId: 'CONTENT_GENERIC', data: { title: '...', body: '...', highlight: '...' } },
    { templateId: 'CTA_FINAL', data: { callToAction: '...?', subtext: '...' } }
  ]
}
```

**MCP → Render:** Delegates to existing `POST /api/render` with validation.

**Render → Bot:** Returns `renderUrls` (public HTTP paths) and `mediaPaths` (local filesystem).

**Bot → Publish:** Uses `mediaPaths` to avoid re-downloading from public URLs.

## Format constraints

| Format | Dimensions | Current support | Required for |
|--------|------------|-----------------|--------------|
| Square | 1080×1080 | ✅ All templates | Instagram carousel/feed |
| Vertical | 1080×1920 (9:16) | ❌ No templates yet | TikTok, Shorts, Reels |

**Phase 1:** MCP accepts render requests but Instagram is the only functional publish path. TikTok/Shorts requests return stable `notImplemented` errors.

**Phase 2:** Add 9:16 templates (`HOOK_A_VERTICAL`, etc.) and wire TikTok/YouTube automation.

## Error handling

All MCP tools return structured errors:

```typescript
{
  success: false,
  error: "Human-readable message",
  errorCode?: "NOT_IMPLEMENTED" | "INVALID_NICHE" | "SESSION_EXPIRED" | "RENDER_FAILED" | "PUBLISH_FAILED",
  notImplemented?: boolean,  // For platform stubs
  details?: Record<string, unknown>
}
```

**Stable error codes:**
- `NOT_IMPLEMENTED`: Platform automation not yet built (TikTok/Shorts Phase 1)
- `INVALID_NICHE`: Niche not in allowed list
- `SESSION_EXPIRED`: Platform session file invalid or expired
- `RENDER_FAILED`: Remotion bundler/renderer error
- `PUBLISH_FAILED`: Playwright automation error

## Deployment notes

- MCP server runs as stdio process (invoked by MCP host like Claude Desktop or n8n)
- Same `DATABASE_URL`, `RENDER_DIR`, `storage.json` dependencies as main Express server
- Can run alongside HTTP server on same machine or separate container
- Render outputs shared via filesystem (`RENDER_DIR`) or object storage (Phase 2)

## Cross-references

- Render pipeline: [api-server.md](./api-server.md)
- Template contracts: [templates.md](./templates.md)
- Instagram publisher: `src/automation/instagramPublisher.ts`
- Metrics store: `src/pipeline/publishedPostStore.ts`, `src/pipeline/publishedPostMetrics.ts`
- Niche config: `src/pipeline/rssSourceRegistry.ts`, `src/pipeline/accountProfile.ts`
