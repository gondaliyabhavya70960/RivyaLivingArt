---
name: content-integrity
description: Use before writing ANY copy, seed row, product detail, specification, testimonial, legal text or empty state. Encodes D10 — the things this project may never fabricate — and what to do instead.
---

# Never invent a business fact

## D10, verbatim in effect

Never fabricate product specifications, dimensions, pricing, delivered projects, named customers,
testimonials, sales claims, awards, certifications or durability claims.

Brand and editorial copy **may** be written. Anything asserting a business capability is seeded
`OWNER_VERIFICATION_REQUIRED` and stays unpublished until the owner confirms it.

## What this looks like in practice

These are real, current states in this repository — not hypotheticals:

- **`product_specs` has 0 rows.** `ProductSpecifications` is mounted and correctly renders nothing.
  Dimensions, materials and weights are exactly what D10 names. **Do not fill this table.**
- **`/privacy` and `/terms` have zero sections and 404.** No legal copy exists. The brief says to
  preserve that gating. Legal text is the last thing to invent.
- **All seven categories and every collection are DRAFT**, so those routes 404 everywhere including
  CI. Publishing them is an editorial act.

A route that 404s because its content is not ready is **working correctly**. Do not "fix" it.

## Empty states, not invented projects

Where real media or real work is unavailable, ship an honest empty state and record a concrete task
for the owner. `SEED §47` fallback wells are the media equivalent — a labelled frame, never a
substituted image.

## Concept media is never evidence

A concept visualisation may never be presented as a delivered Rivya product or as evidence of work
done. `is_concept` exists for this and the constraint survives any redesign.

## Scraped competitor data is research only

Never published, never publicly searchable, never auto-imported into the Rivya catalogue. The
research/public boundary is enforced by `scripts/research/check-research-isolation.mjs` — a foreign key
crossing it fails the build.

## The reporting rule that catches people out

A first-party approximation must **never** be reported as an imported library component. If you
build something inspired by an external source, record it as first-party work with that source as a
visual reference. The distinction is the point.

Equally: do not describe an evaluation as "not performed" when one exists, or as "performed" when
you could not read the source. State what you actually verified and from where.

## Read before editing

`docs/project/BUSINESS_RULES.md`, `CLAUDE.md` non-negotiables, `docs/content/CONTENT_GUIDE.md`.
