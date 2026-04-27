import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  pgQuery: vi.fn(),
  pgRelease: vi.fn(),
  pgConnect: vi.fn(),
}));

vi.mock('pg', () => ({
  Pool: vi.fn(function MockPool() {
    return {
      connect: mocks.pgConnect,
      end: vi.fn().mockResolvedValue(undefined),
    };
  }),
}));

describe('scheduleState pipeline cooldown', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/test';
    delete process.env.PIPELINE_COOLDOWN_FAILURE_THRESHOLD;
    delete process.env.PIPELINE_COOLDOWN_MINUTES;

    mocks.pgRelease.mockReturnValue(undefined);
    mocks.pgConnect.mockResolvedValue({
      query: mocks.pgQuery,
      release: mocks.pgRelease,
    });
  });

  afterEach(async () => {
    delete process.env.DATABASE_URL;
    const mod = await import('../src/pipeline/scheduleState');
    mod.__resetScheduleStateForTests();
    vi.resetModules();
  });

  function row(overrides: Record<string, unknown> = {}) {
    return {
      account_id: 'default',
      next_run_at: new Date('2026-04-10T08:00:00.000Z'),
      last_run_at: null,
      last_success_at: null,
      last_error_at: null,
      last_error_message: null,
      consecutive_failure_count: 0,
      last_alert_sent_at: null,
      pipeline_cooldown_until: null,
      ...overrides,
    };
  }

  it('shouldRunNow blocks when pipeline_cooldown_until is in the future', async () => {
    const future = new Date('2026-04-10T12:00:00.000Z');
    const now = new Date('2026-04-10T10:00:00.000Z');
    mocks.pgQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('CREATE TABLE')) return { rows: [] };
      if (sql.includes('ADD COLUMN')) return { rows: [] };
      if (sql.includes('INSERT INTO schedule_state')) return { rows: [] };
      if (sql.includes('SELECT * FROM schedule_state')) {
        return { rows: [row({ next_run_at: now, pipeline_cooldown_until: future })] };
      }
      return { rows: [] };
    });

    const mod = await import('../src/pipeline/scheduleState');
    const d = await mod.shouldRunNow('default', now);
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe('pipeline_cooldown');
  });

  it('recordRunFailure sets pipeline_cooldown_until when threshold reached', async () => {
    process.env.PIPELINE_COOLDOWN_FAILURE_THRESHOLD = '2';
    process.env.PIPELINE_COOLDOWN_MINUTES = '45';

    const now = new Date('2026-04-10T10:00:00.000Z');
    const nextRun = new Date('2026-04-10T14:00:00.000Z');
    const afterFailure = row({
      consecutive_failure_count: 2,
      last_error_message: 'bad',
      pipeline_cooldown_until: null,
    });
    const afterCooldown = row({
      ...afterFailure,
      pipeline_cooldown_until: new Date(now.getTime() + 45 * 60 * 1000),
    });

    mocks.pgQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes('CREATE TABLE')) return { rows: [] };
      if (sql.includes('ADD COLUMN')) return { rows: [] };
      if (sql.includes('UPDATE schedule_state') && sql.includes('consecutive_failure_count')) {
        return { rows: [afterFailure] };
      }
      if (sql.includes('pipeline_cooldown_until = $2')) {
        expect(params?.[1]).toBe(afterCooldown.pipeline_cooldown_until.toISOString());
        return { rows: [afterCooldown] };
      }
      return { rows: [] };
    });

    const mod = await import('../src/pipeline/scheduleState');
    const st = await mod.recordRunFailure('default', now, nextRun, 'bad');
    expect(st.pipelineCooldownUntil?.getTime()).toBe(afterCooldown.pipeline_cooldown_until.getTime());
    expect(mocks.pgQuery.mock.calls.some((c) => String(c[0]).includes('pipeline_cooldown_until'))).toBe(true);
  });

  it('recordRunFailure does not set cooldown when threshold is 0', async () => {
    process.env.PIPELINE_COOLDOWN_FAILURE_THRESHOLD = '0';
    const now = new Date('2026-04-10T10:00:00.000Z');
    const nextRun = new Date('2026-04-10T14:00:00.000Z');
    const afterFailure = row({
      consecutive_failure_count: 5,
      last_error_message: 'bad',
      pipeline_cooldown_until: null,
    });

    mocks.pgQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('CREATE TABLE')) return { rows: [] };
      if (sql.includes('ADD COLUMN')) return { rows: [] };
      if (sql.includes('consecutive_failure_count')) {
        return { rows: [afterFailure] };
      }
      return { rows: [] };
    });

    const mod = await import('../src/pipeline/scheduleState');
    await mod.recordRunFailure('default', now, nextRun, 'bad');
    expect(mocks.pgQuery.mock.calls.some((c) => String(c[0]).includes('pipeline_cooldown_until = $2'))).toBe(false);
  });

  it('recordRunSuccess clears pipeline_cooldown_until', async () => {
    const now = new Date('2026-04-10T10:00:00.000Z');
    const nextRun = new Date('2026-04-10T14:00:00.000Z');
    mocks.pgQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('CREATE TABLE')) return { rows: [] };
      if (sql.includes('ADD COLUMN')) return { rows: [] };
      if (sql.includes('consecutive_failure_count = 0')) {
        return {
          rows: [
            row({
              last_success_at: now,
              consecutive_failure_count: 0,
              pipeline_cooldown_until: null,
              next_run_at: nextRun,
            }),
          ],
        };
      }
      return { rows: [] };
    });

    const mod = await import('../src/pipeline/scheduleState');
    const st = await mod.recordRunSuccess('default', now, nextRun);
    expect(st.consecutiveFailureCount).toBe(0);
    expect(st.pipelineCooldownUntil).toBeNull();
  });
});
