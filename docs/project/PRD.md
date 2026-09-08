---
doc: PRD
status: CURRENT
owning_phase: 01
last_reviewed: 2026-09-07
owner_verification: NOT_REQUIRED
---

# PRD — Rivya Living Art

> Binding parent: `docs/architecture/CANONICAL-DECISIONS.md`. Where this document and the canonical
> decisions differ, the canonical decisions win and this document is wrong.
> Companion documents: `docs/project/BUSINESS_RULES.md` (what the business forbids),
> `docs/project/ROADMAP.md` (build order), `docs/architecture/ARCHITECTURE.md` (how it is put
> together), `docs/architecture/DATA_MODEL.md` (what the data means),
> `docs/studio/STUDIO_GUIDE.md` (how the Studio is operated).
> Source specifications: `docs/requirements/01-ADVANCED-FEATURE-EXPANSION.md` (*FEAT §n*) and
> `docs/requirements/02-INITIAL-CONTENT-SEED-SYSTEM.md` (*SEED §n*).

**Implementation status.** No application code exists yet (`PROJECT_STATE.md`). This document states
what is being built and how its completion is judged; it does not claim any of it is built.

---

## 0. How to read this document

| If you are | Read |
|---|---|
| Deciding whether a feature belongs in scope | §2, §3, §8 |
| Building a public surface | §2, §5, §6, §7 |
| Building a Studio surface | §4, §5.2, §7 |
| Judging whether a phase is finished | §9, §10 |
| Looking for what only the owner can answer | §11 |

Three business rules constrain everything below and are stated once, here:
**no online checkout, no payment gateway, no customer accounts.** Every conversion path ends the
same way — a persisted `inquiries` row, then a WhatsApp handoff.

---

## 1. Problem statement

Rivya Living Art makes large-format functional art — resin and timber tables, sculptural furniture,
wall and statement pieces — plus smaller preservation, décor and gift objects. Objects of this kind
are bought after they are *understood*: scale, material behaviour, surface, how the piece will sit
in a room. A conventional product grid cannot carry that understanding, and a conventional
storefront cannot transact it, because price, feasibility, dimensions and delivery are negotiated
per piece rather than listed.

The system therefore has to solve two problems that are usually solved by two different products:

| # | Problem | Consequence for the build |
|---|---|---|
| P1 | A visitor cannot understand a large resin object from a thumbnail and a spec list | The public site is a showroom, not a catalogue: cinematic media, macro material detail, scale cues, 3D inspection where it helps, editorial storytelling |
| P2 | The commercial conversation cannot happen on the website | Conversion is a *structured enquiry* that captures enough detail for the WhatsApp conversation to start well — never a cart |
| P3 | Content, catalogue, media and merchandising change constantly and must not require an engineer | Everything a visitor reads is a database row edited in `/studio`; no marketing copy in JSX (SEED §1, D2) |
| P4 | Product and market direction is decided from evidence the studio does not currently hold in one place | An internal research subsystem gathers competitor product data for analysis only — never for publication or import (FEAT §23–§28) |
| P5 | Media is expensive and easy to duplicate | 250 Higgsfield assets already exist and are catalogued; the asset-priority ladder (D6) makes reuse the default and regeneration a defect |

Nothing in this section asserts a fact about Rivya's current sales channels, volumes, clients or
capabilities. Statements of that kind are **OWNER_VERIFICATION_REQUIRED** and are listed in §11.

---

## 2. Positioning

**Rivya Living Art presents as a collectible-design studio, large-format first.**

The design question (FEAT §5) is never "how many components can we add?" but *"how extraordinary can
we make the experience of discovering and understanding a Rivya object?"* The creative spine
(FEAT §4) is `WOOD → RESIN → LIGHT → FORM → SPACE → ART`.

### 2.1 Content priority — never drift from this order

The seven seeded categories, in the D3 / SEED §56 priority order that governs navigation, the store
landing, merchandising defaults and every editorial decision:

| # | Category | Slug | Role in positioning |
|---|---|---|---|
| 1 | Furniture | `furniture` | Large-format functional art — the primary story |
| 2 | Collectible Design | `collectible-design` | Sculptural and experimental functional pieces |
| 3 | 3D + Resin | `3d-resin` | Digital fabrication × resin. **OWNER_VERIFICATION_REQUIRED** as a current capability (SEED §14) |
| 4 | Wall & Statement Art | `wall-statement-art` | Large-format compositions and spatial work |
| 5 | Preservation | `preservation` | Keepsake and varmala work, intimate in scale |
| 6 | Décor | `decor` | Smaller functional and decorative objects |
| 7 | Gifts | `gifts` | Personalised, occasion-led objects |

