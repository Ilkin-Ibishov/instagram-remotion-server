import Logger from '../utils/logger';
import { runPipeline } from '../pipelineRun';
import { validateInstagramSessionExpiry } from '../automation/instagramPublisher';
import {
  recordRunFailure,
  recordRunSuccess,
  shouldRunNow,
  type ScheduleState,
} from './scheduleState';
import { acquireDistributedLock, releaseDistributedLock, runWithLockHeartbeat } from './schedulerLock';
import { executeWithRetry } from './retryPolicy';

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

export async function runScheduledPipeline(): Promise<SchedulerOutcome> {
  const logger = new Logger();
  const accountId = process.env.SCHEDULE_ACCOUNT_ID || 'default';
  const minDelayHours = getNumberEnv('SCHEDULE_MIN_DELAY_HOURS', 3);
  const maxDelayHours = getNumberEnv('SCHEDULE_MAX_DELAY_HOURS', 5);
  const lockTtlSeconds = getNumberEnv('SCHEDULE_LOCK_TTL_SECONDS', 60 * 60 * 2);
  const retryCount = getNumberEnv('SCHEDULE_RETRY_COUNT', 1);
  const retryDelayMs = getNumberEnv('SCHEDULE_RETRY_DELAY_MS', 5000);
  const lockKey = `pipeline:schedule:${accountId}`;

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

  const lock = await acquireDistributedLock(lockKey, lockTtlSeconds);
  if (!lock) {
    logger.warn('schedule-lock', `Lock already held for ${accountId}`, { lockKey });
    return {
      status: 'skipped_lock_held',
      reason: 'lock_held',
      accountId,
      lockKey,
    };
  }

  try {
    const sessionValidation = validateInstagramSessionExpiry();
    if (!sessionValidation.valid) {
      const sessionError = sessionValidation.reason || 'Instagram session is invalid';
      const nextRunAt = computeNextRunAt(new Date(), minDelayHours, maxDelayHours);
      const updated = await recordRunFailure(accountId, new Date(), nextRunAt, sessionError);
      logger.error('schedule-preflight', 'Session validation failed', sessionError);

      return {
        status: 'failed',
        reason: sessionError,
        accountId,
        lockKey,
        ...normalizeOutcomeState(updated),
      };
    }

    await runWithLockHeartbeat(lock, lockTtlSeconds, () =>
      executeWithRetry(
        async () => runPipeline(),
        {
          maxRetries: retryCount,
          retryDelayMs,
          onRetry: (attempt, error) => {
            logger.warn('schedule-retry', `Retry attempt ${attempt}`, {
              error: extractErrorMessage(error),
            });
          },
        }
      )
    );

    const finishedAt = new Date();
    const nextRunAt = computeNextRunAt(finishedAt, minDelayHours, maxDelayHours);
    const updated = await recordRunSuccess(accountId, finishedAt, nextRunAt);

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

    logger.error('schedule', 'Scheduled run failed', errorMessage);

    return {
      status: 'failed',
      reason: errorMessage,
      accountId,
      lockKey,
      ...normalizeOutcomeState(updated),
    };
  } finally {
    await releaseDistributedLock(lock).catch((error) => {
      logger.warn('schedule-lock', 'Failed to release lock', {
        lockKey,
        error: extractErrorMessage(error),
      });
    });
  }
}
