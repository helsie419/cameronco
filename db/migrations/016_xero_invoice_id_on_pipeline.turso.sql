-- Turso/SQLite-safe counterpart to 016_xero_invoice_id_on_pipeline.sql.

DROP VIEW IF EXISTS v_pipeline;

CREATE VIEW v_pipeline AS
SELECT c.id AS claim_id, c.claim_number, c.status, c.branch, c.date_received,
       cu.first_name || ' ' || cu.last_name AS customer, i.name AS insurer,
       COALESCE(q.total_retail,0) AS quoted_retail, COALESCE(q.total_nett,0) AS quoted_nett,
       CAST(julianday('now') - julianday(c.date_received) AS INTEGER) AS days_open,
       q.id AS quote_id, q.status AS quote_status,
       inv.invoice_number AS invoice_number, inv.xero_invoice_id AS xero_invoice_id
FROM claims c JOIN customers cu ON cu.id=c.customer_id LEFT JOIN insurers i ON i.id=c.insurer_id
LEFT JOIN quotes q ON q.id=(SELECT q2.id FROM quotes q2 WHERE q2.claim_id=c.id AND q2.status <> 'superseded' ORDER BY q2.version DESC LIMIT 1)
LEFT JOIN (
  SELECT i1.claim_id, i1.invoice_number, i1.xero_invoice_id FROM invoices i1
  WHERE i1.created_at = (SELECT MAX(i2.created_at) FROM invoices i2 WHERE i2.claim_id = i1.claim_id)
) inv ON inv.claim_id = c.id
WHERE c.status NOT IN ('paid','closed','declined');
