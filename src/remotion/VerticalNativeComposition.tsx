import React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { SlideComposition } from './SlideComposition';

export type VerticalNativeSlide = {
    templateId: string;
    data: Record<string, any>;
    durationSeconds: number;
};

export type VerticalNativeProps = {
    slides: VerticalNativeSlide[];
    branding: {
        niche?: string;
        accentColor: string;
        handle: string;
        effects: string[];
    };
};

export const VerticalNativeComposition: React.FC<VerticalNativeProps> = ({
    slides,
    branding,
}) => {
    const { fps } = useVideoConfig();

    let currentFrame = 0;

    return (
        <AbsoluteFill>
            {slides.map((slide, index) => {
                const durationInFrames = Math.round(slide.durationSeconds * fps);
                const from = currentFrame;
                currentFrame += durationInFrames;

                return (
                    <Sequence
                        key={index}
                        from={from}
                        durationInFrames={durationInFrames}
                    >
                        <SlideComposition
                            templateId={slide.templateId}
                            data={slide.data}
                            branding={branding}
                        />
                    </Sequence>
                );
            })}
        </AbsoluteFill>
    );
};
