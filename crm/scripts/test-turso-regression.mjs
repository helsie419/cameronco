#!/usr/bin/env node
import { mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempDir = await mkdtemp(path.join(os.tmpdir(), 'cameronco-turso-'));
const databaseUrl = `file:${path.join(tempDir, 'crm.db')}`;
const environment = {
  ...process.env,
  TURSO_DATABASE_URL: databaseUrl,
  TURSO_AUTH_TOKEN: 'local-regression-test',
  XERO_MODE: 'stub',
  EMAIL_SEND_MODE: 'stub',
};

function fail(message) { throw new Error(message); }

function expect(condition, message) {
  if (!condition) fail(message);
}

async function request(handler, pathname, { method = 'GET', body } = {}) {
  const response = await handler(new Request(`https://crm.test${pathname}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }));
  const payload = response.headers.get('content-type')?.includes('application/json')
    ? await response.json()
    : await response.text();
  expect(response.ok, `${method} ${pathname} failed (${response.status}): ${JSON.stringify(payload)}`);
  return payload;
}

try {
  const setup = spawnSync(process.execPath, ['db/setup-turso.mjs'], {
    cwd: root,
    env: environment,
    encoding: 'utf8',
  });
  if (setup.status !== 0) fail(`Turso setup failed:\n${setup.stdout}\n${setup.stderr}`);

  Object.assign(process.env, environment);
  const [{ default: api }, { default: jobs }, { default: stock }, { default: xero }, { close }] = await Promise.all([
    import('../netlify/functions/api.mjs'),
    import('../netlify/functions/jobs.mjs'),
    import('../netlify/functions/stock.mjs'),
    import('../netlify/functions/xero.mjs'),
    import('../netlify/functions/lib/turso-db.mjs'),
  ]);

  const insurers = await request(api, '/api/insurers');
  expect(insurers.length > 0, 'Seeded insurers were not returned.');
  const staff = await request(api, '/api/staff');
  const admin = staff.find(person => person.role === 'admin');
  expect(admin, 'Seeded admin staff member was not returned.');

  const customer = await request(api, '/api/customers', {
    method: 'POST',
    body: { first_name: 'Turso', last_name: 'Regression', email: 'turso.regression@example.test' },
  });
  const claim = await request(api, '/api/claims', {
    method: 'POST',
    body: {
      claim_number: 'TURSO-REGRESSION-001',
      customer_id: customer.id,
      insurer_id: insurers[0].id,
      assigned_to: admin.id,
      items: [{ item_no: 1, category: 'rings', item_type: 'engagement_ring', description: 'Regression test ring', metal_type: '18ct', weight_gms: 4.2 }],
    },
  });
  const claimDetail = await request(api, `/api/claims/${claim.id}`);
  expect(claimDetail.items.length === 1, 'Nested claim item was not persisted.');

  const quote = await request(api, `/api/claims/${claim.id}/quotes`, {
    method: 'POST', body: { total_retail: 1000, total_nett: 800, total_liability: 1000, created_by: admin.id },
  });
  await request(api, `/api/quotes/${quote.id}/review`, { method: 'POST', body: { staff_id: admin.id } });
  const email = await request(api, `/api/quotes/${quote.id}/send`, { method: 'POST' });
  expect(email.sent && email.mode === 'stub', 'Quote email route failed in stub mode.');
  const approval = await request(api, `/api/quotes/${quote.id}/status`, { method: 'PUT', body: { status: 'approved' } });
  expect(approval.job_id && approval.job_number === 'JOB-TURSO-REGRESSION-001', `Customer approval did not create a Job Board job: ${JSON.stringify(approval)}`);

  const job = await request(jobs, `/api/jobs/${approval.job_id}`);
  expect(job.components.length === 1, 'Job components were not created from claim items.');
  await request(jobs, `/api/jobs/${job.id}`, { method: 'PUT', body: { stage: 'in_production' } });

  const pdfResponse = await api(new Request(`https://crm.test/api/quotes/${quote.id}/pdf`));
  expect(pdfResponse.ok && pdfResponse.headers.get('content-type') === 'application/pdf', 'Quote PDF route failed.');
  expect((await pdfResponse.arrayBuffer()).byteLength > 1000, 'Quote PDF was empty.');

  const stockItem = await request(stock, '/api/stock', {
    method: 'POST',
    body: { category: 'stone', description: 'Regression diamond', quantity: 1, attributes: { stone_type: 'diamond', shape: 'rbc', quality: 'g_vs', carat: 0.5 } },
  });
  expect(stockItem.id, 'Stock item was not created.');
  const stockMatches = await request(stock, '/api/stock/match?category=stone&stone_type=diamond&shape=rbc&quality=g_vs&carat=0.5');
  expect(stockMatches.some(item => item.id === stockItem.id), 'Stock JSON matching did not return the created item.');

  const invoice = await request(xero, '/api/xero/invoices', { method: 'POST', body: { claim_id: claim.id, quote_id: quote.id } });
  await request(xero, '/api/xero/webhook/simulate-paid', { method: 'POST', body: { invoice_id: invoice.id } });
  const paidClaim = await request(api, `/api/claims/${claim.id}`);
  expect(paidClaim.status === 'paid', 'Stub Xero payment did not update the claim status.');

  await close();
  console.log('Turso regression passed: schema, seed, CRM, jobs, stock, and Xero stub flows.');
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
