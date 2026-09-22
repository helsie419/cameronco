// ============================================================================
// STOCK / INVENTORY API (Netlify Function)
//
// Loose stones, raw metal, ring mounts/configurations, and finished pre-made
// pieces. Lets an assessor check, while quoting, whether a matching item is
// already on hand or needs to be ordered. Category-specific matching fields
// (stone type/shape/carat/quality, metal type/colour, mount category/style)
// live in `attributes` JSONB, using the same lookup codes already used on
// claim_items/item_stones, so a quote's in-progress fields can be matched
// straight against stock without any translation layer.
//
// Deliberately does NOT auto-deduct when used on a quote — a quote is a
// proposal, not a commitment. Quantity only changes via a deliberate edit.
//
//   GET    /api/stock?category=&q=&needs_order=1     list/search stock
//   GET    /api/stock/match?category=&...attrs        find matching stock for a quote in progress
//   POST   /api/stock                                  create a stock item
//   PUT    /api/stock/:id                               edit / adjust quantity / deactivate
// ============================================================================

import { pool } from './lib/db.mjs';

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

// Attribute keys that participate in a /match lookup, per category. Kept as
// an allow-list so an arbitrary query string can't be used to probe columns
// outside `attributes`, and so carat gets its tolerance-range treatment
// instead of a brittle exact match.
const MATCH_KEYS = {
  stone: ['stone_type', 'shape', 'quality'],
  metal: ['metal_type', 'metal_colour'],
  mount: ['item_category', 'ring_style', 'metal_type', 'metal_colour'],
  finished: ['item_category', 'item_type'],
};

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/stock/, '').replace(/\/$/, '') || '/';
  const method = req.method;
  let m;

  try {
    if (method === 'GET' && path === '/match') {
      const category = url.searchParams.get('category');
      if (!MATCH_KEYS[category]) return json(400, { error: `Unknown category: ${category}` });

      const clauses = ['category = $1', 'active', 'quantity > 0'];
      const values = [category];
      for (const key of MATCH_KEYS[category]) {
        const v = url.searchParams.get(key);
        if (v) {
          values.push(v);
          clauses.push(`attributes->>'${key}' = $${values.length}`);
        }
      }
      const carat = parseFloat(url.searchParams.get('carat'));
      if (category === 'stone' && Number.isFinite(carat) && carat > 0) {
        // loose stones are never an exact carat match — treat anything
        // within +/-15% (min +/-0.03ct) as the same stone for this purpose
        const tolerance = Math.max(carat * 0.15, 0.03);
        values.push(carat - tolerance, carat + tolerance);
        clauses.push(`CAST(json_extract(attributes, '$.carat') AS REAL) BETWEEN $${values.length - 1} AND $${values.length}`);
      }

      const { rows } = await pool.query(
        `SELECT id, description, sku, quantity, unit, reorder_threshold, attributes
         FROM stock_items WHERE ${clauses.join(' AND ')}
         ORDER BY quantity DESC LIMIT 20`,
        values
      );
      return json(200, rows);
    }

    if (method === 'GET' && path === '/') {
      const category = url.searchParams.get('category');
      const q = (url.searchParams.get('q') || '').trim();
      const needsOrder = url.searchParams.get('needs_order') === '1';
      const clauses = ['active'];
      const values = [];
      if (category) { values.push(category); clauses.push(`category = $${values.length}`); }
      if (q) {
        values.push(`%${q}%`);
        clauses.push(`(LOWER(description) LIKE LOWER($${values.length}) OR LOWER(sku) LIKE LOWER($${values.length}) OR LOWER(supplier) LIKE LOWER($${values.length}))`);
      }
      if (needsOrder) clauses.push('quantity <= reorder_threshold');

      const { rows } = await pool.query(
        `SELECT * FROM stock_items WHERE ${clauses.join(' AND ')}
         ORDER BY category, description LIMIT 500`,
        values
      );
      return json(200, rows);
    }

    if (method === 'POST' && path === '/') {
      const b = await req.json();
      if (!b.category) return json(400, { error: 'category is required' });
      if (!b.description?.trim()) return json(400, { error: 'description is required' });

      const { rows } = await pool.query(
         `INSERT INTO stock_items (category, description, sku, quantity, unit,
           reorder_threshold, supplier, cost, suggested_rrp, attributes, notes, branch)
         VALUES ($1,$2,$3,COALESCE($4,0),COALESCE($5,'pc'),COALESCE($6,0),$7,$8,$9,
           COALESCE($10,'{}'),$11,COALESCE($12,'melbourne'))
         RETURNING *`,
        [b.category, b.description.trim(), b.sku || null, b.quantity, b.unit,
         b.reorder_threshold, b.supplier || null, b.cost || null, b.suggested_rrp || null,
         b.attributes ? JSON.stringify(b.attributes) : null, b.notes || null, b.branch || null]
      );
      return json(201, rows[0]);
    }

    if (method === 'PUT' && (m = path.match(/^\/(\d+)$/))) {
      const b = await req.json();
      const { rows } = await pool.query(
        `UPDATE stock_items SET
           description       = COALESCE($2, description),
           sku               = COALESCE($3, sku),
           quantity          = COALESCE($4, quantity),
           unit              = COALESCE($5, unit),
           reorder_threshold = COALESCE($6, reorder_threshold),
           supplier          = COALESCE($7, supplier),
           cost              = COALESCE($8, cost),
           suggested_rrp     = COALESCE($9, suggested_rrp),
           attributes        = COALESCE($10, attributes),
           notes             = COALESCE($11, notes),
           branch            = COALESCE($12, branch),
           active            = COALESCE($13, active)
         WHERE id = $1
         RETURNING *`,
        [m[1], b.description ?? null, b.sku, b.quantity ?? null, b.unit || null,
         b.reorder_threshold ?? null, b.supplier, b.cost ?? null, b.suggested_rrp ?? null,
         b.attributes ? JSON.stringify(b.attributes) : null, b.notes, b.branch || null,
         typeof b.active === 'boolean' ? b.active : null]
      );
      if (!rows.length) return json(404, { error: 'Stock item not found' });
      return json(200, rows[0]);
    }

    return json(404, { error: `No route: ${method} ${path}` });
  } catch (err) {
    console.error(err);
    return json(500, { error: err.message });
  }
};

export const config = {
  path: ['/api/stock', '/api/stock/*'],
};
