-- Restore the canonical Copy E/ring category after hiding workbook aliases.

BEGIN;

INSERT INTO lookup_values (domain, code, label, sort_order, active, extra)
VALUES ('item_category', 'copy_ering', 'Copy E/ring', 4, true, '{}'::jsonb)
ON CONFLICT (domain, code) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  active = true,
  extra = COALESCE(lookup_values.extra, '{}'::jsonb) || EXCLUDED.extra;

UPDATE lookup_values
SET active = false
WHERE domain = 'item_category'
  AND code = 'copy_e_ring';

COMMIT;
