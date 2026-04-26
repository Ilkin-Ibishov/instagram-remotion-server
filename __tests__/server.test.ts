import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import request from 'supertest';
import * as schedulerRunner from '../src/pipeline/schedulerRunner';
import { __testing as serverTesting, app, bootstrapInstagramSession, initializeBundleOrExit } from '../server.ts';

afterEach(() => {
    vi.restoreAllMocks();
    serverTesting.resetBundleState();
    delete process.env.INSTAGRAM_SESSION_B64;
    delete process.env.SCHEDULE_RUN_SECRET;
});

describe('Instagram session bootstrap', () => {
    it('writes normalized UTF-8 JSON from INSTAGRAM_SESSION_B64 when provided', () => {
        const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

        const wroteSession = bootstrapInstagramSession('e30K', 'C:/tmp/storage.json');

        expect(wroteSession).toBe(true);
        expect(writeSpy).toHaveBeenCalledWith('C:/tmp/storage.json', '{}', 'utf-8');
        expect(logSpy).toHaveBeenCalledWith('[startup] Instagram session written from INSTAGRAM_SESSION_B64');
    });

    it('accepts UTF-16LE encoded JSON payload and rewrites as UTF-8', () => {
        const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);

        const utf16Payload = Buffer.from('{"cookies":[]}', 'utf16le').toString('base64');
        const wroteSession = bootstrapInstagramSession(utf16Payload, 'C:/tmp/storage.json');

        expect(wroteSession).toBe(true);
        expect(writeSpy).toHaveBeenCalledWith('C:/tmp/storage.json', '{"cookies":[]}', 'utf-8');
    });

    it('warns and does not write when INSTAGRAM_SESSION_B64 is absent', () => {
        const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        const wroteSession = bootstrapInstagramSession(undefined, 'C:/tmp/storage.json');

        expect(wroteSession).toBe(false);
        expect(writeSpy).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledWith('[startup] INSTAGRAM_SESSION_B64 not set; using existing storage.json if present');
    });
});

describe('POST /api/render', () => {
    it('should return 400 if the payload is missing required fields', async () => {
        const response = await request(app)
            .post('/api/render')
            .send({});

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'Invalid manifest format' });
    });

    it('should return 400 if carousel is not an array', async () => {
        const payload = {
            globalBranding: { accentColor: '#000', handle: '@test' },
            carousel: "not-an-array"
        };
        const response = await request(app)
            .post('/api/render')
            .send(payload);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'Invalid manifest format' });
    });

    it('should return 400 for invalid HOOK_A data', async () => {
        const payload = {
            globalBranding: { accentColor: '#000', handle: '@test', effects: [] },
            carousel: [
                {
                    templateId: 'HOOK_A',
                    data: {
                        subheadline: 'Missing headline should fail',
                    },
                },
            ],
        };

        const response = await request(app)
            .post('/api/render')
            .send(payload);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('slide[0].data.headline');
    });

    it('should return 400 for invalid CONTENT_LISTICLE items', async () => {
        const payload = {
            globalBranding: { accentColor: '#000', handle: '@test', effects: [] },
            carousel: [
                {
                    templateId: 'CONTENT_LISTICLE',
                    data: {
                        title: 'Title',
                        items: ['a', 'b'],
                        footnote: 'Source: Test',
                    },
                },
            ],
        };

        const response = await request(app)
            .post('/api/render')
            .send(payload);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('slide[0].data.items');
    });

    it('should return 400 when CTA_FINAL callToAction is not a question', async () => {
        const payload = {
            globalBranding: { accentColor: '#000', handle: '@test', effects: [] },
            carousel: [
                {
                    templateId: 'CTA_FINAL',
                    data: {
                        callToAction: 'Follow for more updates',
                        subtext: 'Share your take below',
                    },
                },
            ],
        };

        const response = await request(app)
            .post('/api/render')
            .send(payload);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('callToAction must end with a question mark');
    });

    it('should return 400 for invalid CONTENT_STAT_SNAPSHOT payload', async () => {
        const payload = {
            globalBranding: { accentColor: '#000', handle: '@test', effects: [] },
            carousel: [
                {
                    templateId: 'CONTENT_STAT_SNAPSHOT',
                    data: {
                        kicker: 'Signal',
                        stat: '41%',
                        context: 'Brief context',
                    },
                },
            ],
        };

        const response = await request(app)
            .post('/api/render')
            .send(payload);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('slide[0].data.takeaway');
    });

    it('should return 400 when CONTENT_MYTH_VS_FACT myth exceeds length limit', async () => {
        const payload = {
            globalBranding: { accentColor: '#000', handle: '@test', effects: [] },
            carousel: [
                {
                    templateId: 'CONTENT_MYTH_VS_FACT',
                    data: {
                        myth: 'x'.repeat(93),
                        fact: 'Concise fact.',
                        proof: 'Source-backed proof.',
                    },
                },
            ],
        };

        const response = await request(app)
            .post('/api/render')
            .send(payload);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('slide[0].data.myth must be <= 92 characters');
    });

    it('should return 400 when CONTENT_VIDEO caption exceeds length limit', async () => {
        const payload = {
            globalBranding: { accentColor: '#000', handle: '@test', effects: [] },
            carousel: [
                {
                    templateId: 'CONTENT_VIDEO',
                    data: {
                        title: 'Video proof',
                        videoUrl: null,
                        imageUrl: 'https://example.com/image.jpg',
                        caption: 'c'.repeat(121),
                        source: 'Source: Example',
                    },
                },
            ],
        };

        const response = await request(app)
            .post('/api/render')
            .send(payload);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('slide[0].data.caption must be <= 120 characters');
    });
});

