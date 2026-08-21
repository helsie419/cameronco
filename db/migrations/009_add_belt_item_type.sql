-- Ensure every active item category has at least one linked item type.

BEGIN;

INSERT INTO lookup_values (domain, code, label, sort_order, active, extra)
VALUES ('item_type', 'belt', 'Belt', 29, true, '{"category":"belt"}'::jsonb)
ON CONFLICT (domain, code) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  active = true,
  extra = COALESCE(lookup_values.extra, '{}'::jsonb) || EXCLUDED.extra;

COMMIT;
