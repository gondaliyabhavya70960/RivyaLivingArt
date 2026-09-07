# INITIAL CONTENT INVENTORY

> The SEED §54 audit. Every string the first deployment renders, where it is stored, where it is
> edited, whether it asserts a business fact, which media asset it is paired with, its SEO
> resolution and its publication state.
>
> **Generated, not hand-maintained.** `scripts/content/build-content-inventory.ts`
> (`npm run content:inventory`) rebuilds this file from the database after every
> `npm run seed:content`. The version in the repository is the expected output for
> `content_seed_version = "rivya-v1"` on an unedited database; Phase 09 verification step 9 runs
> `npm run content:inventory && git diff --exit-code docs/content/INITIAL_CONTENT_INVENTORY.md`.
>
> Governed by `docs/architecture/CANONICAL-DECISIONS.md`. Editorial rules live in
> `docs/content/CONTENT_GUIDE.md`. Table and column definitions live in
> `docs/architecture/DATA_MODEL.md` §5. Studio routes live in `docs/studio/STUDIO_GUIDE.md` §9.

---

## 0. How to read this document

### 0.1 The ten columns (SEED §54, exact)

| Column | What it holds |
|---|---|
| **Page** | The D3 public route, or `Global` for a reusable string, or `Studio` for Studio chrome |
| **Section** | The seeded section, group or entity the field belongs to |
| **Field** | The database column, `payload` key or `global_content` key |
| **Seeded?** | `Yes` — `npm run seed:content` writes a value. `No` — the row exists or the control exists, but the value comes from the owner |
| **Editable?** | `Yes` — a named Studio control renders this field. `No` — the string is not reachable from the Studio |
| **Studio location** | The exact D4 route plus the leaf, tab or field group |
| **Fact verification needed?** | `OVR` when seeded `owner_verification = 'OWNER_VERIFICATION_REQUIRED'`; otherwise `No` plus the `fact_classification` |
| **Media asset ID** | `rivya_asset_id` + type from `data/higgsfield/asset-manifest.json`, `—` for no media slot, or `GAP` |
| **SEO status** | How metadata resolves for this surface |
| **Publication status** | The state the seed writes, and what unblocks the next state |

### 0.2 Value vocabularies

| Column | Values |
|---|---|
| Seeded? | `Yes` · `No` |
| Editable? | `Yes` · `No` |
| Fact verification needed? | `OVR` · `No · BRAND_COPY` · `No · EDITORIAL_COPY` · `No · SEO_COPY` · `No · LEGAL_COPY` · `No · UI` |
| Media asset ID | `<ID> (image)` · `<ID> (video)` · `GAP` · `—` (slot does not exist) · `merch` (chosen in merchandising, not seeded) |
| SEO status | `PATH seeded` · `PATH derived` · `ENTITY seeded` · `GLOBAL default` · `og:image` · `n/a` |
| Publication status | `PUBLISHED` · `PUBLISHED · off` · `DRAFT → publishable` · `DRAFT · OVR` · `DRAFT · off` · `not seeded` |

`DRAFT → publishable` means the row seeds `DRAFT`, carries no verification flag, and clears in the
**launch publication pass** (§30). `DRAFT · OVR` means the `enforce_owner_verification_gate`
trigger refuses `PUBLISHED` until an owner or admin sets `owner_verification = 'VERIFIED'`.

### 0.3 What is deliberately not one row per line

Every `page_sections` row also carries `is_visible`, `position`, `theme`, `layout_variant`,
`publish_at`, `unpublish_at`, `status`, `owner_verification`, `fact_classification`,
`field_classifications` and `media_alt_override`. These are **section chrome**: identical on every
section, always editable at the section's own Studio location, never seeded with copy. They are
declared once here rather than repeated 200 times. Nothing else is omitted — if a field carries a
seeded sentence, a label, a URL or a media binding, it has a row below.

### 0.4 Media identity and why every cell names a type

The manifest holds **250 assets with 250 distinct `rivya_asset_id` values** — 224 images and 26
videos — so the id alone is the key, exactly as D6 says. Videos continue their family's numbering
rather than sharing an id with a still: `PROCESS-POUR-001…008` are images and
`PROCESS-POUR-009…012` are videos; `LARGEFORMAT-DINING-001…003` are images and `-004`, `-005` are
videos.

Because the id does not encode the type, and because a media slot behaves differently when it
receives a clip instead of a still — poster, `prefers-reduced-motion` fallback, weight budget —
every media cell in this document names the type alongside the id, and the Studio media picker does
the same.

### 0.5 GAP means Phase 43, never a placeholder

A `GAP` cell is a media slot with no suitable existing asset. The seed leaves
`media_desktop_id` / `media_mobile_id` null and the section renders its copy without media
(D6, SEED §47). **No stock image, no generated placeholder, no reused-but-wrong asset is
substituted.** Every `GAP` is listed in §29 and becomes a Phase 43 brief. Regenerating anything
already in the manifest is a defect (D6).

---

## 1. Coverage summary

### 1.1 The SEED §54 target

SEED §54 states the target as **100% of intended launch copy mapped to a Studio editing control.**
The real figure this inventory achieves:

| Measure | Rows | Share |
|---|---|---|
| Total launch-copy fields inventoried | 492 | 100% |
| **Mapped to a named Studio editing control** | **479** | **97.4%** |
| Not reachable from the Studio | 13 | 2.6% |
| Seeded with a value by `npm run seed:content` | 452 | 91.9% |
| Awaiting an owner-supplied value | 40 | 8.1% |
| Carrying `OWNER_VERIFICATION_REQUIRED` | 108 | 22.0% |
| Publishable in the launch pass without owner verification | 306 | 62.2% |
| Media slots declared | 85 | — |
| Media slots bound to a real manifest asset | 65 | 76.5% of slots |

**97.4% is the honest answer, not 100%.** The thirteen unmapped rows are enumerated in §1.3, and
every one of them is a decision an engineer must make rather than an oversight. Nine of the thirteen
close with a single migration; three are deployment configuration by design; one is a derived value
that should never be typed.

### 1.2 Coverage by area

Section numbers below are this document's own; the SEED reference follows in brackets.

| Area | Rows | Studio-mapped | Seeded | OVR | Media slots | Bound | GAP |
|---|---|---|---|---|---|---|---|
| §2 Global brand content [SEED §6] | 6 | 6 | 6 | 1 | 0 | 0 | 0 |
| §3 CTA library [§7] | 13 | 13 | 13 | 0 | 0 | 0 | 0 |
| §4 Navigation [§8] | 20 | 20 | 20 | 0 | 0 | 0 | 0 |
| §5 Announcement bar [§9] | 3 | 3 | 3 | 0 | 0 | 0 | 0 |
| §6 Homepage [§10] | 82 | 82 | 79 | 19 | 23 | 20 | 3 |
| §7 About [§11] | 23 | 23 | 23 | 6 | 6 | 6 | 0 |
| §8 Large Format [§12] | 27 | 27 | 26 | 8 | 13 | 11 | 2 |
| §9 Collection landing [§13] | 9 | 9 | 7 | 0 | 2 | 0 | 2 |
| §10 The seven categories [§14] | 28 | 28 | 26 | 7 | 7 | 5 | 2 |
| §11 Custom Commissions [§15] | 26 | 26 | 20 | 10 | 6 | 0 | 6 |
| §12 Process [§16] | 29 | 29 | 29 | 21 | 9 | 9 | 0 |
| §13 Portfolio landing [§17, §28] | 8 | 8 | 8 | 0 | 2 | 2 | 0 |
| §14 Journal [§18, §19, §20] | 30 | 29 | 28 | 2 | 12 | 12 | 0 |
| §15 Contact [§21] | 14 | 14 | 10 | 5 | 2 | 0 | 2 |
| §16 Contact form [§22] | 12 | 12 | 12 | 1 | 0 | 0 | 0 |
| §17 FAQ [§23] | 12 | 12 | 11 | 10 | 1 | 0 | 1 |
| §18 Footer [§24] | 14 | 14 | 14 | 5 | 0 | 0 | 0 |
| §19 Newsletter [§25] | 3 | 3 | 3 | 0 | 0 | 0 | 0 |
| §20 Search and empty states [§26–§29] | 15 | 15 | 14 | 0 | 1 | 0 | 1 |
| §21 Commerce and action labels [§30, §31] | 17 | 17 | 17 | 1 | 0 | 0 | 0 |
| §22 Customization form templates [§33–§35] | 33 | 33 | 33 | 8 | 0 | 0 | 0 |
| §23 WhatsApp templates [§36, §37] | 3 | 3 | 3 | 0 | 0 | 0 | 0 |
| §24 Studio copy [§38–§40] | 18 | 18 | 18 | 0 | 0 | 0 | 0 |
| §25 SEO, keywords and social [§41, §42, §44] | 12 | 12 | 10 | 0 | 1 | 0 | 1 |
| §26 Error and inquiry surfaces [§45–§49] | 17 | 17 | 17 | 0 | 0 | 0 | 0 |
| §27 Legal pages | 6 | 6 | 2 | 4 | 0 | 0 | 0 |
| §28 Interface chrome not enumerated by SEED | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| **Total** | **492** | **479** | **452** | **108** | **85** | **65** | **20** |

The thirteenth unmapped row is `journal_articles.reading_minutes` (§14.3), which is computed on save
at 200 words per minute and must never be typed. It is counted as unmapped because it is a
visitor-facing value with no Studio control, and recorded here so nobody adds one.

### 1.3 The thirteen unmapped rows, named

| # | String | Where it lives instead | Why it is not in the Studio | Proposed fix |
|---|---|---|---|---|
| 1 | Skip-to-content link label | `components/primitives/SkipLink.tsx` | No `global_content.group_key` accepts it | Extend the `group_key` check with `UI_CHROME` |
| 2 | Breadcrumb root label | `components/patterns/Breadcrumbs.tsx` | As above | `UI_CHROME` |
| 3 | Pagination labels — previous, next, position | `components/patterns/Pagination.tsx` | As above | `UI_CHROME` |
| 4 | Filter and sort control labels on `/collection` | `components/patterns/FilterBar.tsx` | As above | `UI_CHROME` |
| 5 | Lightbox controls — close, next, previous, zoom | `components/patterns/Lightbox.tsx` | As above | `UI_CHROME` |
| 6 | 3D viewer controls — reset camera, full screen, lighting preset | `components/three/ViewerControls.tsx` | As above; also Phase 21, long after the seed | `UI_CHROME` |
| 7 | Reading-time suffix on journal cards | `components/patterns/ArticleCard.tsx` | As above | `UI_CHROME` |
| 8 | Mobile menu open and close labels | `components/patterns/MobileNav.tsx` | As above | `UI_CHROME` |
| 9 | Analytics disclosure line in the footer | `components/sections/Footer.tsx` | `LEGAL_COPY` with no `group_key` | `UI_CHROME`, or a separate `LEGAL` group |
| 10 | `journal_articles.reading_minutes` | Computed on save at 200 wpm | A derived value; a Studio control would let someone type a wrong one | Leave derived. Only the suffix (row 7) is copy |
| 11 | `NEXT_PUBLIC_WHATSAPP_NUMBER` fallback | Deployment environment (D8) | Used only until `contact.whatsapp` is `VERIFIED`; a Studio control overriding a deploy value would be a second source of truth | Leave. STUDIO_GUIDE §13.8 already gives the verified row precedence |
| 12 | `NEXT_PUBLIC_SITE_URL` in canonical and OG URLs | Deployment environment (D8) | Environment identity, not copy | Leave in code |
| 13 | Inquiry reference format `RIV-<yyyy>-<sequence>` | `supabase/migrations/0180…` default and `lib/whatsapp/template.ts` | An identifier the database allocates inside the insert transaction | Leave in code. The prefix is a data contract, not a sentence |

Rows 1–9 are nine string families that SEED never enumerates because they are interface chrome
rather than marketing copy — but they are still visitor-facing sentences, and SEED §1 says public
components must not contain primary copy. **The fix is one migration**: extend the
`global_content.group_key` check constraint with `UI_CHROME` and seed those strings from
`content/seed/global.ts` like every other reusable label. That takes Studio-mapped coverage to
**99.2% (488 of 492)**, leaving only the two environment variables, the reference-code format and
one derived integer outside. Raised in §31 as open question 1, because `group_key`'s vocabulary is
fixed in `DATA_MODEL.md` §2.1 and this document does not change it unilaterally.

### 1.4 Where the launch site is not yet complete

Not a Studio-mapping problem — a content problem the owner must close:

| Blocker | Rows | Consequence at launch |
|---|---|---|
| `/privacy` and `/terms` body copy is not seeded | 4 | Both paths resolve to `notFound()` until the owner supplies legal text. Fabricating a privacy policy or terms of sale is forbidden by D10 |
| `contact.location_url` and `contact.location_label` have no supplied value | 2 | The map link is not rendered. `CONTEXT.md` records the destination as owner-supplied; it is not in the repository |
| 108 rows carry `OVR` | 108 | Each is blocked from `PUBLISHED` until an owner or admin verifies it. §30 groups them by the single decision that clears each group — **ten decisions clear all 108** |
| 20 media slots are `GAP` | 20 | Those sections render copy without media. §29 expands them into twenty-one Phase 43 briefs, fourteen of which have a reuse candidate already in the manifest |

---

## 2. Global brand content — SEED §6

Table `global_content`, `group_key = 'BRAND'`. Studio: `/studio/content/pages/global → Brand`.

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| Global | Brand | `brand.name` — Rivya Living Art | Yes | Yes | `/studio/content/pages/global → Brand` | No · BRAND_COPY | — | n/a | PUBLISHED |
| Global | Brand | `brand.descriptor` — Collectible Furniture · Resin Art · Digital Fabrication | Yes | Yes | `/studio/content/pages/global → Brand` | No · BRAND_COPY | — | n/a | PUBLISHED |
| Global | Brand | `brand.statement_primary` — Functional art shaped through resin, natural materials and digital fabrication. | Yes | Yes | `/studio/content/pages/global → Brand` | No · BRAND_COPY | — | n/a | PUBLISHED |
| Global | Brand | `brand.statement_alternate` — Objects shaped by material, movement and craft. | Yes | Yes | `/studio/content/pages/global → Brand` | No · BRAND_COPY | — | n/a | PUBLISHED |
| Global | Brand | `brand.statement_active` — selects which statement renders (`primary` or `alternate`) | Yes | Yes | `/studio/content/pages/global → Brand` | No · UI | — | n/a | PUBLISHED |
| Global | Brand | `brand.introduction` — the long studio introduction | Yes | Yes | `/studio/content/pages/global → Brand` | OVR | — | n/a | DRAFT · OVR |

`brand.introduction` names resin work, natural materials, digital design, 3D fabrication and
hand-finishing as current capability. SEED §6 marks it `DRAFT_MARKETING_COPY`; this schema has no
such status, so it is seeded `status = 'DRAFT'` with `owner_verification =
'OWNER_VERIFICATION_REQUIRED'` and `fact_classification = 'BRAND_COPY'`. That mapping is recorded
in `CONTENT_GUIDE.md` §2.4.

The four short descriptors are **not** flagged. The line between them and the introduction is
stated in `CONTENT_GUIDE.md` §3.4: naming the materials a studio works in is brand copy; describing
what the studio will do for a customer is a capability claim.

---

## 3. CTA library — SEED §7

Table `global_content`, `group_key = 'CTA'`. Studio: `/studio/content/pages/global → CTA Library`.
All thirteen: `Seeded? Yes`, `Editable? Yes`, `No · BRAND_COPY`, no media, `n/a` SEO, `PUBLISHED`.

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| Global | CTA Library | `cta.explore_large_format` — Explore Large Format | Yes | Yes | `/studio/content/pages/global → CTA Library` | No · BRAND_COPY | — | n/a | PUBLISHED |
| Global | CTA Library | `cta.view_the_collection` — View the Collection | Yes | Yes | `/studio/content/pages/global → CTA Library` | No · BRAND_COPY | — | n/a | PUBLISHED |
| Global | CTA Library | `cta.commission_a_piece` — Commission a Piece | Yes | Yes | `/studio/content/pages/global → CTA Library` | No · BRAND_COPY | — | n/a | PUBLISHED |
| Global | CTA Library | `cta.start_a_custom_project` — Start a Custom Project | Yes | Yes | `/studio/content/pages/global → CTA Library` | No · BRAND_COPY | — | n/a | PUBLISHED |
| Global | CTA Library | `cta.explore_selected_works` — Explore Selected Works | Yes | Yes | `/studio/content/pages/global → CTA Library` | No · BRAND_COPY | — | n/a | PUBLISHED |
| Global | CTA Library | `cta.discover_the_process` — Discover the Process | Yes | Yes | `/studio/content/pages/global → CTA Library` | No · BRAND_COPY | — | n/a | PUBLISHED |
| Global | CTA Library | `cta.view_product` — View Product | Yes | Yes | `/studio/content/pages/global → CTA Library` | No · BRAND_COPY | — | n/a | PUBLISHED |
| Global | CTA Library | `cta.view_project` — View Project | Yes | Yes | `/studio/content/pages/global → CTA Library` | No · BRAND_COPY | — | n/a | PUBLISHED |
| Global | CTA Library | `cta.explore_materials` — Explore Materials | Yes | Yes | `/studio/content/pages/global → CTA Library` | No · BRAND_COPY | — | n/a | PUBLISHED |
| Global | CTA Library | `cta.read_the_journal` — Read the Journal | Yes | Yes | `/studio/content/pages/global → CTA Library` | No · BRAND_COPY | — | n/a | PUBLISHED |
| Global | CTA Library | `cta.discuss_your_idea` — Discuss Your Idea | Yes | Yes | `/studio/content/pages/global → CTA Library` | No · BRAND_COPY | — | n/a | PUBLISHED |
| Global | CTA Library | `cta.enquire_on_whatsapp` — Enquire on WhatsApp | Yes | Yes | `/studio/content/pages/global → CTA Library` | No · BRAND_COPY | — | n/a | PUBLISHED |
| Global | CTA Library | `cta.send_an_enquiry` — Send an Enquiry | Yes | Yes | `/studio/content/pages/global → CTA Library` | No · BRAND_COPY | — | n/a | PUBLISHED |

Sections below reference these by key. A section's `cta_label` column stores the resolved label so
an editor can override it locally; the library is the default, not a hard binding.

---

## 4. Navigation — SEED §8

