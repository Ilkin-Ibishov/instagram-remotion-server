import React from 'react';
import { registerRoot, Composition } from 'remotion';
import { SlideComposition } from './SlideComposition';

const RemotionRoot: React.FC = () => {
    return (
        <>
            <Composition
                id="Slide"
                component={SlideComposition}
                width={1080}
                height={1080}
                fps={30}
                durationInFrames={720}
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
