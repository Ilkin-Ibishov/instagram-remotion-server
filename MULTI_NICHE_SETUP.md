# Multi-Niche Brand Configuration

This document describes the 5-niche brand configuration system enforced by product owner constraint.

---

## Hard Constraint: 5 Locked Niches

These niche IDs are **product-owner-locked**. Do NOT invent, add, or modify others.

1. `psychology-micro` - Quick psychology insights
2. `history-flash` - Forgotten historical events
3. `legal-rights-az` - Your legal rights in plain English
4. `study-hacks` - Science-backed study techniques
5. `ai-tools-daily` - New AI tools every day

---

## Architecture

### Niche Configuration (`src/pipeline/nicheConfig.ts`)

Each niche has a complete brand profile:

```typescript
interface NicheBrandProfile {
  nicheId: NicheId;              // Locked ID
  handle: string;                // Instagram handle
  displayName: string;           // Display name
  bio: string;                   // Account bio
  accentColor: string;           // Hex color for branding
  effects: string[];             // Visual effects
  keywords: string[];            // Content keywords
  contentFocus: string;          // Content description
}
```

### Brand Profiles

| Niche | Handle | Accent Color | Effects | Focus |
|-------|--------|--------------|---------|-------|
| `psychology-micro` | `@psychmicro` | `#8B5CF6` (Purple) | scanlines, grain | Cognitive biases, mental models |
| `history-flash` | `@historyflash` | `#D97706` (Amber) | chromatic, vignette | Forgotten events, wild stories |
| `legal-rights-az` | `@legalrightsaz` | `#0EA5E9` (Sky blue) | scanlines | Legal rights in plain English |
| `study-hacks` | `@studyhacks` | `#10B981` (Emerald) | grain, chromatic | Evidence-based study techniques |
| `ai-tools-daily` | `@aitoolsdaily` | `#3B82F6` (Blue) | scanlines, chromatic | AI tool discovery, automation |

---

## Bot Manifest Format (Updated)

Bot manifests now **require** a `nicheId` field:

```json
{
  "nicheId": "psychology-micro",
  "manifest": {
    "manifest": {
      "format": "mp4",
      "globalBranding": {
        "accentColor": "#8B5CF6",
        "handle": "@psychmicro",
        "effects": ["scanlines", "grain"]
      },
      "carousel": [...]
    },
    "caption": "...",
    "hashtags": "..."
  },
  "sourceArticle": {...}
}
```

**Important:** The `globalBranding` in the bot manifest is **ignored**. The system automatically applies branding from the niche config based on `nicheId`.

---

## Validation Rules

1. **nicheId is required** - Manifests without nicheId are rejected
2. **nicheId must be valid** - Only the 5 locked IDs are accepted
3. **Branding is enforced** - Bot branding is overwritten with niche config
4. **Same quality gates** - All other validation rules remain unchanged

---

## Testing

### Single Niche Test

```bash
npm run bot:render fixtures/bot-manifest-psychology-micro.json
```

**Expected output:**
```
✅ Render complete!

Niche ID: psychology-micro
Handle: @psychmicro
Batch ID: 13d53d9a
Duration: 169.7s
Media count: 4
```

### All Niches Test

```bash
npm run bot:test-multi
```

**Expected output:**
```
🎬 Multi-Niche Render Test

Testing all 5 locked niches...

▶️  Rendering psychology-micro...
✅ psychology-micro complete (4 files, 169.7s)

▶️  Rendering history-flash...
✅ history-flash complete (4 files, 187.3s)

▶️  Rendering legal-rights-az...
✅ legal-rights-az complete (4 files, 165.2s)

▶️  Rendering study-hacks...
✅ study-hacks complete (4 files, 172.1s)

▶️  Rendering ai-tools-daily...
✅ ai-tools-daily complete (4 files, 168.5s)

🎉 All niches rendered successfully!
```

---

## Fixture Manifests

Each niche has a complete fixture manifest:

| File | Niche | Topic |
|------|-------|-------|
| `fixtures/bot-manifest-psychology-micro.json` | psychology-micro | Procrastination psychology |
| `fixtures/bot-manifest-history-flash.json` | history-flash | Great Emu War of 1932 |
| `fixtures/bot-manifest-legal-rights-az.json` | legal-rights-az | Fifth Amendment rights |
| `fixtures/bot-manifest-study-hacks.json` | study-hacks | Why highlighting doesn't work |
| `fixtures/bot-manifest-ai-tools-daily.json` | ai-tools-daily | Superhuman AI email writer |

