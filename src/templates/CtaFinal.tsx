import React from 'react';
import { useCurrentFrame, interpolate, spring } from 'remotion';
import { Bookmark, Heart, MessageCircle, Send } from 'lucide-react';

export default function CtaFinal({
    data,
    branding,
}: {
    data: any;
    branding: any;
}) {
    const frame = useCurrentFrame();
    const fps = 30;

    const callToAction = data.callToAction || 'Follow for More';
    const subtext = data.subtext || '';

    // Keep frame 0 readable while retaining entrance motion.
    const iconFrame = Math.max(0, frame - 6);
    const iconSpring = spring({
        frame: iconFrame,
        fps,
        config: { stiffness: 100, damping: 15 },
    });
    const iconScale = interpolate(iconSpring, [0, 1], [0.65, 1]);
    const iconRotate = interpolate(iconSpring, [0, 1], [-20, 0]);

    const ctaY = interpolate(frame, [0, 24], [8, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const ctaOpacity = interpolate(frame, [0, 24], [0.55, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const subY = interpolate(frame, [0, 24], [8, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const subOpacity = interpolate(frame, [0, 24], [0.4, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // Like/Comment/Share icons: staggered springs, delay 0.8s (24 frames), stagger 0.2s (6 frames)
    const icons = [
        { Icon: Heart, label: 'Like', delay: 24 },
        { Icon: MessageCircle, label: 'Comment', delay: 30 },
        { Icon: Send, label: 'Share', delay: 36 },
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
                padding: 64,
                position: 'relative',
                background: `radial-gradient(circle at 18% 16%, ${branding.accentColor}24 0%, transparent 45%), #0a0f16`,
                overflow: 'hidden',
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
                {/* Spinning bookmark icon */}
                <div
                    style={{
                        width: 128,
                        height: 128,
                        borderRadius: '50%',
                        marginBottom: 48,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: branding.accentColor,
                        transform: `scale(${iconScale}) rotate(${iconRotate}deg)`,
                    }}
                >
                    <Bookmark style={{ color: 'black', width: 64, height: 64 }} />
                </div>

                {/* CTA headline */}
                <h2
                    style={{
                        fontSize: 72,
                        fontWeight: 900,
                        color: 'white',
                        marginBottom: 32,
                        lineHeight: 1.3,
                        fontFamily: "'Montserrat', sans-serif",
                        transform: `translateY(${ctaY}px)`,
                        opacity: ctaOpacity,
                    }}
                >
                    {callToAction}
                </h2>

                {/* Subtext */}
                <p
                    style={{
                        fontSize: 32,
                        color: '#9ca3af',
                        marginBottom: 72,
                        lineHeight: 1.5,
                        transform: `translateY(${subY}px)`,
                        opacity: subOpacity,
                    }}
                >
                    {subtext}
                </p>

                {/* Like / Comment / Share icons */}
                <div style={{ display: 'flex', gap: 48 }}>
                    {icons.map(({ Icon, label, delay }) => {
                        const iconFrame2 = Math.max(0, frame - delay);
                        const s = spring({
                            frame: iconFrame2,
                            fps,
                            config: { stiffness: 100, damping: 14 },
                        });
                        const y = interpolate(s, [0, 1], [10, 0]);
                        const opacity = interpolate(s, [0, 1], [0.35, 1]);
                        const scale = interpolate(s, [0, 1], [0.9, 1]);

                        return (
                            <div
                                key={label}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 16,
                                    transform: `translateY(${y}px) scale(${scale})`,
                                    opacity,
                                }}
                            >
                                <div
                                    style={{
                                        width: 96,
                                        height: 96,
                                        borderRadius: '50%',
                                        border: '4px solid rgba(255,255,255,0.2)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Icon style={{ color: 'white', width: 48, height: 48 }} />
                                </div>
                                <span
                                    style={{
                                        fontSize: 24,
                                        fontWeight: 700,
                                        color: 'white',
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
