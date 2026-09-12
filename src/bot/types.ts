// Niche Voice Schema (source of truth for content bots)
export interface NicheVoiceManifest {
    fps: number;
    aspectRatio: string;
    durationSec: number;
    format: 'faceless-slideshow';
    generatedBy: string;
    date: string;
    niche: string;
    title: string;
    topic: string;
    voice: {
        tone: string;
        style: string;
        banned: string[];
    };
    slides: NicheVoiceSlide[];
    captions: {
        instagram: string;
        tiktok: string;
        youtubeShorts: string;
        hashtags: string[];
    };
}

export interface NicheVoiceSlide {
    id: string;
    role: string;
    startSec: number;
    durationSec: number;
    headline: string;
    body: string;
    karaoke: string[];
    visual: {
        palette: string;
        motif: string;
        cutHint: string;
    };
}

// Bot Intake Payload (target schema for Remotion render)
export interface BotIntakePayload {
    nicheId: string;
    manifest: {
        manifest: {
            format: 'mp4';
            globalBranding: {
                accentColor: string;
                handle: string;
                effects: string[];
            };
            carousel: CarouselSlide[];
        };
        caption: string;
        hashtags: string;
    };
}

export interface CarouselSlide {
    templateId: string;
    data: Record<string, any>;
}

// Niche configuration
export interface NicheConfig {
    nicheId: string;
    accentColor: string;
    handle: string;
    effects: string[];
}
