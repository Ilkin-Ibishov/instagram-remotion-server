---
description: Guidelines for modifying the content generation pipeline and AI integration
applyTo: "src/pipeline/**/*.ts"
---

# Content Generation Pipeline

The content generation pipeline transforms news articles into structured JSON manifests suitable for Remotion rendering. This guide covers the pipeline architecture, AI integration, and data flow.

## Pipeline Architecture

### High-Level Data Flow
```
News Article (from n8n → GNews API)
        ↓
    aiService.generatePostContentAI()
        ↓
    GeneratedContent (JSON manifest)
        ↓
    POST /api/render
        ↓
    Rendered Slides (PNG/MP4)
        ↓
    Instagram Publishing (n8n automation)
```

### Core Files

| File | Purpose |
|------|---------|
| `src/pipeline/aiService.ts` | Gemini 2.5 Flash integration |
| `src/pipeline/contentGenerator.ts` | Orchestrates AI generation |
| `src/pipeline/newsService.ts` | Fetches articles from GNews |
| `src/pipeline/types.ts` | TypeScript interfaces |
| `src/pipeline/config.ts` | Branding & pipeline config |
| `src/pipeline/testMock.ts` | Mock data for testing |

## AI Service: Gemini 2.5 Flash Integration

### Current Model
- **Model**: `gemini-2.5-flash` (latest as of April 2026)
- **Authentication**: `GEMINI_API_KEY` from `.env`
- **Response Format**: JSON (`responseMimeType: "application/json"`)
- **Cost**: Cost-effective for high-volume requests

### Prompt Design

The AI system prompt in `aiService.ts` contains:
1. **Role**: "Professional Social Media Strategist and Tech Journalist"
2. **Task**: Transform article into 4-slide carousel
3. **Constraints**: Specific template IDs and data shapes
4. **Branding**: Injected from `config.ts`

Example prompt structure:
```typescript
const prompt = `
  You are a professional Social Media Strategist...
  ARTICLE: ${article.title}, ${article.description}, ${article.content}
  CONSTRAINTS:
  1. Use template IDs: HOOK_A, CONTENT_LISTICLE, CONTENT_GENERIC, CTA_FINAL
  2. Slide 1 (HOOK_A): { headline, subheadline, imageUrl? }
  3. Slide 2 (CONTENT_LISTICLE): { title, items[], footnote }
  ...
`;
```

### Validation Strategy

The service currently uses a strict runtime validator after JSON parse (instead of SDK-level schema enforcement):

```typescript
function validateGeneratedContent(payload: unknown): GeneratedContent {
  // validates:
  // - manifest/globalBranding structure
  // - exact 4-slide sequence: HOOK_A, CONTENT_LISTICLE, CONTENT_GENERIC, CTA_FINAL
  // - per-template data constraints
  // - non-empty caption and hashtags
}
```

**Why this strategy?**
- `manifest` → Direct payload for `/api/render`
- `caption` + `hashtags` → For Instagram post caption
- Runtime validation prevents invalid responses and provides precise error messages

## Content Generator

### Main Function: `generatePostContent()`

```typescript
export async function generatePostContent(article: NewsArticle) {
  // 1. Validate article
  // 2. Call Gemini via aiService.generatePostContentAI()
  // 3. Return manifest + metadata
  return {
    manifest: generatedContent.manifest,
    caption: generatedContent.caption,
    hashtags: generatedContent.hashtags,
  };
}
```

### Data Contracts

**Input: NewsArticle**
```typescript
interface NewsArticle {
  id: string;
  title: string;
  description: string;
  content: string;
  source: string;
  imageUrl?: string;
  publishedAt?: string;
  url?: string;
}
```

**Output: GeneratedContent**
```typescript
interface GeneratedContent {
  manifest: {
    format: 'png' | 'mp4';
    globalBranding: { accentColor, handle, effects };
    carousel: SlideData[];
  };
  caption: string;
  hashtags: string;
}
```

## Configuration

### Branding Config (`src/pipeline/config.ts`)

```typescript
export const config = {
  renderFormat: 'mp4',
  brandAccentColor: accountProfile.accentColor,
  brandHandle: accountProfile.handle,
  brandEffects: accountProfile.effects,
  accountProfile,
};
```