Table `navigation_items`. `menu = 'HEADER'` for the nine top-level entries, `menu = 'CATEGORY'` for
the seven children of Collection, `menu = 'MOBILE'` mirroring HEADER unless the owner diverges it.
Each row's `label`, `href`, `position`, `is_visible` and `target` are editable together.

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| Global | Header menu | `nav.header.home` — Home → `/` | Yes | Yes | `/studio/content/navigation → Header` | No · UI | — | n/a | PUBLISHED |
| Global | Header menu | `nav.header.collection` — Collection → `/collection` | Yes | Yes | `/studio/content/navigation → Header` | No · UI | — | n/a | PUBLISHED |
| Global | Header menu | `nav.header.large_format` — Large Format → `/large-format` | Yes | Yes | `/studio/content/navigation → Header` | No · UI | — | n/a | PUBLISHED |
| Global | Header menu | `nav.header.custom_commissions` — Custom Commissions → `/custom-commissions` | Yes | Yes | `/studio/content/navigation → Header` | No · UI | — | n/a | PUBLISHED |
| Global | Header menu | `nav.header.portfolio` — Portfolio → `/portfolio` | Yes | Yes | `/studio/content/navigation → Header` | No · UI | — | n/a | PUBLISHED |
| Global | Header menu | `nav.header.process` — Process → `/process` | Yes | Yes | `/studio/content/navigation → Header` | No · UI | — | n/a | PUBLISHED |
| Global | Header menu | `nav.header.about` — About → `/about` | Yes | Yes | `/studio/content/navigation → Header` | No · UI | — | n/a | PUBLISHED |
| Global | Header menu | `nav.header.journal` — Journal → `/journal` | Yes | Yes | `/studio/content/navigation → Header` | No · UI | — | n/a | PUBLISHED |
| Global | Header menu | `nav.header.contact` — Contact → `/contact` | Yes | Yes | `/studio/content/navigation → Header` | No · UI | — | n/a | PUBLISHED |
| Global | Collection mega menu | `nav.category.furniture` — Furniture → `/collection/furniture` | Yes | Yes | `/studio/content/navigation → Category` | No · UI | — | n/a | PUBLISHED |
| Global | Collection mega menu | `nav.category.collectible_design` — Collectible Design → `/collection/collectible-design` | Yes | Yes | `/studio/content/navigation → Category` | No · UI | — | n/a | PUBLISHED |
| Global | Collection mega menu | `nav.category.3d_resin` — 3D + Resin → `/collection/3d-resin` | Yes | Yes | `/studio/content/navigation → Category` | No · UI | — | n/a | PUBLISHED |
| Global | Collection mega menu | `nav.category.wall_statement_art` — Wall & Statement Art → `/collection/wall-statement-art` | Yes | Yes | `/studio/content/navigation → Category` | No · UI | — | n/a | PUBLISHED |
| Global | Collection mega menu | `nav.category.preservation` — Preservation → `/collection/preservation` | Yes | Yes | `/studio/content/navigation → Category` | No · UI | — | n/a | PUBLISHED |
| Global | Collection mega menu | `nav.category.decor` — Décor → `/collection/decor` | Yes | Yes | `/studio/content/navigation → Category` | No · UI | — | n/a | PUBLISHED |
| Global | Collection mega menu | `nav.category.gifts` — Gifts → `/collection/gifts` | Yes | Yes | `/studio/content/navigation → Category` | No · UI | — | n/a | PUBLISHED |
| Global | Mobile menu | `nav.mobile.*` — nine rows mirroring HEADER, independently editable | Yes | Yes | `/studio/content/navigation → Mobile` | No · UI | — | n/a | PUBLISHED |
| Global | Menu ordering | `position` on all 25 navigation rows | Yes | Yes | `/studio/content/navigation` — drag to reorder | No · UI | — | n/a | PUBLISHED |
| Global | Menu visibility | `is_visible` on all 25 navigation rows | Yes | Yes | `/studio/content/navigation` | No · UI | — | n/a | PUBLISHED |
| Global | Link targets | `target` (`_self` default) on all 25 navigation rows | Yes | Yes | `/studio/content/navigation` | No · UI | — | n/a | PUBLISHED |

The category order is the SEED §56 priority order and is asserted by a unit test on
`categories.sort_order`; the mega menu reads that order rather than storing a second one.

---

## 5. Announcement bar — SEED §9

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| Global | Announcement bar | `announcement.text` — Bespoke resin furniture, statement art and custom commissions. | Yes | Yes | `/studio/content/pages/global → Announcement Bar` | No · BRAND_COPY | — | n/a | PUBLISHED |
| Global | Announcement bar | `announcement.cta_label` — Discuss a Project | Yes | Yes | `/studio/content/pages/global → Announcement Bar` | No · BRAND_COPY | — | n/a | PUBLISHED |
| Global | Announcement bar | `announcement.cta_url` — `/custom-commissions` | Yes | Yes | `/studio/content/pages/global → Announcement Bar` | No · UI | — | n/a | PUBLISHED |

`announcement.cta_url` seeds to `/custom-commissions` rather than a WhatsApp deep link, because
SEED §9 offers both and the WhatsApp number is `OVR` until the owner verifies it (§16). Switching
the destination to WhatsApp is a single field edit. `is_enabled` seeds `true`; setting it `false`
removes the bar without deleting the rows.

---

## 6. Homepage — SEED §10

Page row: `pages.path = '/'`, `kind = 'PAGE'`, `is_system = false`, thirteen `page_sections` rows at
`position` 1–13. Studio: `/studio/content/homepage` (the same editor as
`/studio/content/pages → Home`, pinned for convenience).

### 6.0 Page level

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| `/` | Page | `pages.title` — Home | Yes | Yes | `/studio/content/pages → Home` | No · UI | — | n/a | DRAFT → publishable |
| `/` | Page | `pages.path` — `/` | Yes | Yes | `/studio/content/pages → Home` | No · UI | — | n/a | DRAFT → publishable |
| `/` | Page | `seo_entries.title` — derived from `brand.name` and the §41 social title | Yes | Yes | `/studio/content/seo → Pages → /` | No · SEO_COPY | — | PATH derived | DRAFT → publishable |
| `/` | Page | `seo_entries.description` — the §41 default description | Yes | Yes | `/studio/content/seo → Pages → /` | No · SEO_COPY | — | PATH derived | DRAFT → publishable |
| `/` | Page | `seo_entries.og_media_id` | No | Yes | `/studio/content/seo → Pages → /` | No · SEO_COPY | GAP | og:image | not seeded |

SEED §41 supplies no homepage-specific title or description, so the `PATH` row is seeded
`derived = true` from the global defaults. An owner edit sets `derived = false`, which is how the
SEO editor shows whether a value is the owner's or a fallback.

### 6.1 Section 01 — Hero

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| `/` | 01 Hero | `eyebrow` — RIVYA LIVING ART | Yes | Yes | `/studio/content/homepage → 01 Hero` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/` | 01 Hero | `heading` — Objects shaped by flow. Built to live with. | Yes | Yes | `/studio/content/homepage → 01 Hero` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/` | 01 Hero | `heading_highlight` — Built to live with. | Yes | Yes | `/studio/content/homepage → 01 Hero` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/` | 01 Hero | `body` — Collectible furniture, sculptural resin objects and large-format commissions created at the intersection of material craft and digital form. | Yes | Yes | `/studio/content/homepage → 01 Hero` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/` | 01 Hero | `cta_label` / `cta_url` — Explore Large Format → `/large-format` | Yes | Yes | `/studio/content/homepage → 01 Hero` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/` | 01 Hero | `cta_secondary_label` / `cta_secondary_url` — Commission a Piece → `/custom-commissions` | Yes | Yes | `/studio/content/homepage → 01 Hero` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/` | 01 Hero | `media_desktop_id` / `media_mobile_id` | No | Yes | `/studio/content/homepage → 01 Hero → Media` | No · UI | GAP | n/a | not seeded |

**Hero media is a deliberate gap.** The homepage hero is the single most consequential frame on the
site and no existing asset was generated for it; the `home` page family in the manifest holds only
five `interior-lifestyle` stills. Phase 43 briefs a flagship 21:9 desktop video plus poster and a
9:16 mobile video plus poster. **Before generating anything, evaluate the reuse candidates already
in the manifest** — `LARGEFORMAT-DINING-005 (video, 16:9)` for desktop and
`LARGEFORMAT-DINING-004 (video, 9:16)` for mobile, with `LARGEFORMAT-DINING-002 (image, 21:9)` and
`LARGEFORMAT-DINING-001 (image, 9:16)` as posters. If the owner accepts them the gap closes with
four bindings and no generation (D6).

### 6.2 Section 02 — Manifesto

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| `/` | 02 Manifesto | `eyebrow` — LIVING ART | Yes | Yes | `/studio/content/homepage → 02 Manifesto` | No · BRAND_COPY | — | n/a | DRAFT · OVR |
| `/` | 02 Manifesto | `heading` — Furniture can hold more than function. | Yes | Yes | `/studio/content/homepage → 02 Manifesto` | No · BRAND_COPY | — | n/a | DRAFT · OVR |
| `/` | 02 Manifesto | `body` — two paragraphs on resin as a material for form, depth and expression | Yes | Yes | `/studio/content/homepage → 02 Manifesto` | OVR | — | n/a | DRAFT · OVR |
| `/` | 02 Manifesto | `cta_label` / `cta_url` — About Rivya → `/about` | Yes | Yes | `/studio/content/homepage → 02 Manifesto` | No · BRAND_COPY | — | n/a | DRAFT · OVR |
| `/` | 02 Manifesto | `media_desktop_id` / `media_mobile_id` | Yes | Yes | `/studio/content/homepage → 02 Manifesto → Media` | OVR | INTERIOR-LIFESTYLE-002 (image) · INTERIOR-LIFESTYLE-003 (image) | n/a | DRAFT · OVR |

SEED §10 §02 marks the body `DRAFT_MARKETING_COPY`; the second paragraph names wood, digitally
developed structures and careful finishing as combined capability. The whole section row therefore
carries `owner_verification = 'OWNER_VERIFICATION_REQUIRED'` — the flag is per row, so every field
in the section is blocked from publication together.

### 6.3 Section 03 — Signature Collections

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| `/` | 03 Signature Collections | `eyebrow` — THE COLLECTION | Yes | Yes | `/studio/content/homepage → 03 Signature Collections` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/` | 03 Signature Collections | `heading` — Made for spaces that deserve a point of view. | Yes | Yes | `/studio/content/homepage → 03 Signature Collections` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/` | 03 Signature Collections | `body` — Explore furniture, collectible objects and statement art across Rivya's evolving material language. | Yes | Yes | `/studio/content/homepage → 03 Signature Collections` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/` | 03 Signature Collections | `payload.cards[0]` — Tables · dining, coffee, console and statement tables · CTA Explore Tables | Yes | Yes | `/studio/content/homepage → 03 → Cards` | No · EDITORIAL_COPY | LARGEFORMAT-DINING-003 (image) | n/a | DRAFT → publishable |
| `/` | 03 Signature Collections | `payload.cards[1]` — Sculptural Furniture · art-object mindset, seating to experimental forms · CTA Explore Furniture | Yes | Yes | `/studio/content/homepage → 03 → Cards` | No · EDITORIAL_COPY | LARGEFORMAT-SEATING-001 (image) | n/a | DRAFT → publishable |
| `/` | 03 Signature Collections | `payload.cards[2]` — 3D + Resin · digitally fabricated form, additive processes and resin craft | Yes | Yes | `/studio/content/homepage → 03 → Cards` | OVR | THREE-D-RESIN-001 (image) | n/a | DRAFT · OVR |
| `/` | 03 Signature Collections | `payload.cards[3]` — Statement Art · large-format resin compositions and immersive surfaces | Yes | Yes | `/studio/content/homepage → 03 → Cards` | No · EDITORIAL_COPY | WALL-ART-001 (image) | n/a | DRAFT → publishable |
| `/` | 03 Signature Collections | `payload.cards[4]` — Architectural Pieces · bespoke objects for distinctive interior environments | Yes | Yes | `/studio/content/homepage → 03 → Cards` | OVR | LARGEFORMAT-MONUMENTAL-001 (image) | n/a | DRAFT · OVR |

Two of the five cards assert production capability the specification requires verified (SEED §10
§03). Because `owner_verification` is a row-level column and the cards live in one section's
`payload`, the section row is flagged and `field_classifications` names `cards[2]` and `cards[4]`
as the reason. The verification banner in the block editor quotes those two card bodies.

### 6.4 Section 04 — Selected Works

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| `/` | 04 Selected Works | `eyebrow` — SELECTED WORKS | Yes | Yes | `/studio/content/homepage → 04 Selected Works` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/` | 04 Selected Works | `heading` — Objects with presence. | Yes | Yes | `/studio/content/homepage → 04 Selected Works` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/` | 04 Selected Works | `body` — A curated selection of large-format furniture, art pieces and material experiments from the Rivya collection. | Yes | Yes | `/studio/content/homepage → 04 Selected Works` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/` | 04 Selected Works | Product slots — `merchandising_slots` rows, zero seeded | No | Yes | `/studio/merchandising/homepage → Selected Works` | No · UI | merch | n/a | not seeded |
| `/` | 04 Selected Works | `payload.fallback` — `merch_fallback = 'EDITORIAL_BLOCK'` with the §04 copy | Yes | Yes | `/studio/merchandising/homepage → Selected Works → Fallback` | No · EDITORIAL_COPY | — | n/a | DRAFT → publishable |

`products` ships with zero rows (SEED §32, `DATA_MODEL.md` §1.3), so at launch this section renders
the editorial fallback rather than a grid. **No product card is ever seeded**, and a unit test
asserts the seed runner's table allowlist excludes every catalogue table.

### 6.5 Section 05 — Material Story

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| `/` | 05 Material Story | `eyebrow` — FROM LIQUID TO OBJECT | Yes | Yes | `/studio/content/homepage → 05 Material Story` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/` | 05 Material Story | `payload.sequence` — LIQUID. FORM. CRAFT. OBJECT. | Yes | Yes | `/studio/content/homepage → 05 → Headline sequence` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/` | 05 Material Story | `body` — two paragraphs on resin's transformation from fluid to lasting | Yes | Yes | `/studio/content/homepage → 05 Material Story` | No · EDITORIAL_COPY | — | n/a | DRAFT → publishable |
| `/` | 05 Material Story | `cta_label` / `cta_url` — Discover Our Process → `/process` | Yes | Yes | `/studio/content/homepage → 05 Material Story` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/` | 05 Material Story | `media_desktop_id` / `media_mobile_id` | Yes | Yes | `/studio/content/homepage → 05 → Media` | No · UI | PROCESS-POUR-009 (video) · PROCESS-POUR-001 (image) | n/a | DRAFT → publishable |

Desktop takes a clip and mobile takes a still from the same `process-pour` family, which is the
common shape across this inventory: the vertical frame is a separate asset, never a re-crop of the
landscape one (D6 makes desktop and mobile separate CMS slots). The video needs a poster — see §31,
open question 4.

### 6.6 Section 06 — Material Palette

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| `/` | 06 Material Palette | `heading` — Material defines the character of every piece. | Yes | Yes | `/studio/content/homepage → 06 Material Palette` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/` | 06 Material Palette | `payload.cards[0]` — Resin · depth, transparency, colour and movement | Yes | Yes | `/studio/content/homepage → 06 → Cards` | No · EDITORIAL_COPY | MATERIAL-MACRO-018 (image) | n/a | DRAFT → publishable |
| `/` | 06 Material Palette | `payload.cards[1]` — Wood · grain, edge and natural variation | Yes | Yes | `/studio/content/homepage → 06 → Cards` | No · EDITORIAL_COPY | MATERIAL-MACRO-020 (image) | n/a | DRAFT → publishable |
| `/` | 06 Material Palette | `payload.cards[2]` — Fabricated Form · digitally developed geometry | Yes | Yes | `/studio/content/homepage → 06 → Cards` | OVR | GAP | n/a | DRAFT · OVR |
| `/` | 06 Material Palette | `payload.cards[3]` — Finish · surface finishing and its relationship to touch, light and space | Yes | Yes | `/studio/content/homepage → 06 → Cards` | No · EDITORIAL_COPY | MATERIAL-MACRO-023 (image) | n/a | DRAFT → publishable |

The four cards want one visual set. `MATERIAL-MACRO-018` and `-020` are two frames of the manifest's
four-part 1:1 macro series shot in a single session; `MATERIAL-MACRO-023` is 4:5 and needs a 1:1
derivative through `media_crops`. **Card 3 has no candidate at all** — the manifest holds no macro
of a digitally fabricated structure — which is consistent with the card being the one the
specification flags for verification. Phase 43 brief: 1:1 extreme macro, digitally fabricated
lattice meeting cast resin, same ground and key as `MATERIAL-MACRO-016…022`.

### 6.7 Section 07 — Custom Commission

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| `/` | 07 Custom Commission | `eyebrow` — MADE FOR YOUR SPACE | Yes | Yes | `/studio/content/homepage → 07 Custom Commission` | No · BRAND_COPY | — | n/a | DRAFT · OVR |
| `/` | 07 Custom Commission | `heading` — Begin with an idea, not a catalogue limitation. | Yes | Yes | `/studio/content/homepage → 07 Custom Commission` | No · BRAND_COPY | — | n/a | DRAFT · OVR |
| `/` | 07 Custom Commission | `body` — a commission starts with your space, dimensions, visual direction and intended use | Yes | Yes | `/studio/content/homepage → 07 Custom Commission` | OVR | — | n/a | DRAFT · OVR |
| `/` | 07 Custom Commission | `payload.capabilities` — six items: custom dimensions, material direction, colour direction, form exploration, finish selection, reference-based consultation | Yes | Yes | `/studio/content/homepage → 07 → Capabilities` | OVR | — | n/a | DRAFT · OVR |
| `/` | 07 Custom Commission | `cta_label` / `cta_url` — Start a Custom Project → `/custom-commissions` | Yes | Yes | `/studio/content/homepage → 07 Custom Commission` | No · BRAND_COPY | — | n/a | DRAFT · OVR |
| `/` | 07 Custom Commission | `media_desktop_id` / `media_mobile_id` | Yes | Yes | `/studio/content/homepage → 07 → Media` | OVR | EDITORIAL-005 (image) · PROCESS-STUDIO-006 (image) | n/a | DRAFT · OVR |

SEED §10 §07 is explicit: *only publish capabilities confirmed by owner.* The six capability items
are the exact list that must be confirmed, item by item, before this section publishes.

### 6.8 Section 08 — 3D + Resin

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| `/` | 08 3D + Resin | `eyebrow` — DIGITAL FORM × MATERIAL CRAFT | Yes | Yes | `/studio/content/homepage → 08 3D + Resin` | OVR | — | n/a | DRAFT · OVR |
| `/` | 08 3D + Resin | `heading` — New forms emerge when digital fabrication meets resin. | Yes | Yes | `/studio/content/homepage → 08 3D + Resin` | OVR | — | n/a | DRAFT · OVR |
| `/` | 08 3D + Resin | `body` — how digitally developed and 3D-fabricated structures interact with cast resin | Yes | Yes | `/studio/content/homepage → 08 3D + Resin` | OVR | — | n/a | DRAFT · OVR |
| `/` | 08 3D + Resin | `cta_label` / `cta_url` — Explore 3D + Resin → `/collection/3d-resin` | Yes | Yes | `/studio/content/homepage → 08 3D + Resin` | OVR | — | n/a | DRAFT · OVR |
| `/` | 08 3D + Resin | `media_desktop_id` / `media_mobile_id` | Yes | Yes | `/studio/content/homepage → 08 → Media` | OVR | THREE-D-RESIN-002 (image) · THREE-D-RESIN-004 (image) | n/a | DRAFT · OVR |

SEED §10 §08: *do not publish as a current capability until owner confirms actual fabrication
capability.* This is the one homepage section where the entire block, eyebrow included, is gated.

### 6.9 Section 09 — Portfolio

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| `/` | 09 Portfolio | `eyebrow` — PROJECTS & STUDIES | Yes | Yes | `/studio/content/homepage → 09 Portfolio` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/` | 09 Portfolio | `heading` — From material experiment to finished environment. | Yes | Yes | `/studio/content/homepage → 09 Portfolio` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/` | 09 Portfolio | `body` — explore selected commissions, prototypes, studies and finished works | Yes | Yes | `/studio/content/homepage → 09 Portfolio` | No · EDITORIAL_COPY | — | n/a | DRAFT → publishable |
| `/` | 09 Portfolio | `cta_label` / `cta_url` — View Portfolio → `/portfolio` | Yes | Yes | `/studio/content/homepage → 09 Portfolio` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/` | 09 Portfolio | `media_desktop_id` / `media_mobile_id` | Yes | Yes | `/studio/content/homepage → 09 → Media` | No · UI | GALLERY-SCENE-003 (image) · GALLERY-SCENE-001 (image) | n/a | DRAFT → publishable |

`portfolio_projects` ships with zero rows. This section links to the landing page's empty state and
**seeds no project card**. The two gallery-scene assets are atmosphere, and their alt text must not
describe them as delivered work (SEED §43, `CONTENT_GUIDE.md` §9).

