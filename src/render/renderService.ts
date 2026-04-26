import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const RENDER_DIR = '/tmp/renders';
const COMPOSITION_ID = 'Slide';

if (!fs.existsSync(RENDER_DIR)) {
  fs.mkdirSync(RENDER_DIR, { recursive: true });
}

let bundleLocation: string | null = null;
let bundleInitPromise: Promise<string> | null = null;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function exceedsMaxLength(value: unknown, max: number): boolean {
  return typeof value === 'string' && value.trim().length > max;
}

function isQuestion(value: unknown): boolean {
  return typeof value === 'string' && value.trim().endsWith('?');
}

function parseIntWithFallback(name: string, defaultValue: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return defaultValue;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    console.warn(`[config] Invalid ${name}="${raw}". Using default ${defaultValue}.`);
    return defaultValue;
  }

  return parsed;
}

function validateSlideData(templateId: string, data: Record<string, unknown>, index: number): string | null {
  if (templateId === 'HOOK_A') {
    if (!isNonEmptyString(data.headline)) return `slide[${index}].data.headline must be a non-empty string`;
    if (exceedsMaxLength(data.headline, 72)) return `slide[${index}].data.headline must be <= 72 characters`;
    if (!isNonEmptyString(data.subheadline)) return `slide[${index}].data.subheadline must be a non-empty string`;
    if (exceedsMaxLength(data.subheadline, 120)) return `slide[${index}].data.subheadline must be <= 120 characters`;
    if (data.imageUrl !== undefined && data.imageUrl !== null && typeof data.imageUrl !== 'string') {
      return `slide[${index}].data.imageUrl must be string, null, or undefined`;
    }
    return null;
  }

  if (templateId === 'CONTENT_LISTICLE') {
    if (!isNonEmptyString(data.title)) return `slide[${index}].data.title must be a non-empty string`;
    if (exceedsMaxLength(data.title, 76)) return `slide[${index}].data.title must be <= 76 characters`;
    if (!Array.isArray(data.items) || data.items.length !== 4 || data.items.some((item) => !isNonEmptyString(item))) {
      return `slide[${index}].data.items must be an array of exactly 4 non-empty strings`;
    }
    if ((data.items as unknown[]).some((item) => exceedsMaxLength(item, 60))) {
      return `slide[${index}].data.items entries must be <= 60 characters each`;
    }
    if (!isNonEmptyString(data.footnote)) return `slide[${index}].data.footnote must be a non-empty string`;
    if (exceedsMaxLength(data.footnote, 84)) return `slide[${index}].data.footnote must be <= 84 characters`;
    return null;
  }

  if (templateId === 'CONTENT_GENERIC') {
    if (!isNonEmptyString(data.title)) return `slide[${index}].data.title must be a non-empty string`;
    if (exceedsMaxLength(data.title, 76)) return `slide[${index}].data.title must be <= 76 characters`;
    if (!isNonEmptyString(data.body)) return `slide[${index}].data.body must be a non-empty string`;
    if (exceedsMaxLength(data.body, 220)) return `slide[${index}].data.body must be <= 220 characters`;
    if (!isNonEmptyString(data.highlight)) return `slide[${index}].data.highlight must be a non-empty string`;
    if (exceedsMaxLength(data.highlight, 90)) return `slide[${index}].data.highlight must be <= 90 characters`;
    return null;
  }

  if (templateId === 'CONTENT_STAT_SNAPSHOT') {
    if (!isNonEmptyString(data.kicker)) return `slide[${index}].data.kicker must be a non-empty string`;
    if (exceedsMaxLength(data.kicker, 36)) return `slide[${index}].data.kicker must be <= 36 characters`;
    if (!isNonEmptyString(data.stat)) return `slide[${index}].data.stat must be a non-empty string`;
    if (exceedsMaxLength(data.stat, 24)) return `slide[${index}].data.stat must be <= 24 characters`;
    if (!isNonEmptyString(data.context)) return `slide[${index}].data.context must be a non-empty string`;
    if (exceedsMaxLength(data.context, 120)) return `slide[${index}].data.context must be <= 120 characters`;
    if (!isNonEmptyString(data.takeaway)) return `slide[${index}].data.takeaway must be a non-empty string`;
    if (exceedsMaxLength(data.takeaway, 100)) return `slide[${index}].data.takeaway must be <= 100 characters`;
    return null;
  }

  if (templateId === 'CONTENT_MYTH_VS_FACT') {
    if (!isNonEmptyString(data.myth)) return `slide[${index}].data.myth must be a non-empty string`;
    if (exceedsMaxLength(data.myth, 92)) return `slide[${index}].data.myth must be <= 92 characters`;
    if (!isNonEmptyString(data.fact)) return `slide[${index}].data.fact must be a non-empty string`;
    if (exceedsMaxLength(data.fact, 130)) return `slide[${index}].data.fact must be <= 130 characters`;
    if (!isNonEmptyString(data.proof)) return `slide[${index}].data.proof must be a non-empty string`;
    if (exceedsMaxLength(data.proof, 96)) return `slide[${index}].data.proof must be <= 96 characters`;
    return null;
  }

  if (templateId === 'CONTENT_VIDEO') {
    if (!isNonEmptyString(data.title)) return `slide[${index}].data.title must be a non-empty string`;
    if (exceedsMaxLength(data.title, 76)) return `slide[${index}].data.title must be <= 76 characters`;
    if (data.videoUrl !== null && data.videoUrl !== undefined && typeof data.videoUrl !== 'string') {
      return `slide[${index}].data.videoUrl must be string, null, or undefined`;
    }
    if (data.imageUrl !== null && data.imageUrl !== undefined && typeof data.imageUrl !== 'string') {
      return `slide[${index}].data.imageUrl must be string, null, or undefined`;
    }
    if (data.caption !== undefined && data.caption !== null && !isNonEmptyString(data.caption)) {
      return `slide[${index}].data.caption must be a non-empty string when provided`;
    }
    if (data.caption !== undefined && data.caption !== null && exceedsMaxLength(data.caption, 120)) {
      return `slide[${index}].data.caption must be <= 120 characters when provided`;
    }
    if (data.source !== undefined && data.source !== null && !isNonEmptyString(data.source)) {
      return `slide[${index}].data.source must be a non-empty string when provided`;
    }
    if (data.source !== undefined && data.source !== null && exceedsMaxLength(data.source, 70)) {
      return `slide[${index}].data.source must be <= 70 characters when provided`;
    }
    return null;
  }

  if (templateId === 'CTA_FINAL') {
    if (!isNonEmptyString(data.callToAction)) return `slide[${index}].data.callToAction must be a non-empty string`;
    if (!isQuestion(data.callToAction)) return `slide[${index}].data.callToAction must end with a question mark`;
    if (exceedsMaxLength(data.callToAction, 100)) return `slide[${index}].data.callToAction must be <= 100 characters`;
    if (!isNonEmptyString(data.subtext)) return `slide[${index}].data.subtext must be a non-empty string`;
    if (exceedsMaxLength(data.subtext, 84)) return `slide[${index}].data.subtext must be <= 84 characters`;
    return null;
  }

  return null;
}

