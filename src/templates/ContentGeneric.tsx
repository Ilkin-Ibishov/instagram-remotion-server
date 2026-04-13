import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

export default function ContentGeneric({
    data,
    branding,
}: {
    data: any;
    branding: any;
}) {
    const frame = useCurrentFrame();

    const title = data.title || 'Details';
    const body = data.body || '';
    const highlight = typeof data.highlight === 'string' ? data.highlight : '';

    // Top accent bar: scaleX 0→1, duration 0.8s (24 frames)
    const barScaleX = interpolate(frame, [0, 24], [0, 1], {
        extrapolateRight: 'clamp',
    });

    // Title: y 30→0, opacity 0→1, delay 0.2s (6 frames), duration 0.8s (24 frames)
    const titleY = interpolate(frame, [6, 30], [30, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const titleOpacity = interpolate(frame, [6, 30], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // Divider line: scaleX 0→1, delay 0.5s (15 frames), duration 0.6s (18 frames)
    const dividerScaleX = interpolate(frame, [15, 33], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // Body text: y 20→0, opacity 0→1, delay 0.7s (21 frames), duration 0.8s (24 frames)
    const bodyY = interpolate(frame, [21, 45], [20, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const bodyOpacity = interpolate(frame, [21, 45], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // Highlight: x -20→0, opacity 0→1, delay 1.2s (36 frames), duration 0.6s (18 frames)
    const highlightX = interpolate(frame, [36, 54], [-20, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const highlightOpacity = interpolate(frame, [36, 54], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // Brand handle: opacity 0→0.5, delay 1.5s (45 frames), duration 1s (30 frames)
    const brandOpacity = interpolate(frame, [45, 75], [0, 0.5], {
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
                padding: 80,
                position: 'relative',
                background: '#0f0f0f',
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
                    height: 8,
                    backgroundColor: branding.accentColor,
                    transformOrigin: 'left',
                    transform: `scaleX(${barScaleX})`,
                }}
            />

            {/* Main content */}
            <div
                style={{
                    zIndex: 20,
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    paddingBottom: 120,
                    width: '100%',
                    maxWidth: 920,
                }}
            >
                {/* Title */}
                <h2
                    style={{
                        fontSize: 64,
                        fontWeight: 900,
                        color: 'white',
                        marginBottom: 40,
                        lineHeight: 1.15,
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
                        width: 96,
                        height: 8,
                        marginBottom: 48,
                        backgroundColor: branding.accentColor,
                        transformOrigin: 'left',
                        transform: `scaleX(${dividerScaleX})`,
                    }}
                />

                {/* Body */}
                <p
                    style={{
                        fontSize: 34,
                        color: '#e5e7eb',
                        lineHeight: 1.5,
                        fontWeight: 500,
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

                {/* Highlight */}
                {highlight && (
                    <div
                        style={{
                            marginTop: 32,
                            padding: 24,
                            borderLeft: `6px solid ${branding.accentColor}`,
                            background: 'rgba(255,255,255,0.05)',
                            transform: `translateX(${highlightX}px)`,
                            opacity: highlightOpacity,
                            overflow: 'hidden',
                        }}
                    >
                        <p
                            style={{
                                fontSize: 28,
                                fontWeight: 700,
                                fontStyle: 'italic',
                                color: 'white',
                                margin: 0,
                                lineHeight: 1.35,
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

            {/* Brand handle */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 48,
                    right: 48,
                    zIndex: 20,
                    opacity: brandOpacity,
                }}
            >
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
