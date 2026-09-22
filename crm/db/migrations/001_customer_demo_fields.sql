-- Adds the customer fields the CRM demo (index.html/app.js) relies on but
-- the original insurance-quoting schema didn't need: contact preference,
-- lead source, ring size, partner/occasion note, and consent provenance.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS preferred_contact TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS ring_size TEXT,
  ADD COLUMN IF NOT EXISTS partner_or_occasion TEXT,
  ADD COLUMN IF NOT EXISTS consent_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_source TEXT;