Home, About, Large Format and the collection landing must never slide back into small gift-store
positioning (SEED §56). This is a reviewable property: §10 makes it an acceptance criterion.

### 2.2 What this product is, and is not

| It is | It is not |
|---|---|
| A digital flagship showroom | An e-commerce storefront |
| A structured enquiry funnel ending on WhatsApp | A checkout |
| An internal operating system for content, catalogue, media, merchandising, enquiries and research | A generic CMS admin panel |
| A reuse-first creative pipeline over 250 existing assets | A media generator |
| A research workspace whose output is *evidence* | A source of published product data |

---

## 3. The 27-part ecosystem (FEAT §2)

Rivya is not only a website. Each capability below has one owning phase, one primary surface and one
owning document; nothing on this list is optional, and nothing not on this list is in scope without
an amendment.

| # | Capability | Owning phase(s) | Primary surface | Owning doc |
|---|---|---|---|---|
| 01 | Luxury public website | 10–18 | `app/(site)/**` | `ARCHITECTURE.md` |
| 02 | Luxury resin furniture catalogue | 14, 15 | `/collection/furniture`, `/product/[slug]` | `DATA_MODEL.md` |
| 03 | Large-format resin-art catalogue | 13 | `/large-format` | `DATA_MODEL.md` |
| 04 | Collectible-design catalogue | 14 | `/collection/collectible-design` | `DATA_MODEL.md` |
| 05 | 3D + Resin experience | 13, 14 | `/collection/3d-resin`, home section 08 | `CONTENT_GUIDE.md` |
| 06 | 3D product viewer | 21 | `components/three/**`, `/product/[slug]` | `COMPONENT_REGISTRY.md` |
| 07 | Bespoke / custom commission | 19 | `/custom-commissions` | `STUDIO_GUIDE.md` |
| 08 | Product customization system | 19 | `customization_forms`, PDP configurator | `DATA_MODEL.md` |
| 09 | Editorial Journal | 18 | `/journal`, `/journal/[slug]`, `/journal/category/[slug]` | `CONTENT_GUIDE.md` |
| 10 | Portfolio / project platform | 17 | `/portfolio`, `/portfolio/[slug]` | `CONTENT_GUIDE.md` |
| 11 | Product Scraper | 25–29 | `lib/scraper/**`, `/studio/research/**` | `SCRAPER.md` |
| 12 | Competitor / comparator management | 26 | `/studio/research/sources` | `SCRAPER.md` |
| 13 | Product opportunity intelligence | 32, 34 | `/studio/research/opportunities` | `SCRAPER.md` |
| 14 | Media Library | 06 | `/studio/media/**` | `MEDIA_GUIDE.md` |
| 15 | Higgsfield AI asset workflow | 07, 43 | `/studio/media/higgsfield` | `HIGGSFIELD_GUIDE.md` |
| 16 | Content CMS | 08, 09 | `/studio/content/**` | `CONTENT_GUIDE.md` |
| 17 | Unified Studio | 05 | `/studio` | `STUDIO_GUIDE.md` |
| 18 | Product merchandising | 22 | `/studio/merchandising/**` | `STUDIO_GUIDE.md` |
| 19 | Google Sheets integration | 36 | `/studio/research/sheets` | `SCRAPER.md` |
| 20 | Inquiry / WhatsApp management | 20 | `/studio/inquiries/**` | `BUSINESS_RULES.md` |
| 21 | Analytics | 31, 37, 40 | `/studio`, `/studio/research/*` | `STUDIO_GUIDE.md` |
| 22 | SEO management | 39 | `/studio/content/seo` | `CONTENT_GUIDE.md` |
| 23 | Environment / health monitoring | 38, 44 | `/studio/system/environment` | `docs/ops/ENVIRONMENT.md` |
| 24 | Documentation browser | 38 | `/studio/system/documentation` | `docs/ops/SECURITY.md` |
| 25 | System logs | 38 | `/studio/operations/logs` | `ARCHITECTURE.md` §8 |
| 26 | Audit history | 04, 38 | `/studio/operations/audit` | `docs/ops/SECURITY.md` |
| 27 | Session-recovery documentation | 01 | `docs/SESSION-STATE.md` | `CLAUDE.md` |

