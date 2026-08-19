-- Adds a small key/value settings store, seeded with the format for the
-- auto-generated internal ("our ref") claim reference number. Also surfaces
-- the most recent Xero invoice number on v_pipeline so quotes.html can show
-- it in place of the "Send to Xero" button once a claim has already been
-- invoiced.

BEGIN;

CREATE TABLE IF NOT EXISTS app_settings (
    key         TEXT PRIMARY KEY,
    value       JSONB NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO app_settings (key, value)
VALUES ('reference_number_format', '{"prefix":"CC","digits":4,"reset_yearly":true,"year":null,"next_seq":1}')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE VIEW v_pipeline AS
SELECT c.id AS claim_id, c.claim_number, c.status, c.branch, c.date_received,
       cu.first_name || ' ' || cu.last_name AS customer,
       i.name AS insurer,
       COALESCE(q.total_retail, 0)  AS quoted_retail,
       COALESCE(q.total_nett, 0)    AS quoted_nett,
       (CURRENT_DATE - c.date_received) AS days_open,
       q.id AS quote_id,
       q.status AS quote_status,
       inv.invoice_number AS invoice_number
FROM claims c
JOIN customers cu ON cu.id = c.customer_id
LEFT JOIN insurers i ON i.id = c.insurer_id
LEFT JOIN LATERAL (
    SELECT id, status, total_retail, total_nett FROM quotes
    WHERE claim_id = c.id AND status <> 'superseded'
    ORDER BY version DESC LIMIT 1
) q ON TRUE
LEFT JOIN LATERAL (
    SELECT invoice_number FROM invoices
    WHERE claim_id = c.id
    ORDER BY created_at DESC LIMIT 1
) inv ON TRUE
WHERE c.status NOT IN ('paid','closed','declined');

COMMIT;
