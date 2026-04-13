import React from 'react';

const CRT_STYLE: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 50,
    mixBlendMode: 'overlay',
    opacity: 0.3,
    background:
        'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
    backgroundSize: '100% 4px, 6px 100%',
};

const NOISE_STYLE: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 40,
    opacity: 0.05,
    backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
};

const VIGNETTE_STYLE: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 45,
    background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.7) 100%)',
};

const CHROMATIC_CONTAINER_STYLE: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 48,
    opacity: 0.12,
};

const CHROMATIC_RED_STYLE: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(135deg, rgba(255, 0, 0, 0.4) 0%, transparent 50%)',
    transform: 'translate(-3px, 0)',
    mixBlendMode: 'screen',
};

const CHROMATIC_BLUE_STYLE: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(315deg, rgba(0, 80, 255, 0.4) 0%, transparent 50%)',
    transform: 'translate(3px, 0)',
    mixBlendMode: 'screen',
};

const HALFTONE_STYLE: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 42,
    opacity: 0.08,
    mixBlendMode: 'multiply',
    backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg width='8' height='8' viewBox='0 0 8 8' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='4' cy='4' r='1.5' fill='white'/%3E%3C/svg%3E\")",
    backgroundSize: '8px 8px',
};

/**
 * Visual effects overlay applied on top of slide content.
 *
 * Supported effects:
 *  - "crt"        — Retro CRT scanlines with RGB color fringing
 *  - "noise"      — Subtle film grain texture
 *  - "vignette"   — Dark edges, bright center (cinematic)
 *  - "chromatic"  — RGB channel split / color aberration glow
 *  - "halftone"   — Dot-matrix print newspaper effect
 */
export function EffectsOverlay({ effects }: { effects?: string[] }) {
    if (!effects || effects.length === 0) return null;

    return (
        <>
            {/* CRT Scanlines */}
            {effects.includes('crt') && (
                <div style={CRT_STYLE} />
            )}

            {/* Film Grain Noise */}
            {effects.includes('noise') && (
                <div style={NOISE_STYLE} />
            )}

            {/* Vignette — dark edges, bright center */}
            {effects.includes('vignette') && (
                <div style={VIGNETTE_STYLE} />
            )}

            {/* Chromatic Aberration — RGB channel split glow */}
            {effects.includes('chromatic') && (
                <div style={CHROMATIC_CONTAINER_STYLE}>
                    {/* Red channel — shifted left */}
                    <div style={CHROMATIC_RED_STYLE} />
                    {/* Blue channel — shifted right */}
                    <div style={CHROMATIC_BLUE_STYLE} />
                </div>
            )}

            {/* Halftone — dot-matrix newspaper print effect */}
            {effects.includes('halftone') && (
                <div style={HALFTONE_STYLE} />
            )}
        </>
    );
}
