import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

type WhyBeatProps = {
    startFrame: number;
    endFrame: number;
    captions: string[];
    tokens: any;
};

export const WhyBeat: React.FC<WhyBeatProps> = ({ startFrame, endFrame, captions, tokens }) => {
    const frame = useCurrentFrame();
    const relativeFrame = frame - startFrame;

    if (frame < startFrame || frame >= endFrame) return null;

    const highlighterOpacity = interpolate(relativeFrame, [0, 15], [0.8, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const xMarkDelay = 50;
    const xMarkOpacity = interpolate(relativeFrame, [xMarkDelay, xMarkDelay + 15], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const grayOutDelay = 70;
    const grayOutOpacity = interpolate(relativeFrame, [grayOutDelay, grayOutDelay + 20], [0, 0.7], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const headlineOpacity = interpolate(relativeFrame, [0, 12], [0.9, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const captionOpacity = interpolate(relativeFrame, [30, 45], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    return (
        <AbsoluteFill>
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: tokens.colors.backgroundGradient,
                }}
            />

            <div
                style={{
                    position: 'absolute',
                    top: 300,
                    left: 60,
                    right: 60,
                    opacity: headlineOpacity,
                }}
            >
                <div
                    style={{
                        fontSize: 48,
                        fontWeight: 900,
                        color: '#fff',
                        fontFamily: "'Montserrat', sans-serif",
                        textAlign: 'center',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: 40,
                    }}
                >
                    Why it fails
                </div>
            </div>

            <div
                style={{
                    position: 'absolute',
                    top: 420,
                    left: 120,
                    right: 120,
                }}
            >
                <svg width="840" height="300" viewBox="0 0 840 300">
                    <rect
                        x="0"
                        y="0"
                        width="840"
                        height="280"
                        fill="rgba(255,255,255,0.08)"
                        rx="12"
                    />
                    
                    <line x1="60" y1="60" x2="780" y2="60" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
                    <line x1="60" y1="100" x2="780" y2="100" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
                    <line x1="60" y1="140" x2="780" y2="140" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
                    <line x1="60" y1="180" x2="780" y2="180" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
                    <line x1="60" y1="220" x2="780" y2="220" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />

                    <rect
                        x="60"
                        y="90"
                        width="520"
                        height="40"
                        fill="#fbbf24"
                        opacity={highlighterOpacity * 0.6}
                        rx="4"
                    />

                    <line
                        x1="100"
                        y1="80"
                        x2="740"
                        y2="240"
                        stroke="#ef4444"
                        strokeWidth="20"
                        strokeLinecap="round"
                        opacity={xMarkOpacity}
                    />
                    <line
                        x1="740"
                        y1="80"
                        x2="100"
                        y2="240"
                        stroke="#ef4444"
                        strokeWidth="20"
                        strokeLinecap="round"
                        opacity={xMarkOpacity}
                    />

                    <rect
                        x="0"
                        y="0"
                        width="840"
                        height="280"
                        fill="rgba(100,100,100,0.8)"
                        opacity={grayOutOpacity}
                        rx="12"
                    />
                </svg>
            </div>

            <div
                style={{
                    position: 'absolute',
                    bottom: 240,
                    left: 60,
                    right: 60,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    opacity: captionOpacity,
                }}
            >
                {captions.map((caption, idx) => (
                    <div
                        key={idx}
                        style={{
                            fontSize: 32,
                            fontWeight: 700,
                            color: '#fff',
                            fontFamily: "'Montserrat', sans-serif",
                            textAlign: 'center',
                            textShadow: '0 2px 12px rgba(0,0,0,0.8)',
                            padding: '8px 16px',
                            background: 'rgba(0,0,0,0.5)',
                            borderRadius: 8,
                        }}
                    >
                        {caption}
                    </div>
                ))}
            </div>
        </AbsoluteFill>
    );
};
