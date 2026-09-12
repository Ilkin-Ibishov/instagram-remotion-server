import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

type CtaBeatProps = {
    startFrame: number;
    endFrame: number;
    handle: string;
    tokens: any;
};

export const CtaBeat: React.FC<CtaBeatProps> = ({ startFrame, endFrame, handle, tokens }) => {
    const frame = useCurrentFrame();
    const relativeFrame = frame - startFrame;

    if (frame < startFrame || frame >= endFrame) return null;

    const cardOpacity = interpolate(relativeFrame, [0, 8], [0.95, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const chipScale = interpolate(relativeFrame, [20, 35], [0.9, 1], {
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
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: cardOpacity,
                    paddingBottom: 100,
                }}
            >
                <div
                    style={{
                        fontSize: 64,
                        fontWeight: 900,
                        color: '#fff',
                        fontFamily: "'Montserrat', sans-serif",
                        textAlign: 'center',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: 30,
                        textShadow: `0 4px 20px ${tokens.colors.primary}80`,
                    }}
                >
                    Try tonight
                </div>

                <div
                    style={{
                        fontSize: 40,
                        fontWeight: 600,
                        color: tokens.colors.textSecondary,
                        fontFamily: "'Montserrat', sans-serif",
                        textAlign: 'center',
                        marginBottom: 50,
                    }}
                >
                    1 chapter
                </div>

                <div
                    style={{
                        display: 'flex',
                        gap: 20,
                        transform: `scale(${chipScale})`,
                    }}
                >
                    <div
                        style={{
                            padding: '20px 40px',
                            fontSize: 32,
                            fontWeight: 800,
                            color: '#fff',
                            fontFamily: "'Montserrat', sans-serif",
                            background: `linear-gradient(135deg, ${tokens.colors.primary}60 0%, ${tokens.colors.primary}40 100%)`,
                            border: `3px solid ${tokens.colors.primary}`,
                            borderRadius: 50,
                            boxShadow: `0 4px 20px ${tokens.colors.primary}60`,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                        }}
                    >
                        🔥 Cooked
                    </div>

                    <div
                        style={{
                            padding: '20px 40px',
                            fontSize: 32,
                            fontWeight: 800,
                            color: 'rgba(255,255,255,0.5)',
                            fontFamily: "'Montserrat', sans-serif",
                            background: 'rgba(100,100,100,0.2)',
                            border: '3px solid rgba(255,255,255,0.2)',
                            borderRadius: 50,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                        }}
                    >
                        ❌ Not cooked
                    </div>
                </div>

                <div
                    style={{
                        marginTop: 60,
                        fontSize: 28,
                        fontWeight: 800,
                        color: tokens.colors.primary,
                        fontFamily: "'Montserrat', sans-serif",
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        textShadow: `0 2px 12px ${tokens.colors.primary}80`,
                    }}
                >
                    {handle}
                </div>
            </div>
        </AbsoluteFill>
    );
};
