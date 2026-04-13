#!/usr/bin/env node
// Usage:
//   DATABASE_PUBLIC_URL=... node scripts/scan_nul_text_columns.js
// or
//   railway run --service Postgres -- node scripts/scan_nul_text_columns.js

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
    const columns = await client.query(`
      SELECT table_schema, table_name, column_name
      FROM information_schema.columns
      WHERE data_type IN ('text', 'character varying', 'character')
        AND table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name, ordinal_position
    `);

    const findings = [];

    for (const row of columns.rows) {
      const schema = row.table_schema;
      const table = row.table_name;
      const column = row.column_name;

      const escapedSchema = schema.replace(/"/g, '""');
      const escapedTable = table.replace(/"/g, '""');
      const escapedColumn = column.replace(/"/g, '""');

      const sql = `
        SELECT COUNT(*)::int AS cnt
        FROM "${escapedSchema}"."${escapedTable}"
        WHERE "${escapedColumn}" IS NOT NULL
          AND position('00' IN encode(convert_to("${escapedColumn}"::text, 'UTF8'), 'hex')) > 0
      `;

      try {
        const result = await client.query(sql);
        const cnt = result.rows[0]?.cnt ?? 0;
        if (cnt > 0) {
          findings.push({ schema, table, column, rows: cnt });
        }
      } catch (err) {
        findings.push({
          schema,
          table,
          column,
          rows: -1,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (findings.length === 0) {
      console.log('No NUL bytes found in scanned text-like columns.');
      return;
    }

    console.log('Scan findings:');
    console.table(findings);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
