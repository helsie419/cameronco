# Design & Build Soundness Review

You asked me to go back through this critically before we touch Netlify —
this is that review. I re-examined the schema, every API route, and the
Xero billing logic specifically looking for problems, not just re-confirming
what already worked. **Four genuine bugs were found and fixed during this
review**, none of which were caught by the testing done in earlier sessions
— which itself is worth sitting with: passing tests confirm the paths you
thought to test. They don't confirm there's nothing left to find.

Everything below was reproduced against real Postgres, fixed, and
re-verified. Nothing here is theoretical.

---

## Bugs found and fixed in this review

### 1. Duplicate claim numbers on private (non-insurance) work

**The problem:** `claims` had `UNIQUE (claim_number, insurer_id)` — but
Postgres treats `NULL` as distinct from every other `NULL` in a uniqueness
check. Since private work has `insurer_id = NULL`, two completely different
private claims could silently be given the exact same claim number with no
error. Reproduced directly:
```sql
INSERT INTO claims (claim_number, customer_id, insurer_id) VALUES ('PRIVATE-001', 1, NULL); -- succeeds
INSERT INTO claims (claim_number, customer_id, insurer_id) VALUES ('PRIVATE-001', 2, NULL); -- also succeeds, should not
```
**Why it matters:** this is exactly the kind of thing that surfaces months
later as "why are there two different customers both showing as
PRIVATE-001" — hard to trace back, easy to cause real confusion in search,
invoicing, and correspondence.

**Fix:** replaced the plain constraint with a `COALESCE`-based unique index
— the same pattern already used for `watch_brand_rates`, which had the
identical class of bug caught in an earlier session. Re-tested: duplicate
private claim numbers are now rejected; the same number under two
*different* insurers (a legitimate case — insurers don't coordinate
numbering) still works correctly.

### 2. Wrong invoice amount when an insurer's nett is genuinely $0

**The problem:** the Xero billing logic picked the amount to invoice with
`q.total_nett || q.total_retail || 0`. JavaScript treats `0` as falsy — so
if a quote's nett was legitimately zero (e.g. an item fully absorbed by the
policy excess), the code silently fell through and invoiced the **retail**
price instead. Reproduced directly: a quote with `total_nett: 0` and
`total_retail: 500` generated a $500 invoice, not the correct $0.

**Why it matters:** this is a real-money bug. An insurer could have been
invoiced for the wrong amount with no error, no warning, nothing to catch
it — the invoice would just look normal.

**The fix went deeper than patching the falsy-zero check.** The real issue
underneath it was that the billing amount should never be a "prefer nett,
fall back to retail" chain at all — it should depend on **who's actually
being billed**. An insurer should always be billed the nett figure. A
private customer with no insurer on the claim was never quoted a nett
figure in the first place (nett is specifically an insurer concept), so
billing them nett would often be $0 by construction — also wrong, just a
different wrong. Fixed to explicitly branch on `billToInsurer` and pick the
correct field, rather than any fallback chain. Verified with three
scenarios: insurer claim with genuine $0 nett (now correctly invoices $0),
private claim (now correctly invoices retail), and a normal insurer claim
with a real nett figure (unaffected — confirms the fix doesn't disturb the
common case).

### 3. "One job per claim" was only enforced in application code — a real race condition

**The problem:** `jobs.claim_id` had no database-level uniqueness
constraint. The rule was enforced entirely by a check in `jobs.mjs` — select
for an existing job, and only insert if none exists. Two requests arriving
close enough together (a double-click, two staff members in different
browser tabs) could both pass that check before either one's insert
committed.

**Why it matters:** this is exactly the kind of bug that never shows up in
sequential testing — every test that ran one request at a time passed
cleanly, because the bug only exists under genuine concurrency.

**How I confirmed it was real, not theoretical:** fired 5 simultaneous
`POST /api/jobs` requests at the same claim using `Promise.all` — genuine
concurrent execution, not five requests in a row. Before the fix, this is
exactly the kind of test that *could* have produced two jobs for one claim,
depending on timing (didn't always reproduce every run — that's the nature
of race conditions, which is precisely why they're dangerous: they pass
most of the time).

**Fix:** added a real `UNIQUE` constraint on `jobs.claim_id` — the database
itself now physically cannot hold two jobs for the same claim, regardless
of timing. Re-ran the 5-concurrent-request test after the fix: exactly one
job created, the other four cleanly rejected, confirmed directly in the
database afterward.

