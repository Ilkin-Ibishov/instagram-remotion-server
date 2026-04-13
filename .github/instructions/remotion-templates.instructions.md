---
description: Guidelines for creating and modifying Remotion templates in src/templates/
applyTo: "src/templates/**/*.tsx"
---

# Remotion Template Development

When creating or modifying templates in `src/templates/`, follow these guidelines to ensure consistency, rendering stability, and performance.

## Core Requirements

### Canvas & Resolution
- **Fixed Size**: All templates must be designed for **1080×1080** pixels
- **Output Formats**: Templates render to PNG (single frame) or MP4 (video sequence)

### Props Structure
Templates receive exactly two props:
```typescript
interface TemplateProps {
  data: Record<string, any>;           // Template-specific data
  branding: {
    accentColor: string;               // Hex color (e.g., "#FF5733")
    handle: string;                    // Instagram handle (e.g., "@techjournal")
    effects: string[];                 // Visual effects to apply
  };
}
```

### Template Registration
When adding a **new template**:
1. Create file: `src/templates/MyTemplate.tsx`
2. Export default React component
3. **Register in `src/remotion/SlideComposition.tsx`**:
   ```typescript
   case 'MY_TEMPLATE':
     return <MyTemplate data={templateData} branding={branding} />;
   ```
Without registration, the template won't be discoverable by the render pipeline.

## Styling Guidelines

### Preferred Approach: Tailwind CSS v4
```tsx
export const MyTemplate = ({ data, branding }) => (
  <div className="flex flex-col items-center justify-center w-full h-full bg-gradient-to-br from-blue-900 to-blue-700">
    {/* content */}
  </div>
);
```

### Alternative: Inline Styles
```tsx
<div style={{
  display: 'flex',
  flexDirection: 'column',
  width: '1080px',
  height: '1080px',
  backgroundColor: branding.accentColor,
}}>
  {/* content */}
</div>
```

**Avoid raw CSS files or CSS-in-JS libraries** — keep styles co-located and minimal.

## Icons & Assets

### Lucide React
Import icons individually to minimize bundle bloat:
```tsx
import { TrendingUp, Share2, Heart } from 'lucide-react';

export const MyTemplate = ({ data, branding }) => (
  <>
    <TrendingUp size={48} color={branding.accentColor} />
    <Share2 size={24} />
  </>
);
```

**Do NOT** use:
- External icon services (e.g., Font Awesome CDN)
- Large icon libraries imported as namespaces
- Custom SVG files (use Lucide instead)

### Images
- **No external requests** during render (Remotion doesn't support network I/O)
- If images are needed, pass them as:
  - Base64-encoded strings in `data.imageUrl`
  - Pre-downloaded URLs from n8n workflow
  - Fallback placeholder if image is optional

Example:
```tsx
<img 
  src={data.imageUrl || 'data:image/png;base64,...'} 
  alt="slide" 
  style={{ width: '100%', height: 'auto' }}
/>
```

## Performance Best Practices

### Avoid Expensive Calculations
Remotion renders every frame. If using video sequences:
- Memoize calculations with `useMemo()`
- Use Remotion's `interpolate()` for frame-based animations
- Avoid `fetch()`, `setTimeout()`, or async operations

Example (good):
```tsx
import { interpolate, useCurrentFrame } from 'remotion';

const frame = useCurrentFrame();
const opacity = interpolate(frame, [0, 30], [0, 1]);

return <div style={{ opacity }}>Fading in...</div>;
```

Example (bad):
```tsx
const [data, setData] = useState(null);
useEffect(() => {
  fetch('/api/data').then(setData); // ❌ Don't do this
}, []);
```

### Component Tree Depth
- Keep nesting **shallow** (max 3-4 levels for most templates)
- Avoid rendering hundreds of child elements
- Use `display: none` or conditional rendering to hide expensive subtrees

## MP4 Thumbnail Safety

- Assume Instagram grid previews may display frame 0 as the thumbnail.
- Do not start all key foreground elements at `opacity: 0` on frame 0.
- Keep frame 0 readable: show a baseline title/card/video frame and avoid a fully black opening state.
- Entrance animation is still encouraged, but use non-zero baseline opacity and smaller initial offsets for text/cards.

## Template Lifecycle

### Slide Composition Route
When a carousel request arrives with `templateId: 'HOOK_A'`:
1. `SlideComposition.tsx` routes to the correct template component
2. Template receives `data` and `branding` props
3. Template renders in inline styles or Tailwind
4. Remotion captures frame(s) as PNG or MP4
5. Output files stored to `/tmp/renders/`

## Example Reference Implementation
See existing templates for reference:
- `HookA.tsx` — Hook/headline slide
- `ContentListicle.tsx` — Bulleted list slide
- `ContentGeneric.tsx` — Generic body content
- `CtaFinal.tsx` — Call-to-action slide

## Common Gotchas

| Issue | Solution |
|-------|----------|
| Template doesn't render | Forgot to register in `SlideComposition.tsx` |
| Build fails with "module not found" | Icon import issue; use `from 'lucide-react'` |
| Render times out (>30s) | Component has expensive calculations or large DOM tree |
| Images don't appear | Using external URLs; pass as base64 or pre-downloaded |
| Text gets cut off | Forgot to set explicit width/height or overflow handling |
| Instagram grid tile looks black for MP4 | Frame 0 starts with black background and fully transparent foreground |

## Testing Templates

For isolated template testing:
```tsx
// In __tests__/components.test.ts
import { HookA } from '../src/templates/HookA';

it('renders without crashing', () => {
  const { container } = render(
    <HookA 
      data={{ headline: 'Test', subheadline: 'Test' }}
      branding={{ accentColor: '#FF5733', handle: '@test', effects: [] }}
    />
  );
  expect(container).toBeTruthy();
});
```

**Note**: Full Remotion render tests are separate; component tests here only verify React rendering.
