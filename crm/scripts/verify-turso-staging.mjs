#!/usr/bin/env node
import 'dotenv/config';

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required.');
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(handler, pathname) {
  const response = await handler(new Request(`https://crm.test${pathname}`));
  const payload = await response.json();
  expect(response.ok, `GET ${pathname} failed (${response.status}): ${JSON.stringify(payload)}`);
  return payload;
}

const [{ default: api }, { default: jobs }, { default: stock }, { default: xero }, { close }] = await Promise.all([
  import('../netlify/functions/api.mjs'),
  import('../netlify/functions/jobs.mjs'),
  import('../netlify/functions/stock.mjs'),
  import('../netlify/functions/xero.mjs'),
  import('../netlify/functions/lib/turso-db.mjs'),
]);

try {
  const [lookups, rates, insurers, staff, claims, jobRows, stockRows, xeroStatus] = await Promise.all([
    request(api, '/api/lookups'), request(api, '/api/rates'), request(api, '/api/insurers'),
    request(api, '/api/staff'), request(api, '/api/claims'), request(jobs, '/api/jobs'),
    request(stock, '/api/stock'), request(xero, '/api/xero/status'),
  ]);
  expect(Object.keys(lookups).length > 0, 'Lookup data is empty.');
  expect(rates.rates.length > 0, 'Rate cards are empty.');
  expect(insurers.length > 0 && staff.length > 0, 'Reference records are unavailable.');
  // The pipeline intentionally excludes paid, closed, and declined claims;
  // the table-level import count is verified separately with Turso SQL.
  expect(claims.length === 7, `Expected 7 open-pipeline claims, received ${claims.length}.`);
  expect(jobRows.length === 3, `Expected 3 imported jobs, received ${jobRows.length}.`);
  expect(stockRows.length === 11, `Expected 11 imported stock records, received ${stockRows.length}.`);
  expect(xeroStatus.mode === 'stub', 'Xero must remain in stub mode during staging verification.');
  console.log('Turso staging verification passed: imported CRM, jobs, stock, rate, lookup, and Xero-stub reads succeeded.');
} finally {
  await close();
}
