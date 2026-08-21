-- ============================================================================
-- CAMERON & CO — SEED DATA
-- Values lifted from the Lists / Reference tabs of the assessment and job
-- sheet workbooks. Run after schema.sql. Safe to re-run (ON CONFLICT skips).
-- ============================================================================

BEGIN;

-- --------------------------- STAFF (CRM MVP owners) -------------------------
INSERT INTO staff (full_name, role, branch) VALUES
  ('Tracey',   'assessor', 'melbourne'),
  ('April',    'assessor', 'sydney'),
  ('Workshop', 'workshop', 'melbourne'),
  ('Admin',    'admin',    'melbourne')
ON CONFLICT (full_name) DO NOTHING;

-- --------------------------- INSURERS (Lists tab) ---------------------------
INSERT INTO insurers (name, claims_email, assessment_format) VALUES
  ('AAMI Home Claims',      'nswhomepro@aami.com.au',      'GENERIC'),
  ('AAMI Travel',           'travelclaims@aami.com.au',    'GENERIC'),
  ('AMP IPI Home Claims',   'platinumclaims@amp.com.au',   'GENERIC'),
  ('APIA',                  'nsw_mail@apia.com.au',        'GENERIC'),
  ('GIO Insurance',         'vendorclaims@vero.com.au',    'GENERIC'),
  ('Suncorp Metway',        'vendorclaims@suncorp.com.au', 'GENERIC'),
  ('Vero',                  'vendorclaims@vero.com.au',    'GENERIC'),
  ('Vero Travel',           'travelclaims@vero.com.au',    'GENERIC'),
  ('MYI Freemans',          'sydney@myifreemans.com.au',   'GENERIC'),
  ('QBE',                    NULL,                         'QBE'),
  ('Allianz',                NULL,                         'ALLIANZ'),
  ('Elders',                 NULL,                         'ELDERS'),
  ('Crawford',               NULL,                         'CRAWFORD'),
  ('Cunningham & Lindsay',   NULL,                         'CL'),
  ('IVAA',                   NULL,                         'IVAA')
ON CONFLICT (name) DO NOTHING;

-- --------------------------- LOOKUPS ----------------------------------------
-- Item categories (Q Sheet CAT column)
INSERT INTO lookup_values (domain, code, label, sort_order) VALUES
  ('item_category','earrings','Earrings',1),
  ('item_category','bangle','Bangle',2),
  ('item_category','brooch','Brooch',3),
  ('item_category','copy_ering','Copy E/ring',4),
  ('item_category','pendants','Pendants',5),
  ('item_category','repairs','Repairs / replace stone',6),
  ('item_category','rings','Rings',7),
  ('item_category','watches','Watches',8),
  ('item_category','necklace','Necklace',9),
  ('item_category','belt','Belt',10)
ON CONFLICT (domain, code) DO NOTHING;

-- Item types (Reference tab "Item" column)
INSERT INTO lookup_values (domain, code, label, sort_order) VALUES
  ('item_type','engagement_ring','Engagement ring',1),
  ('item_type','wedding_ring','Wedding ring',2),
  ('item_type','eternity_ring','Eternity ring',3),
  ('item_type','dress_ring','Dress ring',4),
  ('item_type','signet_ring','Signet ring',5),
  ('item_type','watch','Watch',6),
  ('item_type','bangle','Bangle',7),
  ('item_type','golf_bangle','Golf bangle',8),
  ('item_type','bracelet','Bracelet',9),
  ('item_type','padlock_bracelet','Padlock bracelet',10),
  ('item_type','necklace','Necklace',11),
  ('item_type','necklace_pendant','Necklace & pendant',12),
  ('item_type','pendant','Pendant',13),
  ('item_type','locket','Locket',14),
  ('item_type','erings','E/rings',15),
  ('item_type','drop_erings','Drop e/rings',16),
  ('item_type','hoop_erings','Hoop e/rings',17),
  ('item_type','stud_erings','Stud e/rings',18),
  ('item_type','pearl_strand','Pearl strand',19),
  ('item_type','anklet','Anklet',20),
  ('item_type','tie_pin','Tie pin / bar',21),
  ('item_type','cufflinks','Cufflinks',22),
  ('item_type','brooch','Brooch',23),
  ('item_type','costume','Costume jewellery',24),
  ('item_type','replace_lost_diamond','Replace lost diamond',25),
  ('item_type','replace_copy_ering','Replace (copy) lost e/ring',26),
  ('item_type','extra_items','Extra item/s as advised',27),
  ('item_type','unable_to_quote','Unable to quote',28)
