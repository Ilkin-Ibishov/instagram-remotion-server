import React from 'react';
import { registerRoot, Composition } from 'remotion';
import { SlideComposition } from './SlideComposition';
import { EditorialSlideComposition } from './EditorialSlideComposition';
import { EditorialReelComposition } from './EditorialReelComposition';
import { VerticalNativeComposition } from './VerticalNativeComposition';

const DEFAULT_FPS = 30;
const DEFAULT_DURATION_SECONDS = 24;

function parseCompositionFps(): number {
    const raw = process.env.COMPOSITION_FPS;
    if (!raw) {
        return DEFAULT_FPS;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 120) {
        return DEFAULT_FPS;
    }

    return parsed;
}

function parseDurationSeconds(): number {
    const raw = process.env.COMPOSITION_DURATION_SECONDS;
    if (!raw) {
        return DEFAULT_DURATION_SECONDS;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return DEFAULT_DURATION_SECONDS;
    }

    return parsed;
}

const FPS = parseCompositionFps();
const DURATION_IN_FRAMES = parseDurationSeconds() * FPS;

// Calculate duration from karaoke content + CTA hold window
function calculateVerticalNativeDuration(data: any, fps: number): number {
    const karaoke = data?.karaoke || [];
    if (karaoke.length === 0) {
        return DURATION_IN_FRAMES; // Fallback to default
    }
    // Find last karaoke endFrame
    const lastKaraokeEnd = Math.max(...karaoke.map((k: any) => k.endFrame));
    // Add CTA hold window (~3s = 90 frames @ 30fps)
    const ctaHoldFrames = Math.floor(3 * fps);
    return lastKaraokeEnd + ctaHoldFrames;
}

const RemotionRoot: React.FC = () => {
    return (
        <>
            {/* Original 1080×1080 square composition */}
            <Composition
                id="Slide"
                component={SlideComposition}
                width={1080}
                height={1080}
                fps={FPS}
                durationInFrames={DURATION_IN_FRAMES}
                defaultProps={{
                    templateId: 'HOOK_A',
                    data: {
                        headline: 'SAMPLE HEADLINE',
                        subheadline: 'This is a sample subheadline.',
                    },
                    branding: {
                        accentColor: '#ef4444',
                        handle: '@theinitial.dev',
                        effects: [] as string[],
                    },
                }}
            />

            {/* New 1080×1350 (4:5) editorial composition for Instagram Feed */}
            <Composition
                id="EditorialSlide"
                component={EditorialSlideComposition}
                width={1080}
                height={1350}
                fps={FPS}
                durationInFrames={DURATION_IN_FRAMES}
                defaultProps={{
                    templateId: 'HOOK_EDITORIAL',
                    data: {
                        headline: 'BREAKING\nNEWS\nTODAY',
                        microLabel: 'PSYCHOLOGY',
                        cta: 'SWIPE FOR MORE',
                    },
                    branding: {
                        niche: 'psychology-micro',
                        accentColor: '#8b5cf6',
                        handle: '@mindHacks',
                        effects: [] as string[],
                    },
                }}
            />

            {/* New 1080×1920 (9:16) editorial reel for Instagram Reels / TikTok / Shorts */}
            <Composition
                id="EditorialReel"
                component={EditorialReelComposition}
                width={1080}
                height={1920}
                fps={FPS}
                durationInFrames={DURATION_IN_FRAMES}
                defaultProps={{
                    templateId: 'HOOK_EDITORIAL_REEL',
                    data: {
                        headline: 'YOUR BRAIN\nLIES TO YOU\nEVERY DAY',
                        microLabel: 'PSYCHOLOGY',
                        cta: 'FOLLOW FOR MORE',
                    },
                    branding: {
                        niche: 'psychology-micro',
                        accentColor: '#8b5cf6',
                        handle: '@mindHacks',
                        effects: [] as string[],
                    },
                }}
            />

            {/* New 1080×1920 (9:16) vertical native for TikTok / Shorts (motion-first) */}
            <Composition
                id="VerticalNative"
                component={VerticalNativeComposition}
                width={1080}
                height={1920}
                fps={FPS}
                durationInFrames={DURATION_IN_FRAMES}
                calculateMetadata={({ props }) => {
                    const duration = calculateVerticalNativeDuration(props.data, FPS);
                    return {
                        durationInFrames: duration,
                        fps: FPS,
                    };
                }}
                defaultProps={{
                    templateId: 'HOOK_VERTICAL_NATIVE',
                    data: {
                        hookLines: ['YOUR BRAIN', 'LIES TO YOU', 'EVERY DAY'],
                        cta: 'FOLLOW',
                    },
                    branding: {
                        niche: 'psychology-micro',
                        accentColor: '#8b5cf6',
                        handle: '@mindHacks',
                        effects: [] as string[],
                    },
                }}
            />

            {/* New 1080×1920 (9:16) vertical beat scenes for TikTok / Shorts (study-hacks) */}
            <Composition
                id="VerticalBeatScenes"
                component={VerticalNativeComposition}
                width={1080}
                height={1920}
                fps={FPS}
                calculateMetadata={({ props }) => {
                    const beats = props.data?.beats || [];
                    if (beats.length === 0) return { durationInFrames: DURATION_IN_FRAMES, fps: FPS };
                    const lastBeat = beats[beats.length - 1];
                    const totalDuration = Math.ceil(lastBeat.sec[1] * FPS);
                    return {
                        durationInFrames: totalDuration,
                        fps: FPS,
                    };
                }}
                defaultProps={{
                    templateId: 'VERTICAL_BEAT_SCENES',
                    data: {
                        beats: [
                            { id: 'stop', sec: [0, 2.5], captionKaraoke: ['STOP', 'rereading ≠ studying'] },
                            { id: 'why', sec: [2.5, 9], captionKaraoke: ['feels productive', 'quiz day blank'] },
                            { id: 's1', sec: [9, 14], captionKaraoke: ['close the book', 'write everything'] },
                            { id: 's2', sec: [14, 18], captionKaraoke: ['mark the gaps'] },
                            { id: 's3', sec: [18, 23], captionKaraoke: ['holes not chapter'] },
                            { id: 'cta', sec: [23, 28], captionKaraoke: ['Try tonight', 'cooked or not'] },
                        ],
                    },
                    branding: {
                        niche: 'study-hacks',
                        accentColor: '#06b6d4',
                        handle: '@studyhackswithme',
                        effects: [] as string[],
                    },
                }}
            />
        </>
    );
};

registerRoot(RemotionRoot);
