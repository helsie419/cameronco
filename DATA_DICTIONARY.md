# Cameron & Co — Database Reference

Every table in `db/schema.sql`, in the order the business flow moves through
them: reference data → customer/claim → item detail → quote → production →
finance. Two reporting views are listed at the end.

---

## staff

Internal users. Referenced by claims, notes, jobs and the activity log to
track who did what.

| Column | Type | Description |
|---|---|---|
| `id` | identity PK | |
| `full_name` | text, unique | e.g. Tracey, April, Workshop, Admin |
| `email` | text, unique | |
| `role` | text | `admin` · `assessor` · `case_manager` · `workshop` · `sales` |
| `branch` | text | `melbourne` · `sydney` — home branch |
| `active` | boolean | soft-disable instead of deleting |
| `created_at` | timestamptz | |

---

## insurers

The paying client on insurance work. Each insurer has its own claim
correspondence and report format.

| Column | Type | Description |
|---|---|---|
| `id` | identity PK | |
| `name` | text, unique | e.g. QBE, Allianz, AAMI Home Claims |
| `claims_email` | text | inbound claim correspondence address |
| `phone` | text | |
| `assessment_format` | text | which report template to generate — `GENERIC` · `QBE` · `ALLIANZ` · `ELDERS` · `CRAWFORD` · `CL` · `IVAA` |
| `xero_contact_id` | text | Xero Contact GUID, filled in once synced |
| `notes` | text | |
| `active` | boolean | |
| `created_at` | timestamptz | |

## insurer_contacts

Named people at an insurer (a claims handler, a case manager).

| Column | Type | Description |
|---|---|---|
| `id` | identity PK | |
| `insurer_id` | FK → insurers | cascades on delete |
| `full_name` | text | |
| `email` | text | |
| `phone` | text | |
| `active` | boolean | |

---

## customers

The claimant on insurance work, or the buyer on private/retail work. One
customer can have many claims — this is the anchor for "everything about this
person in one place."

| Column | Type | Description |
|---|---|---|
| `id` | identity PK | |
| `first_name` | text | |
| `last_name` | text | defaults to empty string, not null |
| `email` | text | |
| `phone` | text | |
| `mobile` | text | |
| `address_line1` / `address_line2` | text | |
| `suburb` | text | |
| `state` | text | |
| `postcode` | text | |
| `customer_type` | text | `private` · `insurance` · `retail_partner` · `trade` |
| `consent_marketing` | boolean | |
| `consent_email` | boolean | |
| `consent_sms` | boolean | |
| `xero_contact_id` | text | Xero Contact GUID once synced |
| `notes` | text | |
| `created_at` / `updated_at` | timestamptz | `updated_at` auto-maintained by trigger |

---

## claims

One insurance (or private) claim — the header record equivalent to the Q
Sheet. A customer can have many; each claim can have many items.

| Column | Type | Description |
|---|---|---|
| `id` | identity PK | |
| `claim_number` | text | the insurer's claim number |
| `our_ref` | text | Cameron & Co's internal reference |
| `your_ref` | text | insurer's internal ref, if different from claim number |
| `customer_id` | FK → customers, not null | |
| `insurer_id` | FK → insurers | **null = private work, no insurer involved** |
| `insurer_contact_id` | FK → insurer_contacts | who at the insurer this claim is with |
| `branch` | text | `melbourne` · `sydney` |
| `assessment_type` | text | lookup domain `assessment_type` |
| `validation_type` | text | lookup domain `validation_type` (e.g. "Phone 1–5 items") |
| `date_received` | date | defaults to today |
| `assigned_to` | FK → staff | who's handling it |
| `status` | text | pipeline stage — see below |
| `excess_amount` | numeric(12,2) | policy excess |
| `settlement_notes` | text | e.g. "Refer case manager" |
| `respond_by` | date | insurer/assessor's response-due date |
| `created_at` / `updated_at` | timestamptz | |

**`status` values, in pipeline order:** `new_enquiry` → `assessing` →
`quote_sent` → `revised` → `approved` → `awaiting_deposit` → `cad_approval` →
`in_production` → `quality_check` → `ready_for_collection` → `completed` →
`invoiced` → `paid` → `closed` (or `declined` at any point).

`claim_number` + `insurer_id` together must be unique — the same insurer
can't have two claims with the same number.

---

## claim_items

The numbered item sheets (1–18 in the original spreadsheets) — one row per
item on a claim, carrying its full specification.

