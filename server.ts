import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import type { Server } from 'http';
import { runScheduledPipeline, type SchedulerOutcome } from './src/pipeline/schedulerRunner';
import { readScheduleState } from './src/pipeline/scheduleState';
import { closeTelemetryPool } from './src/pipeline/rssTelemetryStore';
import { closeRedisClient } from './src/utils/redisClient';
import { parseEnvInt } from './src/utils/env';
import Logger, { sanitizeUrlForLogging } from './src/utils/logger';
import {
    __testing as renderTesting,
    ensureBundle,
    getBundleHealth,
    renderManifest,
    validateRenderManifest,
} from './src/render/renderService';

function tryParseJson(value: string): boolean {
    try {
        JSON.parse(value);
        return true;
    } catch {
        return false;
    }
}

function decodeInstagramSessionJson(sessionBase64: string): string {
    const rawBuffer = Buffer.from(sessionBase64.trim(), 'base64');

    const utf8Candidate = rawBuffer.toString('utf-8').trim();
    if (utf8Candidate && tryParseJson(utf8Candidate)) {
        return utf8Candidate;
    }

    const utf16Candidate = rawBuffer.toString('utf16le').replace(/\u0000/g, '').trim();
    if (utf16Candidate && tryParseJson(utf16Candidate)) {
        serverLogger.info('startup', 'INSTAGRAM_SESSION_B64 normalized from UTF-16LE to UTF-8 JSON');
        return utf16Candidate;
    }

    throw new Error('INSTAGRAM_SESSION_B64 is not valid JSON in UTF-8 or UTF-16LE');
}

export function bootstrapInstagramSession(
    sessionBase64 = process.env.INSTAGRAM_SESSION_B64,
    storageFilePath = path.join(process.cwd(), 'storage.json')
): boolean {
    if (!sessionBase64) {
        serverLogger.warn('startup', 'INSTAGRAM_SESSION_B64 not set; using existing storage.json if present');
        return false;
    }

    try {
        const normalizedSessionJson = decodeInstagramSessionJson(sessionBase64);
        fs.writeFileSync(storageFilePath, normalizedSessionJson, 'utf-8');
        serverLogger.info('startup', 'Instagram session written from INSTAGRAM_SESSION_B64');
        return true;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        serverLogger.error('startup', 'Failed to decode INSTAGRAM_SESSION_B64', { error: { message } });
        return false;
    }
}

process.env.SERVER_MODE = 'true';

// ─── Config ──────────────────────────────────────────────
const RENDER_DIR = '/tmp/renders';
const serverLogger = new Logger('server');

bootstrapInstagramSession();

function getRequestId(req: express.Request): string {
    const incoming = req.header('x-request-id') || req.header('x-correlation-id');
    return incoming?.trim() || crypto.randomUUID();
}

function serializeError(error: unknown): Record<string, unknown> {
    return error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : { message: String(error) };
}

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

const SCHEDULER_ENABLED = process.env.SCHEDULER_ENABLED === 'true';
const SCHEDULER_POLL_INTERVAL_MS = parseIntEnv('SCHEDULER_POLL_INTERVAL_MS', 1_800_000, 60_000);
const SCHEDULER_STARTUP_RETRY_DELAY_MS = parseIntEnv('SCHEDULER_STARTUP_RETRY_DELAY_MS', 60_000, 1_000);
const SCHEDULER_STARTUP_MAX_RETRIES = parseIntEnv('SCHEDULER_STARTUP_MAX_RETRIES', 10, 0);

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

// ─── Internal Scheduler Loop ─────────────────────────────
let schedulerInterval: NodeJS.Timeout | null = null;
let schedulerStartupRetryTimeout: NodeJS.Timeout | null = null;
let schedulerTickRunning = false;
let schedulerLoopStopped = false;

async function runSchedulerTick(trigger: 'startup' | 'startup_retry' | 'interval'): Promise<SchedulerOutcome | null> {
    try {
        const outcome = await runScheduledPipeline();
        console.log(
            `[scheduler] Outcome (${trigger}): ${outcome.status}`,
            outcome.nextRunAt ? `nextRunAt=${outcome.nextRunAt}` : ''
        );
        return outcome;
    } catch (error) {
        console.error(
            `[scheduler] Unexpected error in ${trigger} scheduler run:`,
            error instanceof Error ? error.message : String(error)
        );
        return null;
    }
}

