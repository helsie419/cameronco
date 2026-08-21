// The Node client also runs in Netlify Functions, and supports `file:` URLs
// for deterministic local compatibility and regression tests.
import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required');
}

export const client = createClient({ url, authToken });

export function normaliseArgs(args) {
  return args.map(value => {
    if (value === undefined) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'number' && !Number.isFinite(value)) return null;
    if (value instanceof Date) return value.toISOString();
    if (value && typeof value === 'object' && !(value instanceof Uint8Array)) return JSON.stringify(value);
    return value;
  });
}

export function prepareStatement(sql, args = []) {
  const orderedArgs = [];
  const convertedSql = String(sql).replace(/\$(\d+)/g, (_, index) => {
    orderedArgs.push(args[Number(index) - 1]);
    return '?';
  });
  return {
    sql: convertedSql,
    args: normaliseArgs(orderedArgs.length ? orderedArgs : args),
  };
}

export async function query(sql, args = []) {
  const result = await client.execute(prepareStatement(sql, args));
  return { rows: result.rows, rowCount: result.rowsAffected };
}

export async function batch(statements, mode = 'write') {
  return client.batch(statements, mode);
}

export async function close() {
  client.close();
}

export function jsonValue(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return value;
}

export function jsonText(value) {
  return value === null || value === undefined ? null : JSON.stringify(value);
}