| Column | Type | Description |
|---|---|---|
| `id` | identity PK | |
| `claim_id` | FK → claims, cascades on delete | |
| `item_no` | int | 1..n within the claim; unique per claim |
| `category` | text | lookup `item_category` (rings, watches, necklace…) |
| `item_type` | text | lookup `item_type` (engagement ring, signet ring…) |
| `description` | text | free text — what appears on the quote |
| `comment` | text | internal-only comment |
| `metal_type` | text | lookup `metal_type` (9ct, 18ct, platinum…) |
| `metal_colour` | text | lookup `metal_colour` (yellow/white/rose gold…) |
| `manufacture_origin` | text | lookup `manufacture_origin` (local/imported/Indian) |
| `chain_style` | text | free text |
| `ring_style` | text | free text |
| `repair_type` | text | free text |
| `weight_gms` | numeric(10,3) | |
| `width_mm` | numeric(10,2) | |
| `length_cm` | numeric(10,2) | |
| `finger_size` | text | |
| `watch_make` | text | only populated when the item is a watch |
| `watch_gents_ladies` | text | `gents` · `ladies` |
| `watch_current_model` | text | |
| `watch_replacement_model` | text | |
| `watch_metal` | text | |
| `proof_type` | text | lookup `proof_type` (photo, valuation, receipt…) |
| `eoo_status` | text | `satisfactory` · `no_eoo` · `limited_eoo` |
| `eoo_notes` | text | appears on the insurer report |
| `policy_limit` | numeric(12,2) | per-item limit from the policy, if any |
| `retail_price` | numeric(12,2) | recommended retail, inc. GST |
| `insurance_nett` | numeric(12,2) | nett amount billed to the insurer |
| `liability` | numeric(12,2) | nett/retail after the policy limit is applied |
| `fulfilment` | text | `supply` · `supply_alternative` · `refer_cm` |
| `status` | text | `draft` · `quoted` · `approved` · `in_production` · `completed` · `cancelled` · `unable_to_quote` |
| `created_at` / `updated_at` | timestamptz | |

## item_stones

Repeating stone lines per item (an item can have several stones).

| Column | Type | Description |
|---|---|---|
| `id` | identity PK | |
| `claim_item_id` | FK → claim_items, cascades on delete | |
| `line_no` | int | ordering within the item |
| `stone_type` | text | lookup `stone_type` (diamond, sapphire, ruby…) |
| `shape` | text | lookup `stone_shape` (RBC, oval, princess…) |
| `stone_count` | int | how many stones this line represents |
| `carat_each` | numeric(8,3) | |
| `total_carat` | numeric(8,3) | usually `stone_count × carat_each` |
| `quality` | text | lookup `stone_quality` (e.g. G/VS) |
| `certificate` | text | GIA or other cert reference |
| `cost_per_carat` | numeric(12,2) | from the diamond calculator |
| `cost` | numeric(12,2) | extended cost for this line |

## item_costings

The manufacturing cost lines from the Ring/Chain calculators. Each line
stores the **rate actually used**, so a historic quote never silently
changes value when the rate card is later updated.

| Column | Type | Description |
|---|---|---|
| `id` | identity PK | |
| `claim_item_id` | FK → claim_items, cascades on delete | |
| `line_no` | int | ordering within the item |
| `cost_type` | text | `stone` · `gold` · `setting` · `casting` · `labour` · `box_valuation` · `chain_per_gm` · `component` · `other` |
| `description` | text | e.g. "Manufacturing gold 18ct" |
| `qty` | numeric(12,3) | grams, hours, or pieces depending on `unit` |
| `unit` | text | `gm` · `hr` · `pc` |
| `rate` | numeric(12,2) | rate applied at the time |
| `amount` | numeric(12,2) | `qty × rate` |

---

## rate_cards

Versioned pricing — replaces the hardcoded numbers in the old spreadsheet
calculators (9ct local $115/gm, labour $65/hr, setting $8, box & valuation
$26, etc). A new row with a later `effective_from` supersedes the old one;
historic quotes keep whatever was frozen into their `rates_snapshot`.

| Column | Type | Description |
|---|---|---|
| `id` | identity PK | |
| `code` | text | e.g. `CHAIN_9CT_LOCAL`, `MFG_GOLD_18CT`, `LABOUR` |
| `label` | text | human-readable name |
| `category` | text | `chain_per_gm` · `earring_charm_per_gm` · `mfg_gold_per_gm` · `setting_per_stone` · `casting` · `labour_per_hr` · `box_valuation` · `markup` |
| `metal_type` | text | 9ct / 14ct / 18ct / 21–22ct, where relevant |
| `origin` | text | local / imported, where relevant |
| `rate` | numeric(12,4) | |
| `unit` | text | defaults to `gm` |
| `effective_from` | date | |
| `effective_to` | date | null = currently active |
| `created_at` | timestamptz | |

