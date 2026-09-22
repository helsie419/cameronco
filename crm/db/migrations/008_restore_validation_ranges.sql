-- Restore canonical validation ranges accidentally caught by the generic suffix
-- cleanup and hide unrelated workbook values from this dropdown.

BEGIN;

UPDATE lookup_values
SET active = false
WHERE domain = 'validation_type';

WITH canonical (code, label, sort_order) AS (
  VALUES
    ('phone_1_5', 'Phone 1-5 items', 1),
    ('phone_6_10', 'Phone 6-10 items', 2),
    ('phone_11_20', 'Phone 11-20 items', 3),
    ('phone_21_plus', 'Phone 21+ items', 4),
    ('f2f_1_5', 'Face to face 1-5 items', 5),
    ('f2f_6_10', 'Face to face 6-10 items', 6),
    ('f2f_11_20', 'Face to face 11-20 items', 7),
    ('f2f_21_plus', 'Face to face 21+ items', 8),
    ('home_1_5', 'Home 1-5 items', 9),
    ('home_6_10', 'Home 6-10 items', 10),
    ('home_11_20', 'Home 11-20 items', 11),
    ('home_21_plus', 'Home 21+ items', 12)
)
UPDATE lookup_values lv
SET label = canonical.label,
    sort_order = canonical.sort_order,
    active = true
FROM canonical
WHERE lv.domain = 'validation_type'
  AND lv.code = canonical.code;

COMMIT;
