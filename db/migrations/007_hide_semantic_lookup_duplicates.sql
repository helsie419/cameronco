-- Remove abbreviation/range aliases that are different strings but the same
-- human choice in the CRM dropdowns.

BEGIN;

UPDATE lookup_values
SET active = false
WHERE domain = 'proof_type'
  AND code IN ('desc_3', 'existing_e_ring');

UPDATE lookup_values
SET active = false
WHERE domain = 'validation_type'
  AND code IN (
    'phone_1_item',
    'phone_2_10_items',
    'phone_11_items',
    'face_to_face_1_item',
    'face_to_face_2_10_items',
    'face_to_face_11_items'
  );

UPDATE lookup_values
SET label = 'Large stone - up to 1ct'
WHERE domain = 'production_cost_default'
  AND code = 'large_stone_upto_1ct';

COMMIT;
