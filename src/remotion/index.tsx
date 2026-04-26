import React from 'react';
import { registerRoot, Composition } from 'remotion';
import { SlideComposition } from './SlideComposition';

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

const RemotionRoot: React.FC = () => {
    return (
        <>
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
        </>
    );
};

registerRoot(RemotionRoot);
