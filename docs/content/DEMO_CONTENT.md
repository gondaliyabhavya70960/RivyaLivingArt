# Demo content register

**GENERATED — do not edit.** `npm run demo:register` rewrites this file from
`scripts/demo/*.ts`; `npm run demo:check-register` fails the build when the two disagree.

---

## What this is

Every row below is **placeholder content**, written so the site can be seen working before the
real catalogue exists. The owner authorised it on one condition: that all of it is marked, listed
here, and replaced at launch. Nothing in it describes anything Rivya has actually made, sold,
delivered or been told.

| | |
|---|---|
| Write it | `npm run demo:seed` |
| Remove it, all of it | `npm run demo:purge` |
| Find it in the database | `select * from <table> where is_demo` |
| Find it in Studio | every demo row carries a **DEMO** badge |

The marker is a real column — `is_demo`, migration `0180` — and not a naming convention, because
a convention stops working the moment an editor renames something. `demo:purge` removes every row
carrying it and puts back the two things the seeder changes on non-demo rows: the seven seeded
categories return to `DRAFT`, and the ten seeded articles lose the `page_id` pointing at a body
that no longer exists.

## What a demo row is not allowed to claim

CLAUDE.md's prohibition on fabricating business facts is **not** suspended by permission to write
placeholders. It is the reason the placeholders look the way they do:

| Never | Why | What the rows carry instead |
|---|---|---|
| A price | A number would be a price the business never set, on a live site | `PRICE_ON_REQUEST` on all 35 |
| A dimension | A visitor reading `2400 × 1100 mm` has been told a fact | `dimensions` is null |
| A material | Naming a timber species is a claim about what the studio sources | no `product_materials` rows |
| A specification | A specification is a measurement somebody took | no `product_specs` rows |
| Stock | The database refuses to publish `READY_STOCK` without owner verification | `MADE_TO_ORDER` |
| A lead time, award, certification or durability claim | All named in CLAUDE.md | absent |
| A customer's name | The sharpest form of what D10 forbids | testimonials name a role and nothing else |

### There are no photographs, and that is a rule

All 250 assets in the library are Higgsfield renders carrying `is_concept = true`, and Phase 14's
`products_reject_concept_hero` refuses a concept render as a product's hero — *a concept render may
never illustrate a product (D6, D10)*. So the demo products have **no imagery** and their cards
render the seeded SEED §47 unavailable state. Real photography is the one thing a placeholder
cannot stand in for.

### Two kinds of row cannot reach the public site at all

`portfolio_projects` and `testimonials` each carry an evidence gate — the first refuses `PUBLISHED`
until the owner has verified the project happened, the second until the person quoted has granted
consent. Neither can be satisfied by a script writing its own permission. The demo rows exist so
the Studio screens have something to work against; `/portfolio` keeps rendering its seeded empty
state, which is the honest thing for it to say.

---

## Products — 35 rows, `products`, PUBLISHED

### `3d-resin` — 4

| Slug | Title | Large format | Customisable |
|---|---|---|---|
| `three-d-form-lattice-object` | Lattice Object, 3D + Resin | — | yes |
| `three-d-form-parametric-vessel` | Parametric Vessel | — | yes |
| `three-d-form-desk-object` | Desk Object, Fabricated Form | — | yes |
| `three-d-form-architectural-model` | Architectural Study, Cast | — | yes |

### `collectible-design` — 4

| Slug | Title | Large format | Customisable |
|---|---|---|---|
| `collectible-form-study-one` | Form Study I | — | — |
| `collectible-form-study-two` | Form Study II | — | — |
| `collectible-material-panel` | Material Panel | — | — |
| `collectible-form-study-three` | Form Study III | — | — |

### `decor` — 4

| Slug | Title | Large format | Customisable |
|---|---|---|---|
| `decor-tray-serving` | Serving Tray | — | yes |
| `decor-coaster-set` | Coaster Set | — | — |
| `decor-catch-all-bowl` | Catch-All Bowl | — | yes |
| `decor-bookends-pair` | Bookends, Matched Pair | — | yes |

### `furniture` — 10

| Slug | Title | Large format | Customisable |
|---|---|---|---|
| `live-edge-dining-table-river-channel` | Live-Edge Dining Table, River Channel | yes | yes |
| `dining-table-full-pour-surface` | Dining Table, Full-Pour Surface | yes | yes |
| `coffee-table-shallow-basin` | Coffee Table, Shallow Basin | — | yes |
| `centre-table-circular-pour` | Centre Table, Circular Pour | — | yes |
| `console-table-narrow-span` | Console Table, Narrow Span | — | yes |
| `console-table-sculptural-base` | Console Table, Sculptural Base | — | yes |
| `desk-single-slab` | Desk, Single Slab | — | yes |
| `side-table-pair` | Side Tables, Matched Pair | — | yes |
| `bench-entryway` | Bench, Entryway | — | yes |
| `monumental-table-long-span` | Monumental Table, Long Span | yes | yes |

