// ============================================================================
// XERO ROUTES (Netlify Function)
//
//   GET  /api/xero/status                     connection status (stub or live)
//   POST /api/xero/contacts/sync               { kind: 'customer'|'insurer', id }
//   POST /api/xero/invoices                    { claim_id, quote_id } → draft invoice
//   GET  /api/xero/invoices?claim_id=           list invoices for a claim
//   POST /api/xero/webhook/simulate-paid        { invoice_id }  — STUB MODE ONLY
//
// All routes go through lib/xero-adapter.mjs — nothing here knows or cares
// whether it's talking to the stub or the real Xero API.
// ============================================================================

import { pool } from './lib/db.mjs';
import { getXeroAdapter, xeroMode } from './lib/xero-adapter.mjs';
import {
  connectSecretIsValid,
  createOAuthState,
  encryptXeroToken,
  hashOAuthState,
  requireXeroConfig,
  xeroBasicAuthorization,
} from './lib/xero-security.mjs';

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/xero/, '').replace(/\/$/, '') || '/';
  const method = req.method;
  const xero = getXeroAdapter();

  try {
    // OAuth initiation is deliberately POST-only and guarded by a separate
    // setup secret until staff authentication is added. The secret never
    // appears in a redirect URL, browser history, or Xero request.
    if (method === 'POST' && path === '/auth/start') {
      if (xeroMode !== 'live') return json(409, { error: 'Set XERO_MODE=live before connecting Xero.' });
      if (!connectSecretIsValid(req.headers.get('x-xero-connect-secret'))) {
        return json(401, { error: 'A valid Xero connect secret is required.' });
      }
      requireXeroConfig();
      const state = createOAuthState();
      const redirectUri = process.env.XERO_REDIRECT_URI;
      await pool.query(`DELETE FROM xero_oauth_states WHERE expires_at <= $1`, [new Date().toISOString()]);
      await pool.query(
        `INSERT INTO xero_oauth_states (state_hash, redirect_uri, expires_at)
         VALUES ($1,$2,$3)`,
        [hashOAuthState(state), redirectUri, new Date(Date.now() + 10 * 60_000).toISOString()]
      );
      const scopes = process.env.XERO_SCOPES || 'accounting.contacts accounting.invoices offline_access';
      const authorizeUrl = new URL('https://login.xero.com/identity/connect/authorize');
      authorizeUrl.search = new URLSearchParams({
        response_type: 'code', client_id: process.env.XERO_CLIENT_ID, redirect_uri: redirectUri, scope: scopes, state,
      }).toString();
      return json(200, { authorization_url: authorizeUrl.toString() });
    }

    if (method === 'GET' && path === '/auth/callback') {
      if (xeroMode !== 'live') return json(409, { error: 'Xero OAuth is not enabled.' });
      if (url.searchParams.get('error')) return json(400, { error: 'Xero authorisation was declined or cancelled.' });
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (!code || !state) return json(400, { error: 'Missing OAuth code or state.' });
      const { rows: states } = await pool.query(
        `DELETE FROM xero_oauth_states WHERE state_hash=$1 RETURNING redirect_uri, expires_at`, [hashOAuthState(state)]
      );
      const savedState = states[0];
      if (!savedState || new Date(savedState.expires_at) < new Date()) {
        return json(400, { error: 'This Xero connection request has expired or was already used. Start again.' });
      }
      requireXeroConfig();
      const tokenResponse = await fetch('https://identity.xero.com/connect/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: xeroBasicAuthorization() },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: savedState.redirect_uri }),
      });
      if (!tokenResponse.ok) return json(502, { error: `Xero token exchange failed (${tokenResponse.status}).` });
      const tokens = await tokenResponse.json();
      const connectionsResponse = await fetch('https://api.xero.com/connections', {
        headers: { authorization: `Bearer ${tokens.access_token}`, accept: 'application/json' },
      });
      if (!connectionsResponse.ok) return json(502, { error: `Xero organisation lookup failed (${connectionsResponse.status}).` });
      const connections = await connectionsResponse.json();
      const configuredTenant = process.env.XERO_TENANT_ID;
      const tenant = configuredTenant
        ? connections.find(item => item.tenantId === configuredTenant)
        : connections.length === 1 ? connections[0] : null;
      if (!tenant) {
        return json(409, {
          error: configuredTenant ? 'Configured XERO_TENANT_ID was not authorised.' : 'More than one organisation is available; set XERO_TENANT_ID and start again.',
          available_tenants: connections.map(item => ({ tenant_id: item.tenantId, tenant_name: item.tenantName, tenant_type: item.tenantType })),
        });
      }
      await pool.query(
        `INSERT INTO xero_connections (tenant_id, tenant_name, access_token, refresh_token, expires_at, scopes)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (tenant_id) DO UPDATE SET tenant_name=excluded.tenant_name,
           access_token=excluded.access_token, refresh_token=excluded.refresh_token,
           expires_at=excluded.expires_at, scopes=excluded.scopes, updated_at=CURRENT_TIMESTAMP`,
        [tenant.tenantId, tenant.tenantName || null, encryptXeroToken(tokens.access_token),
         encryptXeroToken(tokens.refresh_token), new Date(Date.now() + Number(tokens.expires_in || 1800) * 1000).toISOString(),
         tokens.scope || process.env.XERO_SCOPES || 'accounting.contacts accounting.invoices offline_access']
      );
      return json(200, { connected: true, tenant_id: tenant.tenantId, tenant_name: tenant.tenantName || null });
    }

    if (method === 'GET' && path === '/status') {
      return json(200, await xero.getConnectionStatus(pool));
    }

    if (method === 'POST' && path === '/contacts/sync') {
      const b = await req.json();
      if (!['customer', 'insurer'].includes(b.kind) || !b.id) {
        return json(400, { error: "Body must include kind ('customer'|'insurer') and id" });
      }
      const xeroContactId = await xero.syncContact(pool, { kind: b.kind, id: b.id });
      return json(200, { xero_contact_id: xeroContactId });
    }

    if (method === 'POST' && path === '/invoices') {
      const b = await req.json();
      if (!b.claim_id || !b.quote_id) {
        return json(400, { error: 'Body must include claim_id and quote_id' });
      }
      const existingBefore = await pool.query(
        `SELECT id FROM invoices WHERE claim_id=$1 AND quote_id=$2`, [b.claim_id, b.quote_id]
      );
      const invoice = await xero.createDraftInvoice(pool, { claimId: b.claim_id, quoteId: b.quote_id });
      if (!existingBefore.rows.length) {
        await pool.query(
          `INSERT INTO activity_log (entity, entity_id, action, detail)
           VALUES ('invoice', $1, 'created_draft', $2)`,
          [invoice.id, JSON.stringify({ mode: xeroMode, xero_invoice_id: invoice.xero_invoice_id })]
        );
      }
      return json(existingBefore.rows.length ? 200 : 201, invoice);
    }

    if (method === 'GET' && path === '/invoices') {
      const claimId = url.searchParams.get('claim_id');
      const { rows } = await pool.query(
        `SELECT * FROM invoices WHERE ($1 IS NULL OR claim_id=$1) ORDER BY created_at DESC`,
        [claimId]
      );
      return json(200, rows);
    }

    if (method === 'POST' && path === '/webhook/simulate-paid') {
      if (xeroMode !== 'stub') {
        return json(400, { error: 'Simulated webhooks are only available in stub mode (XERO_MODE=stub). Real payment updates arrive via the actual Xero webhook subscription.' });
      }
      const b = await req.json();
      if (!b.invoice_id) return json(400, { error: 'Body must include invoice_id' });
      const invoice = await xero.simulateWebhookPaid(pool, { invoiceId: b.invoice_id });
      if (invoice.claim_id) {
        await pool.query(
          `UPDATE claims SET status='paid' WHERE id=$1 AND status NOT IN ('paid','closed')`,
          [invoice.claim_id]
        );
      }
      return json(200, invoice);
    }

    return json(404, { error: `No route: ${method} ${path}` });
  } catch (err) {
    console.error(err);
    return json(500, { error: err.message });
  }
};

export const config = { path: ['/api/xero/*'] };