### 6.10 Section 10 — Process

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| `/` | 10 Process | `eyebrow` — HOW A PIECE TAKES FORM | Yes | Yes | `/studio/content/homepage → 10 Process` | No · BRAND_COPY | — | n/a | DRAFT · OVR |
| `/` | 10 Process | `heading` — A process built around the object. | Yes | Yes | `/studio/content/homepage → 10 Process` | No · BRAND_COPY | — | n/a | DRAFT · OVR |
| `/` | 10 Process | `payload.steps[0]` — 01 Understand · purpose, dimensions, context and visual direction | Yes | Yes | `/studio/content/homepage → 10 → Steps` | OVR | — | n/a | DRAFT · OVR |
| `/` | 10 Process | `payload.steps[1]` — 02 Develop · proportion, material relationships, colour, structure | Yes | Yes | `/studio/content/homepage → 10 → Steps` | OVR | — | n/a | DRAFT · OVR |
| `/` | 10 Process | `payload.steps[2]` — 03 Make · translate the approved direction through fabrication and resin processes | Yes | Yes | `/studio/content/homepage → 10 → Steps` | OVR | — | n/a | DRAFT · OVR |
| `/` | 10 Process | `payload.steps[3]` — 04 Finish · refine surfaces, details and material transitions | Yes | Yes | `/studio/content/homepage → 10 → Steps` | OVR | — | n/a | DRAFT · OVR |
| `/` | 10 Process | `payload.steps[4]` — 05 Deliver · prepare the completed work for its final setting | Yes | Yes | `/studio/content/homepage → 10 → Steps` | OVR | — | n/a | DRAFT · OVR |
| `/` | 10 Process | `cta_label` / `cta_url` — Explore the Process → `/process` | Yes | Yes | `/studio/content/homepage → 10 Process` | No · BRAND_COPY | — | n/a | DRAFT · OVR |
| `/` | 10 Process | `media_desktop_id` / `media_mobile_id` | Yes | Yes | `/studio/content/homepage → 10 → Media` | OVR | PROCESS-STUDIO-002 (image) · PROCESS-STUDIO-008 (image) | n/a | DRAFT · OVR |

SEED §10 §10: *these are draft process statements and require owner verification.* The five-step
homepage summary and the seven-step `/process` page (§12) describe the same production reality and
must be verified together — one owner decision, two surfaces.

### 6.11 Section 11 — Secondary Objects

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| `/` | 11 Secondary Objects | `eyebrow` — SMALLER IN SCALE. STILL PERSONAL. | Yes | Yes | `/studio/content/homepage → 11 Secondary Objects` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/` | 11 Secondary Objects | `heading` — Objects for gifting, memory and everyday spaces. | Yes | Yes | `/studio/content/homepage → 11 Secondary Objects` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/` | 11 Secondary Objects | `body` — alongside large-format work, Rivya creates smaller resin objects, personalized pieces and preservation-led designs | Yes | Yes | `/studio/content/homepage → 11 Secondary Objects` | No · EDITORIAL_COPY | — | n/a | DRAFT → publishable |
| `/` | 11 Secondary Objects | `payload.cards[0]` — Preservation | Yes | Yes | `/studio/content/homepage → 11 → Cards` | No · EDITORIAL_COPY | PRESERVATION-VARMALA-001 (image) | n/a | DRAFT → publishable |
| `/` | 11 Secondary Objects | `payload.cards[1]` — Décor | Yes | Yes | `/studio/content/homepage → 11 → Cards` | No · EDITORIAL_COPY | DECOR-002 (image) | n/a | DRAFT → publishable |
| `/` | 11 Secondary Objects | `payload.cards[2]` — Personalised Pieces | Yes | Yes | `/studio/content/homepage → 11 → Cards` | No · EDITORIAL_COPY | GIFTS-003 (image) | n/a | DRAFT → publishable |
| `/` | 11 Secondary Objects | `payload.cards[3]` — Gifts | Yes | Yes | `/studio/content/homepage → 11 → Cards` | No · EDITORIAL_COPY | GIFTS-001 (image) | n/a | DRAFT → publishable |

**Position 11 is a content rule, not a layout preference.** SEED §10 §11 requires this section to
appear after the primary large-format story, and SEED §56 forbids the homepage drifting back into
gift-store positioning. A unit test asserts `position > 10` for this `seed_key`, and
`CONTENT_GUIDE.md` §6.3 states the vocabulary rule that keeps sections 01–10 free of gift language.
Note the spelling: the card label is **Personalised Pieces** and the body says **personalized
pieces** — both are quoted verbatim from SEED §10 §11; see `CONTENT_GUIDE.md` §8.6.

### 6.12 Section 12 — Journal

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| `/` | 12 Journal | `eyebrow` — JOURNAL | Yes | Yes | `/studio/content/homepage → 12 Journal` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/` | 12 Journal | `heading` — Material, process and the ideas behind the work. | Yes | Yes | `/studio/content/homepage → 12 Journal` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/` | 12 Journal | `body` — notes from the studio on resin, furniture, digital fabrication, interiors, preservation and contemporary craft | Yes | Yes | `/studio/content/homepage → 12 Journal` | No · EDITORIAL_COPY | — | n/a | DRAFT → publishable |
| `/` | 12 Journal | `cta_label` / `cta_url` — Read the Journal → `/journal` | Yes | Yes | `/studio/content/homepage → 12 Journal` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/` | 12 Journal | `media_desktop_id` / `media_mobile_id` | Yes | Yes | `/studio/content/homepage → 12 → Media` | No · UI | EDITORIAL-008 (image) · EDITORIAL-001 (image) | n/a | DRAFT → publishable |

All ten seeded articles are `DRAFT`, so this section renders the §29 blog empty state until the
owner publishes one. The section publishes regardless — the empty state is the designed outcome,
not a failure.

### 6.13 Section 13 — Final CTA

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| `/` | 13 Final CTA | `heading` — Have a piece in mind? | Yes | Yes | `/studio/content/homepage → 13 Final CTA` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/` | 13 Final CTA | `body` — tell us about the space, size, material direction or idea you would like to explore | Yes | Yes | `/studio/content/homepage → 13 Final CTA` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/` | 13 Final CTA | `cta_label` / `cta_url` — Discuss Your Project → `/custom-commissions` | Yes | Yes | `/studio/content/homepage → 13 Final CTA` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/` | 13 Final CTA | `cta_secondary_label` / `cta_secondary_url` — WhatsApp Rivya → resolved from `contact.whatsapp` | Yes | Yes | `/studio/content/homepage → 13 Final CTA` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/` | 13 Final CTA | `media_desktop_id` / `media_mobile_id` | Yes | Yes | `/studio/content/homepage → 13 → Media` | No · UI | MATERIAL-MACRO-011 (image) · MATERIAL-MACRO-024 (image) | n/a | DRAFT → publishable |

`cta_secondary_url` is not a literal URL. It stores the token `{{whatsapp}}`, which
`lib/whatsapp/link.ts` resolves against `contact.whatsapp` when that row is `VERIFIED`, and against
`NEXT_PUBLIC_WHATSAPP_NUMBER` otherwise. The number appears in exactly one editable place (§16).

---

## 7. About — SEED §11

Page row: `pages.path = '/about'`, five `page_sections`. Studio: `/studio/content/pages → About`.

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| `/about` | Page | `pages.title` — About | Yes | Yes | `/studio/content/pages → About` | No · UI | — | n/a | DRAFT → publishable |
| `/about` | Page | `seo_entries.title` — About Rivya Living Art \| Resin Furniture & Functional Art | Yes | Yes | `/studio/content/seo → Pages → /about` | No · SEO_COPY | — | PATH seeded | DRAFT → publishable |
| `/about` | Page | `seo_entries.description` — a contemporary studio exploring resin furniture, sculptural objects, material craft and digital fabrication | Yes | Yes | `/studio/content/seo → Pages → /about` | No · SEO_COPY | — | PATH seeded | DRAFT → publishable |
| `/about` | Page | `seo_entries.og_media_id` | Yes | Yes | `/studio/content/seo → Pages → /about` | No · SEO_COPY | MATERIAL-MACRO-015 (image) | og:image | DRAFT → publishable |
| `/about` | 01 Hero | `eyebrow` — ABOUT RIVYA | Yes | Yes | `/studio/content/pages → About → 01 Hero` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/about` | 01 Hero | `heading` — We work where material becomes expression. | Yes | Yes | `/studio/content/pages → About → 01 Hero` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/about` | 01 Hero | `body` — two paragraphs: a contemporary material-led studio; functional objects need not disappear into a room | Yes | Yes | `/studio/content/pages → About → 01 Hero` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/about` | 01 Hero | `media_desktop_id` / `media_mobile_id` | Yes | Yes | `/studio/content/pages → About → 01 Hero → Media` | No · UI | MATERIAL-MACRO-015 (image) · MATERIAL-MACRO-013 (image) | n/a | DRAFT → publishable |
| `/about` | 02 Philosophy | `eyebrow` — OUR APPROACH | Yes | Yes | `/studio/content/pages → About → 02 Philosophy` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/about` | 02 Philosophy | `heading` — Not decoration added to an object. The material is the object. | Yes | Yes | `/studio/content/pages → About → 02 Philosophy` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/about` | 02 Philosophy | `heading_highlight` — The material is the object. | Yes | Yes | `/studio/content/pages → About → 02 Philosophy` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/about` | 02 Philosophy | `body` — resin offers colour, transparency, depth and movement; wood introduces grain and variation; digital fabrication opens another way to think about geometry | Yes | Yes | `/studio/content/pages → About → 02 Philosophy` | OVR | — | n/a | DRAFT · OVR |
| `/about` | 02 Philosophy | `media_desktop_id` / `media_mobile_id` | Yes | Yes | `/studio/content/pages → About → 02 Philosophy → Media` | OVR | MATERIAL-MACRO-008 (image) · MATERIAL-MACRO-002 (image) | n/a | DRAFT · OVR |
| `/about` | 03 Scale | `heading` — From intimate objects to room-defining pieces. | Yes | Yes | `/studio/content/pages → About → 03 Scale` | No · BRAND_COPY | — | n/a | DRAFT · OVR |
| `/about` | 03 Scale | `body` — primary direction is large-format functional art; smaller décor, preservation and personalized pieces extend the same thinking | Yes | Yes | `/studio/content/pages → About → 03 Scale` | OVR | — | n/a | DRAFT · OVR |
| `/about` | 03 Scale | `media_desktop_id` / `media_mobile_id` | Yes | Yes | `/studio/content/pages → About → 03 Scale → Media` | OVR | LARGEFORMAT-DINING-002 (image) · LARGEFORMAT-DINING-001 (image) | n/a | DRAFT · OVR |
| `/about` | 04 Bespoke | `heading` — Designed around context. | Yes | Yes | `/studio/content/pages → About → 04 Bespoke` | No · BRAND_COPY | — | n/a | DRAFT · OVR |
| `/about` | 04 Bespoke | `body` — bespoke work lets proportion, materials, colour and detail respond to a particular interior or idea | Yes | Yes | `/studio/content/pages → About → 04 Bespoke` | OVR | — | n/a | DRAFT · OVR |
| `/about` | 04 Bespoke | `media_desktop_id` / `media_mobile_id` | Yes | Yes | `/studio/content/pages → About → 04 Bespoke → Media` | OVR | PROCESS-STUDIO-011 (image) · PROCESS-STUDIO-015 (image) | n/a | DRAFT · OVR |
| `/about` | 05 Closing | `heading` — Living art is art that becomes part of living. | Yes | Yes | `/studio/content/pages → About → 05 Closing` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/about` | 05 Closing | `body` — it is touched, used, seen from different angles and experienced over time | Yes | Yes | `/studio/content/pages → About → 05 Closing` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/about` | 05 Closing | `cta_label` / `cta_url` — Start a Commission → `/custom-commissions` | Yes | Yes | `/studio/content/pages → About → 05 Closing` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/about` | 05 Closing | `media_desktop_id` / `media_mobile_id` | Yes | Yes | `/studio/content/pages → About → 05 Closing → Media` | No · UI | MATERIAL-MACRO-027 (image) · MATERIAL-MACRO-023 (image) | n/a | DRAFT → publishable |

Phase 09's owner-verification policy names **About — scale and bespoke** because both assert what
Rivya can physically make. This inventory extends the flag to **02 Philosophy**, whose third
sentence claims digital fabrication as a working method — the identical claim the specification
flags everywhere else it appears (§10 §08, §14 3D + Resin, §35). The extension is recorded in
`CONTENT_GUIDE.md` §4.3 rather than applied silently.

About is the one page where first-person plural is house voice — *we*, *our approach*, *our primary
direction*. Every other page speaks of Rivya in the third person (`CONTENT_GUIDE.md` §8.3).

---

## 8. Large Format — SEED §12

Page row: `pages.path = '/large-format'`, five `page_sections`; the six large-format category
entries live in section 03's `payload`, not in `categories` — they are a narrative grouping, not
part of the seven D3 taxonomy categories.

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| `/large-format` | Page | `pages.title` — Large Format | Yes | Yes | `/studio/content/pages → Large Format` | No · UI | — | n/a | DRAFT → publishable |
| `/large-format` | Page | `seo_entries.title` — Large Resin Furniture & Custom Statement Pieces \| Rivya Living Art | Yes | Yes | `/studio/content/seo → Pages → /large-format` | No · SEO_COPY | — | PATH seeded | DRAFT → publishable |
| `/large-format` | Page | `seo_entries.description` — explore large-format resin tables, sculptural furniture, statement art and bespoke functional pieces | Yes | Yes | `/studio/content/seo → Pages → /large-format` | No · SEO_COPY | — | PATH seeded | DRAFT → publishable |
| `/large-format` | Page | `seo_entries.og_media_id` | Yes | Yes | `/studio/content/seo → Pages → /large-format` | No · SEO_COPY | LARGEFORMAT-DINING-002 (image) | og:image | DRAFT → publishable |
| `/large-format` | 01 Hero | `eyebrow` — LARGE FORMAT | Yes | Yes | `/studio/content/pages → Large Format → 01 Hero` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/large-format` | 01 Hero | `heading` — Designed to shape the room around them. | Yes | Yes | `/studio/content/pages → Large Format → 01 Hero` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/large-format` | 01 Hero | `body` — the large-format collection focuses on furniture and statement objects where scale becomes part of the design | Yes | Yes | `/studio/content/pages → Large Format → 01 Hero` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/large-format` | 01 Hero | `cta_label` / `cta_url` — Discuss a Large-Format Project → `/custom-commissions` | Yes | Yes | `/studio/content/pages → Large Format → 01 Hero` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/large-format` | 01 Hero | `media_desktop_id` / `media_mobile_id` | Yes | Yes | `/studio/content/pages → Large Format → 01 Hero → Media` | No · UI | LARGEFORMAT-DINING-005 (video) · LARGEFORMAT-DINING-004 (video) | n/a | DRAFT → publishable |
| `/large-format` | 02 Category intro | `heading` — Furniture as a focal point. | Yes | Yes | `/studio/content/pages → Large Format → 02 Category Intro` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/large-format` | 02 Category intro | `body` — dining tables, conference tables, coffee tables, consoles and sculptural furniture | Yes | Yes | `/studio/content/pages → Large Format → 02 Category Intro` | OVR | — | n/a | DRAFT · OVR |
| `/large-format` | 02 Category intro | `media_desktop_id` / `media_mobile_id` | Yes | Yes | `/studio/content/pages → Large Format → 02 → Media` | OVR | LARGEFORMAT-DINING-003 (image) · LARGEFORMAT-SEATING-002 (image) | n/a | DRAFT · OVR |
| `/large-format` | 03 Categories | `payload.categories[0]` — Dining & Statement Tables · large surfaces let resin flow, natural edge and colour unfold at architectural scale | Yes | Yes | `/studio/content/pages → Large Format → 03 → Categories` | No · EDITORIAL_COPY | LARGEFORMAT-DINING-002 (image) | n/a | DRAFT · OVR |
| `/large-format` | 03 Categories | `payload.categories[1]` — Coffee & Centre Tables · lower proportions make sculptural form and base geometry visible | Yes | Yes | `/studio/content/pages → Large Format → 03 → Categories` | No · EDITORIAL_COPY | LARGEFORMAT-COFFEE-001 (image) | n/a | DRAFT · OVR |
| `/large-format` | 03 Categories | `payload.categories[2]` — Consoles & Side Pieces · narrower pieces as visual interventions in entrances and transitional areas | Yes | Yes | `/studio/content/pages → Large Format → 03 → Categories` | No · EDITORIAL_COPY | LARGEFORMAT-CONSOLE-001 (image) | n/a | DRAFT · OVR |
| `/large-format` | 03 Categories | `payload.categories[3]` — Conference & Commercial Tables · larger communal surfaces, custom dimensions and material direction | Yes | Yes | `/studio/content/pages → Large Format → 03 → Categories` | OVR | GAP | n/a | DRAFT · OVR |
| `/large-format` | 03 Categories | `payload.categories[4]` — Sculptural Seating · seating conceived with emphasis on silhouette and object character | Yes | Yes | `/studio/content/pages → Large Format → 03 → Categories` | OVR | LARGEFORMAT-SEATING-003 (image) | n/a | DRAFT · OVR |
| `/large-format` | 03 Categories | `payload.categories[5]` — Architectural & Statement Pieces · wall compositions, feature surfaces and custom objects for spatial integration | Yes | Yes | `/studio/content/pages → Large Format → 03 → Categories` | OVR | LARGEFORMAT-MONUMENTAL-001 (image) | n/a | DRAFT · OVR |
| `/large-format` | 03 Categories | Mobile media for `categories[5]` | No | Yes | `/studio/content/pages → Large Format → 03 → Categories` | OVR | GAP | n/a | not seeded |
| `/large-format` | 03 Categories | Side-piece supporting media for `categories[2]` | Yes | Yes | `/studio/content/pages → Large Format → 03 → Categories` | No · EDITORIAL_COPY | LARGEFORMAT-SIDE-001 (image) | n/a | DRAFT · OVR |
| `/large-format` | 04 Customization | `heading` — Scale changes the conversation. | Yes | Yes | `/studio/content/pages → Large Format → 04 Customization` | No · BRAND_COPY | — | n/a | DRAFT · OVR |
| `/large-format` | 04 Customization | `body` — dimensions, access, weight, structural considerations, material selection, base design and the final environment become part of the brief | Yes | Yes | `/studio/content/pages → Large Format → 04 Customization` | OVR | — | n/a | DRAFT · OVR |
| `/large-format` | 04 Customization | `media_desktop_id` / `media_mobile_id` | Yes | Yes | `/studio/content/pages → Large Format → 04 → Media` | OVR | PROCESS-STUDIO-009 (image) · PROCESS-STUDIO-015 (image) | n/a | DRAFT · OVR |
| `/large-format` | 05 CTA | `heading` — Planning a custom table, statement piece or spatial installation? | Yes | Yes | `/studio/content/pages → Large Format → 05 CTA` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/large-format` | 05 CTA | `body` — share your dimensions, space photographs, references and intended use with Rivya | Yes | Yes | `/studio/content/pages → Large Format → 05 CTA` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/large-format` | 05 CTA | `cta_label` / `cta_url` — Start the Conversation → `/custom-commissions` | Yes | Yes | `/studio/content/pages → Large Format → 05 CTA` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/large-format` | 05 CTA | `media_desktop_id` / `media_mobile_id` | Yes | Yes | `/studio/content/pages → Large Format → 05 → Media` | No · UI | LARGEFORMAT-CONSOLE-003 (image) · LARGEFORMAT-SIDE-002 (image) | n/a | DRAFT → publishable |

Three of the six large-format categories carry the flag: **Conference & Commercial Tables** and
**Architectural & Statement Pieces** because SEED §12 marks them, and **Sculptural Seating**
because SEED §12 says *mark if not yet produced* — which the seed cannot know, so it flags and lets
the owner clear it. All six live in one `page_sections` row, so the whole section is gated; the
verification banner names the three entries.

