# Instagram MCP Platform

Model Context Protocol (MCP) server for multi-platform content generation and publishing.

## Quick Start

```bash
# Start MCP server (stdio transport)
npm run mcp:serve

# Or use tsx directly
tsx src/mcp/server.ts
```

## MCP Server Configuration

The server is registered in `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "instagram-platform": {
      "command": "npm",
      "args": ["run", "mcp:serve"],
      "cwd": "/workspace"
    }
  }
}
```

## Available Tools

### `render_niche_voice`
Render niche-branded content via Remotion.

```typescript
{
  niche: 'technology' | 'business' | 'startup' | 'ai' | 'science',
  manifest: {
    globalBranding: { accentColor, handle, effects },
    carousel: [{ templateId, data }, ...]
  },
  format?: 'png' | 'mp4'  // default: mp4
}
```

### `publish_post`
Publish to Instagram/TikTok/YouTube Shorts (Instagram production-ready).

```typescript
{
  platform: 'instagram' | 'tiktok' | 'youtube_shorts',
  mediaPaths: ['/tmp/renders/render-abc123-0.mp4', ...],
  caption: 'Post caption with #hashtags',
  niche: 'technology'
}
```

### `get_post_metrics`
Fetch engagement metrics (Phase 1: returns not available).

```typescript
{
  platform: 'instagram' | 'tiktok' | 'youtube_shorts',
  permalink?: 'https://instagram.com/p/xyz',
  batchId?: 'abc123'
}
```

### `list_published_posts`
Query recent posts with filtering.

```typescript
{
  platform?: 'instagram',
  niche?: 'technology',
  limit?: 10,
  days?: 7
}
```

### `list_niches`
List available niches (no arguments).

```typescript
{}
```

## Platform Support

| Platform | Publish | Metrics | Status |
|----------|---------|---------|--------|
| Instagram | ✅ | ⚠️ Store only | Production |
| TikTok | ❌ | ❌ | Phase 2 (requires 9:16) |
| YouTube Shorts | ❌ | ❌ | Phase 2 (requires 9:16) |

## Architecture

```
MCP Server (stdio)
  ├── Platform Adapters
  │   ├── Instagram (production)
  │   ├── TikTok (stub)
  │   └── YouTube (stub)
  └── Tools
      ├── render_niche_voice → POST /api/render
      ├── publish_post → instagramPublisher.ts
      ├── get_post_metrics → publishedPostStore.ts
      ├── list_published_posts → publishedPostStore.ts
      └── list_niches → rssSourceRegistry.ts
```

## Testing with MCP Inspector

```bash
# Install MCP Inspector
npm i -g @modelcontextprotocol/inspector

# Run inspector
mcp-inspector npm run mcp:serve
```

## Environment Variables

Same as main server:

- `DATABASE_URL` — Postgres connection string
- `RENDER_DIR` — Render output directory (default: `/tmp/renders`)
- `RENDER_HOST` — Render server URL (default: `http://localhost:3000`)
- Instagram session: `storage.json` or `INSTAGRAM_SESSION_B64`

## Bot Integration Example

```typescript
// Publisher bot workflow
const niches = await mcp.call('list_niches');
// → { niches: [{ id: 'technology', displayName: 'Technology', platforms: ['instagram'] }] }

const renderResult = await mcp.call('render_niche_voice', {
  niche: 'technology',
  manifest: {
    globalBranding: { accentColor: '#ef4444', handle: '@tech_insights', effects: ['vignette'] },
    carousel: [
      { templateId: 'HOOK_A', data: { headline: 'Breaking Tech News', subheadline: 'AI reaches new milestone' } },
      { templateId: 'CTA_FINAL', data: { callToAction: 'What do you think?', subtext: 'Follow for more' } }
    ]
  }
});
// → { success: true, batchId: 'abc123', mediaPaths: [...] }

const publishResult = await mcp.call('publish_post', {
  platform: 'instagram',
  mediaPaths: renderResult.mediaPaths,
  caption: 'Breaking: AI reaches new milestone\n\n#technology #ai #tech',
  niche: 'technology'
});
// → { success: true, permalink: 'https://instagram.com/p/xyz', verificationMethod: 'profile_permalink' }
```

## Documentation

- [Platform Architecture](../../context/mcp-platform.md) — Full MCP platform design
- [Pipeline Map](../../PIPELINE_MAP.md) — End-to-end architecture diagram
- [Templates](../../context/templates.md) — Template contracts and data shapes

## Phase 2 Roadmap

- [ ] 9:16 vertical templates for TikTok/Shorts/Reels
- [ ] TikTok Playwright automation
- [ ] YouTube Data API v3 upload
- [ ] Live metrics scraping (Instagram Graph API or Playwright)
- [ ] Per-niche session management
