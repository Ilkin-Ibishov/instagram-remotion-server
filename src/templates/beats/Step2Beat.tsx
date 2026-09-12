import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

type Step2BeatProps = {
    startFrame: number;
    endFrame: number;
    captions: string[];
    tokens: any;
};

export const Step2Beat: React.FC<Step2BeatProps> = ({ startFrame, endFrame, captions, tokens }) => {
    const frame = useCurrentFrame();
    const relativeFrame = frame;

    const numeralScale = interpolate(relativeFrame, [0, 10], [0.8, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const checklistOpacity = interpolate(relativeFrame, [0, 10], [0.9, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const gap1Glow = interpolate(relativeFrame, [40, 50], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const gap2Glow = interpolate(relativeFrame, [55, 65], [0, 1], {
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
                    background: `linear-gradient(135deg, ${tokens.colors.background} 0%, #0a1520 100%)`,
                }}
            />

            <div
                style={{
                    position: 'absolute',
                    top: 200,
                    right: 60,
                    transform: `scale(${numeralScale})`,
                    transformOrigin: 'right center',
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
                    2
                </div>
            </div>

            <div
                style={{
                    position: 'absolute',
                    top: 400,
                    left: 120,
                    right: 120,
                    opacity: checklistOpacity,
                }}
            >
                <svg width="840" height="400" viewBox="0 0 840 400">
                    <rect x="0" y="20" width="800" height="70" fill="rgba(255,255,255,0.06)" rx="8" />
                    <circle cx="50" cy="55" r="20" fill="rgba(100,100,100,0.5)" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
                    <line x1="45" y1="55" x2="50" y2="60" stroke="rgba(255,255,255,0.3)" strokeWidth="3" strokeLinecap="round" />
                    <line x1="50" y1="60" x2="58" y2="48" stroke="rgba(255,255,255,0.3)" strokeWidth="3" strokeLinecap="round" />
                    <line x1="100" y1="55" x2="700" y2="55" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />

                    <rect
                        x="0"
                        y="110"
                        width="800"
                        height="70"
                        fill={`rgba(239, 68, 68, ${gap1Glow * 0.2})`}
                        stroke={tokens.colors.primary}
                        strokeWidth={gap1Glow * 4}
                        rx="8"
                        style={{
                            filter: gap1Glow > 0 ? `drop-shadow(0 0 ${gap1Glow * 20}px ${tokens.colors.primary})` : 'none',
                        }}
                    />
                    <circle cx="50" cy="145" r="20" fill="rgba(239, 68, 68, 0.3)" stroke={tokens.colors.primary} strokeWidth="3" />
                    <text x="100" y="155" fill={tokens.colors.primary} fontSize="28" fontWeight="700" fontFamily="'Montserrat', sans-serif">
                        ??? GAP: MISSING CONCEPT
                    </text>

                    <rect x="0" y="200" width="800" height="70" fill="rgba(255,255,255,0.06)" rx="8" />
                    <circle cx="50" cy="235" r="20" fill="rgba(100,100,100,0.5)" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
                    <line x1="45" y1="235" x2="50" y2="240" stroke="rgba(255,255,255,0.3)" strokeWidth="3" strokeLinecap="round" />
                    <line x1="50" y1="240" x2="58" y2="228" stroke="rgba(255,255,255,0.3)" strokeWidth="3" strokeLinecap="round" />
                    <line x1="100" y1="235" x2="700" y2="235" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />

                    <rect
                        x="0"
                        y="290"
                        width="800"
                        height="70"
                        fill={`rgba(239, 68, 68, ${gap2Glow * 0.2})`}
                        stroke={tokens.colors.primary}
                        strokeWidth={gap2Glow * 4}
                        rx="8"
                        style={{
                            filter: gap2Glow > 0 ? `drop-shadow(0 0 ${gap2Glow * 20}px ${tokens.colors.primary})` : 'none',
                        }}
                    />
                    <circle cx="50" cy="325" r="20" fill="rgba(239, 68, 68, 0.3)" stroke={tokens.colors.primary} strokeWidth="3" />
                    <text x="100" y="335" fill={tokens.colors.primary} fontSize="28" fontWeight="700" fontFamily="'Montserrat', sans-serif">
                        ??? GAP: CAN'T RECALL
                    </text>
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
