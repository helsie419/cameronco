// ============================================================================
// JOB BOARD API (Netlify Function)
//
//   GET    /api/jobs                        all jobs, joined with claim/customer/insurer/margin
//   GET    /api/jobs/eligible-claims         approved claims that don't have a job yet
//   GET    /api/jobs/:id                     one job + its components + the source claim items
//   POST   /api/jobs                         create a job from an approved claim (auto-populates
//                                             one component per claim item as a starting point)
//   PUT    /api/jobs/:id                     update stage / dates / owner / items_taken (partial)
//   POST   /api/jobs/:id/components          add a component line
//   PUT    /api/jobs/components/:id          edit a component line (partial)
//   DELETE /api/jobs/components/:id          remove a component line
// ============================================================================

import { pool } from './lib/db.mjs';

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

const nz = (v) => (v === '' || v === undefined || v === null || Number.isNaN(Number(v)) ? null : Number(v));

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/jobs/, '').replace(/\/$/, '') || '/';
  const method = req.method;

  try {
    // ------------------------------------------------------------- job list
    if (method === 'GET' && path === '/') {
      const { rows } = await pool.query(`
        SELECT j.*, c.claim_number, c.branch,
               cu.first_name || ' ' || cu.last_name AS customer,
               i.name AS insurer, s.full_name AS owner_name,
               q.total_nett AS quoted_nett, q.total_retail AS quoted_retail,
               COALESCE((SELECT SUM(actual_cost) FROM job_components WHERE job_id = j.id), 0) AS actual_cost
        FROM jobs j
        JOIN claims c ON c.id = j.claim_id
        JOIN customers cu ON cu.id = c.customer_id
        LEFT JOIN insurers i ON i.id = c.insurer_id
        LEFT JOIN staff s ON s.id = j.owner_id
        LEFT JOIN quotes q ON q.id = j.quote_id
        ORDER BY
          CASE j.stage
            WHEN 'awaiting_deposit' THEN 1 WHEN 'cad_approval' THEN 2
            WHEN 'in_production' THEN 3 WHEN 'quality_check' THEN 4
            WHEN 'ready_for_collection' THEN 5 WHEN 'completed' THEN 6
            ELSE 7
          END,
          j.due_date NULLS LAST, j.id
      `);
      return json(200, rows);
    }

    // ------------------------------------------------- claims ready for a job
    if (method === 'GET' && path === '/eligible-claims') {
      const { rows } = await pool.query(`
        SELECT c.id AS claim_id, c.claim_number, c.branch,
               cu.first_name || ' ' || cu.last_name AS customer,
               i.name AS insurer, q.id AS quote_id, q.total_nett, q.total_retail
        FROM claims c
        JOIN customers cu ON cu.id = c.customer_id
        LEFT JOIN insurers i ON i.id = c.insurer_id
        LEFT JOIN quotes q ON q.id = (
          SELECT q2.id FROM quotes q2
          WHERE q2.claim_id = c.id AND q2.status = 'approved'
          ORDER BY q2.version DESC LIMIT 1
        )
        WHERE c.status = 'approved'
          AND NOT EXISTS (SELECT 1 FROM jobs WHERE jobs.claim_id = c.id)
        ORDER BY c.date_received
      `);
      return json(200, rows);
    }

    let m;
    // ------------------------------------------------------------ job detail
    if (method === 'GET' && (m = path.match(/^\/(\d+)$/))) {
      const id = m[1];
      const job = await pool.query(`
        SELECT j.*, c.claim_number, c.branch,
               cu.first_name || ' ' || cu.last_name AS customer,
               i.name AS insurer, s.full_name AS owner_name,
               q.total_nett AS quoted_nett, q.total_retail AS quoted_retail
        FROM jobs j
        JOIN claims c ON c.id = j.claim_id
        JOIN customers cu ON cu.id = c.customer_id
        LEFT JOIN insurers i ON i.id = c.insurer_id
        LEFT JOIN staff s ON s.id = j.owner_id
        LEFT JOIN quotes q ON q.id = j.quote_id
        WHERE j.id = $1
      `, [id]);
      if (!job.rows.length) return json(404, { error: 'Job not found' });

      const components = await pool.query(
        `SELECT * FROM job_components WHERE job_id = $1 ORDER BY id`, [id]
      );
      const claimItems = await pool.query(
        `SELECT id, item_no, description, category, metal_colour, weight_gms
         FROM claim_items WHERE claim_id = $1 ORDER BY item_no`, [job.rows[0].claim_id]
      );
      return json(200, { ...job.rows[0], components: components.rows, claim_items: claimItems.rows });
    }

    // --------------------------------------------------------- create a job
    if (method === 'POST' && path === '/') {
      const b = await req.json();
      if (!b.claim_id) return json(400, { error: 'claim_id is required' });
      return await withTx(async (tx) => {
        const claim = await tx.query(`SELECT * FROM claims WHERE id = $1`, [b.claim_id]);
        if (!claim.rows.length) throw apiError(404, `Claim ${b.claim_id} not found`);
        if (claim.rows[0].status !== 'approved') {
          throw apiError(409, `Claim ${claim.rows[0].claim_number} isn't approved yet (status: ${claim.rows[0].status})`);
        }
        const existing = await tx.query(`SELECT id FROM jobs WHERE claim_id = $1`, [b.claim_id]);
        if (existing.rows.length) throw apiError(409, 'This claim already has a job');

        let quoteId = b.quote_id || null;
        if (!quoteId) {
          const q = await tx.query(
            `SELECT id FROM quotes WHERE claim_id = $1 AND status = 'approved' ORDER BY version DESC LIMIT 1`,
            [b.claim_id]
          );
          quoteId = q.rows[0]?.id || null;
        }

        const jobNumber = `JOB-${claim.rows[0].claim_number}`;
        const job = await tx.query(
          `INSERT INTO jobs (claim_id, quote_id, job_number, items_taken, start_date, due_date, owner_id, stage)
           VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,'awaiting_deposit'))
           RETURNING *`,
          [b.claim_id, quoteId, jobNumber, b.items_taken || null,
           b.start_date || new Date().toISOString().slice(0, 10), b.due_date || null,
           b.owner_id || null, b.stage]
        );
        const jobId = job.rows[0].id;

        // auto-populate one component per claim item as a starting point —
        // this is the "nothing gets re-keyed" part
        const items = await tx.query(
          `SELECT * FROM claim_items WHERE claim_id = $1 ORDER BY item_no`, [b.claim_id]
        );
        for (const it of items.rows) {
          await tx.query(
            `INSERT INTO job_components (job_id, claim_item_id, category, carat, colour,
               description, origin, weight_gms, actual_cost)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0)`,
            [jobId, it.id, it.category, it.metal_type, it.metal_colour,
             it.description, it.manufacture_origin, it.weight_gms]
          );
        }

        await tx.query(
          `INSERT INTO activity_log (staff_id, entity, entity_id, action)
           VALUES ($1,'job',$2,'created')`, [b.owner_id || null, jobId]
        );
        return json(201, { ...job.rows[0], components_created: items.rows.length });
      });
    }

    // --------------------------------------------------------- update a job
    if (method === 'PUT' && (m = path.match(/^\/(\d+)$/))) {
      const id = m[1];
      const b = await req.json();
      const { rows } = await pool.query(
        `UPDATE jobs SET
           stage       = COALESCE($2, stage),
           start_date  = COALESCE($3, start_date),
           due_date    = COALESCE($4, due_date),
           owner_id    = COALESCE($5, owner_id),
           items_taken = COALESCE($6, items_taken)
         WHERE id = $1 RETURNING *`,
        [id, b.stage || null, b.start_date || null, b.due_date || null,
         b.owner_id || null, b.items_taken ?? null]
      );
      if (!rows.length) return json(404, { error: 'Job not found' });
      await pool.query(
        `INSERT INTO activity_log (staff_id, entity, entity_id, action, detail)
         VALUES ($1,'job',$2,'updated',$3)`,
        [b.owner_id || null, id, JSON.stringify({ stage: b.stage })]
      );
      return json(200, rows[0]);
    }

    // ------------------------------------------------------ add a component
    if (method === 'POST' && (m = path.match(/^\/(\d+)\/components$/))) {
      const jobId = m[1];
      const b = await req.json();
      const { rows } = await pool.query(
        `INSERT INTO job_components (job_id, claim_item_id, category, carat, colour,
           description, origin, stock_no, supplier, invoice_no, weight_gms, rate_per_gm, actual_cost)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,COALESCE($13,0))
         RETURNING *`,
        [jobId, b.claim_item_id || null, b.category, b.carat, b.colour, b.description,
         b.origin, b.stock_no, b.supplier, b.invoice_no, nz(b.weight_gms), nz(b.rate_per_gm), nz(b.actual_cost)]
      );
      return json(201, rows[0]);
    }

    // ----------------------------------------------------- edit a component
    if (method === 'PUT' && (m = path.match(/^\/components\/(\d+)$/))) {
      const id = m[1];
      const b = await req.json();
      const { rows } = await pool.query(
        `UPDATE job_components SET
           category    = COALESCE($2, category),
           carat       = COALESCE($3, carat),
           colour      = COALESCE($4, colour),
           description = COALESCE($5, description),
           origin      = COALESCE($6, origin),
           stock_no    = COALESCE($7, stock_no),
           supplier    = COALESCE($8, supplier),
           invoice_no  = COALESCE($9, invoice_no),
           weight_gms  = COALESCE($10, weight_gms),
           rate_per_gm = COALESCE($11, rate_per_gm),
           actual_cost = COALESCE($12, actual_cost)
         WHERE id = $1 RETURNING *`,
        [id, b.category || null, b.carat ?? null, b.colour ?? null, b.description ?? null,
         b.origin ?? null, b.stock_no ?? null, b.supplier ?? null, b.invoice_no ?? null,
         nz(b.weight_gms), nz(b.rate_per_gm), nz(b.actual_cost)]
      );
      if (!rows.length) return json(404, { error: 'Component not found' });
      return json(200, rows[0]);
    }

    // --------------------------------------------------- remove a component
    if (method === 'DELETE' && (m = path.match(/^\/components\/(\d+)$/))) {
      const { rows } = await pool.query(
        `DELETE FROM job_components WHERE id = $1 RETURNING id`, [m[1]]
      );
      if (!rows.length) return json(404, { error: 'Component not found' });
      return json(200, { deleted: true });
    }

    return json(404, { error: `No route: ${method} ${path}` });
  } catch (err) {
    console.error(err);
    // 23505 = unique_violation. The application-level "already has a job"
    // check above handles the common case with a friendly message, but a
    // genuine race (two near-simultaneous requests) can still reach the
    // database constraint directly — translate that into the same friendly
    // message rather than leaking the raw Postgres constraint error.
    if (err.code === '23505' && err.constraint === 'jobs_claim_id_key') {
      return json(409, { error: 'This claim already has a job (created by a near-simultaneous request).' });
    }
    return json(err.status || 500, { error: err.message });
  }
};

// Attaches an HTTP status to an Error so business-rule rejections (not
// found, wrong state, conflict) return the right status code instead of
// falling through to a generic 500 — a 500 should mean "something broke",
// not "the request was invalid."
function apiError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

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

export const config = { path: ['/api/jobs', '/api/jobs/*'] };
