import React from 'react';
import HookEditorial from '../templates/HookEditorial';
import { EffectsOverlay } from '../components/EffectsOverlay';

export type EditorialSlideProps = {
    templateId: string;
    data: Record<string, any>;
    branding: {
        niche?: string;
        accentColor: string;
        handle: string;
        effects: string[];
    };
};

export const EditorialSlideComposition: React.FC<EditorialSlideProps> = ({
    templateId,
    data,
    branding,
}) => {
    const templateMap: Record<string, React.FC<{ data: any; branding: any }>> = {
        HOOK_EDITORIAL: HookEditorial,
        // Future: CONTENT_EDITORIAL, etc.
    };

    const Template = templateMap[templateId];

    if (!Template) {
        return (
            <div
                style={{
                    width: 1080,
                    height: 1350,
                    background: '#0a0a0a',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 32,
                }}
            >
                Unknown editorial template: {templateId}
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
                height: 1350,
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            <Template data={data} branding={safeBranding} />
            <EffectsOverlay effects={safeBranding.effects} />
        </div>
    );
};
