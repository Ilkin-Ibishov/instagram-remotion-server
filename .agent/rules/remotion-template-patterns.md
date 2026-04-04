---
description: Patterns for creating and modifying Remotion templates in src/templates/
globs: "src/templates/*.tsx"
---

# Remotion Template Patterns

When creating or modifying templates in `src/templates/`, follow these guidelines to ensure consistency and rendering stability.

## Core Requirements

1. **Resolution**: All templates must be designed for a **1080x1080** canvas.
2. **Props Structure**: Templates receive `data` and `branding` props.
   - `branding`: `{ accentColor: string; handle: string; effects: string[]; }`
   - `data`: Template-specific data object.
3. **Styling**: Use **Tailwind CSS v4** or inline styles. Prefer Tailwind for layout and standard components.
4. **Icons**: Use **Lucide React** for all icons. Ensure they are imported individually to keep the bundle size small.

## Best Practices

- **No External Requests**: Avoid fetching data or images from external URLs during the render phase. If images are needed, they should be passed as base64 or pre-downloaded URLs in `data`.
- **Performance**: Keep the component tree relatively shallow. Remotion renders every frame, so expensive calculations should be memoized or avoided if they don't change per frame.
- **Registration**: When adding a new template, don't forget to register it in `src/remotion/SlideComposition.tsx`.

## Example Reference
- See existing templates in `src/templates/` (e.g., `HookA.tsx`) for reference implementations.
