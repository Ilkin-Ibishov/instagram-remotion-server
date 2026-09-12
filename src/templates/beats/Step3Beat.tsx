import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

type Step3BeatProps = {
    startFrame: number;
    endFrame: number;
    captions: string[];
    tokens: any;
};

export const Step3Beat: React.FC<Step3BeatProps> = ({ startFrame, endFrame, captions, tokens }) => {
    const frame = useCurrentFrame();
    const relativeFrame = frame - startFrame;

    if (frame < startFrame || frame >= endFrame) return null;

    const numeralScale = interpolate(relativeFrame, [0, 10], [0.8, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const chapterOpacity = interpolate(relativeFrame, [10, 25], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const crosshairScale = interpolate(relativeFrame, [35, 50], [0.5, 1.2], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const targetPulse = Math.sin(relativeFrame * 0.1) * 0.5 + 0.5;

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
                    3
                </div>
            </div>

            <div
                style={{
                    position: 'absolute',
                    top: 450,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    opacity: chapterOpacity,
                }}
            >
                <svg width="700" height="400" viewBox="0 0 700 400">
                    <rect x="50" y="20" width="600" height="350" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" strokeWidth="3" rx="8" />
                    
                    <text x="80" y="70" fill="rgba(255,255,255,0.4)" fontSize="24" fontWeight="600" fontFamily="'Montserrat', sans-serif">
                        Section 1: ✓
                    </text>
                    
                    <rect x="80" y="100" width="540" height="60" fill="rgba(239, 68, 68, 0.15)" stroke={tokens.colors.primary} strokeWidth="3" rx="6" />
                    <text x="100" y="135" fill={tokens.colors.primary} fontSize="20" fontWeight="700" fontFamily="'Montserrat', sans-serif">
                        Section 2: ??? BLANK SPOT
                    </text>
                    
                    <text x="80" y="200" fill="rgba(255,255,255,0.4)" fontSize="24" fontWeight="600" fontFamily="'Montserrat', sans-serif">
                        Section 3: ✓
                    </text>

                    <rect x="80" y="230" width="540" height="60" fill="rgba(239, 68, 68, 0.15)" stroke={tokens.colors.primary} strokeWidth="3" rx="6" />
                    <text x="100" y="265" fill={tokens.colors.primary} fontSize="20" fontWeight="700" fontFamily="'Montserrat', sans-serif">
                        Section 4: ??? FUZZY
                    </text>

                    <text x="80" y="330" fill="rgba(255,255,255,0.4)" fontSize="24" fontWeight="600" fontFamily="'Montserrat', sans-serif">
                        Section 5: ✓
                    </text>
                </svg>

                <div
                    style={{
                        position: 'absolute',
                        top: 100,
                        left: '50%',
                        transform: `translate(-50%, -50%) scale(${crosshairScale})`,
                    }}
                >
                    <svg width="200" height="200" viewBox="0 0 200 200">
                        <circle
                            cx="100"
                            cy="100"
                            r="60"
                            fill="none"
                            stroke={tokens.colors.primary}
                            strokeWidth="4"
                            opacity={0.8 + targetPulse * 0.2}
                        />
                        <circle
                            cx="100"
                            cy="100"
                            r="40"
                            fill="none"
                            stroke={tokens.colors.primary}
                            strokeWidth="3"
                            opacity={0.6}
                        />
                        <circle
                            cx="100"
                            cy="100"
                            r="10"
                            fill={tokens.colors.primary}
                            opacity={0.9}
                        />
                        <line x1="100" y1="20" x2="100" y2="180" stroke={tokens.colors.primary} strokeWidth="2" opacity={0.6} />
                        <line x1="20" y1="100" x2="180" y2="100" stroke={tokens.colors.primary} strokeWidth="2" opacity={0.6} />
                    </svg>
                </div>
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
