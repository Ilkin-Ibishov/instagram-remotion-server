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

    // Bookmark icon: spring scale 0→1, rotate -180→0, delay 0.2s (6 frames)
    const iconFrame = Math.max(0, frame - 6);
    const iconSpring = spring({
        frame: iconFrame,
        fps,
        config: { stiffness: 100, damping: 15 },
    });
    const iconScale = interpolate(iconSpring, [0, 1], [0, 1]);
    const iconRotate = interpolate(iconSpring, [0, 1], [-180, 0]);

    // CTA headline: y 20→0, opacity 0→1, delay 0.4s (12 frames), duration 0.6s (18 frames)
    const ctaY = interpolate(frame, [12, 30], [20, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const ctaOpacity = interpolate(frame, [12, 30], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // Subtext: y 20→0, opacity 0→1, delay 0.6s (18 frames), duration 0.6s (18 frames)
    const subY = interpolate(frame, [18, 36], [20, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const subOpacity = interpolate(frame, [18, 36], [0, 1], {
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
                background: '#050505',
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
                        marginBottom: 24,
                        fontFamily: "'Montserrat', sans-serif",
                        transform: `translateY(${ctaY}px)`,
                        opacity: ctaOpacity,
                    }}
                >
                    {data.callToAction}
                </h2>

                {/* Subtext */}
                <p
                    style={{
                        fontSize: 28,
                        color: '#9ca3af',
                        marginBottom: 64,
                        transform: `translateY(${subY}px)`,
                        opacity: subOpacity,
                    }}
                >
                    {data.subtext}
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
                        const y = interpolate(s, [0, 1], [20, 0]);
                        const opacity = interpolate(s, [0, 1], [0, 1]);
                        const scale = interpolate(s, [0, 1], [0.8, 1]);

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
