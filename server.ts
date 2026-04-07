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
import type { Server } from 'http';
import { runScheduledPipeline } from './src/pipeline/schedulerRunner';

// ─── Config ──────────────────────────────────────────────
const RENDER_DIR = '/tmp/renders';
const COMPOSITION_ID = 'Slide';

function parseIntEnv(name: string, defaultValue: number, minValue = 0): number {
    const raw = process.env[name];
    if (raw === undefined) {
        return defaultValue;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < minValue) {
        console.warn(`[config] Invalid ${name}="${raw}". Using default ${defaultValue}.`);
        return defaultValue;
    }

    return parsed;
}

const CHROME_CLEANUP_INTERVAL_MS = parseIntEnv('CHROME_CLEANUP_INTERVAL_MS', 3_600_000, 1);
const CHROME_CLEANUP_RETRIES = parseIntEnv('CHROME_CLEANUP_RETRIES', 3, 0);
const CHROME_CLEANUP_RETRY_DELAY_MS = parseIntEnv('CHROME_CLEANUP_RETRY_DELAY_MS', 1_000, 0);

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

function getChromeProcessCount(): number | null {
    try {
        if (process.platform === 'win32') {
            const chromeOutput = execSync('tasklist /FI "IMAGENAME eq chrome.exe" /NH | find /I /C "chrome.exe"', {
                encoding: 'utf-8',
            }).trim();
            const chromiumOutput = execSync('tasklist /FI "IMAGENAME eq chromium.exe" /NH | find /I /C "chromium.exe"', {
                encoding: 'utf-8',
            }).trim();
            const chromeCount = parseInt(chromeOutput, 10) || 0;
            const chromiumCount = parseInt(chromiumOutput, 10) || 0;
            return chromeCount + chromiumCount;
        }

        const output = execSync(
            '{ pgrep -x "chrome" 2>/dev/null; pgrep -x "chromium" 2>/dev/null; pgrep -x "chromium-browser" 2>/dev/null; } | wc -l',
            { encoding: 'utf-8' }
        ).trim();
        return parseInt(output, 10) || 0;
    } catch (_) {
        return null;
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cleanupChromeProcessesWithRetries(
    contextLabel: string,
    retries = CHROME_CLEANUP_RETRIES,
    retryDelayMs = CHROME_CLEANUP_RETRY_DELAY_MS,
): Promise<void> {
    const totalAttempts = retries + 1;
    for (let attempt = 1; attempt <= totalAttempts; attempt++) {
        cleanupChromeProcesses();
        const remaining = getChromeProcessCount();

        if (remaining === 0) {
            if (attempt > 1) {
                console.log(`[cleanup] ${contextLabel}: Chrome processes cleared on retry ${attempt}/${totalAttempts}`);
            }
            return;
        }

        if (remaining === null) {
            console.warn(`[cleanup] ${contextLabel}: unable to verify Chrome process count after attempt ${attempt}/${totalAttempts}`);
            return;
        }

        if (attempt < totalAttempts) {
            console.warn(`[cleanup] ${contextLabel}: ${remaining} Chrome process(es) remain after attempt ${attempt}/${totalAttempts}; retrying`);
            await sleep(retryDelayMs);
            continue;
        }

        console.warn(`[cleanup] ${contextLabel}: ${remaining} Chrome process(es) still running after ${totalAttempts} attempts`);
    }
}

// Warn if too many Chrome processes are running
function warnIfTooManyChromeProcesses() {
    try {
        const count = getChromeProcessCount();
        if (count === null) {
            return;
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

// Periodic safety cleanup every 1 hour to catch any stragglers
const periodicCleanupInterval = setInterval(() => {
    warnIfTooManyChromeProcesses();
    cleanupChromeProcesses();
}, CHROME_CLEANUP_INTERVAL_MS);
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
let httpServer: Server | null = null;
let shutdownInProgress = false;

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function validateSlideData(templateId: string, data: Record<string, unknown>, index: number): string | null {
    if (templateId === 'HOOK_A') {
        if (!isNonEmptyString(data.headline)) return `slide[${index}].data.headline must be a non-empty string`;
        if (!isNonEmptyString(data.subheadline)) return `slide[${index}].data.subheadline must be a non-empty string`;
        if (data.imageUrl !== undefined && data.imageUrl !== null && typeof data.imageUrl !== 'string') {
            return `slide[${index}].data.imageUrl must be string, null, or undefined`;
        }
        return null;
    }

    if (templateId === 'CONTENT_LISTICLE') {
        if (!isNonEmptyString(data.title)) return `slide[${index}].data.title must be a non-empty string`;
        if (!Array.isArray(data.items) || data.items.length !== 4 || data.items.some((item) => !isNonEmptyString(item))) {
            return `slide[${index}].data.items must be an array of exactly 4 non-empty strings`;
        }
        if (!isNonEmptyString(data.footnote)) return `slide[${index}].data.footnote must be a non-empty string`;
        return null;
    }

    if (templateId === 'CONTENT_GENERIC') {
        if (!isNonEmptyString(data.title)) return `slide[${index}].data.title must be a non-empty string`;
        if (!isNonEmptyString(data.body)) return `slide[${index}].data.body must be a non-empty string`;
        if (!isNonEmptyString(data.highlight)) return `slide[${index}].data.highlight must be a non-empty string`;
        return null;
    }

    if (templateId === 'CTA_FINAL') {
        if (!isNonEmptyString(data.callToAction)) return `slide[${index}].data.callToAction must be a non-empty string`;
        if (!isNonEmptyString(data.subtext)) return `slide[${index}].data.subtext must be a non-empty string`;
        return null;
    }

    return null;
}

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
    console.log(
        `[cleanup] Config: interval=${CHROME_CLEANUP_INTERVAL_MS}ms, retries=${CHROME_CLEANUP_RETRIES}, retryDelay=${CHROME_CLEANUP_RETRY_DELAY_MS}ms`
    );
    
    // Pre-warm the bundle on server start.
    ensureBundle().catch((err) => {
        console.error('[bundle] Failed to create bundle:', err);
    });

    return new Promise<void>((resolve) => {
        httpServer = app.listen(PORT, '0.0.0.0', () => {
            console.log(`✓ Server listening on 0.0.0.0:${PORT}`);
            console.log(`✓ Endpoints: GET /health, POST /api/schedule/run, POST /api/render, GET /api/renders/:file`);
            resolve();
        });

        httpServer.on('close', () => {
            console.log('[shutdown] HTTP server closed');
        });
    });
}

function gracefulShutdown(signal: NodeJS.Signals) {
    if (shutdownInProgress) {
        console.log(`[shutdown] ${signal} received while shutdown already in progress`);
        return;
    }

    shutdownInProgress = true;
    console.log(`[shutdown] Received ${signal}; starting graceful shutdown`);

    clearInterval(periodicCleanupInterval);
    cleanupChromeProcesses();

    const forceExitTimeout = setTimeout(() => {
        console.error('[shutdown] Graceful shutdown timed out after 10s; forcing exit');
        process.exit(1);
    }, 10_000);
    forceExitTimeout.unref();

    if (!httpServer) {
        console.log('[shutdown] No active HTTP server instance found; exiting');
        process.exit(0);
        return;
    }

    httpServer.close((error?: Error) => {
        clearTimeout(forceExitTimeout);
        if (error) {
            console.error('[shutdown] Error while closing HTTP server:', error);
            process.exit(1);
            return;
        }

        console.log('[shutdown] Graceful shutdown complete');
        process.exit(0);
    });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

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

            const slideDataError = validateSlideData(slide.templateId, slide.data as Record<string, unknown>, i);
            if (slideDataError) {
                return res.status(400).json({ error: slideDataError });
            }
        }

        const serveUrl = await ensureBundle();
        const batchId = crypto.randomBytes(4).toString('hex');

        const processRenders = async () => {
            const outputUrls: string[] = [];
            for (const [i, slide] of carousel.entries()) {
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
                outputUrls.push(`/api/renders/${filename}`);
            }

            return outputUrls;
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
                    await cleanupChromeProcessesWithRetries('webhook success cleanup');
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
                    await cleanupChromeProcessesWithRetries('webhook failure cleanup');
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
            await cleanupChromeProcessesWithRetries('sync render cleanup');
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