function scheduleStartupRetry(attempt: number) {
    if (attempt > SCHEDULER_STARTUP_MAX_RETRIES) {
        console.warn(`[scheduler] Startup retries exhausted after ${SCHEDULER_STARTUP_MAX_RETRIES} attempt(s)`);
        return;
    }

    schedulerStartupRetryTimeout = setTimeout(async () => {
        schedulerStartupRetryTimeout = null;
        const outcome = await runSchedulerTick('startup_retry');
        if (outcome?.status === 'skipped_lock_held') {
            console.warn(
                `[scheduler] Lock still held during startup retry ${attempt}/${SCHEDULER_STARTUP_MAX_RETRIES}; retrying in ${SCHEDULER_STARTUP_RETRY_DELAY_MS}ms`
            );
            scheduleStartupRetry(attempt + 1);
        }
    }, SCHEDULER_STARTUP_RETRY_DELAY_MS);
    schedulerStartupRetryTimeout.unref();
}

export function startSchedulerLoop() {
    schedulerLoopStopped = false;
    schedulerTickRunning = false;
    console.log(
        `[scheduler] Internal scheduler enabled, running once on startup and polling every ${SCHEDULER_POLL_INTERVAL_MS}ms`
    );
    void runSchedulerTick('startup').then((outcome) => {
        if (outcome?.status === 'skipped_lock_held') {
            console.warn(
                `[scheduler] Startup run skipped due to lock; retrying up to ${SCHEDULER_STARTUP_MAX_RETRIES} time(s) every ${SCHEDULER_STARTUP_RETRY_DELAY_MS}ms`
            );
            scheduleStartupRetry(1);
        }
    });

    const scheduleNextTick = () => {
        if (schedulerLoopStopped) {
            return;
        }

        schedulerInterval = setTimeout(async () => {
            if (schedulerLoopStopped) {
                return;
            }

            if (schedulerTickRunning) {
                console.warn('[scheduler] Tick skipped — previous interval tick still running');
                scheduleNextTick();
                return;
            }

            schedulerTickRunning = true;
            try {
                await runSchedulerTick('interval');
            } finally {
                schedulerTickRunning = false;
                scheduleNextTick();
            }
        }, SCHEDULER_POLL_INTERVAL_MS);
        schedulerInterval.unref();
    };

    scheduleNextTick();
}

export function stopSchedulerLoop() {
    schedulerLoopStopped = true;
    schedulerTickRunning = false;
    if (schedulerInterval) {
        clearTimeout(schedulerInterval);
        schedulerInterval = null;
    }
    if (schedulerStartupRetryTimeout) {
        clearTimeout(schedulerStartupRetryTimeout);
        schedulerStartupRetryTimeout = null;
    }
}

export async function initializeBundleOrExit(
    exitFn: (code: number) => void = process.exit,
    ensureBundleFn: () => Promise<string> = ensureBundle
): Promise<boolean> {
    try {
        await ensureBundleFn();
        return true;
    } catch (err) {
        console.error('[bundle] FATAL: Remotion bundle failed - server will not start:', err);
        exitFn(1);
        return false;
    }
}

// ─── Server ──────────────────────────────────────────────
export const app = express();

// MUST be before any routes - logs ALL incoming requests
app.use((req, res, next) => {
    const requestId = getRequestId(req);
    const startedAt = Date.now();
    res.locals.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    serverLogger.info('http-request', 'Incoming request', {
        requestId,
        method: req.method,
        path: req.path,
        contentType: req.headers['content-type'] ?? null,
    });
    res.on('finish', () => {
        serverLogger.info('http-response', 'Request completed', {
            requestId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            statusMessage: res.statusMessage,
            durationMs: Date.now() - startedAt,
        });
    });
    next();
});

app.use(express.json({ limit: '50mb' }));

// Use Railway's PORT env var or default to 3000
const PORT = parseEnvInt('PORT', 3000, 1, 65535);
let httpServer: Server | null = null;
let shutdownInProgress = false;

// Serve rendered assets.
app.use('/api/renders', express.static(RENDER_DIR));

// Health check endpoint
app.get('/health', (req, res) => {
    const health = getBundleHealth();
    res.status(health.bundle ? 200 : 503).json(health);
});

