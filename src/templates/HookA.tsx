import React from 'react';
import { useCurrentFrame, interpolate, Img } from 'remotion';
import { Zap } from 'lucide-react';

export default function HookA({
    data,
    branding,
}: {
    data: any;
    branding: any;
}) {
    const frame = useCurrentFrame();
    const fps = 30;

    // Background image: scale 1.1→1, opacity 0→0.4 over 2s starting at frame 0
    const imgScale = interpolate(frame, [0, 2 * fps], [1.1, 1], {
        extrapolateRight: 'clamp',
    });
    const imgOpacity = interpolate(frame, [0, 2 * fps], [0, 0.4], {
        extrapolateRight: 'clamp',
    });

    // BREAKING badge: y -20→0, opacity 0→1, delay 0.2s (6 frames), duration 0.6s (18 frames)
    const badgeY = interpolate(frame, [6, 24], [-20, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const badgeOpacity = interpolate(frame, [6, 24], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // Headline: y 30→0, opacity 0→1, delay 0.4s (12 frames), duration 0.8s (24 frames)
    const headlineY = interpolate(frame, [12, 36], [30, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const headlineOpacity = interpolate(frame, [12, 36], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // Subheadline: y 20→0, opacity 0→1, delay 0.7s (21 frames), duration 0.8s (24 frames)
    const subY = interpolate(frame, [21, 45], [20, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const subOpacity = interpolate(frame, [21, 45], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // Brand handle: x -30→0, opacity 0→1, delay 1s (30 frames), duration 0.6s (18 frames)
    const brandX = interpolate(frame, [30, 48], [-30, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const brandOpacity = interpolate(frame, [30, 48], [0, 1], {
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
                justifyContent: 'center',
                alignItems: 'center',
                padding: 64,
                position: 'relative',
                background: '#0a0a0a',
                overflow: 'hidden',
            }}
        >
            {/* Gradient overlay */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.8))',
                    zIndex: 10,
                }}
            />

            {/* Background image */}
            {data.imageUrl && (
                <Img
                    src={data.imageUrl}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        filter: 'grayscale(100%)',
                        transform: `scale(${imgScale})`,
                        opacity: imgOpacity,
                    }}
                />
            )}

            {/* Content */}
            <div
                style={{
                    zIndex: 20,
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
            >
                {/* BREAKING badge */}
                <div
                    style={{
                        paddingLeft: 24,
                        paddingRight: 24,
                        paddingTop: 8,
                        paddingBottom: 8,
                        marginBottom: 32,
                        borderWidth: 2,
                        borderStyle: 'solid',
                        borderColor: branding.accentColor,
                        color: branding.accentColor,
                        transform: `translateY(${badgeY}px)`,
                        opacity: badgeOpacity,
                    }}
                >
                    <h2
                        style={{
                            fontSize: 24,
                            fontWeight: 700,
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            margin: 0,
                        }}
                    >
                        Breaking
                    </h2>
                </div>

                {/* Headline */}
                <h1
                    style={{
                        fontSize: 96,
                        fontWeight: 900,
                        color: 'white',
                        lineHeight: 1.1,
                        letterSpacing: '-0.02em',
                        marginBottom: 32,
                        fontFamily: "'Montserrat', sans-serif",
                        transform: `translateY(${headlineY}px)`,
                        opacity: headlineOpacity,
                    }}
                >
                    {data.headline}
                </h1>

                {/* Subheadline */}
                <p
                    style={{
                        fontSize: 36,
                        color: '#d1d5db',
                        fontWeight: 600,
                        maxWidth: 900,
                        lineHeight: 1.4,
                        margin: 0,
                        transform: `translateY(${subY}px)`,
                        opacity: subOpacity,
                    }}
                >
                    {data.subheadline}
                </p>
            </div>

            {/* Brand handle */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 48,
                    left: 48,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    zIndex: 20,
                    transform: `translateX(${brandX}px)`,
                    opacity: brandOpacity,
                }}
            >
                <div
                    style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        background: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Zap style={{ color: 'black', width: 24, height: 24 }} />
                </div>
                <span
                    style={{
                        fontSize: 24,
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        color: 'white',
                    }}
                >
                    {branding.handle}
                </span>
            </div>
        </div>
    );
}
