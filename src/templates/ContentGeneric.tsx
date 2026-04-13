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

    // Keep a visible baseline on frame 0 for reliable Instagram thumbnails.
    const barScaleX = interpolate(frame, [0, 24], [0.25, 1], {
        extrapolateRight: 'clamp',
    });

    const titleY = interpolate(frame, [0, 24], [12, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const titleOpacity = interpolate(frame, [0, 24], [0.55, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const dividerScaleX = interpolate(frame, [0, 24], [0.35, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const bodyY = interpolate(frame, [0, 30], [8, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const bodyOpacity = interpolate(frame, [0, 30], [0.42, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const highlightX = interpolate(frame, [0, 24], [-8, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const highlightOpacity = interpolate(frame, [0, 24], [0.4, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const brandOpacity = interpolate(frame, [0, 30], [0.3, 0.5], {
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
                background: `radial-gradient(circle at 15% 20%, ${branding.accentColor}22 0%, transparent 42%), #0f1217`,
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
