-- Tracks the date the insurer/assessor needs a response by (e.g. AAMI's
-- "Respond By" field on the assessment grid), so overdue/at-risk claims can
-- be surfaced on the dashboard alongside the existing pipeline stages.

BEGIN;

ALTER TABLE claims ADD COLUMN respond_by DATE;

CREATE OR REPLACE VIEW v_pipeline AS
SELECT c.id AS claim_id, c.claim_number, c.status, c.branch, c.date_received,
       c.respond_by,
       cu.first_name || ' ' || cu.last_name AS customer,
       i.name AS insurer,
       COALESCE(q.total_retail, 0)  AS quoted_retail,
       COALESCE(q.total_nett, 0)    AS quoted_nett,
       (CURRENT_DATE - c.date_received) AS days_open,
       q.id AS quote_id,
       q.status AS quote_status,
       inv.invoice_number AS invoice_number,
       inv.xero_invoice_id AS xero_invoice_id
FROM claims c
JOIN customers cu ON cu.id = c.customer_id
LEFT JOIN insurers i ON i.id = c.insurer_id
LEFT JOIN LATERAL (
    SELECT id, status, total_retail, total_nett FROM quotes
    WHERE claim_id = c.id AND status <> 'superseded'
    ORDER BY version DESC LIMIT 1
) q ON TRUE
LEFT JOIN LATERAL (
    SELECT invoice_number, xero_invoice_id FROM invoices
    WHERE claim_id = c.id
    ORDER BY created_at DESC LIMIT 1
) inv ON TRUE
WHERE c.status NOT IN ('paid','closed','declined');

COMMIT;
