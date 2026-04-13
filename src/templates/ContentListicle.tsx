import React from 'react';
import { useCurrentFrame, interpolate, spring } from 'remotion';

/**
 * CONTENT_LISTICLE — designed for medium-length text with numbered items.
 *
 * Expected data shape:
 *  {
 *    title: string;
 *    items: string[];           // 3–5 bullet points
 *    footnote?: string;         // optional bottom note
 *  }
 */
export default function ContentListicle({
    data,
    branding,
}: {
    data: any;
    branding: any;
}) {
    const frame = useCurrentFrame();
    const fps = 30;

    const titleY = interpolate(frame, [0, 24], [12, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const titleOpacity = interpolate(frame, [0, 24], [0.55, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const lineScaleX = interpolate(frame, [0, 18], [0.35, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // Items: staggered spring entrance, starting at 0.6s (frame 18)
    const title = data.title || 'Key Points';
    const items: string[] = Array.isArray(data.items) ? data.items : [];

    // Footnote: fade in at end, delay after last item
    const footnoteDelay = 18 + items.length * 8 + 10;
    const footnoteOpacity = interpolate(
        frame,
        [footnoteDelay, footnoteDelay + 20],
        [0.2, 0.6],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    return (
        <div
            style={{
                width: 1080,
                height: 1080,
                display: 'flex',
                flexDirection: 'column',
                padding: 80,
                position: 'relative',
                background: `radial-gradient(circle at 14% 16%, ${branding.accentColor}22 0%, transparent 42%), #0b1118`,
                overflow: 'hidden',
            }}
        >
            {/* Left accent stripe */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: 6,
                    height: '100%',
                    backgroundColor: branding.accentColor,
                }}
            />

            {/* Title */}
            <h2
                style={{
                    fontSize: 64,
                    fontWeight: 900,
                    color: 'white',
                    lineHeight: 1.3,
                    marginBottom: 24,
                    fontFamily: "'Montserrat', sans-serif",
                    transform: `translateY(${titleY}px)`,
                    opacity: titleOpacity,
                }}
            >
                {title}
            </h2>

            {/* Accent line */}
            <div
                style={{
                    width: 80,
                    height: 4,
                    marginBottom: 48,
                    backgroundColor: branding.accentColor,
                    transformOrigin: 'left',
                    transform: `scaleX(${lineScaleX})`,
                }}
            />

            {/* Numbered items */}
            <div
                style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: 28,
                }}
            >
                {items.length === 0 ? (
                    <p
                        style={{
                            fontSize: 30,
                            color: '#ef4444',
                            lineHeight: 1.4,
                            fontWeight: 700,
                            margin: 0,
                        }}
                    >
                        No list items provided
                    </p>
                ) : items.map((item: string, index: number) => {
                    const itemDelay = 18 + index * 8; // stagger by ~0.27s each
                    const s = spring({
                        frame: Math.max(0, frame - itemDelay),
                        fps,
                        config: { stiffness: 120, damping: 18 },
                    });
                    const itemX = interpolate(s, [0, 1], [-12, 0]);
                    const itemOpacity = interpolate(s, [0, 1], [0.4, 1]);

                    return (
                        <div
                            key={index}
                            style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 24,
                                transform: `translateX(${itemX}px)`,
                                opacity: itemOpacity,
                            }}
                        >
                            {/* Number badge */}
                            <div
                                style={{
                                    minWidth: 48,
                                    height: 48,
                                    borderRadius: 8,
                                    backgroundColor: branding.accentColor,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 24,
                                    fontWeight: 800,
                                    color: '#000',
                                    fontFamily: "'Montserrat', sans-serif",
                                }}
                            >
                                {index + 1}
                            </div>
                            {/* Item text */}
                            <p
                                style={{
                                    fontSize: 36,
                                    color: '#e5e7eb',
                                    lineHeight: 1.6,
                                    fontWeight: 500,
                                    margin: 0,
                                    paddingTop: 6,
                                }}
                            >
                                {item}
                            </p>
                        </div>
                    );
                })}
            </div>

            {/* Footnote */}
            {data.footnote && (
                <p
                    style={{
                        fontSize: 22,
                        color: '#6b7280',
                        fontStyle: 'italic',
                        marginTop: 24,
                        opacity: footnoteOpacity,
                    }}
                >
                    {data.footnote}
                </p>
            )}

            {/* Brand handle */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 40,
                    right: 48,
                    opacity: interpolate(frame, [0, 24], [0.3, 0.5], {
                        extrapolateLeft: 'clamp',
                        extrapolateRight: 'clamp',
                    }),
                }}
            >
                <span
                    style={{
                        fontSize: 22,
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        color: 'white',
                    }}
                >
                    {branding.handle}
                </span>
            </div>
        </div>
    );
}
