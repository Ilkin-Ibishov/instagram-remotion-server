import React from 'react';
import { useCurrentFrame, interpolate, Video, Img, useVideoConfig } from 'remotion';
import { Play } from 'lucide-react';

function VideoWithFallback({
    videoUrl,
    fallbackImageUrl,
}: {
    videoUrl?: string;
    fallbackImageUrl?: string;
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
                    background: 'linear-gradient(135deg, #1a1a2e 0%, #0a0a0a 100%)',
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

    const title = data.title || 'Video Details';

    const frameBorderScale = interpolate(frame, [0, 18], [0.35, 1], {
        extrapolateRight: 'clamp',
    });

    const videoOpacity = interpolate(frame, [0, 18], [0.5, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const titleY = interpolate(frame, [0, 24], [12, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const titleOpacity = interpolate(frame, [0, 24], [0.5, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const captionOpacity = interpolate(frame, [0, 24], [0.3, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const sourceOpacity = interpolate(frame, [0, 30], [0.25, 0.6], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // "LIVE" / play indicator pulse
    const pulseOpacity = interpolate(
        frame % 30,
        [0, 15, 30],
        [1, 0.4, 1],
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
                padding: 60,
                position: 'relative',
                background: `radial-gradient(circle at 20% 14%, ${branding.accentColor}24 0%, transparent 44%), #091018`,
                overflow: 'hidden',
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
                    backgroundColor: branding.accentColor,
                    transformOrigin: 'left',
                    transform: `scaleX(${frameBorderScale})`,
                }}
            />

            {/* Video frame container */}
            <div
                style={{
                    width: 960,
                    height: 540,
                    position: 'relative',
                    borderRadius: 8,
                    overflow: 'hidden',
                    border: `2px solid rgba(255,255,255,0.1)`,
                    opacity: videoOpacity,
                }}
            >
                {/* Video element with runtime fallback on load/codec errors */}
                <VideoWithFallback
                    videoUrl={data.videoUrl}
                    fallbackImageUrl={data.imageUrl}
                />

                {/* LIVE indicator (top-left corner of video) */}
                <div
                    style={{
                        position: 'absolute',
                        top: 16,
                        left: 16,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        opacity: titleOpacity,
                    }}
                >
                    <div
                        style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            backgroundColor: branding.accentColor,
                            opacity: pulseOpacity,
                        }}
                    />
                    <span
                        style={{
                            fontSize: 16,
                            fontWeight: 800,
                            letterSpacing: '0.1em',
                            color: 'white',
                            textTransform: 'uppercase',
                        }}
                    >
                        VIDEO
                    </span>
                </div>

                {/* Title overlay — bottom of video frame */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        padding: '48px 24px 20px 24px',
                        background:
                            'linear-gradient(transparent, rgba(0,0,0,0.9))',
                        transform: `translateY(${titleY}px)`,
                        opacity: titleOpacity,
                    }}
                >
                    <h2
                        style={{
                            fontSize: 36,
                            fontWeight: 800,
                            color: 'white',
                            lineHeight: 1.2,
                            margin: 0,
                            fontFamily: "'Montserrat', sans-serif",
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
                        fontSize: 28,
                        color: '#d1d5db',
                        textAlign: 'center',
                        maxWidth: 800,
                        lineHeight: 1.5,
                        marginTop: 40,
                        fontWeight: 500,
                        opacity: captionOpacity,
                    }}
                >
                    {data.caption}
                </p>
            )}

            {/* Source credit */}
            {data.source && (
                <p
                    style={{
                        fontSize: 20,
                        color: '#6b7280',
                        marginTop: 16,
                        opacity: sourceOpacity,
                    }}
                >
                    Source: {data.source}
                </p>
            )}

            {/* Brand handle */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 40,
                    left: 60,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    opacity: sourceOpacity,
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
