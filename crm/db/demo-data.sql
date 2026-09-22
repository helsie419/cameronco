-- ============================================================================
-- CAMERON & CO — CLIENT DEMO DATA
-- Replaces whatever dev/test junk is in the transactional tables with a
-- believable, coherent dataset that walks the full lifecycle (enquiry ->
-- assessing -> internal review -> sent -> approved -> in production ->
-- completed & paid), across both insurance and private work, for a live
-- client demo. Reference data (staff, insurers, lookups, rate cards,
-- watch brand rates, metal prices) is left untouched.
--
-- Safe to re-run: truncates the transactional tables first.
-- Run after schema.sql + seed.sql have already been applied once.
-- ============================================================================

BEGIN;

TRUNCATE TABLE
  activity_log, invoices, job_components, jobs, documents, claim_notes,
  item_costings, item_stones, claim_items, quotes, claims, customers,
  stock_items
RESTART IDENTITY CASCADE;

-- ----------------------------------------------------------------------------
-- CUSTOMERS
-- ----------------------------------------------------------------------------
INSERT INTO customers (first_name, last_name, email, mobile, address_line1, suburb, state, postcode, customer_type, consent_marketing, consent_email, consent_sms) VALUES
  ('Sarah',   'Mitchell', 'sarah.mitchell82@gmail.com',   '0412 345 678', '12 Toorak Rd',    'South Yarra', 'VIC', '3141', 'insurance', TRUE,  TRUE,  FALSE),
  ('James',   'Chen',     'jchen.sydney@outlook.com',     '0423 456 789', '45 Pitt St',      'Sydney',      'NSW', '2000', 'insurance', FALSE, TRUE,  TRUE),
  ('Priya',   'Nair',     'priya.nair@bigpond.com',       '0434 567 890', '8 Glenferrie Rd', 'Malvern',     'VIC', '3144', 'insurance', TRUE,  TRUE,  FALSE),
  ('David',   'O''Connor','d.oconnor@icloud.com',         '0445 678 901', '22 Military Rd',  'Mosman',      'NSW', '2088', 'insurance', FALSE, TRUE,  FALSE),
  ('Emma',    'Ferguson', 'emma.ferguson@hotmail.com',    '0456 789 012', '5 Church St',     'Brighton',    'VIC', '3186', 'insurance', TRUE,  TRUE,  TRUE),
  ('Grace',   'Thompson', 'grace.thompson@gmail.com',     '0467 890 123', '90 High St',      'Armadale',    'VIC', '3143', 'insurance', TRUE,  TRUE,  FALSE),
  ('Michael', 'Bianchi',  'mbianchi@gmail.com',           '0478 901 234', '3 King St',       'Newtown',     'NSW', '2042', 'private',   TRUE,  TRUE,  TRUE),
  ('Rebecca', 'Hale',     'rebecca.hale@gmail.com',       '0489 012 345', '15 Domain Rd',    'South Yarra', 'VIC', '3141', 'insurance', FALSE, TRUE,  FALSE);

-- ----------------------------------------------------------------------------
-- CLAIM A — Sarah Mitchell / QBE — just in, no quote yet
-- ----------------------------------------------------------------------------
INSERT INTO claims (claim_number, our_ref, customer_id, insurer_id, branch, assessment_type, validation_type, date_received, assigned_to, status, excess_amount)
SELECT 'QBE-2504821', 'CC-1821',
       (SELECT id FROM customers WHERE email = 'sarah.mitchell82@gmail.com'),
       (SELECT id FROM insurers WHERE name = 'QBE'),
       'melbourne', 'qbe_quote', 'phone_1_5', CURRENT_DATE - INTERVAL '4 days',
       (SELECT id FROM staff WHERE full_name = 'Tracey'), 'new_enquiry', 500.00;

INSERT INTO claim_items (claim_id, item_no, category, item_type, description, metal_type, metal_colour, weight_gms, finger_size, proof_type, eoo_status, policy_limit, status)
SELECT (SELECT id FROM claims WHERE claim_number = 'QBE-2504821'), 1,
       'rings', 'engagement_ring', '18ct white gold solitaire engagement ring, oval diamond',
       '18ct', 'white_gold', 4.5, 'M', 'val_and_photo', 'satisfactory', 15000.00, 'draft';

