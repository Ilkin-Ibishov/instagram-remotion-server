import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScheduleState } from '../src/pipeline/scheduleState';

vi.mock('../src/pipeline/scheduleState', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/pipeline/scheduleState')>();
  return {
    ...actual,
    recordAlertSent: vi.fn(() => Promise.resolve()),
  };
});

import { recordAlertSent } from '../src/pipeline/scheduleState';
import { maybeSendPipelineFailureAlert } from '../src/pipeline/scheduleAlerts';

const mockedRecordAlertSent = vi.mocked(recordAlertSent);

function state(partial: Partial<ScheduleState>): ScheduleState {
  return {
    accountId: 'default',
    nextRunAt: new Date('2026-04-10T12:00:00.000Z'),
    lastRunAt: new Date('2026-04-10T11:00:00.000Z'),
    lastSuccessAt: new Date('2026-04-01T10:00:00.000Z'),
    lastErrorAt: new Date('2026-04-10T11:00:00.000Z'),
    lastErrorMessage: 'boom',
    consecutiveFailureCount: 1,
    lastAlertSentAt: null,
    ...partial,
  };
}

describe('maybeSendPipelineFailureAlert', () => {
  const now = new Date('2026-04-10T12:00:00.000Z');
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PIPELINE_ALERT_WEBHOOK_URL = 'https://hooks.example.com/alert';
    delete process.env.PIPELINE_ALERT_WEBHOOK_SECRET;
    process.env.PIPELINE_ALERT_CONSECUTIVE_FAILURES = '3';
    process.env.PIPELINE_ALERT_MAX_HOURS_WITHOUT_SUCCESS = '48';
    process.env.PIPELINE_ALERT_COOLDOWN_HOURS = '6';
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('ok', { status: 200 }) as Response
    );
  });

  afterEach(() => {
    delete process.env.PIPELINE_ALERT_WEBHOOK_URL;
    delete process.env.PIPELINE_ALERT_WEBHOOK_SECRET;
    delete process.env.PIPELINE_ALERT_CONSECUTIVE_FAILURES;
    delete process.env.PIPELINE_ALERT_MAX_HOURS_WITHOUT_SUCCESS;
    delete process.env.PIPELINE_ALERT_COOLDOWN_HOURS;
    fetchSpy.mockRestore();
  });

  it('does nothing when webhook URL is unset', async () => {
    delete process.env.PIPELINE_ALERT_WEBHOOK_URL;
    await maybeSendPipelineFailureAlert('default', state({ consecutiveFailureCount: 99 }), now);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockedRecordAlertSent).not.toHaveBeenCalled();
  });

  it('fires on session-style error immediately', async () => {
    await maybeSendPipelineFailureAlert(
      'default',
      state({
        consecutiveFailureCount: 1,
        lastErrorMessage: 'Session file storage.json not found.',
      }),
      now
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const call = fetchSpy.mock.calls[0];
    expect(call[0]).toBe('https://hooks.example.com/alert');
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body.reason).toBe('session_preflight');
    expect(mockedRecordAlertSent).toHaveBeenCalledWith('default', now);
  });

  it('fires on consecutive failures threshold', async () => {
    await maybeSendPipelineFailureAlert(
      'default',
      state({ consecutiveFailureCount: 3, lastErrorMessage: 'render failed' }),
      now
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.reason).toBe('consecutive_failures');
    expect(body.consecutiveFailureCount).toBe(3);
  });

  it('skips when under threshold and not session', async () => {
    await maybeSendPipelineFailureAlert(
      'default',
      state({
        consecutiveFailureCount: 2,
        lastErrorMessage: 'transient',
        lastSuccessAt: new Date('2026-04-10T08:00:00.000Z'),
      }),
      now
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fires stale-success path when last success is old enough', async () => {
    await maybeSendPipelineFailureAlert(
      'default',
      state({
        consecutiveFailureCount: 1,
        lastErrorMessage: 'oops',
        lastSuccessAt: new Date('2026-04-01T10:00:00.000Z'),
      }),
      now
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.reason).toBe('stale_success_then_failure');
  });

  it('respects cooldown after last alert', async () => {
    await maybeSendPipelineFailureAlert(
      'default',
      state({
        consecutiveFailureCount: 3,
        lastErrorMessage: 'render failed',
        lastAlertSentAt: new Date('2026-04-10T10:00:00.000Z'),
      }),
      now
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockedRecordAlertSent).not.toHaveBeenCalled();
  });

  it('does not record alert when webhook returns non-OK', async () => {
    fetchSpy.mockResolvedValue(new Response('no', { status: 500 }) as Response);
    await maybeSendPipelineFailureAlert(
      'default',
      state({ consecutiveFailureCount: 3, lastErrorMessage: 'x' }),
      now
    );
    expect(mockedRecordAlertSent).not.toHaveBeenCalled();
  });

  it('sends Bearer when PIPELINE_ALERT_WEBHOOK_SECRET is set', async () => {
    process.env.PIPELINE_ALERT_WEBHOOK_SECRET = 'secret-token';
    await maybeSendPipelineFailureAlert(
      'default',
      state({ consecutiveFailureCount: 3, lastErrorMessage: 'x' }),
      now
    );
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret-token');
  });
});
