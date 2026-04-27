import { Pool } from 'pg';

export interface ScheduleState {
  accountId: string;
  nextRunAt: Date;
  lastRunAt: Date | null;
  lastSuccessAt: Date | null;
  lastErrorAt: Date | null;
  lastErrorMessage: string | null;
  /** Incremented on each recorded failure; reset to 0 on success. */
  consecutiveFailureCount: number;
  /** When a pipeline alert webhook was last accepted (dedupe / rate limit). */
  lastAlertSentAt: Date | null;
}

export interface ShouldRunDecision {
  allowed: boolean;
  reason?: 'not_due';
  state: ScheduleState;
}

let pool: Pool | null = null;
let schemaInitialized = false;

function getPool(): Pool {
  if (pool) {
    return pool;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for schedule state storage');
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
      CREATE TABLE IF NOT EXISTS schedule_state (
        account_id TEXT PRIMARY KEY,
        next_run_at TIMESTAMPTZ NOT NULL,
        last_run_at TIMESTAMPTZ,
        last_success_at TIMESTAMPTZ,
        last_error_at TIMESTAMPTZ,
        last_error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      ALTER TABLE schedule_state
      ADD COLUMN IF NOT EXISTS consecutive_failure_count INTEGER NOT NULL DEFAULT 0
    `);
    await client.query(`
      ALTER TABLE schedule_state
      ADD COLUMN IF NOT EXISTS last_alert_sent_at TIMESTAMPTZ
    `);
    schemaInitialized = true;
  } finally {
    client.release();
  }
}

function toState(row: any): ScheduleState {
  const rawCount = row.consecutive_failure_count;
  const count = typeof rawCount === 'number' && Number.isFinite(rawCount) ? rawCount : 0;
  return {
    accountId: row.account_id,
    nextRunAt: new Date(row.next_run_at),
    lastRunAt: row.last_run_at ? new Date(row.last_run_at) : null,
    lastSuccessAt: row.last_success_at ? new Date(row.last_success_at) : null,
    lastErrorAt: row.last_error_at ? new Date(row.last_error_at) : null,
    lastErrorMessage: row.last_error_message ?? null,
    consecutiveFailureCount: count,
    lastAlertSentAt: row.last_alert_sent_at ? new Date(row.last_alert_sent_at) : null,
  };
}

export async function getOrCreateScheduleState(accountId: string, now: Date): Promise<ScheduleState> {
  await ensureSchema();
  const safeAccountId = accountId.replace(/\0/g, '');

  const client = await getPool().connect();
  try {
    const inserted = await client.query(
      `
      INSERT INTO schedule_state (account_id, next_run_at)
      VALUES ($1, $2)
      ON CONFLICT (account_id) DO NOTHING
      RETURNING *
      `,
      [safeAccountId, now.toISOString()]
    );

    if (inserted.rows[0]) {
      return toState(inserted.rows[0]);
    }

    const selected = await client.query(
      'SELECT * FROM schedule_state WHERE account_id = $1',
      [safeAccountId]
    );

    if (!selected.rows[0]) {
      throw new Error(`Failed to read schedule state for ${safeAccountId}`);
    }

    return toState(selected.rows[0]);
  } finally {
    client.release();
  }
}

export async function shouldRunNow(accountId: string, now: Date): Promise<ShouldRunDecision> {
  const safeAccountId = accountId.replace(/\0/g, '');
  const state = await getOrCreateScheduleState(safeAccountId, now);

  if (state.nextRunAt.getTime() > now.getTime()) {
    return {
      allowed: false,
      reason: 'not_due',
      state,
    };
  }

  return {
    allowed: true,
    state,
  };
}

export async function recordRunSuccess(accountId: string, now: Date, nextRunAt: Date): Promise<ScheduleState> {
  await ensureSchema();
  const safeAccountId = accountId.replace(/\0/g, '');

  const client = await getPool().connect();
  try {
    let result;
    try {
      result = await client.query(
      `
      UPDATE schedule_state
      SET
        last_run_at = $2,
        last_success_at = $2,
        next_run_at = $3,
        last_error_at = NULL,
        last_error_message = NULL,
        consecutive_failure_count = 0,
        updated_at = NOW()
      WHERE account_id = $1
      RETURNING *
      `,
      [safeAccountId, now.toISOString(), nextRunAt.toISOString()]
      );
    } catch (err) {
      console.error('Postgres query failed in recordRunSuccess', {
        accountId: safeAccountId,
        now: now.toISOString(),
        nextRunAt: nextRunAt.toISOString(),
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    if (!result.rows[0]) {
      const msg = `Failed to persist success state for ${safeAccountId}`;
      console.error(msg);
      throw new Error(msg);
    }

    return toState(result.rows[0]);
  } finally {
    client.release();
  }
}

export async function recordRunFailure(
  accountId: string,
  now: Date,
  nextRunAt: Date,
  errorMessage: string
): Promise<ScheduleState> {
  await ensureSchema();

  const client = await getPool().connect();
  try {
    // Sanitize input strings to remove any NUL bytes which Postgres rejects for text types
    const safeAccountId = accountId.replace(/\0/g, '');
    const safeErrorMessage = errorMessage ? errorMessage.replace(/\0/g, '') : errorMessage;

    let result;
    try {
      result = await client.query(
      `
      UPDATE schedule_state
      SET
        last_run_at = $2,
        last_error_at = $2,
        last_error_message = $3,
        next_run_at = $4,
        consecutive_failure_count = schedule_state.consecutive_failure_count + 1,
        updated_at = NOW()
      WHERE account_id = $1
      RETURNING *
      `,
      [safeAccountId, now.toISOString(), safeErrorMessage, nextRunAt.toISOString()]
    );
    } catch (err) {
      console.error('Postgres query failed in recordRunFailure', {
        accountId: safeAccountId,
        now: now.toISOString(),
        nextRunAt: nextRunAt.toISOString(),
        errorMessage: safeErrorMessage,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    if (!result.rows[0]) {
      const msg = `Failed to persist failure state for ${safeAccountId}`;
      console.error(msg);
      throw new Error(msg);
    }

    return toState(result.rows[0]);
  } finally {
    client.release();
  }
}

/**
 * Read the current schedule state for an account without modifying it.
 * Returns null if no state has been recorded yet (pipeline has not run).
 */
export async function readScheduleState(accountId: string): Promise<ScheduleState | null> {
  await ensureSchema();
  const safeAccountId = accountId.replace(/\0/g, '');

  const client = await getPool().connect();
  try {
    const result = await client.query(
      'SELECT * FROM schedule_state WHERE account_id = $1',
      [safeAccountId]
    );

    return result.rows[0] ? toState(result.rows[0]) : null;
  } finally {
    client.release();
  }
}

/**
 * Record that an outbound pipeline alert webhook was delivered (for dedupe / cooldown).
 */
export async function recordAlertSent(accountId: string, at: Date): Promise<void> {
  await ensureSchema();
  const safeAccountId = accountId.replace(/\0/g, '');

  const client = await getPool().connect();
  try {
    await client.query(
      `
      UPDATE schedule_state
      SET last_alert_sent_at = $2, updated_at = NOW()
      WHERE account_id = $1
      `,
      [safeAccountId, at.toISOString()]
    );
  } finally {
    client.release();
  }
}

/** @internal Test-only reset of module singletons */
export function __resetScheduleStateForTests(): void {
  if (pool) {
    void pool.end().catch(() => undefined);
  }
  pool = null;
  schemaInitialized = false;
}
