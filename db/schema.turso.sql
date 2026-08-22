-- Cameron & Co CRM schema for Turso/libSQL.
-- SQLite stores dates/times as UTC text, JSON as TEXT, and ids as INTEGER.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS lookup_values (
  id INTEGER PRIMARY KEY AUTOINCREMENT, domain TEXT NOT NULL, code TEXT NOT NULL,
  label TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1, extra TEXT, UNIQUE(domain, code)
);
CREATE INDEX IF NOT EXISTS idx_lookup_domain ON lookup_values(domain) WHERE active = 1;

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO app_settings (key, value) VALUES (
  'reference_number_format',
  '{"prefix":"CC","digits":4,"reset_yearly":true,"year":null,"next_seq":1}'
);

CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT, full_name TEXT NOT NULL UNIQUE, email TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'assessor' CHECK(role IN ('admin','assessor','case_manager','workshop','sales')),
  branch TEXT NOT NULL DEFAULT 'melbourne' CHECK(branch IN ('melbourne','sydney')),
  can_approve_quotes INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS insurers (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, claims_email TEXT,
  phone TEXT, assessment_format TEXT NOT NULL DEFAULT 'GENERIC', xero_contact_id TEXT,
  notes TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS insurer_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, insurer_id INTEGER NOT NULL REFERENCES insurers(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL, email TEXT, phone TEXT, active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_insurer_contacts ON insurer_contacts(insurer_id);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT NOT NULL, last_name TEXT NOT NULL DEFAULT '',
  email TEXT, phone TEXT, mobile TEXT, address_line1 TEXT, address_line2 TEXT, suburb TEXT,
  state TEXT, postcode TEXT, customer_type TEXT NOT NULL DEFAULT 'insurance'
    CHECK(customer_type IN ('private','insurance','retail_partner','trade')),
  preferred_contact TEXT, source TEXT, ring_size TEXT, partner_or_occasion TEXT,
  consent_marketing INTEGER NOT NULL DEFAULT 0, consent_email INTEGER NOT NULL DEFAULT 0,
  consent_sms INTEGER NOT NULL DEFAULT 0, consent_updated_at TEXT, consent_source TEXT,
  xero_contact_id TEXT, notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(lower(last_name), lower(first_name));
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(lower(email));

CREATE TABLE IF NOT EXISTS claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT, claim_number TEXT NOT NULL, our_ref TEXT, your_ref TEXT,
  customer_id INTEGER NOT NULL REFERENCES customers(id), insurer_id INTEGER REFERENCES insurers(id),
  insurer_contact_id INTEGER REFERENCES insurer_contacts(id), branch TEXT NOT NULL DEFAULT 'melbourne'
    CHECK(branch IN ('melbourne','sydney')), assessment_type TEXT, validation_type TEXT,
  date_received TEXT NOT NULL DEFAULT (date('now')), assigned_to INTEGER REFERENCES staff(id),
  status TEXT NOT NULL DEFAULT 'new_enquiry' CHECK(status IN ('new_enquiry','assessing','pending_approval','quote_sent','revised','approved','awaiting_deposit','cad_approval','in_production','quality_check','ready_for_collection','completed','invoiced','paid','declined','closed')),
  excess_amount NUMERIC, settlement_notes TEXT, respond_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_claims_number_unique ON claims(claim_number, COALESCE(insurer_id, -1));
CREATE INDEX IF NOT EXISTS idx_claims_customer ON claims(customer_id);
CREATE INDEX IF NOT EXISTS idx_claims_insurer ON claims(insurer_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);

CREATE TABLE IF NOT EXISTS claim_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, claim_id INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  item_no INTEGER NOT NULL, category TEXT, item_type TEXT, description TEXT, comment TEXT,
  metal_type TEXT, metal_colour TEXT, manufacture_origin TEXT, chain_style TEXT, ring_style TEXT,
  repair_type TEXT, weight_gms NUMERIC, width_mm NUMERIC, length_cm NUMERIC, finger_size TEXT,
  watch_make TEXT, watch_gents_ladies TEXT CHECK(watch_gents_ladies IN ('gents','ladies') OR watch_gents_ladies IS NULL),
  watch_current_model TEXT, watch_replacement_model TEXT, watch_metal TEXT, proof_type TEXT,
  eoo_status TEXT CHECK(eoo_status IN ('satisfactory','no_eoo','limited_eoo') OR eoo_status IS NULL),
  eoo_notes TEXT, policy_limit NUMERIC, retail_price NUMERIC, insurance_nett NUMERIC, liability NUMERIC,
  fulfilment TEXT CHECK(fulfilment IN ('supply','supply_alternative','refer_cm') OR fulfilment IS NULL),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','quoted','approved','in_production','completed','cancelled','unable_to_quote')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(claim_id, item_no)
);
CREATE INDEX IF NOT EXISTS idx_items_claim ON claim_items(claim_id);

CREATE TABLE IF NOT EXISTS item_stones (
  id INTEGER PRIMARY KEY AUTOINCREMENT, claim_item_id INTEGER NOT NULL REFERENCES claim_items(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL DEFAULT 1, stone_type TEXT, shape TEXT, stone_count INTEGER NOT NULL DEFAULT 1,
  carat_each NUMERIC, total_carat NUMERIC, quality TEXT, certificate TEXT, cost_per_carat NUMERIC, cost NUMERIC
);
CREATE INDEX IF NOT EXISTS idx_stones_item ON item_stones(claim_item_id);

CREATE TABLE IF NOT EXISTS item_costings (
  id INTEGER PRIMARY KEY AUTOINCREMENT, claim_item_id INTEGER NOT NULL REFERENCES claim_items(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL DEFAULT 1, cost_type TEXT NOT NULL, description TEXT,
  qty NUMERIC NOT NULL DEFAULT 1, unit TEXT NOT NULL DEFAULT 'pc' CHECK(unit IN ('gm','hr','pc')),
  rate NUMERIC NOT NULL DEFAULT 0, amount NUMERIC NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_costings_item ON item_costings(claim_item_id);

CREATE TABLE IF NOT EXISTS rate_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, label TEXT NOT NULL, category TEXT NOT NULL,
  metal_type TEXT, origin TEXT, rate NUMERIC NOT NULL, unit TEXT NOT NULL DEFAULT 'gm',
  effective_from TEXT NOT NULL DEFAULT (date('now')), effective_to TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rates_one_current ON rate_cards(code) WHERE effective_to IS NULL;

CREATE TABLE IF NOT EXISTS watch_brand_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT, brand TEXT NOT NULL, insurer_id INTEGER REFERENCES insurers(id),
  rate_type TEXT NOT NULL DEFAULT 'discount_pct' CHECK(rate_type IN ('discount_pct','poa')),
  rate_value NUMERIC, effective_from TEXT NOT NULL DEFAULT (date('now')), effective_to TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_watch_rates_one_current ON watch_brand_rates(brand, COALESCE(insurer_id, -1)) WHERE effective_to IS NULL;

CREATE TABLE IF NOT EXISTS metal_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT, metal TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'AUD',
  price_per_oz NUMERIC NOT NULL, price_per_gm NUMERIC NOT NULL, source TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_metal_prices ON metal_prices(metal, fetched_at DESC);

CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, claim_id INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN ('draft','ready_to_send','sent','approved','declined','superseded')),
  total_retail NUMERIC NOT NULL DEFAULT 0, total_nett NUMERIC NOT NULL DEFAULT 0,
  total_liability NUMERIC NOT NULL DEFAULT 0, postage_handling NUMERIC NOT NULL DEFAULT 0,
  salvage_allocation NUMERIC NOT NULL DEFAULT 0, rates_snapshot TEXT, spot_snapshot TEXT, items_snapshot TEXT,
  created_by INTEGER REFERENCES staff(id), reviewed_by INTEGER REFERENCES staff(id), reviewed_at TEXT,
  sent_at TEXT, decided_at TEXT, pdf_url TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(claim_id, version)
);
CREATE INDEX IF NOT EXISTS idx_quotes_claim ON quotes(claim_id);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT, claim_id INTEGER REFERENCES claims(id) ON DELETE CASCADE,
  claim_item_id INTEGER REFERENCES claim_items(id) ON DELETE CASCADE, doc_type TEXT NOT NULL DEFAULT 'other',
  filename TEXT NOT NULL, url TEXT NOT NULL, uploaded_by INTEGER REFERENCES staff(id),
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_documents_claim ON documents(claim_id);

CREATE TABLE IF NOT EXISTS claim_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, claim_id INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  staff_id INTEGER REFERENCES staff(id), note_type TEXT NOT NULL DEFAULT 'internal', note TEXT NOT NULL,
  noted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notes_claim ON claim_notes(claim_id, noted_at DESC);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, claim_id INTEGER NOT NULL REFERENCES claims(id) UNIQUE,
  quote_id INTEGER REFERENCES quotes(id), job_number TEXT UNIQUE, items_taken TEXT, start_date TEXT,
  due_date TEXT, owner_id INTEGER REFERENCES staff(id), stage TEXT NOT NULL DEFAULT 'awaiting_deposit',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS job_components (
  id INTEGER PRIMARY KEY AUTOINCREMENT, job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  claim_item_id INTEGER REFERENCES claim_items(id), category TEXT, carat TEXT, colour TEXT, description TEXT,
  origin TEXT, stock_no TEXT, supplier TEXT, invoice_no TEXT, weight_gms NUMERIC, rate_per_gm NUMERIC,
  actual_cost NUMERIC NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_components_job ON job_components(job_id);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT, claim_id INTEGER NOT NULL REFERENCES claims(id), quote_id INTEGER REFERENCES quotes(id),
  invoice_number TEXT, xero_invoice_id TEXT UNIQUE, bill_to TEXT NOT NULL DEFAULT 'insurer' CHECK(bill_to IN ('insurer','customer')),
  subtotal NUMERIC NOT NULL DEFAULT 0, gst NUMERIC NOT NULL DEFAULT 0, total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', issued_at TEXT, paid_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_invoices_claim ON invoices(claim_id);

CREATE TABLE IF NOT EXISTS stock_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL CHECK(category IN ('stone','metal','mount','finished')),
  description TEXT NOT NULL, sku TEXT, quantity NUMERIC NOT NULL DEFAULT 0, unit TEXT NOT NULL DEFAULT 'pc',
  reorder_threshold NUMERIC NOT NULL DEFAULT 0, supplier TEXT, cost NUMERIC, suggested_rrp NUMERIC,
  attributes TEXT NOT NULL DEFAULT '{}', notes TEXT, branch TEXT NOT NULL DEFAULT 'melbourne',
  active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_stock_items_category ON stock_items(category) WHERE active = 1;

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER REFERENCES staff(id), entity TEXT NOT NULL,
  entity_id INTEGER NOT NULL, action TEXT NOT NULL, detail TEXT, logged_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_log(entity, entity_id, logged_at DESC);

CREATE TABLE IF NOT EXISTS xero_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL UNIQUE, tenant_name TEXT,
  access_token TEXT NOT NULL, refresh_token TEXT NOT NULL, expires_at TEXT NOT NULL, scopes TEXT,
  connected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS xero_oauth_states (
  state_hash TEXT PRIMARY KEY, redirect_uri TEXT NOT NULL, expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_customers_touch AFTER UPDATE ON customers BEGIN UPDATE customers SET updated_at=CURRENT_TIMESTAMP WHERE id=NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_claims_touch AFTER UPDATE ON claims BEGIN UPDATE claims SET updated_at=CURRENT_TIMESTAMP WHERE id=NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_items_touch AFTER UPDATE ON claim_items BEGIN UPDATE claim_items SET updated_at=CURRENT_TIMESTAMP WHERE id=NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_jobs_touch AFTER UPDATE ON jobs BEGIN UPDATE jobs SET updated_at=CURRENT_TIMESTAMP WHERE id=NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_stock_items_touch AFTER UPDATE ON stock_items BEGIN UPDATE stock_items SET updated_at=CURRENT_TIMESTAMP WHERE id=NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_xero_connections_touch AFTER UPDATE ON xero_connections BEGIN UPDATE xero_connections SET updated_at=CURRENT_TIMESTAMP WHERE id=NEW.id; END;

CREATE VIEW IF NOT EXISTS v_pipeline AS
SELECT c.id AS claim_id, c.claim_number, c.status, c.branch, c.date_received,
       c.respond_by,
       cu.first_name || ' ' || cu.last_name AS customer, i.name AS insurer,
       COALESCE(q.total_retail,0) AS quoted_retail, COALESCE(q.total_nett,0) AS quoted_nett,
       CAST(julianday('now') - julianday(c.date_received) AS INTEGER) AS days_open,
       q.id AS quote_id, q.status AS quote_status,
       inv.invoice_number AS invoice_number, inv.xero_invoice_id AS xero_invoice_id
FROM claims c JOIN customers cu ON cu.id=c.customer_id LEFT JOIN insurers i ON i.id=c.insurer_id
LEFT JOIN quotes q ON q.id=(SELECT q2.id FROM quotes q2 WHERE q2.claim_id=c.id AND q2.status <> 'superseded' ORDER BY q2.version DESC LIMIT 1)
LEFT JOIN (
  SELECT i1.claim_id, i1.invoice_number, i1.xero_invoice_id FROM invoices i1
  WHERE i1.created_at = (SELECT MAX(i2.created_at) FROM invoices i2 WHERE i2.claim_id = i1.claim_id)
) inv ON inv.claim_id = c.id
WHERE c.status NOT IN ('paid','closed','declined');

CREATE VIEW IF NOT EXISTS v_job_margin AS
SELECT j.id AS job_id, j.job_number, c.claim_number, i.name AS insurer, q.total_nett AS quoted_nett,
       COALESCE(SUM(jc.actual_cost),0) AS actual_cost,
       q.total_nett - COALESCE(SUM(jc.actual_cost),0) AS margin
FROM jobs j JOIN claims c ON c.id=j.claim_id LEFT JOIN insurers i ON i.id=c.insurer_id
LEFT JOIN quotes q ON q.id=j.quote_id LEFT JOIN job_components jc ON jc.job_id=j.id
GROUP BY j.id,j.job_number,c.claim_number,i.name,q.total_nett;
