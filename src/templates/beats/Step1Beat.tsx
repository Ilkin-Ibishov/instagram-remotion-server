import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

type Step1BeatProps = {
    startFrame: number;
    endFrame: number;
    captions: string[];
    tokens: any;
};

export const Step1Beat: React.FC<Step1BeatProps> = ({ startFrame, endFrame, captions, tokens }) => {
    const frame = useCurrentFrame();
    const relativeFrame = frame;

    const numeralScale = interpolate(relativeFrame, [0, 10], [0.8, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const timerOpacity = interpolate(relativeFrame, [0, 12], [0.9, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const bookOpacity = interpolate(relativeFrame, [8, 20], [0.85, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const strokeProgress = interpolate(relativeFrame, [50, 90], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const captionOpacity = interpolate(relativeFrame, [40, 55], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    return (
        <AbsoluteFill>
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: `linear-gradient(135deg, ${tokens.colors.background} 0%, #0a1520 100%)`,
                }}
            />

            <div
                style={{
                    position: 'absolute',
                    top: 200,
                    left: 60,
                    transform: `scale(${numeralScale})`,
                    transformOrigin: 'left center',
                }}
            >
                <div
                    style={{
                        fontSize: 200,
                        fontWeight: 900,
                        color: tokens.colors.primary,
                        fontFamily: "'Montserrat', sans-serif",
                        textShadow: `0 8px 32px ${tokens.colors.primary}80`,
                        lineHeight: 1,
                    }}
                >
                    1
                </div>
            </div>

            <div
                style={{
                    position: 'absolute',
                    top: 240,
                    right: 80,
                    opacity: timerOpacity,
                }}
            >
                <div
                    style={{
                        background: 'rgba(0,0,0,0.6)',
                        padding: '20px 40px',
                        borderRadius: 12,
                        border: `3px solid ${tokens.colors.primary}`,
                        boxShadow: `0 4px 20px ${tokens.colors.primary}40`,
                    }}
                >
                    <div
                        style={{
                            fontSize: 72,
                            fontWeight: 900,
                            color: tokens.colors.primary,
                            fontFamily: "'Montserrat', monospace",
                            letterSpacing: '0.1em',
                        }}
                    >
                        8:00
                    </div>
                </div>
            </div>

            <div
                style={{
                    position: 'absolute',
                    top: 500,
                    left: 140,
                    right: 140,
                    opacity: bookOpacity,
                }}
            >
                <svg width="800" height="300" viewBox="0 0 800 300">
                    <rect
                        x="50"
                        y="20"
                        width="300"
                        height="260"
                        fill="rgba(6, 182, 212, 0.2)"
                        stroke={tokens.colors.primary}
                        strokeWidth="4"
                        rx="8"
                    />
                    <line x1="200" y1="20" x2="200" y2="280" stroke={tokens.colors.primary} strokeWidth="2" />
                    
                    <line x1="80" y1="80" x2="170" y2="80" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
                    <line x1="80" y1="110" x2="170" y2="110" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
                    <line x1="80" y1="140" x2="170" y2="140" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />

                    <rect
                        x="420"
                        y="50"
                        width="330"
                        height="220"
                        fill="rgba(255,255,255,0.08)"
                        stroke="rgba(255,255,255,0.2)"
                        strokeWidth="2"
                        rx="4"
                    />

                    <path
                        d={`M ${440 + strokeProgress * 0} ${100 + strokeProgress * 0} Q ${500 + strokeProgress * 100} ${80 + strokeProgress * 20}, ${560 + strokeProgress * 150} ${110 + strokeProgress * 30}`}
                        stroke={tokens.colors.primary}
                        strokeWidth="6"
                        fill="none"
                        strokeLinecap="round"
                        opacity={strokeProgress}
                    />
                    <path
                        d={`M ${450 + strokeProgress * 20} ${150 + strokeProgress * 10} L ${650 + strokeProgress * 100} ${155 + strokeProgress * 5}`}
                        stroke={tokens.colors.primary}
                        strokeWidth="4"
                        fill="none"
                        strokeLinecap="round"
                        opacity={strokeProgress}
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
