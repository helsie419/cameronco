-- ============================================================================
-- CAMERON & CO — INSURANCE QUOTING & CRM DATABASE
-- Plain PostgreSQL (13+). No Neon-specific features — portable to any
-- self-hosted Postgres. Run this file first, then seed.sql.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- LOOKUPS — one table, keyed by domain. Everything that was a dropdown in the
-- spreadsheets (Lists / Reference tabs) lives here so the office can maintain
-- values without a schema change.
-- ----------------------------------------------------------------------------
CREATE TABLE lookup_values (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    domain      TEXT NOT NULL,           -- e.g. 'item_type', 'metal_type', 'proof_type'
    code        TEXT NOT NULL,
    label       TEXT NOT NULL,
    sort_order  INT  NOT NULL DEFAULT 0,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    extra       JSONB,                   -- optional metadata per value
    UNIQUE (domain, code)
);
CREATE INDEX idx_lookup_domain ON lookup_values (domain) WHERE active;

-- ----------------------------------------------------------------------------
-- APP SETTINGS — small key/value store for app-wide config that isn't a
-- dropdown list (lookup_values) or per-record data. First use: the format
-- and running counter for the auto-generated internal ("our ref") claim
-- reference number, configurable from Settings.
-- ----------------------------------------------------------------------------
CREATE TABLE app_settings (
    key         TEXT PRIMARY KEY,
    value       JSONB NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO app_settings (key, value) VALUES (
    'reference_number_format',
    '{"prefix":"CC","digits":4,"reset_yearly":true,"year":null,"next_seq":1}'
);

-- ----------------------------------------------------------------------------
-- STAFF
-- ----------------------------------------------------------------------------
CREATE TABLE staff (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name   TEXT NOT NULL UNIQUE,
    email       TEXT UNIQUE,
    role        TEXT NOT NULL DEFAULT 'assessor'
                CHECK (role IN ('admin','assessor','case_manager','workshop','sales')),
    branch      TEXT NOT NULL DEFAULT 'melbourne'
                CHECK (branch IN ('melbourne','sydney')),
    can_approve_quotes BOOLEAN NOT NULL DEFAULT FALSE,   -- lets a non-admin approve quotes for sending
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- INSURERS — the paying client on insurance work. Assessment format drives
-- which report template (QBE, Allianz, generic…) a claim generates.
-- ----------------------------------------------------------------------------
CREATE TABLE insurers (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name              TEXT NOT NULL UNIQUE,
    claims_email      TEXT,
    phone             TEXT,
    assessment_format TEXT NOT NULL DEFAULT 'GENERIC',   -- GENERIC | QBE | ALLIANZ | ELDERS | CRAWFORD | CL | IVAA
    xero_contact_id   TEXT,                              -- Xero Contact GUID once synced
    notes             TEXT,
    active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE insurer_contacts (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    insurer_id  BIGINT NOT NULL REFERENCES insurers(id) ON DELETE CASCADE,
    full_name   TEXT NOT NULL,
    email       TEXT,
    phone       TEXT,
    active      BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_insurer_contacts ON insurer_contacts (insurer_id);

-- ----------------------------------------------------------------------------
-- CUSTOMERS — matches the CRM MVP (type + consent flags). The claimant on
-- insurance work; the buyer on private/retail work.
-- ----------------------------------------------------------------------------
CREATE TABLE customers (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    first_name        TEXT NOT NULL,
    last_name         TEXT NOT NULL DEFAULT '',
    email             TEXT,
    phone             TEXT,
    mobile            TEXT,
    address_line1     TEXT,
    address_line2     TEXT,
    suburb            TEXT,
    state             TEXT,
    postcode          TEXT,
    customer_type     TEXT NOT NULL DEFAULT 'insurance'
                      CHECK (customer_type IN ('private','insurance','retail_partner','trade')),
    consent_marketing BOOLEAN NOT NULL DEFAULT FALSE,
    consent_email     BOOLEAN NOT NULL DEFAULT FALSE,
    consent_sms       BOOLEAN NOT NULL DEFAULT FALSE,
    xero_contact_id   TEXT,
    notes             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_customers_name  ON customers (lower(last_name), lower(first_name));
CREATE INDEX idx_customers_email ON customers (lower(email));

-- ----------------------------------------------------------------------------
-- CLAIMS — one customer, many claims. Header of the Q Sheet.
-- ----------------------------------------------------------------------------
CREATE TABLE claims (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    claim_number       TEXT NOT NULL,               -- insurer's claim number
    our_ref            TEXT,                        -- Cameron & Co reference
    your_ref           TEXT,                        -- insurer's internal ref, if different
    customer_id        BIGINT NOT NULL REFERENCES customers(id),
    insurer_id         BIGINT REFERENCES insurers(id),          -- NULL = private work
    insurer_contact_id BIGINT REFERENCES insurer_contacts(id),
    branch             TEXT NOT NULL DEFAULT 'melbourne'
                       CHECK (branch IN ('melbourne','sydney')),
    assessment_type    TEXT,                        -- lookup: assessment_type
    validation_type    TEXT,                        -- lookup: validation_type (Phone 1-5 items…)
    date_received      DATE NOT NULL DEFAULT CURRENT_DATE,
    assigned_to        BIGINT REFERENCES staff(id),
    status             TEXT NOT NULL DEFAULT 'new_enquiry'
                       CHECK (status IN ('new_enquiry','assessing','pending_approval','quote_sent',
                                         'revised','approved','awaiting_deposit','cad_approval',
                                         'in_production','quality_check','ready_for_collection',
                                         'completed','invoiced','paid','declined','closed')),
    excess_amount      NUMERIC(12,2),
    settlement_notes   TEXT,                        -- "Refer Case Manager" etc.
    respond_by         DATE,                        -- insurer's response-due date
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- claim_number + insurer_id must be unique, but a plain UNIQUE constraint
-- treats NULL insurer_id (private, non-insurance work) as distinct every
-- time — the same gotcha already hit and fixed on watch_brand_rates — so
-- private claims could silently collide on claim_number. Fixed the same way.
CREATE UNIQUE INDEX idx_claims_number_unique
    ON claims (claim_number, COALESCE(insurer_id, -1));
CREATE INDEX idx_claims_customer ON claims (customer_id);
CREATE INDEX idx_claims_insurer  ON claims (insurer_id);
CREATE INDEX idx_claims_status   ON claims (status);

-- ----------------------------------------------------------------------------
-- CLAIM ITEMS — the numbered item sheets (1–18). Each item carries its own
-- specification: metal, dimensions, watch details, evidence of ownership,
-- policy limit and pricing outcome.
-- ----------------------------------------------------------------------------
CREATE TABLE claim_items (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    claim_id           BIGINT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    item_no            INT NOT NULL,                -- 1..n within the claim
    category           TEXT,                        -- lookup: item_category
    item_type          TEXT,                        -- lookup: item_type (ENGAGEMENT RING…)
    description        TEXT,                        -- free description used on the quote
    comment            TEXT,                        -- internal comment
    -- Specification
    metal_type         TEXT,                        -- lookup: metal_type (9ct, 18ct, Platinum…)
    metal_colour       TEXT,                        -- lookup: metal_colour
    manufacture_origin TEXT,                        -- lookup: manufacture_origin (Local/Imported/Indian)
    chain_style        TEXT,
    ring_style         TEXT,
    repair_type        TEXT,
    weight_gms         NUMERIC(10,3),
    width_mm           NUMERIC(10,2),
    length_cm          NUMERIC(10,2),
    finger_size        TEXT,
    -- Watch fields (used when item is a watch)
    watch_make         TEXT,
    watch_gents_ladies TEXT CHECK (watch_gents_ladies IN ('gents','ladies') OR watch_gents_ladies IS NULL),
    watch_current_model TEXT,
    watch_replacement_model TEXT,
    watch_metal        TEXT,
    -- Evidence of ownership / compliance
    proof_type         TEXT,                        -- lookup: proof_type (PHOTO, VAL, RCPT…)
    eoo_status         TEXT CHECK (eoo_status IN ('satisfactory','no_eoo','limited_eoo') OR eoo_status IS NULL),
    eoo_notes          TEXT,
    -- Pricing outcome (per Q Sheet columns)
    policy_limit       NUMERIC(12,2),               -- per-item limit from the policy
    retail_price       NUMERIC(12,2),               -- recommended retail inc GST
    insurance_nett     NUMERIC(12,2),               -- nett to insurer
    liability          NUMERIC(12,2),               -- after limits applied
    fulfilment         TEXT CHECK (fulfilment IN ('supply','supply_alternative','refer_cm') OR fulfilment IS NULL),
    status             TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','quoted','approved','in_production','completed','cancelled','unable_to_quote')),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (claim_id, item_no)
);
CREATE INDEX idx_items_claim ON claim_items (claim_id);

-- ----------------------------------------------------------------------------
-- ITEM STONES — repeating stone rows per item (type, shape, #, carat, quality,
-- cert) exactly as on the item sheets.
-- ----------------------------------------------------------------------------
CREATE TABLE item_stones (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    claim_item_id  BIGINT NOT NULL REFERENCES claim_items(id) ON DELETE CASCADE,
    line_no        INT NOT NULL DEFAULT 1,
    stone_type     TEXT,                    -- Diamond, Sapphire, Ruby…
    shape          TEXT,                    -- RBC, Oval, Princess…
    stone_count    INT NOT NULL DEFAULT 1,
    carat_each     NUMERIC(8,3),
    total_carat    NUMERIC(8,3),
    quality        TEXT,                    -- e.g. G/VS
    certificate    TEXT,                    -- GIA/cert reference
    cost_per_carat NUMERIC(12,2),           -- Diamond calc: $/ct
    cost           NUMERIC(12,2)            -- extended cost
);
CREATE INDEX idx_stones_item ON item_stones (claim_item_id);

-- ----------------------------------------------------------------------------
-- ITEM COSTINGS — the Ring Calculator / Chain Calculator lines. Each line
-- stores the rate used at the time, so historic quotes never move when the
-- rate card or spot price changes.
-- ----------------------------------------------------------------------------
CREATE TABLE item_costings (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    claim_item_id  BIGINT NOT NULL REFERENCES claim_items(id) ON DELETE CASCADE,
    line_no        INT NOT NULL DEFAULT 1,
    cost_type      TEXT NOT NULL
                   CHECK (cost_type IN ('stone','gold','setting','casting','labour',
                                        'box_valuation','chain_per_gm','component',
                                        'cad_drawing','casting_house','subcontractor',
                                        'rhodium_plating','delivery','other')),
    description    TEXT,
    qty            NUMERIC(12,3) NOT NULL DEFAULT 1,   -- gms, hours, pieces
    unit           TEXT NOT NULL DEFAULT 'pc' CHECK (unit IN ('gm','hr','pc')),
    rate           NUMERIC(12,2) NOT NULL DEFAULT 0,
    amount         NUMERIC(12,2) NOT NULL DEFAULT 0
);
CREATE INDEX idx_costings_item ON item_costings (claim_item_id);

-- ----------------------------------------------------------------------------
-- RATE CARDS — versioned pricing (replaces the hardcoded numbers in the
-- calculators: 9ct local $115/gm, labour $65, setting $8, box & val $26 …).
-- A new row with a new effective_from supersedes; old quotes keep their
-- snapshotted rates in item_costings / quotes.rates_snapshot.
-- ----------------------------------------------------------------------------
CREATE TABLE rate_cards (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code           TEXT NOT NULL,           -- e.g. CHAIN_9CT_LOCAL, MFG_GOLD_18CT, LABOUR
    label          TEXT NOT NULL,
    category       TEXT NOT NULL
                   CHECK (category IN ('chain_per_gm','earring_charm_per_gm','mfg_gold_per_gm',
                                       'setting_per_stone','casting','labour_per_hr',
                                       'box_valuation','markup')),
    metal_type     TEXT,                    -- 9ct / 14ct / 18ct / 21-22ct …
    origin         TEXT,                    -- local / imported
    rate           NUMERIC(12,4) NOT NULL,
    unit           TEXT NOT NULL DEFAULT 'gm',
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to   DATE,                    -- NULL = current
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- The real invariant is "only one current version per code" — not
-- uniqueness on the date, which would break same-day corrections (superseding
-- a rate added earlier today still leaves both rows dated today).
CREATE UNIQUE INDEX idx_rates_one_current ON rate_cards (code) WHERE effective_to IS NULL;

-- ----------------------------------------------------------------------------
-- WATCH BRAND RATES — the insurer-specific discount/sell matrix from the
-- WATCHES reference tab (e.g. Rolex 5% under Suncorp, POA under others).
-- insurer_id NULL = the default "Shop Sales" (retail, non-insurance) rate.
-- Versioned the same way as rate_cards — a new row supersedes the old one.
-- ----------------------------------------------------------------------------
CREATE TABLE watch_brand_rates (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    brand          TEXT NOT NULL,
    insurer_id     BIGINT REFERENCES insurers(id),   -- NULL = default/retail rate
    rate_type      TEXT NOT NULL DEFAULT 'discount_pct'
                   CHECK (rate_type IN ('discount_pct','poa')),
    rate_value     NUMERIC(6,4),                     -- e.g. 0.26 = 26% off RRP; NULL when POA
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to   DATE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Same fix as rate_cards: the real invariant is one current version per
-- brand+insurer, not uniqueness on the date.
CREATE UNIQUE INDEX idx_watch_rates_one_current
    ON watch_brand_rates (brand, COALESCE(insurer_id, -1)) WHERE effective_to IS NULL;

-- ----------------------------------------------------------------------------
-- METAL PRICES — daily spot history in AUD, fetched by the scheduled function.
-- Quotes snapshot the price used; this table is the audit trail + trend data.
-- ----------------------------------------------------------------------------
CREATE TABLE metal_prices (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    metal        TEXT NOT NULL CHECK (metal IN ('gold','silver','platinum','palladium')),
    currency     TEXT NOT NULL DEFAULT 'AUD',
    price_per_oz NUMERIC(14,4) NOT NULL,
    price_per_gm NUMERIC(14,4) NOT NULL,
    source       TEXT NOT NULL,
    fetched_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_metal_prices ON metal_prices (metal, fetched_at DESC);

-- ----------------------------------------------------------------------------
-- QUOTES — versioned. Generating a quote freezes totals + the rates and spot
-- prices used. Revisions create a new version; the old one is superseded.
-- ----------------------------------------------------------------------------
CREATE TABLE quotes (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    claim_id          BIGINT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    version           INT NOT NULL DEFAULT 1,
    status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','ready_to_send','sent','approved','declined','superseded')),
    total_retail      NUMERIC(12,2) NOT NULL DEFAULT 0,   -- inc GST
    total_nett        NUMERIC(12,2) NOT NULL DEFAULT 0,   -- insurance nett
    total_liability   NUMERIC(12,2) NOT NULL DEFAULT 0,   -- limits applied
    postage_handling  NUMERIC(12,2) NOT NULL DEFAULT 0,
    salvage_allocation NUMERIC(12,2) NOT NULL DEFAULT 0,
    rates_snapshot    JSONB,                -- rate card values at generation time
    spot_snapshot     JSONB,                -- metal spot prices at generation time
    items_snapshot    JSONB,                -- item lines as sent (immutable copy)
    created_by        BIGINT REFERENCES staff(id),
    reviewed_by       BIGINT REFERENCES staff(id),   -- internal sign-off, before sending
    reviewed_at       TIMESTAMPTZ,
    sent_at           TIMESTAMPTZ,
    decided_at        TIMESTAMPTZ,
    pdf_url           TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (claim_id, version)
);
CREATE INDEX idx_quotes_claim ON quotes (claim_id);

-- ----------------------------------------------------------------------------
-- DOCUMENTS — photos, valuations, receipts, stat decs, generated reports.
-- ----------------------------------------------------------------------------
CREATE TABLE documents (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    claim_id      BIGINT REFERENCES claims(id) ON DELETE CASCADE,
    claim_item_id BIGINT REFERENCES claim_items(id) ON DELETE CASCADE,
    doc_type      TEXT NOT NULL DEFAULT 'other'
                  CHECK (doc_type IN ('photo','valuation','receipt','stat_dec','warranty',
                                      'quote_pdf','report','invoice','other')),
    filename      TEXT NOT NULL,
    url           TEXT NOT NULL,
    uploaded_by   BIGINT REFERENCES staff(id),
    uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_documents_claim ON documents (claim_id);

-- ----------------------------------------------------------------------------
-- CLAIM NOTES — dated customer discussions / EOO notes from the Q Sheet,
-- now timestamped and attributed.
-- ----------------------------------------------------------------------------
CREATE TABLE claim_notes (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    claim_id   BIGINT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    staff_id   BIGINT REFERENCES staff(id),
    note_type  TEXT NOT NULL DEFAULT 'internal'
               CHECK (note_type IN ('customer_discussion','eoo','internal','insurer')),
    note       TEXT NOT NULL,
    noted_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notes_claim ON claim_notes (claim_id, noted_at DESC);

-- ----------------------------------------------------------------------------
-- JOBS — production side (Job Sheet). Created when a quote is approved so
-- nothing is re-keyed. Components mirror the job sheet's supplier lines.
-- ----------------------------------------------------------------------------
CREATE TABLE jobs (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    claim_id       BIGINT NOT NULL REFERENCES claims(id) UNIQUE,
    quote_id       BIGINT REFERENCES quotes(id),
    job_number     TEXT UNIQUE,
    items_taken    TEXT,
    start_date     DATE,
    due_date       DATE,
    owner_id       BIGINT REFERENCES staff(id),
    stage          TEXT NOT NULL DEFAULT 'awaiting_deposit'
                   CHECK (stage IN ('awaiting_deposit','cad_approval','in_production',
                                    'quality_check','ready_for_collection','completed','cancelled')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE job_components (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    job_id        BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    claim_item_id BIGINT REFERENCES claim_items(id),
    category      TEXT,
    carat         TEXT,
    colour        TEXT,
    description   TEXT,
    origin        TEXT,
    stock_no      TEXT,
    supplier      TEXT,
    invoice_no    TEXT,
    weight_gms    NUMERIC(10,3),
    rate_per_gm   NUMERIC(12,2),
    actual_cost   NUMERIC(12,2) NOT NULL DEFAULT 0
);
CREATE INDEX idx_components_job ON job_components (job_id);

-- ----------------------------------------------------------------------------
-- INVOICES — the Xero bridge. Rows are created here, pushed to Xero as DRAFT
-- for approval; the webhook updates status/paid_at back into this table.
-- ----------------------------------------------------------------------------
CREATE TABLE invoices (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    claim_id         BIGINT NOT NULL REFERENCES claims(id),
    quote_id         BIGINT REFERENCES quotes(id),
    invoice_number   TEXT,
    xero_invoice_id  TEXT UNIQUE,
    bill_to          TEXT NOT NULL DEFAULT 'insurer' CHECK (bill_to IN ('insurer','customer')),
    subtotal         NUMERIC(12,2) NOT NULL DEFAULT 0,
    gst              NUMERIC(12,2) NOT NULL DEFAULT 0,
    total            NUMERIC(12,2) NOT NULL DEFAULT 0,
    status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','draft_in_xero','awaiting_approval',
                                       'approved','sent','paid','voided')),
    issued_at        TIMESTAMPTZ,
    paid_at          TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoices_claim ON invoices (claim_id);

-- ----------------------------------------------------------------------------
-- STOCK ITEMS — loose stones, raw metal, ring mounts/configurations, and
-- finished pre-made pieces. Lets an assessor see, while quoting, whether a
-- matching item is already on hand or needs to be ordered. Category-specific
-- matching fields (stone type/shape/carat/quality, metal type/colour, mount
-- category/style) live in `attributes` JSONB using the same lookup codes as
-- claim_items/item_stones, rather than a wide set of mostly-null columns.
-- Deliberately does not auto-deduct when used on a quote — only a deliberate
-- edit changes the quantity.
-- ----------------------------------------------------------------------------
CREATE TABLE stock_items (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category          TEXT NOT NULL CHECK (category IN ('stone','metal','mount','finished')),
    description       TEXT NOT NULL,
    sku               TEXT,
    quantity          NUMERIC(12,3) NOT NULL DEFAULT 0,
    unit              TEXT NOT NULL DEFAULT 'pc' CHECK (unit IN ('pc','gm','ct')),
    reorder_threshold NUMERIC(12,3) NOT NULL DEFAULT 0,
    supplier          TEXT,
    cost              NUMERIC(12,2),
    suggested_rrp     NUMERIC(12,2),
    attributes        JSONB NOT NULL DEFAULT '{}',
    notes             TEXT,
    branch            TEXT NOT NULL DEFAULT 'melbourne' CHECK (branch IN ('melbourne','sydney')),
    active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_items_category ON stock_items (category) WHERE active;
CREATE INDEX idx_stock_items_attributes ON stock_items USING GIN (attributes);

-- ----------------------------------------------------------------------------
-- ACTIVITY LOG — who did what, when. Populated by the API on every write.
-- ----------------------------------------------------------------------------
CREATE TABLE activity_log (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    staff_id   BIGINT REFERENCES staff(id),
    entity     TEXT NOT NULL,               -- 'claim','quote','item','invoice'…
    entity_id  BIGINT NOT NULL,
    action     TEXT NOT NULL,               -- 'created','updated','sent','approved'…
    detail     JSONB,
    logged_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_entity ON activity_log (entity, entity_id, logged_at DESC);

-- ----------------------------------------------------------------------------
-- MANUAL CHAT LOG — every question asked of the Manuals page's chat
-- assistant, so gaps in the manuals can be found and filled. `matched=false`
-- rows trigger a developer email alert (see lib/mailer-adapter.mjs).
-- ----------------------------------------------------------------------------
CREATE TABLE manual_chat_log (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    question        TEXT NOT NULL,
    matched         BOOLEAN NOT NULL DEFAULT FALSE,
    matched_heading TEXT,                     -- the manual sub-heading it matched, if any
    page            TEXT,                     -- which page the assistant was asked from
    asked_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_manual_chat_unmatched ON manual_chat_log (matched, asked_at DESC);

-- ----------------------------------------------------------------------------
-- updated_at maintenance
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_customers_touch  BEFORE UPDATE ON customers   FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_claims_touch     BEFORE UPDATE ON claims      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_items_touch      BEFORE UPDATE ON claim_items FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_jobs_touch       BEFORE UPDATE ON jobs        FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_stock_items_touch BEFORE UPDATE ON stock_items FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ----------------------------------------------------------------------------
-- XERO CONNECTIONS — one row per connected Xero organisation (tenant).
-- Empty while running in stub mode. Populated by the OAuth2 callback once
-- real credentials are connected — see netlify/functions/xero-auth.mjs.
-- ----------------------------------------------------------------------------
CREATE TABLE xero_connections (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id     TEXT NOT NULL UNIQUE,        -- Xero organisation GUID
    tenant_name   TEXT,
    access_token  TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at    TIMESTAMPTZ NOT NULL,
    scopes        TEXT,
    connected_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_xero_connections_touch BEFORE UPDATE ON xero_connections
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ----------------------------------------------------------------------------
-- REPORTING VIEWS
-- ----------------------------------------------------------------------------

-- Open pipeline by insurer
CREATE VIEW v_pipeline AS
SELECT c.id AS claim_id, c.claim_number, c.status, c.branch, c.date_received,
       c.respond_by,
       cu.first_name || ' ' || cu.last_name AS customer,
       i.name AS insurer,
       COALESCE(q.total_retail, 0)  AS quoted_retail,
       COALESCE(q.total_nett, 0)    AS quoted_nett,
       (CURRENT_DATE - c.date_received) AS days_open,
       q.id AS quote_id,
       q.status AS quote_status,
       inv.invoice_number AS invoice_number,
       inv.xero_invoice_id AS xero_invoice_id
FROM claims c
JOIN customers cu ON cu.id = c.customer_id
LEFT JOIN insurers i ON i.id = c.insurer_id
LEFT JOIN LATERAL (
    SELECT id, status, total_retail, total_nett FROM quotes
    WHERE claim_id = c.id AND status <> 'superseded'
    ORDER BY version DESC LIMIT 1
) q ON TRUE
LEFT JOIN LATERAL (
    SELECT invoice_number, xero_invoice_id FROM invoices
    WHERE claim_id = c.id
    ORDER BY created_at DESC LIMIT 1
) inv ON TRUE
WHERE c.status NOT IN ('paid','closed','declined');

-- Quoted vs actual margin per job
CREATE VIEW v_job_margin AS
SELECT j.id AS job_id, j.job_number, c.claim_number, i.name AS insurer,
       q.total_nett   AS quoted_nett,
       COALESCE(SUM(jc.actual_cost), 0)          AS actual_cost,
       q.total_nett - COALESCE(SUM(jc.actual_cost), 0) AS margin
FROM jobs j
JOIN claims c  ON c.id = j.claim_id
LEFT JOIN insurers i ON i.id = c.insurer_id
LEFT JOIN quotes q   ON q.id = j.quote_id
LEFT JOIN job_components jc ON jc.job_id = j.id
GROUP BY j.id, j.job_number, c.claim_number, i.name, q.total_nett;

COMMIT;
