import React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { getDesignTokens, getNicheFromBranding } from '../remotion/designTokens';
import { StopBeat } from './beats/StopBeat';
import { WhyBeat } from './beats/WhyBeat';
import { Step1Beat } from './beats/Step1Beat';
import { Step2Beat } from './beats/Step2Beat';
import { Step3Beat } from './beats/Step3Beat';
import { CtaBeat } from './beats/CtaBeat';

type Beat = {
    id: string;
    sec: [number, number];
    captionKaraoke: string[];
};

type VerticalBeatScenesProps = {
    data: {
        beats: Beat[];
    };
    branding: {
        niche?: string;
        accentColor: string;
        handle: string;
        effects: string[];
    };
};

const VerticalBeatScenes: React.FC<VerticalBeatScenesProps> = ({ data, branding }) => {
    const { fps } = useVideoConfig();
    const niche = getNicheFromBranding(branding);
    const tokens = getDesignTokens(niche);

    const beats = data.beats || [];

    const renderBeat = (beat: Beat, index: number) => {
        const startFrame = Math.floor(beat.sec[0] * fps);
        const endFrame = Math.floor(beat.sec[1] * fps);
        const duration = endFrame - startFrame;

        switch (beat.id) {
            case 'stop':
                return (
                    <Sequence key={beat.id} from={startFrame} durationInFrames={duration}>
                        <StopBeat
                            startFrame={startFrame}
                            endFrame={endFrame}
                            captions={beat.captionKaraoke}
                            tokens={tokens}
                        />
                    </Sequence>
                );
            case 'why':
                return (
                    <Sequence key={beat.id} from={startFrame} durationInFrames={duration}>
                        <WhyBeat
                            startFrame={startFrame}
                            endFrame={endFrame}
                            captions={beat.captionKaraoke}
                            tokens={tokens}
                        />
                    </Sequence>
                );
            case 's1':
                return (
                    <Sequence key={beat.id} from={startFrame} durationInFrames={duration}>
                        <Step1Beat
                            startFrame={startFrame}
                            endFrame={endFrame}
                            captions={beat.captionKaraoke}
                            tokens={tokens}
                        />
                    </Sequence>
                );
            case 's2':
                return (
                    <Sequence key={beat.id} from={startFrame} durationInFrames={duration}>
                        <Step2Beat
                            startFrame={startFrame}
                            endFrame={endFrame}
                            captions={beat.captionKaraoke}
                            tokens={tokens}
                        />
                    </Sequence>
                );
            case 's3':
                return (
                    <Sequence key={beat.id} from={startFrame} durationInFrames={duration}>
                        <Step3Beat
                            startFrame={startFrame}
                            endFrame={endFrame}
                            captions={beat.captionKaraoke}
                            tokens={tokens}
                        />
                    </Sequence>
                );
            case 'cta':
                return (
                    <Sequence key={beat.id} from={startFrame} durationInFrames={duration}>
                        <CtaBeat
                            startFrame={startFrame}
                            endFrame={endFrame}
                            handle={branding.handle}
                            tokens={tokens}
                        />
                    </Sequence>
                );
            default:
                return null;
        }
    };

    return (
        <AbsoluteFill
            style={{
                width: 1080,
                height: 1920,
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            {beats.map((beat, index) => renderBeat(beat, index))}

            <div
                style={{
                    position: 'absolute',
                    top: 30,
                    right: 30,
                    fontSize: 16,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.4)',
                    fontFamily: "'Montserrat', sans-serif",
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                }}
            >
                {branding.handle}
            </div>
        </AbsoluteFill>
    );
};

export default VerticalBeatScenes;