ON CONFLICT (domain, code) DO NOTHING;

-- Metal types (Reference tab)
INSERT INTO lookup_values (domain, code, label, sort_order) VALUES
  ('metal_type','9ct','9ct',1),
  ('metal_type','10ct','10ct',2),
  ('metal_type','14ct','14ct',3),
  ('metal_type','18ct','18ct',4),
  ('metal_type','21ct','21ct',5),
  ('metal_type','22ct','22ct',6),
  ('metal_type','24ct','24ct',7),
  ('metal_type','platinum','Platinum',8),
  ('metal_type','18ct_plat_setting_yg','18ct y/g with platinum setting',9),
  ('metal_type','18ct_plat_setting_wg','18ct w/g with platinum setting',10),
  ('metal_type','sterling_silver','Sterling silver',11),
  ('metal_type','stainless_steel','Stainless steel',12),
  ('metal_type','base_metal','Base metal',13),
  ('metal_type','gold_plated_base','Gold plated base metal',14),
  ('metal_type','gold_plated_silver','Gold plated sterling silver',15),
  ('metal_type','not_sure','Not sure',16)
ON CONFLICT (domain, code) DO NOTHING;

-- Metal colours
INSERT INTO lookup_values (domain, code, label, sort_order) VALUES
  ('metal_colour','yellow_gold','Yellow gold',1),
  ('metal_colour','white_gold','White gold',2),
  ('metal_colour','rose_gold','Rose gold',3),
  ('metal_colour','two_tone','2 tone',4),
  ('metal_colour','three_tone','3 tone',5)
ON CONFLICT (domain, code) DO NOTHING;

-- Manufacture origin
INSERT INTO lookup_values (domain, code, label, sort_order) VALUES
  ('manufacture_origin','local','Local manufacture',1),
  ('manufacture_origin','imported','Imported',2),
  ('manufacture_origin','indian','Indian manufacture',3)
ON CONFLICT (domain, code) DO NOTHING;

-- Proof / evidence types (Lists tab PROOF column)
INSERT INTO lookup_values (domain, code, label, sort_order) VALUES
  ('proof_type','photo','Photo',1),
  ('proof_type','valuation','Valuation',2),
  ('proof_type','description','Description',3),
  ('proof_type','receipt','Receipt',4),
  ('proof_type','stat_dec','Statutory declaration',5),
  ('proof_type','warranty','Warranty',6),
  ('proof_type','box','Box',7),
  ('proof_type','existing_ring','Existing ring',8),
  ('proof_type','existing_earring','Existing earring',9),
  ('proof_type','nil','Nil',10)
ON CONFLICT (domain, code) DO NOTHING;

-- Validation types (Lists tab VALID TYPE column)
INSERT INTO lookup_values (domain, code, label, sort_order) VALUES
  ('validation_type','phone_1_5','Phone 1–5 items',1),
  ('validation_type','phone_6_10','Phone 6–10 items',2),
  ('validation_type','phone_11_20','Phone 11–20 items',3),
  ('validation_type','phone_21_plus','Phone 21+ items',4),
  ('validation_type','f2f_1_5','Face to face 1–5 items',5),
  ('validation_type','f2f_6_10','Face to face 6–10 items',6),
  ('validation_type','f2f_11_20','Face to face 11–20 items',7),
  ('validation_type','f2f_21_plus','Face to face 21+ items',8),
  ('validation_type','home_1_5','Home 1–5 items',9),
  ('validation_type','home_6_10','Home 6–10 items',10),
  ('validation_type','home_11_20','Home 11–20 items',11),
  ('validation_type','home_21_plus','Home 21+ items',12)
ON CONFLICT (domain, code) DO NOTHING;

