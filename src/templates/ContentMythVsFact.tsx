import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { lineClamp, singleLineEllipsis } from './textOverflow';
import { getDesignTokens, getNicheFromBranding } from '../remotion/designTokens';

export default function ContentMythVsFact({
    data,
    branding,
}: {
    data: any;
    branding: any;
}) {
    const frame = useCurrentFrame();
    
    const niche = getNicheFromBranding(branding);
    const tokens = getDesignTokens(niche);

    const myth = data.myth || 'Myth';
    const fact = data.fact || 'Fact';
    const proof = data.proof || '';

    const transitionDur = tokens.motion.transitionDuration;

    const leftX = interpolate(frame, [0, transitionDur * 0.8], [-12, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const rightX = interpolate(frame, [0, transitionDur * 0.8], [12, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const proofOpacity = interpolate(frame, [0, transitionDur], [0.5, 1], {
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
                background: tokens.colors.backgroundGradient,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: tokens.spacing.lg,
                paddingTop: tokens.safeZones.top,
                paddingBottom: tokens.safeZones.bottom + tokens.spacing.xl,
                paddingLeft: tokens.safeZones.sides,
                paddingRight: tokens.safeZones.sides,
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    top: tokens.safeZones.top - tokens.spacing.md,
                    left: tokens.safeZones.sides,
                    fontSize: tokens.typography.captionSize - 2,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: tokens.colors.textSecondary,
                    fontWeight: tokens.typography.weight.bold,
                }}
            >
                Myth vs Fact
            </div>

            <div
                style={{
                    borderRadius: 16,
                    border: `2px solid ${tokens.colors.border}`,
                    padding: `${tokens.spacing.md}px ${tokens.spacing.lg}px`,
                    backgroundColor: tokens.colors.surface,
                    transform: `translateX(${leftX}px)`,
                }}
            >
                <p
                    style={{
                        margin: 0,
                        color: tokens.colors.accent,
                        fontSize: tokens.typography.captionSize - 2,
                        textTransform: 'uppercase',
                        fontWeight: tokens.typography.weight.black,
                        letterSpacing: '0.08em',
                    }}
                >
                    Myth
                </p>
                <p
                    style={{
                        margin: `${tokens.spacing.sm}px 0 0`,
                        fontSize: tokens.typography.bodySize + 6,
                        lineHeight: tokens.typography.lineHeight.tight,
                        color: tokens.colors.text,
                        fontWeight: tokens.typography.weight.bold,
                        fontFamily: "'Montserrat', sans-serif",
                        ...lineClamp(3, '100%'),
                    }}
                >
                    {myth}
                </p>
            </div>

            <div
                style={{
                    borderRadius: 16,
                    border: `3px solid ${tokens.colors.primary}`,
                    padding: `${tokens.spacing.md}px ${tokens.spacing.lg}px`,
                    backgroundColor: tokens.colors.surface,
                    transform: `translateX(${rightX}px)`,
                }}
            >
                <p
                    style={{
                        margin: 0,
                        color: tokens.colors.primary,
                        fontSize: tokens.typography.captionSize - 2,
                        textTransform: 'uppercase',
                        fontWeight: tokens.typography.weight.black,
                        letterSpacing: '0.08em',
                    }}
                >
                    Fact
                </p>
                <p
                    style={{
                        margin: `${tokens.spacing.sm}px 0 0`,
                        fontSize: tokens.typography.bodySize + 6,
                        lineHeight: tokens.typography.lineHeight.tight,
                        color: tokens.colors.text,
                        fontWeight: tokens.typography.weight.bold,
                        fontFamily: "'Montserrat', sans-serif",
                        ...lineClamp(3, '100%'),
                    }}
                >
                    {fact}
                </p>
            </div>

            <p
                style={{
                    margin: `${tokens.spacing.sm}px 0 0`,
                    fontSize: tokens.typography.bodySize - 6,
                    lineHeight: tokens.typography.lineHeight.normal,
                    color: tokens.colors.textSecondary,
                    opacity: proofOpacity,
                    fontWeight: tokens.typography.weight.medium,
                    ...lineClamp(4, '100%'),
                }}
            >
                {proof}
            </p>

            <div
                style={{
                    position: 'absolute',
                    bottom: tokens.safeZones.bottom,
                    right: tokens.safeZones.sides,
                    color: tokens.colors.textSecondary,
                    fontSize: tokens.typography.captionSize - 2,
                    fontWeight: tokens.typography.weight.bold,
                    letterSpacing: '0.05em',
                    ...singleLineEllipsis(340),
                    opacity: interpolate(frame, [0, transitionDur], [0.4, 0.8], {
                        extrapolateLeft: 'clamp',
                        extrapolateRight: 'clamp',
                    }),
                }}
            >
                {branding.handle}
            </div>
        </div>
    );
}
