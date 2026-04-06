import { Pool } from 'pg';

export interface ScheduleState {
  accountId: string;
  nextRunAt: Date;
  lastRunAt: Date | null;
  lastSuccessAt: Date | null;
  lastErrorAt: Date | null;
  lastErrorMessage: string | null;
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
    schemaInitialized = true;
  } finally {
    client.release();
  }
}

function toState(row: any): ScheduleState {
  return {
    accountId: row.account_id,
    nextRunAt: new Date(row.next_run_at),
    lastRunAt: row.last_run_at ? new Date(row.last_run_at) : null,
    lastSuccessAt: row.last_success_at ? new Date(row.last_success_at) : null,
    lastErrorAt: row.last_error_at ? new Date(row.last_error_at) : null,
    lastErrorMessage: row.last_error_message ?? null,
  };
}

export async function getOrCreateScheduleState(accountId: string, now: Date): Promise<ScheduleState> {
  await ensureSchema();

  const client = await getPool().connect();
  try {
    const inserted = await client.query(
      `
      INSERT INTO schedule_state (account_id, next_run_at)
      VALUES ($1, $2)
      ON CONFLICT (account_id) DO NOTHING
      RETURNING *
      `,
      [accountId, now.toISOString()]
    );

    if (inserted.rows[0]) {
      return toState(inserted.rows[0]);
    }

    const selected = await client.query(
      'SELECT * FROM schedule_state WHERE account_id = $1',
      [accountId]
    );

    if (!selected.rows[0]) {
      throw new Error(`Failed to read schedule state for ${accountId}`);
    }

    return toState(selected.rows[0]);
  } finally {
    client.release();
  }
}

export async function shouldRunNow(accountId: string, now: Date): Promise<ShouldRunDecision> {
  const state = await getOrCreateScheduleState(accountId, now);

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

  const client = await getPool().connect();
  try {
    const result = await client.query(
      `
      UPDATE schedule_state
      SET
        last_run_at = $2,
        last_success_at = $2,
        next_run_at = $3,
        last_error_at = NULL,
        last_error_message = NULL,
        updated_at = NOW()
      WHERE account_id = $1
      RETURNING *
      `,
      [accountId, now.toISOString(), nextRunAt.toISOString()]
    );

    if (!result.rows[0]) {
      throw new Error(`Failed to persist success state for ${accountId}`);
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
    const result = await client.query(
      `
      UPDATE schedule_state
      SET
        last_run_at = $2,
        last_error_at = $2,
        last_error_message = $3,
        next_run_at = $4,
        updated_at = NOW()
      WHERE account_id = $1
      RETURNING *
      `,
      [accountId, now.toISOString(), errorMessage, nextRunAt.toISOString()]
    );

    if (!result.rows[0]) {
      throw new Error(`Failed to persist failure state for ${accountId}`);
    }

    return toState(result.rows[0]);
  } finally {
    client.release();
  }
}
