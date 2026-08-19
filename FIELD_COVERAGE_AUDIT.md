# Field Coverage Audit — Spreadsheets vs. Database

This checks every field found across the four source workbooks
(`QBE_ASSESSMENT.xlsx`, `Assessment_Sheet.xlsx`, `JOB_SHEET.xlsx`,
`CMS__template.xlsb`) against what's actually in `db/schema.sql`.

**Legend:** ✅ covered · ⚠️ partially covered / covered differently · ❌ not
yet built

*Re-verified 2026-07-13 by re-opening `QBE ASSESSMENT.xlsx`, `JOB SHEET.xlsx`,
and `CMS - template.xlsb` directly and diffing every field claim against the
current `schema.sql`/`seed.sql`/`quote-entry.js`. Two entries (tiered setting
rates, watch brand rates) had been fixed at the database/admin-screen level
since this audit was first written but not updated here — see the Setting
and WATCHES rows below, and the new item 0 in the summary for a live
calculator bug that surfaced while checking the first one.*

*Re-verified again 2026-07-16 by reading every tab of `CMS - template.xlsb`
directly (converted to Google Sheets to make it readable) rather than
relying on the earlier pass's tab list. Found the workbook actually has nine
tabs, not the four originally named in the CMS section below — added the
previously-unchecked `File Header` tab, named `PHONE`/`NOTES` explicitly
(already covered, just never named here), and corrected the stock-ledger
fields from "Enquiry tab" to their actual home, the `STOCK` tab. Also
confirmed by row count that `Main Data`/`Accounting` hold only 3 legacy
records — not a live table — while `Workshop` has ~3,638 real job records
never imported; per the user, that historical import is explicitly not
happening, so it's noted here for completeness only, not as an open task.*

---

## Q Sheet (QBE_ASSESSMENT.xlsx & Assessment_Sheet.xlsx)

| Spreadsheet field | Status | Where / note |
|---|---|---|
| Claim no | ✅ | `claims.claim_number` |
| Client (customer name) | ✅ | `customers.first_name/last_name` |
| From (staff who prepared it) | ✅ | `claims.assigned_to` |
| Date | ✅ | `claims.date_received` |
| Our ref | ✅ | `claims.our_ref` |
| Your ref | ✅ | `claims.your_ref` |
| Validation type | ✅ | `claims.validation_type` |
| Settlement description ("Jewellery replacement" etc.) | ✅ | `claims.settlement_notes` |
| Postage, handling & insurance | ✅ | `quotes.postage_handling` |
| Allocation for salvage/scrap | ✅ | `quotes.salvage_allocation` |
| Insurance liability total | ✅ | `quotes.total_liability` |
| Total quoted retail | ✅ | `quotes.total_retail` |
| Total nett before limits | ✅ | `quotes.total_nett` |
| Overall limit — unlisted | ✅ | `quotes` — captured in the quote entry screen, not yet a dedicated column (currently folded into the liability calc) |
| Item # (1–18) | ✅ | `claim_items.item_no` |
| CAT (category) | ✅ | `claim_items.category` |
| CARAT | ✅ | `claim_items.metal_type` |
| Item limit / total limit | ✅ | `claim_items.policy_limit` |
| Retail Price | ✅ | `claim_items.retail_price` |
| Ins Nett | ✅ | `claim_items.insurance_nett` |
| Fulfilment (Supply/Supply Alt/Refer CM) | ✅ | `claim_items.fulfilment` |
| Liability — limits applied | ✅ | `claim_items.liability` |
| EOO (per item) | ✅ | `claim_items.eoo_status`, `eoo_notes` |
| Date lodged (per item, CMS tracking) | ❌ | Not built — see Gaps |
| Customer discussions (dated log) | ✅ | `claim_notes` with `note_type='customer_discussion'` |
| Evidence of ownership notes (dated log) | ✅ | `claim_notes` with `note_type='eoo'`, plus `claim_items.eoo_notes` |
| Pages (report page count) | ❌ | Not stored — cosmetic report field, low priority |

---

## Item sheets 1–18 (all three workbook variants)

