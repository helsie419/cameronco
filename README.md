# Cameron & Co CRM

One project, two parts: a branded CRM demo prototype and the real insurance
quoting system + production backend it's growing into.

## 1. CRM demo prototype (`index.html`)

Standalone branded CRM proof of concept for a manufacturing jeweller. Open
`index.html` directly in a browser — data is demo-only and persists in
browser `localStorage`.

Demonstrates:
- End-to-end customer enquiry, quote, job, completion, and follow-up flow
- Cameron & Co branded UI using the existing logo, palette, typography direction, and jewellery imagery
- Trello-style job board with draggable cards and manual status editing
- Clickable job and customer records with a drawer showing prior jobs, correspondence, tasks, and satisfaction
- Customer capture with jewellery-specific preferences and consent
- Quote and job costing, margin, deposit, balance, approvals, and workflow stages
- Communication logging with customer/work links and merge-field templates
- Automation schedule for quote follow-ups, collection reminders, 30-day completion emails, and cleaning reminders
- Owner dashboard, management reports, data-quality checks, and export audit simulation

## 2. Insurance quoting system & CRM backend

The real, database-backed system this project is becoming. Covers the
quoting engine: customer → claim → items, versioned quote generation,
configurable rate cards, a Xero bridge, and the job board — plus the database
everything above builds on.

### What's here

```
db/schema.turso.sql            Turso/SQLite schema — the one actually applied to the live database
db/seed.turso.sql              Staff, insurers, lookups, rate cards & watch brand rates (Turso)
db/schema.sql / db/seed.sql    Postgres equivalents — kept as the import source for db:import-postgres, not run directly against the live database
db/schema-diagram.png          ER diagram of the schema (see note below — slightly stale)
netlify/functions/api.mjs      CRUD API (customers, claims, items, quotes, lookups, rates)
netlify/functions/jobs.mjs     Job board API — create from approved claims, stage/component management
netlify/functions/rate-admin.mjs   Rate card & watch brand rate admin API (versioned)
netlify/functions/xero.mjs     Xero routes: status, contact sync, draft invoices, webhook
netlify/functions/email.mjs    Read-only IMAP lookup for customer correspondence
netlify/functions/lib/xero-adapter.mjs   Stub + live Xero implementations behind one interface
netlify/functions/lib/pdf.mjs  Renders a quote (items, totals) to a customer-facing PDF
netlify/functions/lib/mailer-adapter.mjs   Stub + live "email quote to customer" implementations
netlify/functions/metal-prices.mjs   Scheduled daily AUD spot price fetch
netlify/functions/stock.mjs    Stock/inventory API — list, create, edit, and match against a quote in progress
assets/crm.css                 Shared brand stylesheet
quote-entry.html + assets/quote-entry.js   Main quoting screen — now shows live stock availability
quotes.html                    Pipeline list (Quotes) — "PDF" / "Email quote" / "Send to Xero"
job-board.html                 Job board — kanban by production stage, component costing, margin
rates.html                     Rate card & watch brand rate configuration screen
stock.html                     Stock/inventory ledger — stones, metal, mounts, finished pieces
user-manuals.html              Staff manuals and workflow help
netlify.toml / package.json    Netlify config + dependencies (pg, @netlify/database, dotenv)
```

Three companion documents, also in this folder: `DATA_DICTIONARY.md` (every
table/column explained), `FIELD_COVERAGE_AUDIT.md` (every spreadsheet field
checked off against the database), and `PRICING_MODELS.md` (the five pricing
formulas by item type, with the rate discrepancies flagged).

For staff workflow guidance, open `user-manuals.html`.

Static dropdown/reference values from the supplied Excel workbooks are loaded
by `db/migrations/002_static_values_from_workbooks.sql`. It extracts lists
from `QBE ASSESSMENT.xlsx`, `JOB SHEET.xlsx`, and `CMS - template.xlsb`,
including quote dropdowns, message templates, phone-book rows, production
cost defaults, granular metal rates, and the full watch-brand rate matrix.

### 1. Set up the database

Running on **Turso** (hosted libsql/SQLite) — every Netlify Function goes
through `netlify/functions/lib/db.mjs`, which wraps `turso-db.mjs` and reads
`TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`. There is no Postgres in the live
request path.

