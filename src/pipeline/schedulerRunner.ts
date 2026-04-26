import Logger from '../utils/logger';
import { runPipeline } from '../pipelineRun';
import { validateInstagramSessionExpiry } from '../automation/instagramPublisher';
import { pruneTelemetry } from './rssTelemetryStore';
import {
  recordRunFailure,
  recordRunSuccess,
  shouldRunNow,
  type ScheduleState,
} from './scheduleState';
import {
  acquireDistributedLock,
  releaseDistributedLock,
  runWithLockHeartbeat,
  type LockHandle,
} from './schedulerLock';
import { executeWithRetry } from './retryPolicy';
import { isRedisUrlConfigured } from '../utils/redisClient';

let lastTelemetryPruneWeek: string | null = null;

export type SchedulerOutcomeStatus =
  | 'executed'
  | 'skipped_due_to_time'
  | 'skipped_lock_held'
  | 'failed';

export interface SchedulerOutcome {
  status: SchedulerOutcomeStatus;
  reason?: string;
  accountId: string;
  nextRunAt?: string;
  lockKey?: string;
}

function getNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function getHourEnv(name: string, fallback: number): number {
  const value = Math.floor(getNumberEnv(name, fallback));
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(23, Math.max(0, value));
}

function getLocalHourInTimezone(now: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    hour12: false,
    timeZone,
  });
  const hourPart = formatter.formatToParts(now).find((part) => part.type === 'hour')?.value;
  const parsed = Number(hourPart);
  return Number.isFinite(parsed) ? parsed : now.getUTCHours();
}

function isWithinPostingWindow(localHour: number, startHour: number, endHour: number): boolean {
  if (startHour === endHour) {
    return true;
  }

  // Support windows that cross midnight, e.g. 22 -> 6
  if (startHour < endHour) {
    return localHour >= startHour && localHour < endHour;
  }

  return localHour >= startHour || localHour < endHour;
}

function computeNextRunAt(now: Date, minHours: number, maxHours: number): Date {
  const minMs = minHours * 60 * 60 * 1000;
  const maxMs = maxHours * 60 * 60 * 1000;
  const offset = minMs + Math.floor(Math.random() * Math.max(maxMs - minMs, 1));
  return new Date(now.getTime() + offset);
}

function extractErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeOutcomeState(state: ScheduleState): Pick<SchedulerOutcome, 'nextRunAt'> {
  return {
    nextRunAt: state.nextRunAt.toISOString(),
  };
}

function getTelemetryPruneWeekMarker(now: Date): string {
  const marker = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  marker.setUTCDate(marker.getUTCDate() - marker.getUTCDay());
  return marker.toISOString().slice(0, 10);
}

function shouldPruneTelemetryThisRun(now: Date): boolean {
  if (now.getUTCDay() !== 0) {
    return false;
  }

  const marker = getTelemetryPruneWeekMarker(now);
  if (lastTelemetryPruneWeek === marker) {
    return false;
  }

  lastTelemetryPruneWeek = marker;
  return true;
}

