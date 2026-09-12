import type {
    NicheVoiceManifest,
    NicheVoiceSlide,
    BotIntakePayload,
    CarouselSlide,
} from './types';
import { getNicheConfig } from './nicheConfig';

/**
 * Map niche-voice slide roles to Remotion template IDs
 */
function mapRoleToTemplate(
    slide: NicheVoiceSlide,
    allSlides: NicheVoiceSlide[]
): { templateId: string; data: Record<string, any> } | null {
    const role = slide.role.toUpperCase();

    // HOOK slides → HOOK_A
    if (
        role === 'MYTH' ||
        role === 'HOOK' ||
        role === 'STOP' ||
        role === 'SCENARIO' ||
        role === 'OUTCOME' ||
        role === 'HOOK STILL'
    ) {
        return {
            templateId: 'HOOK_A',
            data: {
                headline: slide.headline,
                subheadline: slide.body,
                imageUrl: null,
            },
        };
    }

    // MYTH + FACT pair → CONTENT_MYTH_VS_FACT
    if (role === 'FACT') {
        // Look for preceding MYTH slide (not necessarily immediate)
        const slideIndex = allSlides.indexOf(slide);
        let mythSlide: NicheVoiceSlide | null = null;

        for (let i = slideIndex - 1; i >= 0; i--) {
            if (allSlides[i].role.toUpperCase() === 'MYTH') {
                mythSlide = allSlides[i];
                break;
            }
        }

        if (mythSlide) {
            return {
                templateId: 'CONTENT_MYTH_VS_FACT',
                data: {
                    myth: mythSlide.body,
                    fact: slide.body,
                    proof: slide.headline,
                },
            };
        }

        // Standalone FACT → use myth/fact from same slide
        return {
            templateId: 'CONTENT_MYTH_VS_FACT',
            data: {
                myth: slide.headline,
                fact: slide.body,
                proof: 'Evidence-based',
            },
        };
    }

    // CTA slides → CTA_FINAL
    if (
        role === 'CTA' ||
        role === 'DISCLAIMER CTA' ||
        role === 'TRY TONIGHT'
    ) {
        let callToAction = slide.headline;
        // Ensure CTA ends with ?
        if (!callToAction.endsWith('?')) {
            callToAction = callToAction + '?';
        }

        return {
            templateId: 'CTA_FINAL',
            data: {
                callToAction,
                subtext: slide.body,
            },
        };
    }

    // List-style content → CONTENT_LISTICLE
    if (
        role.startsWith('PRINCIPLE_') ||
        role.startsWith('STEP_') ||
        role === 'CHECK'
    ) {
        // Try to extract list items from body
        const lines = slide.body.split(/\n|\./).filter((l) => l.trim().length > 0);
        if (lines.length >= 4) {
            return {
                templateId: 'CONTENT_LISTICLE',
                data: {
                    title: slide.headline,
                    items: lines.slice(0, 4),
                    footnote: lines.length > 4 ? lines.slice(4).join(' ') : '',
                },
            };
        }
    }

    // Stats/data → CONTENT_STAT_SNAPSHOT
    if (role === 'REVEAL' || role === 'MAP DETAIL') {
        // Try to extract stat from headline or body
        const statMatch = slide.headline.match(/\d+%|\d+x|\d+ in \d+/i);
        return {
            templateId: 'CONTENT_STAT_SNAPSHOT',
            data: {
                kicker: role.toLowerCase().replace('_', ' '),
                stat: statMatch ? statMatch[0] : '···',
                context: slide.headline,
                takeaway: slide.body,
            },
        };
    }

    // Generic content for everything else
    return {
        templateId: 'CONTENT_GENERIC',
        data: {
            title: slide.headline,
            body: slide.body,
            highlight: '',
        },
    };
}

/**
 * Ensure carousel meets quality gates:
 * - 3-5 slides
 * - 3+ distinct templates
 * - Caption 4-8 lines
 * - 3-30 hashtags
 */
function enforceQualityGates(
    carousel: CarouselSlide[],
    caption: string,
    hashtags: string[]
): {
    carousel: CarouselSlide[];
    caption: string;
    hashtags: string;
} {
    // Ensure 3-5 slides
    let finalCarousel = [...carousel];
    if (finalCarousel.length < 3) {
        throw new Error(
            `Carousel has ${finalCarousel.length} slides, need at least 3`
        );
    }
    if (finalCarousel.length > 5) {
        // Keep first, last, and best middle slides
        const first = finalCarousel[0];
        const last = finalCarousel[finalCarousel.length - 1];
        const middle = finalCarousel.slice(1, -1);
        const kept = middle.slice(0, 3);
        finalCarousel = [first, ...kept, last];
    }

    // Check distinct templates
    const templateSet = new Set(finalCarousel.map((s) => s.templateId));
    if (templateSet.size < 3) {
        throw new Error(
            `Carousel has ${templateSet.size} distinct templates, need at least 3`
        );
    }

    // Ensure caption is 4-8 lines
    let finalCaption = caption;
    const captionLines = caption.split('\n').filter((l) => l.trim().length > 0);
    if (captionLines.length < 4) {
        // Pad with generic lines
        const padding = [
            '',
            'Follow for more insights.',
            '',
            'Share with someone who needs this.',
        ];
        finalCaption = caption + '\n\n' + padding.join('\n');
    } else if (captionLines.length > 8) {
        // Trim to 8 lines
        finalCaption = captionLines.slice(0, 8).join('\n');
    }

    // Ensure 3-30 hashtags
    let finalHashtags = [...hashtags];
    if (finalHashtags.length < 3) {
        // Add generic hashtags
        const genericTags = ['shorts', 'education', 'learn'];
        finalHashtags = [...finalHashtags, ...genericTags].slice(0, 3);
    } else if (finalHashtags.length > 30) {
        finalHashtags = finalHashtags.slice(0, 30);
    }

    return {
        carousel: finalCarousel,
        caption: finalCaption,
        hashtags: finalHashtags.map((t) => `#${t}`).join(' '),
    };
}

/**
 * Convert niche-voice manifest to bot intake payload
 */
export function convertNicheVoiceManifest(
    manifest: NicheVoiceManifest
): BotIntakePayload {
    // Get niche configuration
    const nicheConfig = getNicheConfig(manifest.niche);

    // Map slides to carousel
    const carousel: CarouselSlide[] = [];

    for (let i = 0; i < manifest.slides.length; i++) {
        const slide = manifest.slides[i];
        const mapped = mapRoleToTemplate(slide, manifest.slides);

        if (mapped) {
            carousel.push(mapped);
        }
    }

    if (carousel.length === 0) {
        throw new Error('No slides could be mapped to templates');
    }

    // Parse hashtags
    const hashtags = manifest.captions.hashtags || [];

    // Enforce quality gates
    const gated = enforceQualityGates(
        carousel,
        manifest.captions.instagram,
        hashtags
    );

    return {
        nicheId: nicheConfig.nicheId,
        manifest: {
            manifest: {
                format: 'mp4',
                globalBranding: {
                    accentColor: nicheConfig.accentColor,
                    handle: nicheConfig.handle,
                    effects: nicheConfig.effects,
                },
                carousel: gated.carousel,
            },
            caption: gated.caption,
            hashtags: gated.hashtags,
        },
    };
}