```bash
npm run db:setup     # applies db/schema.turso.sql, db/seed.turso.sql, then the workbook reference-data migration, via TURSO_DATABASE_URL/TURSO_AUTH_TOKEN
npm run db:migrate   # applies any Turso-side migrations not yet recorded in schema_migrations
```

`db/setup-turso.mjs` runs `schema.turso.sql` → `seed.turso.sql` →
`migrations/002_static_values_from_workbooks.sql` against Turso. It's meant
to run once against a fresh database; re-running is not idempotent for the
schema step. `db/migrate-turso.mjs` tracks applied files in a
`schema_migrations` table and only runs new ones — that's the one to use for
picking up schema changes on a database that already has data in it.

Postgres still exists in this project, but only as a **migration source**:
`db/schema.sql` / `db/seed.sql` are the Postgres-syntax originals the Turso
schema was derived from, and `npm run db:import-postgres` (`db/
import-postgres-to-turso.mjs --replace`) reads from a Postgres `DATABASE_URL`
and writes into the Turso database — useful if source data ever lands in
Postgres first, not part of normal operation. Nothing in `netlify/functions`
reads `DATABASE_URL` at request time.

**Before going live, confirm which Turso database Netlify's site settings
actually point at.** The `TURSO_DATABASE_URL` currently in local `.env` is a
`-staging` database (`cameronco-crm-staging-*.turso.io`) — check Netlify's
env vars separately; don't assume they match local `.env`.

### 2. Rate cards are fully configurable

Every rate that used to be hardcoded (gold/gm, chain/gm, setting, casting,
labour, box & valuation, markup, and now watch brand discounts) lives in
`rate_cards` / `watch_brand_rates` with a proper admin API and screen —
**`rates.html`**. Nothing needs a SQL migration to change a price.

Key design point: **editing a rate never overwrites it.** `POST
/api/rate-admin/rates` closes off the current version (`effective_to =
today`) and inserts a new one — every quote that already used the old rate
keeps it forever in its `rates_snapshot`. "Retire" works the same way. Full
version history for any code is available via `GET
/api/rate-admin/rates/history?code=X`, and the screen has a "history" link
next to each rate showing exactly that.

This also closed two real gaps from the field-coverage audit:
- **Setting is no longer one flat $8 rate** — it's the six real tiers from
  the Make sheet (grain $4, pavé $6, claw $8, small/mid/large stone
  $13/$20/$40)
- **Watch brand discounts** now have a real table (`watch_brand_rates`,
  brand × insurer → discount % or POA), seeded with a sample of brands from
  the WATCHES reference tab. Add more via the Rate Cards screen — no code
  changes needed

Try it — open `rates.html`, or hit the API directly:
```
GET  /api/rate-admin/rates
POST /api/rate-admin/rates          { "code": "LABOUR", "category": "labour_per_hr", "rate": 70, "unit": "hr" }
GET  /api/rate-admin/rates/history?code=LABOUR
GET  /api/rate-admin/watch-rates?insurer_id=0     (0 = Shop Sales / retail default)
POST /api/rate-admin/watch-rates    { "brand": "Cartier", "insurer_id": null, "rate_type": "poa" }
```

### 3. Xero integration — running with a stub for now

No Xero account to test against yet, so the integration is built behind an
adapter with two implementations:

| `XERO_MODE` | What happens |
|---|---|
| `stub` *(default — no env var needed)* | Generates fake contact/invoice IDs, writes them into the real `xero_contact_id` / `xero_invoice_id` columns, logs `[xero:stub]` to the console so it's never mistaken for real output. Includes a `/api/xero/webhook/simulate-paid` route so you can test the full approve → invoice → paid flow without a Xero account at all. |
| `live` | Real OAuth2 + Xero Accounting API calls. Needs `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, and a completed OAuth connection stored in the `xero_connections` table. |

Nothing else in the codebase changes when you flip this — same routes, same
database columns, same UI. The "Send to Xero" button on the Quotes
pipeline (visible once a claim is `approved`) calls the same
`/api/xero/invoices` route either way.

Try it today, with the database already provisioned:
```
POST /api/xero/invoices                { "claim_id": 1, "quote_id": 1 }
POST /api/xero/webhook/simulate-paid   { "invoice_id": 1 }
GET  /api/xero/status
```

**When real Xero credentials exist:** set `XERO_MODE=live`, add
`XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_REDIRECT_URI`,
`XERO_CONNECT_SECRET`, and `XERO_TOKEN_ENCRYPTION_KEY` to the local
environment (and later Netlify). `POST /api/xero/auth/start` requires the
connect secret header and returns the Xero approval URL. The callback stores
only AES-256-GCM encrypted tokens in `xero_connections`; the encryption key
is never stored in Turso. Use `accounting.contacts accounting.invoices
offline_access` as the requested scopes.

### 4. Quote PDF & email — running with a stub for now

Same reasoning, same pattern as Xero above: no live mailbox to send from yet,
so `lib/mailer-adapter.mjs` sits behind one interface with two
implementations:

| `EMAIL_SEND_MODE` | What happens |
|---|---|
| `stub` *(default — no env var needed)* | Builds the real PDF, logs `[mailer:stub]` with the recipient, subject and attachment size to the console, and returns a fake message id — nothing leaves the server. |
| `live` | Real SMTP send via `nodemailer`. Needs `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` (the same SiteGround mailbox already used for read-only IMAP in `email.mjs` will usually also send outgoing mail). |

The PDF itself (`lib/pdf.mjs`) is generated fresh from the quote's stored
snapshot every time — no object storage (R2/S3) needed, and no risk of a
downloaded PDF ever drifting from what's in the database. The letterhead
(logo, address, phone, email, ABN) is picked automatically from the claim's
`branch` — Melbourne and Sydney each have their own entity/ABN.

**Quotes must be internally approved before they can be sent.** This is
deliberately a separate concept from the existing `approved` quote status
(which still means the customer/insurer accepted it, and still gates job
creation and Xero invoicing, unchanged):

| Quote status | Meaning |
|---|---|
| `draft` | Just generated. Claim shows as **Pending approval** in the pipeline. Can be previewed as a PDF but not emailed. |
| `ready_to_send` | Reviewed and approved by an `admin`, or any staff member with `can_approve_quotes` set (`POST /api/quotes/:id/review` — rejects everyone else with a 403). Toggle the flag per-person on the Staff table in **`static-data.html`**, without reclassifying their role. |
| `sent` | Emailed to the customer. Claim flips to **Quote sent** at this point, not at generation. |
| `approved` / `declined` | The customer/insurer's decision — unchanged, still set via `PUT /api/quotes/:id/status`, no dedicated button yet (see "Still to build"). |

On the Quotes pipeline, each row's actions depend on where its quote is in
that lifecycle: **PDF** (preview, available any time a quote exists),
**Approve** (only on a `draft` quote — uses whichever staff member is
selected under **Approving as**, persisted per-browser), and **Email quote**
(only once `ready_to_send` or already `sent`). Nothing else changes when you
flip `EMAIL_SEND_MODE` to live:

```
POST /api/quotes/1/review    { "staff_id": 4 }
GET  /api/quotes/1/pdf
POST /api/quotes/1/send
```

This is one generic PDF template, not per-insurer branded formats — that
refinement is still open, see "Still to build" below.

### 5. Stock / inventory

Loose stones, raw metal, ring mounts/configurations, and finished pre-made
pieces — **`stock.html`** is the ledger, **`stock.mjs`** is the API. Grew out
of a spreadsheet audit that found the old CMS template's `STOCK` tab was a
live lookup screen, not a stored ledger — there was no historical stock data
to migrate, so this is a forward-looking feature built from scratch.

Category-specific matching fields (stone type/shape/carat/quality, metal
type/colour, mount category/style) live in one `attributes` JSONB column
rather than a wide set of mostly-null typed columns, using the same lookup
codes already used on `claim_items`/`item_stones` — so a quote's in-progress
fields can be matched straight against stock with no translation layer.

**Deliberately does not auto-deduct stock when it's used on a quote** — a
quote is a proposal, not a commitment, and stock only changes via a
deliberate edit on `stock.html`. On the quote-entry screen, as an assessor
fills in a stone's type/shape/carat/quality, or an item's metal type/colour/
category, a badge appears showing whether a match exists in stock or needs
ordering — purely informational, it never touches pricing or quantities:

```
GET /api/stock/match?category=stone&stone_type=diamond&shape=oval_cut&carat=0.5&quality=h_si
GET /api/stock/match?category=metal&metal_type=18ct&metal_colour=yellow_gold
GET /api/stock/match?category=mount&item_category=rings&metal_type=18ct&metal_colour=yellow_gold
```

Loose stones get a carat tolerance (±15%, minimum ±0.03ct) since a real stone
is never an exact match — the other fields match exactly. "Finished /
pre-made pieces" is a fourth stock category but isn't auto-matched inline;
it's a browse-only category on `stock.html`, since there's no single
in-progress quote field it maps to the way stones/metal/mounts do.

### 6. Job board

Approved claims flow straight into a job — nothing about the claim or its
items gets re-typed. **`job-board.html`** shows every job as a kanban board
across the six production stages (awaiting deposit → CAD approval → in
production → quality check → ready for collection → completed).

Creating a job (`POST /api/jobs`) automatically creates one `job_components`
row per item on the claim, pre-filled with category/colour/weight/description
— staff then fill in the real production detail (supplier, stock number,
invoice number, actual cost) as the job progresses. Every job card shows a
live margin: quoted nett (frozen on the approved quote) minus the actual
component costs entered so far.

A few guardrails worth knowing about: a claim can't get a second job once it
has one, and a job can't be created from a claim that isn't `approved` yet —
both enforced server-side, not just in the UI.

Try it — open `job-board.html`, or hit the API directly:
```
GET  /api/jobs/eligible-claims           approved claims without a job yet
POST /api/jobs                           { "claim_id": 1 }
GET  /api/jobs/1                         job + components + source claim items
PUT  /api/jobs/1                         { "stage": "in_production" }
PUT  /api/jobs/components/1              { "actual_cost": 520.50, "supplier": "ABC Casting" }
```

### 7. Environment variables (Netlify site settings)

| Variable | Purpose |
|---|---|
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | Turso (libsql) connection — the live database every function actually reads/writes |
| `DATABASE_URL` | Postgres connection string — only used by `db:import-postgres` as a migration source, not read at request time |
| `METAL_API_KEY` | Key for metalpriceapi.com (daily gold/silver/platinum AUD spot) |
| `XERO_MODE` | `stub` (default) or `live` — see §3 |
| `XERO_CLIENT_ID` / `XERO_CLIENT_SECRET` | Only needed once `XERO_MODE=live` |
| `IMAP_HOST` | SiteGround mail server, usually `mail.yourdomain.com` |
| `IMAP_PORT` | IMAP port, usually `993` |
| `IMAP_SECURE` | `true` for SSL/TLS IMAP |
| `IMAP_USER` / `IMAP_PASSWORD` | Mailbox username and password |
| `IMAP_MAILBOXES` | Comma-separated folders to scan, for example `INBOX,Sent,Sent Items,INBOX.Sent` |
| `IMAP_SCAN_LIMIT` | Recent messages to inspect per folder; default `100` |
| `EMAIL_SEND_MODE` | `stub` (default) or `live` — see §4 |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | Outgoing mail server, only needed once `EMAIL_SEND_MODE=live` |
| `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | Mailbox credentials and from-address for sending quotes |