export async function runScheduledPipeline(): Promise<SchedulerOutcome> {
  const logger = new Logger();
  const accountId = process.env.ACCOUNT_ID || process.env.SCHEDULE_ACCOUNT_ID || 'default';
  const minDelayHours = getNumberEnv('SCHEDULE_MIN_DELAY_HOURS', 3);
  const maxDelayHours = getNumberEnv('SCHEDULE_MAX_DELAY_HOURS', 5);
  const postingTimezone = process.env.POSTING_TIMEZONE || 'UTC';
  const postingHoursStart = getHourEnv('POSTING_HOURS_START', 8);
  const postingHoursEnd = getHourEnv('POSTING_HOURS_END', 21);
  const lockTtlSeconds = getNumberEnv('SCHEDULE_LOCK_TTL_SECONDS', 60 * 60 * 2);
  const retryCount = getNumberEnv('SCHEDULE_RETRY_COUNT', 1);
  const retryDelayMs = getNumberEnv('SCHEDULE_RETRY_DELAY_MS', 5000);
  const lockKey = `pipeline:schedule:${accountId}`;
  const redisLockEnabled = isRedisUrlConfigured();

  const now = new Date();
  const decision = await shouldRunNow(accountId, now);

  if (!decision.allowed) {
    logger.info('schedule-gate', `Skipping run for ${accountId}`, {
      reason: decision.reason,
      nextRunAt: decision.state.nextRunAt.toISOString(),
    });

    return {
      status: 'skipped_due_to_time',
      reason: decision.reason,
      accountId,
      ...normalizeOutcomeState(decision.state),
    };
  }

  const localHour = getLocalHourInTimezone(now, postingTimezone);
  if (!isWithinPostingWindow(localHour, postingHoursStart, postingHoursEnd)) {
    logger.info('schedule-window', `Skipping run for ${accountId}: outside posting window`, {
      postingTimezone,
      localHour,
      postingHoursStart,
      postingHoursEnd,
      nextRunAt: decision.state.nextRunAt.toISOString(),
    });
    return {
      status: 'skipped_due_to_time',
      reason: 'outside_posting_window',
      accountId,
      ...normalizeOutcomeState(decision.state),
    };
  }

  let lock: LockHandle | null = null;

  if (redisLockEnabled) {
    lock = await acquireDistributedLock(lockKey, lockTtlSeconds);
    if (!lock) {
      logger.warn('schedule-lock', `Lock already held for ${accountId}`, { lockKey });
      return {
        status: 'skipped_lock_held',
        reason: 'lock_held',
        accountId,
        lockKey,
      };
    }
  } else {
    logger.warn('schedule-lock', 'REDIS_URL not set; scheduled run proceeds without a distributed lock', {
      accountId,
    });
  }

  try {
    const sessionValidation = validateInstagramSessionExpiry();
    if (!sessionValidation.valid) {
      const sessionError = sessionValidation.reason || 'Instagram session is invalid';
      const nextRunAt = computeNextRunAt(new Date(), minDelayHours, maxDelayHours);
      const updated = await recordRunFailure(accountId, new Date(), nextRunAt, sessionError);
      logger.error('schedule-preflight', 'Session validation failed', new Error(sessionError));

      return {
        status: 'failed',
        reason: sessionError,
        accountId,
        lockKey,
        ...normalizeOutcomeState(updated),
      };
    }

    const runPipelineWithRetries = (signal: AbortSignal | undefined) =>
      executeWithRetry(
        async () => runPipeline(signal),
        {
          maxRetries: retryCount,
          retryDelayMs,
          onRetry: (attempt, error) => {
            logger.warn('schedule-retry', `Retry attempt ${attempt}`, {
              error: extractErrorMessage(error),
            });
          },
        }
      );

    if (lock) {
      await runWithLockHeartbeat(lock, lockTtlSeconds, (signal) => runPipelineWithRetries(signal));
    } else {
      await runPipelineWithRetries(undefined);
    }

    const finishedAt = new Date();
    const nextRunAt = computeNextRunAt(finishedAt, minDelayHours, maxDelayHours);
    const updated = await recordRunSuccess(accountId, finishedAt, nextRunAt);

    if (shouldPruneTelemetryThisRun(finishedAt)) {
      void pruneTelemetry(undefined, logger);
    }

    logger.info('schedule', 'Scheduled run completed', {
      accountId,
      nextRunAt: nextRunAt.toISOString(),
    });

    return {
      status: 'executed',
      accountId,
      lockKey,
      ...normalizeOutcomeState(updated),
    };
  } catch (error) {
    const errorMessage = extractErrorMessage(error);
    const failedAt = new Date();
    const nextRunAt = computeNextRunAt(failedAt, minDelayHours, maxDelayHours);
    const updated = await recordRunFailure(accountId, failedAt, nextRunAt, errorMessage);

    logger.error('schedule', 'Scheduled run failed', error);

    return {
      status: 'failed',
      reason: errorMessage,
      accountId,
      lockKey,
      ...normalizeOutcomeState(updated),
    };
  } finally {
    if (lock) {
      await releaseDistributedLock(lock).catch((error) => {
        logger.warn('schedule-lock', 'Failed to release lock', {
          lockKey,
          error: extractErrorMessage(error),
        });
      });
    }
  }
}

export const __testing = {
  getTelemetryPruneWeekMarker,
  resetState(): void {
    lastTelemetryPruneWeek = null;
  },
  shouldPruneTelemetryThisRun,
};
