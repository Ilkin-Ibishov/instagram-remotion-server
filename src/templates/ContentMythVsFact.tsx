import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { lineClamp, singleLineEllipsis } from './textOverflow';

export default function ContentMythVsFact({
    data,
    branding,
}: {
    data: any;
    branding: any;
}) {
    const frame = useCurrentFrame();

    const myth = data.myth || 'Myth';
    const fact = data.fact || 'Fact';
    const proof = data.proof || '';

    const leftX = interpolate(frame, [0, 20], [-14, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const rightX = interpolate(frame, [0, 20], [14, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const proofOpacity = interpolate(frame, [0, 24], [0.4, 1], {
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
                background: 'linear-gradient(135deg, #111 0%, #171717 60%, #0d0d0d 100%)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: 28,
                padding: 72,
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    top: 34,
                    left: 40,
                    fontSize: 22,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: '#bdbdbd',
                    fontWeight: 700,
                }}
            >
                Myth vs Fact
            </div>

            <div
                style={{
                    borderRadius: 28,
                    border: '2px solid rgba(255,255,255,0.16)',
                    padding: '28px 32px',
                    background: 'rgba(255,255,255,0.04)',
                    transform: `translateX(${leftX}px)`,
                }}
            >
                <p
                    style={{
                        margin: 0,
                        color: '#ff9ca3',
                        fontSize: 22,
                        textTransform: 'uppercase',
                        fontWeight: 800,
                        letterSpacing: '0.08em',
                    }}
                >
                    Myth
                </p>
                <p
                    style={{
                        margin: '14px 0 0',
                        fontSize: 44,
                        lineHeight: 1.35,
                        color: '#f2f2f2',
                        fontWeight: 700,
                        fontFamily: "'Montserrat', sans-serif",
                        ...lineClamp(3, '100%'),
                    }}
                >
                    {myth}
                </p>
            </div>

            <div
                style={{
                    borderRadius: 28,
                    border: `2px solid ${branding.accentColor}`,
                    padding: '28px 32px',
                    background: `${branding.accentColor}1f`,
                    transform: `translateX(${rightX}px)`,
                }}
            >
                <p
                    style={{
                        margin: 0,
                        color: branding.accentColor,
                        fontSize: 22,
                        textTransform: 'uppercase',
                        fontWeight: 800,
                        letterSpacing: '0.08em',
                    }}
                >
                    Fact
                </p>
                <p
                    style={{
                        margin: '14px 0 0',
                        fontSize: 44,
                        lineHeight: 1.35,
                        color: '#fafafa',
                        fontWeight: 700,
                        fontFamily: "'Montserrat', sans-serif",
                        ...lineClamp(3, '100%'),
                    }}
                >
                    {fact}
                </p>
            </div>

            <p
                style={{
                    margin: '8px 4px 0',
                    fontSize: 30,
                    lineHeight: 1.45,
                    color: '#d6d6d6',
                    opacity: proofOpacity,
                    fontWeight: 500,
                    ...lineClamp(4, '100%'),
                }}
            >
                {proof}
            </p>

            <div
                style={{
                    position: 'absolute',
                    bottom: 44,
                    right: 48,
                    color: '#d4d4d4',
                    fontSize: 22,
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    ...singleLineEllipsis(360),
                    opacity: interpolate(frame, [0, 24], [0.3, 0.75], {
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