`xe.com` doesn't offer a usable public metals spot API, so the scheduled
function uses **metalpriceapi.com** instead — same idea, dedicated provider.
Swap providers by editing `fetchSpot()` in `metal-prices.mjs` only.

### 8. Deploy

```bash
npm install
netlify deploy --prod
```

The scheduled function runs weekday mornings (`30 21 * * 0-4` UTC ≈ 7:30am
AEST) and needs no manual trigger — Netlify's scheduler picks it up once
deployed.

### 9. Try it

- Local database-backed testing, without deploying:
  ```bash
  npm run dev
  ```
  Open the `http://localhost:...` URL printed in the terminal. This local
  server loads `.env`, serves the CRM pages, and routes `/api/*` to the same
  Netlify Function files, so it reads the configured Turso database without
  pushing changes to Netlify. Do not open the HTML files directly when you
  want database-backed testing — direct file preview cannot call `/api/*`.

- `quotes.html` — the pipeline. Empty until the first quote exists.
- `quote-entry.html` — start a new quote, or open `quote-entry.html?claim=1`
  to load an existing one.
- `job-board.html` — jobs created from approved claims.
- `rates.html` — view/edit rate cards and watch brand rates.

All three screens fall back to bundled sample lookups/rates if the API isn't
reachable yet, so you can preview the UI before the database is live — it'll
just say saves aren't possible until it's connected.

