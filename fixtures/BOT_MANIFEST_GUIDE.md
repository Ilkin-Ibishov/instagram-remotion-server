# Bot Manifest Guide

## Overview

The bot manifest schema is the target format for all automated content bots in this repository. It wraps a Remotion render request with Instagram metadata (caption, hashtags) and niche-specific branding.

## Schema

### Top-level structure

```json
{
  "nicheId": "psychology-micro",
  "manifest": {
    "manifest": {
      "format": "mp4",
      "globalBranding": { ... },
      "carousel": [ ... ]
    },
    "caption": "...",
    "hashtags": "#tag1 #tag2"
  }
}
```

### Fields

#### `nicheId` (string, required)

The niche identifier. Must match one of the locked niches:
- `psychology-micro`
- `history-flash`
- `legal-rights-az`
- `study-hacks`
- `ai-tools-daily`

#### `manifest.manifest` (object, required)

The Remotion render configuration.

##### `format` (string, required)

Output format. Must be `"mp4"`.

##### `globalBranding` (object, required)

Branding applied to all slides:
- `accentColor` (string): Hex color (e.g. `"#ef4444"`)
- `handle` (string): Instagram handle (e.g. `"@psych.bites"`)
- `effects` (array): Effect names (e.g. `["grain", "vignette"]`)

##### `carousel` (array, required)

Array of slide objects. Each slide has:
- `templateId` (string): Template identifier (see [templates.md](../context/templates.md))
- `data` (object): Template-specific data

**Supported templateIds:**
- `HOOK_A`: Opening hook with headline/subheadline
- `CONTENT_GENERIC`: Title + body + optional highlight
- `CONTENT_LISTICLE`: Numbered list with footnote
- `CONTENT_STAT_SNAPSHOT`: Data-focused slide with stat
- `CONTENT_MYTH_VS_FACT`: Myth vs fact contrast slide
- `CONTENT_VIDEO`: Video embed with title
- `CTA_FINAL`: Closing call-to-action (callToAction must end with `?`)

See [templates.md](../context/templates.md) for required data fields per template.

#### `manifest.caption` (string, required)

Instagram caption text. Should be 4-8 lines (newline-separated).

#### `manifest.hashtags` (string, required)

Space-separated hashtags with `#` prefix (e.g. `"#psychology #shorts"`). Should contain 3-30 hashtags.

## Quality gates

The converter enforces these constraints:
1. **Carousel**: 3-5 slides
2. **Templates**: At least 3 distinct template types
3. **Caption**: 4-8 lines (padded or trimmed if needed)
4. **Hashtags**: 3-30 hashtags (padded or trimmed if needed)

## Example

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
        {
          "templateId": "HOOK_A",
          "data": {
            "headline": "MYTH",
            "subheadline": "If it's everywhere in my feed… it's happening to everyone.",
            "imageUrl": null
          }
        },
        {
          "templateId": "CONTENT_MYTH_VS_FACT",
          "data": {
            "myth": "If it's everywhere in my feed, it's happening to everyone.",
            "fact": "Repeat a vivid claim → it feels common. That's availability cascade.",
            "proof": "FACT · availability cascade"
          }
        },
        {
          "templateId": "CTA_FINAL",
          "data": {
            "callToAction": "Which myth next?",
            "subtext": "Comment the bias you catch yourself using."
          }
        }
      ]
    },
    "caption": "Myth: if it's all over my feed, it's happening to everyone.\n\nFact: that's an availability cascade.\n\nWhich bias should we bust next?",
    "hashtags": "#psychology #cognitivebias #mythvsfact"
  }
}
```

## Usage

### Converting from niche-voice format

Use the niche-voice adapter to convert from the content bot schema:

```bash
npm run bot:render-voice fixtures/niche-voice/psychology-micro.json
```

This will:
1. Convert the niche-voice manifest to bot intake format
2. Save the converted manifest to `fixtures/bot-manifests/`
3. Optionally render the video with `--render` flag

### Direct rendering

Use the `/api/render` endpoint with the bot manifest:

```bash
curl -X POST http://localhost:3000/api/render \
  -H "Content-Type: application/json" \
  -d @fixtures/bot-manifests/psychology-micro-converted.json
```

## See also

- [Niche Voice Adapter README](./NICHE_VOICE_ADAPTER.md)
- [Templates documentation](../context/templates.md)
- [API server documentation](../context/api-server.md)
