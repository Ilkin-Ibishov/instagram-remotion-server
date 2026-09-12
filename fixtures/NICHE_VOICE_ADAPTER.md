# Niche Voice Adapter

## Overview

The niche-voice adapter converts content from the **niche-voice** bot schema (faceless slideshow format) to the **bot intake** schema used by this Remotion rendering server.

## Problem

Content bots (like **niche-voice**) generate faceless slideshow manifests with their own schema:
- Slide roles: `MYTH`, `FACT`, `HOOK`, `WHY`, `CTA`, etc.
- Rich metadata: karaoke timing, visual palettes, voice tone
- Multi-platform captions: Instagram, TikTok, YouTube Shorts

The Remotion server expects a different schema:
- Template IDs: `HOOK_A`, `CONTENT_MYTH_VS_FACT`, `CTA_FINAL`, etc.
- Bot intake wrapper: `{ nicheId, manifest: { manifest, caption, hashtags } }`

## Solution

The adapter maps niche-voice slide roles to Remotion template IDs heuristically:

| Niche-voice role | Remotion template | Mapping logic |
|-----------------|-------------------|---------------|
| `MYTH`, `HOOK`, `STOP`, `SCENARIO`, `OUTCOME` | `HOOK_A` | Opening hooks → headline/subheadline |
| `FACT` (after `MYTH`) | `CONTENT_MYTH_VS_FACT` | Pair MYTH body + FACT body |
| `CTA`, `DISCLAIMER CTA`, `TRY TONIGHT` | `CTA_FINAL` | Closing CTA (ensure `?` suffix) |
| `PRINCIPLE_*`, `STEP_*`, `CHECK` | `CONTENT_LISTICLE` | List-style content → 4 items |
| `REVEAL`, `MAP DETAIL` | `CONTENT_STAT_SNAPSHOT` | Data-focused slides |
| `WHY`, `CONTEXT`, `EXAMPLE`, `BAD PROMPT`, `TEMPLATE` | `CONTENT_GENERIC` | Generic title + body |

### Quality gates

The converter enforces:
1. **Carousel**: 3-5 slides (merge/skip if needed)
2. **Templates**: At least 3 distinct template types
3. **Caption**: 4-8 lines (padded or trimmed)
4. **Hashtags**: 3-30 hashtags (padded or trimmed)

## Usage

### Convert only

```bash
npm run bot:render-voice fixtures/niche-voice/psychology-micro.json
```

Output: `fixtures/bot-manifests/psychology-micro-converted.json`

### Convert and render

```bash
npm run bot:render-voice -- fixtures/niche-voice/psychology-micro.json --render
```

Renders all slides to `tmp/renders/`:
- `psychology-micro-slide-1-HOOK_A.mp4`
- `psychology-micro-slide-2-CONTENT_GENERIC.mp4`
- `psychology-micro-slide-3-CONTENT_MYTH_VS_FACT.mp4`
- etc.

## Locked niches

Only these niches are supported:
- `psychology-micro` (red accent, `@psych.bites`, grain+vignette)
- `history-flash` (orange accent, `@history.flash`, grain)
- `legal-rights-az` (blue accent, `@rights.az`, vignette)
- `study-hacks` (purple accent, `@study.hacks`, grain+vignette)
- `ai-tools-daily` (cyan accent, `@ai.tools.daily`, grain)

Attempting to convert an unknown niche will throw an error.

## Niche-voice schema

See the source of truth from the niche-voice bot:

```typescript
{
  fps: number;
  aspectRatio: string;
  durationSec: number;
  format: "faceless-slideshow";
  generatedBy: string;
  date: string;
  niche: string;
  title: string;
  topic: string;
  voice: { tone, style, banned[] };
  slides: [{
    id, role, startSec, durationSec,
    headline, body, karaoke[],
    visual: { palette, motif, cutHint }
  }];
  captions: { instagram, tiktok, youtubeShorts, hashtags[] };
}
```

## Bot intake schema

See [BOT_MANIFEST_GUIDE.md](./BOT_MANIFEST_GUIDE.md) for the target schema.

## Implementation

- **Types**: `src/bot/types.ts`
- **Converter**: `src/bot/converter.ts`
- **Niche config**: `src/bot/nicheConfig.ts`
- **Tests**: `__tests__/bot/converter.test.ts`
- **CLI**: `scripts/botRenderVoice.ts`

## Testing

```bash
npm test -- __tests__/bot/converter.test.ts
```

All tests enforce quality gates and validate heuristic mappings.

## Integration with niche-voice

The **niche-voice** bot should continue shipping its own schema. This adapter lives in the Remotion server and handles conversion at render time.

**Workflow:**
1. Niche-voice bot generates JSON (one per pack)
2. Ship JSON to this server (file upload, webhook, or manual)
3. This server converts + renders via `npm run bot:render-voice`
4. Output: MP4 slides + Instagram metadata

## Example

Input: `fixtures/niche-voice/psychology-micro.json`

```json
{
  "niche": "psychology-micro",
  "slides": [
    { "role": "MYTH", "headline": "MYTH", "body": "If it's everywhere..." },
    { "role": "FACT", "headline": "FACT · availability cascade", "body": "Repeat a vivid claim..." },
    { "role": "CTA", "headline": "Which myth next?", "body": "Comment the bias..." }
  ],
  "captions": {
    "instagram": "Myth: if it's all over my feed...",
    "hashtags": ["psychology", "cognitivebias"]
  }
}
```

Output: `fixtures/bot-manifests/psychology-micro-converted.json`

```json
{
  "nicheId": "psychology-micro",
  "manifest": {
    "manifest": {
      "format": "mp4",
      "globalBranding": {
        "accentColor": "#ef4444",
        "handle": "@psych.bites",
        "effects": ["grain", "vignette"]
      },
      "carousel": [
        { "templateId": "HOOK_A", "data": { ... } },
        { "templateId": "CONTENT_MYTH_VS_FACT", "data": { ... } },
        { "templateId": "CTA_FINAL", "data": { ... } }
      ]
    },
    "caption": "...",
    "hashtags": "#psychology #cognitivebias"
  }
}
```

## Future work

- Support for dynamic niche registration (non-locked niches)
- Multi-file batch conversion (directory of JSON files)
- Webhook endpoint for direct niche-voice integration
- Template mapping customization per niche