INSERT INTO item_stones (claim_item_id, stone_type, shape, stone_count, carat_each, total_carat, quality, certificate, cost_per_carat, cost)
SELECT (SELECT id FROM claim_items WHERE claim_id = (SELECT id FROM claims WHERE claim_number = 'QBE-2504821') AND item_no = 1),
       'diamond', 'oval_cut', 1, 1.20, 1.20, 'F/VS1', 'GIA 2201847739', 8500.00, 10200.00;

INSERT INTO claim_notes (claim_id, staff_id, note_type, note)
SELECT (SELECT id FROM claims WHERE claim_number = 'QBE-2504821'), (SELECT id FROM staff WHERE full_name = 'Tracey'),
       'customer_discussion', 'Ring lost while travelling overseas. Customer has the original GIA certificate and a recent valuation on file — sighted both.';

-- ----------------------------------------------------------------------------
-- CLAIM B — James Chen / Allianz — being assessed, waiting on documents
-- ----------------------------------------------------------------------------
INSERT INTO claims (claim_number, our_ref, customer_id, insurer_id, branch, assessment_type, validation_type, date_received, assigned_to, status, excess_amount)
SELECT 'ALZ-8834', 'CC-1798',
       (SELECT id FROM customers WHERE email = 'jchen.sydney@outlook.com'),
       (SELECT id FROM insurers WHERE name = 'Allianz'),
       'sydney', 'allianz_quote', 'f2f_1_5', CURRENT_DATE - INTERVAL '10 days',
       (SELECT id FROM staff WHERE full_name = 'April Jeffrey'), 'assessing', 250.00;

INSERT INTO claim_items (claim_id, item_no, category, item_type, description, metal_type, metal_colour, weight_gms, proof_type, eoo_status, eoo_notes, policy_limit, status)
SELECT (SELECT id FROM claims WHERE claim_number = 'ALZ-8834'), 1,
       'earrings', 'drop_erings', '18ct yellow gold diamond drop earrings, pair',
       '18ct', 'yellow_gold', 3.1, 'description', 'limited_eoo', 'Customer has photos but no formal valuation yet — requested, following up.', 6000.00, 'draft';

INSERT INTO item_stones (claim_item_id, stone_type, shape, stone_count, carat_each, total_carat, quality, cost_per_carat, cost)
SELECT (SELECT id FROM claim_items WHERE claim_id = (SELECT id FROM claims WHERE claim_number = 'ALZ-8834') AND item_no = 1),
       'diamond', 'round_brilliant', 2, 0.35, 0.70, 'G/SI1', 3200.00, 2240.00;

INSERT INTO claim_notes (claim_id, staff_id, note_type, note)
SELECT (SELECT id FROM claims WHERE claim_number = 'ALZ-8834'), (SELECT id FROM staff WHERE full_name = 'April Jeffrey'),
       'internal', 'Waiting on updated valuation from customer before quoting. Chasing again Friday.';

-- ----------------------------------------------------------------------------
-- CLAIM C — Priya Nair / AAMI — quote drafted, waiting on internal review
-- ----------------------------------------------------------------------------
INSERT INTO claims (claim_number, our_ref, customer_id, insurer_id, branch, assessment_type, validation_type, date_received, assigned_to, status, excess_amount)
SELECT 'AAMI-55201', 'CC-1745',
       (SELECT id FROM customers WHERE email = 'priya.nair@bigpond.com'),
       (SELECT id FROM insurers WHERE name = 'AAMI Home Claims'),
       'melbourne', 'assessment_request', 'phone_6_10', CURRENT_DATE - INTERVAL '14 days',
       (SELECT id FROM staff WHERE full_name = 'Heather Yeoman'), 'pending_approval', 300.00;

INSERT INTO claim_items (claim_id, item_no, category, item_type, description, metal_type, metal_colour, weight_gms, proof_type, eoo_status, policy_limit, retail_price, insurance_nett, status)
SELECT (SELECT id FROM claims WHERE claim_number = 'AAMI-55201'), 1,
       'pendants', 'pendant', '18ct yellow gold diamond pendant on chain',
       '18ct', 'yellow_gold', 2.8, 'photo', 'satisfactory', 3000.00, 2650.00, 1850.00, 'quoted';

