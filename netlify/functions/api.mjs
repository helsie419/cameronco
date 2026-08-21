// ============================================================================
// CAMERON & CO — QUOTING API  (Netlify Function, standard `pg` driver)
// Works against Netlify DB (Neon) today and any self-hosted Postgres later —
// only the DATABASE_URL environment variable changes.
//
// Routes (all under /.netlify/functions/api/… or /api/* via redirect):
//   GET  /lookups                     all dropdown values grouped by domain
//   GET  /lookup-values               editable lookup rows
//   POST /lookup-values               create a lookup row
//   PUT  /lookup-values/:id           edit/deactivate a lookup row
//   GET  /rates                       current rate card + latest metal spots
//   GET  /insurers                    active insurers + contacts
//   POST /insurers                    create insurer
//   PUT  /insurers/:id                edit/deactivate insurer
//   POST /insurer-contacts            create insurer contact
//   PUT  /insurer-contacts/:id        edit/deactivate insurer contact
//   GET  /staff                       active staff (assessors, workshop, admin…)
//   POST /staff                       create staff
//   PUT  /staff/:id                   edit/deactivate staff
//   GET  /customers?q=smith           search customers
//   GET  /customers/:id               fetch one customer
//   POST /customers                   create customer
//   GET  /claims?status=&insurer=     list claims (pipeline)
//   GET  /claims/:id                  full claim: items, stones, costings, notes
//   POST /claims                      create claim + nested items (transactional)
//   PUT  /claims/:id                  update claim + replace nested items
//   POST /claims/:id/notes            add a dated note
//   POST /claims/:id/quotes           generate a quote version (snapshots rates)
//   POST /quotes/:id/review           internal sign-off, required before sending (admin only)
//   GET  /quotes/:id/pdf              render the quote as a customer-facing PDF
//   POST /quotes/:id/send             email the PDF to the customer (stub/live) — needs review first
//   PUT  /quotes/:id/status           customer/insurer decision: sent / approved / declined
// ============================================================================