| Spreadsheet field | Status | Where / note |
|---|---|---|
| Item type | ✅ | `claim_items.item_type` |
| Proof (evidence type) | ✅ | `claim_items.proof_type` |
| Metal type | ✅ | `claim_items.metal_type` |
| Metal colour | ✅ | `claim_items.metal_colour` |
| Manufacture type (local/imported/Indian) | ✅ | `claim_items.manufacture_origin` |
| Chain style | ✅ | `claim_items.chain_style` |
| Ring style | ✅ | `claim_items.ring_style` |
| Repair type | ✅ | `claim_items.repair_type` |
| Weight | ✅ | `claim_items.weight_gms` |
| Width | ✅ | `claim_items.width_mm` |
| Length | ✅ | `claim_items.length_cm` |
| **Clasp type** | ❌ | **Not built.** This is a genuine dropdown list in the Reference tab (parrot, swivel, bolt ring, pearl, barrel, etc.) with its own field on every item sheet — `claim_items` has no `clasp_type` column |
| Finger size | ✅ | `claim_items.finger_size` |
| Free description | ✅ | `claim_items.description` |
| Comment | ✅ | `claim_items.comment` |
| Stone type | ✅ | `item_stones.stone_type` |
| Stone shape | ✅ | `item_stones.shape` |
| # Stones | ✅ | `item_stones.stone_count` |
| Carat weight (each / total) | ✅ | `item_stones.carat_each`, `total_carat` |
| Quality | ✅ | `item_stones.quality` |
| Certificate | ✅ | `item_stones.certificate` |
| **Stone size (mm, distinct from carat)** | ❌ | **Not built** — item sheets have a "Size" column per stone separate from carat weight |
| **Stone setting type (grain/pave/claw)** | ❌ | **Not built** — item sheets have a "Setting:" column per stone row; `item_stones` has no equivalent |
| Watch make | ✅ | `claim_items.watch_make` |
| Watch gents/ladies | ✅ | `claim_items.watch_gents_ladies` |
| Watch current model | ✅ | `claim_items.watch_current_model` |
| Watch replacement model | ✅ | `claim_items.watch_replacement_model` |
| Watch metal | ✅ | `claim_items.watch_metal` |
| Watch description | ⚠️ | Falls back to the item-level `description` field — the sheet has a separate watch-specific description box |
| Ring calculator: stone cost | ✅ | `item_costings` (`cost_type='stone'`), also `item_stones.cost` |
| Ring calculator: gold manufacturing rate | ✅ | `rate_cards` (`MFG_GOLD_9CT`, `MFG_GOLD_18CT`) |
| Ring calculator: setting | ⚠️ | **See Gaps** — only one flat rate seeded; the real rate card (Make sheet) has 6 tiers |
| Ring calculator: casting | ✅ | `rate_cards` (`CASTING`) |
| Ring calculator: labour | ✅ | `rate_cards` (`LABOUR`) |
| Ring calculator: box & valuation | ✅ | `rate_cards` (`BOX_VALUATION`) |
| Chain calculator: 9/14/18ct local & imported rates | ✅ | `rate_cards` (`CHAIN_*`) |
| Earring/charm calculator rates | ✅ | `rate_cards` (`EARR_*`) |

---

## Lists / Reference tabs (both assessment workbooks)

| Spreadsheet field | Status | Where / note |
|---|---|---|
| Insurance company list (AAMI, QBE, Vero, etc.) | ✅ | `insurers` table, seeded |
| Insurer contact name / email | ✅ | `insurer_contacts` |
| Proof types | ✅ | `lookup_values` domain `proof_type` |
| Validation types | ✅ | `lookup_values` domain `validation_type` |
| Assessment/quote request types (QBE, Allianz, Elders, Crawford, C&L, IVAA) | ✅ | `lookup_values` domain `assessment_type`, `insurers.assessment_format` |
| Fulfilment options | ✅ | `claim_items.fulfilment` CHECK constraint |
| Client discussion canned phrases | ✅ | Captured as free text in `claim_notes.note` (the canned phrases were reference wording, not codes to store separately) |
| EOO canned phrases | ✅ | Free text in `claim_items.eoo_notes` |
| EOO status (Satisfactory / No EOO / Limited EOO) | ✅ | `claim_items.eoo_status` |
| **PDS requirement flag (Yes/No)** | ❌ | **Not built** — Reference tab has a discrete Yes/No PDS-required flag distinct from `eoo_status` |
| **PDS requirement canned phrases** | ⚠️ | Would currently go in free-text `eoo_notes`, but these are a distinct structured list in the source (e.g. "Minimum PDS values applied…") — not modelled as their own lookup domain |
| Category list | ✅ | `lookup_values` domain `item_category` |
| Item type list | ✅ | `lookup_values` domain `item_type` |
| Metal type list | ✅ | `lookup_values` domain `metal_type` |
| Metal colour list | ✅ | `lookup_values` domain `metal_colour` |
| Manufacture origin list | ✅ | `lookup_values` domain `manufacture_origin` |
| Ring style list | ✅ | Currently free text (`claim_items.ring_style`) rather than a constrained lookup — works, but doesn't match the dropdown in the source exactly |
| Chain style list | ✅ | Same as above — free text, not a constrained lookup |
| Chain length list (17–100+ cm) | ⚠️ | `claim_items.length_cm` is a free numeric field, not tied to the specific preset list of lengths in the source |
| Clasp type list (parrot, swivel, bolt ring…) | ❌ | Tied to the missing `clasp_type` field above |
| Stone type / shape / quality lists | ✅ | `lookup_values` domains `stone_type`, `stone_shape`, `stone_quality` |