-- Assessment types (Reference tab)
INSERT INTO lookup_values (domain, code, label, sort_order) VALUES
  ('assessment_type','assessment_request','Assessment request',1),
  ('assessment_type','quote_request','Quote request',2),
  ('assessment_type','report','Report',3),
  ('assessment_type','qbe_quote','QBE quote request',4),
  ('assessment_type','allianz_quote','Allianz quote request',5),
  ('assessment_type','elders_quote','Elders quote request',6),
  ('assessment_type','crawford_quote','Crawford quote request',7),
  ('assessment_type','cl_quote','Cunningham & Lindsay quote request',8),
  ('assessment_type','ivaa_quote','IVAA quote request',9)
ON CONFLICT (domain, code) DO NOTHING;

-- Stone types / shapes / qualities
INSERT INTO lookup_values (domain, code, label, sort_order) VALUES
  ('stone_type','diamond','Diamond',1),
  ('stone_type','sapphire','Sapphire',2),
  ('stone_type','ruby','Ruby',3),
  ('stone_type','emerald','Emerald',4),
  ('stone_type','opal','Opal',5),
  ('stone_type','pearl','Pearl',6),
  ('stone_type','amethyst','Amethyst',7),
  ('stone_type','topaz','Topaz',8),
  ('stone_type','cz','Cubic zirconia',9),
  ('stone_type','other','Other',10)
ON CONFLICT (domain, code) DO NOTHING;

INSERT INTO lookup_values (domain, code, label, sort_order) VALUES
  ('stone_shape','rbc','RBC (round brilliant)',1),
  ('stone_shape','princess','Princess',2),
  ('stone_shape','oval','Oval',3),
  ('stone_shape','emerald_cut','Emerald cut',4),
  ('stone_shape','pear','Pear',5),
  ('stone_shape','marquise','Marquise',6),
  ('stone_shape','cushion','Cushion',7),
  ('stone_shape','baguette','Baguette',8),
  ('stone_shape','heart','Heart',9),
  ('stone_shape','cabochon','Cabochon',10)
ON CONFLICT (domain, code) DO NOTHING;

INSERT INTO lookup_values (domain, code, label, sort_order) VALUES
  ('stone_quality','d_if','D/IF',1),
  ('stone_quality','f_vs','F/VS',2),
  ('stone_quality','g_vs','G/VS',3),
  ('stone_quality','g_si','G/SI',4),
  ('stone_quality','h_si','H/SI',5),
  ('stone_quality','i_si','I/SI',6),
  ('stone_quality','j_p1','J/P1',7),
  ('stone_quality','commercial','Commercial',8)
ON CONFLICT (domain, code) DO NOTHING;

