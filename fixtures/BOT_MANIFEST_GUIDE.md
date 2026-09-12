# Bot Manifest Guide

This guide explains how to produce content manifests that bypass Gemini AI generation and feed directly into the Remotion render pipeline.

## Overview

**Problem:** The default pipeline uses Gemini API for content generation, which creates a dependency on external AI services.

**Solution:** Teammate bots (niche voice, trend scout) or Cursor/Grok agents can produce complete content manifests that are ready to render.

**Flow:**
```
Bot/Agent → Manifest JSON → Validation → Remotion Render → MP4/PNG → Instagram Publish
```

No Gemini API calls. No LLM dependency for content generation.

## Manifest Contract

A bot-produced manifest is a JSON file with this structure:

```typescript
{
  manifest: {
    format: "mp4" | "png",
    globalBranding: {
      accentColor: string,      // Hex color, e.g. "#3B82F6"
      handle: string,            // Instagram handle, e.g. "@technewsbot"
      effects: string[]          // Visual effects, e.g. ["scanlines", "chromatic"]
    },
    carousel: [                  // 3-5 slides
      {
        templateId: string,      // One of the template IDs below
        data: Record<string, any> // Template-specific data
      }
    ]
  },
  caption: string,               // Instagram caption (4-8 lines, use \n)
  hashtags: string              // Space-separated hashtags (3-30 tags)
}
```

## Template IDs and Data Schemas

### HOOK_A
Opening hook slide with optional background image.

```typescript
{
  templateId: "HOOK_A",
  data: {
    headline: string,           // Max 72 chars
    subheadline: string,        // Max 120 chars
    imageUrl?: string | null    // Optional background image URL
  }
}
```

### CONTENT_LISTICLE
Numbered list with exactly 4 items.

```typescript
{
  templateId: "CONTENT_LISTICLE",
  data: {
    title: string,              // Max 76 chars
    items: [string, string, string, string],  // Exactly 4 items, max 60 chars each
    footnote: string            // Max 84 chars
  }
}
```

### CONTENT_GENERIC
Title + body + highlight.

```typescript
{
  templateId: "CONTENT_GENERIC",
  data: {
    title: string,              // Max 76 chars
    body: string,               // Max 220 chars
    highlight: string           // Max 90 chars
  }
}
```

### CONTENT_STAT_SNAPSHOT
Data-focused slide with a metric.

```typescript
{
  templateId: "CONTENT_STAT_SNAPSHOT",
  data: {
    kicker: string,             // Max 36 chars
    stat: string,               // Max 24 chars (e.g. "40%", "2x")
    context: string,            // Max 120 chars
    takeaway: string            // Max 100 chars
  }
}
```

### CONTENT_MYTH_VS_FACT
Contrast slide that debunks a myth.

```typescript
{
  templateId: "CONTENT_MYTH_VS_FACT",
  data: {
    myth: string,               // Max 92 chars
    fact: string,               // Max 130 chars
    proof: string               // Max 96 chars
  }
}
```

### CONTENT_VIDEO
Video frame with title overlay.

```typescript
{
  templateId: "CONTENT_VIDEO",
  data: {
    title: string,              // Max 76 chars
    videoUrl?: string | null,   // Optional video URL
    imageUrl?: string | null,   // Optional image URL (fallback if no video)
    caption?: string,           // Optional, max 120 chars
    source?: string             // Optional, max 70 chars
  }
}
```

### CTA_FINAL
Closing call-to-action slide.

```typescript
{
  templateId: "CTA_FINAL",
  data: {
    callToAction: string,       // Max 100 chars, must end with "?"
    subtext: string             // Max 84 chars
  }
}
```

## Quality Gates

Bot manifests are validated against the same quality gates as Gemini-generated content:

1. **Slide count:** 3-5 slides
2. **Slide data:** All slides must have populated data
3. **Template variety:** At least 3 distinct template IDs
4. **Caption:** 40-2200 chars, 4-8 lines
5. **Hashtags:** 3-30 unique Instagram-safe tags

**Minimum quality score:** 4/5

## How to Use

### Option 1: CLI Script

```bash
npm run bot:render fixtures/bot-manifest-example.json
```

Or with a custom manifest:

```bash
npm run bot:render path/to/your-manifest.json
```

