import { describe, expect, it } from 'vitest';

const RAILWAY_URL = process.env.RAILWAY_TEST_URL;
const SCHEDULER_SECRET = process.env.SCHEDULER_SECRET;

describe.skipIf(!RAILWAY_URL || !SCHEDULER_SECRET)('Railway endpoint integration', () => {
  it('POST /api/schedule/run returns a success status with valid scheduler secret', async () => {
    const res = await fetch(`${RAILWAY_URL}/api/schedule/run`, {
      method: 'POST',
      headers: {
        'X-Scheduler-Secret': SCHEDULER_SECRET as string,
      },
    });

    expect([200, 202]).toContain(res.status);
  });
});
