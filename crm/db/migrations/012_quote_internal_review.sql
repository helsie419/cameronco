-- Quotes now need internal sign-off before they can be emailed to the
-- customer. This is a separate step from the existing 'approved' status,
-- which still means the customer/insurer has accepted the quote — that
-- continues to gate job creation and Xero invoicing, unchanged.
--
-- New quote lifecycle: draft -> ready_to_send -> sent -> approved/declined
-- New claim status: pending_approval, sitting between "being assessed" and
-- "quote_sent" (which now only fires once the quote is actually emailed).

BEGIN;

ALTER TABLE quotes DROP CONSTRAINT quotes_status_check;
ALTER TABLE quotes ADD CONSTRAINT quotes_status_check
  CHECK (status IN ('draft', 'ready_to_send', 'sent', 'approved', 'declined', 'superseded'));

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS reviewed_by BIGINT REFERENCES staff(id);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE claims DROP CONSTRAINT claims_status_check;
ALTER TABLE claims ADD CONSTRAINT claims_status_check
  CHECK (status IN ('new_enquiry', 'assessing', 'pending_approval', 'quote_sent', 'revised',
                     'approved', 'awaiting_deposit', 'cad_approval', 'in_production',
                     'quality_check', 'ready_for_collection', 'completed', 'invoiced',
                     'paid', 'declined', 'closed'));

CREATE OR REPLACE VIEW v_pipeline AS
SELECT c.id AS claim_id, c.claim_number, c.status, c.branch, c.date_received,
       cu.first_name || ' ' || cu.last_name AS customer,
       i.name AS insurer,
       COALESCE(q.total_retail, 0)  AS quoted_retail,
       COALESCE(q.total_nett, 0)    AS quoted_nett,
       (CURRENT_DATE - c.date_received) AS days_open,
       q.id AS quote_id,
       q.status AS quote_status
FROM claims c
JOIN customers cu ON cu.id = c.customer_id
LEFT JOIN insurers i ON i.id = c.insurer_id
LEFT JOIN LATERAL (
    SELECT id, status, total_retail, total_nett FROM quotes
    WHERE claim_id = c.id AND status <> 'superseded'
    ORDER BY version DESC LIMIT 1
) q ON TRUE
WHERE c.status NOT IN ('paid','closed','declined');

COMMIT;
