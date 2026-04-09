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
  runWithLockHeartbeat: vi.fn((_handle: unknown, _ttl: unknown, fn: () => Promise<unknown>) => fn()),
}));

vi.mock('../src/pipeline/retryPolicy', () => ({
  executeWithRetry: vi.fn(),
}));

import { runPipeline } from '../src/pipelineRun';
import { runScheduledPipeline } from '../src/pipeline/schedulerRunner';
import { validateInstagramSessionExpiry } from '../src/automation/instagramPublisher';
import { shouldRunNow, recordRunSuccess, recordRunFailure } from '../src/pipeline/scheduleState';
import { acquireDistributedLock, releaseDistributedLock } from '../src/pipeline/schedulerLock';
import { executeWithRetry } from '../src/pipeline/retryPolicy';

const mockedRunPipeline = vi.mocked(runPipeline);
const mockedValidateSession = vi.mocked(validateInstagramSessionExpiry);
const mockedShouldRunNow = vi.mocked(shouldRunNow);
const mockedRecordRunSuccess = vi.mocked(recordRunSuccess);
const mockedRecordRunFailure = vi.mocked(recordRunFailure);
const mockedAcquireLock = vi.mocked(acquireDistributedLock);
const mockedReleaseLock = vi.mocked(releaseDistributedLock);
const mockedExecuteWithRetry = vi.mocked(executeWithRetry);

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
    vi.restoreAllMocks();
    mockedShouldRunNow.mockResolvedValue({ allowed: true, state: baseState });
    mockedAcquireLock.mockResolvedValue({ key: 'pipeline:schedule:default', token: 'token-1' });
    mockedReleaseLock.mockResolvedValue(true);
    mockedValidateSession.mockReturnValue({ valid: true, expiresAt: '2026-12-31T00:00:00.000Z' });
    mockedExecuteWithRetry.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    mockedRunPipeline.mockResolvedValue(undefined);
    mockedRecordRunFailure.mockImplementation(async (_accountId, _now, nextRunAt, message) => ({
      ...baseState,
      nextRunAt,
      lastErrorAt: new Date('2026-04-06T00:00:00.000Z'),
      lastErrorMessage: message,
    }));

    delete process.env.SCHEDULE_ACCOUNT_ID;
    process.env.SCHEDULE_MIN_DELAY_HOURS = '3';
    process.env.SCHEDULE_MAX_DELAY_HOURS = '5';
  });

  afterEach(() => {
    delete process.env.SCHEDULE_MIN_DELAY_HOURS;
    delete process.env.SCHEDULE_MAX_DELAY_HOURS;
    delete process.env.SCHEDULE_ACCOUNT_ID;
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

  it('returns lock-held for concurrent invocations when first run owns lock', async () => {
    let locked = false;
    let resolveFirstRun: (() => void) | null = null;

    mockedAcquireLock.mockImplementation(async () => {
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

    const firstRunPromise = runScheduledPipeline();
    await Promise.resolve();

    const secondRunResult = await runScheduledPipeline();
    expect(secondRunResult.status).toBe('skipped_lock_held');

    resolveFirstRun?.();
    const firstRunResult = await firstRunPromise;
    expect(firstRunResult.status).toBe('executed');
    expect(mockedReleaseLock).toHaveBeenCalled();
  });
});
