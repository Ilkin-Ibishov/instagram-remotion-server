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
import { runScheduledPipeline } from './src/pipeline/schedulerRunner';

// ─── Config ──────────────────────────────────────────────
const RENDER_DIR = '/tmp/renders';
const COMPOSITION_ID = 'Slide';

if (!fs.existsSync(RENDER_DIR)) {
    fs.mkdirSync(RENDER_DIR, { recursive: true });
}

// ─── Browser Process Cleanup ─────────────────────────────
// Kill zombie Chrome processes that weren't cleaned by Remotion
function cleanupChromeProcesses() {
    if (process.platform === 'win32') {
        try { execSync('taskkill /F /IM chrome.exe 2>nul', { stdio: 'ignore' }); } catch (_) {}
        try { execSync('taskkill /F /IM chromium.exe 2>nul', { stdio: 'ignore' }); } catch (_) {}
        return;
    }

    // Linux/Mac: use pgrep to find PIDs, then kill them explicitly
    try {
        const pids = execSync('pgrep -x "chrome" 2>/dev/null || pgrep -x "chromium" 2>/dev/null || pgrep -x "chromium-browser" 2>/dev/null || true', {
            encoding: 'utf-8',
        }).trim();

        if (pids) {
            const pidList = pids.split('\n').filter(Boolean);
            console.log(`[cleanup] Killing ${pidList.length} Chrome process(es): ${pidList.join(', ')}`);

            // Graceful SIGTERM first
            try {
                execSync(`kill -15 ${pidList.join(' ')} 2>/dev/null || true`, { stdio: 'ignore' });
            } catch (_) {}

            // Give processes up to 3 seconds to exit, then force-kill
            const forceKillTimeout = setTimeout(() => {
                try {
                    const remaining = execSync('pgrep -x "chrome" 2>/dev/null || pgrep -x "chromium" 2>/dev/null || pgrep -x "chromium-browser" 2>/dev/null || true', {
                        encoding: 'utf-8',
                    }).trim();
                    if (remaining) {
                        const remainingPids = remaining.split('\n').filter(Boolean);
                        console.log(`[cleanup] Force-killing ${remainingPids.length} stubborn Chrome process(es): ${remainingPids.join(', ')}`);
                        execSync(`kill -9 ${remainingPids.join(' ')} 2>/dev/null || true`, { stdio: 'ignore' });
                    }
                } catch (_) {}
            }, 3000);
            // Don't block process exit waiting for this timer
            forceKillTimeout.unref();
        } else {
            console.log('[cleanup] No Chrome processes found to kill');
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
            const output = execSync(
                '{ pgrep -x "chrome" 2>/dev/null; pgrep -x "chromium" 2>/dev/null; pgrep -x "chromium-browser" 2>/dev/null; } | wc -l',
                { encoding: 'utf-8' }
            ).trim();
            count = parseInt(output) || 0;
        }
        if (count > 10) {
            console.warn(`⚠️  WARNING: ${count} Chrome processes detected! Resource leak detected.`);
            console.warn(`    Run: pkill -9 -x chrome || pkill -9 -x chromium`);
        } else if (count > 0) {
            console.log(`[cleanup] Chrome process count: ${count}`);
        }
    } catch (e) {
        // Silently fail - process counting not critical
    }
}

// Periodic cleanup every 30 seconds to catch any stragglers
const periodicCleanupInterval = setInterval(() => {
    warnIfTooManyChromeProcesses();
    cleanupChromeProcesses();
}, 30_000);
// Don't block process exit waiting for this interval
periodicCleanupInterval.unref();

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

app.post('/api/schedule/run', async (req, res) => {
    console.log('[api/schedule/run] POST request received');

    const configuredSecret = process.env.SCHEDULE_RUN_SECRET;
    if (configuredSecret) {
        const providedSecret = req.header('x-scheduler-secret');
        if (!providedSecret || providedSecret !== configuredSecret) {
            return res.status(401).json({
                success: false,
                status: 'unauthorized',
                reason: 'Invalid scheduler secret',
            });
        }
    }

    try {
        const outcome = await runScheduledPipeline();

        if (outcome.status === 'failed') {
            return res.status(500).json({
                success: false,
                ...outcome,
            });
        }

        return res.status(200).json({
            success: true,
            ...outcome,
        });
    } catch (error) {
        console.error('[api/schedule/run] Unexpected error:', error);
        return res.status(500).json({
            success: false,
            status: 'failed',
            reason: error instanceof Error ? error.message : String(error),
        });
    }
});

export async function startServer() {
    console.log(`[startup] PORT env var: "${process.env.PORT}" (typeof: ${typeof process.env.PORT})`);
    console.log(`[startup] Resolved PORT: ${PORT}`);
    
    // Pre-warm the bundle on server start.
    ensureBundle().catch((err) => {
        console.error('[bundle] Failed to create bundle:', err);
    });

    return new Promise<void>((resolve) => {
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`✓ Server listening on 0.0.0.0:${PORT}`);
            console.log(`✓ Endpoints: GET /health, POST /api/schedule/run, POST /api/render, GET /api/renders/:file`);
            resolve();
        });
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

        if (webhookUrl) {
            // Respond immediately for n8n to avoid 503 timeouts
            res.status(202).json({ success: true, status: 'processing', batchId });

            // Process in the background with cleanup
            const backgroundStartTime = Date.now();
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
                    const elapsed = ((Date.now() - backgroundStartTime) / 1000).toFixed(1);
                    console.log(`[cleanup] ✓ Webhook render batch completed in ${elapsed}s, Chrome processes cleaned`);
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
                    const elapsed = ((Date.now() - backgroundStartTime) / 1000).toFixed(1);
                    console.log(`[cleanup] ✗ Webhook render batch failed after ${elapsed}s, Chrome processes cleaned`);
                }
            });
            return;
        }

        const renderStartTime = Date.now();
        let outputUrls: string[] = [];
        try {
            outputUrls = await processRenders();
        } finally {
            // Always cleanup after render completes (success or failure)
            cleanupChromeProcesses();
            warnIfTooManyChromeProcesses();
            const elapsed = ((Date.now() - renderStartTime) / 1000).toFixed(1);
            console.log(`[cleanup] ✓ Render batch completed in ${elapsed}s, Chrome processes cleaned`);
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
