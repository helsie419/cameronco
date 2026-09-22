// ============================================================================
// XERO ADAPTER — one interface, two implementations.
//
// Every other part of the system (the API routes, the quote screen) talks to
// this interface only:
//    syncContact(pool, { kind: 'customer'|'insurer', id })
//    createDraftInvoice(pool, { claimId, quoteId })
//    getConnectionStatus(pool)
//
// XERO_MODE=stub (default) — no real Xero account needed. Generates
//   deterministic fake IDs, writes them into the same xero_contact_id /
//   xero_invoice_id columns the real integration will use, and logs clearly
//   so nobody mistakes stub output for a real Xero record.
//
// XERO_MODE=live — real OAuth2 + Accounting API calls. Needs XERO_CLIENT_ID /
//   XERO_CLIENT_SECRET (Netlify env vars) and a completed OAuth connection
//   (see xero-auth.mjs) stored in xero_connections.
//
// Switching modes is one environment variable — nothing else in the codebase
// changes when real credentials are ready.
// ============================================================================

import { decryptXeroConnection, encryptXeroToken, xeroBasicAuthorization } from './xero-security.mjs';

const MODE = (process.env.XERO_MODE || 'stub').toLowerCase();

// ---------------------------------------------------------------- utilities
const stubId = (prefix) =>
  `STUB-${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function log(...args) {
  console.log(`[xero:${MODE}]`, ...args);
}

// ============================================================================
// STUB IMPLEMENTATION — safe to run with no Xero account at all.
// ============================================================================
const stubAdapter = {
  async getConnectionStatus() {
    return {
      mode: 'stub',
      connected: true,
      tenant_name: 'Stub Company (no real Xero account connected)',
      note: 'Running against a local stub — no data leaves this system. Set XERO_MODE=live and connect a real organisation to go live.',
    };
  },

  async syncContact(pool, { kind, id }) {
    const table = kind === 'insurer' ? 'insurers' : 'customers';
    const { rows } = await pool.query(`SELECT id, xero_contact_id FROM ${table} WHERE id=$1`, [id]);
    if (!rows.length) throw new Error(`${kind} ${id} not found`);
    if (rows[0].xero_contact_id) {
      log('contact already synced', kind, id, rows[0].xero_contact_id);
      return rows[0].xero_contact_id;
    }
    const contactId = stubId('CONTACT');
    await pool.query(`UPDATE ${table} SET xero_contact_id=$2 WHERE id=$1`, [id, contactId]);
    log('created stub contact', kind, id, '→', contactId);
    return contactId;
  },

  async createDraftInvoice(pool, { claimId, quoteId }) {
    const existing = await pool.query(
      `SELECT * FROM invoices WHERE claim_id=$1 AND quote_id=$2`, [claimId, quoteId]);
    if (existing.rows.length) return existing.rows[0];

    const claim = await pool.query(
      `SELECT c.*, cu.id AS customer_id, cu.xero_contact_id AS customer_xero_id,
              i.id AS insurer_id, i.xero_contact_id AS insurer_xero_id
       FROM claims c
       JOIN customers cu ON cu.id = c.customer_id
       LEFT JOIN insurers i ON i.id = c.insurer_id
       WHERE c.id = $1`, [claimId]
    );
    if (!claim.rows.length) throw new Error(`Claim ${claimId} not found`);
    const c = claim.rows[0];

    const quote = await pool.query(`SELECT * FROM quotes WHERE id=$1`, [quoteId]);
    if (!quote.rows.length) throw new Error(`Quote ${quoteId} not found`);
    const q = quote.rows[0];

    // bill the insurer if one exists on the claim, otherwise the customer
    const billToInsurer = !!c.insurer_id;
    const contactKind = billToInsurer ? 'insurer' : 'customer';
    const contactRowId = billToInsurer ? c.insurer_id : c.customer_id;
    let xeroContactId = billToInsurer ? c.insurer_xero_id : c.customer_xero_id;
    if (!xeroContactId) {
      xeroContactId = await stubAdapter.syncContact(pool, { kind: contactKind, id: contactRowId });
    }

    // The amount invoiced depends on WHO is being billed, not a blind
    // "prefer nett" fallback — nett is specifically an insurer concept.
    // A private customer with no insurer on the claim was never quoted a
    // nett figure at all, so billing them nett (often 0, since it's not
    // applicable) would silently invoice for the wrong amount.
    const billAmount = Number(billToInsurer ? q.total_nett : q.total_retail) || 0;
    const gst = Math.round((billAmount / 11) * 100) / 100; // prices are GST-inclusive
    const total = billAmount;
    const xeroInvoiceId = stubId('INV');
    const invoiceNumber = `CC-${claimId}-${q.version}`;

    const { rows } = await pool.query(
      `INSERT INTO invoices (claim_id, quote_id, invoice_number, xero_invoice_id,
         bill_to, subtotal, gst, total, status, issued_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft_in_xero', CURRENT_TIMESTAMP)
       RETURNING *`,
      [claimId, quoteId, invoiceNumber, xeroInvoiceId,
       billToInsurer ? 'insurer' : 'customer', billAmount - gst, gst, total]
    );
    log('created stub draft invoice', invoiceNumber, '→', xeroInvoiceId, `$${total}`);
    return { ...rows[0], xero_contact_id: xeroContactId };
  },

  // Simulates what Xero's payment webhook would send, so the update path
  // (invoices.status → 'paid', paid_at) can be tested without a real account.
  async simulateWebhookPaid(pool, { invoiceId }) {
    const { rows } = await pool.query(
      `UPDATE invoices SET status='paid', paid_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`,
      [invoiceId]
    );
    if (!rows.length) throw new Error(`Invoice ${invoiceId} not found`);
    log('simulated payment webhook for invoice', invoiceId);
    return rows[0];
  },
};

// ============================================================================
// LIVE IMPLEMENTATION — real Xero Accounting API. Not exercised until
// XERO_CLIENT_ID/SECRET exist and an OAuth connection has been completed via
// xero-auth.mjs. Written against Xero's documented endpoints so it's ready
// to test the moment credentials are available — swap XERO_MODE and go.
// ============================================================================
const liveAdapter = {
  async _getToken(pool) {
    const { rows } = await pool.query(
      `SELECT * FROM xero_connections ORDER BY connected_at DESC LIMIT 1`
    );
    if (!rows.length) throw new Error('No Xero organisation connected yet — complete the OAuth flow first.');
    let conn = decryptXeroConnection(rows[0]);
    if (new Date(conn.expires_at) <= new Date(Date.now() + 60_000)) {
      conn = await liveAdapter._refreshToken(pool, conn);
    }
    return conn;
  },

  async _refreshToken(pool, conn) {
    const res = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: xeroBasicAuthorization(),
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: conn.refresh_token }),
    });
    if (!res.ok) throw new Error(`Xero token refresh failed: ${res.status}`);
    const tok = await res.json();
    const { rows } = await pool.query(
      `UPDATE xero_connections SET access_token=$2, refresh_token=$3,
         expires_at = datetime('now', '+' || $4 || ' seconds')
       WHERE id=$1 RETURNING *`,
      [conn.id, encryptXeroToken(tok.access_token), encryptXeroToken(tok.refresh_token), tok.expires_in]
    );
    return decryptXeroConnection(rows[0]);
  },

  async _call(pool, method, path, body) {
    const conn = await liveAdapter._getToken(pool);
    const res = await fetch(`https://api.xero.com/api.xro/2.0${path}`, {
      method,
      headers: {
        authorization: `Bearer ${conn.access_token}`,
        'xero-tenant-id': conn.tenant_id,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Xero API ${method} ${path} → ${res.status}: ${await res.text()}`);
    return res.json();
  },

  async getConnectionStatus(pool) {
    const { rows } = await pool.query(
      `SELECT tenant_name, connected_at, expires_at FROM xero_connections
       ORDER BY connected_at DESC LIMIT 1`
    );
    if (!rows.length) return { mode: 'live', connected: false };
    return { mode: 'live', connected: true, ...rows[0] };
  },

  async syncContact(pool, { kind, id }) {
    const table = kind === 'insurer' ? 'insurers' : 'customers';
    const { rows } = await pool.query(`SELECT * FROM ${table} WHERE id=$1`, [id]);
    if (!rows.length) throw new Error(`${kind} ${id} not found`);
    const row = rows[0];
    if (row.xero_contact_id) return row.xero_contact_id;

    const name = kind === 'insurer' ? row.name : `${row.first_name} ${row.last_name}`.trim();
    const result = await liveAdapter._call(pool, 'POST', '/Contacts', {
      Contacts: [{ Name: name, EmailAddress: row.email || row.claims_email || undefined }],
    });
    const xeroContactId = result.Contacts?.[0]?.ContactID;
    await pool.query(`UPDATE ${table} SET xero_contact_id=$2 WHERE id=$1`, [id, xeroContactId]);
    return xeroContactId;
  },

  async createDraftInvoice(pool, { claimId, quoteId }) {
    const existing = await pool.query(
      `SELECT * FROM invoices WHERE claim_id=$1 AND quote_id=$2`, [claimId, quoteId]);
    if (existing.rows.length) return existing.rows[0];

    const claim = await pool.query(
      `SELECT c.*, cu.id AS customer_id, i.id AS insurer_id
       FROM claims c JOIN customers cu ON cu.id=c.customer_id
       LEFT JOIN insurers i ON i.id=c.insurer_id WHERE c.id=$1`, [claimId]);
    if (!claim.rows.length) throw new Error(`Claim ${claimId} not found`);
    const c = claim.rows[0];
    const quote = await pool.query(`SELECT * FROM quotes WHERE id=$1`, [quoteId]);
    if (!quote.rows.length) throw new Error(`Quote ${quoteId} not found`);
    const q = quote.rows[0];

    const billToInsurer = !!c.insurer_id;
    const xeroContactId = await liveAdapter.syncContact(pool, {
      kind: billToInsurer ? 'insurer' : 'customer',
      id: billToInsurer ? c.insurer_id : c.customer_id,
    });

    // Same fix as the stub adapter: bill amount depends on who's being
    // billed, not a blind nett-then-retail fallback (nett doesn't apply to
    // customers with no insurer on the claim).
    const total = Number(billToInsurer ? q.total_nett : q.total_retail) || 0;
    const invoiceNumber = `CC-${claimId}-${q.version}`;
    const result = await liveAdapter._call(pool, 'POST', '/Invoices', {
      Invoices: [{
        Type: 'ACCREC',
        Contact: { ContactID: xeroContactId },
        LineAmountTypes: 'Inclusive',
        InvoiceNumber: invoiceNumber,
        Status: 'DRAFT',
        LineItems: [{
          Description: `Insurance replacement — claim ${c.claim_number}`,
          Quantity: 1,
          UnitAmount: total,
          AccountCode: process.env.XERO_SALES_ACCOUNT_CODE || '200',
        }],
        // Tracking category for branch reporting — created once during setup;
        // ID supplied via env var once known.
        ...(process.env.XERO_BRANCH_TRACKING_CATEGORY_ID && {
          LineItems: [{
            Description: `Insurance replacement — claim ${c.claim_number}`,
            Quantity: 1,
            UnitAmount: total,
            AccountCode: process.env.XERO_SALES_ACCOUNT_CODE || '200',
            Tracking: [{
              TrackingCategoryID: process.env.XERO_BRANCH_TRACKING_CATEGORY_ID,
              Name: c.branch === 'sydney' ? 'Sydney' : 'Melbourne',
            }],
          }],
        }),
      }],
    });
    const inv = result.Invoices?.[0];
    const { rows } = await pool.query(
      `INSERT INTO invoices (claim_id, quote_id, invoice_number, xero_invoice_id,
         bill_to, subtotal, gst, total, status, issued_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft_in_xero', CURRENT_TIMESTAMP) RETURNING *`,
      [claimId, quoteId, invoiceNumber, inv?.InvoiceID,
       billToInsurer ? 'insurer' : 'customer',
       inv?.SubTotal ?? total, inv?.TotalTax ?? 0, inv?.Total ?? total]
    );
    return rows[0];
  },
};

export function getXeroAdapter() {
  return MODE === 'live' ? liveAdapter : stubAdapter;
}

export const xeroMode = MODE;