**Conference & Commercial Tables has no asset.** The manifest holds no conference or commercial
interior; `LARGEFORMAT-DINING-*` are domestic. Substituting one would present a dining table as a
boardroom capability, which is the exact failure D10 forbids. Phase 43 brief in §29.

---

## 9. Collection landing — SEED §13

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| `/collection` | Page | `pages.title` — Collection | Yes | Yes | `/studio/content/pages → Collection` | No · UI | — | n/a | DRAFT → publishable |
| `/collection` | Page | `seo_entries.title` — Collection \| Resin Furniture, Art & Custom Objects \| Rivya Living Art | Yes | Yes | `/studio/content/seo → Pages → /collection` | No · SEO_COPY | — | PATH seeded | DRAFT → publishable |
| `/collection` | Page | `seo_entries.description` — resin furniture, collectible objects, 3D + resin designs, statement art, preservation pieces and décor | Yes | Yes | `/studio/content/seo → Pages → /collection` | No · SEO_COPY | — | PATH seeded | DRAFT → publishable |
| `/collection` | Page | `seo_entries.og_media_id` | No | Yes | `/studio/content/seo → Pages → /collection` | No · SEO_COPY | GAP | og:image | not seeded |
| `/collection` | 01 Hero | `eyebrow` — COLLECTION | Yes | Yes | `/studio/content/pages → Collection → 01 Hero` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/collection` | 01 Hero | `heading` — Functional objects. Material stories. | Yes | Yes | `/studio/content/pages → Collection → 01 Hero` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/collection` | 01 Hero | `body` — explore Rivya across furniture, collectible design, statement art and smaller resin objects | Yes | Yes | `/studio/content/pages → Collection → 01 Hero` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/collection` | 01 Hero | `media_desktop_id` / `media_mobile_id` | No | Yes | `/studio/content/pages → Collection → 01 Hero → Media` | No · UI | GAP | n/a | not seeded |
| `/collection` | 02 Category order | Tile order — `categories.sort_order` 1–7 in the SEED §56 priority order | Yes | Yes | `/studio/merchandising/store` | No · UI | — | n/a | DRAFT → publishable |

The seven tiles read their heading, description and hero image from `categories` (§10) — there is no
second copy of category text on this page. Reordering is a merchandising action, not a content edit,
and `sort_order` is the single column both the landing grid and the mega menu read.

---

## 10. The seven categories — SEED §14

Each category is a `pages` row of `kind = 'CATEGORY'` at `/collection/<slug>` whose hero block
declares `payload.source = 'category'` and renders `categories.subtitle` as its heading and
`categories.description` as its body. **The copy therefore has exactly one editable control** —
`/studio/catalog/categories` — and never diverges between the tile, the mega menu and the page.

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| `/collection/furniture` | Category | `categories.name` — Furniture | Yes | Yes | `/studio/catalog/categories → Furniture` | No · BRAND_COPY | — | ENTITY seeded | DRAFT → publishable |
| `/collection/furniture` | Category | `categories.subtitle` — Furniture with material at its centre. | Yes | Yes | `/studio/catalog/categories → Furniture` | No · BRAND_COPY | — | ENTITY seeded | DRAFT → publishable |
| `/collection/furniture` | Category | `categories.description` — tables, seating and functional objects where resin, natural material and form become one composition | Yes | Yes | `/studio/catalog/categories → Furniture` | No · EDITORIAL_COPY | — | ENTITY seeded | DRAFT → publishable |
| `/collection/furniture` | Category | `categories.hero_media_id` | No | Yes | `/studio/catalog/categories → Furniture → Media` | No · UI | GAP | og:image | not seeded |
| `/collection/collectible-design` | Category | `categories.name` — Collectible Design | Yes | Yes | `/studio/catalog/categories → Collectible Design` | No · BRAND_COPY | — | ENTITY seeded | DRAFT → publishable |
| `/collection/collectible-design` | Category | `categories.subtitle` — Functional pieces conceived as objects of design. | Yes | Yes | `/studio/catalog/categories → Collectible Design` | No · BRAND_COPY | — | ENTITY seeded | DRAFT → publishable |
| `/collection/collectible-design` | Category | `categories.description` — limited, experimental and sculptural pieces exploring stronger silhouettes and expressive form | Yes | Yes | `/studio/catalog/categories → Collectible Design` | OVR | — | ENTITY seeded | DRAFT · OVR |
| `/collection/collectible-design` | Category | `categories.hero_media_id` | No | Yes | `/studio/catalog/categories → Collectible Design → Media` | No · UI | GAP | og:image | not seeded |
| `/collection/3d-resin` | Category | `categories.name` — 3D + Resin | Yes | Yes | `/studio/catalog/categories → 3D + Resin` | No · BRAND_COPY | — | ENTITY seeded | DRAFT · OVR |
| `/collection/3d-resin` | Category | `categories.subtitle` — Digital form meets fluid material. | Yes | Yes | `/studio/catalog/categories → 3D + Resin` | OVR | — | ENTITY seeded | DRAFT · OVR |
| `/collection/3d-resin` | Category | `categories.description` — an experimental category exploring how 3D-fabricated geometry and resin interact | Yes | Yes | `/studio/catalog/categories → 3D + Resin` | OVR | — | ENTITY seeded | DRAFT · OVR |
| `/collection/3d-resin` | Category | `categories.hero_media_id` | Yes | Yes | `/studio/catalog/categories → 3D + Resin → Media` | OVR | THREE-D-RESIN-003 (image) | og:image | DRAFT · OVR |
| `/collection/wall-statement-art` | Category | `categories.name` — Wall & Statement Art | Yes | Yes | `/studio/catalog/categories → Wall & Statement Art` | No · BRAND_COPY | — | ENTITY seeded | DRAFT → publishable |
| `/collection/wall-statement-art` | Category | `categories.subtitle` — Art with depth, light and material presence. | Yes | Yes | `/studio/catalog/categories → Wall & Statement Art` | No · BRAND_COPY | — | ENTITY seeded | DRAFT → publishable |
| `/collection/wall-statement-art` | Category | `categories.description` — resin panels, sculptural wall pieces and large-format compositions creating visual focus | Yes | Yes | `/studio/catalog/categories → Wall & Statement Art` | No · EDITORIAL_COPY | — | ENTITY seeded | DRAFT → publishable |
| `/collection/wall-statement-art` | Category | `categories.hero_media_id` | Yes | Yes | `/studio/catalog/categories → Wall & Statement Art → Media` | No · UI | WALL-ART-008 (image) | og:image | DRAFT → publishable |
| `/collection/preservation` | Category | `categories.name` — Preservation | Yes | Yes | `/studio/catalog/categories → Preservation` | No · BRAND_COPY | — | ENTITY seeded | DRAFT · OVR |
| `/collection/preservation` | Category | `categories.subtitle` — Objects designed to hold what matters. | Yes | Yes | `/studio/catalog/categories → Preservation` | No · BRAND_COPY | — | ENTITY seeded | DRAFT · OVR |
| `/collection/preservation` | Category | `categories.description` — preservation pieces transform meaningful flowers, keepsakes and memories into lasting resin objects | Yes | Yes | `/studio/catalog/categories → Preservation` | OVR | — | ENTITY seeded | DRAFT · OVR |
| `/collection/preservation` | Category | `categories.hero_media_id` | Yes | Yes | `/studio/catalog/categories → Preservation → Media` | OVR | PRESERVATION-VARMALA-002 (image) | og:image | DRAFT · OVR |
| `/collection/decor` | Category | `categories.name` — Décor | Yes | Yes | `/studio/catalog/categories → Décor` | No · BRAND_COPY | — | ENTITY seeded | DRAFT → publishable |
| `/collection/decor` | Category | `categories.subtitle` — Material details for everyday spaces. | Yes | Yes | `/studio/catalog/categories → Décor` | No · BRAND_COPY | — | ENTITY seeded | DRAFT → publishable |
| `/collection/decor` | Category | `categories.description` — smaller functional and decorative pieces carrying Rivya's resin-led visual language into the home | Yes | Yes | `/studio/catalog/categories → Décor` | No · EDITORIAL_COPY | — | ENTITY seeded | DRAFT → publishable |
| `/collection/decor` | Category | `categories.hero_media_id` | Yes | Yes | `/studio/catalog/categories → Décor → Media` | No · UI | DECOR-013 (image) | og:image | DRAFT → publishable |
| `/collection/gifts` | Category | `categories.name` — Gifts | Yes | Yes | `/studio/catalog/categories → Gifts` | No · BRAND_COPY | — | ENTITY seeded | DRAFT → publishable |
| `/collection/gifts` | Category | `categories.subtitle` — Personal, made with intention. | Yes | Yes | `/studio/catalog/categories → Gifts` | No · BRAND_COPY | — | ENTITY seeded | DRAFT → publishable |
| `/collection/gifts` | Category | `categories.description` — customizable resin objects for meaningful gifting, celebrations and personal occasions | Yes | Yes | `/studio/catalog/categories → Gifts` | OVR | — | ENTITY seeded | DRAFT · OVR |
| `/collection/gifts` | Category | `categories.hero_media_id` | Yes | Yes | `/studio/catalog/categories → Gifts → Media` | No · UI | GIFTS-004 (image) | og:image | DRAFT → publishable |

Verification notes, one per flagged row:

| Category | Why flagged | What the owner is confirming |
|---|---|---|
| Collectible Design | *Do not imply limited edition unless actual product supports it* (SEED §14) | That limited or one-of-one work is genuinely offered. Until then the word **limited** must come out of the description, or `edition_state` must exist on real products |
| 3D + Resin | SEED §14 marks the category | That 3D-fabricated geometry is a real production method, not an aspiration |
| Preservation | *Do not make preservation-longevity claims beyond what is supportable* (SEED §14) | That "lasting" is defensible. No duration, guarantee or material-performance figure may ever be added |
| Gifts | The word **customizable** asserts an offered service | That resin objects can in fact be customised for an occasion |

`furniture` and `collectible-design` have **no hero asset**. The manifest's large-format families
are page-scoped to `/large-format`; reusing a dining table as the Furniture category hero is
defensible and is the first thing Phase 43 should evaluate before generating
(`LARGEFORMAT-DINING-003 (image, 16:9)` and `LARGEFORMAT-SEATING-004 (image, 4:5)` are the closest
fits). Collectible Design has no candidate at all.

---

## 11. Custom Commissions — SEED §15

Page row: `pages.path = '/custom-commissions'`, six `page_sections`. The starting-point list and the
"what to share" list are **not** page copy: they are the option set and field labels of the
commission form (§22), rendered by the page. One source, one control.

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| `/custom-commissions` | Page | `pages.title` — Custom Commissions | Yes | Yes | `/studio/content/pages → Custom Commissions` | No · UI | — | n/a | DRAFT → publishable |
| `/custom-commissions` | Page | `seo_entries.title` — Custom Resin Furniture & Art Commissions \| Rivya Living Art | Yes | Yes | `/studio/content/seo → Pages → /custom-commissions` | No · SEO_COPY | — | PATH seeded | DRAFT → publishable |
| `/custom-commissions` | Page | `seo_entries.description` — start a bespoke resin furniture, statement art or custom object project | Yes | Yes | `/studio/content/seo → Pages → /custom-commissions` | No · SEO_COPY | — | PATH seeded | DRAFT → publishable |
| `/custom-commissions` | Page | `seo_entries.og_media_id` | No | Yes | `/studio/content/seo → Pages → /custom-commissions` | No · SEO_COPY | GAP | og:image | not seeded |
| `/custom-commissions` | 01 Hero | `eyebrow` — CUSTOM COMMISSIONS | Yes | Yes | `/studio/content/pages → Custom Commissions → 01 Hero` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/custom-commissions` | 01 Hero | `heading` — Your space. Your idea. A piece developed around both. | Yes | Yes | `/studio/content/pages → Custom Commissions → 01 Hero` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/custom-commissions` | 01 Hero | `body` — a custom commission lets size, material direction, colour, form and detail respond to the project | Yes | Yes | `/studio/content/pages → Custom Commissions → 01 Hero` | OVR | — | n/a | DRAFT · OVR |
| `/custom-commissions` | 01 Hero | `cta_label` / `cta_url` — Start Your Project → `#commission-form` | Yes | Yes | `/studio/content/pages → Custom Commissions → 01 Hero` | No · BRAND_COPY | — | n/a | DRAFT · OVR |
| `/custom-commissions` | 01 Hero | `media_desktop_id` / `media_mobile_id` | No | Yes | `/studio/content/pages → Custom Commissions → 01 Hero → Media` | No · UI | GAP | n/a | not seeded |
| `/custom-commissions` | 02 Who it is for | `heading` — For homes, workspaces and distinctive interiors. | Yes | Yes | `/studio/content/pages → Custom Commissions → 02 Who It Is For` | OVR | — | n/a | DRAFT · OVR |
| `/custom-commissions` | 02 Who it is for | `body` — enquiries may begin with a room, a material palette, a functional need, an inspiration image or an idea that needs development | Yes | Yes | `/studio/content/pages → Custom Commissions → 02 Who It Is For` | OVR | — | n/a | DRAFT · OVR |
| `/custom-commissions` | 02 Who it is for | `media_desktop_id` / `media_mobile_id` | No | Yes | `/studio/content/pages → Custom Commissions → 02 → Media` | No · UI | GAP | n/a | not seeded |
| `/custom-commissions` | 03 Starting points | `payload.form_ref` — renders the nine `project_type` options from the commission form | Yes | Yes | `/studio/catalog/customization-forms/commission → project_type` | OVR | — | n/a | DRAFT · OVR |
| `/custom-commissions` | 04 What to share | `heading` — A useful brief can be simple. | Yes | Yes | `/studio/content/pages → Custom Commissions → 04 What To Share` | No · BRAND_COPY | — | n/a | DRAFT · OVR |
| `/custom-commissions` | 04 What to share | `payload.form_ref` — renders the nine commission-form field labels | Yes | Yes | `/studio/catalog/customization-forms/commission` | OVR | — | n/a | DRAFT · OVR |
| `/custom-commissions` | 04 What to share | `media_desktop_id` / `media_mobile_id` | No | Yes | `/studio/content/pages → Custom Commissions → 04 → Media` | No · UI | GAP | n/a | not seeded |
| `/custom-commissions` | 05 How it works | `payload.steps[0]` — 01 Enquiry · share the basic idea, dimensions and references | Yes | Yes | `/studio/content/pages → Custom Commissions → 05 → Steps` | OVR | — | n/a | DRAFT · OVR |
| `/custom-commissions` | 05 How it works | `payload.steps[1]` — 02 Discussion · Rivya reviews the requirement and continues on WhatsApp | Yes | Yes | `/studio/content/pages → Custom Commissions → 05 → Steps` | OVR | — | n/a | DRAFT · OVR |
| `/custom-commissions` | 05 How it works | `payload.steps[2]` — 03 Direction · materials, design direction, feasibility and commercial details are discussed | Yes | Yes | `/studio/content/pages → Custom Commissions → 05 → Steps` | OVR | — | n/a | DRAFT · OVR |
| `/custom-commissions` | 05 How it works | `payload.steps[3]` — 04 Confirmation · price, production details, payment and delivery are confirmed manually | Yes | Yes | `/studio/content/pages → Custom Commissions → 05 → Steps` | OVR | — | n/a | DRAFT · OVR |
| `/custom-commissions` | 05 How it works | `media_desktop_id` / `media_mobile_id` | No | Yes | `/studio/content/pages → Custom Commissions → 05 → Media` | No · UI | GAP | n/a | not seeded |
| `/custom-commissions` | 06 CTA | `heading` — Start with the idea. We can discuss the rest. | Yes | Yes | `/studio/content/pages → Custom Commissions → 06 CTA` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/custom-commissions` | 06 CTA | `cta_label` / `cta_url` — Enquire on WhatsApp → `{{whatsapp}}` | Yes | Yes | `/studio/content/pages → Custom Commissions → 06 CTA` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/custom-commissions` | 06 CTA | `media_desktop_id` / `media_mobile_id` | No | Yes | `/studio/content/pages → Custom Commissions → 06 → Media` | No · UI | GAP | n/a | not seeded |
| `/custom-commissions` | Form mount | `customization_forms` row `slug = 'commission'`, `kind = 'CUSTOM'` — intro heading and body | Yes | Yes | `/studio/catalog/customization-forms/commission` | OVR | — | n/a | DRAFT · OVR |
| `/custom-commissions` | Form mount | Submit label — resolves `action.request_a_quote` from the CTA library | Yes | Yes | `/studio/content/pages/global → Action Labels` | No · BRAND_COPY | — | n/a | PUBLISHED |

**Step 04 is the business rule in prose.** *Price, production details, payment and delivery are
confirmed manually* is the customer-facing statement of D1's no-checkout rule, and it must survive
every future edit. `CONTENT_GUIDE.md` §7.4 makes it a protected sentence.

**Six media gaps on one page.** `/custom-commissions` is the highest-intent page on the site and has
no bound asset at all — the manifest has no consultation, brief or handover family beyond the two
`editorial` frames already used elsewhere. Before Phase 43 generates anything, evaluate
`EDITORIAL-005 (image, 3:2)` (sketches, wood samples and a consultation table),
`PROCESS-STUDIO-011 (image, 3:2)` and `PROCESS-STUDIO-015 (image, 3:4)`. Reuse beats generation
(D6); the gaps stay recorded until the owner picks.

---

## 12. Process — SEED §16