import { pool } from './lib/db.mjs';
import { buildQuotePdf } from './lib/pdf.mjs';
import { sendQuoteEmail } from './lib/mailer-adapter.mjs';

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname
    .replace(/^\/\.netlify\/functions\/api/, '')
    .replace(/^\/api/, '')
    .replace(/\/$/, '') || '/';
  const method = req.method;
  let m;

  try {
    // ---------------------------------------------------------------- lookups
    if (method === 'GET' && path === '/lookups') {
      const { rows } = await pool.query(
        `SELECT domain, code, label, extra FROM lookup_values
         WHERE active ORDER BY domain, sort_order, label`
      );
      const grouped = {};
      for (const r of rows) {
        let extra = r.extra || {};
        if (typeof extra === 'string') { try { extra = JSON.parse(extra); } catch { /* keep text */ } }
        (grouped[r.domain] ||= []).push({ code: r.code, label: r.label, extra });
      }
      return json(200, grouped);
    }

    if (method === 'GET' && path === '/lookup-values') {
      const includeInactive = url.searchParams.get('include_inactive') === '1';
      const { rows } = await pool.query(
        `SELECT id, domain, code, label, sort_order, active, extra
         FROM lookup_values
         WHERE ? = 1 OR active = 1
         ORDER BY domain, sort_order, label`,
        [includeInactive]
      );
      return json(200, rows.map(r => ({ ...r, extra: typeof r.extra === 'string' ? JSON.parse(r.extra || '{}') : (r.extra || null) })));
    }

    if (method === 'POST' && path === '/lookup-values') {
      const b = await req.json();
      const domain = String(b.domain || '').trim();
      const label = String(b.label || '').trim();
      const code = String(b.code || slug(label)).trim();
      if (!domain || !label || !code) return json(400, { error: 'Domain, code and label are required' });
      const { rows } = await pool.query(
        `INSERT INTO lookup_values (domain, code, label, sort_order, active, extra)
         VALUES ($1,$2,$3,COALESCE($4,0),COALESCE($5,1),COALESCE($6,'{}'))
         ON CONFLICT (domain, code) DO UPDATE SET
           label = EXCLUDED.label,
           sort_order = EXCLUDED.sort_order,
           active = EXCLUDED.active,
           extra = EXCLUDED.extra
         RETURNING id, domain, code, label, sort_order, active, extra`,
        [domain, code, label, nz(b.sort_order), b.active ?? true, b.extra ? JSON.stringify(b.extra) : null]
      );
      return json(201, rows[0]);
    }

    if (method === 'PUT' && (m = path.match(/^\/lookup-values\/(\d+)$/))) {
      const b = await req.json();
      const { rows } = await pool.query(
        `UPDATE lookup_values SET
           domain = COALESCE($2, domain),
           code = COALESCE($3, code),
           label = COALESCE($4, label),
           sort_order = COALESCE($5, sort_order),
           active = COALESCE($6, active),
           extra = CASE WHEN $7 IS NULL THEN extra ELSE $7 END
         WHERE id = $1
         RETURNING id, domain, code, label, sort_order, active, extra`,
        [m[1], b.domain || null, b.code || null, b.label || null, nz(b.sort_order), typeof b.active === 'boolean' ? b.active : null, b.extra ? JSON.stringify(b.extra) : null]
      );
      if (!rows.length) return json(404, { error: 'Lookup value not found' });
      return json(200, rows[0]);
    }

    // ------------------------------------------------------------------ rates
    if (method === 'GET' && path === '/rates') {
      const rates = await pool.query(
        `SELECT code, label, category, metal_type, origin, rate, unit
         FROM rate_cards WHERE effective_to IS NULL ORDER BY category, code`
      );
      const spots = await pool.query(
        `SELECT m.metal, m.price_per_oz, m.price_per_gm, m.currency, m.fetched_at
         FROM metal_prices m
         WHERE m.fetched_at = (SELECT MAX(m2.fetched_at) FROM metal_prices m2 WHERE m2.metal=m.metal)
         ORDER BY m.metal`
      );
      return json(200, { rates: rates.rows, spot: spots.rows });
    }

    // --------------------------------------------------------------- insurers
    if (method === 'GET' && path === '/insurers') {
      const { rows } = await pool.query(
        `SELECT i.id, i.name, i.claims_email, i.assessment_format,
                COALESCE(json_group_array(json_object('id', ic.id, 'name', ic.full_name,
                  'email', ic.email, 'phone', ic.phone)) FILTER (WHERE ic.id IS NOT NULL), json('[]')) AS contacts
         FROM insurers i
         LEFT JOIN insurer_contacts ic ON ic.insurer_id = i.id AND ic.active
         WHERE i.active GROUP BY i.id ORDER BY i.name`
      );
      return json(200, rows.map(row => ({
        ...row,
        contacts: typeof row.contacts === 'string' ? JSON.parse(row.contacts || '[]') : (row.contacts || []),
      })));
    }

    if (method === 'POST' && path === '/insurers') {
      const b = await req.json();
      const name = String(b.name || '').trim();
      if (!name) return json(400, { error: 'Insurer name is required' });
      const { rows } = await pool.query(
        `INSERT INTO insurers (name, claims_email, phone, assessment_format, active)
         VALUES ($1,$2,$3,COALESCE($4,'GENERIC'),COALESCE($5,true))
         ON CONFLICT (name) DO UPDATE SET
           claims_email = EXCLUDED.claims_email,
           phone = EXCLUDED.phone,
           assessment_format = EXCLUDED.assessment_format,
           active = EXCLUDED.active
         RETURNING id, name, claims_email, phone, assessment_format, active`,
        [name, b.claims_email || null, b.phone || null, b.assessment_format || null, b.active ?? true]
      );
      return json(201, rows[0]);
    }

    if (method === 'PUT' && (m = path.match(/^\/insurers\/(\d+)$/))) {
      const b = await req.json();
      const { rows } = await pool.query(
        `UPDATE insurers SET
           name = COALESCE($2, name),
           claims_email = COALESCE($3, claims_email),
           phone = COALESCE($4, phone),
           assessment_format = COALESCE($5, assessment_format),
           active = COALESCE($6, active)
         WHERE id = $1
         RETURNING id, name, claims_email, phone, assessment_format, active`,
        [m[1], b.name || null, b.claims_email || null, b.phone || null, b.assessment_format || null, typeof b.active === 'boolean' ? b.active : null]
      );
      if (!rows.length) return json(404, { error: 'Insurer not found' });
      return json(200, rows[0]);
    }

    if (method === 'POST' && path === '/insurer-contacts') {
      const b = await req.json();
      if (!b.insurer_id) return json(400, { error: 'Insurer is required' });
      const fullName = String(b.full_name || '').trim();
      if (!fullName) return json(400, { error: 'Contact name is required' });
      const { rows } = await pool.query(
        `INSERT INTO insurer_contacts (insurer_id, full_name, email, phone, active)
         VALUES ($1,$2,$3,$4,COALESCE($5,true))
         RETURNING id, insurer_id, full_name, email, phone, active`,
        [b.insurer_id, fullName, b.email || null, b.phone || null, b.active ?? true]
      );
      return json(201, rows[0]);
    }

    if (method === 'PUT' && (m = path.match(/^\/insurer-contacts\/(\d+)$/))) {
      const b = await req.json();
      const { rows } = await pool.query(
        `UPDATE insurer_contacts SET
           insurer_id = COALESCE($2, insurer_id),
           full_name = COALESCE($3, full_name),
           email = COALESCE($4, email),
           phone = COALESCE($5, phone),
           active = COALESCE($6, active)
         WHERE id = $1
         RETURNING id, insurer_id, full_name, email, phone, active`,
        [m[1], b.insurer_id || null, b.full_name || null, b.email || null, b.phone || null, typeof b.active === 'boolean' ? b.active : null]
      );
      if (!rows.length) return json(404, { error: 'Insurer contact not found' });
      return json(200, rows[0]);
    }

    // ----------------------------------------------------------------- staff
    if (method === 'GET' && path === '/staff') {
      const includeInactive = url.searchParams.get('include_inactive') === '1';
      const { rows } = await pool.query(
        `SELECT id, full_name, role, branch, can_approve_quotes, active FROM staff
         WHERE ? = 1 OR active = 1
         ORDER BY full_name`,
        [includeInactive]
      );
      return json(200, rows);
    }

    if (method === 'POST' && path === '/staff') {
      const b = await req.json();
      const fullName = String(b.full_name || '').trim();
      if (!fullName) return json(400, { error: 'Staff name is required' });
      const { rows } = await pool.query(
        `INSERT INTO staff (full_name, role, branch, can_approve_quotes, active)
         VALUES ($1,COALESCE($2,'assessor'),COALESCE($3,'melbourne'),COALESCE($4,false),COALESCE($5,true))
         ON CONFLICT (full_name) DO UPDATE SET
           role = EXCLUDED.role,
           branch = EXCLUDED.branch,
           can_approve_quotes = EXCLUDED.can_approve_quotes,
           active = EXCLUDED.active
         RETURNING id, full_name, role, branch, can_approve_quotes, active`,
        [fullName, b.role || null, b.branch || null, b.can_approve_quotes ?? false, b.active ?? true]
      );
      return json(201, rows[0]);
    }

    if (method === 'PUT' && (m = path.match(/^\/staff\/(\d+)$/))) {
      const b = await req.json();
      const { rows } = await pool.query(
        `UPDATE staff SET
           full_name = COALESCE($2, full_name),
           role = COALESCE($3, role),
           branch = COALESCE($4, branch),
           can_approve_quotes = COALESCE($5, can_approve_quotes),
           active = COALESCE($6, active)
         WHERE id = $1
         RETURNING id, full_name, role, branch, can_approve_quotes, active`,
        [m[1], b.full_name || null, b.role || null, b.branch || null,
         typeof b.can_approve_quotes === 'boolean' ? b.can_approve_quotes : null,
         typeof b.active === 'boolean' ? b.active : null]
      );
      if (!rows.length) return json(404, { error: 'Staff member not found' });
      return json(200, rows[0]);
    }

    // ------------------------------------------------------- dashboard summary
    if (method === 'GET' && path === '/dashboard/summary') {
      const [metrics, claimStages, jobStages, dueJobs, sentQuotes] = await Promise.all([
        pool.query(`
          SELECT
            (SELECT COUNT(*) FROM claims c
             WHERE c.status IN ('new_enquiry','assessing','quote_sent','revised')
               AND EXISTS (SELECT 1 FROM quotes q WHERE q.claim_id=c.id AND q.status <> 'superseded')) AS active_quote_count,
            (SELECT COALESCE(SUM(q.total_retail),0) FROM quotes q JOIN claims c ON c.id=q.claim_id
             WHERE q.id=(SELECT q2.id FROM quotes q2 WHERE q2.claim_id=c.id AND q2.status <> 'superseded' ORDER BY q2.version DESC LIMIT 1)
               AND c.status IN ('new_enquiry','assessing','quote_sent','revised')) AS open_quote_value,
            (SELECT COUNT(*) FROM jobs WHERE stage NOT IN ('completed','cancelled')) AS workshop_load,
            (SELECT COUNT(*) FROM jobs WHERE due_date < CURRENT_DATE AND stage NOT IN ('completed','cancelled')) AS overdue_jobs,
            (SELECT COALESCE(SUM(total),0) FROM invoices WHERE status NOT IN ('paid','voided')) AS unpaid_balances
        `),
        pool.query(`
          SELECT
            SUM(CASE WHEN status IN ('new_enquiry','assessing') THEN 1 ELSE 0 END) AS new_enquiry,
            SUM(CASE WHEN status IN ('quote_sent','revised') THEN 1 ELSE 0 END) AS quote_sent,
            SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved_no_job
          FROM claims
        `),
        pool.query(`
          SELECT
            SUM(CASE WHEN stage = 'awaiting_deposit' THEN 1 ELSE 0 END) AS awaiting_deposit,
            SUM(CASE WHEN stage = 'cad_approval' THEN 1 ELSE 0 END) AS cad_approval,
            SUM(CASE WHEN stage = 'in_production' THEN 1 ELSE 0 END) AS in_production,
            SUM(CASE WHEN stage = 'quality_check' THEN 1 ELSE 0 END) AS quality_check,
            SUM(CASE WHEN stage = 'ready_for_collection' THEN 1 ELSE 0 END) AS ready_for_collection,
            SUM(CASE WHEN stage = 'completed' THEN 1 ELSE 0 END) AS completed
          FROM jobs
        `),
        pool.query(`
          SELECT j.job_number AS title,
                 'Job due ' || j.due_date AS meta,
                 cu.first_name || ' ' || cu.last_name AS customer,
                 c.id AS claim_id
          FROM jobs j
          JOIN claims c ON c.id = j.claim_id
          JOIN customers cu ON cu.id = c.customer_id
          WHERE j.due_date <= CURRENT_DATE AND j.stage NOT IN ('completed','cancelled')
          ORDER BY j.due_date LIMIT 8
        `),
        pool.query(`
          SELECT c.claim_number AS title,
                 'Quote awaiting decision' AS meta,
                 cu.first_name || ' ' || cu.last_name AS customer,
                 c.id AS claim_id
          FROM quotes q
          JOIN claims c ON c.id = q.claim_id
          JOIN customers cu ON cu.id = c.customer_id
          WHERE q.status = 'sent'
          ORDER BY q.sent_at LIMIT 8
        `),
      ]);

      const m = metrics.rows[0];
      const cs = claimStages.rows[0];
      const js = jobStages.rows[0];
      const pipeline = [
        { stage: 'New enquiry', count: Number(cs.new_enquiry) },
        { stage: 'Quote sent', count: Number(cs.quote_sent) },
        { stage: 'Awaiting deposit', count: Number(cs.approved_no_job) + Number(js.awaiting_deposit) },
        { stage: 'CAD approval', count: Number(js.cad_approval) },
        { stage: 'In production', count: Number(js.in_production) },
        { stage: 'Quality check', count: Number(js.quality_check) },
        { stage: 'Ready for collection', count: Number(js.ready_for_collection) },
        { stage: 'Completed', count: Number(js.completed) },
      ];

      return json(200, {
        openQuoteValue: Number(m.open_quote_value),
        activeQuoteCount: Number(m.active_quote_count),
        workshopLoad: Number(m.workshop_load),
        overdueJobs: Number(m.overdue_jobs),
        unpaidBalances: Number(m.unpaid_balances),
        pipeline,
        totalRecords: pipeline.reduce((sum, p) => sum + p.count, 0),
        todayItems: dueJobs.rows.concat(sentQuotes.rows).slice(0, 8),
      });
    }

    // -------------------------------------------------------------- customers
    if (method === 'GET' && path === '/customers') {
      const q = (url.searchParams.get('q') || '').trim();
      const { rows } = await pool.query(
        `SELECT id, first_name, last_name, email, phone, mobile, address_line1,
                suburb, state, postcode, customer_type, preferred_contact, source,
                ring_size, partner_or_occasion, notes, consent_email, consent_sms,
                consent_marketing, consent_updated_at, consent_source,
                created_at, updated_at
         FROM customers
         WHERE ($1 = '' OR LOWER(first_name) LIKE '%'||LOWER($1)||'%' OR LOWER(last_name) LIKE '%'||LOWER($1)||'%'
            OR LOWER(email) LIKE '%'||LOWER($1)||'%' OR LOWER(phone) LIKE '%'||LOWER($1)||'%')
         ORDER BY last_name, first_name LIMIT 500`, [q]
      );
      return json(200, rows);
    }

    if (method === 'GET' && (m = path.match(/^\/customers\/(\d+)$/))) {
      const { rows } = await pool.query(
        `SELECT id, first_name, last_name, email, phone, mobile, address_line1,
                suburb, state, postcode, customer_type, preferred_contact, source,
                ring_size, partner_or_occasion, notes, consent_email, consent_sms,
                consent_marketing, consent_updated_at, consent_source,
                created_at, updated_at
         FROM customers WHERE id = $1`, [m[1]]
      );
      if (!rows.length) return json(404, { error: 'Customer not found' });
      return json(200, rows[0]);
    }

    if (method === 'POST' && path === '/customers') {
      const b = await req.json();
      const { rows } = await pool.query(
        `INSERT INTO customers (first_name, last_name, email, phone, mobile,
           address_line1, suburb, state, postcode, customer_type,
           preferred_contact, source, ring_size, partner_or_occasion, notes,
           consent_email, consent_sms, consent_marketing, consent_updated_at, consent_source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10,'insurance'),
                 $11,$12,$13,$14,$15,
                 COALESCE($16,false),COALESCE($17,false),COALESCE($18,false),$19,$20)
         RETURNING *`,
        [b.first_name, b.last_name || '', b.email, b.phone, b.mobile,
         b.address_line1, b.suburb, b.state, b.postcode, b.customer_type,
         b.preferred_contact, b.source, b.ring_size, b.partner_or_occasion, b.notes,
         b.consent_email, b.consent_sms, b.consent_marketing, b.consent_updated_at, b.consent_source]
      );
      return json(201, rows[0]);
    }

    if (method === 'PUT' && (m = path.match(/^\/customers\/(\d+)$/))) {
      const id = m[1];
      const b = await req.json();
      const { rows } = await pool.query(
        `UPDATE customers SET
           first_name          = COALESCE($2,  first_name),
           last_name            = COALESCE($3,  last_name),
           email                = COALESCE($4,  email),
           phone                = COALESCE($5,  phone),
           mobile               = COALESCE($6,  mobile),
           address_line1        = COALESCE($7,  address_line1),
           suburb               = COALESCE($8,  suburb),
           state                = COALESCE($9,  state),
           postcode             = COALESCE($10, postcode),
           customer_type        = COALESCE($11, customer_type),
           preferred_contact    = COALESCE($12, preferred_contact),
           source               = COALESCE($13, source),
           ring_size            = COALESCE($14, ring_size),
           partner_or_occasion  = COALESCE($15, partner_or_occasion),
           notes                = COALESCE($16, notes),
           consent_email        = COALESCE($17, consent_email),
           consent_sms          = COALESCE($18, consent_sms),
           consent_marketing    = COALESCE($19, consent_marketing),
           consent_updated_at   = COALESCE($20, consent_updated_at),
           consent_source       = COALESCE($21, consent_source)
         WHERE id = $1 RETURNING *`,
        [id, b.first_name, b.last_name, b.email, b.phone, b.mobile,
         b.address_line1, b.suburb, b.state, b.postcode, b.customer_type,
         b.preferred_contact, b.source, b.ring_size, b.partner_or_occasion, b.notes,
         b.consent_email, b.consent_sms, b.consent_marketing, b.consent_updated_at, b.consent_source]
      );
      if (!rows.length) return json(404, { error: 'Customer not found' });
      return json(200, rows[0]);
    }

    // ----------------------------------------------------------------- claims
    if (method === 'GET' && path === '/claims') {
      const customerId = url.searchParams.get('customer_id');
      // A customer's full history should show every claim regardless of
      // status (v_pipeline deliberately excludes paid/closed/declined —
      // right for the open pipeline view, wrong for a customer profile).
      if (customerId) {
        const { rows } = await pool.query(
          `SELECT c.id AS claim_id, c.claim_number, c.status, c.branch, c.date_received,
                  i.name AS insurer,
                  q.total_retail AS quoted_retail, q.total_nett AS quoted_nett
           FROM claims c
           LEFT JOIN insurers i ON i.id = c.insurer_id
           LEFT JOIN quotes q ON q.id = (
             SELECT q2.id FROM quotes q2
             WHERE q2.claim_id = c.id AND q2.status <> 'superseded'
             ORDER BY q2.version DESC LIMIT 1
           )
           WHERE c.customer_id = $1
           ORDER BY c.date_received DESC`, [customerId]
        );
        return json(200, rows);
      }

      const status = url.searchParams.get('status');
      const { rows } = await pool.query(
        `SELECT * FROM v_pipeline
         WHERE status = COALESCE($1, status)
         ORDER BY date_received DESC LIMIT 200`, [status]
      );
      return json(200, rows);
    }

    if (method === 'GET' && (m = path.match(/^\/claims\/(\d+)$/))) {
      const id = m[1];
      const claim = await pool.query(`SELECT * FROM claims WHERE id = $1`, [id]);
      if (!claim.rows.length) return json(404, { error: 'Claim not found' });
      const [customer, items, notes, quotes] = await Promise.all([
        pool.query(`SELECT * FROM customers WHERE id = $1`, [claim.rows[0].customer_id]),
        pool.query(`SELECT * FROM claim_items WHERE claim_id = $1 ORDER BY item_no`, [id]),
        pool.query(
          `SELECT n.*, s.full_name AS staff_name FROM claim_notes n
           LEFT JOIN staff s ON s.id = n.staff_id
           WHERE n.claim_id = $1 ORDER BY n.noted_at DESC`, [id]),
        pool.query(`SELECT id, version, status, total_retail, total_nett,
                    total_liability, created_at, sent_at
                    FROM quotes WHERE claim_id = $1 ORDER BY version DESC`, [id]),
      ]);
      for (const item of items.rows) {
        const [stones, costings] = await Promise.all([
          pool.query(`SELECT * FROM item_stones WHERE claim_item_id=$1 ORDER BY line_no`, [item.id]),
          pool.query(`SELECT * FROM item_costings WHERE claim_item_id=$1 ORDER BY line_no`, [item.id]),
        ]);
        item.stones = stones.rows;
        item.costings = costings.rows;
      }
      return json(200, {
        ...claim.rows[0],
        customer: customer.rows[0],
        items: items.rows,
        notes: notes.rows,
        quotes: quotes.rows,
      });
    }

    if (method === 'POST' && path === '/claims') {
      const b = await req.json();
      return await withTx(async (tx) => {
        const claim = await tx.query(
          `INSERT INTO claims (claim_number, our_ref, your_ref, customer_id, insurer_id,
             insurer_contact_id, branch, assessment_type, validation_type, date_received,
             assigned_to, excess_amount, settlement_notes)
           VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,'melbourne'),$8,$9,COALESCE($10,CURRENT_DATE),$11,$12,$13)
           RETURNING *`,
          [b.claim_number, b.our_ref, b.your_ref, b.customer_id, b.insurer_id,
           b.insurer_contact_id, b.branch, b.assessment_type, b.validation_type,
           b.date_received, b.assigned_to, b.excess_amount, b.settlement_notes]
        );
        const claimId = claim.rows[0].id;
        await saveItems(tx, claimId, b.items || []);
        await tx.query(
          `INSERT INTO activity_log (staff_id, entity, entity_id, action)
           VALUES ($1,'claim',$2,'created')`, [b.assigned_to || null, claimId]);
        return json(201, { id: claimId });
      });
    }

    if (method === 'PUT' && (m = path.match(/^\/claims\/(\d+)$/))) {
      const id = m[1];
      const b = await req.json();
      return await withTx(async (tx) => {
        const upd = await tx.query(
          `UPDATE claims SET
             claim_number       = COALESCE($2,  claim_number),
             our_ref            = COALESCE($3,  our_ref),
             your_ref           = COALESCE($4,  your_ref),
             customer_id        = COALESCE($5,  customer_id),
             insurer_id         = COALESCE($6,  insurer_id),
             insurer_contact_id = COALESCE($7,  insurer_contact_id),
             branch             = COALESCE($8,  branch),
             assessment_type    = COALESCE($9,  assessment_type),
             validation_type    = COALESCE($10, validation_type),
             date_received      = COALESCE($11, date_received),
             assigned_to        = COALESCE($12, assigned_to),
             excess_amount      = COALESCE($13, excess_amount),
             settlement_notes   = COALESCE($14, settlement_notes),
             status             = COALESCE($15, status)
           WHERE id=$1 RETURNING id`,
          [id, b.claim_number, b.our_ref, b.your_ref, b.customer_id, b.insurer_id,
           b.insurer_contact_id, b.branch, b.assessment_type, b.validation_type,
           b.date_received, b.assigned_to, b.excess_amount, b.settlement_notes, b.status]
        );
        if (!upd.rows.length) return json(404, { error: 'Claim not found' });
        if (b.items) {
          await tx.query(`DELETE FROM claim_items WHERE claim_id=$1`, [id]);
          await saveItems(tx, id, b.items);
        }
        await tx.query(
          `INSERT INTO activity_log (staff_id, entity, entity_id, action)
           VALUES ($1,'claim',$2,'updated')`, [b.assigned_to || null, id]);
        return json(200, { id: Number(id) });
      });
    }

    // ------------------------------------------------------------------ notes
    if (method === 'POST' && (m = path.match(/^\/claims\/(\d+)\/notes$/))) {
      const b = await req.json();
      const { rows } = await pool.query(
        `INSERT INTO claim_notes (claim_id, staff_id, note_type, note)
         VALUES ($1,$2,COALESCE($3,'internal'),$4) RETURNING *`,
        [m[1], b.staff_id, b.note_type, b.note]
      );
      return json(201, rows[0]);
    }

    // ----------------------------------------------------------------- quotes
    if (method === 'POST' && (m = path.match(/^\/claims\/(\d+)\/quotes$/))) {
      const claimId = m[1];
      const b = await req.json();
      return await withTx(async (tx) => {
        await tx.query(
          `UPDATE quotes SET status='superseded'
           WHERE claim_id=$1 AND status IN ('draft','ready_to_send','sent')`, [claimId]);
        const ver = await tx.query(
          `SELECT COALESCE(MAX(version),0)+1 AS v FROM quotes WHERE claim_id=$1`, [claimId]);
        const rates = await tx.query(
          `SELECT code, rate, unit FROM rate_cards WHERE effective_to IS NULL`);
        const spot = await tx.query(
          `SELECT m.metal, m.price_per_gm, m.fetched_at FROM metal_prices m
           WHERE m.fetched_at=(SELECT MAX(m2.fetched_at) FROM metal_prices m2 WHERE m2.metal=m.metal)
           ORDER BY m.metal`);
        const items = await tx.query(
          `SELECT ci.* FROM claim_items ci WHERE claim_id=$1 ORDER BY item_no`, [claimId]);
        for (const item of items.rows) {
          const stones = await tx.query(`SELECT * FROM item_stones WHERE claim_item_id=$1 ORDER BY line_no`, [item.id]);
          item.stones = stones.rows;
        }
        const { rows } = await tx.query(
          `INSERT INTO quotes (claim_id, version, total_retail, total_nett,
             total_liability, postage_handling, salvage_allocation,
             rates_snapshot, spot_snapshot, items_snapshot, created_by)
           VALUES ($1,$2,$3,$4,$5,COALESCE($6,0),COALESCE($7,0),$8,$9,$10,$11)
           RETURNING id, version`,
          [claimId, ver.rows[0].v, b.total_retail || 0, b.total_nett || 0,
           b.total_liability || 0, b.postage_handling, b.salvage_allocation,
           JSON.stringify(rates.rows), JSON.stringify(spot.rows),
           JSON.stringify(items.rows), b.created_by || null]
        );
        await tx.query(`UPDATE claims SET status='pending_approval' WHERE id=$1 AND status IN ('new_enquiry','assessing')`, [claimId]);
        return json(201, rows[0]);
      });
    }

    // Internal sign-off, required before a quote can be emailed to the
    // customer. Deliberately separate from the customer-facing 'approved'
    // status below — that one still means the customer/insurer accepted it.
    if (method === 'POST' && (m = path.match(/^\/quotes\/(\d+)\/review$/))) {
      const quoteId = m[1];
      const b = await req.json();
      const staffId = b.staff_id;
      if (!staffId) return json(400, { error: 'Select which staff member is approving this quote.' });

      const staff = await pool.query(`SELECT id, full_name, role, can_approve_quotes FROM staff WHERE id=$1`, [staffId]);
      if (!staff.rows.length) return json(400, { error: 'Staff member not found.' });
      if (staff.rows[0].role !== 'admin' && !staff.rows[0].can_approve_quotes) {
        return json(403, {
          error: `${staff.rows[0].full_name} (${staff.rows[0].role}) isn't authorised to approve quotes — needs admin role or the "can approve quotes" permission.`,
        });
      }

      const { rows } = await pool.query(
        `UPDATE quotes SET status='ready_to_send', reviewed_by=$2, reviewed_at=CURRENT_TIMESTAMP
         WHERE id=$1 AND status='draft' RETURNING id, status, reviewed_by, reviewed_at`,
        [quoteId, staffId]
      );
      if (!rows.length) return json(400, { error: 'Only a draft quote can be approved for sending.' });
      await pool.query(
        `INSERT INTO activity_log (staff_id, entity, entity_id, action) VALUES ($1,'quote',$2,'reviewed')`,
        [staffId, quoteId]
      );
      return json(200, rows[0]);
    }

    if (method === 'PUT' && (m = path.match(/^\/quotes\/(\d+)\/status$/))) {
      const b = await req.json();
      const { rows } = await pool.query(
        `UPDATE quotes SET status=$2,
           sent_at    = CASE WHEN $2='sent' THEN CURRENT_TIMESTAMP ELSE sent_at END,
           decided_at = CASE WHEN $2 IN ('approved','declined') THEN CURRENT_TIMESTAMP ELSE decided_at END
         WHERE id=$1 RETURNING id, claim_id, status`, [m[1], b.status]);
      if (rows[0]?.status === 'approved')
        await pool.query(`UPDATE claims SET status='approved' WHERE id=$1`, [rows[0].claim_id]);
      return json(200, rows[0]);
    }

    if (method === 'GET' && (m = path.match(/^\/quotes\/(\d+)\/pdf$/))) {
      const detail = await loadQuoteDetail(m[1]);
      if (!detail) return json(404, { error: 'Quote not found' });
      const pdfBuffer = await buildQuotePdf(detail.q, detail);
      return new Response(pdfBuffer, {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': `inline; filename="quote-${detail.q.claim_number}-v${detail.q.version}.pdf"`,
        },
      });
    }

    if (method === 'POST' && (m = path.match(/^\/quotes\/(\d+)\/send$/))) {
      const quoteId = m[1];
      const detail = await loadQuoteDetail(quoteId);
      if (!detail) return json(404, { error: 'Quote not found' });
      const { q } = detail;
      if (!['ready_to_send', 'sent'].includes(q.status)) {
        return json(400, { error: 'This quote needs internal approval before it can be sent to the customer.' });
      }
      if (!q.customer_email) return json(400, { error: 'This customer has no email address on file.' });

      const pdfBuffer = await buildQuotePdf(q, detail);
      const pdfFilename = `quote-${q.claim_number}-v${q.version}.pdf`;
      const customerName = [q.first_name, q.last_name].filter(Boolean).join(' ');

      let result;
      try {
        result = await sendQuoteEmail({
          to: q.customer_email, customerName, claimNumber: q.claim_number,
          version: q.version, pdfBuffer, pdfFilename,
        });
      } catch (err) {
        return json(502, { error: `Could not send email: ${err.message}` });
      }

      const upd = await pool.query(
        `UPDATE quotes SET status = CASE WHEN status='ready_to_send' THEN 'sent' ELSE status END,
           sent_at = CURRENT_TIMESTAMP WHERE id=$1 RETURNING id, status, sent_at`, [quoteId]);
      await pool.query(
        `UPDATE claims SET status='quote_sent'
         WHERE id=(SELECT claim_id FROM quotes WHERE id=$1) AND status IN ('new_enquiry','assessing','pending_approval')`,
        [quoteId]
      );
      await pool.query(
        `INSERT INTO activity_log (entity, entity_id, action, detail)
         VALUES ('quote', $1, 'sent', $2)`,
        [quoteId, JSON.stringify({ to: q.customer_email, mode: result.mode, message_id: result.messageId })]
      );
      return json(200, { sent: true, mode: result.mode, to: q.customer_email, quote: upd.rows[0] });
    }

    return json(404, { error: `No route: ${method} ${path}` });
  } catch (err) {
    console.error(err);
    return json(500, { error: err.message });
  }
};