---

## Job Sheet (JOB_SHEET.xlsx)

| Spreadsheet field | Status | Where / note |
|---|---|---|
| Items taken | ✅ | `jobs.items_taken` |
| Start date | ✅ | `jobs.start_date` |
| Claim number | ✅ | via `jobs.claim_id → claims.claim_number` |
| Category | ✅ | `job_components.category` |
| CT (carat) | ✅ | `job_components.carat` |
| Colour | ✅ | `job_components.colour` |
| Description | ✅ | `job_components.description` |
| Origin | ✅ | `job_components.origin` |
| Stock no | ✅ | `job_components.stock_no` |
| **Model no & diamond details** | ❌ | **Not built** — the job sheet has this as its own column distinct from `description` |
| Supplier | ✅ | `job_components.supplier` |
| Invoice no | ✅ | `job_components.invoice_no` |
| Weight | ✅ | `job_components.weight_gms` |
| $/gm/pc rate | ✅ | `job_components.rate_per_gm` |
| **Manual cost override** | ❌ | **Not built** — the sheet allows a manually entered cost distinct from the weight × rate calculation; `job_components` only has the one `actual_cost` field |
| Cost ex GST / Suggested RRP / Invoice inc GST / RRP | ⚠️ | These are calculated summary columns in the sheet — derivable from stored data (`v_job_margin` covers the cost-vs-quote comparison) rather than needing their own storage |
| **Credit note (for jewellery)** | ❌ | **Not built** — no dedicated field or table for a jeweller credit note amount against a job |
| Invoice number / date / payment date (claim invoice details) | ✅ | `invoices.invoice_number`, `issued_at`, `paid_at` |
| Total spend | ⚠️ | Derivable from `SUM(job_components.actual_cost)` — already what `v_job_margin` computes, not stored as its own field |

---

## Make sheets (production build cost breakdown)

| Spreadsheet field | Status | Where / note |
|---|---|---|
| **Casting house (external invoice cost)** | ❌ | **Not built as a distinct type** — `item_costings.cost_type` has `'casting'` for the flat $5 rate-card casting fee, but the sheet also has a separate "Casting house" line for actual external casting invoices — these are two different things currently sharing one bucket |
| **CAD Drawing** | ❌ | **Not built** — no `cost_type` for this |
| **Print and Cast fees** | ❌ | **Not built** — no `cost_type` for this |
| Labour (hours × rate) | ✅ | `item_costings` (`cost_type='labour'`), `rate_cards.LABOUR` |
| Metal (weight × rate) | ✅ | `item_costings` (`cost_type='gold'`) |
| **Sub-contractor** | ❌ | **Not built** — no `cost_type` for this (would currently fall into the generic `'other'` bucket, losing reporting granularity) |
| **Rhodium plate + polish** | ❌ | **Not built** — same as above |
| **Setting — tiered by technique/size** | ⚠️ | **Updated since this audit was last written — and a real bug found in re-checking it.** `seed.sql` now seeds all six tiers (`SETTING_GRAIN` $4, `SETTING_PAVE` $6, `SETTING_CLAW` $8, `SETTING_SMALL` $13, `SETTING_MID` $20, `SETTING_LARGE` $40), replacing the old flat `SETTING` code entirely. But `quote-entry.js` (line ~430) still does `push('setting', 'Setting', settingQty, 'pc', RATES.SETTING?.rate || 0)` — it looks up the now-deleted `SETTING` code, gets `undefined`, and silently falls back to a rate of **0**. Every quote's setting cost currently computes as $0 in the live calculator. The UI also has no tier picker, so even fixing the lookup needs a dropdown for which of the six tiers applies |
| Stone details (weight × $/ct) | ✅ | `item_stones` / `item_costings` |
| **Delivery costs** | ❌ | **Not built** — no `cost_type` for this |
| Total cost / Retail / Nett (summary) | ⚠️ | Derivable from the sum of `item_costings`, not stored as standalone fields |

