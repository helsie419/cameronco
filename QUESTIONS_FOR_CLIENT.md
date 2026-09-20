Questions for Cameron & Co

Below are the open items we need your input on before we can finish this off properly. Numbered sequentially so we can refer back to specific ones.


MISSING RATE CARDS

The pricing calculators on the quote screen only work if a rate exists for the metal/category selected. Right now several combinations have no rate at all, so staff either can't get a price or have to type one in by hand with nothing backing it up.

1. Necklace, Pendant, Bracelet — these share the "chain" pricing dropdown, but none of them has a rate actually labelled for its own type — only Chain (9/14/18ct, local/imported) and Earring/charm (9/18/21-22ct, imported only) rates exist. Do these price at the same $/gm as Chain, or do they need their own rates? (Bangle is covered separately below, questions 5-7.)

2. Watches, Brooch, Copy E/ring, Belt — no pricing rate exists for any of these at all; staff can only type a dollar figure in manually. Should these have proper $/gm or flat rates, or is manual entry intentional for these categories?

3. Rings / Repairs — only has gold rates for 9ct and 18ct. No rate exists for 10ct, 14ct, 21ct, 22ct, 24ct, Platinum, Sterling silver, Stainless steel, or Base metal, even though all of these are selectable as a metal type elsewhere on the form. What are the manufacturing rates for these metals?

4. Earring/charm — only has imported rates (9/18/21-22ct). Is there a local manufacture rate for earrings/charms, or is local not offered for this category?


BANGLE PRICING & SIZING

Per your description, a plain Bangle is a solid piece of gold and should price like a Ring, while Golf bangle, Bracelet, and Padlock bracelet are freeform/chain-like and should be priced like chain. We've now set this up that way.

5. Please confirm this matches how bangles are actually priced in practice — especially since a solid Bangle currently falls back to the same 9ct/18ct-only manufacturing rates as Rings (the gap in question 3 above).

6. There's an existing list of chain styles in the system that includes "Hinged bangle" as one of its options — which suggests some bangles (hinged/hollow ones) might actually need to be priced as chain rather than as solid gold. Should Bangle be split into two types (solid vs hinged/hollow) that price differently, rather than treating every Bangle as solid?

7. The "Chain style" field (a free-text box: curb, rope, etc.) only appears on the form for chain-type items, so it no longer shows for a solid Bangle (nor do Width/Length). What should capture a solid bangle's size instead — e.g. internal diameter?


EDITING ITEMS AFTER A JOB HAS BEEN RAISED

Found while testing: once a job has been created from a claim, going back to the quote screen and saving changes to that claim's items now fails with an error, because the job keeps its own link back to the original item and the save process currently clears and rebuilds all items from scratch. This needs a decision from you, not just a fix on our end:

8. Should staff still be able to edit item details (metal, weight, stones, pricing, etc.) on a claim after a job has been raised against it, or should items become locked/read-only at that point, with any changes made through the Job Board instead?


RETAIL MARKUP AND WATCH BRAND RATES

9. The 2.75x retail markup used on the Ring/Manufacture and category calculators (applied to stones + gold + setting + casting + labour + box to produce the "suggested retail" figure) was seeded from a spreadsheet comment reading "adjust to actual practice" — it was never confirmed as your real number. Is 2.75x correct, or does the actual markup differ (and does it vary by item type)?

10. The 14ct chain rate differs between the two source spreadsheets you gave us — $220 local / $235 imported in one, $150 local / $220 imported in the other — and we've currently seeded the first. Which is correct? Also, one sheet has a 21-22ct local chain rate ($200) the other leaves blank — should that rate be added?

11. The watch brand rate table is only seeded with 6 sample brands (Rolex, Omega, Tag Heuer, Citizen, Seiko, Casio) against 2 insurers (Suncorp Metway, Allianz), as a placeholder for the real ~90-brand sheet. Every other insurer we've listed (AAMI, GIO, Vero, QBE, Elders, Crawford, Cunningham & Lindsay, IVAA, etc.) currently has no watch rates at all, so staff will just see "no rate on file" for them. Can you send the full brand-by-insurer discount table so this can be filled in properly before go-live?


CLAIM AND JOB STATUS GAPS

12. The claim statuses "Revised", "Declined" and "Closed" exist in the system and appear as filters/badges on the Quotes screen, but nothing currently sets a claim to any of them — even declining a quote leaves the parent claim sitting in the active pipeline. When a customer or insurer declines a quote, should the claim automatically move to a closed/declined state, or is that meant to be a manual step by staff (and if so, where should that happen)?

13. "Cancelled" is a selectable stage on the Job Board, but there's no logic behind it yet — no reason/note is required, and nothing happens to the claim status, any deposit already invoiced, or materials already drawn against the job. What should happen when a job is cancelled after work has started — does the claim need updating, does a deposit need refunding/crediting in Xero, and should staff have to record a reason?

14. Job stages on the board can currently be moved in any order or skipped entirely (e.g. straight from "Awaiting deposit" to "Completed", or backwards from "Ready for collection"). Is that flexibility intentional so staff can correct mistakes, or should some stages be gated (e.g. can't mark "Completed" without passing through "Quality check" first)?


INSURER EXCESS

15. The customer's policy excess is captured on the claim and printed as a note on the customer PDF ("Policy excess payable by customer"), but there's no invoice or payment record for it anywhere — Xero only ever bills the full nett to the insurer or full retail to the customer. In practice, how is the excess actually collected — a separate in-store payment, a separate Xero invoice, or deducted from the insurer settlement? We'd like to track it properly rather than leave it as a printed note.


STOCK ACROSS BRANCHES

16. The "in stock" check on the quote screen doesn't currently filter by branch, even though stock items and claims both record a branch (Melbourne/Sydney). Could a Sydney assessor be told a stone or mount is "in stock" when it's actually only held in Melbourne, or is stock meant to be treated as shared/transferable between the two branches for quoting purposes?

17. Stock quantities are only ever adjusted by a deliberate manual edit — picking a stock item against a job component doesn't reduce the stock count, and the two aren't linked (the job component just stores a free-text stock number). Should using a stock item on a job automatically reduce its stock quantity, or is manual reconciliation the intended process?
