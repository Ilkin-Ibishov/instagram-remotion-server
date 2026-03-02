import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../server.ts';

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
});
