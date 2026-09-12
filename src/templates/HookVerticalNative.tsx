import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { getDesignTokens, getNicheFromBranding } from '../remotion/designTokens';

type KaraokeWord = {
    startFrame: number;
    endFrame: number;
    text: string;
};

type HookVerticalNativeProps = {
    data: Record<string, any>;
    branding: {
        niche?: string;
        accentColor: string;
        handle: string;
        effects: string[];
    };
};

const HookVerticalNative: React.FC<HookVerticalNativeProps> = ({ data, branding }) => {
    const frame = useCurrentFrame();
    const niche = getNicheFromBranding(branding);
    const tokens = getDesignTokens(niche);

    // Karaoke data: array of {startFrame, endFrame, text}
    const karaoke: KaraokeWord[] = data.karaoke || [];
    
    // Fallback: split hookLines into words if no karaoke provided
    const hookLines: string[] = data.hookLines || ['YOUR BRAIN', 'LIES TO YOU', 'EVERY DAY'];
    
    // Auto-generate karaoke from hookLines if not provided (1.5s per phrase = ~45 frames @ 30fps)
    const autoKaraoke: KaraokeWord[] = karaoke.length > 0 
        ? karaoke 
        : hookLines.map((line, idx) => ({
            startFrame: idx * 45,
            endFrame: (idx + 1) * 45,
            text: line.toUpperCase(),
        }));

    const cta = data.cta || 'FOLLOW';

    // Motion background: animated gradient + optional niche accent pulse
    const bgPulse = interpolate(frame % 60, [0, 30, 60], [0.3, 0.5, 0.3], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // Find current active word(s)
    const activeWords = autoKaraoke.filter(
        (word) => frame >= word.startFrame && frame < word.endFrame
    );

    // Upcoming word (next in queue)
    const upcomingWord = autoKaraoke.find((word) => frame < word.startFrame);

    // Past words (for subtle trail effect)
    const pastWords = autoKaraoke.filter((word) => frame >= word.endFrame);

    // Word entrance animation (scale + opacity)
    const getWordScale = (word: KaraokeWord) => {
        const relativeFrame = frame - word.startFrame;
        return interpolate(relativeFrame, [0, 8], [0.92, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
        });
    };

    const getWordOpacity = (word: KaraokeWord) => {
        const relativeFrame = frame - word.startFrame;
        // Fade in fast, stay, fade out
        if (relativeFrame < 8) {
            return interpolate(relativeFrame, [0, 8], [0, 1], { extrapolateLeft: 'clamp' });
        }
        const exitFrame = word.endFrame - word.startFrame;
        if (relativeFrame > exitFrame - 8) {
            return interpolate(relativeFrame, [exitFrame - 8, exitFrame], [1, 0.3], {
                extrapolateRight: 'clamp',
            });
        }
        return 1;
    };

    // Handle watermark (small, bottom corner)
    const handleOpacity = interpolate(frame, [0, 15], [0, 0.7], {
        extrapolateRight: 'clamp',
    });

    // CTA end card (last 2s = ~60 frames)
    const totalFrames = Math.max(...autoKaraoke.map(w => w.endFrame)) + 60;
    const ctaOpacity = interpolate(frame, [totalFrames - 60, totalFrames - 45], [0, 0.9], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    return (
        <AbsoluteFill
            style={{
                background: `radial-gradient(ellipse at center, ${tokens.colors.background} 0%, #000 100%)`,
            }}
        >
            {/* Animated niche-colored pulse layer */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: `radial-gradient(circle at 50% 40%, ${tokens.colors.primary}${Math.floor(bgPulse * 255).toString(16).padStart(2, '0')} 0%, transparent 60%)`,
                    mixBlendMode: 'screen',
                }}
            />

            {/* Safe zone guide (invisible, for reference) */}
            <div
                style={{
                    position: 'absolute',
                    top: 150,
                    bottom: 200,
                    left: 60,
                    right: 60,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 20,
                }}
            >
                {/* ACTIVE WORD(S): Large karaoke-style highlight */}
                {activeWords.map((word, idx) => (
                    <div
                        key={`active-${word.startFrame}-${idx}`}
                        style={{
                            fontSize: 72,
                            fontWeight: 900,
                            color: '#fff',
                            textAlign: 'center',
                            textTransform: 'uppercase',
                            fontFamily: "'Montserrat', sans-serif",
                            letterSpacing: '-0.02em',
                            lineHeight: 1.1,
                            textShadow: `
                                0 4px 20px rgba(0,0,0,0.9),
                                0 0 40px ${tokens.colors.primary}80
                            `,
                            transform: `scale(${getWordScale(word)})`,
                            opacity: getWordOpacity(word),
                            padding: '12px 24px',
                            background: `linear-gradient(135deg, ${tokens.colors.primary}20 0%, transparent 100%)`,
                            borderRadius: 8,
                            border: `3px solid ${tokens.colors.primary}60`,
                        }}
                    >
                        {word.text}
                    </div>
                ))}

                {/* UPCOMING WORD: Subtle preview */}
                {upcomingWord && activeWords.length === 0 && (
                    <div
                        style={{
                            fontSize: 48,
                            fontWeight: 700,
                            color: tokens.colors.textSecondary,
                            textAlign: 'center',
                            textTransform: 'uppercase',
                            fontFamily: "'Montserrat', sans-serif",
                            opacity: 0.4,
                        }}
                    >
                        {upcomingWord.text}
                    </div>
                )}
            </div>

            {/* Handle watermark: small, bottom left */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 220,
                    left: 32,
                    fontSize: 14,
                    fontWeight: 800,
                    letterSpacing: '0.1em',
                    color: tokens.colors.primary,
                    textTransform: 'uppercase',
                    fontFamily: "'Montserrat', sans-serif",
                    opacity: handleOpacity,
                    textShadow: `0 2px 8px rgba(0,0,0,1)`,
                }}
            >
                {branding.handle}
            </div>

            {/* CTA end card: subtle, bottom center */}
            {ctaOpacity > 0 && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: 250,
                        left: 0,
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                        opacity: ctaOpacity,
                    }}
                >
                    <div
                        style={{
                            padding: '16px 32px',
                            fontSize: 20,
                            fontWeight: 900,
                            letterSpacing: '0.12em',
                            color: '#fff',
                            textTransform: 'uppercase',
                            fontFamily: "'Montserrat', sans-serif",
                            background: `linear-gradient(135deg, ${tokens.colors.primary}40 0%, ${tokens.colors.primary}20 100%)`,
                            backdropFilter: 'blur(8px)',
                            borderRadius: 8,
                            border: `2px solid ${tokens.colors.primary}`,
                            boxShadow: `0 4px 24px ${tokens.colors.primary}60`,
                            textShadow: `0 2px 8px rgba(0,0,0,1)`,
                        }}
                    >
                        {cta}
                    </div>
                </div>
            )}
        </AbsoluteFill>
    );
};

export default HookVerticalNative;