Goal, stated once: **a luxury digital flagship showroom plus an internal content, product, research
and operations system.**

---

## 4. Personas

Five personas drive the design. Four are staff, holding exactly one of the six D5 roles; the fifth
is the public visitor, who has no account and never will (D1).

### 4.1 Owner — *runs the business, does not write code*

| | |
|---|---|
| Role | `owner` (the only holder of `system.owner.transfer`) |
| Enters through | `/studio` overview |
| Needs | Change any public sentence, publish or unpublish anything, see enquiries the moment they arrive, confirm or reject unverified capability claims, control who has access |
| Succeeds when | Every normal website change is possible without a deploy, and no unverified claim can reach the public site without their explicit confirmation |
| Fails if | Any routine change requires an engineer, or the site publishes a capability they have not confirmed |
| Key surfaces | `/studio/content/**`, `/studio/inquiries/**`, `/studio/system/{users,settings,environment}` |

### 4.2 Editor — *owns the words*

| | |
|---|---|
| Role | `editor` (`content.read/write/publish`, `media.read/write`, `inquiries.read`, `analytics.read`) |
| Needs | Edit page sections, navigation, footer, FAQs, journal and portfolio entries; reorder and hide sections; schedule; preview before publishing; see what is blocked from publication and why |
| Succeeds when | Publishing is a two-click action with a visible pre-flight (readiness checklist, owner-verification state, missing media) |
| Fails if | Copy has to be edited in a component, or a draft can be published while an unverified claim is inside it |
| Key surfaces | `/studio/content/{pages,homepage,portfolio,journal,testimonials,faqs,navigation,footer,seo}` |

### 4.3 Merchandiser — *decides what is shown, and in what order*

| | |
|---|---|
| Role | `merchandiser` (`catalog.*`, `merchandising.write`, `inquiries.read/write/export`, `research.read`, `research.confirm`, `bulk.execute`) |
| Needs | Enter and publish products, curate homepage Selected Works and the store order, schedule feature windows, work enquiries, review research shortlists and confirm what becomes a real product |
| Succeeds when | A merchandising change is a drag-and-drop that invalidates exactly the affected caches, and an empty slot renders an editorial fallback rather than a fake product card |
| Fails if | A curated slot can render an unpublished entity, or a research row can become a product without an explicit confirmation step |
| Key surfaces | `/studio/catalog/**`, `/studio/merchandising/**`, `/studio/research/{shortlist,confirmed}` |

### 4.4 Researcher — *gathers evidence, publishes nothing*

| | |
|---|---|
| Role | `researcher` — `research.read`, `research.write`, plus read on catalogue, content, media and analytics. **No** `research.confirm`, and **no** access to enquiries at all |
| Needs | Configure sources, run and monitor scrapes, triage validation issues, review changes, compare assortments, score opportunities |
| Succeeds when | A new normal source can be added without touching the scraper engine (FEAT §26), and a broken adapter fails alone |
| Fails if | Any research row reaches a public surface, a public search index, or the `products` table by any path other than an explicit human confirmation |
| Key surfaces | `/studio/research/**` |

### 4.5 Public visitor — *no account, ever*

| | |
|---|---|
| Role | `anon`. May read `status = 'PUBLISHED'` rows and may `insert` exactly one thing: an inquiry |
| Needs | Understand a piece — scale, material, form, finish — then start a conversation with a structured brief |
| Succeeds when | They complete discover → understand → enquire → WhatsApp without creating an account, without a payment step and without losing what they typed |
| Fails if | They are asked to register, are shown a price that does not exist, or are handed to WhatsApp with nothing persisted |

Two further roles exist and are deliberately thin: `admin` (everything `owner` has except
`system.owner.transfer`) and `viewer` (read-only across catalogue, content, media, enquiries,
research and analytics — the role given to a collaborator who must see but not touch).

---

## 5. The journeys that matter

### 5.1 Public — discover → understand → enquire → WhatsApp

This is the only conversion path in the product. It has one hard invariant: **persist, then
redirect. Never the reverse** (SEED §49).