---

## WATCHES tab (brand pricing & discount matrix)

| Spreadsheet field | Status | Where / note |
|---|---|---|
| **Watch brand list with per-insurer sell price / % discount** (Suncorp, Allianz, Guild, Shop Sales — each with its own rate per brand: A/X, Adidas, Rolex, Omega, etc.) | ⚠️ | **Updated since this audit was last written.** `schema.sql` now has the `watch_brand_rates` table (brand, insurer_id, rate_type, rate_value, versioned the same way as `rate_cards`), `seed.sql` seeds it with brands from the WATCHES tab across all four insurer columns, and `rates.html` has a full add/edit/delete admin screen for it. What's still missing: `quote-entry.js` never queries `watch_brand_rates` — the watch section only toggles field visibility (line ~318), it doesn't look up the brand+insurer discount and apply it to the quote. So the reference data and admin tooling exist; the automatic lookup during quoting doesn't yet |

---

## Diamond calc tab

| Spreadsheet field | Status | Where / note |
|---|---|---|
| Stone size (carat) | ✅ | `item_stones.carat_each` / `total_carat` |
| Price per carat | ✅ | `item_stones.cost_per_carat` |
| Cost (size × price per carat) | ✅ | `item_stones.cost` |

---

## Quote tab (outward insurer-facing document)

| Spreadsheet field | Status | Where / note |
|---|---|---|
| To / Attention / Email (insurer contact) | ✅ | `insurer_contacts` |
| Client / Address | ✅ | `customers` |
| Your ref / Our ref | ✅ | `claims.your_ref`, `our_ref` |
| Validation type | ✅ | `claims.validation_type` |
| Claim description | ✅ | `claim_items.description` |
| Retail / Cost ex GST | ✅ | `claim_items.retail_price` (cost ex GST is derivable from `item_costings`) |
| Insurance Nett | ✅ | `claim_items.insurance_nett` |
| Proof of ownership | ✅ | `claim_items.proof_type`, `eoo_status` |
| **Cameron's Cost Price** (shown per item on the quote) | ⚠️ | Derivable by summing that item's `item_costings`, but not stored as its own first-class column the way the source treats it as a named figure |

---

## Sales Receipt tab

| Spreadsheet field | Status | Where / note |
|---|---|---|
| Supplied to / Date / Customer ref | ✅ | `customers`, `claims.our_ref` |
| Payment method | ❌ | Not built — no field for how the customer/insurer paid |
| Claim number / Payment date | ✅ | `claims.claim_number`, `invoices.paid_at` |
| Nett value authorised | ✅ | `quotes.total_nett` |
| Retail price (per item) | ✅ | `claim_items.retail_price` |
| **Valuation (per item)** | ❌ | **Not built** — this is a third pricing figure distinct from Retail Price and Nett; `claim_items` has no `valuation_amount` column |
| **Less contribution from customer** (gap payment) | ❌ | **Not built** — no field for a customer's own top-up contribution when the item costs more than the insurance nett |

---

## Packing slip tab

| Spreadsheet field | Status | Where / note |
|---|---|---|
| Supplied to / Date / Customer ref | ✅ | `customers`, `claims` |
| **Tracking number** | ❌ | **Not built** — no courier tracking field on `jobs` or `documents` |
| Item description | ✅ | `claim_items.description` |

---

## CMS template — full tab list

*Re-verified 2026-07-16 by reading the workbook directly (converted to Google
Sheets for reading) tab by tab. The workbook actually has nine tabs: `Main
Data`, `Accounting`, `File Header`, `Enquiry`, `Workshop`, `PHONE`, `NOTES`,
`STOCK`, and an empty `Sheet1`. Earlier passes of this audit only named four
of them in this section's heading — `PHONE` and `NOTES` were always
functionally covered (see below) but never named here, and `File Header` was
never checked at all. Row-level check: `Main Data`/`Accounting` hold only 3
real historical records (Jan 2018) behind ~19,774 reserved-but-empty sequence
rows plus a block of leftover reference-list debris — not a live table worth
migrating. `Workshop` by contrast has ~3,638 real job records spanning
2018–2026, genuine business history — per the user, not being imported into
the live database (a deliberate choice, not a gap to fix here).*

