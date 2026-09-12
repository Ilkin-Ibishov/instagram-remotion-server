import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion';
import { getDesignTokens, getNicheFromBranding } from '../remotion/designTokens';

type HookEditorialReelProps = {
    data: Record<string, any>;
    branding: {
        niche?: string;
        accentColor: string;
        handle: string;
        effects: string[];
    };
};

const HookEditorialReel: React.FC<HookEditorialReelProps> = ({ data, branding }) => {
    const frame = useCurrentFrame();
    const niche = getNicheFromBranding(branding);
    const tokens = getDesignTokens(niche);

    const headline = data.headline || 'BREAKING NEWS';
    const microLabel = data.microLabel || data.badge || niche.toUpperCase();
    const cta = data.cta || 'FOLLOW FOR MORE';

    // Same niche backgrounds as Feed (4:5)
    const nicheBackgrounds: Record<string, string> = {
        'psychology-micro': 'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=1080&q=90',
        'history-flash': 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1080&q=90',
        'legal-rights-az': 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1080&q=90',
        'study-hacks': 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1080&q=90',
        'ai-tools-daily': 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=1080&q=90',
    };

    const imageUrl = data.imageUrl || nicheBackgrounds[niche] || nicheBackgrounds['psychology-micro'];

    // Safe zones: top ~150px, bottom ~200px for Reels/TikTok/Shorts UI
    const topSafeZone = 150;
    const bottomSafeZone = 200;

    // Cinematic motion: hard visual first 2-4 frames, Ken Burns
    const imgScale = interpolate(frame, [0, 90], [1.15, 1.05], {
        extrapolateRight: 'clamp',
    });
    const imgOpacity = interpolate(frame, [0, 3], [0.85, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // Profile tag + divider: VISIBLE AT FRAME 0
    const labelY = interpolate(frame, [0, 6], [-3, 0], {
        extrapolateRight: 'clamp',
    });
    const labelOpacity = interpolate(frame, [0, 6], [0.9, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // Headline lines: FIRST LINE VISIBLE AT FRAME 0, rest stagger
    const headlineLines = headline.split('\n').filter(Boolean);
    const getLineOpacity = (lineIndex: number) => {
        if (lineIndex === 0) {
            return interpolate(frame, [0, 4], [0.95, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
            });
        }
        const startFrame = 4 + lineIndex * 3;
        return interpolate(frame, [startFrame, startFrame + 6], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
        });
    };
    const getLineY = (lineIndex: number) => {
        if (lineIndex === 0) {
            return interpolate(frame, [0, 4], [4, 0], {
                extrapolateRight: 'clamp',
            });
        }
        const startFrame = 4 + lineIndex * 3;
        return interpolate(frame, [startFrame, startFrame + 6], [12, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
        });
    };

    // CTA fade in: higher opacity for readability
    const ctaOpacity = interpolate(frame, [18, 26], [0, 0.85], {
        extrapolateRight: 'clamp',
    });

    // 9:16 layout: cinematic image ~55%, black slab ~35%
    const imageSectionHeight = '55%';
    const slabSectionHeight = '35%';

    return (
        <AbsoluteFill style={{ background: '#000' }}>
            {/* Top safe zone (transparent) */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: topSafeZone,
                    zIndex: 50,
                    pointerEvents: 'none',
                }}
            />

            {/* Upper ~55%: Cinematic image window */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: imageSectionHeight,
                    overflow: 'hidden',
                }}
            >
                <Img
                    src={imageUrl}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transform: `scale(${imgScale})`,
                        opacity: imgOpacity,
                    }}
                />
                {/* Subtle bottom gradient for seamless transition to black slab */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        width: '100%',
                        height: '30%',
                        background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.9) 100%)',
                    }}
                />
            </div>

            {/* Divider + profile tag + handle: straddles image/slab boundary, z-index above slab */}
            <div
                style={{
                    position: 'absolute',
                    top: imageSectionHeight,
                    left: 0,
                    width: '100%',
                    transform: `translateY(calc(${labelY}px - 60px))`,
                    opacity: labelOpacity,
                    zIndex: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
            >
                {/* Profile/brand tag: dark plate straddling divider */}
                <div
                    style={{
                        padding: '12px 24px',
                        marginBottom: 6,
                        fontSize: 16,
                        fontWeight: 900,
                        letterSpacing: '0.18em',
                        color: tokens.colors.primary,
                        textTransform: 'uppercase',
                        fontFamily: "'Montserrat', sans-serif",
                        textAlign: 'center',
                        textShadow: `0 3px 12px rgba(0,0,0,1), 0 0 24px ${tokens.colors.primary}60`,
                        backgroundColor: `${tokens.colors.background}f0`,
                        backdropFilter: 'blur(6px)',
                        borderRadius: 4,
                        boxShadow: `0 4px 16px rgba(0,0,0,0.8)`,
                    }}
                >
                    {microLabel}
                </div>

                {/* Thin accent divider */}
                <div
                    style={{
                        width: '100%',
                        height: 3,
                        background: tokens.colors.primary,
                        boxShadow: `0 0 12px ${tokens.colors.primary}80`,
                    }}
                />

                {/* Handle below divider */}
                <div
                    style={{
                        marginTop: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        color: tokens.colors.primary,
                        textTransform: 'uppercase',
                        fontFamily: "'Montserrat', sans-serif",
                        textShadow: `0 2px 8px rgba(0,0,0,1)`,
                        opacity: 0.85,
                    }}
                >
                    {branding.handle}
                </div>
            </div>

            {/* Lower ~35%: Solid black slab with bold ALL-CAPS headline */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    height: slabSectionHeight,
                    background: '#000',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    padding: `0 32px ${bottomSafeZone + 20}px 32px`,
                    zIndex: 10,
                }}
            >
                {/* Headline: left-aligned ALL-CAPS slab text */}
                <div style={{ width: '100%' }}>
                    {headlineLines.map((line, idx) => (
                        <div
                            key={idx}
                            style={{
                                fontSize: 52,
                                fontWeight: 900,
                                color: '#fff',
                                lineHeight: 1.1,
                                letterSpacing: '-0.02em',
                                textTransform: 'uppercase',
                                fontFamily: "'Montserrat', sans-serif",
                                textAlign: 'left',
                                marginBottom: idx < headlineLines.length - 1 ? 8 : 0,
                                transform: `translateY(${getLineY(idx)}px)`,
                                opacity: getLineOpacity(idx),
                            }}
                        >
                            {line}
                        </div>
                    ))}
                </div>

                {/* CTA footer: larger text, high contrast */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: bottomSafeZone - 20,
                        left: 32,
                        fontSize: 18,
                        fontWeight: 900,
                        letterSpacing: '0.16em',
                        color: '#fff',
                        textTransform: 'uppercase',
                        opacity: ctaOpacity,
                        fontFamily: "'Montserrat', sans-serif",
                        textShadow: `0 3px 10px rgba(0,0,0,1), 0 0 20px ${tokens.colors.primary}80`,
                    }}
                >
                    {cta}
                </div>
            </div>

            {/* Bottom safe zone (transparent) */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    height: bottomSafeZone,
                    zIndex: 50,
                    pointerEvents: 'none',
                }}
            />
        </AbsoluteFill>
    );
};

export default HookEditorialReel;