| Step | Surface | What must be true |
|---|---|---|
| 1. Arrive | `/`, or an SEO entry point | Hero renders from `page_sections`, not JSX; one `priority` image; LCP element is an image, never a video or canvas |
| 2. Orient | Mega menu, `/collection`, `/large-format` | The seven categories appear in the §2.1 priority order; large-format is reachable in one click from anywhere |
| 3. Understand | `/product/[slug]`, `/collections/[slug]` | Gallery, macro detail, scale cue, material story, related collection/project/journal; 3D viewer only behind an explicit intent gate |
| 4. Decide to ask | `Enquire`, `Customize This Piece`, `Request a Quote`, `Place Order` | All four labels resolve to the same flow. `Place Order` is a label, not a transaction (SEED §31) |
| 5. Configure | Customization form rendered from `customization_form_fields` | Every field is data: enable, disable, require, reorder, rename — no field is hard-coded, no field computes a price |
| 6. Submit | `submitInquiry` server action | Zod parse → honeypot → 3-second floor → rate limit → one transaction inserting `inquiries` + `inquiry_attachments` + `inquiry_events` |
| 7a. Saved | Success state (SEED §48) | `reference_code` shown; the success state is announced in a polite live region and **receives focus**; `Continue to WhatsApp` is offered as a real link and **requires activation**. No timed navigation — see the note below |
| 7b. Not saved | Save-error copy (SEED §49) | Visitor stays on the page; **no WhatsApp URL exists** — `buildHandoffUrl` requires a non-optional `inquiryId`, so the bypass does not type-check |
| 8. Handoff | `wa.me` | Message rendered from the `WHATSAPP_TEMPLATE` `global_content` row through a token allowlist; over-long messages walk a five-rung shorten ladder; internal fields cannot enter the message |

**Step 7a carried a one-second automatic redirect, and it has been removed.** Earlier drafts of this
table, `ARCHITECTURE.md` §4 and `PHASE-16-22.md` all specified "auto-forward after 1 s, cancellable".
That is a WCAG 2.2 **2.2.1 Timing Adjustable failure at Level A** — an unrequested navigation on a
timer under 20 hours, with no way to turn it off, extend it, or be warned in time to act. It also
contradicted this project's own accessibility contract, which requires the success state to be
announced in a live region *and* to receive focus: one second is not long enough for that announcement
to be heard, let alone for a cancel control to be found by a screen-reader or switch user, and a
keyboard user landing on the success heading would be navigated away mid-read. The three cheap
alternatives were considered and rejected: a longer timer still fails 2.2.1 without an adjust
mechanism; a user-adjustable delay is a preference control nobody asked for on a page shown once; a
"cancel" button that must be found within a second is the failure, not the fix.

The rule is therefore: **the handoff requires a deliberate activation.** SEED §48 specifies a heading,
a body line and a `Continue to WhatsApp` CTA — a call to action, not a countdown — so this costs the
specification nothing. Nothing about the conversion invariant changes: the row is still persisted
before any `wa.me` URL exists (BR-B1), and 7b is untouched.

