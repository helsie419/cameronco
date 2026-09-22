-- Clean duplicate and misspelled lookup values introduced by the workbook
-- import. Existing claims keep their stored codes; inactive lookup values
-- simply stop appearing in dropdowns.

BEGIN;

-- Keep application/seed canonical codes active and hide duplicate workbook
-- aliases for the same visible choice.
UPDATE lookup_values
SET active = false
WHERE domain = 'assessment_type'
  AND code IN (
    'allianz_quote_request',
    'elders_quote_request',
    'crawford_quote_request',
    'cunningham_and_lindsay_quote_request',
    'ivaa_quote_request'
  );

UPDATE lookup_values
SET label = CASE code
  WHEN 'qbe_quote' THEN 'QBE quote request'
  WHEN 'allianz_quote' THEN 'Allianz quote request'
  WHEN 'elders_quote' THEN 'Elders quote request'
  WHEN 'crawford_quote' THEN 'Crawford quote request'
  WHEN 'cl_quote' THEN 'Cunningham & Lindsay quote request'
  WHEN 'ivaa_quote' THEN 'IVAA quote request'
  ELSE label
END
WHERE domain = 'assessment_type';

UPDATE lookup_values
SET active = false
WHERE domain = 'item_type'
  AND code IN (
    'costume_jewellery',
    'drop_e_rings',
    'e_rings',
    'hoop_e_rings',
    'necklace_and_pendant',
    'replace_copy_lost_e_ring',
    'stud_e_rings',
    'tie_pin_bar'
  );

UPDATE lookup_values
SET label = CASE code
  WHEN 'erings' THEN 'E/rings'
  WHEN 'drop_erings' THEN 'Drop e/rings'
  WHEN 'hoop_erings' THEN 'Hoop e/rings'
  WHEN 'stud_erings' THEN 'Stud e/rings'
  WHEN 'necklace_pendant' THEN 'Necklace & pendant'
  WHEN 'replace_copy_ering' THEN 'Replace (copy) lost e/ring'
  WHEN 'tie_pin' THEN 'Tie pin / bar'
  WHEN 'costume' THEN 'Costume jewellery'
  WHEN 'extra_items' THEN 'Extra item/s as advised'
  ELSE label
END
WHERE domain = 'item_type';

UPDATE lookup_values
SET active = false
WHERE domain = 'manufacture_origin'
  AND code IN ('local_manufacture', 'indian_manufacture');

UPDATE lookup_values
SET label = CASE code
  WHEN 'local' THEN 'Local manufacture'
  WHEN 'imported' THEN 'Imported'
  WHEN 'indian' THEN 'Indian manufacture'
  ELSE label
END
WHERE domain = 'manufacture_origin';

UPDATE lookup_values
SET active = false
WHERE domain = 'metal_colour'
  AND code IN ('2_tone', '3_tone');

UPDATE lookup_values
SET active = false
WHERE domain = 'metal_type'
  AND code IN (
    '18ct_w_g_with_platinum_setting',
    '18ct_y_g_with_platinum_setting',
    'gold_plated_base_metal'
  );

UPDATE lookup_values
SET label = CASE code
  WHEN 's_silver' THEN 'Sterling silver'
  WHEN 'gold_plated_stg_silver' THEN 'Gold plated sterling silver'
  WHEN '18ct_plat_setting_wg' THEN '18ct w/g with platinum setting'
  WHEN '18ct_plat_setting_yg' THEN '18ct y/g with platinum setting'
  ELSE label
END
WHERE domain = 'metal_type';

UPDATE lookup_values
SET active = false
WHERE domain = 'proof_type'
  AND code IN (
    'photo_3',
    'val',
    'desc',
    'rcpt',
    'existing_ring_3',
    'box_3'
  );

UPDATE lookup_values
SET label = CASE code
  WHEN 'valuation' THEN 'Valuation'
  WHEN 'description' THEN 'Description'
  WHEN 'receipt' THEN 'Receipt'
  WHEN 'stat_dec' THEN 'Statutory declaration'
  WHEN 'val_and_photo' THEN 'Valuation & photo'
  WHEN 'desc_and_photo' THEN 'Description & photo'
  WHEN 'insur_co_desc' THEN 'Insurer company description'
  ELSE label
END
WHERE domain = 'proof_type';

UPDATE lookup_values
SET active = false
WHERE domain = 'validation_type'
  AND (
    code IN (
      'phone_1_5_items',
      'phone_6_10_items',
      'phone_11_20_items',
      'phone_21_items',
      'face_to_face_1_5_items',
      'face_to_face_6_10_items',
      'face_to_face_11_20_items',
      'face_to_face_21_items',
      'home_1_5_items',
      'home_6_10_items',
      'home_11_20_items',
      'home_21_items'
    )
    OR code ~ '_(items_)?[0-9]+$'
  );

UPDATE lookup_values
SET label = CASE code
  WHEN 'phone_1_5' THEN 'Phone 1-5 items'
  WHEN 'phone_6_10' THEN 'Phone 6-10 items'
  WHEN 'phone_11_20' THEN 'Phone 11-20 items'
  WHEN 'phone_21_plus' THEN 'Phone 21+ items'
  WHEN 'f2f_1_5' THEN 'Face to face 1-5 items'
  WHEN 'f2f_6_10' THEN 'Face to face 6-10 items'
  WHEN 'f2f_11_20' THEN 'Face to face 11-20 items'
  WHEN 'f2f_21_plus' THEN 'Face to face 21+ items'
  WHEN 'home_1_5' THEN 'Home 1-5 items'
  WHEN 'home_6_10' THEN 'Home 6-10 items'
  WHEN 'home_11_20' THEN 'Home 11-20 items'
  WHEN 'home_21_plus' THEN 'Home 21+ items'
  ELSE label