### `gifts` — 4

| Slug | Title | Large format | Customisable |
|---|---|---|---|
| `gift-desk-piece` | Desk Piece | — | — |
| `gift-paperweight` | Paperweight | — | — |
| `gift-ring-dish` | Ring Dish | — | yes |
| `gift-keepsake-box` | Keepsake Box | — | yes |

### `preservation` — 4

| Slug | Title | Large format | Customisable |
|---|---|---|---|
| `preservation-varmala-frame` | Varmala Preservation, Framed | — | yes |
| `preservation-varmala-block` | Varmala Preservation, Solid Block | — | yes |
| `preservation-keepsake-small-format` | Keepsake, Small Format | — | yes |
| `preservation-keepsake-set` | Keepsake Set | — | yes |

### `wall-statement-art` — 5

| Slug | Title | Large format | Customisable |
|---|---|---|---|
| `wall-panel-horizon-band` | Wall Panel, Horizon Band | — | yes |
| `wall-panel-vertical-drop` | Wall Panel, Vertical Drop | — | yes |
| `wall-triptych-sequence` | Wall Triptych, Sequence | — | yes |
| `wall-relief-layered-depth` | Wall Relief, Layered Depth | — | yes |
| `wall-piece-circular-format` | Wall Piece, Circular Format | — | yes |

## Journal bodies — 10 pages, `pages` + `page_sections`

The ten article rows themselves are **not** demo: their titles and angles came from SEED §20 and
are the studio's own editorial plan. What is placeholder is the **writing** — the `pages` row and
its `statement` bands — so purging returns each article to the brief it was seeded as.

Three of the ten carry `OWNER_VERIFICATION_REQUIRED` and stay `DRAFT` with their bodies written:
SEED §20 attaches a caution to them and the database refuses to publish while the flag is set.

| Article slug | Bands |
|---|---|
| `a-guide-to-resin-colour-transparency-and-visual-depth` | 3 |
| `choosing-the-right-size-for-a-statement-dining-table` | 3 |
| `from-digital-form-to-physical-object` | 3 |
| `how-material-choice-changes-the-character-of-a-space` | 3 |
| `large-wall-art-thinking-beyond-decoration` | 3 |
| `preserving-flowers-in-resin-what-a-custom-brief-should-include` | 3 |
| `resin-and-wood-designing-around-contrast` | 3 |
| `what-makes-a-resin-table-more-than-a-surface` | 3 |
| `what-to-prepare-before-requesting-a-custom-furniture-commission` | 3 |
| `why-bespoke-furniture-starts-with-context` | 3 |

## Portfolio projects — 6 rows, `portfolio_projects`, DRAFT

| Slug | Title | Type |
|---|---|---|
| `demo-apartment-dining-room` | Apartment Dining Room | Dining table |
| `demo-studio-reception` | Studio Reception | Console and wall piece |
| `demo-stairwell-wall-piece` | Stairwell Wall Piece | Wall piece |
| `demo-family-preservation` | Family Preservation Commission | Preservation |
| `demo-workspace-desk` | Workspace Desk | Desk |
| `demo-gallery-installation` | Gallery Installation | Installation |

## Testimonials — 6 rows, `testimonials`, DRAFT, consent PENDING

| Attributed to | Role |
|---|---|
| Placeholder client | Dining table commission |
| Placeholder client | Wall piece commission |
| Placeholder client | Preservation commission |
| Placeholder client | Console commission |
| Placeholder studio | Interior design practice |
| Placeholder client | 3D and resin commission |

## Rows the seeder changes but does not own

| Row | Change | Reversed by `demo:purge` |
|---|---|---|
| The seven seeded `categories` | `DRAFT` → `PUBLISHED`, so `/collections/<slug>` can render | back to `DRAFT` |
| The ten seeded `journal_articles` | `page_id` set to the demo body | set back to null |

`3d-resin` is the exception: SEED flags it `OWNER_VERIFICATION_REQUIRED`, the database refuses to
publish it, and the seeder does not clear the flag to get its way. Its `/collections` page stays a
404 until the owner verifies it in Studio; the demo products inside it are still reachable from
the store listing and their own URLs.

## At launch

1. Replace what you want to keep — edit a demo row in Studio and it becomes yours, except that it
   still carries `is_demo`. Clear the badge by clearing the column.
2. `npm run demo:purge` removes everything still marked.
3. Re-run `npm run seed:content` to confirm the specification's own rows are untouched — the
   purge is designed to leave that run reporting every row `unchanged`.