describe('GET /health', () => {
    it('should return 503 when the Remotion bundle is not ready', async () => {
        const response = await request(app)
            .get('/health');

        expect(response.status).toBe(503);
        expect(response.body).toEqual({ status: 'not_ready', bundle: false });
    });

    it('should return 200 when the Remotion bundle is ready', async () => {
        serverTesting.setBundleLocation('/tmp/remotion-bundle');

        const response = await request(app)
            .get('/health');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: 'ok', bundle: true });
    });
});

describe('bundle startup readiness', () => {
    it('should exit when bundle initialization fails', async () => {
        const exitSpy = vi.fn();
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        const ready = await initializeBundleOrExit(exitSpy, async () => {
            throw new Error('bundle failed');
        });

        expect(ready).toBe(false);
        expect(exitSpy).toHaveBeenCalledWith(1);
        expect(errorSpy).toHaveBeenCalled();
    });
});

describe('POST /api/schedule/run', () => {
    it('should return 401 when scheduler secret is configured and missing', async () => {
        process.env.SCHEDULE_RUN_SECRET = 'expected-secret';

        const response = await request(app)
            .post('/api/schedule/run')
            .send({});

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.status).toBe('unauthorized');
    });

    it('should return 401 when scheduler secret is invalid', async () => {
        process.env.SCHEDULE_RUN_SECRET = 'expected-secret';

        const response = await request(app)
            .post('/api/schedule/run')
            .set('x-scheduler-secret', 'wrong-secret')
            .send({});

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.status).toBe('unauthorized');
    });

    it('should return 200 for executed status', async () => {
        process.env.SCHEDULE_RUN_SECRET = 'expected-secret';
        vi.spyOn(schedulerRunner, 'runScheduledPipeline').mockResolvedValueOnce({
            status: 'executed',
            accountId: 'default',
            nextRunAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        });

        const response = await request(app)
            .post('/api/schedule/run')
            .set('x-scheduler-secret', 'expected-secret')
            .send({});

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.status).toBe('executed');
    });

    it('should return 200 when scheduler skips due to time gate', async () => {
        process.env.SCHEDULE_RUN_SECRET = 'expected-secret';
        vi.spyOn(schedulerRunner, 'runScheduledPipeline').mockResolvedValueOnce({
            status: 'skipped_due_to_time',
            reason: 'not_due',
            accountId: 'default',
            nextRunAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        });

        const response = await request(app)
            .post('/api/schedule/run')
            .set('x-scheduler-secret', 'expected-secret')
            .send({});

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.status).toBe('skipped_due_to_time');
    });

    it('should return 500 when scheduler fails', async () => {
        process.env.SCHEDULE_RUN_SECRET = 'expected-secret';
        vi.spyOn(schedulerRunner, 'runScheduledPipeline').mockResolvedValueOnce({
            status: 'failed',
            reason: 'Session file storage.json not found.',
            accountId: 'default',
        });

        const response = await request(app)
            .post('/api/schedule/run')
            .set('x-scheduler-secret', 'expected-secret')
            .send({});

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.status).toBe('failed');
    });
});
