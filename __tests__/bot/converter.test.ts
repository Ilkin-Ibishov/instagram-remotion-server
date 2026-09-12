import { describe, it, expect } from 'vitest';
import { convertNicheVoiceManifest } from '../../src/bot/converter';
import type { NicheVoiceManifest } from '../../src/bot/types';

describe('convertNicheVoiceManifest', () => {
    it('converts psychology-micro sample to valid bot intake', () => {
        const input: NicheVoiceManifest = {
            fps: 30,
            aspectRatio: '9:16',
            durationSec: 30,
            format: 'faceless-slideshow',
            generatedBy: 'niche-voice',
            date: '2026-09-12',
            niche: 'psychology-micro',
            title: 'Why one viral story feels like EVERYONE',
            topic: 'Availability cascade vs base rates',
            voice: {
                tone: 'calm-smart friend who catches you mid-spiral',
                style: 'short punch lines; name the bias once; one everyday mirror; never clinical lecture',
                banned: [
                    'you are broken',
                    'everyone is stupid',
                    'diagnosing the viewer',
                ],
            },
            slides: [
                {
                    id: 'myth',
                    role: 'MYTH',
                    startSec: 0,
                    durationSec: 3,
                    headline: 'MYTH',
                    body: "If it's everywhere in my feed… it's happening to everyone.",
                    karaoke: ['MYTH', 'everywhere = everyone'],
                    visual: {
                        palette: 'warning-red on black',
                        motif: 'bold MYTH stamp card',
                        cutHint: 'hard punch in',
                    },
                },
                {
                    id: 'fact',
                    role: 'FACT',
                    startSec: 10,
                    durationSec: 8,
                    headline: 'FACT · availability cascade',
                    body: 'Repeat a vivid claim → it feels common → people talk → it feels even more common. Frequency in attention ≠ frequency in reality.',
                    karaoke: [
                        'FACT',
                        'availability cascade',
                        'attention ≠ reality',
                    ],
                    visual: {
                        palette: 'calm green',
                        motif: 'FACT card + keyword flash AVAILABILITY',
                        cutHint: 'zoom on bias name',
                    },
                },
                {
                    id: 'cta',
                    role: 'CTA',
                    startSec: 24,
                    durationSec: 6,
                    headline: 'Which myth next',
                    body: 'Save this. Comment the bias you catch yourself using this week.',
                    karaoke: ['Which myth next?', 'comment the bias'],
                    visual: {
                        palette: 'soft series end-card',
                        motif: 'series chip: myth vs fact',
                        cutHint: 'hold',
                    },
                },
            ],
            captions: {
                instagram:
                    'Myth: if it is all over my feed, it is happening to everyone.\n\nFact: that is an availability cascade — loud stories feel common even when base rates barely moved.\n\nCatch yourself today: drama can travel farther than the numbers.\n\nWhich bias should we bust next? Comment it.\n\nmyth vs fact · bias you used today',
                tiktok:
                    'your feed lied (kind of)\n\none viral story not equal everyone\nthat is availability cascade vs real base rates\n\ncomment the bias you catch yourself doing',
                youtubeShorts:
                    'Why one dramatic story feels like everyone — even when the stats did not move.\n\nAvailability cascade vs base rates, in 30 seconds.\n\nWhich myth should we do next?',
                hashtags: [
                    'psychology',
                    'cognitivebias',
                    'mythvsfact',
                    'availabilityheuristic',
                    'shorts',
                ],
            },
        };

        const result = convertNicheVoiceManifest(input);

        // Check structure
        expect(result.nicheId).toBe('psychology-micro');
        expect(result.manifest.manifest.format).toBe('mp4');
        expect(result.manifest.manifest.globalBranding.accentColor).toBe(
            '#ef4444'
        );
        expect(result.manifest.manifest.globalBranding.handle).toBe(
            '@psych.bites'
        );

        // Check carousel
        const carousel = result.manifest.manifest.carousel;
        expect(carousel.length).toBeGreaterThanOrEqual(3);
        expect(carousel.length).toBeLessThanOrEqual(5);

        // Check distinct templates
        const templates = new Set(carousel.map((s) => s.templateId));
        expect(templates.size).toBeGreaterThanOrEqual(3);

        // Check MYTH+FACT pair mapped to CONTENT_MYTH_VS_FACT
        const mythVsFactSlide = carousel.find(
            (s) => s.templateId === 'CONTENT_MYTH_VS_FACT'
        );
        expect(mythVsFactSlide).toBeDefined();
        expect(mythVsFactSlide?.data.myth).toContain('everywhere');
        expect(mythVsFactSlide?.data.fact).toContain('Repeat a vivid claim');

        // Check CTA mapped and ends with ?
        const ctaSlide = carousel.find((s) => s.templateId === 'CTA_FINAL');
        expect(ctaSlide).toBeDefined();
        expect(ctaSlide?.data.callToAction).toMatch(/\?$/);

        // Check caption quality gates (4-8 lines)
        const captionLines = result.manifest.caption
            .split('\n')
            .filter((l) => l.trim().length > 0);
        expect(captionLines.length).toBeGreaterThanOrEqual(4);
        expect(captionLines.length).toBeLessThanOrEqual(8);

        // Check hashtags (3-30)
        const hashtagCount = result.manifest.hashtags.split('#').length - 1;
        expect(hashtagCount).toBeGreaterThanOrEqual(3);
        expect(hashtagCount).toBeLessThanOrEqual(30);
    });

    it('maps HOOK role to HOOK_A template', () => {
        const input: NicheVoiceManifest = {
            fps: 30,
            aspectRatio: '9:16',
            durationSec: 15,
            format: 'faceless-slideshow',
            generatedBy: 'niche-voice',
            date: '2026-09-12',
            niche: 'history-flash',
            title: 'Test',
            topic: 'Test',
            voice: { tone: '', style: '', banned: [] },
            slides: [
                {
                    id: 'hook',
                    role: 'HOOK',
                    startSec: 0,
                    durationSec: 5,
                    headline: 'STOP SCROLLING',
                    body: 'This will blow your mind',
                    karaoke: [],
                    visual: { palette: '', motif: '', cutHint: '' },
                },
                {
                    id: 'content',
                    role: 'CONTEXT',
                    startSec: 5,
                    durationSec: 5,
                    headline: 'Context',
                    body: 'Here is some context',
                    karaoke: [],
                    visual: { palette: '', motif: '', cutHint: '' },
                },
                {
                    id: 'cta',
                    role: 'CTA',
                    startSec: 10,
                    durationSec: 5,
                    headline: 'Follow for more',
                    body: 'Subscribe now',
                    karaoke: [],
                    visual: { palette: '', motif: '', cutHint: '' },
                },
            ],
            captions: {
                instagram: 'Test caption\nLine 2\nLine 3\nLine 4',
                tiktok: '',
                youtubeShorts: '',
                hashtags: ['history', 'facts', 'learn'],
            },
        };

        const result = convertNicheVoiceManifest(input);
        const hookSlide = result.manifest.manifest.carousel[0];

        expect(hookSlide.templateId).toBe('HOOK_A');
        expect(hookSlide.data.headline).toBe('STOP SCROLLING');
        expect(hookSlide.data.subheadline).toBe('This will blow your mind');
    });

    it('maps generic roles to CONTENT_GENERIC', () => {
        const input: NicheVoiceManifest = {
            fps: 30,
            aspectRatio: '9:16',
            durationSec: 15,
            format: 'faceless-slideshow',
            generatedBy: 'niche-voice',
            date: '2026-09-12',
            niche: 'ai-tools-daily',
            title: 'Test',
            topic: 'Test',
            voice: { tone: '', style: '', banned: [] },
            slides: [
                {
                    id: 'hook',
                    role: 'HOOK',
                    startSec: 0,
                    durationSec: 3,
                    headline: 'Stop scrolling',
                    body: 'This AI tool will change everything',
                    karaoke: [],
                    visual: { palette: '', motif: '', cutHint: '' },
                },
                {
                    id: 'why',
                    role: 'WHY',
                    startSec: 3,
                    durationSec: 5,
                    headline: 'Why this matters',
                    body: 'Because reasons',
                    karaoke: [],
                    visual: { palette: '', motif: '', cutHint: '' },
                },
                {
                    id: 'context',
                    role: 'CONTEXT',
                    startSec: 8,
                    durationSec: 5,
                    headline: 'The Context',
                    body: 'Some background',
                    karaoke: [],
                    visual: { palette: '', motif: '', cutHint: '' },
                },
                {
                    id: 'bad',
                    role: 'BAD PROMPT',
                    startSec: 13,
                    durationSec: 5,
                    headline: 'Bad Example',
                    body: 'Do not do this',
                    karaoke: [],
                    visual: { palette: '', motif: '', cutHint: '' },
                },
                {
                    id: 'cta',
                    role: 'CTA',
                    startSec: 18,
                    durationSec: 5,
                    headline: 'Try it',
                    body: 'Test this today',
                    karaoke: [],
                    visual: { palette: '', motif: '', cutHint: '' },
                },
            ],
            captions: {
                instagram: 'Test caption\nLine 2\nLine 3\nLine 4',
                tiktok: '',
                youtubeShorts: '',
                hashtags: ['ai', 'tools', 'productivity'],
            },
        };

        const result = convertNicheVoiceManifest(input);
        const genericSlides = result.manifest.manifest.carousel.filter(
            (s) => s.templateId === 'CONTENT_GENERIC'
        );

        expect(genericSlides.length).toBeGreaterThan(0);
    });

    it('throws error for unknown niche', () => {
        const input: NicheVoiceManifest = {
            fps: 30,
            aspectRatio: '9:16',
            durationSec: 15,
            format: 'faceless-slideshow',
            generatedBy: 'niche-voice',
            date: '2026-09-12',
            niche: 'unknown-niche',
            title: 'Test',
            topic: 'Test',
            voice: { tone: '', style: '', banned: [] },
            slides: [
                {
                    id: 'test',
                    role: 'HOOK',
                    startSec: 0,
                    durationSec: 5,
                    headline: 'Test',
                    body: 'Test',
                    karaoke: [],
                    visual: { palette: '', motif: '', cutHint: '' },
                },
            ],
            captions: {
                instagram: 'Test',
                tiktok: '',
                youtubeShorts: '',
                hashtags: ['test'],
            },
        };

        expect(() => convertNicheVoiceManifest(input)).toThrow('Unknown niche');
    });

    it('enforces minimum 3 slides', () => {
        const input: NicheVoiceManifest = {
            fps: 30,
            aspectRatio: '9:16',
            durationSec: 10,
            format: 'faceless-slideshow',
            generatedBy: 'niche-voice',
            date: '2026-09-12',
            niche: 'study-hacks',
            title: 'Test',
            topic: 'Test',
            voice: { tone: '', style: '', banned: [] },
            slides: [
                {
                    id: 'slide1',
                    role: 'HOOK',
                    startSec: 0,
                    durationSec: 5,
                    headline: 'Test',
                    body: 'Test',
                    karaoke: [],
                    visual: { palette: '', motif: '', cutHint: '' },
                },
            ],
            captions: {
                instagram: 'Test',
                tiktok: '',
                youtubeShorts: '',
                hashtags: ['test'],
            },
        };

        expect(() => convertNicheVoiceManifest(input)).toThrow(
            'need at least 3'
        );
    });
});