INSERT INTO item_stones (claim_item_id, stone_type, shape, stone_count, carat_each, total_carat, quality, cost_per_carat, cost)
SELECT (SELECT id FROM claim_items WHERE claim_id = (SELECT id FROM claims WHERE claim_number = 'AAMI-55201') AND item_no = 1),
       'diamond', 'round_brilliant', 1, 0.50, 0.50, 'H/SI1', 2600.00, 1300.00;

INSERT INTO item_costings (claim_item_id, line_no, cost_type, description, qty, unit, rate, amount)
SELECT id, 1, 'stone', 'Diamond 0.50ct H/SI1', 1, 'pc', 1300.00, 1300.00 FROM claim_items WHERE claim_id = (SELECT id FROM claims WHERE claim_number = 'AAMI-55201') AND item_no = 1
UNION ALL SELECT id, 2, 'gold', '18ct yellow gold, 2.8gm', 2.8, 'gm', 80.00, 224.00 FROM claim_items WHERE claim_id = (SELECT id FROM claims WHERE claim_number = 'AAMI-55201') AND item_no = 1
UNION ALL SELECT id, 3, 'setting', 'Claw setting', 1, 'pc', 8.00, 8.00 FROM claim_items WHERE claim_id = (SELECT id FROM claims WHERE claim_number = 'AAMI-55201') AND item_no = 1
UNION ALL SELECT id, 4, 'labour', 'Manufacture, 3hr', 3, 'hr', 65.00, 195.00 FROM claim_items WHERE claim_id = (SELECT id FROM claims WHERE claim_number = 'AAMI-55201') AND item_no = 1
UNION ALL SELECT id, 5, 'box_valuation', 'Box & valuation', 1, 'pc', 26.00, 26.00 FROM claim_items WHERE claim_id = (SELECT id FROM claims WHERE claim_number = 'AAMI-55201') AND item_no = 1;

INSERT INTO quotes (claim_id, version, status, total_retail, total_nett, total_liability, created_by)
SELECT (SELECT id FROM claims WHERE claim_number = 'AAMI-55201'), 1, 'draft', 2650.00, 1850.00, 1850.00,
       (SELECT id FROM staff WHERE full_name = 'Heather Yeoman');

-- ----------------------------------------------------------------------------
-- CLAIM D — David O'Connor / Suncorp — quote reviewed & sent, awaiting decision
-- ----------------------------------------------------------------------------
INSERT INTO claims (claim_number, our_ref, customer_id, insurer_id, branch, assessment_type, validation_type, date_received, assigned_to, status, excess_amount)
SELECT 'SUN-77410', 'CC-1690',
       (SELECT id FROM customers WHERE email = 'd.oconnor@icloud.com'),
       (SELECT id FROM insurers WHERE name = 'Suncorp Metway'),
       'sydney', 'quote_request', 'phone_11_20', CURRENT_DATE - INTERVAL '18 days',
       (SELECT id FROM staff WHERE full_name = 'Rob Venus'), 'quote_sent', 500.00;

INSERT INTO claim_items (claim_id, item_no, category, item_type, description, watch_make, watch_gents_ladies, watch_current_model, watch_metal, proof_type, eoo_status, policy_limit, retail_price, insurance_nett, status)
SELECT (SELECT id FROM claims WHERE claim_number = 'SUN-77410'), 1,
       'watches', 'watch', 'Omega Seamaster Diver 300M, stainless steel',
       'Omega', 'gents', 'Seamaster Diver 300M', 'stainless_steel',
       'receipt', 'satisfactory', 6500.00, 5800.00, 4200.00, 'quoted';

INSERT INTO item_costings (claim_item_id, line_no, cost_type, description, qty, unit, rate, amount)
SELECT id, 1, 'other', 'Replacement watch, supplier quote', 1, 'pc', 4200.00, 4200.00 FROM claim_items WHERE claim_id = (SELECT id FROM claims WHERE claim_number = 'SUN-77410') AND item_no = 1;

INSERT INTO quotes (claim_id, version, status, total_retail, total_nett, total_liability, created_by, reviewed_by, reviewed_at, sent_at)
SELECT (SELECT id FROM claims WHERE claim_number = 'SUN-77410'), 1, 'sent', 5800.00, 4200.00, 4200.00,
       (SELECT id FROM staff WHERE full_name = 'Rob Venus'), (SELECT id FROM staff WHERE full_name = 'Mark Laver'),
       now() - INTERVAL '3 days', now() - INTERVAL '3 days';

