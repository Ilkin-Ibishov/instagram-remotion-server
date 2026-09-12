import React from 'react';
import { useCurrentFrame, interpolate, Video, Img, useVideoConfig } from 'remotion';
import { Play } from 'lucide-react';
import { lineClamp, singleLineEllipsis } from './textOverflow';
import { getDesignTokens, getNicheFromBranding } from '../remotion/designTokens';

function VideoWithFallback({
    videoUrl,
    fallbackImageUrl,
    backgroundColor,
}: {
    videoUrl?: string;
    fallbackImageUrl?: string;
    backgroundColor: string;
}) {
    const [hasError, setHasError] = React.useState(false);

    if (!videoUrl || hasError) {
        if (fallbackImageUrl) {
            return (
                <Img
                    src={fallbackImageUrl}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                    }}
                />
            );
        }

        return (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    background: backgroundColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Play
                    style={{
                        color: 'rgba(255,255,255,0.2)',
                        width: 80,
                        height: 80,
                    }}
                />
            </div>
        );
    }

    return (
        <Video
            src={videoUrl}
            style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
            }}
            onError={() => setHasError(true)}
        />
    );
}

/**
 * CONTENT_VIDEO — for news stories that include video footage.
 *
 * Expected data shape:
 *  {
 *    title: string;              // headline overlay on the video
 *    caption?: string;           // short description below the video
 *    videoUrl: string;           // remote URL to the video file (mp4)
 *    source?: string;            // credit / "Source: Reuters" etc.
 *  }
 *
 * The video plays embedded inside a bordered frame with a title overlay,
 * giving a premium news broadcast feel.
 */
export default function ContentVideo({
    data,
    branding,
}: {
    data: any;
    branding: any;
}) {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const niche = getNicheFromBranding(branding);
    const tokens = getDesignTokens(niche);

    const title = data.title || 'Video Details';

    const transitionDur = tokens.motion.transitionDuration;

    const frameBorderScale = interpolate(frame, [0, transitionDur * 0.7], [0.5, 1], {
        extrapolateRight: 'clamp',
    });

    const videoOpacity = interpolate(frame, [0, transitionDur * 0.7], [0.6, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const titleY = interpolate(frame, [0, transitionDur], [10, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const titleOpacity = interpolate(frame, [0, transitionDur], [0.6, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const captionOpacity = interpolate(frame, [0, transitionDur], [0.4, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const sourceOpacity = interpolate(frame, [0, transitionDur * 1.2], [0.3, 0.7], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const pulseOpacity = interpolate(
        frame % 30,
        [0, 15, 30],
        [1, 0.5, 1],
        { extrapolateRight: 'clamp' }
    );

    return (
        <div
            style={{
                width: 1080,
                height: 1080,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                position: 'relative',
                background: tokens.colors.backgroundGradient,
                overflow: 'hidden',
                paddingTop: tokens.safeZones.top,
                paddingBottom: tokens.safeZones.bottom,
                paddingLeft: tokens.safeZones.sides,
                paddingRight: tokens.safeZones.sides,
            }}
        >
            {/* Top accent bar */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: 4,
                    backgroundColor: tokens.colors.primary,
                    transformOrigin: 'left',
                    transform: `scaleX(${frameBorderScale})`,
                }}
            />

            {/* Video frame container */}
            <div
                style={{
                    width: Math.min(920, 1080 - tokens.safeZones.sides * 2),
                    height: 520,
                    position: 'relative',
                    borderRadius: 12,
                    overflow: 'hidden',
                    border: `3px solid ${tokens.colors.border}`,
                    opacity: videoOpacity,
                }}
            >
                <VideoWithFallback
                    videoUrl={data.videoUrl}
                    fallbackImageUrl={data.imageUrl}
                    backgroundColor={tokens.colors.background}
                />

                {/* LIVE indicator */}
                <div
                    style={{
                        position: 'absolute',
                        top: tokens.spacing.sm,
                        left: tokens.spacing.sm,
                        display: 'flex',
                        alignItems: 'center',
                        gap: tokens.spacing.xs,
                        opacity: titleOpacity,
                    }}
                >
                    <div
                        style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            backgroundColor: tokens.colors.primary,
                            opacity: pulseOpacity,
                        }}
                    />
                    <span
                        style={{
                            fontSize: 14,
                            fontWeight: tokens.typography.weight.black,
                            letterSpacing: '0.1em',
                            color: tokens.colors.text,
                            textTransform: 'uppercase',
                        }}
                    >
                        VIDEO
                    </span>
                </div>

                {/* Title overlay */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        padding: `${tokens.spacing.xl}px ${tokens.spacing.md}px ${tokens.spacing.md}px`,
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.92))',
                        transform: `translateY(${titleY}px)`,
                        opacity: titleOpacity,
                    }}
                >
                    <h2
                        style={{
                            fontSize: tokens.typography.bodySize - 2,
                            fontWeight: tokens.typography.weight.black,
                            color: tokens.colors.text,
                            lineHeight: tokens.typography.lineHeight.tight,
                            margin: 0,
                            fontFamily: "'Montserrat', sans-serif",
                            ...lineClamp(2, 860),
                        }}
                    >
                        {title}
                    </h2>
                </div>
            </div>

            {/* Caption below video */}
            {data.caption && (
                <p
                    style={{
                        fontSize: tokens.typography.bodySize - 8,
                        color: tokens.colors.textSecondary,
                        textAlign: 'center',
                        maxWidth: 760,
                        lineHeight: tokens.typography.lineHeight.normal,
                        marginTop: tokens.spacing.lg,
                        fontWeight: tokens.typography.weight.medium,
                        opacity: captionOpacity,
                        ...lineClamp(3, 760),
                    }}
                >
                    {data.caption}
                </p>
            )}

            {/* Source credit */}
            {data.source && (
                <p
                    style={{
                        fontSize: tokens.typography.captionSize - 4,
                        color: tokens.colors.textSecondary,
                        marginTop: tokens.spacing.sm,
                        opacity: sourceOpacity,
                        ...singleLineEllipsis(800),
                    }}
                >
                    Source: {data.source}
                </p>
            )}

            {/* Brand handle */}
            <div
                style={{
                    position: 'absolute',
                    bottom: tokens.safeZones.bottom - tokens.spacing.sm,
                    left: tokens.safeZones.sides,
                    display: 'flex',
                    alignItems: 'center',
                    gap: tokens.spacing.sm,
                    opacity: sourceOpacity,
                }}
            >
                <span
                    style={{
                        fontSize: tokens.typography.captionSize - 2,
                        fontWeight: tokens.typography.weight.bold,
                        letterSpacing: '0.05em',
                        color: tokens.colors.text,
                        ...singleLineEllipsis(400),
                    }}
                >
                    {branding.handle}
                </span>
            </div>
        </div>
    );
}
