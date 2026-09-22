// ============================================================================
// RATE CARD ADMIN API (Netlify Function)
//
// Lets staff configure pricing without touching SQL. Every "edit" actually
// creates a new version and closes off the old one (effective_to = today) —
// nothing is overwritten, so historic quotes' rates_snapshot never changes
// meaning even if a rate is corrected tomorrow.
//
//   GET    /api/rate-admin/rates                    current rate cards (grouped)
//   GET    /api/rate-admin/rates/history?code=X      full version history for one code
//   POST   /api/rate-admin/rates                     create a new rate (new code or new version of existing)
//   DELETE /api/rate-admin/rates/:id                  retire a rate (sets effective_to = today, no new version)
//
//   GET    /api/rate-admin/watch-rates               current watch brand rates (optionally ?insurer_id=)
//   POST   /api/rate-admin/watch-rates               create/version a watch brand rate
//   DELETE /api/rate-admin/watch-rates/:id            retire a watch brand rate
// ============================================================================

import { pool } from './lib/db.mjs';

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/rate-admin/, '').replace(/\/$/, '') || '/';
  const method = req.method;

  try {
    // ------------------------------------------------------------- rate_cards
    if (method === 'GET' && path === '/rates') {
      const { rows } = await pool.query(
        `SELECT * FROM rate_cards WHERE effective_to IS NULL ORDER BY category, code`
      );
      return json(200, rows);
    }

    if (method === 'GET' && path === '/rates/history') {
      const code = url.searchParams.get('code');
      if (!code) return json(400, { error: 'code query param required' });
      const { rows } = await pool.query(
        `SELECT * FROM rate_cards WHERE code = $1 ORDER BY effective_from DESC`, [code]
      );
      return json(200, rows);
    }

    if (method === 'POST' && path === '/rates') {
      const b = await req.json();
      if (!b.code || !b.category || b.rate === undefined || b.rate === null) {
        return json(400, { error: 'Body must include code, category, and rate' });
      }
      return await withTx(async (tx) => {
        const effectiveFrom = b.effective_from || new Date().toISOString().slice(0, 10);
        // close off any current version of this exact code
        await tx.query(
          `UPDATE rate_cards SET effective_to = $2
           WHERE code = $1 AND effective_to IS NULL`,
          [b.code, effectiveFrom]
        );
        const { rows } = await tx.query(
          `INSERT INTO rate_cards (code, label, category, metal_type, origin, rate, unit, effective_from)
           VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,'gm'),$8)
           RETURNING *`,
          [b.code, b.label || b.code, b.category, b.metal_type || null,
           b.origin || null, b.rate, b.unit, effectiveFrom]
        );
        await tx.query(
          `INSERT INTO activity_log (entity, entity_id, action, detail)
           VALUES ('rate_card', $1, 'created_version', $2)`,
          [rows[0].id, JSON.stringify({ code: b.code, rate: b.rate })]
        );
        return json(201, rows[0]);
      });
    }

    let m;
    if (method === 'DELETE' && (m = path.match(/^\/rates\/(\d+)$/))) {
      const { rows } = await pool.query(
        `UPDATE rate_cards SET effective_to = CURRENT_DATE
         WHERE id = $1 AND effective_to IS NULL RETURNING *`,
        [m[1]]
      );
      if (!rows.length) return json(404, { error: 'Rate not found or already retired' });
      return json(200, rows[0]);
    }

    // -------------------------------------------------------- watch_brand_rates
    if (method === 'GET' && path === '/watch-rates') {
      const insurerId = url.searchParams.get('insurer_id');
      const { rows } = await pool.query(
        `SELECT w.*, i.name AS insurer_name FROM watch_brand_rates w
         LEFT JOIN insurers i ON i.id = w.insurer_id
         WHERE w.effective_to IS NULL
           AND ($1 IS NULL OR w.insurer_id = $1 OR ($1 = 0 AND w.insurer_id IS NULL))
         ORDER BY w.brand, i.name NULLS FIRST`,
        [insurerId ? Number(insurerId) : null]
      );
      return json(200, rows);
    }

    if (method === 'POST' && path === '/watch-rates') {
      const b = await req.json();
      if (!b.brand || !b.rate_type) {
        return json(400, { error: 'Body must include brand and rate_type' });
      }
      if (b.rate_type === 'discount_pct' && (b.rate_value === undefined || b.rate_value === null)) {
        return json(400, { error: 'rate_value is required when rate_type is discount_pct' });
      }
      return await withTx(async (tx) => {
        const effectiveFrom = b.effective_from || new Date().toISOString().slice(0, 10);
        const insurerId = b.insurer_id || null;
        await tx.query(
          `UPDATE watch_brand_rates SET effective_to = $3
           WHERE brand = $1 AND COALESCE(insurer_id, -1) = COALESCE($2, -1) AND effective_to IS NULL`,
          [b.brand, insurerId, effectiveFrom]
        );
        const { rows } = await tx.query(
          `INSERT INTO watch_brand_rates (brand, insurer_id, rate_type, rate_value, effective_from)
           VALUES ($1,$2,$3,$4,$5) RETURNING *`,
          [b.brand, insurerId, b.rate_type, b.rate_type === 'poa' ? null : b.rate_value, effectiveFrom]
        );
        return json(201, rows[0]);
      });
    }

    if (method === 'DELETE' && (m = path.match(/^\/watch-rates\/(\d+)$/))) {
      const { rows } = await pool.query(
        `UPDATE watch_brand_rates SET effective_to = CURRENT_DATE
         WHERE id = $1 AND effective_to IS NULL RETURNING *`,
        [m[1]]
      );
      if (!rows.length) return json(404, { error: 'Rate not found or already retired' });
      return json(200, rows[0]);
    }

    return json(404, { error: `No route: ${method} ${path}` });
  } catch (err) {
    console.error(err);
    return json(500, { error: err.message });
  }
};

async function withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await fn(client);
    await client.query('COMMIT');
    return res;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export const config = { path: ['/api/rate-admin/*'] };
