import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { Bookmark, Heart, MessageCircle, Send } from 'lucide-react';
import { lineClamp } from './textOverflow';
import { getDesignTokens, getNicheFromBranding } from '../remotion/designTokens';

export default function CtaFinal({
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

    const callToAction = data.callToAction || 'Follow for More';
    const subtext = data.subtext || '';

    const transitionDur = tokens.motion.transitionDuration;
    const staggerDelay = tokens.motion.staggerDelay;

    const iconFrame = Math.max(0, frame - staggerDelay);
    const iconSpring = spring({
        frame: iconFrame,
        fps,
        config: tokens.motion.easing.config,
    });
    const iconScale = interpolate(iconSpring, [0, 1], [0.7, 1]);
    const iconRotate = interpolate(iconSpring, [0, 1], [-15, 0]);

    const ctaY = interpolate(frame, [0, transitionDur], [8, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const ctaOpacity = interpolate(frame, [0, transitionDur * 0.7], [0.7, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const subY = interpolate(frame, [0, transitionDur], [6, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const subOpacity = interpolate(frame, [0, transitionDur * 0.8], [0.5, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const icons = [
        { Icon: Heart, label: 'Like', delay: transitionDur },
        { Icon: MessageCircle, label: 'Comment', delay: transitionDur + staggerDelay },
        { Icon: Send, label: 'Share', delay: transitionDur + staggerDelay * 2 },
    ];

    return (
        <div
            style={{
                width: 1080,
                height: 1080,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                position: 'relative',
                background: tokens.colors.backgroundGradient,
                overflow: 'hidden',
                paddingTop: tokens.safeZones.top,
                paddingBottom: tokens.safeZones.bottom,
                paddingLeft: tokens.safeZones.sides,
                paddingRight: tokens.safeZones.sides,
            }}
        >
            <div
                style={{
                    zIndex: 20,
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
            >
                {/* Brand icon */}
                <div
                    style={{
                        width: 110,
                        height: 110,
                        borderRadius: '50%',
                        marginBottom: tokens.spacing.xl,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: tokens.colors.primary,
                        transform: `scale(${iconScale}) rotate(${iconRotate}deg)`,
                    }}
                >
                    <Bookmark style={{ color: tokens.colors.background, width: 56, height: 56 }} />
                </div>

                {/* CTA headline */}
                <h2
                    style={{
                        fontSize: tokens.typography.titleSize + 8,
                        fontWeight: tokens.typography.weight.black,
                        color: tokens.colors.text,
                        marginBottom: tokens.spacing.lg,
                        lineHeight: tokens.typography.lineHeight.tight,
                        fontFamily: "'Montserrat', sans-serif",
                        transform: `translateY(${ctaY}px)`,
                        opacity: ctaOpacity,
                        maxWidth: 1080 - tokens.safeZones.sides * 2,
                        ...lineClamp(2),
                    }}
                >
                    {callToAction}
                </h2>

                {/* Subtext */}
                <p
                    style={{
                        fontSize: tokens.typography.bodySize - 4,
                        color: tokens.colors.textSecondary,
                        marginBottom: tokens.spacing.xxl,
                        lineHeight: tokens.typography.lineHeight.normal,
                        transform: `translateY(${subY}px)`,
                        opacity: subOpacity,
                        maxWidth: 1080 - tokens.safeZones.sides * 2 - tokens.spacing.xl,
                        ...lineClamp(3),
                    }}
                >
                    {subtext}
                </p>

                {/* Social action icons */}
                <div style={{ display: 'flex', gap: tokens.spacing.xl }}>
                    {icons.map(({ Icon, label, delay }) => {
                        const iconFrame2 = Math.max(0, frame - delay);
                        const s = spring({
                            frame: iconFrame2,
                            fps,
                            config: tokens.motion.easing.config,
                        });
                        const y = interpolate(s, [0, 1], [8, 0]);
                        const opacity = interpolate(s, [0, 1], [0.45, 1]);
                        const scale = interpolate(s, [0, 1], [0.92, 1]);

                        return (
                            <div
                                key={label}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: tokens.spacing.sm,
                                    transform: `translateY(${y}px) scale(${scale})`,
                                    opacity,
                                }}
                            >
                                <div
                                    style={{
                                        width: 84,
                                        height: 84,
                                        borderRadius: '50%',
                                        border: `3px solid ${tokens.colors.border}`,
                                        backgroundColor: tokens.colors.surface,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Icon style={{ color: tokens.colors.text, width: 40, height: 40 }} />
                                </div>
                                <span
                                    style={{
                                        fontSize: tokens.typography.captionSize - 2,
                                        fontWeight: tokens.typography.weight.bold,
                                        color: tokens.colors.text,
                                    }}
                                >
                                    {label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