### Option 2: HTTP API

**Endpoint:** `POST /api/bot-render`

**Headers:**
- `Content-Type: application/json`

**Request body:**
```json
{
  "manifest": {
    "format": "mp4",
    "globalBranding": { ... },
    "carousel": [ ... ]
  },
  "caption": "...",
  "hashtags": "...",
  "sourceArticle": {           // Optional
    "title": "...",
    "url": "...",
    "description": "...",
    "source": "...",
    "publishedAt": "..."
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "batchId": "a1b2c3d4",
  "images": [
    "/api/renders/render-a1b2c3d4-0.mp4",
    "/api/renders/render-a1b2c3d4-1.mp4",
    ...
  ],
  "caption": "...",
  "hashtags": "...",
  "sourceArticle": { ... }
}
```

**Response (400):**
```json
{
  "error": "Bot manifest validation failed",
  "details": [
    "caption must be between 40 and 2200 characters",
    "hashtags must contain 3-30 unique tags"
  ]
}
```

### Option 3: Programmatic

```typescript
import { processBotIntake } from './src/pipeline/botManifestService';
import { renderManifest, validateRenderManifest } from './src/render/renderService';
import type { BotIntakePayload } from './src/pipeline/botManifestTypes';

const payload: BotIntakePayload = {
  manifest: { ... },
  sourceArticle: { ... }
};

const intake = processBotIntake(payload);
if (!intake.valid || !intake.content) {
  throw new Error(`Validation failed: ${intake.errors.join(', ')}`);
}

const renderInput = {
  globalBranding: intake.content.manifest.globalBranding,
  carousel: intake.content.manifest.carousel,
  format: 'mp4' as const,
};

const validation = validateRenderManifest(renderInput);
if (validation.error || !validation.normalized) {
  throw new Error(`Render validation failed: ${validation.error}`);
}

const result = await renderManifest(validation.normalized);
console.log('Rendered:', result.images);
```

## Example Manifest

See `fixtures/bot-manifest-example.json` for a complete working example.

## Pipeline Integration

To wire bot manifests into the scheduled pipeline:

1. **Replace `generateContent()` call** in `src/pipelineRun.ts` with bot manifest intake
2. **Set environment variable** `USE_BOT_MANIFESTS=true`
3. **Configure bot endpoint** via `BOT_MANIFEST_API_URL` or similar

Example integration point (in `pipelineRun.ts`):

```typescript
// Current (Gemini):
const aiData = await generateContent(article, accountProfile, signal);

// New (bot intake):
if (process.env.USE_BOT_MANIFESTS === 'true') {
  const botManifest = await fetchBotManifest(article); // Your bot API call
  const intake = processBotIntake({ manifest: botManifest });
  if (!intake.valid || !intake.content) {
    throw new Error('Bot manifest validation failed');
  }
  aiData = intake.content;
} else {
  aiData = await generateContent(article, accountProfile, signal);
}
```

## Testing

1. **Validate manifest structure:**
   ```bash
   npm run bot:render fixtures/bot-manifest-example.json
   ```

2. **Test HTTP endpoint:**
   ```bash
   curl -X POST http://localhost:3000/api/bot-render \
     -H "Content-Type: application/json" \
     -d @fixtures/bot-manifest-example.json
   ```

3. **Verify render output:**
   ```bash
   ls -lh /tmp/renders/
   ```

## Troubleshooting

### "Bot manifest validation failed"
- Check that all required fields are present
- Verify character limits for each template
- Ensure caption has 4-8 lines
- Ensure hashtags have 3-30 unique tags

### "Render validation failed"
- Check that templateId values are valid
- Verify slide data matches template schema
- Ensure globalBranding has accentColor and handle

### "Quality score below minimum"
- Use at least 3 distinct template IDs
- Ensure all slides have meaningful data
- Keep carousel length between 3-5 slides

## JSON Schema

For automated validation, use the schema in `src/pipeline/botManifestTypes.ts`:

```typescript
import { BOT_MANIFEST_JSON_SCHEMA } from './src/pipeline/botManifestTypes';
```

## Further Reading

- Template documentation: `context/templates.md`
- API documentation: `context/api-server.md`
- Remotion composition: `context/remotion.md`