Every tab keys off a sequential **Master # / Master Code** (e.g. `51137`) —
distinct from the insurer's `Claim #` (e.g. `H025181179`, which does map to
`claims.claim_number`). The Master # itself most plausibly belongs in
`claims.our_ref`, but was never explicitly checked against the schema until
now — flagging as ✅ covered there, no new field needed.

| Spreadsheet field | Status | Where / note |
|---|---|---|
| Customer name / address / contact numbers | ✅ | `customers` |
| **Zone** (postcode region marker) | ❌ | Not built — minor, likely reportable from `postcode` directly rather than needing its own field |
| Loss adjuster | ✅ | `insurer_contacts` (or `claim_notes`) |
| Claim # / Insurance company | ✅ | `claims.claim_number`, `insurers` |
| **Accounting: Item VALUE / EXCESS (amount)** | ⚠️ | Conceptually `claim_items.retail_price` / `claims.excess_amount`, but the Accounting-tab-specific columns were never explicitly cross-referenced until now |
| **Accounting: INVOICE No / INV DATE** (tab-level, distinct from the Job Sheet invoice fields already covered above) | ✅ | `invoices.invoice_number`, `issued_at` |
| **Accounting: Post** (postage at the Accounting-tab level) | ✅ | `quotes.postage_handling` |
| **Accounting: FILING REASONS ONLY** (free text, e.g. "Cash Settlement (over limit)") | ⚠️ | Same bucket as `claims.settlement_notes` — never explicitly cross-referenced until now |
| Sales Staff (appears twice in Main Data — same value both times) | ✅ | `claims.assigned_to` — harmless duplicate column in the source, not a gap |
| Non-insurance task description | ⚠️ | Covered structurally (`claims.insurer_id IS NULL` = private work), but the specific free-text "non insurance task" description isn't its own field — would currently go in `claims.settlement_notes` |
| **Client quotation appointment date(s)** | ❌ | Not built — appointment scheduling is planned separately as the Google Calendar booking workstream; flagging here so it isn't lost |
| **Quote due date** | ❌ | Not built |
| Quoted by | ✅ | `quotes.created_by` |
| Quoted method (phone/F2F/home) | ✅ | `claims.validation_type` |
| Date quote submitted | ✅ | `quotes.sent_at` |
| **Release date by insurance co** | ❌ | Not built |
| Settlement | ✅ | `claims.settlement_notes` |
| **Client replacement appointment** | ❌ | Not built — same as quotation appointment, part of the calendar workstream |
| **Do & charge release date / Pick-up appointment** | ❌ | Not built — same |
| Job start date | ✅ | `jobs.start_date` |
| Quote value / Release value | ✅ | `quotes.total_retail` / job completion values via `v_job_margin` |
| **Add-on invoiced value** | ❌ | Not built — a secondary invoice amount added after the main settlement; `invoices` only models one invoice per quote currently |
| **Date excess paid** | ❌ | Not built — distinct from `invoices.paid_at` |
| **Validation invoice** (separate invoice type for a validation-only fee) | ❌ | Not built — `invoices.bill_to` distinguishes insurer/customer but not a "validation fee" vs "settlement" invoice type |
| Stock enquiry screen — lives in a separate **`STOCK`** tab, not `Enquiry` as earlier passes of this audit said (fields: stock no, master no, CT/carat, metal, type, description, release date, sales person, paid flag, supplier, cost, invoice no, weight, suggested RRP, surname, name) | ✅ | **Built** — `stock_items` table, `netlify/functions/stock.mjs`, `stock.html`, and live availability badges on the quote-entry screen (stones, metal, mounts). The `STOCK` tab itself turned out to be a live lookup screen (formula-driven, keyed on whatever stock no. is typed in) rather than a stored ledger, so there was no historical stock data to migrate from it — this was a forward-looking feature, not a backfill |
| Workshop task log (job #, task, CAD/subbies cost lines, finished date) | ✅ / ⚠️ | The job tracking shape matches `jobs`/`job_components`; the CAD/subcontractor cost-line gap is the same one noted under Make sheets above |

### File Header tab (per-claim cover sheet — not checked in earlier passes)

| Spreadsheet field | Status | Where / note |
|---|---|---|
| Commencement date / Validation due date | ✅ / ❌ | Commencement ≈ `claims.date_received`; a distinct "due date" isn't its own field (same gap as "Quote due date" above) |
| Loss adjuster company / Contact A / Contact B / After-hours phone | ✅ | `insurer_contacts` |
| Appointment-type checklist (Phone / Face-to-face / Home) | ✅ | `claims.validation_type` |
| Document checklist (Uploaded / Val Invoice / CMS / RMS / **Job Sheet** / **CAD** / **Ring Sizer**) | ❌ | Not built — no per-document-type checklist; closest existing concept is the `documents` table's `doc_type` enum, which doesn't have `job_sheet`/`cad`/`ring_sizer` values |
| Retail $ / Nett $ / Limit per item / Overall limit / Excess / Confirmed | ✅ | `claim_items.retail_price`/`insurance_nett`/`policy_limit`, `claims.excess_amount` |
| **EOO three-way checkbox: EOO Supplied / AEC EOO / NO EOO** | ⚠️ | `claim_items.eoo_status` currently has `satisfactory`/`no_eoo`/`limited_eoo` — "AEC EOO" doesn't cleanly map to any of the three; worth confirming what AEC stands for before deciding whether it's the same as `limited_eoo` or a fourth state |
| Pick up / Delivery | ✅ | `claim_items.fulfilment` |
| **Post Pack Sent / Received dates** | ❌ | Not built — no dedicated dispatch/receipt date fields |
| **Claims Hub In / Out (date-time)** | ❌ | Not built — no field for tracking when a file entered/left the insurer's claims portal |

### PHONE / NOTES tabs — already covered, just never named in this doc

Both are reference-data tabs, already imported by `db/migrations/002_static_values_from_workbooks.sql`: `PHONE` (164 of 165 real rows) → `cms_phone_book` lookup domain; `NOTES` (~26 real rows) → `customer_message_template`/`insurer_note_template` domains. No gap — this is a documentation omission, not a functional one.

---

## Summary — what's genuinely missing

*(Re-verified against the live `schema.sql`/`seed.sql`/`quote-entry.js` — two items below were marked ❌ in an earlier pass of this audit but the database has since caught up; one of them turned out to hide an active calculator bug.)*

**Fix first — this is live and wrong, not just incomplete:**
0. **Setting cost calculates as $0 on every quote.** `seed.sql` replaced the single flat `SETTING` rate with six tiered codes (`SETTING_GRAIN`/`PAVE`/`CLAW`/`SMALL`/`MID`/`LARGE`), but `quote-entry.js` still looks up the deleted `SETTING` code and silently falls back to a rate of 0. Needs a tier picker in the UI plus fixing the lookup to use it.

Everything marked ❌ above, grouped by how much it matters:

**Worth prioritising:**
1. **Watch brand discount isn't applied during quoting** — the `watch_brand_rates` table, seed data, and admin screen (`rates.html`) all exist now; `quote-entry.js` just never queries them when quoting a watch
2. **Clasp type** field + lookup list
3. **Stone-level setting type and size** (mm)
4. **Valuation amount** as a third per-item price figure, and **customer contribution/gap payment**
5. **Additional production cost types** (CAD drawing, casting house, sub-contractor, rhodium plating, delivery) — the `item_costings.cost_type` enum already accepts all five values, `quote-entry.js` just never generates a line with them, so job costing reports lose that granularity into a generic "other" bucket

**Lower priority / easy to add later:**
7. Jeweller credit note amount
8. Manual cost override on job components
9. Model no & diamond details as its own job-component field
10. PDS requirement flag + its own canned-phrase list (separate from EOO status)
11. Courier tracking number
12. Add-on invoice / validation-only invoice / date excess paid — refinements to the invoicing model

**No longer out of scope — built:**
13. Stock/inventory ledger (the **`STOCK`** tab, mis-attributed to "Enquiry" in earlier passes of this audit) — see the CMS template section above and the README's "Stock / inventory" section for the full writeup.

**Still out of scope for now (by your earlier decision, not an oversight):**
14. Appointment/milestone dates (quotation appt, replacement appt, pick-up) — these belong to the separate Google Calendar booking workstream already on the roadmap

None of these require re-architecting anything — they're all additive columns, one new table (watch brands), and a few more `rate_cards` rows. Happy to build any or all of this next; just say which ones matter most for the first real jobs going through the system.
