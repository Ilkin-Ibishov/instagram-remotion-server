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

    // Niche-specific cinematic backgrounds (thematically matched, faceless)
    const nicheBackgrounds: Record<string, string> = {
        'psychology-micro': 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=1080&q=90', // Brain/mind silhouette
        'history-flash': 'https://images.unsplash.com/photo-1568667256549-094345857637?w=1080&q=90', // Dark archive/old documents
        'legal-rights-az': 'https://images.unsplash.com/photo-1589391886645-d51941baf7fb?w=1080&q=90', // Gavel (kept)
        'study-hacks': 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1080&q=90', // Writing hand (kept)
        'ai-tools-daily': 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1080&q=90', // AI/laptop/digital UI glow
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
                {/* Micro-label: centered on divider */}
                <div
                    style={{
                        padding: '10px 32px',
                        fontSize: 13,
                        fontWeight: 900,
                        letterSpacing: '0.16em',
                        color: tokens.colors.primary,
                        textTransform: 'uppercase',
                        fontFamily: "'Montserrat', sans-serif",
                        textAlign: 'center',
                        textShadow: `0 2px 8px rgba(0,0,0,0.9), 0 0 20px ${tokens.colors.primary}40`,
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

                {/* CTA footer: higher contrast for readability */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: 14,
                        left: 32,
                        fontSize: 12,
                        fontWeight: 900,
                        letterSpacing: '0.14em',
                        color: '#fff',
                        textTransform: 'uppercase',
                        opacity: ctaOpacity,
                        fontFamily: "'Montserrat', sans-serif",
                        textShadow: `0 2px 6px rgba(0,0,0,0.9), 0 0 16px ${tokens.colors.primary}60`,
                    }}
                >
                    {cta}
                </div>
            </div>
        </AbsoluteFill>
    );
};

export default HookEditorial;
