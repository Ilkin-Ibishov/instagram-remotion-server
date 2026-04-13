import React from 'react';
import HookA from '../templates/HookA';
import ContentGeneric from '../templates/ContentGeneric';
import ContentListicle from '../templates/ContentListicle';
import ContentStatSnapshot from '../templates/ContentStatSnapshot';
import ContentMythVsFact from '../templates/ContentMythVsFact';
import ContentVideo from '../templates/ContentVideo';
import CtaFinal from '../templates/CtaFinal';
import { EffectsOverlay } from '../components/EffectsOverlay';

export type SlideProps = {
    templateId: string;
    data: Record<string, any>;
    branding: {
        accentColor: string;
        handle: string;
        effects: string[];
    };
};

export const SlideComposition: React.FC<SlideProps> = ({
    templateId,
    data,
    branding,
}) => {
    const templateMap: Record<string, React.FC<{ data: any; branding: any }>> = {
        HOOK_A: HookA,
        CONTENT_GENERIC: ContentGeneric,
        CONTENT_LISTICLE: ContentListicle,
        CONTENT_STAT_SNAPSHOT: ContentStatSnapshot,
        CONTENT_MYTH_VS_FACT: ContentMythVsFact,
        CONTENT_VIDEO: ContentVideo,
        CTA_FINAL: CtaFinal,
    };

    const Template = templateMap[templateId];

    if (!Template) {
        return (
            <div
                style={{
                    width: 1080,
                    height: 1080,
                    background: '#0a0a0a',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 32,
                }}
            >
                Unknown template: {templateId}
            </div>
        );
    }

    const safeBranding = {
        accentColor: branding?.accentColor || '#ef4444',
        handle: branding?.handle || '',
        effects: Array.isArray(branding?.effects) ? branding.effects : [],
    };

    return (
        <div
            style={{
                width: 1080,
                height: 1080,
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            <Template data={data} branding={safeBranding} />
            <EffectsOverlay effects={safeBranding.effects} />
        </div>
    );
};
