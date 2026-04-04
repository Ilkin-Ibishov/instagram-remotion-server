# Branding and visual effects

## `globalBranding` (request body)

Passed to every slide as **`branding`**:

| Field | Type | Usage |
|-------|------|--------|
| `accentColor` | string (CSS color) | Borders, badges, accents across templates |
| `handle` | string | Social handle text (e.g. `@account`) |
| `effects` | `string[]` | Keys for `EffectsOverlay` (see below) |

## `EffectsOverlay` (`src/components/EffectsOverlay.tsx`)

Rendered **above** template content, **`pointerEvents: 'none'`**, various **z-index** values (40–50).

Supported **`effects`** string tokens:

| Token | Effect |
|-------|--------|
| `crt` | Scanlines + RGB fringing (`mixBlendMode: overlay`) |
| `noise` | SVG turbulence grain |
| `vignette` | Radial darkening at edges |
| `chromatic` | Split RGB glow |
| `halftone` | Dot pattern (`multiply`) |

Unknown tokens are ignored (no error). Empty or missing array renders nothing.

## Layering

Template content sits in the normal flow; **`EffectsOverlay`** is a sibling inside `SlideComposition`’s relative wrapper — effects are **post**-composite overlays, not per-layer masks inside templates.
