import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/utils/logger', () => {
  class MockLogger {
    info = vi.fn();
    warn = vi.fn();
    error = vi.fn();
    debug = vi.fn();
  }

  return {
    default: MockLogger,
  };
});

vi.mock('../src/pipelineRun', () => ({
  runPipeline: vi.fn(),
}));

vi.mock('../src/automation/instagramPublisher', () => ({
  validateInstagramSessionExpiry: vi.fn(),
}));

vi.mock('../src/pipeline/scheduleState', () => ({
  shouldRunNow: vi.fn(),
  recordRunSuccess: vi.fn(),
  recordRunFailure: vi.fn(),
}));

vi.mock('../src/pipeline/schedulerLock', () => ({
  acquireDistributedLock: vi.fn(),
  releaseDistributedLock: vi.fn(),
  // Pass-through: call the wrapped function immediately (no real Redis heartbeat in tests)
  runWithLockHeartbeat: vi.fn((_handle: unknown, _ttl: unknown, fn: (signal: AbortSignal) => Promise<unknown>) => {
    const controller = new AbortController();
    return fn(controller.signal);
  }),
}));

vi.mock('../src/pipeline/retryPolicy', () => ({
  executeWithRetry: vi.fn(),
}));

vi.mock('../src/pipeline/rssTelemetryStore', () => ({
  pruneTelemetry: vi.fn(),
  closeTelemetryPool: vi.fn(),
}));

import { runPipeline } from '../src/pipelineRun';
import { __testing as schedulerTesting, runScheduledPipeline } from '../src/pipeline/schedulerRunner';
import { startSchedulerLoop, stopSchedulerLoop } from '../server';
import { validateInstagramSessionExpiry } from '../src/automation/instagramPublisher';
import { shouldRunNow, recordRunSuccess, recordRunFailure } from '../src/pipeline/scheduleState';
import { acquireDistributedLock, releaseDistributedLock } from '../src/pipeline/schedulerLock';
import { executeWithRetry } from '../src/pipeline/retryPolicy';
import { pruneTelemetry } from '../src/pipeline/rssTelemetryStore';

const mockedRunPipeline = vi.mocked(runPipeline);
const mockedValidateSession = vi.mocked(validateInstagramSessionExpiry);
const mockedShouldRunNow = vi.mocked(shouldRunNow);
const mockedRecordRunSuccess = vi.mocked(recordRunSuccess);
const mockedRecordRunFailure = vi.mocked(recordRunFailure);
const mockedAcquireLock = vi.mocked(acquireDistributedLock);
const mockedReleaseLock = vi.mocked(releaseDistributedLock);
const mockedExecuteWithRetry = vi.mocked(executeWithRetry);
const mockedPruneTelemetry = vi.mocked(pruneTelemetry);

const baseState = {
  accountId: 'default',
  nextRunAt: new Date('2026-04-06T00:00:00.000Z'),
  lastRunAt: null,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastErrorMessage: null,
};

