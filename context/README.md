# Agent context (modular)

This folder splits project knowledge by **concern** so agents can load only what they need. Start with [overview.md](./overview.md); use the index below for deeper work.

| Document | Use when |
|----------|----------|
| [overview.md](./overview.md) | First pass: purpose, layout, tech stack, key files |
| [api-server.md](./api-server.md) | Express, `/api/render`, bundling, static files, webhooks |
| [remotion.md](./remotion.md) | Composition `Slide`, studio preview, timing (fps/duration) |
| [templates.md](./templates.md) | `templateId` values, expected `data` shapes, adding slides |
| [effects.md](./effects.md) | `branding.effects`, overlay stack, z-index |
| [development.md](./development.md) | Scripts, tests, TypeScript, environment caveats |
| [lesson-learned.md](./lesson-learned.md) | Mistakes and corrections (append-only habit for agents) |

**Convention:** File names are stable; cross-link instead of duplicating long schemas in multiple places.
