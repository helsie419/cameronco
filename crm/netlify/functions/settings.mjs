// ============================================================================
// APP SETTINGS API (Netlify Function)
//
// Small key/value config store (app_settings). First and only use so far:
// the format + running counter for the auto-generated internal ("our ref")
// claim reference number, editable from Settings.
//
//   GET  /api/settings/reference-format        current format config
//   PUT  /api/settings/reference-format        update prefix / digits / reset_yearly
//   POST /api/settings/reference-format/next    atomically issue the next reference number
// ============================================================================

import { pool } from './lib/db.mjs';

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

const KEY = 'reference_number_format';
const DEFAULT_FORMAT = { prefix: 'CC', digits: 4, reset_yearly: true, year: null, next_seq: 1 };

function parseValue(row) {
  if (!row) return { ...DEFAULT_FORMAT };
  return typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
}

function formatReference(cfg) {
  const seq = String(cfg.next_seq).padStart(cfg.digits || 4, '0');
  return cfg.reset_yearly && cfg.year
    ? `${cfg.prefix}-${cfg.year}-${seq}`
    : `${cfg.prefix}-${seq}`;
}

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/settings/, '').replace(/\/$/, '') || '/';
  const method = req.method;

  try {
    if (method === 'GET' && path === '/reference-format') {
      const { rows } = await pool.query(`SELECT value FROM app_settings WHERE key = $1`, [KEY]);
      return json(200, parseValue(rows[0]));
    }

    if (method === 'PUT' && path === '/reference-format') {
      const b = await req.json();
      const { rows } = await pool.query(`SELECT value FROM app_settings WHERE key = $1`, [KEY]);
      const current = parseValue(rows[0]);
      const updated = {
        ...current,
        prefix: (b.prefix ?? current.prefix ?? 'CC').toString().trim().toUpperCase() || 'CC',
        digits: Number(b.digits) > 0 ? Number(b.digits) : (current.digits || 4),
        reset_yearly: typeof b.reset_yearly === 'boolean' ? b.reset_yearly : !!current.reset_yearly,
        next_seq: Number(b.next_seq) > 0 ? Number(b.next_seq) : (current.next_seq || 1),
      };
      // Anchor `year` now so the next /next call doesn't treat this as a
      // year rollover and reset the starting number straight back to 1.
      updated.year = updated.reset_yearly ? (current.year || new Date().getFullYear()) : null;
      await pool.query(
        `UPDATE app_settings SET value = $2, updated_at = $3 WHERE key = $1`,
        [KEY, JSON.stringify(updated), new Date().toISOString()]
      );
      return json(200, updated);
    }

    if (method === 'POST' && path === '/reference-format/next') {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query(
          `SELECT value FROM app_settings WHERE key = $1`, [KEY]
        );
        const cfg = parseValue(rows[0]);
        const thisYear = new Date().getFullYear();
        if (cfg.reset_yearly && cfg.year !== thisYear) {
          cfg.year = thisYear;
          cfg.next_seq = 1;
        } else if (!cfg.reset_yearly) {
          cfg.year = null;
        }
        const reference = formatReference(cfg);
        cfg.next_seq += 1;
        await client.query(
          `UPDATE app_settings SET value = $2, updated_at = $3 WHERE key = $1`,
          [KEY, JSON.stringify(cfg), new Date().toISOString()]
        );
        await client.query('COMMIT');
        return json(200, { reference });
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        await client.release();
      }
    }

    return json(404, { error: `No route: ${method} ${path}` });
  } catch (err) {
    console.error(err);
    return json(500, { error: err.message });
  }
};

export const config = { path: ['/api/settings/*'] };