INSERT INTO claim_notes (claim_id, staff_id, note_type, note)
SELECT (SELECT id FROM claims WHERE claim_number = 'SUN-77410'), (SELECT id FROM staff WHERE full_name = 'Rob Venus'),
       'insurer', 'Quote sent to claims handler 3 days ago. Following up early next week if no response.';

-- ----------------------------------------------------------------------------
-- CLAIM E — Emma Ferguson / QBE — approved, job just created
-- ----------------------------------------------------------------------------
INSERT INTO claims (claim_number, our_ref, customer_id, insurer_id, branch, assessment_type, validation_type, date_received, assigned_to, status, excess_amount)
SELECT 'QBE-2503190', 'CC-1602',
       (SELECT id FROM customers WHERE email = 'emma.ferguson@hotmail.com'),
       (SELECT id FROM insurers WHERE name = 'QBE'),
       'melbourne', 'qbe_quote', 'phone_1_5', CURRENT_DATE - INTERVAL '25 days',
       (SELECT id FROM staff WHERE full_name = 'Tracey'), 'approved', 500.00;

INSERT INTO claim_items (claim_id, item_no, category, item_type, description, metal_type, metal_colour, weight_gms, finger_size, proof_type, eoo_status, fulfilment, policy_limit, retail_price, insurance_nett, status)
SELECT (SELECT id FROM claims WHERE claim_number = 'QBE-2503190'), 1,
       'rings', 'dress_ring', '18ct rose gold dress ring, oval sapphire',
       '18ct', 'rose_gold', 5.2, 'L', 'val_and_photo', 'satisfactory', 'supply', 4500.00, 4400.00, 3200.00, 'approved';

INSERT INTO item_stones (claim_item_id, stone_type, shape, stone_count, carat_each, total_carat, quality, cost_per_carat, cost)
SELECT (SELECT id FROM claim_items WHERE claim_id = (SELECT id FROM claims WHERE claim_number = 'QBE-2503190') AND item_no = 1),
       'sapphire', 'oval_cut', 1, 1.80, 1.80, 'AA', 950.00, 1710.00;

INSERT INTO quotes (claim_id, version, status, total_retail, total_nett, total_liability, created_by, reviewed_by, reviewed_at, sent_at, decided_at)
SELECT (SELECT id FROM claims WHERE claim_number = 'QBE-2503190'), 1, 'approved', 4400.00, 3200.00, 3200.00,
       (SELECT id FROM staff WHERE full_name = 'Tracey'), (SELECT id FROM staff WHERE full_name = 'Mark Laver'),
       now() - INTERVAL '20 days', now() - INTERVAL '20 days', now() - INTERVAL '15 days';

INSERT INTO jobs (claim_id, quote_id, job_number, start_date, owner_id, stage)
SELECT (SELECT id FROM claims WHERE claim_number = 'QBE-2503190'),
       (SELECT id FROM quotes WHERE claim_id = (SELECT id FROM claims WHERE claim_number = 'QBE-2503190')),
       'J-1001', CURRENT_DATE - INTERVAL '14 days', (SELECT id FROM staff WHERE full_name = 'Workshop'), 'awaiting_deposit';

INSERT INTO job_components (job_id, claim_item_id, category, colour, description, weight_gms)
SELECT j.id, ci.id, 'rings', 'rose_gold', '18ct rose gold dress ring, oval sapphire', 5.2
FROM jobs j, claim_items ci
WHERE j.job_number = 'J-1001' AND ci.claim_id = (SELECT id FROM claims WHERE claim_number = 'QBE-2503190') AND ci.item_no = 1;

-- ----------------------------------------------------------------------------
-- CLAIM F — Rebecca Hale / Allianz — in production, partly costed
-- ----------------------------------------------------------------------------
INSERT INTO claims (claim_number, our_ref, customer_id, insurer_id, branch, assessment_type, validation_type, date_received, assigned_to, status, excess_amount)
SELECT 'ALZ-9012', 'CC-1488',
       (SELECT id FROM customers WHERE email = 'rebecca.hale@gmail.com'),
       (SELECT id FROM insurers WHERE name = 'Allianz'),
       'melbourne', 'allianz_quote', 'phone_1_5', CURRENT_DATE - INTERVAL '35 days',
       (SELECT id FROM staff WHERE full_name = 'April Jeffrey'), 'in_production', 400.00;

