import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { addComment, setTaskStatus } from '../src/automation/clickupClient';

function makeResponse(status: number, body: unknown, retryAfter?: string): Response {
  const headers = new Headers();
  if (retryAfter !== undefined) {
    headers.set('Retry-After', retryAfter);
  }

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 429 ? 'Too Many Requests' : 'OK',
    headers,
    text: vi.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

describe('clickupClient retry behavior', () => {
  beforeEach(() => {
    process.env.CLICKUP_TOKEN = 'test-token';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete process.env.CLICKUP_TOKEN;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('retries on 429 using Retry-After header for addComment', async () => {
    vi.useFakeTimers();

    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(makeResponse(429, { err: 'rate limited' }, '2'))
      .mockResolvedValueOnce(makeResponse(200, { ok: true }));

    const resultPromise = addComment('task-1', 'hello');

    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await expect(resultPromise).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses 60s default delay when 429 has no Retry-After header', async () => {
    vi.useFakeTimers();

    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(makeResponse(429, { err: 'rate limited' }))
      .mockResolvedValueOnce(makeResponse(200, { ok: true }));

    const resultPromise = setTaskStatus('task-1', 'complete');

    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(59_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await expect(resultPromise).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws after max retries are exhausted for 429 responses', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(makeResponse(429, { err: 'still limited' }, '0'));

    await expect(addComment('task-1', 'hello')).rejects.toThrow('ClickUp API error 429');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