`ACCESSIBILITY.md` §1.1 states the criterion and names the spec that asserts it.
**`ARCHITECTURE.md` §4.1 (the sequence diagram's "auto-forward after 1s" step) and `PHASE-16-22.md`
(its conversion-flow diagram and the `InquirySuccess` deliverable) still carry the old behaviour and
must be corrected to match this table** — they are not owned by this document, and the divergence is
recorded here rather than left for an implementer to resolve by picking one at random.

Secondary public journeys, each ending at the same funnel: `/custom-commissions` (the bespoke
configurator, FEAT §15), `/contact` (the general enquiry form, SEED §22), and any product-adjacent
`Ask About This Piece` action.

### 5.2 Owner — manage everything without code

| Step | Surface | What must be true |
|---|---|---|
| 1. Sign in | `/studio/login` | Invitation-only. No public sign-up path exists anywhere in the application |
| 2. See the day | `/studio` | Cards are role-filtered; a card whose backing data does not exist renders an explicit unavailable state, never a fabricated zero |
| 3. Change a sentence | `/studio/content/pages` → section drawer | Every field a visitor reads is editable here: eyebrow, heading, highlight, body, supporting, CTAs, desktop media, mobile media, alt override, visibility, order, theme, layout variant, schedule |
| 4. Preview | Draft mode | Renders the draft with caches bypassed; the public route is untouched until publish |
| 5. Publish | Publish action | Blocked while `owner_verification = 'OWNER_VERIFICATION_REQUIRED'` — enforced by a database trigger, not by UI politeness |
| 6. Watch it land | Cache invalidation | Narrowest tags only (`page:<path>`, `chrome` when chrome changed); a failed invalidation is a `WARNING` in `system_logs`, not a silent stale page |
| 7. Answer an enquiry | `/studio/inquiries/all` | Full brief, attachments, reference code, WhatsApp state; status transitions append to `inquiry_events` |

The measurable form of this journey: **no routine content, catalogue, media, merchandising, SEO or
navigation change requires a code change or a deploy.** §10 turns that into an acceptance test.

### 5.3 Merchandiser — curate without touching entities

Curate `merchandising_slots` / `merchandising_entries` → pin, order, schedule → an empty or
under-filled slot resolves through `fallback_mode` (`EDITORIAL_BLOCK · HIDE_SECTION ·
SHOW_EMPTY_STATE`), never through invented product cards (SEED §10 §27).

### 5.4 Researcher — evidence in, nothing out

`RAW → NORMALIZED → VALIDATED → MATCHED → REVIEW → SHORTLISTED → CONFIRMED` (FEAT §23). Only the
final human confirmation may cause a Rivya product to exist, and even then the new product is typed
by a person: `research_confirmations.created_product_id` is deliberately an opaque uuid with no
foreign key, so the graph cannot be walked from a public table into research data.

---

## 6. The conversion model

| Element | Decision |
|---|---|
| Terminal state | A row in `inquiries` with `pipeline_status = 'NEW'` and a `reference_code` of the form `RIV-<yyyy>-<6 digits>` |
| Handoff | A `wa.me` link built from the persisted inquiry, offered after the save succeeds and **activated by the visitor** — never on a timer (§5.1, `ACCESSIBILITY.md` §1.1) |
| Inquiry kinds | `PRODUCT · COMMISSION · CONSULTATION · QUOTE · GENERAL` |
| Price display states | `FIXED · STARTING_FROM · REQUEST_QUOTE · PRICE_ON_REQUEST` — rules in `BUSINESS_RULES.md` §C |
| Bespoke pricing | Never calculated. No price, cost, multiplier or surcharge column may exist on a customization field (FEAT §15) |
| Visitor identity | None. No account, no cart, no wishlist, no per-visitor persistence beyond the inquiry |
| Spam control | Honeypot field, 3-second minimum time-to-submit, per-IP cap; salted `ip_hash`, never a raw IP; no third-party captcha |

---

## 7. Scope by surface

**Public routes — exactly D3, no more.**

```
/                     /about                /process
/large-format         /collection           /collection/[category]
/product/[slug]       /collections/[slug]   /custom-commissions
/portfolio            /portfolio/[slug]     /journal
/journal/[slug]       /journal/category/[slug]
/contact              /faq                  /search
/privacy              /terms                404 · error
```

**Studio routes — exactly D4, no more.** Navigation is role-aware and **every page re-checks
permission server-side**; `proxy.ts` redirects but never authorises.

```
/studio                       overview · analytics · activity
/studio/catalog/{products,categories,collections,materials,relationships,customization-forms,bulk}
/studio/merchandising/{homepage,store,featured,scheduling}
/studio/content/{pages,homepage,portfolio,journal,testimonials,faqs,navigation,footer,seo}
/studio/media/{all,images,videos,models,documents,higgsfield,brand}
/studio/inquiries/{all,product,commission,consultation,quote}
/studio/research/{dashboard,sources,scrape,jobs,runs,changes,explorer,large-format,compare,
                  similarity,opportunities,shortlist,confirmed,sheets}
/studio/operations/{workflows,data-quality,imports,exports,audit,logs}
/studio/system/{users,settings,integrations,environment,documentation,flags}
```

Adding a route to either map requires an amendment to `CANONICAL-DECISIONS.md`, not a pull request.

---

## 8. Non-goals

### 8.1 Permanently out of scope under current business rules (FEAT §39, D1)

| Non-goal | What must not exist |
|---|---|
| Online checkout | `carts`, `cart_items`, `checkout_sessions`, `orders`, `order_items`; any cart state in a cookie or `localStorage`; any "buy" affordance |
| Payment gateway | `payments`, `transactions`, `refunds`; any provider SDK, webhook route or provider key in D8 |
| Customer accounts | `customers`, `customer_profiles`, `addresses`, `wishlists`, `saved_items`, `saved_carts`; any public sign-up path; any `anon` `select` policy on `inquiries` |

`Permissions-Policy: payment=()` is shipped deliberately and permanently — there is no payment
surface to permit.

### 8.2 Architected for, deliberately not built now

Shipping, reviews and ratings, wishlists, AR and room visualisation, CRM and quotation automation,
localisation. Each has a named seam in `ARCHITECTURE.md` §11 and a standing prohibition: **do not
create unused production tables for a future feature.** Extensibility comes from clean architecture,
not dead features. An empty table is not preparation; it is an unvalidated schema plus an
unmaintained RLS surface.

### 8.3 Out of scope for other reasons

| Non-goal | Reason |
|---|---|
| Third-party analytics, tag managers, chat widgets, cookie-banner vendors, A/B tools, pixels | No third-party origin is contacted by any public route (Phase 40); this is a privacy, CSP and performance position at once |
| APM / RUM SaaS | Errors go to `system_logs`; field vitals are first-party and identifier-free |
| Public accessibility, compliance or certification statements | Claims about an organisation; only the owner can make them (§11) |
| Load and stress testing | No traffic model exists; a synthetic number would be theatre |
| Regenerating any of the 250 manifest assets | D6 — regeneration of a catalogued asset is a defect |
| Publishing, re-hosting or importing any competitor content | `BUSINESS_RULES.md` §F |
| Newsletter delivery infrastructure | SEED §25 makes it conditional; nothing is implemented unless the owner asks |

---

## 9. Success criteria (FEAT §51)

Transcribed from the specification and made checkable. "Evidence" names the artefact a reviewer
opens; none of these may be marked met by assertion.

### 9.1 Public website

| # | Criterion | Evidence |
|---|---|---|
| S1 | World-class luxury design consistent with a collectible-design studio | Phase 45 creative audit answers all eight FEAT §49 questions with named evidence |
| S2 | Large-format furniture and large resin art are the dominant story | `/`, `/large-format` and the store order follow §2.1; visual matrix Tier A snapshots at all eight widths |
| S3 | Cinematic storytelling and material understanding | Home sections 02, 05, 06 render from CMS; macro material families from the manifest are bound |
| S4 | Premium catalogue and high-end product detail pages | `/collection/**` and `/product/[slug]` meet their route budgets and a11y specs |
| S5 | Collections read as exhibitions, not filtered grids | `/collections/[slug]` supports statement, signature media, material story, video, project reference, journal links, commission CTA (FEAT §8) |
| S6 | Custom / bespoke flow | `/custom-commissions` configurator renders from `customization_forms`; every step editable from Studio |
| S7 | Portfolio and Journal | Both routes ship; Portfolio shows the SEED §28 empty state rather than invented projects until verified ones exist |
| S8 | 3D improves understanding rather than existing as a gimmick | Viewer behind an intent gate and a flag; zero 3D bytes in any first load, proved by module-graph guard |
| S9 | Search | Public search covers products, categories, collections, portfolio, journal — and nothing from `research_*` |
| S10 | Responsive design | Visual QA matrix green at 1920 · 1440 · 1280 · 1024 · 768 · 430 · 390 · 360 |
| S11 | SEO | Phase 39 exit criteria; sitemap, metadata, JSON-LD guarded against unverified claims |
| S12 | Performance | Every public route within its `perf/budgets.json` budget in Lighthouse CI |
| S13 | Accessibility | WCAG 2.2 AA target met per `docs/ops/ACCESSIBILITY.md`; zero critical and zero serious axe violations |

### 9.2 Studio

| # | Criterion | Evidence |
|---|---|---|
| S14 | Every D4 route exists, is role-aware and re-checks permission server-side | `tests/e2e/studio-authz.spec.ts`: each role's forbidden POSTs return 403 and write `audit_logs` rows with `result = 'DENIED'` |
| S15 | Catalogue: products, categories, collections, materials, relationships, bulk | Phases 14–16, 23, 24 exit criteria |
| S16 | CMS: pages, homepage editor, portfolio, journal, FAQs, navigation, footer, SEO | Phase 08–09; 100 % of launch copy mapped to a Studio control in `INITIAL_CONTENT_INVENTORY.md` |
| S17 | Merchandising: homepage, store, featured, scheduling | Phase 22; empty slots resolve through `fallback_mode` |
| S18 | Media: all, images, videos, 3D models, documents, Higgsfield, brand | Phase 06–07; every asset row carries `alt_text`, `is_ai_generated`, `is_concept` |
| S19 | Research: sources, scrape, jobs, runs, changes, explorer, large-format, compare, similarity, opportunities, shortlist, confirmed, Sheets | Phases 25–36 |
| S20 | Inquiries with the four D4 views plus `GENERAL` | Phase 20 |
| S21 | Analytics that state their coverage and never manufacture data | Phases 31, 37; unavailable metrics render an explicit unavailable state |
| S22 | Environment, documentation, logs, users, audit history | Phase 04, 38, 44 |

### 9.3 Infrastructure

Next.js (App Router) · Supabase PostgreSQL · Supabase Auth (staff only) · Cloudinary behind
`MediaProvider` · Vercel · GitHub. Evidence: `ENVIRONMENT.md` variable table fully populated,
`DEPLOYMENT.md` drills executed and timed, `/studio/system/environment` reporting reachability for
each integration.

### 9.4 Creative pipeline

| # | Criterion | Evidence |
|---|---|---|
| S23 | Real-media-first workflow | The D6 asset-priority ladder is implemented in the media picker and documented in `MEDIA_GUIDE.md` |
| S24 | Existing Higgsfield reuse | All 250 manifest assets imported with `source = 'HIGGSFIELD'`, `is_concept = true`; `unique (higgsfield_generation_id)` makes regeneration detectable |
| S25 | Missing-asset detection | `media_usages` makes "Missing Media" computed, not guessed |
| S26 | Cloudinary mapping and CMS placement | Every bound asset has `cloudinary_folder` per the manifest and a `media_usages` row |
| S27 | Asset-ID integrity | `scripts/media/check-asset-ids.py` green in CI (D6 amendment A1) |

### 9.5 Engineering

TypeScript strict · modular architecture per D2 · numbered forward-only migrations · RLS on every
table · RBAC with two enforcement nets · the test suite in `docs/ops/TESTING.md` · session-recovery
documentation · performance, accessibility and maintainability as enforced budgets rather than
aspirations.

---

## 10. Definition of done

The product is done when all four gates below hold simultaneously. Each is measurable; none may be
satisfied by assertion.

### 10.1 Gate 1 — every phase satisfies D9

A phase is COMPLETE only when all ten hold: scope implemented · relevant tests run · no known
scope-breaking error · documentation updated · `CHANGELOG` updated · `PROJECT_STATE` updated ·
`SESSION-STATE` updated · remaining issues documented · next phase identified · repository remains
recoverable. `docs/ops/TESTING.md` §9 states which suites must be green per phase type.

### 10.2 Gate 2 — the business rules hold under test

| # | Must be true | Proved by |
|---|---|---|
| D1 | No checkout, payment or customer-account table, route, column or dependency exists | `tests/unit/no-pricing.test.ts`, schema review, dependency audit |
| D2 | A failed inquiry save never produces a WhatsApp URL | `tests/e2e/inquiry-conversion.spec.ts` (both directions) |
| D3 | No unverified capability claim can be published | `products_verified_before_publish`-style constraints and the publish trigger; `tests/integration/publish-gates.test.ts` |
| D4 | No `research_*` row is publicly readable, searchable or importable | `check-research-isolation.mjs`, `check-data-layer.mjs`, RLS tests |
| D5 | No server-only secret reaches a client bundle, a log, an error or a Studio screen | Four independent guards, each with a seeded counter-example |
| D6 | No manifest asset was regenerated | `manifest:verify` byte-identical; `check-asset-ids.py` green |

### 10.3 Gate 3 — the owner can run it

| # | Must be true | Proved by |
|---|---|---|
| O1 | Every sentence on every public page is editable in `/studio` without a deploy | `INITIAL_CONTENT_INVENTORY.md` at 100 % coverage; a spot check editing five fields across five pages |
| O2 | No marketing copy exists in JSX | `scripts/design/check-tokens.mjs` sibling check + review: components render `section.heading`, never a literal |
| O3 | Publishing, unpublishing, reordering, hiding, scheduling and media replacement all work per SEED §52 | `tests/e2e/cms-workflow.spec.ts` |
| O4 | The owner-verification backlog is visible and blocking | `scripts/ops/preflight.ts` prints every row still `OWNER_VERIFICATION_REQUIRED` that blocks a publish |

### 10.4 Gate 4 — the budgets hold

Performance budgets per `docs/ops/PERFORMANCE.md`; accessibility standard per
`docs/ops/ACCESSIBILITY.md`; the visual QA matrix and coverage thresholds per
`docs/ops/TESTING.md`; deployment reversibility per `docs/ops/DEPLOYMENT.md` (rollback drill under
five minutes, recorded with a date).

---

## 11. Owner-verification backlog

Facts and claims this project may not invent. Each is seeded `OWNER_VERIFICATION_REQUIRED` and is
physically prevented from publication until the owner confirms it (D10).

| # | Item | Where it appears | Status |
|---|---|---|---|
| V1 | Actual 3D / digital-fabrication production capability | Home §08, `/collection/3d-resin`, SEED §35 form template | OWNER_VERIFICATION_REQUIRED |
| V2 | Commercial / conference-table capability | `/large-format` category copy | OWNER_VERIFICATION_REQUIRED |
| V3 | Architectural and spatial-installation capability | Home §03, `/large-format` | OWNER_VERIFICATION_REQUIRED |
| V4 | Sculptural seating as a produced category | `/large-format` | OWNER_VERIFICATION_REQUIRED |
| V5 | Custom sizing availability and its limits | FAQ 01, commission page | OWNER_VERIFICATION_REQUIRED |
| V6 | One-of-one / limited-edition availability | FAQ 07, `edition_state` usage | OWNER_VERIFICATION_REQUIRED |
| V7 | Preservation longevity and compatibility | `/collection/preservation`, SEED §34 form | OWNER_VERIFICATION_REQUIRED |
| V8 | The five-step process statements | Home §10, `/process` | OWNER_VERIFICATION_REQUIRED |
| V9 | Legal entity, jurisdiction, controller, statutory basis | `/privacy`, `/terms` | OWNER_VERIFICATION_REQUIRED — pages stay `DRAFT` until supplied |
| V10 | Production WhatsApp number, phone, email, map location | Site settings, WhatsApp templates | OWNER_VERIFICATION_REQUIRED |
| V11 | Any portfolio project, client name, testimonial or delivered work | `/portfolio` | Empty state until a verified project exists; named clients additionally need `client_consent_state = 'GRANTED'` |
| V12 | Every product: name, price, dimensions, materials, lead time, availability, photography | `/product/[slug]` | Zero products are ever seeded (SEED §32) |
| V13 | Domain, DNS, deployment region audience assumption | `DEPLOYMENT.md` | OWNER_VERIFICATION_REQUIRED |
| V14 | MFA for `owner` / `admin`; Supabase PITR window; Cloudinary backup retention | `SECURITY.md`, `DEPLOYMENT.md` | OWNER_VERIFICATION_REQUIRED |
| V15 | Whether a cookie banner is legally required despite no third-party cookie existing | `SECURITY.md` | OWNER_VERIFICATION_REQUIRED |
| V16 | A published accessibility statement | Not built | OWNER_VERIFICATION_REQUIRED |
| V17 | Newsletter: whether it exists at all | SEED §25 | OWNER_VERIFICATION_REQUIRED |

---

## 12. Open questions for the canonical decisions

Raised, not acted on. Nothing above knowingly diverges from `CANONICAL-DECISIONS.md`.

1. **`ROADMAP.md` phase count.** FEAT §44 lists phases 00–46, which is 47 rows; Phase 01's
   deliverable table calls for "all 47 phases from requirement §44". D7 names the file but fixes no
   count. Suggested amendment: state the count once, in D7, so the roadmap and this PRD cannot drift.
2. **`admin` versus `owner` in the persona set.** D5 lists six roles; FEAT §51 and this document
   describe five personas because `admin` is operationally identical to `owner` minus
   `system.owner.transfer`. Suggested amendment: record in D5 that `admin` is a delegation of
   `owner`, so nobody later invents a distinct admin workflow.
3. **Where "Content Performance" analytics comes from.** FEAT §28 lists it as a first-party
   dimension, but D1 contains no web-analytics provider and Phase 40's field vitals are deliberately
   identifier-free and sampled. Phase 37 redefines the metric as database-derived content health.
   Suggested amendment: accept that definition in D1, or add a provider and its variable names to D8
   as an explicit owner decision. (Also raised as `ARCHITECTURE.md` open question 7.)