Page row: `pages.path = '/process'`, hero plus seven step sections. Every step describes an actual
production method, so **all eight sections carry the flag** — this is the single largest
verification block on the site and clears with one owner conversation.

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| `/process` | Page | `pages.title` — Process | Yes | Yes | `/studio/content/pages → Process` | No · UI | — | n/a | DRAFT → publishable |
| `/process` | Page | `seo_entries.title` — Our Process \| Rivya Living Art | Yes | Yes | `/studio/content/seo → Pages → /process` | No · SEO_COPY | — | PATH seeded | DRAFT → publishable |
| `/process` | Page | `seo_entries.description` — the design, material and making process behind Rivya's resin furniture and custom objects | Yes | Yes | `/studio/content/seo → Pages → /process` | No · SEO_COPY | — | PATH seeded | DRAFT → publishable |
| `/process` | Page | `seo_entries.og_media_id` | Yes | Yes | `/studio/content/seo → Pages → /process` | No · SEO_COPY | PROCESS-STUDIO-002 (image) | og:image | DRAFT → publishable |
| `/process` | 01 Hero | `eyebrow` — PROCESS | Yes | Yes | `/studio/content/pages → Process → 01 Hero` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/process` | 01 Hero | `heading` — From an idea to a material object. | Yes | Yes | `/studio/content/pages → Process → 01 Hero` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/process` | 01 Hero | `body` — every project differs, but the process is guided by the same principle | Yes | Yes | `/studio/content/pages → Process → 01 Hero` | No · EDITORIAL_COPY | — | n/a | DRAFT → publishable |
| `/process` | 01 Hero | `media_desktop_id` / `media_mobile_id` | Yes | Yes | `/studio/content/pages → Process → 01 Hero → Media` | No · UI | PROCESS-STUDIO-016 (video) · PROCESS-STUDIO-006 (image) | n/a | DRAFT → publishable |
| `/process` | 02 Step 01 Brief | `heading` — Understand the purpose. | Yes | Yes | `/studio/content/pages → Process → 02 Step 01` | OVR | — | n/a | DRAFT · OVR |
| `/process` | 02 Step 01 Brief | `body` — dimensions, use, environment, reference imagery and visual direction establish the starting point | Yes | Yes | `/studio/content/pages → Process → 02 Step 01` | OVR | — | n/a | DRAFT · OVR |
| `/process` | 02 Step 01 Brief | `media_desktop_id` / `media_mobile_id` | Yes | Yes | `/studio/content/pages → Process → 02 → Media` | OVR | EDITORIAL-005 (image) · PROCESS-STUDIO-015 (image) | n/a | DRAFT · OVR |
| `/process` | 03 Step 02 Material direction | `heading` — Choose what the piece needs to express. | Yes | Yes | `/studio/content/pages → Process → 03 Step 02` | OVR | — | n/a | DRAFT · OVR |
| `/process` | 03 Step 02 Material direction | `body` — resin colour, transparency, wood character, structural material and finish influence appearance and function | Yes | Yes | `/studio/content/pages → Process → 03 Step 02` | OVR | — | n/a | DRAFT · OVR |
| `/process` | 03 Step 02 Material direction | `media_desktop_id` / `media_mobile_id` | Yes | Yes | `/studio/content/pages → Process → 03 → Media` | OVR | PROCESS-PIGMENT-012 (video) · PROCESS-PIGMENT-013 (video) | n/a | DRAFT · OVR |
| `/process` | 04 Step 03 Form development | `heading` — Shape the relationship between materials. | Yes | Yes | `/studio/content/pages → Process → 04 Step 03` | OVR | — | n/a | DRAFT · OVR |
| `/process` | 04 Step 03 Form development | `body` — proportion, edge, thickness, silhouette and structural direction are developed around the piece | Yes | Yes | `/studio/content/pages → Process → 04 Step 03` | OVR | — | n/a | DRAFT · OVR |
| `/process` | 04 Step 03 Form development | `media_desktop_id` / `media_mobile_id` | Yes | Yes | `/studio/content/pages → Process → 04 → Media` | OVR | PROCESS-TIMBER-006 (video) · PROCESS-TIMBER-001 (image) | n/a | DRAFT · OVR |
| `/process` | 05 Step 04 Fabrication | `heading` — Translate the direction into physical form. | Yes | Yes | `/studio/content/pages → Process → 05 Step 04` | OVR | — | n/a | DRAFT · OVR |
| `/process` | 05 Step 04 Fabrication | `body` — the appropriate fabrication method is selected according to the design and material requirements | Yes | Yes | `/studio/content/pages → Process → 05 Step 04` | OVR | — | n/a | DRAFT · OVR |
| `/process` | 05 Step 04 Fabrication | `media_desktop_id` / `media_mobile_id` | Yes | Yes | `/studio/content/pages → Process → 05 → Media` | OVR | PROCESS-MOULD-012 (video) · PROCESS-MOULD-003 (image) | n/a | DRAFT · OVR |
| `/process` | 06 Step 05 Resin work | `heading` — Control movement without removing character. | Yes | Yes | `/studio/content/pages → Process → 06 Step 05` | OVR | — | n/a | DRAFT · OVR |
| `/process` | 06 Step 05 Resin work | `body` — colour, layering, transparency and composition are developed according to the intended visual result | Yes | Yes | `/studio/content/pages → Process → 06 Step 05` | OVR | — | n/a | DRAFT · OVR |
| `/process` | 06 Step 05 Resin work | `media_desktop_id` / `media_mobile_id` | Yes | Yes | `/studio/content/pages → Process → 06 → Media` | OVR | PROCESS-POUR-010 (video) · PROCESS-POUR-002 (image) | n/a | DRAFT · OVR |
| `/process` | 07 Step 06 Finishing | `heading` — Refine what the eye and hand experience. | Yes | Yes | `/studio/content/pages → Process → 07 Step 06` | OVR | — | n/a | DRAFT · OVR |
| `/process` | 07 Step 06 Finishing | `body` — surfaces, edges and transitions are finished to support the final visual and tactile quality | Yes | Yes | `/studio/content/pages → Process → 07 Step 06` | OVR | — | n/a | DRAFT · OVR |
| `/process` | 07 Step 06 Finishing | `media_desktop_id` / `media_mobile_id` | Yes | Yes | `/studio/content/pages → Process → 07 → Media` | OVR | PROCESS-FINISH-007 (image) · PROCESS-FINISH-001 (image) | n/a | DRAFT · OVR |
| `/process` | 08 Step 07 Final review | `heading` — Consider the piece as a whole. | Yes | Yes | `/studio/content/pages → Process → 08 Step 07` | OVR | — | n/a | DRAFT · OVR |
| `/process` | 08 Step 07 Final review | `body` — the completed object is reviewed against its intended form, finish and project requirements before handover | Yes | Yes | `/studio/content/pages → Process → 08 Step 07` | OVR | — | n/a | DRAFT · OVR |
| `/process` | 08 Step 07 Final review | `media_desktop_id` / `media_mobile_id` | Yes | Yes | `/studio/content/pages → Process → 08 → Media` | OVR | PROCESS-CURE-006 (image) · PROCESS-CURE-001 (image) | n/a | DRAFT · OVR |

**Step 04 is the sentence most likely to become false.** SEED §16 says *avoid specific production
claims until verified*: the seeded body deliberately names no machine, no technique and no
tolerance. Any edit that adds one re-opens verification — `CONTENT_GUIDE.md` §4.4.

`/process` has 79 available assets, more than any other page. Every step binds a real one and the
page has **zero media gaps**. The `process-*` families also supply the alternates an editor can swap
in from the media picker without leaving the Studio.

---

## 13. Portfolio landing — SEED §17 and §28

`portfolio_projects` ships with **zero rows**, permanently, by seed policy. There is no fictional
client project, no invented commission and no named customer anywhere in the seed.

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| `/portfolio` | Page | `pages.title` — Portfolio | Yes | Yes | `/studio/content/pages → Portfolio` | No · UI | — | n/a | DRAFT → publishable |
| `/portfolio` | Page | `seo_entries.title` — Selected Works & Projects \| Rivya Living Art | Yes | Yes | `/studio/content/seo → Pages → /portfolio` | No · SEO_COPY | — | PATH seeded | DRAFT → publishable |
| `/portfolio` | Page | `seo_entries.description` — furniture, resin art, material studies and custom projects | Yes | Yes | `/studio/content/seo → Pages → /portfolio` | No · SEO_COPY | — | PATH seeded | DRAFT → publishable |
| `/portfolio` | Page | `seo_entries.og_media_id` | Yes | Yes | `/studio/content/seo → Pages → /portfolio` | No · SEO_COPY | GALLERY-SCENE-002 (image) | og:image | DRAFT → publishable |
| `/portfolio` | 01 Hero | `eyebrow` — SELECTED WORKS | Yes | Yes | `/studio/content/pages → Portfolio → 01 Hero` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/portfolio` | 01 Hero | `heading` — Ideas made material. | Yes | Yes | `/studio/content/pages → Portfolio → 01 Hero` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/portfolio` | 01 Hero | `body` — a growing archive of finished pieces, prototypes, commissions and material studies | Yes | Yes | `/studio/content/pages → Portfolio → 01 Hero` | No · EDITORIAL_COPY | — | n/a | DRAFT → publishable |
| `/portfolio` | 01 Hero | `media_desktop_id` / `media_mobile_id` | Yes | Yes | `/studio/content/pages → Portfolio → 01 Hero → Media` | No · UI | GALLERY-SCENE-002 (image) · GALLERY-SCENE-001 (image) | n/a | DRAFT → publishable |

The `gallery-scene` assets are **atmosphere, not evidence**. Their alt text describes a gallery
interior, never a delivered Rivya installation, and `is_concept = true` on the media row keeps the
Studio banner in front of every editor who opens them. `enforce_evidence_gate()` refuses to publish
any `portfolio_projects` row without `owner_verification = 'VERIFIED'`, and any row naming a person
or client without `client_consent_state = 'GRANTED'`.

The portfolio empty state is a `global_content` row, listed in §20.

---

## 14. Journal — SEED §18, §19, §20

### 14.1 Landing page

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| `/journal` | Page | `pages.title` — Journal | Yes | Yes | `/studio/content/pages → Journal` | No · UI | — | n/a | DRAFT → publishable |
| `/journal` | Page | `seo_entries.title` — Journal \| Resin, Furniture & Material Stories \| Rivya Living Art | Yes | Yes | `/studio/content/seo → Pages → /journal` | No · SEO_COPY | — | PATH seeded | DRAFT → publishable |
| `/journal` | Page | `seo_entries.description` — ideas, guides and studio notes about resin furniture, materials, 3D fabrication, preservation and contemporary craft | Yes | Yes | `/studio/content/seo → Pages → /journal` | No · SEO_COPY | — | PATH seeded | DRAFT → publishable |
| `/journal` | Page | `seo_entries.og_media_id` | Yes | Yes | `/studio/content/seo → Pages → /journal` | No · SEO_COPY | EDITORIAL-009 (image) | og:image | DRAFT → publishable |
| `/journal` | 01 Hero | `eyebrow` — RIVYA JOURNAL | Yes | Yes | `/studio/content/pages → Journal → 01 Hero` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/journal` | 01 Hero | `heading` — Material. Process. Perspective. | Yes | Yes | `/studio/content/pages → Journal → 01 Hero` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/journal` | 01 Hero | `body` — stories and guides exploring the materials, ideas and processes surrounding Rivya's work | Yes | Yes | `/studio/content/pages → Journal → 01 Hero` | No · EDITORIAL_COPY | — | n/a | DRAFT → publishable |
| `/journal` | 01 Hero | `media_desktop_id` / `media_mobile_id` | Yes | Yes | `/studio/content/pages → Journal → 01 Hero → Media` | No · UI | EDITORIAL-009 (image) · EDITORIAL-017 (video) | n/a | DRAFT → publishable |

### 14.2 The nine journal categories

`journal_categories` has no media column, so the Media cell is `—` (no slot), not `GAP`.
All nine: `Seeded? Yes`, `Editable? Yes`, `No · EDITORIAL_COPY`, `ENTITY seeded`,
`DRAFT → publishable`.

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| `/journal/category/resin-furniture` | Journal category | `name` — Resin Furniture, `position` 1 | Yes | Yes | `/studio/content/journal/categories` | No · EDITORIAL_COPY | — | ENTITY seeded | DRAFT → publishable |
| `/journal/category/collectible-design` | Journal category | `name` — Collectible Design, `position` 2 | Yes | Yes | `/studio/content/journal/categories` | No · EDITORIAL_COPY | — | ENTITY seeded | DRAFT → publishable |
| `/journal/category/materials` | Journal category | `name` — Materials, `position` 3 | Yes | Yes | `/studio/content/journal/categories` | No · EDITORIAL_COPY | — | ENTITY seeded | DRAFT → publishable |
| `/journal/category/3d-printing` | Journal category | `name` — 3D Printing, `position` 4 | Yes | Yes | `/studio/content/journal/categories` | No · EDITORIAL_COPY | — | ENTITY seeded | DRAFT → publishable |
| `/journal/category/studio-process` | Journal category | `name` — Studio Process, `position` 5 | Yes | Yes | `/studio/content/journal/categories` | No · EDITORIAL_COPY | — | ENTITY seeded | DRAFT → publishable |
| `/journal/category/custom-projects` | Journal category | `name` — Custom Projects, `position` 6 | Yes | Yes | `/studio/content/journal/categories` | No · EDITORIAL_COPY | — | ENTITY seeded | DRAFT → publishable |
| `/journal/category/interior-art` | Journal category | `name` — Interior Art, `position` 7 | Yes | Yes | `/studio/content/journal/categories` | No · EDITORIAL_COPY | — | ENTITY seeded | DRAFT → publishable |
| `/journal/category/preservation` | Journal category | `name` — Preservation, `position` 8 | Yes | Yes | `/studio/content/journal/categories` | No · EDITORIAL_COPY | — | ENTITY seeded | DRAFT → publishable |
| `/journal/category/care-education` | Journal category | `name` — Care & Education, `position` 9 | Yes | Yes | `/studio/content/journal/categories` | No · EDITORIAL_COPY | — | ENTITY seeded | DRAFT → publishable |

Each category also carries an editable `description` and `intro_heading`; the seed leaves both null
so the archive page renders the category name alone rather than a generated sentence. Writing them
is the owner's first editorial task, not the seed's.

### 14.3 The ten article drafts

`status = 'DRAFT'`, `byline = 'Rivya Living Art'`, **no body**. `angle_note` holds the editorial
angle from SEED §20 and is a Studio-only field — it never renders publicly. Covers are bound so the
archive has something to show the moment an owner publishes.

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| `/journal/[slug]` | Article 01 | `title` — What Makes a Resin Table More Than a Surface? · angle: material depth, composition, scale, role in interiors | Yes | Yes | `/studio/content/journal → Article 01` | No · EDITORIAL_COPY | EDITORIAL-003 (image) · EDITORIAL-001 (image) | ENTITY seeded | DRAFT |
| `/journal/[slug]` | Article 02 | `title` — Choosing the Right Size for a Statement Dining Table · angle: room proportion, circulation, seating, visual scale | Yes | Yes | `/studio/content/journal → Article 02` | No · EDITORIAL_COPY | LARGEFORMAT-DINING-003 (image) · LARGEFORMAT-DINING-001 (image) | ENTITY seeded | DRAFT |
| `/journal/[slug]` | Article 03 | `title` — Resin and Wood: Designing Around Contrast · angle: transparency and colour against natural grain | Yes | Yes | `/studio/content/journal → Article 03` | No · EDITORIAL_COPY | MATERIAL-MACRO-008 (image) · MATERIAL-MACRO-020 (image) | ENTITY seeded | DRAFT |
| `/journal/[slug]` | Article 04 | `title` — From Digital Form to Physical Object · angle: digital design, 3D fabrication and resin experimentation | Yes | Yes | `/studio/content/journal → Article 04` | OVR | THREE-D-RESIN-006 (image) · THREE-D-RESIN-004 (image) | ENTITY seeded | DRAFT · OVR |
| `/journal/[slug]` | Article 05 | `title` — What to Prepare Before Requesting a Custom Furniture Commission · angle: dimensions, references, use, material preferences, space images | Yes | Yes | `/studio/content/journal → Article 05` | No · EDITORIAL_COPY | EDITORIAL-005 (image) · PROCESS-STUDIO-015 (image) | ENTITY seeded | DRAFT |
| `/journal/[slug]` | Article 06 | `title` — A Guide to Resin Colour, Transparency and Visual Depth | Yes | Yes | `/studio/content/journal → Article 06` | No · EDITORIAL_COPY | MATERIAL-MACRO-028 (image) · MATERIAL-MACRO-024 (image) | ENTITY seeded | DRAFT |
| `/journal/[slug]` | Article 07 | `title` — Large Wall Art: Thinking Beyond Decoration | Yes | Yes | `/studio/content/journal → Article 07` | No · EDITORIAL_COPY | WALL-ART-002 (image) · WALL-ART-011 (image) | ENTITY seeded | DRAFT |
| `/journal/[slug]` | Article 08 | `title` — Preserving Flowers in Resin: What a Custom Brief Should Include | Yes | Yes | `/studio/content/journal → Article 08` | OVR | PRESERVATION-VARMALA-007 (image) · PRESERVATION-VARMALA-005 (image) | ENTITY seeded | DRAFT · OVR |
| `/journal/[slug]` | Article 09 | `title` — How Material Choice Changes the Character of a Space | Yes | Yes | `/studio/content/journal → Article 09` | No · EDITORIAL_COPY | INTERIOR-LIFESTYLE-002 (image) · INTERIOR-LIFESTYLE-003 (image) | ENTITY seeded | DRAFT |
| `/journal/[slug]` | Article 10 | `title` — Why Bespoke Furniture Starts With Context | Yes | Yes | `/studio/content/journal → Article 10` | No · EDITORIAL_COPY | INTERIOR-LIFESTYLE-004 (image) · GALLERY-SCENE-001 (image) | ENTITY seeded | DRAFT |
| `/journal/[slug]` | All ten | `standfirst`, `excerpt`, body blocks | No | Yes | `/studio/content/journal → [article] → Body` | No · EDITORIAL_COPY | — | ENTITY seeded | not seeded |
| `/journal/[slug]` | All ten | `primary_category_id` — assigned from the nine seeded categories | Yes | Yes | `/studio/content/journal → [article] → Categories` | No · UI | — | n/a | DRAFT |
| `/journal/[slug]` | All ten | `reading_minutes` — computed on save at 200 wpm | No | No | derived, not editable | No · UI | — | n/a | not seeded |

Articles **04** and **08** carry the flag. Article 04 would assert Rivya's own digital-fabrication
capability the moment a body is written; article 08 touches preservation performance, and SEED §20
says *do not make technical preservation-performance promises*. The flag is on the empty draft
deliberately, so the writer meets the constraint before the first sentence, not after.

**Titles are not claims.** *Choosing the Right Size for a Statement Dining Table* (article 02) must
never resolve into a table of standard dimensions: SEED §20 says *avoid claiming exact standards
unless sourced*. `CONTENT_GUIDE.md` §7.5 makes sourcing a publication condition for that article.

---

## 15. Contact — SEED §21

