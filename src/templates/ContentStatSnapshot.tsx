import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { lineClamp, singleLineEllipsis } from './textOverflow';
import { getDesignTokens, getNicheFromBranding } from '../remotion/designTokens';

export default function ContentStatSnapshot({
    data,
    branding,
}: {
    data: any;
    branding: any;
}) {
    const frame = useCurrentFrame();
    
    const niche = getNicheFromBranding(branding);
    const tokens = getDesignTokens(niche);

    const kicker = data.kicker || 'Key Signal';
    const stat = data.stat || '0%';
    const context = data.context || '';
    const takeaway = data.takeaway || '';

    const transitionDur = tokens.motion.transitionDuration;

    const cardOpacity = interpolate(frame, [0, transitionDur * 0.8], [0.7, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const statScale = interpolate(frame, [transitionDur * 0.4, transitionDur * 1.2], [0.94, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const textOpacity = interpolate(frame, [0, transitionDur], [0.6, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    return (
        <div
            style={{
                width: 1080,
                height: 1080,
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: tokens.colors.backgroundGradient,
                padding: tokens.safeZones.sides,
            }}
        >
            <div
                style={{
                    width: '100%',
                    maxWidth: 1080 - tokens.safeZones.sides * 2,
                    borderRadius: 24,
                    border: `3px solid ${tokens.colors.primary}`,
                    backgroundColor: tokens.colors.surface,
                    backdropFilter: 'blur(8px)',
                    padding: `${tokens.spacing.xl}px ${tokens.spacing.xl}px`,
                    opacity: cardOpacity,
                    zIndex: 10,
                }}
            >
                <p
                    style={{
                        margin: 0,
                        color: tokens.colors.textSecondary,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        fontWeight: tokens.typography.weight.bold,
                        fontSize: tokens.typography.captionSize,
                        ...singleLineEllipsis('100%'),
                    }}
                >
                    {kicker}
                </p>

                <h2
                    style={{
                        margin: `${tokens.spacing.md}px 0 ${tokens.spacing.sm}px`,
                        fontFamily: "'Montserrat', sans-serif",
                        fontSize: 130,
                        lineHeight: 1,
                        color: tokens.colors.primary,
                        transform: `scale(${statScale})`,
                        transformOrigin: 'left center',
                        fontWeight: tokens.typography.weight.black,
                        ...singleLineEllipsis('100%'),
                    }}
                >
                    {stat}
                </h2>

                <p
                    style={{
                        margin: 0,
                        fontSize: tokens.typography.bodySize + 2,
                        lineHeight: tokens.typography.lineHeight.normal,
                        color: tokens.colors.text,
                        fontWeight: tokens.typography.weight.semibold,
                        opacity: textOpacity,
                        ...lineClamp(3),
                    }}
                >
                    {context}
                </p>

                <p
                    style={{
                        margin: `${tokens.spacing.lg}px 0 0`,
                        fontSize: tokens.typography.bodySize - 4,
                        lineHeight: tokens.typography.lineHeight.normal,
                        color: tokens.colors.textSecondary,
                        fontWeight: tokens.typography.weight.medium,
                        opacity: textOpacity,
                        ...lineClamp(3),
                    }}
                >
                    {takeaway}
                </p>
            </div>

            <div
                style={{
                    position: 'absolute',
                    bottom: tokens.safeZones.bottom,
                    right: tokens.safeZones.sides,
                    color: tokens.colors.textSecondary,
                    fontSize: tokens.typography.captionSize - 2,
                    fontWeight: tokens.typography.weight.bold,
                    letterSpacing: '0.05em',
                    opacity: interpolate(frame, [0, transitionDur], [0.4, 0.8], {
                        extrapolateLeft: 'clamp',
                        extrapolateRight: 'clamp',
                    }),
                    ...singleLineEllipsis(340),
                }}
            >
                {branding.handle}
            </div>
        </div>
    );
}
