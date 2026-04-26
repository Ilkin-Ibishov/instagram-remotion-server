import React from 'react';
import { useCurrentFrame, interpolate, Img, useVideoConfig } from 'remotion';
import { Zap } from 'lucide-react';

export default function HookA({
    data,
    branding,
}: {
    data: any;
    branding: any;
}) {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const headline = data.headline || 'Breaking News';
    const subheadline = data.subheadline || '';

    // Background image: keep a visible base at frame 0 for non-black poster frames.
    const imgScale = interpolate(frame, [0, 2 * fps], [1.1, 1], {
        extrapolateRight: 'clamp',
    });
    const imgOpacity = interpolate(frame, [0, 2 * fps], [0.15, 0.4], {
        extrapolateRight: 'clamp',
    });

    // Keep core content visible from frame 0 while preserving motion.
    const badgeY = interpolate(frame, [0, 18], [-8, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const badgeOpacity = interpolate(frame, [0, 18], [0.45, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const headlineY = interpolate(frame, [0, 24], [12, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const headlineOpacity = interpolate(frame, [0, 24], [0.55, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const subY = interpolate(frame, [0, 30], [8, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const subOpacity = interpolate(frame, [0, 30], [0.45, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const brandX = interpolate(frame, [0, 24], [-10, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const brandOpacity = interpolate(frame, [0, 24], [0.35, 1], {
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
                background: `radial-gradient(circle at 15% 20%, ${branding.accentColor}2e 0%, transparent 45%), #0a0f16`,
                overflow: 'hidden',
            }}
        >
            {/* Gradient overlay */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.65))',
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
                        lineHeight: 1.3,
                        letterSpacing: '-0.02em',
                        marginBottom: 40,
                        fontFamily: "'Montserrat', sans-serif",
                        transform: `translateY(${headlineY}px)`,
                        opacity: headlineOpacity,
                    }}
                >
                    {headline}
                </h1>

                {/* Subheadline */}
                <p
                    style={{
                        fontSize: 38,
                        color: '#d1d5db',
                        fontWeight: 600,
                        maxWidth: 900,
                        lineHeight: 1.6,
                        margin: 0,
                        transform: `translateY(${subY}px)`,
                        opacity: subOpacity,
                    }}
                >
                    {subheadline}
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
