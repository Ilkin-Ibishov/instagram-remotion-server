import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import * as schedulerRunner from '../src/pipeline/schedulerRunner';
import { app } from '../server.ts';

afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SCHEDULE_RUN_SECRET;
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