// Scheduler status endpoint — returns last success, next run, and last error
app.get('/api/status', async (req, res) => {
    const accountId = process.env.ACCOUNT_ID ?? process.env.SCHEDULE_ACCOUNT_ID ?? 'default';
    try {
        const state = await readScheduleState(accountId);
        if (!state) {
            return res.json({
                status: 'no_data',
                message: 'Pipeline has not run yet',
                accountId,
            });
        }
        return res.json({
            status: 'ok',
            accountId: state.accountId,
            last_success_at: state.lastSuccessAt?.toISOString() ?? null,
            last_error_at: state.lastErrorAt?.toISOString() ?? null,
            last_error_message: state.lastErrorMessage ?? null,
            next_run_at: state.nextRunAt.toISOString(),
            last_run_at: state.lastRunAt?.toISOString() ?? null,
            consecutive_failure_count: state.consecutiveFailureCount,
            last_alert_sent_at: state.lastAlertSentAt?.toISOString() ?? null,
            pipeline_cooldown_until: state.pipelineCooldownUntil?.toISOString() ?? null,
        });
    } catch (err) {
        serverLogger.error('api-status', 'Schedule state database unavailable', {
            requestId: res.locals.requestId,
            accountId,
            error: serializeError(err),
        });
        return res.status(503).json({
            status: 'unavailable',
            message: 'Schedule state database unavailable',
        });
    }
});

app.post('/api/schedule/run', async (req, res) => {
    const requestId = res.locals.requestId;
    serverLogger.info('scheduler-api', 'Manual scheduler trigger received', { requestId });

    const configuredSecret = process.env.SCHEDULE_RUN_SECRET;
    if (configuredSecret) {
        const providedSecret = req.header('x-scheduler-secret') ?? '';
        const expectedBuf = Buffer.from(configuredSecret, 'utf8');
        const providedRawBuf = Buffer.from(providedSecret, 'utf8');
        const providedBuf = Buffer.alloc(expectedBuf.length);
        providedRawBuf.copy(providedBuf, 0, 0, Math.min(providedRawBuf.length, expectedBuf.length));

        const equalLength = providedRawBuf.length === expectedBuf.length;
        const secretMatches =
            expectedBuf.length > 0 &&
            crypto.timingSafeEqual(expectedBuf, providedBuf) &&
            equalLength;

        if (!secretMatches) {
            serverLogger.warn('scheduler-api', 'Rejected scheduler trigger with invalid secret', { requestId });
            return res.status(401).json({
                success: false,
                status: 'unauthorized',
                reason: 'Invalid scheduler secret',
            });
        }
    }

    try {
        const outcome = await runScheduledPipeline();
        serverLogger.info('scheduler-api', 'Scheduler trigger completed', {
            requestId,
            status: outcome.status,
            accountId: outcome.accountId,
            reason: outcome.reason,
            nextRunAt: outcome.nextRunAt,
        });

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
        serverLogger.error('scheduler-api', 'Unexpected scheduler trigger error', {
            requestId,
            error: serializeError(error),
        });
        return res.status(500).json({
            success: false,
            status: 'failed',
            reason: error instanceof Error ? error.message : String(error),
        });
    }
});

export async function startServer() {
    serverLogger.info('startup', 'Server configuration resolved', {
        rawPort: process.env.PORT ?? null,
        port: PORT,
        chromeCleanupIntervalMs: CHROME_CLEANUP_INTERVAL_MS,
        chromeCleanupRetries: CHROME_CLEANUP_RETRIES,
        chromeCleanupRetryDelayMs: CHROME_CLEANUP_RETRY_DELAY_MS,
    });

    const bundleReady = await initializeBundleOrExit();
    if (!bundleReady) {
        return;
    }

    return new Promise<void>((resolve) => {
        httpServer = app.listen(PORT, '0.0.0.0', () => {
            serverLogger.info('startup', 'Server listening', {
                host: '0.0.0.0',
                port: PORT,
                endpoints: ['GET /health', 'POST /api/schedule/run', 'POST /api/render', 'GET /api/renders/:file'],
            });
            if (SCHEDULER_ENABLED) {
                startSchedulerLoop();
            } else {
                serverLogger.info('scheduler', 'Scheduler disabled', { enabled: false });
            }
            resolve();
        });

        httpServer.on('close', () => {
            serverLogger.info('shutdown', 'HTTP server closed');
        });
    });
}