### What's been tested

The pass below predates the move to Turso — ran against a real local
Postgres 16 instance throughout (not mocked), back when Postgres was still
the live database. `test:turso` / `verify:turso-staging` (see `scripts/`)
are the equivalent checks against the current Turso-backed API; run those
for an up-to-date pass rather than treating this section as current:

- Schema creates cleanly; seed is idempotent on repeated runs
- Full API flow: create customer → create claim with nested items, stones and
  costings → fetch claim back with all nesting intact → add a note → generate
  a quote (snapshots rates + spot prices) → revise it (old version marked
  `superseded`) → approve → confirm the pipeline view reflects the latest
  quote → partial update (status-only) confirmed **not** to null out other
  claim fields
- Scheduled metal price fetch, with a stubbed provider response, confirmed the
  AUD-per-ounce → AUD-per-gram conversion and storage
- Xero stub adapter: approve a quote → create a draft invoice (correct
  GST-inclusive split, e.g. $2,950 → $2,681.82 + $268.18 GST) → bills the
  insurer when one exists on the claim, the customer otherwise → re-syncing
  a contact reuses the existing `xero_contact_id` rather than duplicating it
  → simulated payment webhook flows the claim through to `paid` status
- Quote PDF & email, against a real multi-item claim: `GET /quotes/:id/pdf`
  renders a correctly laid-out PDF (checked visually, not just "200 OK") with
  the item table, totals and excess note all matching the database, and the
  logo/address/ABN switching correctly by branch → `POST /quotes/:id/send` in
  stub mode logs the recipient/subject/attachment size, flips the quote from
  `draft` to `sent`, and stamps `sent_at` → re-ran the same flow through an
  actual headless browser click on the Quotes pipeline (not just the API
  directly) and confirmed the toast and network calls match
- Internal approval gate on a fresh claim: generating a quote parks the claim
  at `pending_approval` (not `quote_sent`, which now only fires once actually
  emailed) → sending a `draft` quote is rejected with a 400 → approving as a
  non-admin (`Tracey`, role `assessor`) is rejected with a 403 naming the
  role → approving as `Admin` moves it to `ready_to_send` → only then does
  `POST /quotes/:id/send` succeed → confirmed the same sequence by clicking
  through the actual **Approve** / **Email quote** buttons in a browser
- Stock/inventory: created a stone, a metal, and a mount stock item → hit a
  real bug here (see below) → `/api/stock/match` correctly finds a diamond
  within the carat tolerance band and correctly returns nothing for a stone
  type not in stock → on the actual quote-entry screen, filling in a stone's
  type/shape/carat/quality shows a live "in stock" badge, and switching to an
  unstocked stone type flips it to "order needed" within the debounce window
  → same confirmed for the metal-type/colour and mount (item category +
  metal) checks → confirmed loading an existing claim with items still works
  with no console errors, since this touched the shared item-card code
- Rate card admin: list current rates → correct a rate the *same day* it was
  entered (a real bug was caught and fixed here — see below) → confirm full
  version history is preserved → confirm the live rate list only shows the
  current version → retire a rate → watch brand rates including the
  `insurer_id IS NULL` ("Shop Sales") case, both on initial seed and on
  same-day correction
- Job board: confirm a non-approved claim can't get a job (rejected
  server-side) → approve a claim → confirm it appears in "eligible claims" →
  create a job → confirm one `job_components` row was auto-created per claim
  item, correctly carrying over weight/colour/description → edit a component
  (supplier, invoice number, actual cost) → confirm the partial update left
  `description`/`weight_gms` untouched → move the job through stages → add
  and remove an ad-hoc component line (e.g. delivery, not tied to a claim
  item) → confirm the board's margin calculation (quoted nett − actual cost)
  reflects it correctly → confirm a claim can't get a second job

Bugs caught and fixed during this process (not just claimed — each was
reproduced against real Postgres, fixed, and re-tested):
1. A Postgres parameter type-inference issue: `COALESCE($n, 0)` forced
   numeric columns to be read as integer, rejecting decimal quantities like
   `4.2` grams.