export interface RenderSlide {
  templateId: string;
  data: Record<string, unknown>;
}

export interface RenderManifestInput {
  globalBranding: {
    accentColor: string;
    handle: string;
    effects?: string[];
  };
  carousel: RenderSlide[];
  format?: 'png' | 'mp4';
}

const VALID_TEMPLATES = new Set([
  'HOOK_A',
  'CONTENT_LISTICLE',
  'CONTENT_GENERIC',
  'CONTENT_STAT_SNAPSHOT',
  'CONTENT_MYTH_VS_FACT',
  'CONTENT_VIDEO',
  'CTA_FINAL',
]);

export function validateRenderManifest(input: unknown): { error: string | null; normalized: RenderManifestInput | null } {
  if (!input || typeof input !== 'object') {
    return { error: 'Invalid manifest format', normalized: null };
  }

  const payload = input as Partial<RenderManifestInput>;
  if (!payload.globalBranding || !payload.carousel || !Array.isArray(payload.carousel)) {
    return { error: 'Invalid manifest format', normalized: null };
  }

  if (!payload.globalBranding.accentColor || !payload.globalBranding.handle) {
    return { error: 'globalBranding must have accentColor and handle', normalized: null };
  }

  if (payload.carousel.length === 0) {
    return { error: 'carousel must have at least 1 slide', normalized: null };
  }

  for (const [i, slide] of payload.carousel.entries()) {
    if (!slide.templateId || !VALID_TEMPLATES.has(slide.templateId)) {
      return { error: `slide[${i}].templateId invalid: "${slide.templateId}"`, normalized: null };
    }
    if (!slide.data || typeof slide.data !== 'object') {
      return { error: `slide[${i}].data must be a non-null object`, normalized: null };
    }

    const slideDataError = validateSlideData(slide.templateId, slide.data as Record<string, unknown>, i);
    if (slideDataError) {
      return { error: slideDataError, normalized: null };
    }
  }

  const normalized: RenderManifestInput = {
    globalBranding: {
      accentColor: payload.globalBranding.accentColor,
      handle: payload.globalBranding.handle,
      effects: Array.isArray(payload.globalBranding.effects) ? payload.globalBranding.effects : [],
    },
    carousel: payload.carousel,
    format: payload.format === 'mp4' ? 'mp4' : 'png',
  };

  return { error: null, normalized };
}