`code` + `effective_from` together must be unique.

## metal_prices

Daily AUD spot price history for gold/silver/platinum, populated by the
scheduled function. Also the audit trail behind every quote's spot snapshot.

| Column | Type | Description |
|---|---|---|
| `id` | identity PK | |
| `metal` | text | `gold` · `silver` · `platinum` · `palladium` |
| `currency` | text | defaults to `AUD` |
| `price_per_oz` | numeric(14,4) | |
| `price_per_gm` | numeric(14,4) | |
| `source` | text | e.g. `metalpriceapi.com` |
| `fetched_at` | timestamptz | |

---

## quotes

A versioned quote against a claim. Generating a new version **freezes** the
rates and spot prices used, plus a copy of the item lines — so a rate card
update or a revision never silently changes an already-sent quote.

| Column | Type | Description |
|---|---|---|
| `id` | identity PK | |
| `claim_id` | FK → claims, cascades on delete | |
| `version` | int | 1, 2, 3… per claim |
| `status` | text | `draft` · `sent` · `approved` · `declined` · `superseded` |
| `total_retail` | numeric(12,2) | inc. GST |
| `total_nett` | numeric(12,2) | insurance nett |
| `total_liability` | numeric(12,2) | after policy limits |
| `postage_handling` | numeric(12,2) | |
| `salvage_allocation` | numeric(12,2) | scrap/salvage deduction |
| `rates_snapshot` | jsonb | rate card values frozen at generation time |
| `spot_snapshot` | jsonb | metal spot prices frozen at generation time |
| `items_snapshot` | jsonb | immutable copy of the item lines as quoted |
| `created_by` | FK → staff | |
| `sent_at` | timestamptz | |
| `decided_at` | timestamptz | when approved/declined |
| `pdf_url` | text | generated report, once that's built |
| `created_at` | timestamptz | |

`claim_id` + `version` together must be unique. Generating a new version
automatically marks the previous `draft`/`sent` version as `superseded`.

---

## documents

Photos, valuations, receipts, stat decs, and generated reports — attached to
either a claim as a whole or a specific item.

| Column | Type | Description |
|---|---|---|
| `id` | identity PK | |
| `claim_id` | FK → claims, cascades on delete | nullable |
| `claim_item_id` | FK → claim_items, cascades on delete | nullable |
| `doc_type` | text | `photo` · `valuation` · `receipt` · `stat_dec` · `warranty` · `quote_pdf` · `report` · `invoice` · `other` |
| `filename` | text | |
| `url` | text | wherever it's stored (e.g. R2) |
| `uploaded_by` | FK → staff | |
| `uploaded_at` | timestamptz | |

## claim_notes

Dated, attributed notes on a claim — customer discussions, EOO notes,
internal comments, or notes to/from the insurer.

| Column | Type | Description |
|---|---|---|
| `id` | identity PK | |
| `claim_id` | FK → claims, cascades on delete | |
| `staff_id` | FK → staff | who wrote it |
| `note_type` | text | `customer_discussion` · `eoo` · `internal` · `insurer` |
| `note` | text | |
| `noted_at` | timestamptz | |

---

## jobs

The production side — created once a quote is approved, so nothing from the
claim/quote needs to be re-typed. Mirrors the old Job Sheet.

| Column | Type | Description |
|---|---|---|
| `id` | identity PK | |
| `claim_id` | FK → claims | |
| `quote_id` | FK → quotes | which approved quote this job fulfils |
| `job_number` | text, unique | |
| `items_taken` | text | free text |
| `start_date` | date | |
| `due_date` | date | |
| `owner_id` | FK → staff | who's running the job |
| `stage` | text | `awaiting_deposit` · `cad_approval` · `in_production` · `quality_check` · `ready_for_collection` · `completed` · `cancelled` |
| `created_at` / `updated_at` | timestamptz | |

## job_components

Supplier/material lines per job — mirrors the job sheet's component table
(category, carat, colour, supplier, invoice, weight, rate).