Contact details are stored **once**, in `global_content` group `CONTACT`, and every component
resolves them from there. SEED §21 is explicit: *do not hardcode these values in multiple
components.* All four are seeded `OWNER_VERIFICATION_REQUIRED` — they are real business facts the
seed cannot confirm, and Phase 09's policy names them first.

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| `/contact` | Page | `pages.title` — Contact | Yes | Yes | `/studio/content/pages → Contact` | No · UI | — | n/a | DRAFT → publishable |
| `/contact` | Page | `seo_entries.title` — Contact Rivya Living Art | Yes | Yes | `/studio/content/seo → Pages → /contact` | No · SEO_COPY | — | PATH seeded | DRAFT → publishable |
| `/contact` | Page | `seo_entries.description` — contact Rivya Living Art for custom resin furniture, art, preservation and bespoke project enquiries | Yes | Yes | `/studio/content/seo → Pages → /contact` | No · SEO_COPY | — | PATH seeded | DRAFT → publishable |
| `/contact` | Page | `seo_entries.og_media_id` | No | Yes | `/studio/content/seo → Pages → /contact` | No · SEO_COPY | GAP | og:image | not seeded |
| `/contact` | 01 Hero | `eyebrow` — CONTACT | Yes | Yes | `/studio/content/pages → Contact → 01 Hero` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/contact` | 01 Hero | `heading` — Tell us what you would like to create. | Yes | Yes | `/studio/content/pages → Contact → 01 Hero` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/contact` | 01 Hero | `body` — for product questions, custom commissions, large-format furniture or project enquiries | Yes | Yes | `/studio/content/pages → Contact → 01 Hero` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/contact` | 01 Hero | `media_desktop_id` / `media_mobile_id` | No | Yes | `/studio/content/pages → Contact → 01 Hero → Media` | No · UI | GAP | n/a | not seeded |
| `/contact` | 02 Contact details | `contact.phone` — +91 7096036250 | Yes | Yes | `/studio/system/settings → Contact` | OVR | — | n/a | DRAFT · OVR |
| `/contact` | 02 Contact details | `contact.whatsapp` — +91 7096036250 | Yes | Yes | `/studio/system/settings → Contact` | OVR | — | n/a | DRAFT · OVR |
| `/contact` | 02 Contact details | `contact.email` — gondaliyabhavya70960@gmail.com | Yes | Yes | `/studio/system/settings → Contact` | OVR | — | n/a | DRAFT · OVR |
| `/contact` | 02 Contact details | `contact.location_url` — Google Maps destination | No | Yes | `/studio/system/settings → Contact` | OVR | — | n/a | not seeded |
| `/contact` | 02 Contact details | `contact.location_label` — the displayed place name | No | Yes | `/studio/system/settings → Contact` | OVR | — | n/a | not seeded |
| `/contact` | 02 Contact details | `payload.labels` — Phone, WhatsApp, Email, Location field labels | Yes | Yes | `/studio/content/pages → Contact → 02 Contact Details` | No · UI | — | n/a | DRAFT → publishable |

SEED §21 names an *existing supplied Google Maps destination*; it is not in this repository and
`CONTEXT.md` records it as owner-supplied. The seed writes no value. Inventing a plausible address
would fabricate a business fact (D10), and the contact block renders without the map link until the
owner pastes one.

Until `contact.whatsapp` is `VERIFIED`, `lib/whatsapp/link.ts` falls back to
`NEXT_PUBLIC_WHATSAPP_NUMBER` (D8) so the conversion path works on day one. Verifying the row makes
it authoritative — STUDIO_GUIDE §13.8.

---

## 16. Contact form — SEED §22

The contact form is a `customization_forms` row (`slug = 'contact'`, `kind = 'CUSTOM'`,
`is_default = false`), so it reuses the form engine and every field is enable/disable,
require/optional, reorder and rename. Answers land in `inquiries.answers`;
`enquiry_type` lands in `inquiries.enquiry_type`.

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| `/contact` | Contact form | `name` — Name, `CONTACT_NAME`, required | Yes | Yes | `/studio/catalog/customization-forms/contact` | No · UI | — | n/a | DRAFT → publishable |
| `/contact` | Contact form | `phone` — Phone, `CONTACT_PHONE`, required | Yes | Yes | `/studio/catalog/customization-forms/contact` | No · UI | — | n/a | DRAFT → publishable |
| `/contact` | Contact form | `email` — Email, `CONTACT_EMAIL`, optional | Yes | Yes | `/studio/catalog/customization-forms/contact` | No · UI | — | n/a | DRAFT → publishable |
| `/contact` | Contact form | `city` — City, `CITY`, optional | Yes | Yes | `/studio/catalog/customization-forms/contact` | No · UI | — | n/a | DRAFT → publishable |
| `/contact` | Contact form | `enquiry_type` — Enquiry Type, `SELECT`, required | Yes | Yes | `/studio/catalog/customization-forms/contact` | No · UI | — | n/a | DRAFT → publishable |
| `/contact` | Contact form | `message` — Message, `TEXTAREA`, required | Yes | Yes | `/studio/catalog/customization-forms/contact` | No · UI | — | n/a | DRAFT → publishable |
| `/contact` | Contact form | `reference_upload` — Reference Upload, `FILE`, optional | Yes | Yes | `/studio/catalog/customization-forms/contact` | No · UI | — | n/a | DRAFT → publishable |
| `/contact` | Enquiry types | Eight `enquiry_type` options: Large-Format Furniture, Custom Furniture, 3D + Resin, Wall / Statement Art, Preservation, Product Question, General Enquiry, Other | Yes | Yes | `/studio/catalog/customization-forms/contact → enquiry_type → Options` | OVR | — | n/a | DRAFT · OVR |
| `/contact` | Contact form | Form intro heading and body | Yes | Yes | `/studio/catalog/customization-forms/contact → Intro` | No · BRAND_COPY | — | n/a | DRAFT → publishable |
| `/contact` | Contact form | Submit label — resolves `cta.send_an_enquiry` | Yes | Yes | `/studio/content/pages/global → CTA Library` | No · BRAND_COPY | — | n/a | PUBLISHED |
| `/contact` | Contact form | Honeypot field label (screen-reader only) | Yes | Yes | `/studio/catalog/customization-forms/contact` | No · UI | — | n/a | DRAFT → publishable |
| `/contact` | Contact form | Consent line beneath the submit control | Yes | Yes | `/studio/content/pages/global → Form Copy` | No · LEGAL_COPY | — | n/a | DRAFT → publishable |

The eight enquiry types are flagged because the list is an offer: **3D + Resin** and
**Preservation** appear as accepted enquiry categories, and both are capabilities the specification
gates elsewhere. Clearing the 3D + Resin and Preservation verifications (§30) clears this row too.

The consent line and the honeypot label are **not enumerated by SEED**. They are added by Phase 09
because a form that stores a phone number needs a stated purpose, and because the spam control is a
honeypot rather than a third-party captcha (`DATA_MODEL.md` §9). Both are seeded content, editable,
and classified — not JSX strings.

---

## 17. FAQ — SEED §23

Ten `faqs` rows. SEED §23 marks FAQ 01 and FAQ 07; Phase 09's policy extends the flag to **all ten**
because every answer touches process, timelines, delivery or customization capability. This
inventory keeps the stricter reading and records why per row.

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| `/faq` | Page | `pages.title` — FAQ, `seo_entries` derived from the global defaults | Yes | Yes | `/studio/content/pages → FAQ` | No · SEO_COPY | — | PATH derived | DRAFT → publishable |
| `/faq` | Page | `seo_entries.og_media_id` | No | Yes | `/studio/content/seo → Pages → /faq` | No · SEO_COPY | GAP | og:image | not seeded |
| `/faq` | FAQ 01 | Do you make custom-size furniture? — custom sizing can be discussed for eligible projects | Yes | Yes | `/studio/content/faqs → FAQ 01` | OVR | — | ENTITY seeded | DRAFT · OVR |
| `/faq` | FAQ 02 | Can I choose the resin colour? — colour customization may be available depending on the product or commission | Yes | Yes | `/studio/content/faqs → FAQ 02` | OVR | — | ENTITY seeded | DRAFT · OVR |
| `/faq` | FAQ 03 | Can I send reference images? — yes, references can be uploaded with an enquiry | Yes | Yes | `/studio/content/faqs → FAQ 03` | OVR | — | ENTITY seeded | DRAFT · OVR |
| `/faq` | FAQ 04 | How do I place an order? — your enquiry is recorded, then you continue on WhatsApp | Yes | Yes | `/studio/content/faqs → FAQ 04` | OVR | — | ENTITY seeded | DRAFT · OVR |
| `/faq` | FAQ 05 | Can I pay directly on the website? — no; pricing, payment and delivery are finalized through WhatsApp | Yes | Yes | `/studio/content/faqs → FAQ 05` | OVR | — | ENTITY seeded | DRAFT · OVR |
| `/faq` | FAQ 06 | Do I need an account to place an enquiry? — no; there are no customer accounts | Yes | Yes | `/studio/content/faqs → FAQ 06` | OVR | — | ENTITY seeded | DRAFT · OVR |
| `/faq` | FAQ 07 | Do you create one-of-one pieces? — one-of-one and bespoke directions may be available | Yes | Yes | `/studio/content/faqs → FAQ 07` | OVR | — | ENTITY seeded | DRAFT · OVR |
| `/faq` | FAQ 08 | Can you work from my room or interior references? — yes; photographs, measurements and references help | Yes | Yes | `/studio/content/faqs → FAQ 08` | OVR | — | ENTITY seeded | DRAFT · OVR |
| `/faq` | FAQ 09 | Where is pricing shown? — fixed price, starting price or request-for-quote depending on the piece | Yes | Yes | `/studio/content/faqs → FAQ 09` | OVR | — | ENTITY seeded | DRAFT · OVR |
| `/faq` | FAQ 10 | How do custom commissions begin? — share object type, dimensions, use, location and references | Yes | Yes | `/studio/content/faqs → FAQ 10` | OVR | — | ENTITY seeded | DRAFT · OVR |

**FAQ 04, 05 and 06 are the business model in the customer's words.** They state that there is no
online payment, no cart and no account, and that an enquiry is persisted before the WhatsApp
handoff — the customer-facing form of D1 and of the persist-then-redirect invariant. They are
flagged like the rest, but the flag is a *review* requirement, not a doubt: the owner is confirming
the wording, not the rule. `CONTENT_GUIDE.md` §7.4 protects all three sentences from edits that
would contradict D1.

---

## 18. Footer — SEED §24

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| Global | Footer | Brand statement — Collectible furniture, resin art and bespoke objects shaped through material, craft and contemporary form. | Yes | Yes | `/studio/content/pages/global → Brand` | No · BRAND_COPY | — | n/a | PUBLISHED |
| Global | Footer | Column 1 heading — Explore | Yes | Yes | `/studio/content/footer → Explore` | No · UI | — | n/a | PUBLISHED |
| Global | Footer | Column 1 links — Collection, Large Format, Portfolio, Journal | Yes | Yes | `/studio/content/footer → Explore` | No · UI | — | n/a | PUBLISHED |
| Global | Footer | Column 2 heading — Studio | Yes | Yes | `/studio/content/footer → Studio` | No · UI | — | n/a | PUBLISHED |
| Global | Footer | Column 2 links — About, Process, Custom Commissions, Contact | Yes | Yes | `/studio/content/footer → Studio` | No · UI | — | n/a | PUBLISHED |
| Global | Footer | Column 3 heading — Information | Yes | Yes | `/studio/content/footer → Information` | No · UI | — | n/a | PUBLISHED |
| Global | Footer | Column 3 links — FAQ, Privacy, Terms | Yes | Yes | `/studio/content/footer → Information` | No · UI | — | n/a | PUBLISHED |
| Global | Footer | Column 4 heading — Contact | Yes | Yes | `/studio/content/footer → Contact` | No · UI | — | n/a | PUBLISHED |
| Global | Footer | Column 4 values — resolved from `contact.*`, not duplicated | Yes | Yes | `/studio/system/settings → Contact` | OVR | — | n/a | DRAFT · OVR |
| Global | Footer | `social.instagram_url` — empty, disabled | Yes | Yes | `/studio/content/pages/global → Social` | OVR | — | n/a | DRAFT · off |
| Global | Footer | `social.facebook_url` — empty, disabled | Yes | Yes | `/studio/content/pages/global → Social` | OVR | — | n/a | DRAFT · off |
| Global | Footer | `social.pinterest_url` — empty, disabled | Yes | Yes | `/studio/content/pages/global → Social` | OVR | — | n/a | DRAFT · off |
| Global | Footer | `social.youtube_url` — empty, disabled | Yes | Yes | `/studio/content/pages/global → Social` | OVR | — | n/a | DRAFT · off |
| Global | Footer | Copyright line — © `<year>` Rivya Living Art, year computed | Yes | Yes | `/studio/content/pages/global → Brand` | No · LEGAL_COPY | — | n/a | PUBLISHED |

The four social rows exist so the footer has controls to fill, and they are seeded **empty and
disabled**. Seeding a plausible handle would fabricate a business presence; an empty row renders
nothing at all. `is_enabled` flips to `true` the moment the owner pastes a URL.

Footer contact values are references, not copies — `DATA_MODEL.md` gives `global_content` a unique
`(group_key, key)`, and the footer renderer resolves `contact.phone`, `contact.whatsapp` and
`contact.email` at render time. Changing a number in one place changes it everywhere.

---

## 19. Newsletter — SEED §25

SEED §25 makes the newsletter conditional (*do not force newsletter functionality if not part of
implementation scope*). Phase 09 seeds the copy and **builds no capture endpoint**; the block is
disabled and gated behind a feature flag.

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| Global | Newsletter | `newsletter.heading` — Notes from the studio. | Yes | Yes | `/studio/content/pages/global → Newsletter` | No · BRAND_COPY | — | n/a | DRAFT · off |
| Global | Newsletter | `newsletter.body` — new work, material stories and selected journal updates | Yes | Yes | `/studio/content/pages/global → Newsletter` | No · BRAND_COPY | — | n/a | DRAFT · off |
| Global | Newsletter | `newsletter.cta_label` — Subscribe | Yes | Yes | `/studio/content/pages/global → Newsletter` | No · BRAND_COPY | — | n/a | DRAFT · off |

Enabling these three rows without also building a subscription endpoint would produce a control that
silently does nothing — a quality failure under SEED §55. The feature flag `newsletter` in
`/studio/system/flags` is the gate; flipping it with the rows still `DRAFT · off` changes nothing.

---

## 20. Search copy and empty states — SEED §26, §27, §28, §29

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| `/search` | Page | `pages.title` — Search, `is_system = true` | Yes | Yes | `/studio/content/pages → Search` | No · UI | — | PATH derived | DRAFT → publishable |
| `/search` | Page | `seo_entries.robots` — `noindex, follow` | Yes | Yes | `/studio/content/seo → Pages → /search` | No · SEO_COPY | — | PATH derived | DRAFT → publishable |
| `/search` | Page | `seo_entries.og_media_id` | No | Yes | `/studio/content/seo → Pages → /search` | No · SEO_COPY | GAP | og:image | not seeded |
| Global | Search | `form.search_placeholder` — Search furniture, art, materials and stories | Yes | Yes | `/studio/content/pages/global → Form Copy` | No · UI | — | n/a | PUBLISHED |
| Global | Search | `empty.search.heading` — Nothing matched that search. | Yes | Yes | `/studio/content/pages/global → Empty States` | No · UI | — | n/a | PUBLISHED |
| Global | Search | `empty.search.body` — Try another material, product type or collection. | Yes | Yes | `/studio/content/pages/global → Empty States` | No · UI | — | n/a | PUBLISHED |
| Global | Search | `empty.search.cta_label` — Explore the Collection | Yes | Yes | `/studio/content/pages/global → Empty States` | No · UI | — | n/a | PUBLISHED |
| Global | Collection empty state | `empty.collection.heading` — New work is taking shape. | Yes | Yes | `/studio/content/pages/global → Empty States` | No · BRAND_COPY | — | n/a | PUBLISHED |
| Global | Collection empty state | `empty.collection.body` — this collection is being prepared; explore another category or contact Rivya | Yes | Yes | `/studio/content/pages/global → Empty States` | No · BRAND_COPY | — | n/a | PUBLISHED |
| Global | Collection empty state | `empty.collection.cta_label` — Start a Commission | Yes | Yes | `/studio/content/pages/global → Empty States` | No · BRAND_COPY | — | n/a | PUBLISHED |
| Global | Portfolio empty state | `empty.portfolio.heading` — The project archive is being prepared. | Yes | Yes | `/studio/content/pages/global → Empty States` | No · BRAND_COPY | — | n/a | PUBLISHED |
| Global | Portfolio empty state | `empty.portfolio.body` — verified Rivya projects will appear here as the portfolio develops | Yes | Yes | `/studio/content/pages/global → Empty States` | No · BRAND_COPY | — | n/a | PUBLISHED |
| Global | Portfolio empty state | `empty.portfolio.cta_label` — Explore the Collection | Yes | Yes | `/studio/content/pages/global → Empty States` | No · BRAND_COPY | — | n/a | PUBLISHED |
| Global | Journal empty state | `empty.journal.heading` — More from the studio soon. | Yes | Yes | `/studio/content/pages/global → Empty States` | No · BRAND_COPY | — | n/a | PUBLISHED |
| Global | Journal empty state | `empty.journal.body` — new material stories, project notes and guides are being prepared | Yes | Yes | `/studio/content/pages/global → Empty States` | No · BRAND_COPY | — | n/a | PUBLISHED |

**These are the only strings on the site that seed `PUBLISHED` and describe absence.** They are
deliberate: SEED §28 says an empty portfolio state is *better than generating fake client projects*,
and SEED §55 forbids "Coming Soon" on primary pages. *The project archive is being prepared* is
specific, finite and true; *Coming Soon* is none of those.

The word **verified** in `empty.portfolio.body` is load-bearing. It tells the visitor that what will
eventually appear is real work, and it tells the editor that `enforce_evidence_gate()` is not
optional.

---

## 21. Commerce and action labels — SEED §30, §31

`global_content`, groups `COMMERCE_LABEL` (ten) and `ACTION_LABEL` (seven). Studio:
`/studio/content/pages/global → Commerce Labels` and `→ Action Labels`.

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| Global | Commerce labels | `commerce.price` — Price | Yes | Yes | `/studio/content/pages/global → Commerce Labels` | No · UI | — | n/a | PUBLISHED |
| Global | Commerce labels | `commerce.from` — From | Yes | Yes | `/studio/content/pages/global → Commerce Labels` | No · UI | — | n/a | PUBLISHED |
| Global | Commerce labels | `commerce.starting_from` — Starting from | Yes | Yes | `/studio/content/pages/global → Commerce Labels` | No · UI | — | n/a | PUBLISHED |
| Global | Commerce labels | `commerce.request_a_quote` — Request a Quote | Yes | Yes | `/studio/content/pages/global → Commerce Labels` | No · UI | — | n/a | PUBLISHED |
| Global | Commerce labels | `commerce.price_on_request` — Price on Request | Yes | Yes | `/studio/content/pages/global → Commerce Labels` | No · UI | — | n/a | PUBLISHED |
| Global | Commerce labels | `commerce.made_to_order` — Made to Order | Yes | Yes | `/studio/content/pages/global → Commerce Labels` | No · UI | — | n/a | PUBLISHED |
| Global | Commerce labels | `commerce.one_of_one` — One of One | Yes | Yes | `/studio/content/pages/global → Commerce Labels` | No · UI | — | n/a | PUBLISHED |
| Global | Commerce labels | `commerce.limited_edition` — Limited Edition | Yes | Yes | `/studio/content/pages/global → Commerce Labels` | No · UI | — | n/a | PUBLISHED |
| Global | Commerce labels | `commerce.ready_stock` — Ready Stock | Yes | Yes | `/studio/content/pages/global → Commerce Labels` | OVR | — | n/a | DRAFT · OVR |
| Global | Commerce labels | `commerce.customizable` — Customizable | Yes | Yes | `/studio/content/pages/global → Commerce Labels` | No · UI | — | n/a | PUBLISHED |
| Global | Action labels | `action.customize_this_piece` — Customize This Piece | Yes | Yes | `/studio/content/pages/global → Action Labels` | No · UI | — | n/a | PUBLISHED |
| Global | Action labels | `action.place_order` — Place Order, seeded disabled | Yes | Yes | `/studio/content/pages/global → Action Labels` | No · UI | — | n/a | PUBLISHED · off |
| Global | Action labels | `action.discuss_on_whatsapp` — Discuss on WhatsApp | Yes | Yes | `/studio/content/pages/global → Action Labels` | No · UI | — | n/a | PUBLISHED |
| Global | Action labels | `action.request_a_quote` — Request a Quote | Yes | Yes | `/studio/content/pages/global → Action Labels` | No · UI | — | n/a | PUBLISHED |
| Global | Action labels | `action.ask_about_this_piece` — Ask About This Piece | Yes | Yes | `/studio/content/pages/global → Action Labels` | No · UI | — | n/a | PUBLISHED |
| Global | Action labels | `action.view_details` — View Details | Yes | Yes | `/studio/content/pages/global → Action Labels` | No · UI | — | n/a | PUBLISHED |
| Global | Action labels | `action.explore_similar_work` — Explore Similar Work | Yes | Yes | `/studio/content/pages/global → Action Labels` | No · UI | — | n/a | PUBLISHED |

Two rows need their reasons stated, because a future editor will otherwise "fix" them:

- **`commerce.ready_stock` is flagged.** *Ready Stock* asserts that a physical object exists and can
  ship. `products` has zero rows, so nothing can legitimately carry it; the label exists so the
  owner has it when real inventory does.
- **`action.place_order` is seeded disabled.** SEED §31 lists the label; D1 forbids checkout. The
  row exists, `is_enabled = false`, and its `description` field carries the helper text: *This label
  resolves to the enquiry and WhatsApp flow. There is no cart and no payment step.* Enabling it does
  not create one — `buildHandoffUrl` requires a persisted `inquiryId` and there is no other path.

Prices themselves are never seeded. `price_state` is a product column with three enum values plus
`FIXED`; a product with no owner-entered price renders `commerce.price_on_request`.

---

## 22. Customization form templates — SEED §33, §34, §35

Three `customization_forms` rows plus the contact form (§16) and the commission form (§11). Every
field is enable/disable, require/optional, reorder and rename, exactly as SEED §33 requires. **No
price, cost, multiplier or surcharge column exists anywhere in this group** — a unit test greps the
migration and fails on a price-shaped identifier.

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| `/product/[slug]` | Furniture template | Form row `slug = 'furniture'`, `kind = 'FURNITURE'`, `is_default = true` | Yes | Yes | `/studio/catalog/customization-forms/furniture` | No · UI | — | n/a | DRAFT → publishable |
| `/product/[slug]` | Furniture template | `desired_size` — Desired Size, `SELECT` | Yes | Yes | `/studio/catalog/customization-forms/furniture` | No · UI | — | n/a | DRAFT → publishable |
| `/product/[slug]` | Furniture template | `length` — Length, `DIMENSION` | Yes | Yes | `/studio/catalog/customization-forms/furniture` | No · UI | — | n/a | DRAFT → publishable |
| `/product/[slug]` | Furniture template | `width` — Width, `DIMENSION` | Yes | Yes | `/studio/catalog/customization-forms/furniture` | No · UI | — | n/a | DRAFT → publishable |
| `/product/[slug]` | Furniture template | `height` — Height, `DIMENSION` | Yes | Yes | `/studio/catalog/customization-forms/furniture` | No · UI | — | n/a | DRAFT → publishable |
| `/product/[slug]` | Furniture template | `resin_colour_direction` — Resin Colour Direction, `COLOUR_DIRECTION` | Yes | Yes | `/studio/catalog/customization-forms/furniture` | No · UI | — | n/a | DRAFT → publishable |
| `/product/[slug]` | Furniture template | `transparency_preference` — Transparency Preference, `SELECT` | Yes | Yes | `/studio/catalog/customization-forms/furniture` | No · UI | — | n/a | DRAFT → publishable |
| `/product/[slug]` | Furniture template | `wood_preference` — Wood Preference, `TEXT` | Yes | Yes | `/studio/catalog/customization-forms/furniture` | No · UI | — | n/a | DRAFT → publishable |
| `/product/[slug]` | Furniture template | `base_leg_preference` — Base / Leg Preference, `TEXT` | Yes | Yes | `/studio/catalog/customization-forms/furniture` | No · UI | — | n/a | DRAFT → publishable |
| `/product/[slug]` | Furniture template | `finish_preference` — Finish Preference, `SELECT` | Yes | Yes | `/studio/catalog/customization-forms/furniture` | No · UI | — | n/a | DRAFT → publishable |
| `/product/[slug]` | Furniture template | `reference_images` — Reference Images, `FILE` | Yes | Yes | `/studio/catalog/customization-forms/furniture` | No · UI | — | n/a | DRAFT → publishable |
| `/product/[slug]` | Furniture template | `delivery_city` — Delivery City, `CITY` | Yes | Yes | `/studio/catalog/customization-forms/furniture` | No · UI | — | n/a | DRAFT → publishable |
| `/product/[slug]` | Furniture template | `project_notes` — Project Notes, `TEXTAREA` | Yes | Yes | `/studio/catalog/customization-forms/furniture` | No · UI | — | n/a | DRAFT → publishable |
| `/product/[slug]` | Preservation template | Form row `slug = 'preservation'`, `kind = 'PRESERVATION'` | Yes | Yes | `/studio/catalog/customization-forms/preservation` | OVR | — | n/a | DRAFT · OVR |
| `/product/[slug]` | Preservation template | `preservation_type` — Preservation Type, `SELECT` | Yes | Yes | `/studio/catalog/customization-forms/preservation` | OVR | — | n/a | DRAFT · OVR |
| `/product/[slug]` | Preservation template | `occasion` — Occasion, `TEXT` | Yes | Yes | `/studio/catalog/customization-forms/preservation` | No · UI | — | n/a | DRAFT · OVR |
| `/product/[slug]` | Preservation template | `item_flower_type` — Item / Flower Type, `TEXT` | Yes | Yes | `/studio/catalog/customization-forms/preservation` | OVR | — | n/a | DRAFT · OVR |
| `/product/[slug]` | Preservation template | `preferred_shape` — Preferred Shape, `SELECT` | Yes | Yes | `/studio/catalog/customization-forms/preservation` | No · UI | — | n/a | DRAFT · OVR |
| `/product/[slug]` | Preservation template | `preferred_size` — Preferred Size, `SELECT` | Yes | Yes | `/studio/catalog/customization-forms/preservation` | No · UI | — | n/a | DRAFT · OVR |
| `/product/[slug]` | Preservation template | `personalization` — Personalization, `TEXT` | Yes | Yes | `/studio/catalog/customization-forms/preservation` | No · UI | — | n/a | DRAFT · OVR |
| `/product/[slug]` | Preservation template | `reference_image` — Reference Image, `FILE` | Yes | Yes | `/studio/catalog/customization-forms/preservation` | No · UI | — | n/a | DRAFT · OVR |
| `/product/[slug]` | Preservation template | `notes` — Notes, `TEXTAREA` | Yes | Yes | `/studio/catalog/customization-forms/preservation` | No · UI | — | n/a | DRAFT · OVR |
| `/product/[slug]` | 3D + Resin template | Form row `slug = '3d-resin'`, `kind = 'THREE_D_RESIN'` | Yes | Yes | `/studio/catalog/customization-forms/3d-resin` | OVR | — | n/a | DRAFT · OVR |
| `/product/[slug]` | 3D + Resin template | `object_type` — Object Type, `SELECT` | Yes | Yes | `/studio/catalog/customization-forms/3d-resin` | OVR | — | n/a | DRAFT · OVR |
| `/product/[slug]` | 3D + Resin template | `approximate_dimensions` — Approximate Dimensions, `DIMENSION` | Yes | Yes | `/studio/catalog/customization-forms/3d-resin` | No · UI | — | n/a | DRAFT · OVR |
| `/product/[slug]` | 3D + Resin template | `intended_use` — Intended Use, `TEXT` | Yes | Yes | `/studio/catalog/customization-forms/3d-resin` | No · UI | — | n/a | DRAFT · OVR |
| `/product/[slug]` | 3D + Resin template | `preferred_form_direction` — Preferred Form Direction, `TEXT` | Yes | Yes | `/studio/catalog/customization-forms/3d-resin` | No · UI | — | n/a | DRAFT · OVR |
| `/product/[slug]` | 3D + Resin template | `resin_colour` — Resin Colour, `COLOUR_DIRECTION` | Yes | Yes | `/studio/catalog/customization-forms/3d-resin` | No · UI | — | n/a | DRAFT · OVR |
| `/product/[slug]` | 3D + Resin template | `3d_structure_direction` — 3D Structure Direction, `TEXT` | Yes | Yes | `/studio/catalog/customization-forms/3d-resin` | OVR | — | n/a | DRAFT · OVR |
| `/product/[slug]` | 3D + Resin template | `reference_images` — Reference Images, `FILE` | Yes | Yes | `/studio/catalog/customization-forms/3d-resin` | No · UI | — | n/a | DRAFT · OVR |
| `/product/[slug]` | 3D + Resin template | `notes` — Notes, `TEXTAREA` | Yes | Yes | `/studio/catalog/customization-forms/3d-resin` | No · UI | — | n/a | DRAFT · OVR |
| `/custom-commissions` | Commission form | Nine `project_type` options: Dining / Statement Table, Coffee / Centre Table, Console, Desk, Custom Furniture, Wall / Statement Art, Preservation Piece, 3D + Resin Concept, Other | Yes | Yes | `/studio/catalog/customization-forms/commission → project_type` | OVR | — | n/a | DRAFT · OVR |
| `/custom-commissions` | Commission form | Nine brief fields: what would you like to create, approximate dimensions, location / city, reference images, preferred colours, material preferences, intended use, timeline, additional notes | Yes | Yes | `/studio/catalog/customization-forms/commission` | OVR | — | n/a | DRAFT · OVR |

SEED §35 marks the **3D + Resin template** for verification outright. SEED §34 says *do not promise
preservation compatibility before review*, which is why the preservation form is flagged too: the
form asks *Item / Flower Type* and *Preservation Type*, and offering those choices implies the
studio can preserve them. Three field-level flags name the specific claims —
`preservation_type`, `item_flower_type`, `3d_structure_direction` — through
`field_classifications`, so the verification banner is precise rather than blanket.

The **timeline** field on the commission form asks for the customer's preferred timeline. It never
displays a Rivya lead time; no lead time is seeded anywhere on the site (D10).

---

## 23. WhatsApp templates — SEED §36, §37

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| Global | WhatsApp | `whatsapp.product_inquiry` — the §36 template with tokens `{{product_or_project}}`, `{{customer_name}}`, `{{phone}}`, `{{city}}`, `{{customization_summary}}`, `{{notes}}`, `{{reference_urls}}`, `{{inquiry_id}}` | Yes | Yes | `/studio/system/settings → WhatsApp` | No · UI | — | n/a | PUBLISHED |
| Global | WhatsApp | `whatsapp.commission_inquiry` — the §37 template with tokens `{{project_type}}`, `{{dimensions}}`, `{{city}}`, `{{material_direction}}`, `{{notes}}`, `{{reference_urls}}`, `{{inquiry_id}}` | Yes | Yes | `/studio/system/settings → WhatsApp` | No · UI | — | n/a | PUBLISHED |
| Global | WhatsApp | `whatsapp.include_reference_urls` — render reference images as a count (default) or as full URLs | Yes | Yes | `/studio/system/settings → WhatsApp` | No · UI | — | n/a | PUBLISHED |

Both templates are seeded with the **exact token names** from the specification; the renderer treats
an unknown token as a validation error rather than substituting an empty string, so a typo in Studio
fails loudly instead of sending a message with a hole in it.

SEED §36 requires graceful shortening. `lib/whatsapp/template.ts` drops sections in a fixed order —
reference URLs, notes, customization detail, city — recording which rung it used in
`inquiries.whatsapp_shortened_at_level`. **No internal or private field is ever interpolated**: the
renderer reads from an explicit allowlist, not from the inquiry row.

`{{inquiry_id}}` renders `inquiries.reference_code`, never the UUID.

---

## 24. Studio copy — SEED §38, §39, §40

`global_content` group `STUDIO_HELP`. All eighteen seed `PUBLISHED` because the Studio must be
usable before any content is approved. Phase 05's `components/studio/strings.ts` constants are
**deleted** in Phase 09 and replaced by lookups.

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| Studio | Login | `studio_help.login_heading` — Rivya Studio | Yes | Yes | `/studio/content/pages/global → Studio Help` | No · UI | — | n/a | PUBLISHED |
| Studio | Login | `studio_help.login_body` — Manage the collection, website, media, enquiries and research workspace. | Yes | Yes | `/studio/content/pages/global → Studio Help` | No · UI | — | n/a | PUBLISHED |
| Studio | Login | `studio_help.login_button` — Sign In | Yes | Yes | `/studio/content/pages/global → Studio Help` | No · UI | — | n/a | PUBLISHED |
| Studio | Dashboard | `studio_help.dashboard_heading` — Studio Overview | Yes | Yes | `/studio/content/pages/global → Studio Help` | No · UI | — | n/a | PUBLISHED |
| Studio | Dashboard | `studio_help.dashboard_intro` — manage Rivya's website, products, media, enquiries, merchandising and competitive research from one workspace | Yes | Yes | `/studio/content/pages/global → Studio Help` | No · UI | — | n/a | PUBLISHED |
| Studio | Quick actions | `studio_help.quick_action.add_product` — Add Product | Yes | Yes | `/studio/content/pages/global → Studio Help` | No · UI | — | n/a | PUBLISHED |
| Studio | Quick actions | `studio_help.quick_action.edit_homepage` — Edit Homepage | Yes | Yes | `/studio/content/pages/global → Studio Help` | No · UI | — | n/a | PUBLISHED |
| Studio | Quick actions | `studio_help.quick_action.upload_media` — Upload Media | Yes | Yes | `/studio/content/pages/global → Studio Help` | No · UI | — | n/a | PUBLISHED |
| Studio | Quick actions | `studio_help.quick_action.add_portfolio_project` — Add Portfolio Project | Yes | Yes | `/studio/content/pages/global → Studio Help` | No · UI | — | n/a | PUBLISHED |
| Studio | Quick actions | `studio_help.quick_action.create_journal_post` — Create Journal Post | Yes | Yes | `/studio/content/pages/global → Studio Help` | No · UI | — | n/a | PUBLISHED |
| Studio | Quick actions | `studio_help.quick_action.view_enquiries` — View Enquiries | Yes | Yes | `/studio/content/pages/global → Studio Help` | No · UI | — | n/a | PUBLISHED |
| Studio | Quick actions | `studio_help.quick_action.run_product_research` — Run Product Research | Yes | Yes | `/studio/content/pages/global → Studio Help` | No · UI | — | n/a | PUBLISHED |
| Studio | Quick actions | `studio_help.quick_action.review_scraped_products` — Review Scraped Products | Yes | Yes | `/studio/content/pages/global → Studio Help` | No · UI | — | n/a | PUBLISHED |
| Studio | Editor help | `studio_help.homepage_hero` — Keep the primary story focused on large-format furniture, collectible design or 3D + resin work. | Yes | Yes | `/studio/content/pages/global → Studio Help` | No · UI | — | n/a | PUBLISHED |
| Studio | Editor help | `studio_help.homepage_selected_works` — Choose only the pieces you want to feature publicly. Drag to reorder. | Yes | Yes | `/studio/content/pages/global → Studio Help` | No · UI | — | n/a | PUBLISHED |
| Studio | Editor help | `studio_help.about` — Keep factual manufacturing claims accurate and owner-verified. | Yes | Yes | `/studio/content/pages/global → Studio Help` | No · UI | — | n/a | PUBLISHED |
| Studio | Editor help | `studio_help.higgsfield_asset` — AI-generated concept media must not be presented as completed real Rivya work. | Yes | Yes | `/studio/content/pages/global → Studio Help` | No · UI | — | n/a | PUBLISHED |
| Studio | Editor help | `studio_help.research_product` — Research reference only. Never publish competitor imagery or text as Rivya content. | Yes | Yes | `/studio/content/pages/global → Studio Help` | No · UI | — | n/a | PUBLISHED |

SEED §38 forbids a public signup CTA on the login screen. The three login rows are the entire login
copy; there is no third string for an editor to turn into one.

`studio_help.homepage_hero` is the SEED §56 priority rule stated where the drift would happen. It is
seeded content precisely so it can be strengthened without a deploy.

---

## 25. SEO defaults, keyword themes and social sharing — SEED §41, §42, §44

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| Global | SEO defaults | `seo.site_name` — Rivya Living Art | Yes | Yes | `/studio/content/seo → Global` | No · SEO_COPY | — | GLOBAL default | PUBLISHED |
| Global | SEO defaults | `seo.title_template` — `%s \| Rivya Living Art` | Yes | Yes | `/studio/content/seo → Global` | No · SEO_COPY | — | GLOBAL default | PUBLISHED |
| Global | SEO defaults | `seo.default_description` — Rivya Living Art creates resin furniture, collectible objects, statement art and bespoke pieces shaped through material craft and contemporary form. | Yes | Yes | `/studio/content/seo → Global` | No · SEO_COPY | — | GLOBAL default | PUBLISHED |
| Global | SEO defaults | `seo.social_title` — Rivya Living Art — Functional Art & Collectible Furniture | Yes | Yes | `/studio/content/seo → Global` | No · SEO_COPY | — | GLOBAL default | PUBLISHED |
| Global | SEO defaults | `seo.social_description` — Explore resin furniture, sculptural objects, large-format art and bespoke commissions. | Yes | Yes | `/studio/content/seo → Global` | No · SEO_COPY | — | GLOBAL default | PUBLISHED |
| Global | SEO defaults | `seo_entries` GLOBAL row — `og_media_id` for the site-wide share card | No | Yes | `/studio/content/seo → Global` | No · SEO_COPY | GAP | og:image | not seeded |
| Global | Social sharing | `social.og_headline` — Rivya Living Art | Yes | Yes | `/studio/content/pages/global → Social` | No · SEO_COPY | — | n/a | PUBLISHED |
| Global | Social sharing | `social.og_supporting` — Collectible furniture, resin art and bespoke material objects. | Yes | Yes | `/studio/content/pages/global → Social` | No · SEO_COPY | — | n/a | PUBLISHED |
| Global | Keyword themes | Seventeen `seo_keyword_themes` rows from SEED §42, all `research_status = 'UNRESEARCHED'` | Yes | Yes | `/studio/content/seo → Keywords` | No · SEO_COPY | — | n/a | PUBLISHED |
| Global | Keyword themes | Per-theme `notes` field for research findings | No | Yes | `/studio/content/seo → Keywords` | No · SEO_COPY | — | n/a | not seeded |
| `/privacy` | Page | `seo_entries.robots` — `noindex, follow` until the page has content | Yes | Yes | `/studio/content/seo → Pages → /privacy` | No · SEO_COPY | — | PATH derived | DRAFT → publishable |
| `/terms` | Page | `seo_entries.robots` — `noindex, follow` until the page has content | Yes | Yes | `/studio/content/seo → Pages → /terms` | No · SEO_COPY | — | PATH derived | DRAFT → publishable |

**SEED §41 and §44 supply two different social pairs.** §41 gives a social title and description;
§44 gives an OpenGraph headline and supporting line. Neither is dropped: §41's pair populates
`seo_entries.social_title` / `social_description` and therefore `og:title` and `og:description`;
§44's pair populates `social.og_headline` / `social.og_supporting`, the text drawn onto the
generated share card. The overlap is raised in §31 as open question 3.

**No keyword theme carries a metric.** `seo_keyword_themes` has no volume, difficulty or ranking
column by design (`DATA_MODEL.md` §9), so there is nowhere to record a number nobody measured. SEED
§42 says actual strategy must be refined through research; `research_status` is the only progress
signal, and it starts at `UNRESEARCHED` for all seventeen.

---

## 26. Error, offline and inquiry surfaces — SEED §45, §46, §47, §48, §49

`global_content` groups `ERROR_COPY` and `FORM_COPY`. These seed `PUBLISHED` because an error page
that cannot render its own copy is worse than the error.

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| 404 | Not found | `error.404.eyebrow` — 404 | Yes | Yes | `/studio/content/pages/global → Error Copy` | No · UI | — | n/a | PUBLISHED |
| 404 | Not found | `error.404.heading` — This object isn't here. | Yes | Yes | `/studio/content/pages/global → Error Copy` | No · BRAND_COPY | — | n/a | PUBLISHED |
| 404 | Not found | `error.404.body` — The page may have moved, but there is more to explore. | Yes | Yes | `/studio/content/pages/global → Error Copy` | No · BRAND_COPY | — | n/a | PUBLISHED |
| 404 | Not found | `error.404.cta_primary_label` / `_url` — View the Collection → `/collection` | Yes | Yes | `/studio/content/pages/global → Error Copy` | No · UI | — | n/a | PUBLISHED |
| 404 | Not found | `error.404.cta_secondary_label` / `_url` — Return Home → `/` | Yes | Yes | `/studio/content/pages/global → Error Copy` | No · UI | — | n/a | PUBLISHED |
| 500 | Error | `error.500.heading` — Something interrupted the flow. | Yes | Yes | `/studio/content/pages/global → Error Copy` | No · BRAND_COPY | — | n/a | PUBLISHED |
| 500 | Error | `error.500.body` — The page could not be loaded correctly. Try again or return to the collection. | Yes | Yes | `/studio/content/pages/global → Error Copy` | No · BRAND_COPY | — | n/a | PUBLISHED |
| 500 | Error | `error.500.cta_primary_label` — Try Again | Yes | Yes | `/studio/content/pages/global → Error Copy` | No · UI | — | n/a | PUBLISHED |
| 500 | Error | `error.500.cta_secondary_label` / `_url` — Return Home → `/` | Yes | Yes | `/studio/content/pages/global → Error Copy` | No · UI | — | n/a | PUBLISHED |
| All | Offline media | `error.media_unavailable.label` — Image temporarily unavailable | Yes | Yes | `/studio/content/pages/global → Error Copy` | No · UI | — | n/a | PUBLISHED |
| All | Inquiry success | `form.inquiry_success.heading` — Your enquiry has been saved. | Yes | Yes | `/studio/content/pages/global → Form Copy` | No · UI | — | n/a | PUBLISHED |
| All | Inquiry success | `form.inquiry_success.body` — Continue on WhatsApp to discuss the project with Rivya. | Yes | Yes | `/studio/content/pages/global → Form Copy` | No · UI | — | n/a | PUBLISHED |
| All | Inquiry success | `form.inquiry_success.cta_label` — Continue to WhatsApp | Yes | Yes | `/studio/content/pages/global → Form Copy` | No · UI | — | n/a | PUBLISHED |
| All | Form errors | `form.error_generic` — Please check the highlighted fields and try again. | Yes | Yes | `/studio/content/pages/global → Form Copy` | No · UI | — | n/a | PUBLISHED |
| All | Form errors | `form.error_upload` — This file could not be uploaded. Try another file or continue without it. | Yes | Yes | `/studio/content/pages/global → Form Copy` | No · UI | — | n/a | PUBLISHED |
| All | Form errors | `form.error_inquiry_save` — Your enquiry could not be saved. Please try again before continuing to WhatsApp. | Yes | Yes | `/studio/content/pages/global → Form Copy` | No · UI | — | n/a | PUBLISHED |
| All | Form chrome | `form.required_marker` and `form.optional_marker` | Yes | Yes | `/studio/content/pages/global → Form Copy` | No · UI | — | n/a | PUBLISHED |

**`form.error_inquiry_save` is the visible half of an architectural invariant.** SEED §49 and
`ARCHITECTURE.md` §4.3 both state it: never redirect if persistence failed. `buildHandoffUrl` takes
a required non-optional `inquiryId`, so the bypass does not type-check; this string is what the
visitor sees when the guard fires.

**`error.media_unavailable.label` must not collapse the layout** (SEED §47). `MediaSlot` reserves
the declared aspect box and renders a neutral material-toned surface with this label — the product
grid keeps its rhythm even when Cloudinary is unreachable.

Every `RivyaError` subclass carries a `publicCopyKey` naming one of these rows
(`ARCHITECTURE.md` §7), so no visitor-facing error sentence lives in a catch block.

---

## 27. Legal pages — `/privacy` and `/terms`

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| `/privacy` | Page | `pages.title` — Privacy, `kind = 'PAGE'`, `is_system = true` | Yes | Yes | `/studio/content/pages → Privacy` | No · LEGAL_COPY | — | PATH derived | DRAFT → publishable |
| `/privacy` | 01 Body | Policy text | No | Yes | `/studio/content/pages → Privacy → 01 Body` | OVR | — | PATH derived | not seeded |
| `/privacy` | 01 Body | Data-handling statement covering the inquiry form, `ip_hash`, attachment retention and the 30-day orphan purge | No | Yes | `/studio/content/pages → Privacy → 01 Body` | OVR | — | PATH derived | not seeded |
| `/terms` | Page | `pages.title` — Terms, `kind = 'PAGE'`, `is_system = true` | Yes | Yes | `/studio/content/pages → Terms` | No · LEGAL_COPY | — | PATH derived | DRAFT → publishable |
| `/terms` | 01 Body | Terms text | No | Yes | `/studio/content/pages → Terms → 01 Body` | OVR | — | PATH derived | not seeded |
| `/terms` | 01 Body | Statement that no sale concludes on the website and that price, payment and delivery are agreed directly | No | Yes | `/studio/content/pages → Terms → 01 Body` | OVR | — | PATH derived | not seeded |

**Both pages ship without body copy, on purpose.** A privacy policy and a set of terms are legal
instruments describing what a specific business actually does with personal data and how it
contracts. Drafting them from a template would fabricate business practice — D10's exact
prohibition — and would be the most consequential fabrication on the site.

The seed creates the page shells, the footer links, the `noindex` SEO rows and the two
`page_sections` with empty bodies, so the owner or their adviser pastes text into an existing
control. Until then both paths resolve to `notFound()` and the footer link renders disabled. The two
statements listed above are the **required content**, not seeded copy: the privacy page must cover
what the inquiry form stores, and the terms must state the no-online-sale position (D1) so the FAQ
and the terms cannot drift apart. This is the largest launch blocker in §1.4.

---

## 28. Interface chrome not enumerated by SEED

Recorded so the gap is visible rather than discovered. These strings are visitor-facing but SEED
never lists them, and `global_content.group_key`'s check constraint has no group that accepts them
(`DATA_MODEL.md` §2.1).

| Page | Section | Field | Seeded? | Editable? | Studio location | Fact verification needed? | Media asset ID | SEO status | Publication status |
|---|---|---|---|---|---|---|---|---|---|
| All | Chrome | Skip-to-content link label | No | No | none — `components/primitives/SkipLink.tsx` | No · UI | — | n/a | not seeded |
| All | Chrome | Breadcrumb root label | No | No | none — `components/patterns/Breadcrumbs.tsx` | No · UI | — | n/a | not seeded |
| All | Chrome | Pagination previous, next and position labels | No | No | none — `components/patterns/Pagination.tsx` | No · UI | — | n/a | not seeded |
| `/collection` | Chrome | Filter and sort control labels | No | No | none — `components/patterns/FilterBar.tsx` | No · UI | — | n/a | not seeded |
| All | Chrome | Lightbox controls — close, next, previous, zoom | No | No | none — `components/patterns/Lightbox.tsx` | No · UI | — | n/a | not seeded |
| `/product/[slug]` | Chrome | 3D viewer controls — reset camera, full screen, lighting preset | No | No | none — `components/three/ViewerControls.tsx` | No · UI | — | n/a | not seeded |
| `/journal` | Chrome | Reading-time suffix | No | No | none — `components/patterns/ArticleCard.tsx` | No · UI | — | n/a | not seeded |
| Global | Chrome | Analytics disclosure line in the footer | No | No | none — `components/sections/Footer.tsx` | No · LEGAL_COPY | — | n/a | not seeded |
| Global | Chrome | Mobile menu open and close labels | No | No | none — `components/patterns/MobileNav.tsx` | No · UI | — | n/a | not seeded |
| All | Config | `NEXT_PUBLIC_WHATSAPP_NUMBER` fallback | No | No | deployment environment (D8) | No · UI | — | n/a | not seeded |
| All | Config | `NEXT_PUBLIC_SITE_URL` for canonical and OG URLs | No | No | deployment environment (D8) | No · UI | — | n/a | not seeded |
| All | Config | Inquiry reference format `RIV-<yyyy>-<sequence>` | No | No | `supabase/migrations/0180…` | No · UI | — | n/a | not seeded |

Nine of these close with one migration: add `UI_CHROME` to the `global_content.group_key` check
constraint and seed them from `content/seed/global.ts` alongside the other reusable strings. That
takes Studio-mapped coverage from 97.4% to 99.2%. See §31, open question 1. The three configuration
rows stay where they are by design, and `reading_minutes` (§14.3) stays derived.

---

## 29. Media gap register — the Phase 43 brief list

The twenty `GAP` cells above, expanded into the twenty-one briefs Phase 43 needs — a hero row covers
a desktop and a mobile slot, and D6 makes them separate assets rather than two crops of one. Each
row names the ratios the slot needs and the existing assets to evaluate **before generating
anything**: nothing in the manifest may be regenerated, and reuse outranks generation.

| # | Slot | Needs | Reuse candidates already in the manifest | If no reuse: Phase 43 brief |
|---|---|---|---|---|
| 1 | `/` 01 Hero desktop | 21:9 or 16:9 video + poster | `LARGEFORMAT-DINING-005 (video, 16:9)` + `LARGEFORMAT-DINING-002 (image, 21:9)` | Flagship large-format dining table, slow push-in, house palette, no people |
| 2 | `/` 01 Hero mobile | 9:16 video + poster | `LARGEFORMAT-DINING-004 (video, 9:16)` + `LARGEFORMAT-DINING-001 (image, 9:16)` | Vertical crop of the same piece, not a re-crop of the desktop frame (D6: separate slots) |
| 3 | `/` `og:image` | 1200×630 share card | any 16:9 large-format still | Generated share card over `LARGEFORMAT-DINING-003` |
| 4 | `/` 06 Material Palette card 3 — Fabricated Form | 1:1 macro | none — no digital-fabrication macro exists | Extreme macro, digitally fabricated lattice meeting cast resin, same matte charcoal ground and single upper-left key as `MATERIAL-MACRO-016…022` so the four tile as one set |
| 5 | `/large-format` 03 Conference & Commercial Tables | 16:9 + 4:5 | none — all `largeformat-*` interiors are domestic | Long communal resin-and-timber surface in a neutral commercial interior. **Do not substitute a dining table**: presenting domestic work as commercial capability is the D10 failure |
| 6 | `/large-format` 03 Architectural & Statement Pieces mobile | 4:5 or 3:4 | none — `LARGEFORMAT-MONUMENTAL-001` is 21:9 only | Vertical companion to `LARGEFORMAT-MONUMENTAL-001`, same piece and light |
| 7 | `/collection` 01 Hero desktop + mobile | 21:9 + 4:5 | `GALLERY-SCENE-002 (image, 21:9)` reads as portfolio, not catalogue | Grouped range shot spanning furniture, wall art and smaller objects at one scale |
| 8 | `/collection` `og:image` | 1200×630 | as 7 | — |
| 9 | `/collection/furniture` hero | 16:9 or 21:9 | `LARGEFORMAT-DINING-003 (image, 16:9)`, `LARGEFORMAT-SEATING-004 (image, 4:5)` | Only if the owner rejects reuse |
| 10 | `/collection/collectible-design` hero | 16:9 or 21:9 | none — no collectible-design family exists | Single sculptural functional object on a plinth, gallery light, house palette |
| 11 | `/custom-commissions` 01 Hero desktop + mobile | 16:9 + 4:5 | `EDITORIAL-005 (image, 3:2)` — sketches, wood samples, consultation table | Brief-in-progress: drawings, a material board and a partly built piece |
| 12 | `/custom-commissions` 02 Who it is for | 3:2 + 4:5 | `PROCESS-STUDIO-011 (image, 3:2)` | — |
| 13 | `/custom-commissions` 04 What to share | 3:2 + 3:4 | `PROCESS-STUDIO-015 (image, 3:4)` | — |
| 14 | `/custom-commissions` 05 How it works | 16:9 + 4:5 | `PROCESS-STUDIO-002 (image, 16:9)` | — |
| 15 | `/custom-commissions` 06 CTA | 21:9 + 4:5 | `MATERIAL-MACRO-027 (image, 21:9)` | — |
| 16 | `/custom-commissions` `og:image` | 1200×630 | as 11 | — |
| 17 | `/contact` 01 Hero desktop + mobile | 16:9 + 4:5 | `PROCESS-STUDIO-005 (image, 16:9)` | Studio entrance or bench, no people, warm side light |
| 18 | `/contact` `og:image` | 1200×630 | as 17 | — |
| 19 | `/faq` `og:image` | 1200×630 | any material macro | — |
| 20 | `/search` `og:image` | 1200×630 | `noindex` page; lowest priority | — |
| 21 | `seo_entries` GLOBAL `og:image` | 1200×630 site-wide default | `MATERIAL-MACRO-011 (image, 21:9)` | Brand share card with `social.og_headline` and `social.og_supporting` drawn over it |

**Fourteen of the twenty-one have a named reuse candidate.** Working through the reuse column first is
not an optimisation — it is D6's asset priority ladder, and it is the difference between closing the
media gap in an afternoon and commissioning a generation run.

Gaps 4, 5, 6 and 10 have no candidate and are genuine generation work. Gap 5 is the one where
substitution would be actively harmful rather than merely imperfect.

---

## 30. Verification register and the launch publication pass

### 30.1 Ten owner decisions clear all 108 flags

Every `OVR` row in this inventory belongs to exactly one decision. An owner or admin sets
`owner_verification = 'VERIFIED'` on the rows a decision covers; the
`enforce_owner_verification_gate` trigger then allows `PUBLISHED`. Nothing is counted twice — where
a row is implicated by two decisions (contact enquiry types, V3 and V6) it sits under V3.

| # | Decision the owner is making | Rows | Where they are | Consequence of "no" |
|---|---|---|---|---|
| V1 | The phone, WhatsApp number, email, map destination and social channels are correct and public | 10 | §15 (5), §18 footer contact (1) and social (4) | Contact block renders without details; WhatsApp falls back to `NEXT_PUBLIC_WHATSAPP_NUMBER`; the footer shows no social row |
| V2 | Digital design and 3D fabrication are current production methods, not aspirations | 16 | §6 home 03 card 3, home 06 card 3, home 08 (5); §7 About 02 (2); §10 `3d-resin` (3); §14 journal 04 (1); §22 3D + Resin template (3) | Drop `3d-resin` from the menu, unpublish home 08, retitle journal 04. The site still coheres — it becomes a resin-and-timber studio |
| V3 | Bespoke commissioning is offered as described: dimensions, materials, colour, form, finish, reference-based consultation | 21 | §6 home 07 (3); §7 About 04 (2); §8 Large Format 04 (2); §10 `gifts` (1); §11 (10); §16 enquiry types (1); §22 commission form (2) | The commission funnel cannot publish. This is the primary conversion path — **V3 is the highest-value decision on the list** |
| V4 | The production process is what actually happens, step by step | 27 | §12 (21); §6 home 10 (6) | `/process` publishes as hero only; home 10 stays hidden |
| V5 | The large-format range includes conference and commercial tables, sculptural seating and architectural pieces | 9 | §6 home 03 card 5 (1); §7 About 03 (2); §8 (6) | Delete the unconfirmed entries from the section payload; the other three categories publish |
| V6 | Preservation work is offered, and "lasting" is defensible without a duration claim | 6 | §10 `preservation` (2); §14 journal 08 (1); §22 preservation template (3) | Remove the preservation category and form template; drop Preservation from the enquiry types |
| V7 | Limited, one-of-one and ready-stock states are real when a product uses them | 2 | §10 `collectible-design` (1); §21 `commerce.ready_stock` (1) | Remove the word *limited* from the collectible-design description; leave `Ready Stock` disabled |
| V8 | The brand introduction and the manifesto describe real combined capability | 3 | §2 `brand.introduction` (1); §6 home 02 (2) | Publish the four short descriptors only; home 02 stays hidden |
| V9 | The ten FAQ answers describe how Rivya actually works | 10 | §17 | `/faq` would publish empty, which SEED §55 forbids — **V9 is a launch blocker for that route** |
| V10 | The privacy policy and terms text is supplied and approved | 4 | §27 | `/privacy` and `/terms` stay at `notFound()` and their footer links stay disabled |

Total: **108**. V3, V4 and V9 together account for 58 of them, so three conversations unblock more
than half the site.

### 30.2 The launch publication pass

The seed writes `DRAFT`. Nothing on the public site renders until an owner publishes, because a path
with no `PUBLISHED` page row resolves to `notFound()` — there is no half-built shell and no
"Coming Soon" (SEED §55, `DATA_MODEL.md` §5). The deployment therefore ends with a deliberate pass,
not a silent auto-publish:

1. **Review** every `DRAFT → publishable` row in `/studio/content/pages` and
   `/studio/content/homepage`. 180 rows; a further 126 already seed `PUBLISHED` because the Studio,
   the error pages and the empty states must work before anything is approved.
2. **Bulk publish** through `/studio/catalog/bulk` with the content scope. Destructive and
   publication actions require explicit confirmation (FEAT §20); the confirmation names the count
   and the routes affected.
3. **Verify** the ten decisions in §30.1 in whatever order suits the business. V3, V4 and V9 are the
   three that materially change what the site can say.
4. **Publish** the rows each verification unblocks.
5. **Close the two legal pages** (§27) — until then the footer links render disabled.
6. **Re-run** `npm run content:inventory`. Every published row's Publication status changes to
   `PUBLISHED`, and the diff is the record of what went live.

The seed never performs steps 2, 4 or 5. It also never demotes a published row back to `DRAFT` on a
re-run — rule 6 of the idempotency contract.

---

## 31. Open questions for the canonical decisions

Raised, not acted on. Nothing above diverges from `CANONICAL-DECISIONS.md`.

1. **`global_content.group_key` has no home for interface chrome.** `DATA_MODEL.md` §2.1 fixes the
   vocabulary at fourteen values, none of which accepts a pagination label or a skip link. Those
   strings are visitor-facing, so SEED §1 arguably covers them, but they are not marketing copy.
   Suggested amendment: add `UI_CHROME` to the check constraint. Impact: Studio-mapped coverage
   97.4% → 99.2%.
2. **`customization_forms` holds two forms that customise nothing.** The contact form (§16) and the
   commission form (§11) reuse the form engine because it already provides enable, require, reorder
   and rename per field — exactly what SEED §22 and §15 need. The table name is now narrower than
   its contents. Suggested amendment: either rename the group to `forms` in a later migration, or
   record in D5 that `customization_forms` is the general form engine.
3. **SEED §41 and §44 supply two different social pairs.** This inventory seeds both, into
   `seo_entries.social_*` and `global_content.SOCIAL` respectively (§25). Confirm that both are
   wanted, or drop one.
4. **The manifest declares 26 videos and no poster for any of them.** An asset row carries
   `type`, `aspect_ratio` and dimensions but no poster reference, while `media_usages.role` has a
   `POSTER` value and D6's naming standard pairs `home-hero-main-video.mp4` with
   `home-hero-main-poster.webp`. Ten of this inventory's bindings are videos, so ten poster
   decisions are outstanding: extract a frame during the Phase 06 migration, or bind an existing
   still from the same family. Suggested amendment: state in D6 that every video asset carries a
   poster of the same ratio, and record how it is produced. Until then those ten slots render a
   `MediaSlot` reserved box on first paint.
5. **The Phase 09 gap list may be over-conservative.** `PHASE-05-09.md` records the homepage hero,
   `/collection`, `/collection/furniture`, `/collection/collectible-design`, `/custom-commissions`,
   `/contact`, `/faq` and `/search` as unbound by design. Twelve of those slots have a named reuse
   candidate in §29, and D6 ranks existing assets above new generation. Confirm whether the gaps are
   a creative decision (a purpose-shot hero is wanted) or an artefact of family-to-page mapping — the
   answer changes how much Phase 43 has to generate.
6. **Category copy has one control, by construction.** §10 resolves the category hero block from
   `categories.subtitle` and `categories.description` rather than duplicating the §14 copy into
   `page_sections`. This keeps a single editable control but means a category page's hero cannot be
   restructured per category without a block change. Confirm the trade is wanted.
7. **All ten FAQs are flagged, where SEED §23 marks two.** Phase 09's policy already extends the
   flag to all ten; this inventory keeps that. It means `/faq` cannot publish at all until V9. If a
   partially populated FAQ page is acceptable, flag only FAQ 01 and 07 and let the other eight
   publish.

---

## 32. Regenerating this document

```bash
npm run seed:content -- --dry-run     # decisions only, writes nothing
npm run seed:content                  # insert / update / skip per the idempotency contract
npm run content:inventory             # rebuilds this file from the database
git diff --exit-code docs/content/INITIAL_CONTENT_INVENTORY.md
```

The generator reads `pages`, `page_sections`, `navigation_items`, `global_content`, `seo_entries`,
`faqs`, `categories`, `journal_categories`, `journal_articles`, `customization_forms`,
`customization_form_fields` and `media_assets`, joins `media_usages` for the Media column, and
resolves Studio locations from `lib/cms/studio-locations.ts` — the same map the Studio navigation
uses, so a moved route cannot leave a stale path in this table.

A row appearing here with `Editable? No` fails `tests/e2e/seed-editability.spec.ts` unless it is
listed in that test's documented exemption set — currently thirteen entries: the twelve rows of §28
plus `journal_articles.reading_minutes` (§14.3). Adding a fourteenth requires editing the test and
saying why, which is the point.
