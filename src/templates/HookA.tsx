import React from 'react';
import { useCurrentFrame, interpolate, Img, useVideoConfig } from 'remotion';
import { Zap } from 'lucide-react';
import { lineClamp, singleLineEllipsis } from './textOverflow';
import { getDesignTokens, getNicheFromBranding } from '../remotion/designTokens';

export default function HookA({
    data,
    branding,
}: {
    data: any;
    branding: any;
}) {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const niche = getNicheFromBranding(branding);
    const tokens = getDesignTokens(niche);

    const headline = data.headline || 'Breaking News';
    const subheadline = data.subheadline || '';

    // Niche-specific default background images
    const nicheBackgrounds: Record<string, string> = {
        'psychology-micro': 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=1080&q=80', // Brain/mind abstract
        'history-flash': 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=1080&q=80', // Ancient books/library
        'legal-rights-az': 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1080&q=80', // Justice/law books
        'study-hacks': 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1080&q=80', // Study desk/notes
        'ai-tools-daily': 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1080&q=80', // AI/tech abstract
    };

    const backgroundImage = data.imageUrl || nicheBackgrounds[niche] || nicheBackgrounds['psychology-micro'];

    // Faster, punchier motion for hook retention (<1s to full visibility)
    const hookDuration = tokens.motion.hookDuration;
    
    const imgScale = interpolate(frame, [0, hookDuration * 1.5], [1.05, 1], {
        extrapolateRight: 'clamp',
    });
    // More visible backgrounds: 0.45-0.6 opacity range
    const imgOpacity = interpolate(frame, [0, hookDuration], [0.45, 0.6], {
        extrapolateRight: 'clamp',
    });

    // Badge: instant at frame 0, subtle motion
    const badgeY = interpolate(frame, [0, hookDuration * 0.8], [-6, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const badgeOpacity = interpolate(frame, [0, hookDuration * 0.5], [0.7, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // Headline: readable immediately, gentle settle
    const headlineY = interpolate(frame, [0, hookDuration], [8, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const headlineOpacity = interpolate(frame, [0, hookDuration * 0.7], [0.75, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const subY = interpolate(frame, [0, hookDuration * 1.2], [6, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const subOpacity = interpolate(frame, [0, hookDuration], [0.6, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const brandOpacity = interpolate(frame, [0, hookDuration * 1.5], [0.5, 0.8], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    return (
        <div
            style={{
                width: 1080,
                height: 1080,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                alignItems: 'center',
                position: 'relative',
                background: tokens.colors.backgroundGradient,
                overflow: 'hidden',
            }}
        >
            {/* Background image with niche default */}
            <Img
                src={backgroundImage}
                style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    filter: `saturate(0.7) brightness(0.7)`, // Light desaturate, darker for contrast
                    transform: `scale(${imgScale})`,
                    opacity: imgOpacity,
                }}
            />

            {/* Niche-tinted overlay for color wash + strong scrim for text readability */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: `linear-gradient(to bottom, ${tokens.colors.primary}15 0%, ${tokens.colors.background}dd 70%)`,
                    zIndex: 10,
                }}
            />

            {/* Content - positioned in safe zone */}
            <div
                style={{
                    zIndex: 20,
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    paddingTop: tokens.safeZones.top + tokens.spacing.xl,
                    paddingLeft: tokens.safeZones.sides,
                    paddingRight: tokens.safeZones.sides,
                    maxWidth: 1080 - tokens.safeZones.sides * 2,
                }}
            >
                {/* Category badge - niche-specific color */}
                <div
                    style={{
                        paddingLeft: tokens.spacing.md,
                        paddingRight: tokens.spacing.md,
                        paddingTop: tokens.spacing.xs,
                        paddingBottom: tokens.spacing.xs,
                        marginBottom: tokens.spacing.lg,
                        borderWidth: 3,
                        borderStyle: 'solid',
                        borderColor: tokens.colors.primary,
                        backgroundColor: tokens.colors.surface,
                        color: tokens.colors.primary,
                        transform: `translateY(${badgeY}px)`,
                        opacity: badgeOpacity,
                        borderRadius: 4,
                    }}
                >
                    <h2
                        style={{
                            fontSize: tokens.typography.captionSize,
                            fontWeight: tokens.typography.weight.bold,
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            margin: 0,
                        }}
                    >
                        {data.badge || 'New'}
                    </h2>
                </div>

                {/* Headline - large, instantly readable */}
                <h1
                    style={{
                        fontSize: tokens.typography.hookSize,
                        fontWeight: tokens.typography.weight.black,
                        color: tokens.colors.text,
                        lineHeight: tokens.typography.lineHeight.tight,
                        letterSpacing: '-0.02em',
                        marginBottom: tokens.spacing.lg,
                        fontFamily: "'Montserrat', sans-serif",
                        transform: `translateY(${headlineY}px)`,
                        opacity: headlineOpacity,
                        textShadow: '0 2px 12px rgba(0,0,0,0.4)',
                        ...lineClamp(2),
                    }}
                >
                    {headline}
                </h1>

                {/* Subheadline - supporting context */}
                <p
                    style={{
                        fontSize: tokens.typography.bodySize,
                        color: tokens.colors.textSecondary,
                        fontWeight: tokens.typography.weight.semibold,
                        lineHeight: tokens.typography.lineHeight.normal,
                        margin: 0,
                        transform: `translateY(${subY}px)`,
                        opacity: subOpacity,
                        ...lineClamp(3),
                    }}
                >
                    {subheadline}
                </p>
            </div>

            {/* Brand handle - bottom safe zone */}
            <div
                style={{
                    position: 'absolute',
                    bottom: tokens.safeZones.bottom + tokens.spacing.sm,
                    left: tokens.safeZones.sides,
                    display: 'flex',
                    alignItems: 'center',
                    gap: tokens.spacing.sm,
                    zIndex: 20,
                    opacity: brandOpacity,
                }}
            >
                <div
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        backgroundColor: tokens.colors.primary,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Zap style={{ color: tokens.colors.background, width: 20, height: 20 }} />
                </div>
                <span
                    style={{
                        fontSize: tokens.typography.captionSize,
                        fontWeight: tokens.typography.weight.bold,
                        letterSpacing: '0.05em',
                        color: tokens.colors.text,
                        maxWidth: 460,
                        ...singleLineEllipsis,
                    }}
                >
                    {branding.handle}
                </span>
            </div>
        </div>
    );
}