2. The claim `PUT` route originally overwrote untouched fields with `NULL`
   on a partial update.
3. Same-day rate card corrections initially violated a `UNIQUE(code,
   effective_from)` constraint, because superseding a rate added earlier
   the same day left both the old and new row dated today. Fixed by
   replacing it with a partial unique index enforcing "only one *current*
   version per code" — the actual invariant that was wanted — rather than
   uniqueness on the date.
4. The same `COALESCE($n, 0)` type-inference issue from bug #1 resurfaced in
   the new job-components insert (`actual_cost` rejected `18.50` as an
   invalid integer) — same fix, cast the literal (`0::numeric`).

**A further critical review pass** (before any real deployment) found and
fixed four more issues — see `SOUNDNESS_REVIEW.md` for the full detail on
each, including how they were reproduced and re-verified:

5. Private (non-insurance) claims could silently get duplicate claim
   numbers — the same `NULL`-uniqueness gotcha as bug #4, this time on
   `claims.claim_number`. Fixed the same way.
6. The Xero invoice amount used a `nett || retail || 0` fallback chain,
   which both mishandled a legitimately-$0 nett (falling through to bill
   retail instead) and used the wrong field entirely depending on who
   should actually be billed. Fixed to branch explicitly on whether the
   claim has an insurer, rather than any fallback chain.
7. "One job per claim" was only enforced in application code — a real race
   condition, confirmed by firing 5 genuinely concurrent requests at the
   same claim. Fixed with an actual database-level `UNIQUE` constraint on
   `jobs.claim_id`.
8. Business-rule rejections (claim already has a job, claim not approved)
   were returning HTTP 500 instead of a proper 4xx status, found while
   fixing #7.
9. The exact same `COALESCE($n, 0)` type-inference issue from bug #1 (integer
   inferred instead of numeric) resurfaced in the new `POST /api/stock`
   route — creating a metal stock item with a fractional weight like `25.5`
   grams was rejected outright. Same fix: cast the literal (`0::numeric`).

**The one item flagged as a genuine blocker before production use:** there
is currently no authentication on any route or screen. Anyone with the URL
can create, edit, or approve claims. See `SOUNDNESS_REVIEW.md` for the full
list of what's fixed versus what's still open.

### Still to build

- Xero OAuth2 connection flow (`xero-auth.mjs`) — the live adapter is
  written and ready, this is the one remaining piece
- Live outgoing mail — `EMAIL_SEND_MODE=live` needs a real SMTP mailbox; see §4
- Per-insurer branded PDF formats (QBE, Allianz, etc.) — one generic template
  exists today (`lib/pdf.mjs`), not insurer-specific layouts
- A screen/button for the customer/insurer's own decision on a sent quote
  (`approved` / `declined`) — the route (`PUT /api/quotes/:id/status`) and the
  job/invoice gating that depends on it both exist, only the UI doesn't yet
- Document/photo upload (R2 or similar) wired to the `documents` table
- Dashboard screen tying the two parts of this project together (link from
  `index.html`'s nav into `quotes.html` / `job-board.html` / `rates.html`)
- Google Calendar booking integration
- User authentication / roles (the schema has `staff.role` ready for this)
- The remaining gaps from `FIELD_COVERAGE_AUDIT.md` not yet closed: clasp
  type, stone-level setting type/size, valuation amount as a third price
  figure, customer gap-payment contribution, a few production cost types
  (CAD drawing, casting house, sub-contractor, rhodium plating, delivery —
  schema now supports them as `item_costings.cost_type` values, just needs
  UI wiring), credit notes, manual cost overrides, PDS flag, tracking numbers
- Stock quantities are entered/edited by hand on `stock.html` — no supplier
  feed, barcode scanning, or automatic deduction when a job actually
  consumes an item (deliberate for now, see §5)

None of these need schema changes beyond what's already in `schema.sql` —
the tables are already there waiting to be wired up.

**Note on the schema diagram:** `db/schema-diagram.png` predates the Xero,
rate-card-admin, and stock/inventory work — it doesn't yet show
`xero_connections`, `watch_brand_rates`, or `stock_items`. Worth a single
regenerate once the job board/documents work lands too, rather than four
partial refreshes.
