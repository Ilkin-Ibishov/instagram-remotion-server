#!/usr/bin/env node
// Usage: DATABASE_URL=... node scripts/clean_nul_schedule_state.js
// Scans schedule_state for NUL bytes and removes them, printing affected rows.

import { Pool } from 'pg';

function resolveConnectionString() {
  const databaseUrl = process.env.DATABASE_URL;
  const databasePublicUrl = process.env.DATABASE_PUBLIC_URL;

  if (databaseUrl && !databaseUrl.includes('postgres.railway.internal')) {
    return databaseUrl;
  }

  if (databasePublicUrl) {
    return databasePublicUrl;
  }

  return databaseUrl;
}

async function main() {
  const connectionString = resolveConnectionString();
  if (!connectionString) {
    console.error('DATABASE_URL or DATABASE_PUBLIC_URL env required');
    process.exit(2);
  }

  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('proxy.rlwy.net') ? { rejectUnauthorized: false } : undefined,
  });
  const client = await pool.connect();
  try {
    const update = await client.query(
      `UPDATE schedule_state
       SET
         account_id = convert_from(
           decode(replace(encode(convert_to(account_id, 'UTF8'), 'hex'), '00', ''), 'hex'),
           'UTF8'
         ),
         last_error_message = CASE
           WHEN last_error_message IS NULL THEN NULL
           ELSE convert_from(
             decode(replace(encode(convert_to(last_error_message, 'UTF8'), 'hex'), '00', ''), 'hex'),
             'UTF8'
           )
         END
       WHERE
         position('00' IN encode(convert_to(account_id, 'UTF8'), 'hex')) > 0
         OR (
           last_error_message IS NOT NULL
           AND position('00' IN encode(convert_to(last_error_message, 'UTF8'), 'hex')) > 0
         )`
    );

    if (update.rowCount === 0) {
      console.log('No rows with NUL bytes found in schedule_state');
      return;
    }

    console.log(`Updated ${update.rowCount} row(s) in schedule_state`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