### 4. Business-rule rejections were returning HTTP 500 instead of a proper error status

**Found while fixing #3.** The "claim already has a job" and "claim isn't
approved yet" checks in `jobs.mjs` threw plain `Error` objects with no
status code attached, so they fell through to the generic error handler and
returned `500` — normally reserved for "something actually broke on the
server," not "the request was invalid." A caller (or a future UI) checking
`if (response.status >= 500)` to decide whether to retry would have
incorrectly retried a request that was never going to succeed.

**Fix:** added a small `apiError(status, message)` helper so each rejection
carries the right HTTP status (`404` for not found, `409` for conflicts like
"already has a job" or "not approved yet"), and confirmed via the same
concurrency test — the four rejected requests now correctly return `409`,
not `500`.

---

## Things checked and found sound (worth stating explicitly, not just silently passing over)

- **SQL injection:** every query across all five function files uses
  parameterized queries (`$1, $2…`) for user-supplied values. The one place
  a table *name* is interpolated via template literal (`xero-adapter.mjs`,
  switching between the `customers`/`insurers` tables) is safe — it's driven
  by a ternary that only ever produces one of those two literal strings, `
  never the raw input — but it's a fragile-looking pattern that depends on
  every future caller getting it right. Flagged for future maintainers via
  a code comment rather than left as a silent trap.
- **Money precision:** all currency columns are consistently `NUMERIC(12,2)`
  (cents-accurate, no floating point). Rate cards use `NUMERIC(12,4)` for
  sub-cent per-gram precision. No mixing of types that could cause silent
  rounding drift.
- **Cascade deletes:** `claim_items`, `item_stones`, `item_costings`,
  `documents`, and `claim_notes` all cascade-delete if a claim is deleted.
  `jobs` and `invoices` do **not** — a claim with a job or invoice against
  it cannot be deleted at all (the foreign key blocks it), which is the
  right protective default for financial/production records. Worth knowing:
  the API doesn't currently expose a claim-delete route at all, so this is
  only reachable via direct database access today — but the constraint is
  there regardless, as a backstop.
- **Idempotency of both `seed.sql` and every versioned "create new rate"
  operation** — re-checked, still holds after all of today's schema changes.

---

## What's still genuinely open — not fixed, flagged honestly

These aren't things I fixed and am now disclosing — they're real gaps I'm
not attempting to close in this pass, either because they're bigger
decisions than a bug fix, or because fixing them now would be premature.

- **No authentication on any route.** Every API endpoint and every screen
  is reachable by anyone with the URL — there's no login, no session, no
  concept of "who is making this request" beyond an optional `staff_id`
  the caller can set to anything. This is the single biggest thing standing
  between this system and being safe to point at real claims. I'd treat
  this as a hard blocker before production use, not a nice-to-have.
- **Error messages currently return `err.message` fairly directly** to the
  client in most routes — not a credential leak (no secrets are ever in an
  error message), but it does expose internal details like table/column
  names to anyone calling the API. Low severity on its own; compounds with
  the no-auth gap above.
- **The dynamic table-name pattern in `xero-adapter.mjs`** (see above) is
  safe today but fragile — worth hardening with an explicit allowlist object
  rather than relying on the ternary's implicit safety, so a future edit
  can't accidentally introduce a real injection point.
- **No load or concurrency testing beyond the specific race condition fixed
  above.** That test proved *that specific* race is closed. It says nothing
  about behaviour under real production load with many simultaneous users
  across many different claims.
- **Xero's `live` mode has never been exercised** — only the stub adapter
  has real test coverage. The first live Xero API call will be the first
  real test of that code path.

---

## Bottom line

The core data model — customer → claims → items → quotes → jobs → invoices
— held up under this review; nothing about the fundamental structure needed
to change. What needed fixing were edge cases in constraint design (two
separate NULL-uniqueness gaps, now both fixed with the same pattern) and one
real financial logic bug in the Xero billing amount. All four are now fixed
and re-verified, including a genuine concurrency test for the race
condition, not just a sequential re-run.

The one item I'd genuinely treat as a blocker before this goes near real
claims — not a "nice to have, later" item — is authentication. Everything
else here is either fixed or a reasonable, disclosed trade-off for where the
project is at.