END
WHERE domain = 'validation_type';

-- Known spelling and formatting corrections.
UPDATE lookup_values
SET label = 'Singapore twist'
WHERE domain = 'chain_style'
  AND code = 'singarore_twist';

UPDATE lookup_values
SET label = CASE code
  WHEN 'celon_sapphire' THEN 'Ceylon sapphire'
  WHEN 'marquisite' THEN 'Marquise'
  WHEN 'tahitan_black_pearl' THEN 'Tahitian black pearl'
  WHEN 'cubic_zirconia' THEN 'Cubic zirconia'
  WHEN 'cz' THEN 'Cubic zirconia'
  ELSE label
END
WHERE domain = 'stone_type';

UPDATE lookup_values
SET active = false
WHERE domain = 'stone_type'
  AND (label LIKE '%&%' OR code IN ('diamond_and', 'diamonds_and', 'cubic_zirconia'));

UPDATE lookup_values
SET label = CASE
  WHEN code LIKE 'micheal_kors%' THEN 'Michael Kors'
  WHEN code LIKE 'patek_phillipe%' THEN 'Patek Philippe'
  WHEN code LIKE 'iwc%' THEN 'IWC'
  WHEN code LIKE 'dkny%' THEN 'DKNY'
  WHEN code LIKE 'gc%' THEN 'GC'
  WHEN code LIKE 'jag%' THEN 'JAG'
  ELSE label
END
WHERE domain = 'watch_brand';

UPDATE lookup_values
SET label = CASE code
  WHEN 'quartz' THEN 'Quartz'
  WHEN 'quartz_chronoghraph' THEN 'Quartz chronograph'
  WHEN 'auto' THEN 'Automatic'
  WHEN 'auto_chronograph' THEN 'Automatic chronograph'
  WHEN 'manual' THEN 'Manual'
  ELSE label
END
WHERE domain = 'watch_description';

UPDATE lookup_values
SET label = CASE code
  WHEN 's_steel' THEN 'Stainless steel'
  WHEN 'gold_plate' THEN 'Gold plate'
  WHEN '2_tone' THEN '2 tone'
  WHEN 's_steel_leather_band' THEN 'Stainless steel leather band'
  WHEN 's_steel_gold_plate' THEN 'Stainless steel / gold plate'
  WHEN '9ct' THEN '9ct'
  WHEN '18ct' THEN '18ct'
  WHEN 'titanium' THEN 'Titanium'
  WHEN 'ceramic' THEN 'Ceramic'
  ELSE trim(trailing ',' FROM label)
END
WHERE domain = 'watch_metal';

UPDATE lookup_values
SET label = CASE code
  WHEN 'post_pack' THEN 'Post pack'
  WHEN 'intro' THEN 'Intro'
  WHEN 'left_a_message' THEN 'Left a message'
  WHEN 'missed_calls' THEN 'Missed calls'
  WHEN 'appt' THEN 'Appointment'
  WHEN 'return_docs' THEN 'Return documents'
  WHEN 'valuation' THEN 'Valuation'
  WHEN 'about_us' THEN 'About us'
  WHEN 'nsw_address_details' THEN 'NSW address details'
  WHEN 'contact_email' THEN 'Contact email'
  ELSE label
END
WHERE domain IN ('customer_message_template', 'insurer_note_template');

UPDATE lookup_values
SET label = 'Parcel received'
WHERE domain = 'customer_message_template'
  AND code = 'parel_received';

-- Generic cleanup for exact duplicates that were imported with numeric suffix
-- codes. The label equality guard avoids deactivating decimal values such as
-- 2.5 where the code naturally contains an underscore.
WITH suffixed_dupes AS (
  SELECT dup.id
  FROM lookup_values dup
  JOIN lookup_values base
    ON base.domain = dup.domain
   AND base.active = true
   AND base.code = regexp_replace(dup.code, '_[0-9]+$', '')
   AND lower(trim(base.label)) = lower(trim(dup.label))
  WHERE dup.active = true
    AND dup.code ~ '_[0-9]+$'
)
UPDATE lookup_values
SET active = false
WHERE id IN (SELECT id FROM suffixed_dupes);

-- A few aliases do not share the exact same label until after the curated
-- fixes above, so keep these explicit.
UPDATE lookup_values
SET active = false
WHERE domain = 'chain_style'
  AND code = 'flat_3';

UPDATE lookup_values
SET active = false
WHERE domain IN ('customer_message_template', 'insurer_note_template')
  AND code = 'post_pack_3';

-- Re-assert item type -> category metadata on the canonical active item types.
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
    ('necklace_pendant', 'pendants'),
    ('pendant', 'pendants'),
    ('locket', 'pendants'),
    ('pearl_strand', 'necklace'),
    ('erings', 'earrings'),
    ('drop_erings', 'earrings'),
    ('hoop_erings', 'earrings'),
    ('stud_erings', 'earrings'),
    ('replace_copy_ering', 'copy_ering'),
    ('replace_lost_diamond', 'repairs'),
    ('costume', 'brooch'),
    ('extra_items', 'brooch'),
    ('unable_to_quote', 'brooch')
)
UPDATE lookup_values lv
SET extra = COALESCE(lv.extra, '{}'::jsonb) || jsonb_build_object('category', item_type_category.category)
FROM item_type_category
WHERE lv.domain = 'item_type'
  AND lv.code = item_type_category.code;

COMMIT;