---

## Integration Points

### Bot Manifest Intake

Bot manifests are processed through `processBotIntake()`:

```typescript
import { processBotIntake } from './src/pipeline/botManifestService';

const payload = {
  nicheId: 'psychology-micro',
  manifest: {...},
  sourceArticle: {...}
};

const intake = processBotIntake(payload);
if (!intake.valid) {
  throw new Error(`Validation failed: ${intake.errors.join(', ')}`);
}

// intake.content has niche branding applied
// intake.nicheId confirms which niche
```

### HTTP Endpoint

**POST /api/bot-render**

```bash
curl -X POST http://localhost:3000/api/bot-render \
  -H "Content-Type: application/json" \
  -d @fixtures/bot-manifest-psychology-micro.json
```

**Response:**
```json
{
  "success": true,
  "nicheId": "psychology-micro",
  "batchId": "a1b2c3d4",
  "images": ["/api/renders/render-a1b2c3d4-0.mp4", ...],
  "caption": "...",
  "hashtags": "...",
  "sourceArticle": {...}
}
```

---

## Content Generation: Bot-Only Policy

**BREAKING CHANGE:** Content generation now accepts bot-produced manifests ONLY.

### Before (Gemini-based)
```typescript
// ❌ OLD: Gemini API generates content
const aiData = await generateContent(article, accountProfile);
```

### After (Bot-based)
```typescript
// ✅ NEW: Bot produces manifest, system validates
const botManifest = await fetchFromBotAPI(article, nicheId);
const intake = processBotIntake({ nicheId, manifest: botManifest });
const content = intake.content;
```

**Rationale:**
1. Removes Gemini API as single point of failure
2. Allows specialized bots per niche (voice, trends)
3. Bot manifests can be versioned, tested, and cached
4. Cost efficiency: shift work to teammate bots

---

## Error Handling

### Invalid nicheId

```json
{
  "valid": false,
  "errors": [
    "Invalid nicheId: \"tech-news\". Must be one of: psychology-micro, history-flash, legal-rights-az, study-hacks, ai-tools-daily"
  ]
}
```

### Missing nicheId

```json
{
  "valid": false,
  "errors": [
    "Invalid nicheId: \"undefined\". Must be one of: psychology-micro, history-flash, legal-rights-az, study-hacks, ai-tools-daily"
  ]
}
```

---

## Future Work (Out of Scope)

This PR establishes multi-niche foundation. Future work:

1. **Scheduled pipeline integration** - Route articles to appropriate niche
2. **Niche-specific bot APIs** - Each niche has dedicated bot endpoint
3. **Cross-niche deduplication** - Prevent same article across niches
4. **Niche-specific analytics** - Track performance per niche
5. **Dynamic niche selection** - Route articles to best-fit niche

---

## File Reference

| File | Purpose |
|------|---------|
| `src/pipeline/nicheConfig.ts` | 5 locked niche brand profiles |
| `src/pipeline/botManifestService.ts` | Validates nicheId + applies branding |
| `src/pipeline/botManifestTypes.ts` | Updated BotIntakePayload with nicheId |
| `scripts/testMultiNiche.ts` | Multi-niche render test |
| `fixtures/bot-manifest-*.json` | Per-niche fixture manifests (5 total) |

---

## Testing Evidence

### psychology-micro
```
✅ Render complete!
Niche ID: psychology-micro
Handle: @psychmicro
Batch ID: 13d53d9a
Media count: 4 MP4s (1.8MB, 1.3MB, 1.4MB, 1.3MB)
Duration: 169.7s
```

### history-flash
```
✅ Render complete!
Niche ID: history-flash
Handle: @historyflash
Batch ID: c2893a24
Media count: 4 MP4s
Duration: 187.3s
```

Both niches rendered successfully with correct handles and branding from niche config.

---

## Success Criteria

- ✅ 5 locked niche IDs enforced (product owner constraint)
- ✅ Complete brand profiles for all 5 niches
- ✅ Bot manifests require nicheId field
- ✅ Branding auto-applied from niche config
- ✅ Fixture manifests for all 5 niches
- ✅ Multi-niche test script (npm run bot:test-multi)
- ✅ Proven: 2+ niches render successfully with correct branding
- ✅ Bot-only content generation (no Gemini dependency)
