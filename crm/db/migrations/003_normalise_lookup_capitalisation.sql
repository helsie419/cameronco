-- Normalise all-caps labels imported from workbook dropdowns.
-- The original workbook values often use shouting caps; the CRM should display
-- readable labels while preserving domain-specific acronyms.

BEGIN;

UPDATE lookup_values
SET label =
  replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
  replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
  replace(replace(replace(
    initcap(lower(trim(regexp_replace(label, '\s+', ' ', 'g')))),
    'Aami', 'AAMI'),
    'Amp', 'AMP'),
    'Apia', 'APIA'),
    'Cad', 'CAD'),
    'Cl', 'CL'),
    'Cm', 'CM'),
    'Dcla', 'DCLA'),
    'Eoo', 'EOO'),
    'Eol', 'EOL'),
    'Gia', 'GIA'),
    'Gio', 'GIO'),
    'Gsl', 'GSL'),
    'Hrd', 'HRD'),
    'Igi', 'IGI'),
    'Ivaa', 'IVAA'),
    'Myi', 'MYI'),
    'Nsw', 'NSW'),
    'Poa', 'POA'),
    'Qbe', 'QBE'),
    'Rbc', 'RBC'),
    'Rrp', 'RRP'),
    'Sms', 'SMS'),
    'Vic', 'VIC')
WHERE active
  AND label = upper(label)
  AND label ~ '[A-Z]';

UPDATE lookup_values
SET label = replace(replace(replace(replace(label,
  'E/Rings', 'E/rings'),
  'E/Ring', 'E/ring'),
  'W/G', 'w/g'),
  'Y/G', 'y/g')
WHERE active;

-- Remove category duplicates/spelling mistakes created by merging seed values
-- with workbook values. Existing saved claims keep their stored codes; new
-- dropdowns should show only the canonical category choices.
UPDATE lookup_values
SET label = 'Copy E/ring'
WHERE domain = 'item_category' AND code IN ('copy_ering', 'copy_e_ring');

UPDATE lookup_values
SET label = 'Repairs / replace stone'
WHERE domain = 'item_category' AND code IN ('repairs', 'repairs_replace_stone');

UPDATE lookup_values
SET label = 'Belt'
WHERE domain = 'item_category' AND code IN ('belt', 'blet');

UPDATE lookup_values
SET active = false
WHERE domain = 'item_category'
  AND code IN ('copy_e_ring', 'repairs_replace_stone', 'blet');

WITH item_type_category (code, category) AS (
  VALUES
    ('engagement_ring', 'rings'),
    ('wedding_ring', 'rings'),
    ('eternity_ring', 'rings'),
    ('dress_ring', 'rings'),
    ('signet_ring', 'rings'),
    ('watch', 'watches'),
    ('bangle', 'bangle'),
    ('golf_bangle', 'bangle'),
    ('bracelet', 'bangle'),
    ('padlock_bracelet', 'bangle'),
    ('brooch', 'brooch'),
    ('necklace', 'necklace'),
    ('necklace_and_pendant', 'pendants'),
    ('pendant', 'pendants'),
    ('locket', 'pendants'),
    ('pearl_strand', 'necklace'),
    ('e_rings', 'earrings'),
    ('erings', 'earrings'),
    ('drop_e_rings', 'earrings'),
    ('drop_erings', 'earrings'),
    ('hoop_e_rings', 'earrings'),
    ('hoop_erings', 'earrings'),
    ('stud_e_rings', 'earrings'),
    ('stud_erings', 'earrings'),
    ('replace_copy_lost_e_ring', 'copy_ering'),
    ('replace_copy_ering', 'copy_ering'),
    ('replace_lost_diamond', 'repairs'),
    ('costume_jewellery', 'brooch'),
    ('costume', 'brooch')
)
UPDATE lookup_values lv
SET extra = COALESCE(lv.extra, '{}'::jsonb) || jsonb_build_object('category', item_type_category.category)
FROM item_type_category
WHERE lv.domain = 'item_type'
  AND lv.code = item_type_category.code;

COMMIT;