**When modifying:**
- Update `brandAccentColor` to change slide color scheme
- Update `brandHandle` for multi-account setups
- Add/remove effects based on template support
- Keep `accountProfile` fields aligned with `.env` and `accountProfile.ts`

## Testing the Pipeline

### Mock Data
Use `testMock.ts` for rapid development:

```typescript
import { mockArticle } from '../pipeline/testMock';

// In your test:
const content = await generatePostContent(mockArticle);
console.log(content.manifest);
```

### Integration Test
```typescript
import { generatePostContent } from '../pipeline/contentGenerator';

it('generates valid manifest from article', async () => {
  const article = {
    title: 'Breaking: Tech Innovation',
    description: 'New breakthrough in AI',
    content: 'Detailed story...',
    source: 'TechNews',
  };

  const content = await generatePostContent(article);

  expect(content.manifest.carousel.length).toBe(4);
  expect(content.caption).toBeTruthy();
  expect(content.hashtags).toBeTruthy();
});
```

### Debugging AI Responses

If Gemini returns invalid JSON:

```typescript
try {
  const result = await model.generateContent(prompt);
  const response = await result.response;
  console.log('Raw JSON:', response.text()); // Log before parsing
  const json = JSON.parse(response.text());
} catch (error) {
  console.error('Parse Error:', error);
  console.error('Raw Response:', response.text());
}
```

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Invalid template ID in response | Prompt not clear | Add template list to prompt |
| Missing image URL on Slide 1 | Article has no image | Fallback to placeholder in config |
| Hashtags too long | Gemini generating excessive tags | Add character limit to prompt |
| Branding colors ignored | Config not injected into prompt | Verify `brandConfig` import |
| API quota exceeded | Too many requests to Gemini | Check rate limits; add backoff |

## Rate Limiting & Caching

For production deployments:
```typescript
// Simple rate limiting (1 request per second per article)
const requestCache = new Map<string, Promise<GeneratedContent>>();

export async function generatePostContent(article: NewsArticle) {
  if (requestCache.has(article.id)) {
    return await requestCache.get(article.id)!;
  }

  const promise = generatePostContentAI(article);
  requestCache.set(article.id, promise);

  setTimeout(() => requestCache.delete(article.id), 60000); // 1 min TTL

  return await promise;
}
```

## Updating the Gemini Model

If migrating to a newer Gemini version:

1. **Update model name** in `src/pipeline/aiService.ts`:
   ```typescript
   const model = genAI.getGenerativeModel({
     model: "gemini-2.6-flash",  // or newer
   });
   ```

2. **Test schema compatibility** — Verify the schema syntax works with the new model
3. **Update documentation** — Note version change in `context/lesson-learned.md`
4. **Run full test suite** — Ensure prompts still generate valid responses

## Pipeline Extensibility

### Adding a New Generation Stage

Example: Adding image generation via Gemini:

```typescript
export async function generateSlideImages(carousel: SlideData[]) {
  const imageModel = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-image", // Image model
  });

  return carousel.map(async (slide) => ({
    ...slide,
    generatedImage: await imageModel.generateContent(
      `Generate an image for: ${slide.title}`
    ),
  }));
}
```

Then integrate into the main flow:
```typescript
export async function generatePostContent(article: NewsArticle) {
  const content = await generatePostContentAI(article);
  // const withImages = await generateSlideImages(content.carousel);
  return content;
}
```

## Monitoring & Logging

```typescript
export async function generatePostContent(article: NewsArticle) {
  const startTime = Date.now();

  try {
    const content = await generatePostContentAI(article);
    const duration = Date.now() - startTime;
    
    console.log(`✓ Generated content in ${duration}ms`, {
      articleId: article.id,
      slides: content.manifest.carousel.length,
    });

    return content;
  } catch (error) {
    console.error('✗ Generation failed', {
      articleId: article.id,
      error: error.message,
    });
    throw error;
  }
}
```

## References
- `context/api-server.md` — How generated manifests map to `/api/render` payloads
- `.github/instructions/remotion-templates.instructions.md` — Slide template specifications
- `.env` — Gemini API key configuration