-- --------------------------- RATE CARDS -------------------------------------
-- From the Ring / Chain calculators on the item sheets.
INSERT INTO rate_cards (code, label, category, metal_type, origin, rate, unit) VALUES
  -- Chain calculator ($/gm retail basis)
  ('CHAIN_9CT_LOCAL',     'Chain 9ct local',            'chain_per_gm', '9ct',    'local',    115, 'gm'),
  ('CHAIN_9CT_IMPORTED',  'Chain 9ct imported',         'chain_per_gm', '9ct',    'imported', 145, 'gm'),
  ('CHAIN_14CT_LOCAL',    'Chain 14ct local',           'chain_per_gm', '14ct',   'local',    220, 'gm'),
  ('CHAIN_14CT_IMPORTED', 'Chain 14ct imported',        'chain_per_gm', '14ct',   'imported', 235, 'gm'),
  ('CHAIN_18CT_LOCAL',    'Chain 18ct local',           'chain_per_gm', '18ct',   'local',    260, 'gm'),
  ('CHAIN_18CT_IMPORTED', 'Chain 18ct imported',        'chain_per_gm', '18ct',   'imported', 300, 'gm'),
  -- Earring / charms / religious ($/gm, imported)
  ('EARR_9CT_IMPORTED',   'Earring/charm 9ct imported', 'earring_charm_per_gm', '9ct',     'imported', 145, 'gm'),
  ('EARR_18CT_IMPORTED',  'Earring/charm 18ct imported','earring_charm_per_gm', '18ct',    'imported', 300, 'gm'),
  ('EARR_22CT_IMPORTED',  'Earring/charm 21–22ct imp.', 'earring_charm_per_gm', '21-22ct', 'imported', 260, 'gm'),
  -- Ring calculator: manufacturing
  ('MFG_GOLD_9CT',        'Manufacturing gold 9ct',     'mfg_gold_per_gm', '9ct',  NULL, 45,  'gm'),
  ('MFG_GOLD_18CT',       'Manufacturing gold 18ct',    'mfg_gold_per_gm', '18ct', NULL, 100, 'gm'),
  ('SETTING_GRAIN',       'Setting — grain',            'setting_per_stone', NULL, NULL, 4,   'pc'),
  ('SETTING_PAVE',        'Setting — pavé',             'setting_per_stone', NULL, NULL, 6,   'pc'),
  ('SETTING_CLAW',        'Setting — claw',             'setting_per_stone', NULL, NULL, 8,   'pc'),
  ('SETTING_SMALL',       'Setting — small stone point', 'setting_per_stone', NULL, NULL, 13,  'pc'),
  ('SETTING_MID',         'Setting — mid-size stone',   'setting_per_stone', NULL, NULL, 20,  'pc'),
  ('SETTING_LARGE',       'Setting — large stone (up to 1ct)', 'setting_per_stone', NULL, NULL, 40, 'pc'),
  ('CASTING',             'Casting',                    'casting',           NULL, NULL, 5,   'pc'),
  ('LABOUR',              'Labour (per hour)',          'labour_per_hr',     NULL, NULL, 65,  'hr'),
  ('BOX_VALUATION',       'Box & valuation',            'box_valuation',     NULL, NULL, 26,  'pc'),
  -- Default retail markup on manufactured cost (adjust to actual practice)
  ('RETAIL_MARKUP',       'Retail markup multiplier',   'markup',            NULL, NULL, 2.75,'pc')
ON CONFLICT (code) WHERE effective_to IS NULL DO NOTHING;

-- --------------------------- WATCH BRAND RATES ------------------------------
-- Sample from the WATCHES reference tab. insurer_id NULL = "Shop Sales"
-- (retail / non-insurance) default rate. Add more brands/insurers as needed —
-- this is illustrative of the real spreadsheet's shape, not the full list.
DO $$
DECLARE
  suncorp_id BIGINT; allianz_id BIGINT;
BEGIN
  SELECT id INTO suncorp_id FROM insurers WHERE name = 'Suncorp Metway';
  SELECT id INTO allianz_id FROM insurers WHERE name = 'Allianz';

  INSERT INTO watch_brand_rates (brand, insurer_id, rate_type, rate_value) VALUES
    ('Rolex',     suncorp_id, 'discount_pct', 0.05),
    ('Rolex',     allianz_id, 'poa',          NULL),
    ('Rolex',     NULL,       'poa',          NULL),
    ('Omega',     suncorp_id, 'discount_pct', 0.22),
    ('Omega',     allianz_id, 'discount_pct', 0.15),
    ('Omega',     NULL,       'discount_pct', 0.10),
    ('Tag Heuer', suncorp_id, 'discount_pct', 0.26),
    ('Tag Heuer', allianz_id, 'discount_pct', 0.26),
    ('Tag Heuer', NULL,       'discount_pct', 0.25),
    ('Citizen',   suncorp_id, 'discount_pct', 0.40),
    ('Citizen',   allianz_id, 'discount_pct', 0.35),
    ('Citizen',   NULL,       'discount_pct', 0.30),
    ('Seiko',     suncorp_id, 'discount_pct', 0.40),
    ('Seiko',     allianz_id, 'discount_pct', 0.35),
    ('Seiko',     NULL,       'discount_pct', 0.30),
    ('Casio',     suncorp_id, 'discount_pct', 0.36),
    ('Casio',     allianz_id, 'discount_pct', 0.33),
    ('Casio',     NULL,       'discount_pct', 0.30)
  ON CONFLICT (brand, (COALESCE(insurer_id, -1))) WHERE effective_to IS NULL DO NOTHING;
END $$;

COMMIT;
