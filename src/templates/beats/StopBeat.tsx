import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

type StopBeatProps = {
    startFrame: number;
    endFrame: number;
    captions: string[];
    tokens: any;
};

export const StopBeat: React.FC<StopBeatProps> = ({ startFrame, endFrame, captions, tokens }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const relativeFrame = frame - startFrame;

    if (frame < startFrame || frame >= endFrame) return null;

    const stampRotation = interpolate(relativeFrame, [0, 10], [-2, -2.5], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const stampScale = interpolate(relativeFrame, [0, 8], [0.9, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const captionOpacity = interpolate(relativeFrame, [10, 20], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    return (
        <AbsoluteFill>
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(135deg, #1a0f0f 0%, #2d1111 50%, #1a0f0f 100%)',
                }}
            />
            
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `
                        repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.02) 2px, rgba(255,255,255,0.02) 4px),
                        repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.02) 2px, rgba(255,255,255,0.02) 4px)
                    `,
                    opacity: 0.3,
                }}
            />

            <div
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%) rotate(${stampRotation}deg) scale(${stampScale})`,
                }}
            >
                <div
                    style={{
                        width: 500,
                        height: 500,
                        border: '16px solid #ef4444',
                        borderRadius: 40,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.4) 0%, rgba(220, 38, 38, 0.4) 100%)',
                        boxShadow: `
                            0 20px 60px rgba(239, 68, 68, 0.6),
                            inset 0 4px 0 rgba(255, 255, 255, 0.3),
                            inset 0 -4px 0 rgba(0, 0, 0, 0.3)
                        `,
                    }}
                >
                    <span
                        style={{
                            fontSize: 140,
                            fontWeight: 900,
                            color: '#fff',
                            fontFamily: "'Montserrat', sans-serif",
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            textShadow: '0 8px 24px rgba(0,0,0,0.8)',
                        }}
                    >
                        STOP
                    </span>
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
