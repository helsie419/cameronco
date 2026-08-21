# Pricing Models by Item Type

Every costing formula found in the source spreadsheets, organized by item
type. Each shows the formula, the actual rates on file, where it lives in
the database now, and whether it's fully built into the quote-entry
calculator yet.

**Prices are inc. GST throughout**, per the note on every Q Sheet and Quote
template. Retail is what the customer/insurer is quoted; nett is what's
actually billed to the insurer.

---

## 1. Rings (and anything else "manufactured" — pendants, brooches, bracelets)

The Ring Calculator. Cost is built up from six components, then a markup is
applied to reach retail.

```
Manufactured cost = Stones + Gold + Setting + Casting + Labour + Box & Valuation
Retail            = Manufactured cost × markup
```

| Component | Formula | Rate on file |
|---|---|---|
| **Stones** | `Σ (total carat × $/carat)` per stone line | Rate entered per job — see §5 Diamond/Stone calculator |
| **Gold** | `weight (gm) × $/gm` | 9ct = **$45/gm**, 18ct = **$100/gm** |
| **Setting** | `stone count × $/stone` | **$8/stone flat** — but see ⚠️ below, the real rate card has six tiers |
| **Casting** | flat fee | **$5** |
| **Labour** | `hours × $/hr` | **$65/hr** |
| **Box & valuation** | flat fee | **$26** |
| **Markup → retail** | `cost × multiplier` | Not specified in the source sheets — a **2.75× placeholder** is currently seeded; needs your confirmation of the actual practice |

**⚠️ Setting is not actually one flat rate.** ~~The Make sheet~~ **Update:
this is now fixed** — the six real tiers below are seeded in `rate_cards`
and manageable via `rates.html`. The Make sheet (production build cost
breakdown, separate from the Ring Calculator on the item sheet) shows
setting technique and stone size each carry their own rate:

| Setting type / stone size | Rate |
|---|---|
| Grain setting | $4 |
| Pavé setting | $6 |
| Claw setting | $8 ← this is the one currently seeded as the flat rate |
| Stone with point — small | $13 |
| Mid-size stone | $20 |
| Large stone — up to 1ct | $40 |

Worth deciding: does the quote-entry screen need to ask "which setting type
and roughly what stone size?" per stone, or is the flat $8 claw rate close
enough for quoting purposes, with the granular rate only mattering once the
job goes into actual production costing?

**Additional production-only costs** (from the Make sheet, not currently on
the quote-entry calculator at all — these show up once a job is in the
workshop, not at quoting time):

| Cost | Rate |
|---|---|
| CAD drawing | cost entered per job |
| Casting house (external invoice) | cost entered per job |
| Print and cast fees | cost entered per job |
| Sub-contractor | cost entered per job |
| Rhodium plate + polish | qty × **$35** |
| Delivery | cost entered per job |

**Database:** `rate_cards` (categories `mfg_gold_per_gm`, `setting_per_stone`,
`casting`, `labour_per_hr`, `box_valuation`, `markup`), `item_costings` for
the actual lines used on a quote. **Built into quote-entry.html:** yes, for
the six Ring Calculator components. **Not yet built:** the tiered setting
rates, or the production-only cost types above.

---

## 2. Chains & necklaces

The Chain Calculator — a single rate per gram, varying by carat and origin.
No stones/setting/labour breakdown; it's priced as a finished, imported or
locally-made item.

```
Retail = weight (gm) × $/gm
```

| Metal | Local | Imported |
|---|---|---|
| 9ct | **$115/gm** | **$145/gm** |
| 18ct | **$260/gm** | **$300/gm** |
| 14ct | **$220/gm** ⚠️ | **$235/gm** ⚠️ |
| 21–22ct | *(not priced)* ⚠️ | **$260/gm** |

**⚠️ The two source workbooks disagree on 14ct and 21–22ct rates.**
`QBE_ASSESSMENT.xlsx` has 14ct at $220 local / $235 imported and leaves
21–22ct blank; `Assessment_Sheet.xlsx` has 14ct at $150 local / $220
imported and 21–22ct at $200. Currently seeded using the QBE figures — this
needs a quick confirmation of which is current, since they're a genuine
$70-$85/gm difference on 14ct pieces.

**Database:** `rate_cards` (category `chain_per_gm`, codes
`CHAIN_9CT_LOCAL/IMPORTED`, `CHAIN_18CT_LOCAL/IMPORTED`,
`CHAIN_14CT_LOCAL/IMPORTED`). **Built into quote-entry.html:** yes, as the
Chain Calculator dropdown + weight field.

