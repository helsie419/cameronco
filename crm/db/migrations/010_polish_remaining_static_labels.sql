-- Polish remaining imported labels that still looked like raw spreadsheet data.

BEGIN;

UPDATE lookup_values
SET active = false
WHERE domain = 'item_type'
  AND code = 'extra_item_s_as_advised_by_customer';

UPDATE lookup_values
SET label = CASE code
  WHEN 'manufacture_type_handmade' THEN 'Handmade'
  WHEN 'manufacture_type_cast' THEN 'Cast'
  WHEN 'manufacture_type_hand_assembled' THEN 'Hand assembled'
  WHEN 'manufacture_type_imported_mass_produced' THEN 'Imported mass produced'
  WHEN 'manufacture_type_cad_cast' THEN 'CAD / cast'
  ELSE trim(both '()' FROM regexp_replace(label, '^manufacture type\s*:\s*', '', 'i'))
END
WHERE domain = 'manufacturing_type';

UPDATE lookup_values
SET label = 'QBE validation report'
WHERE domain = 'assessment_type'
  AND code = 'qbe_validation_report';

UPDATE lookup_values
SET label = 'Marc by Marc Jacobs'
WHERE domain = 'watch_brand'
  AND code = 'marc_by_marc_jacobs';

COMMIT;