INSERT INTO claim_items (claim_id, item_no, category, item_type, description, metal_type, metal_colour, weight_gms, finger_size, proof_type, eoo_status, fulfilment, policy_limit, retail_price, insurance_nett, status)
SELECT (SELECT id FROM claims WHERE claim_number = 'ALZ-9012'), 1,
       'rings', 'eternity_ring', '18ct white gold diamond eternity ring, full hoop',
       '18ct', 'white_gold', 4.0, 'N', 'val_and_photo', 'satisfactory', 'supply', 7500.00, 6900.00, 5100.00, 'in_production';

INSERT INTO item_stones (claim_item_id, stone_type, shape, stone_count, carat_each, total_carat, quality, cost_per_carat, cost)
SELECT (SELECT id FROM claim_items WHERE claim_id = (SELECT id FROM claims WHERE claim_number = 'ALZ-9012') AND item_no = 1),
       'diamond', 'round_brilliant', 18, 0.07, 1.26, 'G/VS2', 2100.00, 2646.00;

INSERT INTO quotes (claim_id, version, status, total_retail, total_nett, total_liability, created_by, reviewed_by, reviewed_at, sent_at, decided_at)
SELECT (SELECT id FROM claims WHERE claim_number = 'ALZ-9012'), 1, 'approved', 6900.00, 5100.00, 5100.00,
       (SELECT id FROM staff WHERE full_name = 'April Jeffrey'), (SELECT id FROM staff WHERE full_name = 'Mark Laver'),
       now() - INTERVAL '32 days', now() - INTERVAL '32 days', now() - INTERVAL '28 days';

INSERT INTO jobs (claim_id, quote_id, job_number, start_date, due_date, owner_id, stage)
SELECT (SELECT id FROM claims WHERE claim_number = 'ALZ-9012'),
       (SELECT id FROM quotes WHERE claim_id = (SELECT id FROM claims WHERE claim_number = 'ALZ-9012')),
       'J-0998', CURRENT_DATE - INTERVAL '26 days', CURRENT_DATE + INTERVAL '5 days',
       (SELECT id FROM staff WHERE full_name = 'Workshop'), 'in_production';

INSERT INTO job_components (job_id, claim_item_id, category, colour, description, supplier, invoice_no, weight_gms, actual_cost)
SELECT j.id, ci.id, 'stone', NULL, 'Diamond melee, 18 x 0.07ct G/VS2', 'Sydney Diamond Exchange', 'SDE-6621', NULL, 2650.00
FROM jobs j, claim_items ci
WHERE j.job_number = 'J-0998' AND ci.claim_id = (SELECT id FROM claims WHERE claim_number = 'ALZ-9012') AND ci.item_no = 1
UNION ALL
SELECT j.id, ci.id, 'gold', 'white_gold', 'Casting, 18ct white gold band', 'ABC Casting', 'INV-4471', 4.0, 480.00
FROM jobs j, claim_items ci
WHERE j.job_number = 'J-0998' AND ci.claim_id = (SELECT id FROM claims WHERE claim_number = 'ALZ-9012') AND ci.item_no = 1
UNION ALL
SELECT j.id, ci.id, 'labour', NULL, 'Setting & finishing, in progress', NULL, NULL, NULL, 320.00
FROM jobs j, claim_items ci
WHERE j.job_number = 'J-0998' AND ci.claim_id = (SELECT id FROM claims WHERE claim_number = 'ALZ-9012') AND ci.item_no = 1;

-- ----------------------------------------------------------------------------
-- CLAIM G — Grace Thompson / QBE — completed and paid
-- ----------------------------------------------------------------------------
INSERT INTO claims (claim_number, our_ref, customer_id, insurer_id, branch, assessment_type, validation_type, date_received, assigned_to, status, excess_amount)
SELECT 'QBE-2501187', 'CC-1310',
       (SELECT id FROM customers WHERE email = 'grace.thompson@gmail.com'),
       (SELECT id FROM insurers WHERE name = 'QBE'),
       'melbourne', 'qbe_quote', 'phone_1_5', CURRENT_DATE - INTERVAL '70 days',
       (SELECT id FROM staff WHERE full_name = 'Tracey'), 'paid', 250.00;

