import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  pgQuery: vi.fn(),
  pgRelease: vi.fn(),
  pgConnect: vi.fn(),
  redisGet: vi.fn(),
  redisSet: vi.fn(),
  redisDel: vi.fn(),
  redisIncr: vi.fn(),
  redisExpire: vi.fn(),
}));

vi.mock('pg', () => ({
  Pool: vi.fn(function MockPool() {
    return {
      connect: mocks.pgConnect,
    };
  }),
}));

vi.mock('../src/utils/redisClient', () => ({
  getRedisClient: vi.fn(async () => ({
    get: mocks.redisGet,
    set: mocks.redisSet,
    del: mocks.redisDel,
    incr: mocks.redisIncr,
    expire: mocks.redisExpire,
  })),
}));

import {
  __testing,
  classifyRssErrorType,
  noteSourceFetchFailure,
  noteSourceFetchSuccess,
  pruneTelemetry,
  recordRssRunTelemetry,
  recordRssSourceTelemetry,
  shouldSkipSourceByCooldown,
} from '../src/pipeline/rssTelemetryStore';
import Logger from '../src/utils/logger';

describe('rssTelemetryStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __testing.resetState();
    delete process.env.REDIS_URL;
    delete process.env.DATABASE_URL;
    delete process.env.RSS_SOURCE_FAILURE_THRESHOLD;
    delete process.env.RSS_SOURCE_COOLDOWN_SECONDS;
    delete process.env.RSS_SOURCE_FAILURE_TTL_SECONDS;
    delete process.env.RSS_TELEMETRY_RETENTION_DAYS;

    mocks.pgQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    mocks.pgRelease.mockReturnValue(undefined);
    mocks.pgConnect.mockResolvedValue({
      query: mocks.pgQuery,
      release: mocks.pgRelease,
    });

    mocks.redisGet.mockResolvedValue(null);
    mocks.redisSet.mockResolvedValue('OK');
    mocks.redisDel.mockResolvedValue(1);
    mocks.redisIncr.mockResolvedValue(1);
    mocks.redisExpire.mockResolvedValue(1);
  });

  it('classifies RSS error types by message patterns', () => {
    expect(classifyRssErrorType(new Error('ETIMEDOUT while fetching feed'))).toBe('timeout');
    expect(classifyRssErrorType(new Error('ECONNREFUSED upstream host'))).toBe('network');
    expect(classifyRssErrorType(new Error('invalid xml parse issue'))).toBe('parse');
    expect(classifyRssErrorType(new Error('unexpected thing happened'))).toBe('unknown');
  });

  it('returns skip true when cooldown-until is in the future', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    const future = new Date(Date.now() + 60_000).toISOString();
    mocks.redisGet.mockResolvedValue(future);

    const decision = await shouldSkipSourceByCooldown('techcrunch');

    expect(decision.shouldSkip).toBe(true);
    expect(decision.cooldownUntil).toBe(future);
  });

  it('fails open when cooldown check cannot access Redis', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    mocks.redisGet.mockRejectedValue(new Error('redis unavailable'));
    const logger = new Logger('test-run');

    const decision = await shouldSkipSourceByCooldown('techcrunch', logger);

    expect(decision.shouldSkip).toBe(false);
  });

  it('applies cooldown after reaching configured failure threshold', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.RSS_SOURCE_FAILURE_THRESHOLD = '2';
    process.env.RSS_SOURCE_COOLDOWN_SECONDS = '120';
    process.env.RSS_SOURCE_FAILURE_TTL_SECONDS = '600';
    mocks.redisIncr.mockResolvedValue(2);

    const result = await noteSourceFetchFailure('techcrunch', 'network');

    expect(result.cooldownApplied).toBe(true);
    expect(result.failureCount).toBe(2);
    expect(mocks.redisSet).toHaveBeenCalled();
  });

  it('clears health keys when a source succeeds', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';

    await noteSourceFetchSuccess('techcrunch');

    expect(mocks.redisDel).toHaveBeenCalledTimes(3);
  });

  it('skips source telemetry persistence when DATABASE_URL is missing', async () => {
    await recordRssSourceTelemetry({
      runId: 'run-1',
      sourceId: 'techcrunch',
      sourceName: 'TechCrunch',
      status: 'success',
      articlesBeforeFilter: 5,
      articlesAfterFilter: 4,
      cacheHit: false,
      retryCount: 0,
      durationMs: 123,
    });

    expect(mocks.pgConnect).not.toHaveBeenCalled();
  });

  it('attempts source and run telemetry writes without throwing when database is configured', async () => {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';

    await expect(recordRssSourceTelemetry({
      runId: 'run-2',
      sourceId: 'ars-technica',
      sourceName: 'Ars Technica',
      status: 'failed',
      articlesBeforeFilter: 0,
      articlesAfterFilter: 0,
      cacheHit: false,
      retryCount: 1,
      durationMs: 456,
      errorType: 'timeout',
      errorMessage: 'request timed out',
    })).resolves.toBeUndefined();

    await expect(recordRssRunTelemetry({
      runId: 'run-2',
      niches: ['technology'],
      totalSources: 6,
      fulfilledSources: 4,
      failedSources: 1,
      skippedSources: 1,
      mergedCount: 20,
      dedupedCount: 18,
      globalTimeoutTriggered: false,
      durationMs: 789,
    })).resolves.toBeUndefined();

    const queries = mocks.pgQuery.mock.calls.map(([sql]) => String(sql));
    expect(queries.some((sql) => sql.includes('CREATE INDEX IF NOT EXISTS idx_rss_source_tel_run_id'))).toBe(true);
    expect(queries.some((sql) => sql.includes('CREATE INDEX IF NOT EXISTS idx_rss_source_tel_created'))).toBe(true);
    expect(queries.some((sql) => sql.includes('CREATE INDEX IF NOT EXISTS idx_rss_run_tel_created'))).toBe(true);
  });

  it('prunes telemetry rows older than the configured retention window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-12T00:00:00.000Z'));
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
    process.env.RSS_TELEMETRY_RETENTION_DAYS = '14';

    await expect(pruneTelemetry()).resolves.toBeUndefined();

    expect(__testing.getTelemetryRetentionDays()).toBe(14);
    expect(mocks.pgQuery).toHaveBeenCalledWith(
      'DELETE FROM rss_source_telemetry WHERE created_at < $1',
      ['2026-03-29T00:00:00.000Z']
    );
    expect(mocks.pgQuery).toHaveBeenCalledWith(
      'DELETE FROM rss_run_telemetry WHERE created_at < $1',
      ['2026-03-29T00:00:00.000Z']
    );
  });
});
