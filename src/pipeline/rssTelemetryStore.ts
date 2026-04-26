import { Pool } from 'pg';

import { getRedisClient } from '../utils/redisClient';
import Logger from '../utils/logger';

export type RssSourceStatus = 'success' | 'failed' | 'skipped_cooldown';
export type RssErrorType = 'timeout' | 'network' | 'parse' | 'unknown';

export interface RssSourceTelemetryInput {
  runId: string;
  sourceId: string;
  sourceName: string;
  status: RssSourceStatus;
  articlesBeforeFilter: number;
  articlesAfterFilter: number;
  cacheHit: boolean;
  retryCount: number;
  durationMs: number;
  errorType?: RssErrorType;
  errorMessage?: string;
}

export interface RssRunTelemetryInput {
  runId: string;
  niches: string[];
  totalSources: number;
  fulfilledSources: number;
  failedSources: number;
  skippedSources: number;
  mergedCount: number;
  dedupedCount: number;
  globalTimeoutTriggered: boolean;
  durationMs: number;
}

interface CooldownDecision {
  shouldSkip: boolean;
  cooldownUntil: string | null;
}

const REDIS_KEY_PREFIX = 'rss:health';
const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_COOLDOWN_SECONDS = 3600;
const DEFAULT_FAILURE_TTL_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_TELEMETRY_RETENTION_DAYS = 30;

let pool: Pool | null = null;
let schemaInitialized = false;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getFailureThreshold(): number {
  return parsePositiveInt(process.env.RSS_SOURCE_FAILURE_THRESHOLD, DEFAULT_FAILURE_THRESHOLD);
}

function getCooldownSeconds(): number {
  return parsePositiveInt(process.env.RSS_SOURCE_COOLDOWN_SECONDS, DEFAULT_COOLDOWN_SECONDS);
}

function getFailureTtlSeconds(): number {
  return parsePositiveInt(process.env.RSS_SOURCE_FAILURE_TTL_SECONDS, DEFAULT_FAILURE_TTL_SECONDS);
}

function getTelemetryRetentionDays(): number {
  return parsePositiveInt(process.env.RSS_TELEMETRY_RETENTION_DAYS, DEFAULT_TELEMETRY_RETENTION_DAYS);
}

function keyForConsecutiveFailures(sourceId: string): string {
  return `${REDIS_KEY_PREFIX}:${sourceId}:consecutive_failures`;
}

function keyForCooldownUntil(sourceId: string): string {
  return `${REDIS_KEY_PREFIX}:${sourceId}:cooldown_until`;
}

function keyForLastErrorType(sourceId: string): string {
  return `${REDIS_KEY_PREFIX}:${sourceId}:last_error_type`;
}

function getPool(): Pool {
  if (pool) {
    return pool;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for RSS telemetry storage');
  }

  pool = new Pool({ connectionString });
  return pool;
}

