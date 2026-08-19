#!/usr/bin/env node
import 'dotenv/config';
import pg from 'pg';
import { client, close } from '../netlify/functions/lib/turso-db.mjs';

const tables = [
  'activity_log', 'invoices', 'job_components', 'jobs', 'claim_notes', 'documents',
  'item_costings', 'item_stones', 'claim_items', 'quotes', 'claims', 'customers',
  'insurer_contacts', 'watch_brand_rates', 'rate_cards', 'metal_prices', 'stock_items',
  'lookup_values', 'insurers', 'staff', 'xero_connections',
];
const importOrder = [...tables].reverse();
const replace = process.argv.includes('--replace');

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the PostgreSQL import source.');
if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required for the Turso import target.');
}
if (!replace) throw new Error('Pass --replace to replace the Turso staging snapshot with PostgreSQL source data.');

const source = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function valuesFor(row) {
  return Object.values(row).map(value => {
    if (value === undefined) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (value && typeof value === 'object' && !(value instanceof Uint8Array)) return JSON.stringify(value);
    return value;
  });
}

try {
  await source.connect();
  const data = new Map();
  for (const table of importOrder) {
    const { rows } = await source.query(`SELECT * FROM ${table} ORDER BY id`);
    data.set(table, rows);
  }

  await client.execute('PRAGMA foreign_keys = OFF');
  for (const table of tables) await client.execute(`DELETE FROM ${table}`);
  for (const table of importOrder) {
    const rows = data.get(table);
    if (!rows.length) continue;
    const columns = Object.keys(rows[0]);
    const statement = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
    await client.batch(rows.map(row => ({ sql: statement, args: valuesFor(row) })), 'write');
  }
  await client.execute('PRAGMA foreign_keys = ON');

  const counts = {};
  for (const table of importOrder) {
    const result = await client.execute(`SELECT COUNT(*) AS count FROM ${table}`);
    counts[table] = Number(result.rows[0].count);
  }
  console.log(`Imported PostgreSQL snapshot into Turso: ${JSON.stringify(counts)}`);
} finally {
  await source.end().catch(() => {});
  await close();
}