INSERT INTO claim_items (claim_id, item_no, category, item_type, description, metal_type, metal_colour, weight_gms, proof_type, eoo_status, fulfilment, policy_limit, retail_price, insurance_nett, status)
SELECT (SELECT id FROM claims WHERE claim_number = 'QBE-2501187'), 1,
       'bangle', 'bangle', '18ct yellow gold solid bangle',
       '18ct', 'yellow_gold', 28.0, 'val_and_photo', 'satisfactory', 'supply', 3800.00, 3400.00, 2450.00, 'completed';

INSERT INTO quotes (claim_id, version, status, total_retail, total_nett, total_liability, created_by, reviewed_by, reviewed_at, sent_at, decided_at)
SELECT (SELECT id FROM claims WHERE claim_number = 'QBE-2501187'), 1, 'approved', 3400.00, 2450.00, 2450.00,
       (SELECT id FROM staff WHERE full_name = 'Tracey'), (SELECT id FROM staff WHERE full_name = 'Mark Laver'),
       now() - INTERVAL '65 days', now() - INTERVAL '65 days', now() - INTERVAL '58 days';

INSERT INTO jobs (claim_id, quote_id, job_number, start_date, due_date, owner_id, stage)
SELECT (SELECT id FROM claims WHERE claim_number = 'QBE-2501187'),
       (SELECT id FROM quotes WHERE claim_id = (SELECT id FROM claims WHERE claim_number = 'QBE-2501187')),
       'J-0950', CURRENT_DATE - INTERVAL '55 days', CURRENT_DATE - INTERVAL '20 days',
       (SELECT id FROM staff WHERE full_name = 'Workshop'), 'completed';

INSERT INTO job_components (job_id, claim_item_id, category, colour, description, supplier, invoice_no, weight_gms, actual_cost)
SELECT j.id, ci.id, 'gold', 'yellow_gold', '18ct yellow gold casting, solid bangle', 'ABC Casting', 'INV-4102', 28.0, 1680.00
FROM jobs j, claim_items ci
WHERE j.job_number = 'J-0950' AND ci.claim_id = (SELECT id FROM claims WHERE claim_number = 'QBE-2501187') AND ci.item_no = 1
UNION ALL
SELECT j.id, ci.id, 'labour', NULL, 'Finishing & polishing', NULL, NULL, NULL, 300.00
FROM jobs j, claim_items ci
WHERE j.job_number = 'J-0950' AND ci.claim_id = (SELECT id FROM claims WHERE claim_number = 'QBE-2501187') AND ci.item_no = 1;

INSERT INTO invoices (claim_id, quote_id, invoice_number, xero_invoice_id, bill_to, subtotal, gst, total, status, issued_at, paid_at)
SELECT (SELECT id FROM claims WHERE claim_number = 'QBE-2501187'),
       (SELECT id FROM quotes WHERE claim_id = (SELECT id FROM claims WHERE claim_number = 'QBE-2501187')),
       'INV-2201', 'stub-inv-2201', 'insurer', 2227.27, 222.73, 2450.00, 'paid',
       now() - INTERVAL '22 days', now() - INTERVAL '10 days';

-- ----------------------------------------------------------------------------
-- CLAIM H — Michael Bianchi — private retail work (no insurer), quote sent
-- ----------------------------------------------------------------------------
INSERT INTO claims (claim_number, our_ref, customer_id, insurer_id, branch, date_received, assigned_to, status)
SELECT 'PRIV-1044', 'CC-1855',
       (SELECT id FROM customers WHERE email = 'mbianchi@gmail.com'),
       NULL, 'sydney', CURRENT_DATE - INTERVAL '7 days',
       (SELECT id FROM staff WHERE full_name = 'Rob Venus'), 'quote_sent';

INSERT INTO claim_items (claim_id, item_no, category, item_type, description, metal_type, metal_colour, weight_gms, finger_size, retail_price, status)
SELECT (SELECT id FROM claims WHERE claim_number = 'PRIV-1044'), 1,
       'rings', 'wedding_ring', '18ct yellow gold custom wedding band, to match existing engagement ring',
       '18ct', 'yellow_gold', 3.6, 'O', 1850.00, 'quoted';