| Column | Type | Description |
|---|---|---|
| `id` | identity PK | |
| `job_id` | FK → jobs, cascades on delete | |
| `claim_item_id` | FK → claim_items | which quoted item this component fulfils |
| `category` | text | |
| `carat` | text | |
| `colour` | text | |
| `description` | text | |
| `origin` | text | |
| `stock_no` | text | |
| `supplier` | text | |
| `invoice_no` | text | supplier's invoice reference |
| `weight_gms` | numeric(10,3) | |
| `rate_per_gm` | numeric(12,2) | |
| `actual_cost` | numeric(12,2) | what it actually cost — feeds `v_job_margin` |

---

## invoices

The Xero bridge. A row here is created as a draft, pushed to Xero, and its
status/`paid_at` gets updated by Xero's payment webhook (or the stub
simulator, while there's no live Xero connection).

| Column | Type | Description |
|---|---|---|
| `id` | identity PK | |
| `claim_id` | FK → claims | |
| `quote_id` | FK → quotes | which quote this invoice bills |
| `invoice_number` | text | Cameron & Co's own numbering, e.g. `CC-1-1` |
| `xero_invoice_id` | text, unique | Xero's InvoiceID once created (or a `STUB-INV-…` id in stub mode) |
| `bill_to` | text | `insurer` · `customer` |
| `subtotal` | numeric(12,2) | ex GST |
| `gst` | numeric(12,2) | |
| `total` | numeric(12,2) | inc GST |
| `status` | text | `pending` · `draft_in_xero` · `awaiting_approval` · `approved` · `sent` · `paid` · `voided` |
| `issued_at` | timestamptz | |
| `paid_at` | timestamptz | set when the payment webhook fires |
| `created_at` | timestamptz | |

## xero_connections

One row per connected Xero organisation. Empty while running in stub mode —
populated once the real OAuth2 flow is completed.

| Column | Type | Description |
|---|---|---|
| `id` | identity PK | |
| `tenant_id` | text, unique | the Xero organisation's GUID |
| `tenant_name` | text | |
| `access_token` | text | short-lived OAuth2 token |
| `refresh_token` | text | used to mint new access tokens |
| `expires_at` | timestamptz | when the access token expires |
| `scopes` | text | granted OAuth2 scopes |
| `connected_at` / `updated_at` | timestamptz | |

---

## activity_log

A generic audit trail — every write the API makes can drop a row here
recording who did what to which record.

| Column | Type | Description |
|---|---|---|
| `id` | identity PK | |
| `staff_id` | FK → staff | |
| `entity` | text | e.g. `claim`, `quote`, `item`, `invoice` |
| `entity_id` | bigint | id of the record acted on |
| `action` | text | e.g. `created`, `updated`, `sent`, `approved` |
| `detail` | jsonb | free-form extra context |
| `logged_at` | timestamptz | |

---

## manual_chat_log

Every question asked of the Manuals page's chat assistant (client-side
keyword search, not AI — see `user-manuals.html`). `matched=false` rows are
gaps in the manuals; the API emails `MANUAL_ALERT_EMAIL` when one is logged
(see `lib/mailer-adapter.mjs`).

| Column | Type | Description |
|---|---|---|
| `id` | identity PK | |
| `question` | text | what was typed into the chat box |
| `matched` | boolean | whether the search found a manual section |
| `matched_heading` | text | the sub-heading it matched, if any |
| `page` | text | which page the assistant was asked from |
| `asked_at` | timestamptz | |

---

## lookup_values

Every dropdown value the office might need to add or rename without a
schema change — item types, metal types, proof types, stone shapes, and so
on, all in one table keyed by `domain`.

| Column | Type | Description |
|---|---|---|
| `id` | identity PK | |
| `domain` | text | e.g. `item_type`, `metal_type`, `proof_type`, `stone_shape` |
| `code` | text | the stored value (matches what claims/items reference) |
| `label` | text | what's shown in the UI |
| `sort_order` | int | display order within the domain |
| `active` | boolean | soft-disable instead of deleting |
| `extra` | jsonb | optional metadata per value |

`domain` + `code` together must be unique.

---

## Reporting views

These aren't tables — they're queries that assemble a live report from the
tables above, so nothing needs to be duplicated or manually kept in sync.

### v_pipeline

Every open claim (excludes `paid`, `closed`, `declined`) joined to its
customer, insurer, and the totals from its latest non-superseded quote, plus
how many days it's been open. This is what feeds the Quotes & Jobs pipeline
screen.

### v_job_margin

Per job: the quoted nett amount from its linked quote, the actual cost
summed from `job_components`, and the difference — quoted-vs-actual margin,
ready for reporting once the job board screen is built.