async function ensureSchema(): Promise<void> {
  if (schemaInitialized) {
    return;
  }

  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS rss_source_telemetry (
        id BIGSERIAL PRIMARY KEY,
        run_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        source_name TEXT NOT NULL,
        status TEXT NOT NULL,
        articles_before_filter INTEGER NOT NULL,
        articles_after_filter INTEGER NOT NULL,
        cache_hit BOOLEAN NOT NULL,
        retry_count INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        error_type TEXT,
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      ALTER TABLE rss_source_telemetry
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rss_source_tel_run_id
      ON rss_source_telemetry(run_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rss_source_tel_created
      ON rss_source_telemetry(created_at)
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS rss_run_telemetry (
        run_id TEXT PRIMARY KEY,
        niches TEXT[] NOT NULL,
        total_sources INTEGER NOT NULL,
        fulfilled_sources INTEGER NOT NULL,
        failed_sources INTEGER NOT NULL,
        skipped_sources INTEGER NOT NULL,
        merged_count INTEGER NOT NULL,
        deduped_count INTEGER NOT NULL,
        global_timeout_triggered BOOLEAN NOT NULL,
        duration_ms INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      ALTER TABLE rss_run_telemetry
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rss_run_tel_created
      ON rss_run_telemetry(created_at)
    `);
    schemaInitialized = true;
  } finally {
    client.release();
  }
}

export function classifyRssErrorType(error: unknown): RssErrorType {
  const message = String(error instanceof Error ? error.message : error).toLowerCase();
  if (/etimedout|timeout|timed out/.test(message)) {
    return 'timeout';
  }
  if (/econnreset|econnrefused|network|socket|enotfound/.test(message)) {
    return 'network';
  }
  if (/xml|rss|parse|invalid/.test(message)) {
    return 'parse';
  }
  return 'unknown';
}

export async function shouldSkipSourceByCooldown(sourceId: string, logger?: Logger): Promise<CooldownDecision> {
  if (!process.env.REDIS_URL) {
    return { shouldSkip: false, cooldownUntil: null };
  }

  try {
    const redis = await getRedisClient();
    const cooldownUntil = await redis.get(keyForCooldownUntil(sourceId));
    if (!cooldownUntil) {
      return { shouldSkip: false, cooldownUntil: null };
    }

    const cooldownMs = new Date(cooldownUntil).getTime();
    if (!Number.isNaN(cooldownMs) && cooldownMs > Date.now()) {
      return { shouldSkip: true, cooldownUntil };
    }

    await redis.del(keyForCooldownUntil(sourceId));
    return { shouldSkip: false, cooldownUntil: null };
  } catch (error) {
    logger?.warn('rss-health', `Cooldown check failed for ${sourceId}; fail-open`, {
      error: error instanceof Error ? error.message : error,
    });
    return { shouldSkip: false, cooldownUntil: null };
  }
}

export async function noteSourceFetchSuccess(sourceId: string, logger?: Logger): Promise<void> {
  if (!process.env.REDIS_URL) {
    return;
  }

  try {
    const redis = await getRedisClient();
    await redis.del(keyForConsecutiveFailures(sourceId));
    await redis.del(keyForCooldownUntil(sourceId));
    await redis.del(keyForLastErrorType(sourceId));
  } catch (error) {
    logger?.warn('rss-health', `Failed to reset source health state for ${sourceId}`, {
      error: error instanceof Error ? error.message : error,
    });
  }
}

export async function noteSourceFetchFailure(
  sourceId: string,
  errorType: RssErrorType,
  logger?: Logger
): Promise<{ failureCount: number; cooldownApplied: boolean; cooldownUntil: string | null }> {
  if (!process.env.REDIS_URL) {
    return { failureCount: 0, cooldownApplied: false, cooldownUntil: null };
  }

  const threshold = getFailureThreshold();
  const cooldownSeconds = getCooldownSeconds();
  const failureTtlSeconds = getFailureTtlSeconds();

  try {
    const redis = await getRedisClient();
    const failuresKey = keyForConsecutiveFailures(sourceId);
    const nextFailureCount = await redis.incr(failuresKey);
    await redis.expire(failuresKey, failureTtlSeconds);
    await redis.set(keyForLastErrorType(sourceId), errorType, { EX: failureTtlSeconds });

    if (nextFailureCount >= threshold) {
      const cooldownUntil = new Date(Date.now() + cooldownSeconds * 1000).toISOString();
      await redis.set(keyForCooldownUntil(sourceId), cooldownUntil, { EX: cooldownSeconds });
      logger?.warn('rss-health', `Source ${sourceId} entered cooldown`, {
        sourceId,
        failureCount: nextFailureCount,
        threshold,
        cooldownSeconds,
        cooldownUntil,
      });
      return {
        failureCount: nextFailureCount,
        cooldownApplied: true,
        cooldownUntil,
      };
    }

    return {
      failureCount: nextFailureCount,
      cooldownApplied: false,
      cooldownUntil: null,
    };
  } catch (error) {
    logger?.warn('rss-health', `Failed to record source health failure for ${sourceId}`, {
      error: error instanceof Error ? error.message : error,
    });
    return { failureCount: 0, cooldownApplied: false, cooldownUntil: null };
  }
}

export async function recordRssSourceTelemetry(input: RssSourceTelemetryInput, logger?: Logger): Promise<void> {
  if (!process.env.DATABASE_URL) {
    return;
  }

  try {
    await ensureSchema();
    const client = await getPool().connect();
    try {
      await client.query(
        `
        INSERT INTO rss_source_telemetry (
          run_id,
          source_id,
          source_name,
          status,
          articles_before_filter,
          articles_after_filter,
          cache_hit,
          retry_count,
          duration_ms,
          error_type,
          error_message
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `,
        [
          input.runId,
          input.sourceId,
          input.sourceName,
          input.status,
          input.articlesBeforeFilter,
          input.articlesAfterFilter,
          input.cacheHit,
          input.retryCount,
          input.durationMs,
          input.errorType ?? null,
          input.errorMessage ?? null,
        ]
      );
    } finally {
      client.release();
    }
  } catch (error) {
    logger?.warn('rss-telemetry', `Failed to persist source telemetry for ${input.sourceId}`, {
      error: error instanceof Error ? error.message : error,
    });
  }
}

export async function recordRssRunTelemetry(input: RssRunTelemetryInput, logger?: Logger): Promise<void> {
  if (!process.env.DATABASE_URL) {
    return;
  }

  try {
    await ensureSchema();
    const client = await getPool().connect();
    try {
      await client.query(
        `
        INSERT INTO rss_run_telemetry (
          run_id,
          niches,
          total_sources,
          fulfilled_sources,
          failed_sources,
          skipped_sources,
          merged_count,
          deduped_count,
          global_timeout_triggered,
          duration_ms
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (run_id)
        DO NOTHING
        `,
        [
          input.runId,
          input.niches,
          input.totalSources,
          input.fulfilledSources,
          input.failedSources,
          input.skippedSources,
          input.mergedCount,
          input.dedupedCount,
          input.globalTimeoutTriggered,
          input.durationMs,
        ]
      );
    } finally {
      client.release();
    }
  } catch (error) {
    logger?.warn('rss-telemetry', `Failed to persist run telemetry for ${input.runId}`, {
      error: error instanceof Error ? error.message : error,
    });
  }
}

export async function pruneTelemetry(retentionDays = getTelemetryRetentionDays(), logger?: Logger): Promise<void> {
  if (!process.env.DATABASE_URL) {
    return;
  }

  try {
    await ensureSchema();
    const client = await getPool().connect();
    try {
      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
      const sourceResult = await client.query(
        'DELETE FROM rss_source_telemetry WHERE created_at < $1',
        [cutoff]
      );
      const runResult = await client.query(
        'DELETE FROM rss_run_telemetry WHERE created_at < $1',
        [cutoff]
      );

      logger?.info('rss-telemetry', 'Pruned expired RSS telemetry rows', {
        retentionDays,
        cutoff,
        deletedSourceRows: sourceResult.rowCount ?? 0,
        deletedRunRows: runResult.rowCount ?? 0,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    logger?.warn('rss-telemetry', 'Failed to prune RSS telemetry rows', {
      error: error instanceof Error ? error.message : error,
      retentionDays,
    });
  }
}

export async function closeTelemetryPool(): Promise<void> {
  if (!pool) {
    return;
  }

  const activePool = pool;
  pool = null;
  schemaInitialized = false;
  await activePool.end();
}

export const __testing = {
  classifyRssErrorType,
  getTelemetryRetentionDays,
  keyForConsecutiveFailures,
  keyForCooldownUntil,
  keyForLastErrorType,
  resetState(): void {
    pool = null;
    schemaInitialized = false;
  },
};