INSERT INTO quotes (claim_id, version, status, total_retail, total_nett, total_liability, created_by, reviewed_by, reviewed_at, sent_at)
SELECT (SELECT id FROM claims WHERE claim_number = 'PRIV-1044'), 1, 'sent', 1850.00, 0.00, 0.00,
       (SELECT id FROM staff WHERE full_name = 'Rob Venus'), (SELECT id FROM staff WHERE full_name = 'Mark Laver'),
       now() - INTERVAL '2 days', now() - INTERVAL '2 days';

INSERT INTO claim_notes (claim_id, staff_id, note_type, note)
SELECT (SELECT id FROM claims WHERE claim_number = 'PRIV-1044'), (SELECT id FROM staff WHERE full_name = 'Rob Venus'),
       'customer_discussion', 'Custom band to match existing engagement ring — private retail job, no insurer involved.';

-- ----------------------------------------------------------------------------
-- STOCK — a believable ledger, including a couple of deliberate matches to
-- the claims above so the "live availability" badge on quote-entry.html has
-- something to show in the demo.
-- ----------------------------------------------------------------------------
INSERT INTO stock_items (category, description, sku, quantity, unit, reorder_threshold, supplier, cost, suggested_rrp, attributes, branch) VALUES
  ('stone', 'Diamond, oval cut, 1.20ct F/VS1', 'ST-DIA-OV120', 1, 'pc', 0, 'Sydney Diamond Exchange', 10200.00, 15500.00,
    '{"stone_type":"diamond","shape":"oval_cut","carat":1.20,"quality":"F/VS1"}', 'melbourne'),
  ('stone', 'Diamond, round brilliant, 0.35ct G/SI1', 'ST-DIA-RB035', 4, 'pc', 2, 'Sydney Diamond Exchange', 1120.00, 1900.00,
    '{"stone_type":"diamond","shape":"round_brilliant","carat":0.35,"quality":"G/SI1"}', 'sydney'),
  ('stone', 'Sapphire, oval cut, 0.80ct AA', 'ST-SAP-OV080', 3, 'pc', 1, 'Melbourne Gem Traders', 620.00, 1100.00,
    '{"stone_type":"sapphire","shape":"oval_cut","carat":0.80,"quality":"AA"}', 'melbourne'),
  ('stone', 'Diamond, round brilliant, 0.50ct H/SI2', 'ST-DIA-RB050', 2, 'pc', 1, 'Sydney Diamond Exchange', 1450.00, 2400.00,
    '{"stone_type":"diamond","shape":"round_brilliant","carat":0.50,"quality":"H/SI2"}', 'melbourne'),
  ('metal', '18ct yellow gold, loose', 'MT-18Y', 32.4, 'gm', 10, 'Melbourne Refiners', 80.00, NULL,
    '{"metal_type":"18ct","metal_colour":"yellow_gold"}', 'melbourne'),
  ('metal', '18ct white gold, loose', 'MT-18W', 18.7, 'gm', 10, 'Melbourne Refiners', 110.00, NULL,
    '{"metal_type":"18ct","metal_colour":"white_gold"}', 'melbourne'),
  ('metal', '18ct rose gold, loose', 'MT-18R', 12.0, 'gm', 5, 'Melbourne Refiners', 80.00, NULL,
    '{"metal_type":"18ct","metal_colour":"rose_gold"}', 'melbourne'),
  ('mount', 'Ring mount, 18ct white gold, solitaire style', 'MO-RG-18W', 3, 'pc', 1, 'ABC Casting', 180.00, 450.00,
    '{"metal_type":"18ct","metal_colour":"white_gold","item_category":"rings"}', 'melbourne'),
  ('mount', 'Ring mount, 18ct yellow gold, band style', 'MO-RG-18Y', 2, 'pc', 1, 'ABC Casting', 150.00, 400.00,
    '{"metal_type":"18ct","metal_colour":"yellow_gold","item_category":"rings"}', 'sydney'),
  ('finished', 'Pre-made 18ct yellow gold wedding band, size N', 'FIN-WB-18Y-N', 5, 'pc', 2, NULL, 340.00, 690.00, '{}', 'melbourne'),
  ('finished', 'Pre-made 18ct white gold tennis bracelet, 2ct TW', 'FIN-TB-18W-2CT', 1, 'pc', 0, NULL, 3200.00, 5400.00, '{}', 'sydney');

COMMIT;