export async function ensureBundle(): Promise<string> {
  if (bundleLocation) {
    return bundleLocation;
  }

  if (bundleInitPromise) {
    return bundleInitPromise;
  }

  bundleInitPromise = (async () => {
    console.log('[bundle] Creating Remotion bundle (one-time)...');
    const startTime = Date.now();

    bundleLocation = await bundle({
      entryPoint: path.resolve('./src/remotion/index.tsx'),
      webpackOverride: (config) => config,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[bundle] ✓ Bundle ready in ${elapsed}s`);

    return bundleLocation;
  })();

  try {
    return await bundleInitPromise;
  } finally {
    bundleInitPromise = null;
  }
}

export function getBundleHealth(): { status: 'ok' | 'not_ready'; bundle: boolean } {
  const bundleReady = Boolean(bundleLocation);
  return {
    status: bundleReady ? 'ok' : 'not_ready',
    bundle: bundleReady,
  };
}

export async function renderManifest(
  input: RenderManifestInput,
  providedBatchId?: string,
  signal?: AbortSignal
): Promise<{ images: string[]; batchId: string }> {
  signal?.throwIfAborted();
  const serveUrl = await ensureBundle();
  signal?.throwIfAborted();
  const format = input.format === 'mp4' ? 'mp4' : 'png';
  const batchId = providedBatchId ?? crypto.randomBytes(4).toString('hex');
  const outputUrls: string[] = [];
  const renderTimeoutMs = parseIntWithFallback('RENDER_TIMEOUT_MS', 60_000, 10_000, 600_000);

  for (const [i, slide] of input.carousel.entries()) {
    signal?.throwIfAborted();
    console.log(`[render] slide ${i + 1}/${input.carousel.length} (${slide.templateId}, ${format})`);

    const inputProps = {
      templateId: slide.templateId,
      data: slide.data,
      branding: input.globalBranding,
    };

    const filename = `render-${batchId}-${i}.${format === 'mp4' ? 'mp4' : 'png'}`;
    const filepath = path.join(RENDER_DIR, filename);

    const composition = await selectComposition({
      serveUrl,
      id: COMPOSITION_ID,
      inputProps,
    });

    if (format === 'mp4') {
      await renderMedia({
        composition,
        serveUrl,
        codec: 'h264',
        imageFormat: 'jpeg',
        pixelFormat: 'yuv420p',
        outputLocation: filepath,
        inputProps,
        concurrency: parseIntWithFallback('RENDER_CONCURRENCY', 1, 1, 8),
        timeoutInMilliseconds: renderTimeoutMs,
        x264Preset: 'veryfast',
        chromiumOptions: {
          gl: 'angle',
          // @ts-ignore - Remotion typings don't expose args but puppeteer accepts it
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        },
        onProgress: ({ progress }) => {
          if (Math.round(progress * 100) % 25 === 0) {
            console.log(`  [video ${i + 1}] ${Math.round(progress * 100)}%`);
          }
        },
      });
    } else {
      await renderStill({
        composition,
        serveUrl,
        output: filepath,
        inputProps,
        frame: composition.durationInFrames - 1,
        timeoutInMilliseconds: renderTimeoutMs,
        chromiumOptions: {
          gl: 'angle',
          // @ts-ignore - Remotion typings don't expose args but puppeteer accepts it
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        },
        scale: 2,
      });
    }

    console.log(`[render] ✓ ${filename}`);
    outputUrls.push(`/api/renders/${filename}`);
    signal?.throwIfAborted();
  }

  return { images: outputUrls, batchId };
}

export const __testing = {
  resetBundleState(): void {
    bundleLocation = null;
    bundleInitPromise = null;
  },
  setBundleLocation(nextBundleLocation: string | null): void {
    bundleLocation = nextBundleLocation;
  },
};
