import React from 'react';
import HookEditorialReel from '../templates/HookEditorialReel';
import { EffectsOverlay } from '../components/EffectsOverlay';

export type EditorialReelProps = {
    templateId: string;
    data: Record<string, any>;
    branding: {
        niche?: string;
        accentColor: string;
        handle: string;
        effects: string[];
    };
};

export const EditorialReelComposition: React.FC<EditorialReelProps> = ({
    templateId,
    data,
    branding,
}) => {
    const templateMap: Record<string, React.FC<{ data: any; branding: any }>> = {
        HOOK_EDITORIAL_REEL: HookEditorialReel,
        // Future: CONTENT_EDITORIAL_REEL, etc.
    };

    const Template = templateMap[templateId];

    if (!Template) {
        return (
            <div
                style={{
                    width: 1080,
                    height: 1920,
                    background: '#0a0a0a',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 32,
                }}
            >
                Unknown editorial reel template: {templateId}
            </div>
        );
    }

    const safeBranding = {
        niche: branding?.niche,
        accentColor: branding?.accentColor || '#ef4444',
        handle: branding?.handle || '',
        effects: Array.isArray(branding?.effects) ? branding.effects : [],
    };

    return (
        <div
            style={{
                width: 1080,
                height: 1920,
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            <Template data={data} branding={safeBranding} />
            <EffectsOverlay effects={safeBranding.effects} />
        </div>
    );
};
