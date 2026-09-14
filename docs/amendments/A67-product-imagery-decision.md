---
doc: A67-product-imagery-decision
status: PROPOSAL
owning_phase: ops
last_reviewed: 2026-09-14
owner_verification: REQUIRED
supersedes: null
amends:
  - docs/architecture/CANONICAL-DECISIONS.md (D6, D10)
  - docs/project/BUSINESS_RULES.md (BR-E3)
  - docs/media/MEDIA_GUIDE.md (§4.1, §6)
  - docs/media/HIGGSFIELD_GUIDE.md (placement bans)
---

# A67 — Product imagery decision: photography vs labelled concept

> **Status:** owner decision proposal. Nothing in this file changes schema, triggers, or Studio
> behaviour until the owner picks an option and a follow-up implementation PR lands.
>
> **Why now.** P1/P2 shipped EmptyPlate + LQIP so unbound product wells are designed rather than
> holes. PDPs still have **zero** `product_media` rows: all 250 library assets are `is_concept`,
> and three live guards refuse concept on products. Without an owner decision, every PDP stays
> empty forever in the honest sense — EmptyPlate is the interim, not the destination.

## Binding rules today (status quo)

| Source | Rule |
|---|---|
| **CANONICAL-DECISIONS D6** | Asset priority ends at real Rivya media before concept; every media row carries `is_concept`. |
| **CANONICAL-DECISIONS D10** | Never fabricate delivered work. Empty states beat invented photographs. |
| **BR-E3** | Concept media is never presented as delivered work; must not attach to a product as photography. |
| **DB** | `product_media_reject_concept` (migration `0122`) — BEFORE INSERT/UPDATE on `product_media`, refuses `is_concept = true`, naming the asset. Companion: `products_reject_concept_hero`. |
| **App** | Studio product media picker filters concepts out; `catalog-validation` refuses at the Server Action; repository does not re-check (trigger is the real gate). |
| **Higgsfield** | Guide: do not attach concept to a product or portfolio; do not caption it as “our table / a piece we made”; banner + `is_concept` disclose. |
| **A65** | Recorded the live fact: no product hero/gallery/card image until photography or an explicit amendment permitting labelled concept on `product_media`. |
| **A61 / P0** | Unbound public wells use `EmptyPlate` + `EMPTY_STATE.media_pending.label` (“Photograph in preparation”) — not `ERROR.media_unavailable.*`. |

Editorial CMS slots (homepage, process, large-format heroes, etc.) may already bind concept assets
with honest captions. That path does **not** use `product_media` and is unchanged by this decision.

---

## Option A — Real photography only (status quo)

**Decision.** Keep triggers and Studio filters. Product surfaces show EmptyPlate until a real
photograph (`is_concept = false`) is uploaded and bound.

### Ops checklist

1. Shoot / commission real photography per SKU (or clear a real photo that already exists).
2. Upload in Studio → Media; set **`is_concept = false`**, complete alt text, publish/verify.
3. Product → Media tab: attach as gallery / hero (picker only offers non-concept).
4. Confirm PDP, listing card, and OG use the bound asset (product `ogMediaId` wins over default mark).
5. Do **not** flip `is_concept` on a Higgsfield render to “make it attach” — that would lie to D10.

**Pros:** Honest; no schema change; BR-E3 stays absolute.  
**Cons:** PDPs stay EmptyPlate until ops delivers photos.

---

## Option B — Allow labelled concept on `product_media`

**Decision.** Permit `is_concept = true` on product media **only** when the UI always shows a
mandatory concept caption/badge (never as silent photography).

### Required changes (implementation PR after owner yes)

| Layer | Change |
|---|---|
| **Schema** | Soften or replace `product_media_reject_concept` / `products_reject_concept_hero` with a rule that still refuses unlabelled or unverified concept, or requires `concept_label_required` / caption FK. |
| **Studio** | Re-offer concept in the product media picker; show warning badge; require caption/badge copy before save. |
| **Validation** | `catalog-validation` + Server Actions must match the new DB rule. |
| **Public UI** | ProductGallery / ProductCard / OG: always render concept badge (A59 pattern) + caption from CMS string (no invented JSX copy). |
| **Tests** | Rewrite `phase14` RLS + catalog-validation expectations; add e2e that a concept-bound PDP never omits the badge. |
| **Docs** | Amend BR-E3, D6/D10 notes, Higgsfield placement table, MEDIA_GUIDE §4.1. |

**Pros:** PDPs can show mood/form while photography is pending.  
**Cons:** Highest risk of “looks like a photo”; needs disciplined UI + DB; amendment must be explicit.

---

## Recommended interim (until A or B ships)

1. **Editorial concept on homepage / CMS slots** — already OK; keep using `seed:bind-media` / Studio bindings for section heroes (not `product_media`).
2. **EmptyPlate on products** — already shipped in P1/P2; ensure production has the CMS string (below).
3. **Owner picks A or B** in writing (append acceptance to CANONICAL-DECISIONS Amendments when chosen).

This interim is what A65 and SESSION-STATE already describe; this file only makes the fork explicit.

---

## Exact Studio / seed commands (EMPTY_STATE + CTA + bind-media)

Run against production with `DATABASE_URL` set (see `docs/ops/ENVIRONMENT.md`). Prefer dry-run first where available.

```bash
# 1) Apply seeded global strings (includes EMPTY_STATE.media_pending.label + CTA.header_commission.label)
npm run seed:content

# 2) Publish / verify in Studio if rows stay DRAFT on your project:
#    Studio → Content → Pages → global
#    - EMPTY_STATE.media_pending.label  → "Photograph in preparation"
#    - CTA.header_commission.label      → masthead "Commission a piece" (href fixed in code to /custom-commissions)

# 3) Bind section media only (never product_media). Plan first:
npm run seed:bind-media -- --dry-run
npm run seed:bind-media

# 4) After data-only changes, wait for ISR or redeploy so static routes re-render.
```

**Notes**

- `seed:content` is idempotent and skips owner-edited rows (rule 5c); rule 5d may still fill **empty** section media columns on live rows (A49).
- `seed:bind-media` writes only `media_desktop_id` / `media_mobile_id` / `media_slot_key`.
- Concept remains forbidden on `product_media` until Option B is implemented.

---

## Owner decision (fill in)

| Choice | Date | Initials |
|---|---|
| ☐ A — photography only | | |
| ☐ B — labelled concept on product_media (schedule impl PR) | | |
| ☐ Interim only for now (EmptyPlate + CMS editorial) | | |

When A or B is chosen, promote this proposal into a dated entry under CANONICAL-DECISIONS *Amendments* and open the matching implementation/docs PR.
