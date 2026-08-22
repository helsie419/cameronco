#!/usr/bin/env node
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { client, query } from '../netlify/functions/lib/turso-db.mjs';
import { runSqlFile, convertStaticMigration } from './turso-runner.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
await query(`CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
const applied = new Set((await query('SELECT filename FROM schema_migrations')).rows.map(row => row.filename));

// Postgres-syntax migrations (db/migrations/NNN_*.sql) run against the
// self-hosted-Postgres path directly. Turso/SQLite can't run that syntax
// as-is (no CREATE OR REPLACE VIEW, no GENERATED ALWAYS AS IDENTITY, etc.),
// so each one that's actually needed on Turso gets a `.turso.sql` sibling
// with the SQLite-safe equivalent, applied here with no transform.
const tursoMigrations = [
  ['002_static_values_from_workbooks.sql', convertStaticMigration],
  ['015_reference_number_settings.turso.sql', value => value],
  ['016_xero_invoice_id_on_pipeline.turso.sql', value => value],
  ['017_claim_respond_by.turso.sql', value => value],
];

let pending = 0;
for (const [file, transform] of tursoMigrations) {
  if (applied.has(file)) continue;
  await runSqlFile(path.join(dir, 'migrations', file), transform);
  await query('INSERT INTO schema_migrations(filename) VALUES (?)', [file]);
  console.log(`Applied ${file}`);
  pending++;
}
if (!pending) console.log('No pending Turso migrations.');
await client.close();
