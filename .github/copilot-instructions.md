# VS Code Copilot Instructions

This project is **instagram-content-generator-remotion**: A Node.js rendering service that transforms news articles into Instagram carousel videos (4-slide format) using Remotion 4 and AI-generated content.

## Tech Stack
- **Runtime**: Node.js (ES modules), `tsx` for dev
- **Server**: Express.js with Remotion 4 rendering pipeline
- **UI**: React 18, Tailwind CSS v4, Lucide React icons
- **Testing**: Vitest + Supertest
- **AI**: Gemini 2.5 Flash API for content generation

## Project Structure
| Path | Purpose |
|------|---------|
| `server.ts` | Express app, rendering pipeline, bundle cache |
| `src/remotion/` | Remotion composition & slide routing |
| `src/templates/` | React components for each slide type (1080×1080) |
| `src/pipeline/` | Content generation & data orchestration |
| `src/automation/` | n8n integration, Instagram publishing |
| `__tests__/` | API & integration tests |
| `context/` | Documentation & contracts (source of truth) |

## Key Principles

### 1. **Grounding Before Doing**
- Read `context/README.md` first to understand the project contracts
- Use `context/` files as source of truth for API shapes, data flows, and architecture
- Don't assume; verify the contract before implementation

### 2. **Maintenance After Changes**
- Update `context/*.md` files when changing implementation details
- Sync rules in `.agent/rules/*.md` when patterns change
- Add important corrections to `context/lesson-learned.md`

### 3. **Token Efficiency**
- Use targeted searches (`grep_search`, `file_search`) instead of `list_dir`
- Avoid reading entire folders unnecessarily
- Keep working memory focused on the current task

## Core API Contract

### POST `/api/render`
Renders Instagram carousel slides into images or video.

**Required Fields:**
- `globalBranding`: `{ accentColor, handle, effects: string[] }`
- `carousel`: Array of `{ templateId, data }`

**Optional Fields:**
- `format`: `'png'` (default) or `'mp4'`
- `webhookUrl`: For async rendering (returns 202, POSTs result to webhook)

**Response:**
- 202 (if webhook) or 200 with file URLs
- Files stored at `/tmp/renders/render-{batchId}-{index}.{ext}`

## Rendering Pipeline
1. **Validation**: Check `globalBranding` & `carousel`
2. **Bundle**: Cache Remotion bundle via `ensureBundle()`
3. **Per-Slide Render**: 
   - `renderStill()` for PNG (1 frame)
   - `renderMedia()` for MP4 (h264, concurrency 4)
4. **Output**: Return file URLs or webhook POST result

## Template Constraints
All templates in `src/templates/*.tsx` must follow:
- **Canvas**: 1080×1080 pixels
- **Props**: Receive `data` and `branding`
- **Styling**: Tailwind CSS v4 or inline styles
- **Icons**: Lucide React only (imported individually)
- **No external requests** (pre-fetch all images)
- **Performance**: Memoize expensive calculations, keep tree shallow

See `.github/instructions/remotion-templates.instructions.md` for examples.

## Testing Requirements
All new API parameters/endpoints **must** have tests.

**Rules:**
- Use Vitest + Supertest
- Never bind tests to production port 3000
- Mock heavy operations (`renderStill`, `renderMedia`) for routing tests
- Point `RENDER_DIR` to temp directory during test runs

See `.github/instructions/testing.instructions.md` for details.

## Important Files
- `context/overview.md` — High-level system design
- `context/api-server.md` — HTTP API reference
- `context/remotion.md` — Rendering architecture
- `context/lesson-learned.md` — Known gotchas & corrections
- `package.json` — Dependencies & scripts
- `.env` — Environment variables (Gemini API key, etc.)

## Quick Commands
```bash
npm install          # Install deps
npm run dev          # Start dev server (port 3000)
npm test             # Run tests
npm run build        # Bundle for production
npm run render:test  # Test a single render
```

## Workflow for New Features
1. **Read** the relevant contract file in `context/`
2. **Check** applicable instruction file in `.github/instructions/`
3. **Implement** the feature
4. **Test** with new test cases
5. **Update** `context/` or `.agent/rules/` if behavior changed
6. **Sync** findings to `context/lesson-learned.md` if important