function gracefulShutdown(signal: NodeJS.Signals) {
    if (shutdownInProgress) {
        serverLogger.warn('shutdown', 'Signal received while shutdown already in progress', { signal });
        return;
    }

    shutdownInProgress = true;
    serverLogger.info('shutdown', 'Starting graceful shutdown', { signal });

    clearInterval(periodicCleanupInterval);
    stopSchedulerLoop();
    cleanupChromeProcesses();

    const forceExitTimeout = setTimeout(() => {
        serverLogger.error('shutdown', 'Graceful shutdown timed out after 10s; forcing exit');
        process.exit(1);
    }, 10_000);
    forceExitTimeout.unref();

    if (!httpServer) {
        serverLogger.info('shutdown', 'No active HTTP server instance found; exiting');
        process.exit(0);
        return;
    }

    httpServer.close((error?: Error) => {
        clearTimeout(forceExitTimeout);
        if (error) {
            serverLogger.error('shutdown', 'Error while closing HTTP server', error);
            process.exit(1);
            return;
        }

        void closeRedisClient()
            .catch((redisError) => {
                serverLogger.error('shutdown', 'Error while closing Redis client', redisError);
            })
            .then(() => closeTelemetryPool())
            .catch((poolError) => {
                serverLogger.error('shutdown', 'Error while closing telemetry pool', poolError);
            })
            .finally(() => {
                serverLogger.info('shutdown', 'Graceful shutdown complete');
                process.exit(0);
            });
    });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
    serverLogger.error('process', 'Unhandled promise rejection', {
        error: serializeError(reason),
    });
});
process.on('uncaughtException', (error) => {
    serverLogger.error('process', 'Uncaught exception', error);
    process.exit(1);
});

app.post('/api/render', async (req, res) => {
    const requestId = res.locals.requestId;
    try {
        const { webhookUrl } = req.body;
        const validation = validateRenderManifest(req.body);
        if (validation.error || !validation.normalized) {
            return res.status(400).json({ error: validation.error ?? 'Invalid manifest format' });
        }

        const batchId = crypto.randomBytes(4).toString('hex');
        serverLogger.info('render-api', 'Render request accepted', {
            requestId,
            batchId,
            slideCount: validation.normalized.carousel.length,
            format: validation.normalized.format,
            webhook: Boolean(webhookUrl),
        });
        const processRenders = async () => {
            const rendered = await renderManifest(validation.normalized!, batchId);
            return rendered.images;
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
                    serverLogger.info('webhook', 'Delivered render success webhook', {
                        requestId,
                        batchId,
                        webhookUrl: sanitizeUrlForLogging(webhookUrl),
                        outputCount: outputUrls.length,
                    });
                } catch (e) {
                    serverLogger.error('webhook', 'Failed to send success webhook', {
                        requestId,
                        batchId,
                        webhookUrl: sanitizeUrlForLogging(webhookUrl),
                        error: serializeError(e),
                    });
                } finally {
                    await cleanupChromeProcessesWithRetries('webhook success cleanup');
                    warnIfTooManyChromeProcesses();
                    serverLogger.info('cleanup', 'Webhook render batch completed', {
                        requestId,
                        batchId,
                        durationMs: Date.now() - backgroundStartTime,
                    });
                }
            }).catch(async (error) => {
                try {
                    serverLogger.error('webhook', 'Background render error', {
                        requestId,
                        batchId,
                        error: serializeError(error),
                    });
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
                    serverLogger.error('webhook', 'Failed to send error webhook', {
                        requestId,
                        batchId,
                        webhookUrl: sanitizeUrlForLogging(webhookUrl),
                        error: serializeError(e),
                    });
                } finally {
                    await cleanupChromeProcessesWithRetries('webhook failure cleanup');
                    warnIfTooManyChromeProcesses();
                    serverLogger.info('cleanup', 'Webhook render batch failed', {
                        requestId,
                        batchId,
                        durationMs: Date.now() - backgroundStartTime,
                    });
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
            serverLogger.info('cleanup', 'Render batch completed', {
                requestId,
                batchId,
                durationMs: Date.now() - renderStartTime,
            });
        }

        res.json({ success: true, images: outputUrls });
    } catch (error) {
        serverLogger.error('render-api', 'Render request failed', {
            requestId,
            error: serializeError(error),
        });
        res.status(500).json({
            error: 'Failed to render images',
            details: error instanceof Error ? error.message : String(error),
        });
    }
});

// Catch-all 404 handler
app.use((req, res) => {
    serverLogger.warn('http-404', 'No route matched request', {
        requestId: res.locals.requestId,
        method: req.method,
        path: req.path,
    });
    res.status(404).json({ error: 'Not Found', path: req.path, method: req.method });
});

const isTestMode = process.env.NODE_ENV === 'test' || process.env.VITEST;
if (!isTestMode) {
    // Start server and await to ensure HTTP server is fully initialized before module finishes
    (async () => {
        try {
            await startServer();
        } catch (err) {
            serverLogger.error('startup', 'Failed to start server', err);
            process.exit(1);
        }
    })();
}

export const __testing = {
    resetBundleState(): void {
        renderTesting.resetBundleState();
    },
    setBundleLocation(nextBundleLocation: string | null): void {
        renderTesting.setBundleLocation(nextBundleLocation);
    },
};
