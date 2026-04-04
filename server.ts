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
import { execSync } from 'child_process';

// ─── Config ──────────────────────────────────────────────
const RENDER_DIR = '/tmp/renders';
const COMPOSITION_ID = 'Slide';

if (!fs.existsSync(RENDER_DIR)) {
    fs.mkdirSync(RENDER_DIR, { recursive: true });
}

// ─── Browser Process Cleanup ─────────────────────────────
// Kill zombie Chrome processes that weren't cleaned by Remotion
function cleanupChromeProcesses() {
    try {
        if (process.platform === 'win32') {
            execSync('taskkill /F /IM chrome.exe 2>nul', { stdio: 'ignore' });
            execSync('taskkill /F /IM chromium.exe 2>nul', { stdio: 'ignore' });
        } else {
            execSync('pkill -9 -f "chrome|chromium" 2>/dev/null', { stdio: 'ignore' });
        }
    } catch (e) {
        // Silently fail - processes may not exist
    }
}

// Warn if too many Chrome processes are running
function warnIfTooManyChromeProcesses() {
    try {
        let count = 0;
        if (process.platform === 'win32') {
            const output = execSync('tasklist | find /c "chrome.exe"', { encoding: 'utf-8' }).trim();
            count = parseInt(output) || 0;
        } else {
            const output = execSync('pgrep -f "chrome|chromium" | wc -l', { encoding: 'utf-8' }).trim();
            count = parseInt(output) || 0;
        }
        if (count > 5) {
            console.warn(`⚠️  WARNING: ${count} Chrome processes detected! Resource leak detected.`);
            console.warn(`    Consider running: taskkill /F /IM chrome.exe (Windows) or pkill chrome (Linux/Mac)`);
        }
    } catch (e) {
        // Silently fail - process counting not critical
    }
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

// MUST be before any routes - logs ALL incoming requests
app.use((req, res, next) => {
    console.log(`\n[INCOMING] ${new Date().toISOString()} | ${req.method} ${req.path} | Content-Type: ${req.headers['content-type']}`);
    res.on('finish', () => {
        console.log(`[OUTGOING] ${req.method} ${req.path} -> ${res.statusCode} ${res.statusMessage}`);
    });
    next();
});

app.use(express.json({ limit: '50mb' }));

// Use Railway's PORT env var or default to 3000
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Serve rendered assets.
app.use('/api/renders', express.static(RENDER_DIR));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export async function startServer() {
    console.log(`[startup] PORT env var: "${process.env.PORT}" (typeof: ${typeof process.env.PORT})`);
    console.log(`[startup] Resolved PORT: ${PORT}`);
    
    // Pre-warm the bundle on server start.
    ensureBundle().catch((err) => {
        console.error('[bundle] Failed to create bundle:', err);
    });

    return app.listen(PORT, '0.0.0.0', () => {
        console.log(`✓ Server listening on 0.0.0.0:${PORT}`);
        console.log(`✓ Endpoints: GET /health, POST /api/render, GET /api/renders/:file`);
    });
}

app.post('/api/render', async (req, res) => {
    console.log('[api/render] POST request received');
    try {
        const { globalBranding, carousel, format = 'png', webhookUrl } = req.body;

        if (!globalBranding || !carousel || !Array.isArray(carousel)) {
            return res.status(400).json({ error: 'Invalid manifest format' });
        }

        const VALID_TEMPLATES = new Set([
            'HOOK_A', 'CONTENT_LISTICLE', 'CONTENT_GENERIC', 'CONTENT_VIDEO', 'CTA_FINAL'
        ]);

        if (!globalBranding.accentColor || !globalBranding.handle) {
            return res.status(400).json({ error: 'globalBranding must have accentColor and handle' });
        }
        if (!Array.isArray(globalBranding.effects)) {
            globalBranding.effects = [];
        }

        if (carousel.length === 0) {
            return res.status(400).json({ error: 'carousel must have at least 1 slide' });
        }

        for (const [i, slide] of carousel.entries()) {
            if (!slide.templateId || !VALID_TEMPLATES.has(slide.templateId)) {
                return res.status(400).json({ error: `slide[${i}].templateId invalid: "${slide.templateId}"` });
            }
            if (!slide.data || typeof slide.data !== 'object') {
                return res.status(400).json({ error: `slide[${i}].data must be a non-null object` });
            }
        }

        const serveUrl = await ensureBundle();
        const batchId = crypto.randomBytes(4).toString('hex');

        const processRenders = async () => {
            const renderPromises = carousel.map(async (slide, i) => {
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
                        // Reduced concurrency for stability (x264 memory errors with concurrency > 1)
                        // Set RENDER_CONCURRENCY env var to override (e.g., 2 or 3 on high-RAM systems)
                        concurrency: parseInt(process.env.RENDER_CONCURRENCY || '1', 10),
                        timeoutInMilliseconds: 60000, // Increased from default 33s to 60s
                        // Use 'veryfast' preset to reduce x264 memory usage and thread count
                        // Also reduces CPU strain and encoding time
                        x264Preset: 'veryfast',
                        chromiumOptions: {
                            disableWebSecurity: true,
                            gl: 'angle',
                            // @ts-ignore - Remotion typings don't expose args but puppeteer accepts it
                            args: [
                                '--no-sandbox',
                                '--disable-setuid-sandbox',
                                '--disable-dev-shm-usage',
                                '--disable-gpu',
                                '--single-process', // Force single process to avoid multiple Chrome instances
                            ]
                        },
                        onProgress: ({ progress }) => {
                            if (Math.round(progress * 100) % 25 === 0) {
                                console.log(
                                    `  [video ${i + 1}] ${Math.round(progress * 100)}%`
                                );
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
                        timeoutInMilliseconds: 60000, // Increased from default 33s to 60s
                        chromiumOptions: {
                            disableWebSecurity: true,
                            gl: 'angle',
                            // @ts-ignore - Remotion typings don't expose args but puppeteer accepts it
                            args: [
                                '--no-sandbox',
                                '--disable-setuid-sandbox',
                                '--disable-dev-shm-usage',
                                '--disable-gpu',
                                '--single-process', // Force single process to avoid multiple Chrome instances
                            ]
                        },
                        scale: 2,
                    });
                }

                console.log(`[render] ✓ ${filename}`);
                return `/api/renders/${filename}`;
            });

            return Promise.all(renderPromises);
        };

        const renderStartTime = Date.now();
        let renderUrls: string[] = [];
        try {
            renderUrls = await processRenders();
        } finally {
            // Always cleanup after render completes (success or failure)
            cleanupChromeProcesses();
            warnIfTooManyChromeProcesses();
            const elapsed = ((Date.now() - renderStartTime) / 1000).toFixed(1);
            console.log(`[cleanup] ✓ Render batch completed in ${elapsed}s, Chrome processes cleaned`);
        }

        if (webhookUrl) {
            // Respond immediately for n8n to avoid 503 timeouts
            res.status(202).json({ success: true, status: 'processing', batchId });

            // Process in the background with cleanup
            processRenders().then(async (outputUrls) => {
                try {
                    await fetch(webhookUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ success: true, batchId, images: outputUrls })
                    });
                    console.log(`[webhook] ✓ Delivered to ${webhookUrl}`);
                } catch (e) {
                    console.error('[webhook] Failed to send success ping:', e);
                } finally {
                    cleanupChromeProcesses();
                    warnIfTooManyChromeProcesses();
                }
            }).catch(async (error) => {
                try {
                    console.error('[webhook] Background render error:', error);
                    await fetch(webhookUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            success: false,
                            batchId,
                            error: error instanceof Error ? error.message : String(error)
                        })
                    });
                } catch (e) {
                    console.error('[webhook] Failed to send error ping:', e);
                } finally {
                    cleanupChromeProcesses();
                    warnIfTooManyChromeProcesses();
                }
            });
            return;
        }

        const outputUrls = await processRenders();
        res.json({ success: true, images: outputUrls });
    } catch (error) {
        console.error('Render error:', error);
        res.status(500).json({
            error: 'Failed to render images',
            details: error instanceof Error ? error.message : String(error),
        });
    }
});

// Catch-all 404 handler
app.use((req, res) => {
    console.log(`[404] No route for ${req.method} ${req.path}`);
    res.status(404).json({ error: 'Not Found', path: req.path, method: req.method });
});

const isTestMode = process.env.NODE_ENV === 'test' || process.env.VITEST;
if (!isTestMode) {
    // Start server and await to ensure HTTP server is fully initialized before module finishes
    (async () => {
        try {
            await startServer();
        } catch (err) {
            console.error('[startup] Failed to start server:', err);
            process.exit(1);
        }
    })();
}