// ---------------------------------------------------------------- helpers
async function loadQuoteDetail(id) {
  const { rows } = await pool.query(
    `SELECT q.*, c.claim_number, c.our_ref, c.your_ref, c.branch, c.excess_amount,
            cu.first_name, cu.last_name, cu.email AS customer_email,
            cu.address_line1, cu.address_line2, cu.suburb, cu.state, cu.postcode,
            i.name AS insurer_name
     FROM quotes q
     JOIN claims c ON c.id = q.claim_id
     JOIN customers cu ON cu.id = c.customer_id
     LEFT JOIN insurers i ON i.id = c.insurer_id
     WHERE q.id = $1`, [id]
  );
  if (!rows.length) return null;

  const labels = await pool.query(
    `SELECT domain, code, label FROM lookup_values WHERE domain IN ('item_type','item_category')`
  );
  const itemTypeLabels = {}, categoryLabels = {};
  for (const r of labels.rows) {
    if (r.domain === 'item_type') itemTypeLabels[r.code] = r.label;
    else categoryLabels[r.code] = r.label;
  }
  return { q: rows[0], itemTypeLabels, categoryLabels };
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

async function saveItems(tx, claimId, items) {
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const res = await tx.query(
      `INSERT INTO claim_items (claim_id, item_no, category, item_type, description,
         comment, metal_type, metal_colour, manufacture_origin, chain_style, ring_style,
         repair_type, weight_gms, width_mm, length_cm, finger_size,
         watch_make, watch_gents_ladies, watch_current_model, watch_replacement_model,
         watch_metal, proof_type, eoo_status, eoo_notes,
         policy_limit, retail_price, insurance_nett, liability, fulfilment, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
               $21,$22,$23,$24,$25,$26,$27,$28,$29,COALESCE($30,'draft'))
       RETURNING id`,
      [claimId, it.item_no ?? i + 1, it.category, it.item_type, it.description,
       it.comment, it.metal_type, it.metal_colour, it.manufacture_origin,
       it.chain_style, it.ring_style, it.repair_type, nz(it.weight_gms),
       nz(it.width_mm), nz(it.length_cm), it.finger_size,
       it.watch_make, it.watch_gents_ladies || null, it.watch_current_model,
       it.watch_replacement_model, it.watch_metal, it.proof_type,
       it.eoo_status || null, it.eoo_notes, nz(it.policy_limit),
       nz(it.retail_price), nz(it.insurance_nett), nz(it.liability),
       it.fulfilment || null, it.status]
    );
    const itemId = res.rows[0].id;
    for (let s = 0; s < (it.stones || []).length; s++) {
      const st = it.stones[s];
      if (!st.stone_type && !st.total_carat && !st.cost) continue;
      await tx.query(
        `INSERT INTO item_stones (claim_item_id, line_no, stone_type, shape, stone_count,
           carat_each, total_carat, quality, certificate, cost_per_carat, cost)
         VALUES ($1,$2,$3,$4,COALESCE($5,1),$6,$7,$8,$9,$10,$11)`,
        [itemId, s + 1, st.stone_type, st.shape, st.stone_count, nz(st.carat_each),
         nz(st.total_carat), st.quality, st.certificate, nz(st.cost_per_carat), nz(st.cost)]
      );
    }
    for (let c = 0; c < (it.costings || []).length; c++) {
      const co = it.costings[c];
      if (!co.amount && !co.qty) continue;
      await tx.query(
        `INSERT INTO item_costings (claim_item_id, line_no, cost_type, description,
           qty, unit, rate, amount)
         VALUES ($1,$2,$3,$4,COALESCE($5,1),COALESCE($6,'pc'),COALESCE($7,0),COALESCE($8,0))`,
        [itemId, c + 1, co.cost_type || 'other', co.description, nz(co.qty),
         co.unit, nz(co.rate), nz(co.amount)]
      );
    }
  }
}

const nz = (v) => (v === '' || v === undefined || v === null || Number.isNaN(Number(v)) ? null : Number(v));
const slug = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// Scoped deliberately: this must not overlap with the more specific paths
// owned by xero.mjs (/api/xero/*), rate-admin.mjs (/api/rate-admin/*), or
// jobs.mjs (/api/jobs*) — a blanket '/api/*' here shadows those functions,
// since this one is also registered on the shared '/api' namespace.
export const config = {
  path: [
    '/api/lookups',
    '/api/lookup-values',
    '/api/lookup-values/*',
    '/api/rates',
    '/api/insurers',
    '/api/insurers/*',
    '/api/insurer-contacts',
    '/api/insurer-contacts/*',
    '/api/staff',
    '/api/staff/*',
    '/api/dashboard/summary',
    '/api/customers',
    '/api/customers/*',
    '/api/claims',
    '/api/claims/*',
    '/api/quotes/*',
  ],
};