---

## 3. Earrings, charms & religious items

Same per-gram model as chains, but with its own (imported-only) rate table
— these are treated as always-imported finished pieces.

```
Retail = weight (gm) × $/gm
```

| Metal | Rate (imported only) |
|---|---|
| 9ct | **$145/gm** |
| 18ct | **$300/gm** |
| 21–22ct | **$260/gm** |

**Database:** `rate_cards` (category `earring_charm_per_gm`, codes
`EARR_9CT_IMPORTED`, `EARR_18CT_IMPORTED`, `EARR_22CT_IMPORTED`). **Built
into quote-entry.html:** yes — same Chain Calculator widget also lists these
rates in its dropdown, since the formula is identical.

---

## 4. Watches

Not a formula — a **brand lookup table**. Each insurer (and "Shop Sales" for
non-insurance retail) has its own negotiated discount or sell rate per
watch brand.

```
Retail (or settlement value) = RRP × (1 − discount%)   [most brands]
                              = "POA" for certain luxury brands (price on application)
```

**✅ Update: this is now built.** `watch_brand_rates` (brand × insurer →
discount % or POA) exists, seeded with the sample below, and is manageable
via `rates.html` without touching code. Add the remaining ~85 brands from
the full WATCHES tab the same way — through the screen, not a migration.

Sample of the ~90 brands on file, showing how rates vary by insurer:

| Brand | Suncorp | Allianz | Guild | Shop Sales |
|---|---|---|---|---|
| Rolex | 5% | POA | POA | POA |
| Omega | 22% | 15% | 15% | 10% |
| Tag Heuer | 26% | 26% | 26% | 25% |
| Citizen | 40% | 35% | 35% | 30% |
| Seiko | 40% | 35% | 35% | 30% |
| Casio | 36% | 33% | 30% | 30% |

**❌ Not built at all.** This is the single biggest gap from the earlier
audit — there's currently no table linking watch brand → insurer → rate.
`claim_items` captures the watch's make and model, but nothing looks up
what discount applies. Recommend a new table, roughly:

```
watch_brand_rates (brand, insurer_id, rate_type ['discount_pct'|'poa'], rate_value)
```

so a quote for a Tag Heuer under a Suncorp claim can pull "26% off RRP"
automatically instead of a staff member checking the spreadsheet by hand.

**Database:** none yet. **Built into quote-entry.html:** no — watch items
currently need retail/nett entered manually with no rate assistance.

---

## 5. Loose stones / diamonds (feeds into any item type above)

The Diamond Calculator — simplest formula on file, and the one every stone
line on every item type ultimately uses.

```
Cost = carat weight × $ per carat
```

Example on file: 0.75ct × $3,433/ct = $2,574.75.

The $/carat rate itself isn't a fixed rate card value — it's assessed per
stone (based on the specific stone's quality/certification) and entered at
quoting time.

**Database:** `item_stones` (`total_carat`, `cost_per_carat`, `cost`).
**Built into quote-entry.html:** yes — the stones table auto-calculates
total carat and cost as you enter count/carat-each/rate.

---

## Summary table

| Item type | Pricing model | Rates on file? | In quote-entry.html? |
|---|---|---|---|
| Rings / manufactured pieces | Stones + gold + setting + casting + labour + box&val, × markup | ✅ (markup ⚠️ still unconfirmed) | ✅ mostly — quote-entry.html's calculator still offers the one flat setting rate; the six tiers exist in the database and `rates.html` but aren't wired into the item calculator's dropdown yet |
| Chains / necklaces | Weight × $/gm by carat & origin | ✅ (14ct/21-22ct ⚠️ conflicting between workbooks) | ✅ |
| Earrings / charms / religious | Weight × $/gm, imported only | ✅ | ✅ |
| Watches | Brand → insurer discount lookup | ✅ built into the database & `rates.html` | ❌ quote-entry.html doesn't look up the rate yet — still manual entry |
| Loose stones | Carat × $/carat | ✅ (rate assessed per-stone, not fixed) | ✅ |

All rate cards are now **configurable** through `rates.html` — see the
project README for how versioning works (nothing is ever overwritten; every
edit creates a new dated version and old quotes keep whatever was frozen
onto them). What's left is wiring the quote-entry calculator itself to
*use* the fuller rate set: pull the six setting tiers into that dropdown
instead of the flat rate, and add a watch-brand lookup so choosing a brand
under a given insurer auto-fills the discount instead of manual entry. And
still worth a quick confirmation on which 14ct/21-22ct chain rates are
current, since the two source workbooks disagree.