describe('runScheduledPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    schedulerTesting.resetState();
    mockedShouldRunNow.mockResolvedValue({ allowed: true, state: baseState });
    mockedAcquireLock.mockResolvedValue({ key: 'pipeline:schedule:default', token: 'token-1' });
    mockedReleaseLock.mockResolvedValue(true);
    mockedValidateSession.mockReturnValue({ valid: true, expiresAt: '2026-12-31T00:00:00.000Z' });
    mockedExecuteWithRetry.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    mockedRunPipeline.mockResolvedValue(undefined);
    mockedPruneTelemetry.mockResolvedValue(undefined);
    mockedRecordRunFailure.mockImplementation(async (_accountId, _now, nextRunAt, message) => ({
      ...baseState,
      nextRunAt,
      lastErrorAt: new Date('2026-04-06T00:00:00.000Z'),
      lastErrorMessage: message,
    }));

    delete process.env.SCHEDULE_ACCOUNT_ID;
    process.env.SCHEDULE_MIN_DELAY_HOURS = '3';
    process.env.SCHEDULE_MAX_DELAY_HOURS = '5';
    process.env.POSTING_TIMEZONE = 'UTC';
    process.env.POSTING_HOURS_START = '0';
    process.env.POSTING_HOURS_END = '24';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.SCHEDULE_MIN_DELAY_HOURS;
    delete process.env.SCHEDULE_MAX_DELAY_HOURS;
    delete process.env.SCHEDULE_ACCOUNT_ID;
    delete process.env.POSTING_TIMEZONE;
    delete process.env.POSTING_HOURS_START;
    delete process.env.POSTING_HOURS_END;
    delete process.env.REDIS_URL;
  });

  it('applies deterministic minimum jitter when Math.random is 0', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    let capturedNow: Date | null = null;
    let capturedNextRunAt: Date | null = null;

    mockedRecordRunSuccess.mockImplementation(async (_accountId, now, nextRunAt) => {
      capturedNow = now;
      capturedNextRunAt = nextRunAt;
      return {
        ...baseState,
        nextRunAt,
        lastRunAt: now,
        lastSuccessAt: now,
      };
    });

    const result = await runScheduledPipeline();

    expect(result.status).toBe('executed');
    expect(capturedNow).toBeTruthy();
    expect(capturedNextRunAt).toBeTruthy();

    const diffMs = capturedNextRunAt!.getTime() - capturedNow!.getTime();
    expect(diffMs).toBe(3 * 60 * 60 * 1000);

    randomSpy.mockRestore();
  });

  it('keeps jitter within configured bounds for high random values', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.999999);
    let capturedNow: Date | null = null;
    let capturedNextRunAt: Date | null = null;

    mockedRecordRunSuccess.mockImplementation(async (_accountId, now, nextRunAt) => {
      capturedNow = now;
      capturedNextRunAt = nextRunAt;
      return {
        ...baseState,
        nextRunAt,
        lastRunAt: now,
        lastSuccessAt: now,
      };
    });

    const result = await runScheduledPipeline();

    expect(result.status).toBe('executed');

    const diffMs = capturedNextRunAt!.getTime() - capturedNow!.getTime();
    const minMs = 3 * 60 * 60 * 1000;
    const maxMs = 5 * 60 * 60 * 1000;

    expect(diffMs).toBeGreaterThanOrEqual(minMs);
    expect(diffMs).toBeLessThan(maxMs);

    randomSpy.mockRestore();
  });

  it('runs the pipeline without acquiring a lock when REDIS_URL is not set', async () => {
    delete process.env.REDIS_URL;

    const result = await runScheduledPipeline();

    expect(result.status).toBe('executed');
    expect(mockedAcquireLock).not.toHaveBeenCalled();
    expect(mockedReleaseLock).not.toHaveBeenCalled();
    expect(mockedRunPipeline).toHaveBeenCalledTimes(1);
  });

  it('prevents concurrent pipeline runs via distributed lock', async () => {
    let locked = false;
    let acquireAttempts = 0;
    let releaseAcquireGate: (() => void) | null = null;
    let resolveFirstRun: (() => void) | null = null;
    const acquireGate = new Promise<void>((resolve) => {
      releaseAcquireGate = resolve;
    });

    mockedAcquireLock.mockImplementation(async () => {
      acquireAttempts += 1;
      await acquireGate;
      if (locked) {
        return null;
      }
      locked = true;
      return { key: 'pipeline:schedule:default', token: 'token-1' };
    });

    mockedReleaseLock.mockImplementation(async () => {
      locked = false;
      return true;
    });

    mockedRunPipeline.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveFirstRun = resolve;
        })
    );

    mockedRecordRunSuccess.mockImplementation(async (_accountId, now, nextRunAt) => ({
      ...baseState,
      nextRunAt,
      lastRunAt: now,
      lastSuccessAt: now,
    }));

    const resultsPromise = Promise.allSettled([
      runScheduledPipeline(),
      runScheduledPipeline(),
    ]);

    for (let i = 0; i < 10 && acquireAttempts < 2; i += 1) {
      await Promise.resolve();
    }
    expect(acquireAttempts).toBe(2);

    releaseAcquireGate?.();
    for (let i = 0; i < 10 && mockedRunPipeline.mock.calls.length === 0; i += 1) {
      await Promise.resolve();
    }

    expect(mockedRunPipeline).toHaveBeenCalledTimes(1);

    resolveFirstRun?.();
    const results = await resultsPromise;
    expect(results).toHaveLength(2);
    expect(results.every((result) => result.status === 'fulfilled')).toBe(true);

    const statuses = results.map((result) =>
      result.status === 'fulfilled' ? result.value.status : 'rejected'
    );
    expect(statuses).toContain('executed');
    expect(statuses).toContain('skipped_lock_held');
    expect(mockedReleaseLock).toHaveBeenCalled();
  });

  it('skips when outside configured posting window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-06T03:00:00.000Z'));
    process.env.POSTING_TIMEZONE = 'UTC';
    process.env.POSTING_HOURS_START = '8';
    process.env.POSTING_HOURS_END = '21';
    mockedAcquireLock.mockClear();
    mockedRunPipeline.mockClear();

    const result = await runScheduledPipeline();

    expect(result.status).toBe('skipped_due_to_time');
    expect(result.reason).toBe('outside_posting_window');
    expect(mockedAcquireLock).not.toHaveBeenCalled();
    expect(mockedRunPipeline).not.toHaveBeenCalled();
  });

  it('prunes telemetry once on weekly sunday runs after success', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-12T12:00:00.000Z'));

    await runScheduledPipeline();
    await runScheduledPipeline();

    expect(mockedPruneTelemetry).toHaveBeenCalledTimes(1);
  });

  it('does not prune telemetry outside the weekly prune window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-13T12:00:00.000Z'));

    await runScheduledPipeline();

    expect(mockedPruneTelemetry).not.toHaveBeenCalled();
  });
});

