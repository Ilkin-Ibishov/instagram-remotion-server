import express from 'express';
import { bundle } from '@remotion/bundler';
import {
    renderMedia,
    renderStill,
    selectComposition,
} from '@remotion/renderer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ─── Config ──────────────────────────────────────────────
const RENDER_DIR = '/tmp/renders';
const COMPOSITION_ID = 'Slide';

if (!fs.existsSync(RENDER_DIR)) {
    fs.mkdirSync(RENDER_DIR, { recursive: true });
}

// ─── Bundle cache (created once, reused for all renders) ─
let bundleLocation: string | null = null;

async function ensureBundle(): Promise<string> {
    if (bundleLocation) {
        return bundleLocation;
    }

    console.log('[bundle] Creating Remotion bundle (one-time)...');
    const startTime = Date.now();

    bundleLocation = await bundle({
        entryPoint: path.resolve('./src/remotion/index.tsx'),
        webpackOverride: (config) => config,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[bundle] ✓ Bundle ready in ${elapsed}s`);

    return bundleLocation;
}

// ─── Server ──────────────────────────────────────────────
export const app = express();
app.use(express.json({ limit: '50mb' }));

const PORT = 3000;

// Serve rendered assets.
app.use('/api/renders', express.static(RENDER_DIR));

export async function startServer() {
    // Pre-warm the bundle on server start.
    ensureBundle().catch((err) => {
        console.error('[bundle] Failed to create bundle:', err);
    });

    return app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

app.post('/api/render', async (req, res) => {
    try {
        const { globalBranding, carousel, format = 'png' } = req.body;

        if (!globalBranding || !carousel || !Array.isArray(carousel)) {
            return res.status(400).json({ error: 'Invalid manifest format' });
        }

        const serveUrl = await ensureBundle();

        const outputUrls: string[] = [];
        const batchId = crypto.randomBytes(4).toString('hex');

        for (let i = 0; i < carousel.length; i++) {
            const slide = carousel[i];
            console.log(
                `[render] slide ${i + 1}/${carousel.length} (${slide.templateId}, ${format})`
            );

            const inputProps = {
                templateId: slide.templateId,
                data: slide.data,
                branding: globalBranding,
            };

            const filename = `render-${batchId}-${i}.${format === 'mp4' ? 'mp4' : 'png'}`;
            const filepath = path.join(RENDER_DIR, filename);

            // Select the composition with input props.
            // This allows dynamic metadata (duration, etc.) if needed later.
            const composition = await selectComposition({
                serveUrl,
                id: COMPOSITION_ID,
                inputProps,
            });

            if (format === 'mp4') {
                // ── Video: deterministic frame-perfect rendering ──
                await renderMedia({
                    composition,
                    serveUrl,
                    codec: 'h264',
                    outputLocation: filepath,
                    inputProps,
                    // Remotion uses its own Chromium; no need for external Puppeteer.
                    chromiumOptions: {
                        disableWebSecurity: true,
                        gl: 'angle',
                        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
                    },
                    onProgress: ({ progress }) => {
                        if (Math.round(progress * 100) % 25 === 0) {
                            console.log(
                                `  [video] ${Math.round(progress * 100)}%`
                            );
                        }
                    },
                });
            } else {
                // ── PNG: render a still at the final frame ──
                await renderStill({
                    composition,
                    serveUrl,
                    output: filepath,
                    inputProps,
                    // Render at the last frame (after all animations complete).
                    frame: composition.durationInFrames - 1,
                    chromiumOptions: {
                        disableWebSecurity: true,
                        gl: 'angle',
                        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
                    },
                    // 2x scale for crisp 2160×2160 output.
                    scale: 2,
                });
            }

            outputUrls.push(`/api/renders/${filename}`);
            console.log(`[render] ✓ ${filename}`);
        }

        res.json({ success: true, images: outputUrls });
    } catch (error) {
        console.error('Render error:', error);
        res.status(500).json({
            error: 'Failed to render images',
            details: error instanceof Error ? error.message : String(error),
        });
    }
});

const isTestMode = process.env.NODE_ENV === 'test' || process.env.VITEST;
if (!isTestMode) {
    startServer();
}
