import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { lineClamp, singleLineClamp } from './textOverflow';
import { getDesignTokens, getNicheFromBranding } from '../remotion/designTokens';

/**
 * CONTENT_LISTICLE — designed for medium-length text with numbered items.
 *
 * Expected data shape:
 *  {
 *    title: string;
 *    items: string[];           // 3–5 bullet points
 *    footnote?: string;         // optional bottom note
 *  }
 */
export default function ContentListicle({
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

    const transitionDur = tokens.motion.transitionDuration;
    const staggerDelay = tokens.motion.staggerDelay;

    const titleY = interpolate(frame, [0, transitionDur], [10, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const titleOpacity = interpolate(frame, [0, transitionDur * 0.7], [0.7, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const lineScaleX = interpolate(frame, [0, transitionDur * 0.7], [0.5, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const title = data.title || 'Key Points';
    const items: string[] = Array.isArray(data.items) ? data.items : [];

    const footnoteDelay = transitionDur + items.length * staggerDelay + 8;
    const footnoteOpacity = interpolate(
        frame,
        [footnoteDelay, footnoteDelay + 15],
        [0.3, 0.7],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    return (
        <div
            style={{
                width: 1080,
                height: 1080,
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                background: tokens.colors.backgroundGradient,
                overflow: 'hidden',
            }}
        >
            {/* Left accent stripe */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: 5,
                    height: '100%',
                    backgroundColor: tokens.colors.primary,
                }}
            />

            {/* Content in safe zone */}
            <div
                style={{
                    paddingTop: tokens.safeZones.top,
                    paddingBottom: tokens.safeZones.bottom,
                    paddingLeft: tokens.safeZones.sides,
                    paddingRight: tokens.safeZones.sides,
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                }}
            >
                {/* Title */}
                <h2
                    style={{
                        fontSize: tokens.typography.titleSize,
                        fontWeight: tokens.typography.weight.black,
                        color: tokens.colors.text,
                        lineHeight: tokens.typography.lineHeight.tight,
                        marginBottom: tokens.spacing.md,
                        fontFamily: "'Montserrat', sans-serif",
                        transform: `translateY(${titleY}px)`,
                        opacity: titleOpacity,
                        marginTop: 0,
                        ...lineClamp(2, 1080 - tokens.safeZones.sides * 2),
                    }}
                >
                    {title}
                </h2>

                {/* Accent line */}
                <div
                    style={{
                        width: 72,
                        height: 4,
                        marginBottom: tokens.spacing.xl,
                        backgroundColor: tokens.colors.primary,
                        transformOrigin: 'left',
                        transform: `scaleX(${lineScaleX})`,
                    }}
                />

                {/* Numbered items */}
                <div
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        gap: tokens.spacing.md,
                    }}
                >
                    {items.length === 0 ? (
                        <p
                            style={{
                                fontSize: tokens.typography.bodySize - 6,
                                color: tokens.colors.accent,
                                lineHeight: tokens.typography.lineHeight.normal,
                                fontWeight: tokens.typography.weight.bold,
                                margin: 0,
                            }}
                        >
                            No list items provided
                        </p>
                    ) : items.map((item: string, index: number) => {
                        const itemDelay = transitionDur * 0.7 + index * staggerDelay;
                        const s = spring({
                            frame: Math.max(0, frame - itemDelay),
                            fps,
                            config: tokens.motion.easing.config,
                        });
                        const itemX = interpolate(s, [0, 1], [-10, 0]);
                        const itemOpacity = interpolate(s, [0, 1], [0.5, 1]);

                        return (
                            <div
                                key={index}
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: tokens.spacing.md,
                                    transform: `translateX(${itemX}px)`,
                                    opacity: itemOpacity,
                                }}
                            >
                                {/* Number badge */}
                                <div
                                    style={{
                                        minWidth: 44,
                                        height: 44,
                                        borderRadius: 8,
                                        backgroundColor: tokens.colors.primary,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: tokens.typography.captionSize,
                                        fontWeight: tokens.typography.weight.black,
                                        color: tokens.colors.background,
                                        fontFamily: "'Montserrat', sans-serif",
                                    }}
                                >
                                    {index + 1}
                                </div>
                                {/* Item text */}
                                <p
                                    style={{
                                        fontSize: tokens.typography.bodySize - 2,
                                        color: tokens.colors.textSecondary,
                                        lineHeight: tokens.typography.lineHeight.normal,
                                        fontWeight: tokens.typography.weight.medium,
                                        margin: 0,
                                        paddingTop: 4,
                                        flex: 1,
                                        minWidth: 0,
                                        ...lineClamp(3, 1080 - tokens.safeZones.sides * 2 - 68),
                                    }}
                                >
                                    {item}
                                </p>
                            </div>
                        );
                    })}
                </div>

                {/* Footnote */}
                {data.footnote && (
                    <p
                        style={{
                            fontSize: tokens.typography.captionSize - 2,
                            color: tokens.colors.textSecondary,
                            fontStyle: 'italic',
                            marginTop: tokens.spacing.md,
                            opacity: footnoteOpacity,
                            ...lineClamp(2, 1080 - tokens.safeZones.sides * 2),
                        }}
                    >
                        {data.footnote}
                    </p>
                )}
            </div>

            {/* Brand handle in safe zone */}
            <div
                style={{
                    position: 'absolute',
                    bottom: tokens.safeZones.bottom - tokens.spacing.md,
                    right: tokens.safeZones.sides,
                    opacity: interpolate(frame, [0, transitionDur], [0.4, 0.7], {
                        extrapolateLeft: 'clamp',
                        extrapolateRight: 'clamp',
                    }),
                }}
            >
                <span
                    style={{
                        fontSize: tokens.typography.captionSize - 2,
                        fontWeight: tokens.typography.weight.bold,
                        letterSpacing: '0.05em',
                        color: tokens.colors.text,
                        ...singleLineClamp(320),
                    }}
                >
                    {branding.handle}
                </span>
            </div>
        </div>
    );
}
