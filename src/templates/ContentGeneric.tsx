import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { getDesignTokens, getNicheFromBranding } from '../remotion/designTokens';

export default function ContentGeneric({
    data,
    branding,
}: {
    data: any;
    branding: any;
}) {
    const frame = useCurrentFrame();
    
    const niche = getNicheFromBranding(branding);
    const tokens = getDesignTokens(niche);

    const title = data.title || 'Details';
    const body = data.body || '';
    const highlight = typeof data.highlight === 'string' ? data.highlight : '';

    const transitionDur = tokens.motion.transitionDuration;
    
    const barScaleX = interpolate(frame, [0, transitionDur * 0.7], [0.4, 1], {
        extrapolateRight: 'clamp',
    });

    const titleY = interpolate(frame, [0, transitionDur], [10, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const titleOpacity = interpolate(frame, [0, transitionDur * 0.7], [0.7, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const dividerScaleX = interpolate(frame, [0, transitionDur * 0.8], [0.5, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const bodyY = interpolate(frame, [0, transitionDur * 1.2], [8, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const bodyOpacity = interpolate(frame, [0, transitionDur], [0.6, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const highlightX = interpolate(frame, [0, transitionDur * 0.9], [-8, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const highlightOpacity = interpolate(frame, [0, transitionDur * 0.8], [0.5, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const brandOpacity = interpolate(frame, [0, transitionDur], [0.4, 0.7], {
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
                position: 'relative',
                background: tokens.colors.backgroundGradient,
                overflow: 'hidden',
            }}
        >
            {/* Top accent bar */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: 6,
                    backgroundColor: tokens.colors.primary,
                    transformOrigin: 'left',
                    transform: `scaleX(${barScaleX})`,
                }}
            />

            {/* Main content in safe zone */}
            <div
                style={{
                    zIndex: 20,
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    paddingTop: tokens.safeZones.top,
                    paddingBottom: tokens.safeZones.bottom + tokens.spacing.xl,
                    paddingLeft: tokens.safeZones.sides,
                    paddingRight: tokens.safeZones.sides,
                }}
            >
                {/* Title */}
                <h2
                    style={{
                        fontSize: tokens.typography.titleSize,
                        fontWeight: tokens.typography.weight.black,
                        color: tokens.colors.text,
                        marginBottom: tokens.spacing.lg,
                        lineHeight: tokens.typography.lineHeight.tight,
                        fontFamily: "'Montserrat', sans-serif",
                        transform: `translateY(${titleY}px)`,
                        opacity: titleOpacity,
                        marginTop: 0,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                    }}
                >
                    {title}
                </h2>

                {/* Divider */}
                <div
                    style={{
                        width: 80,
                        height: 5,
                        marginBottom: tokens.spacing.xl,
                        backgroundColor: tokens.colors.primary,
                        transformOrigin: 'left',
                        transform: `scaleX(${dividerScaleX})`,
                    }}
                />

                {/* Body */}
                <p
                    style={{
                        fontSize: tokens.typography.bodySize - 2,
                        color: tokens.colors.textSecondary,
                        lineHeight: tokens.typography.lineHeight.normal,
                        fontWeight: tokens.typography.weight.medium,
                        margin: 0,
                        transform: `translateY(${bodyY}px)`,
                        opacity: bodyOpacity,
                        display: '-webkit-box',
                        WebkitLineClamp: 6,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                    }}
                >
                    {body}
                </p>

                {/* Highlight callout */}
                {highlight && (
                    <div
                        style={{
                            marginTop: tokens.spacing.lg,
                            padding: tokens.spacing.md,
                            borderLeft: `5px solid ${tokens.colors.primary}`,
                            backgroundColor: tokens.colors.surface,
                            borderRadius: 4,
                            transform: `translateX(${highlightX}px)`,
                            opacity: highlightOpacity,
                            overflow: 'hidden',
                        }}
                    >
                        <p
                            style={{
                                fontSize: tokens.typography.bodySize - 6,
                                fontWeight: tokens.typography.weight.bold,
                                fontStyle: 'italic',
                                color: tokens.colors.text,
                                margin: 0,
                                lineHeight: tokens.typography.lineHeight.normal,
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                            }}
                        >
                            {highlight}
                        </p>
                    </div>
                )}
            </div>

            {/* Brand handle in bottom safe zone */}
            <div
                style={{
                    position: 'absolute',
                    bottom: tokens.safeZones.bottom,
                    right: tokens.safeZones.sides,
                    zIndex: 20,
                    opacity: brandOpacity,
                }}
            >
                <span
                    style={{
                        fontSize: tokens.typography.captionSize,
                        fontWeight: tokens.typography.weight.bold,
                        letterSpacing: '0.05em',
                        color: tokens.colors.text,
                    }}
                >
                    {branding.handle}
                </span>
            </div>
        </div>
    );
}