describe('startSchedulerLoop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
    mockedShouldRunNow.mockResolvedValue({ allowed: false, reason: 'not_due', state: baseState });
  });

  afterEach(() => {
    stopSchedulerLoop();
    vi.useRealTimers();
  });

  it('calls runScheduledPipeline on each poll interval', async () => {
    const spy = vi.spyOn(await import('../src/pipeline/schedulerRunner'), 'runScheduledPipeline')
      .mockResolvedValue({ status: 'skipped_due_to_time', reason: 'not_due', accountId: 'default', nextRunAt: baseState.nextRunAt.toISOString() });

    startSchedulerLoop();

    await vi.runAllTicks();
    expect(spy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_800_000);
    expect(spy).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1_800_000);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('survives errors from runScheduledPipeline without stopping', async () => {
    const spy = vi.spyOn(await import('../src/pipeline/schedulerRunner'), 'runScheduledPipeline')
      .mockRejectedValue(new Error('boom'));

    startSchedulerLoop();

    await vi.runAllTicks();
    expect(spy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_800_000);
    expect(spy).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1_800_000);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('retries shortly after startup when the lock is held', async () => {
    const spy = vi.spyOn(await import('../src/pipeline/schedulerRunner'), 'runScheduledPipeline')
      .mockResolvedValueOnce({ status: 'skipped_lock_held', reason: 'lock_held', accountId: 'default', lockKey: 'pipeline:schedule:default' })
      .mockResolvedValueOnce({ status: 'skipped_due_to_time', reason: 'not_due', accountId: 'default', nextRunAt: baseState.nextRunAt.toISOString() });

    startSchedulerLoop();

    await vi.runAllTicks();
    expect(spy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
