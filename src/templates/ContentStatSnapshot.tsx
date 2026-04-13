import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';

export default function ContentStatSnapshot({
    data,
    branding,
}: {
    data: any;
    branding: any;
}) {
    const frame = useCurrentFrame();

    const kicker = data.kicker || 'Key Signal';
    const stat = data.stat || '0%';
    const context = data.context || '';
    const takeaway = data.takeaway || '';

    const cardOpacity = interpolate(frame, [0, 20], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const statScale = interpolate(frame, [10, 32], [0.92, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const textOpacity = interpolate(frame, [22, 42], [0, 1], {
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
                background: 'linear-gradient(160deg, #121212 0%, #1a1a1a 65%, #0f0f0f 100%)',
                padding: 70,
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: `radial-gradient(circle at 15% 20%, ${branding.accentColor}44 0%, transparent 45%)`,
                }}
            />

            <div
                style={{
                    width: '100%',
                    maxWidth: 910,
                    borderRadius: 36,
                    border: `2px solid ${branding.accentColor}`,
                    background: 'rgba(18,18,18,0.86)',
                    padding: '56px 64px',
                    opacity: cardOpacity,
                    zIndex: 10,
                }}
            >
                <p
                    style={{
                        margin: 0,
                        color: '#d4d4d4',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        fontSize: 24,
                    }}
                >
                    {kicker}
                </p>

                <h2
                    style={{
                        margin: '20px 0 18px',
                        fontFamily: "'Montserrat', sans-serif",
                        fontSize: 150,
                        lineHeight: 1,
                        color: branding.accentColor,
                        transform: `scale(${statScale})`,
                        transformOrigin: 'left center',
                        fontWeight: 900,
                    }}
                >
                    {stat}
                </h2>

                <p
                    style={{
                        margin: 0,
                        fontSize: 40,
                        lineHeight: 1.45,
                        color: '#f5f5f5',
                        fontWeight: 600,
                        opacity: textOpacity,
                    }}
                >
                    {context}
                </p>

                <p
                    style={{
                        margin: '32px 0 0',
                        fontSize: 32,
                        lineHeight: 1.45,
                        color: '#d4d4d4',
                        fontWeight: 500,
                        opacity: textOpacity,
                    }}
                >
                    {takeaway}
                </p>
            </div>

            <div
                style={{
                    position: 'absolute',
                    bottom: 44,
                    right: 48,
                    color: '#d4d4d4',
                    fontSize: 22,
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    opacity: interpolate(frame, [36, 58], [0, 0.75], {
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
