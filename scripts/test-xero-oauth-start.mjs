#!/usr/bin/env node
import { mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempDir = await mkdtemp(path.join(os.tmpdir(), 'cameronco-xero-oauth-'));
const environment = {
  ...process.env,
  TURSO_DATABASE_URL: `file:${path.join(tempDir, 'crm.db')}`,
  TURSO_AUTH_TOKEN: 'local-oauth-test',
  XERO_MODE: 'live',
  XERO_CLIENT_ID: 'test-client-id',
  XERO_CLIENT_SECRET: 'test-client-secret',
  XERO_REDIRECT_URI: 'http://localhost:8891/api/xero/auth/callback',
  XERO_CONNECT_SECRET: 'test-connect-secret',
  XERO_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
};

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  const setup = spawnSync(process.execPath, ['db/setup-turso.mjs'], { cwd: root, env: environment, encoding: 'utf8' });
  if (setup.status !== 0) throw new Error(`Turso setup failed: ${setup.stderr}`);
  Object.assign(process.env, environment);
  const [{ default: xero }, { pool }, { close }] = await Promise.all([
    import('../netlify/functions/xero.mjs'),
    import('../netlify/functions/lib/db.mjs'),
    import('../netlify/functions/lib/turso-db.mjs'),
  ]);
  const denied = await xero(new Request('http://localhost:8891/api/xero/auth/start', { method: 'POST' }));
  expect(denied.status === 401, 'OAuth start must reject requests without the connect secret.');
  const allowed = await xero(new Request('http://localhost:8891/api/xero/auth/start', {
    method: 'POST', headers: { 'x-xero-connect-secret': environment.XERO_CONNECT_SECRET },
  }));
  const body = await allowed.json();
  expect(allowed.status === 200 && body.authorization_url, 'OAuth start did not return an authorization URL.');
  const url = new URL(body.authorization_url);
  expect(url.searchParams.get('scope') === 'accounting.contacts accounting.invoices offline_access', 'OAuth scopes are incorrect.');
  const states = await pool.query('SELECT state_hash FROM xero_oauth_states');
  expect(states.rows.length === 1 && states.rows[0].state_hash !== url.searchParams.get('state'), 'OAuth state must be stored as a hash.');
  await close();
  console.log('Xero OAuth start test passed: guarded initiation, minimum scopes, and hashed state storage.');
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
