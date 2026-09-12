import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion';
import { getDesignTokens, getNicheFromBranding } from '../remotion/designTokens';

type HookEditorialProps = {
    data: Record<string, any>;
    branding: {
        niche?: string;
        accentColor: string;
        handle: string;
        effects: string[];
    };
};

const HookEditorial: React.FC<HookEditorialProps> = ({ data, branding }) => {
    const frame = useCurrentFrame();
    const niche = getNicheFromBranding(branding);
    const tokens = getDesignTokens(niche);

    const headline = data.headline || 'BREAKING NEWS';
    const microLabel = data.microLabel || data.badge || branding.handle || niche.toUpperCase();
    const cta = data.cta || 'SWIPE FOR MORE';

    // Niche-specific cinematic backgrounds (VERIFIED thematic matches, faceless)
    // TODO: Replace with staticFile('backgrounds/editorial/{niche}.jpg') for stable bundled renders
    const nicheBackgrounds: Record<string, string> = {
        'psychology-micro': 'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=1080&q=90', // Brain/neural network (actual brain scan)
        'history-flash': 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1080&q=90', // Old books/archive (aged documents)
        'legal-rights-az': 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1080&q=90', // Law books/gavel
        'study-hacks': 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1080&q=90', // Study notebook/desk
        'ai-tools-daily': 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=1080&q=90', // Laptop/tech workspace (coding environment)
    };

    const imageUrl = data.imageUrl || nicheBackgrounds[niche] || nicheBackgrounds['psychology-micro'];

    // Cinematic motion: hard visual first 2-4 frames, Ken Burns
    const imgScale = interpolate(frame, [0, 90], [1.15, 1.05], {
        extrapolateRight: 'clamp',
    });
    const imgOpacity = interpolate(frame, [0, 3], [0.85, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // Micro-label + divider: VISIBLE AT FRAME 0 (for Instagram thumbnails)
    const microLabelY = interpolate(frame, [0, 6], [-3, 0], {
        extrapolateRight: 'clamp',
    });
    const microLabelOpacity = interpolate(frame, [0, 6], [0.9, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // Headline lines: FIRST LINE VISIBLE AT FRAME 0, rest stagger
    const headlineLines = headline.split('\n').filter(Boolean);
    const getLineOpacity = (lineIndex: number) => {
        if (lineIndex === 0) {
            // First line: visible at frame 0 for thumbnail
            return interpolate(frame, [0, 4], [0.95, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
            });
        }
        // Later lines: stagger in for polish
        const startFrame = 4 + lineIndex * 3;
        return interpolate(frame, [startFrame, startFrame + 6], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
        });
    };
    const getLineY = (lineIndex: number) => {
        if (lineIndex === 0) {
            // First line: minimal movement
            return interpolate(frame, [0, 4], [4, 0], {
                extrapolateRight: 'clamp',
            });
        }
        // Later lines: stagger motion
        const startFrame = 4 + lineIndex * 3;
        return interpolate(frame, [startFrame, startFrame + 6], [12, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
        });
    };

    // CTA fade in: higher opacity for readability on black
    const ctaOpacity = interpolate(frame, [18, 26], [0, 0.85], {
        extrapolateRight: 'clamp',
    });

    return (
        <AbsoluteFill style={{ background: '#000' }}>
            {/* Top ~70%: Cinematic image window */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '70%',
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

            {/* Thin divider + micro-label */}
            <div
                style={{
                    position: 'absolute',
                    top: '70%',
                    left: 0,
                    width: '100%',
                    transform: `translateY(${microLabelY}px)`,
                    opacity: microLabelOpacity,
                }}
            >
                {/* Thin accent divider */}
                <div
                    style={{
                        width: '100%',
                        height: 3,
                        background: tokens.colors.primary,
                        boxShadow: `0 0 12px ${tokens.colors.primary}80`,
                    }}
                />
                {/* Micro-label: profile/brand tag (evolving.ai style) */}
                <div
                    style={{
                        padding: '14px 32px',
                        fontSize: 16,
                        fontWeight: 900,
                        letterSpacing: '0.18em',
                        color: tokens.colors.primary,
                        textTransform: 'uppercase',
                        fontFamily: "'Montserrat', sans-serif",
                        textAlign: 'center',
                        textShadow: `0 3px 12px rgba(0,0,0,1), 0 0 24px ${tokens.colors.primary}60`,
                        backgroundColor: `${tokens.colors.background}e6`,
                        backdropFilter: 'blur(4px)',
                    }}
                >
                    {microLabel}
                </div>
            </div>

            {/* Bottom ~30%: Solid black slab with bold ALL-CAPS headline */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    height: '30%',
                    background: '#000',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    padding: '0 32px 40px 32px',
                }}
            >
                {/* Headline: left-aligned ALL-CAPS slab text (consistent grammar) */}
                <div style={{ width: '100%' }}>
                    {headlineLines.map((line, idx) => (
                        <div
                            key={idx}
                            style={{
                                fontSize: 56,
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

                {/* CTA footer: larger text, high contrast (İlkin: readable ~18-24px) */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: 18,
                        left: 32,
                        fontSize: 20,
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
        </AbsoluteFill>
    );
};

export default HookEditorial;
