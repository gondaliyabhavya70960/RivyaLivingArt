# CANONICAL DECISIONS — binding contract for every phase

> Every phase document, schema, route and component MUST conform to this file.
> If a phase document contradicts this file, this file wins. Change it by
> amendment (append a dated entry to *Amendments*), never by silent divergence.

## D1 — Stack (fixed)

| Concern | Decision | Explicitly rejected |
|---|---|---|
| Framework | Next.js (App Router), React, TypeScript strict | Pages Router |
| Styling | Tailwind CSS + CSS custom properties for tokens | CSS-in-JS runtime |
| Database | Supabase PostgreSQL + migrations in `supabase/migrations` | Neon, Prisma-managed DB |
| Auth | Supabase Auth (staff only) | Customer accounts, NextAuth |
| CMS | Supabase tables + custom Rivya Studio + page-block model | Sanity, Contentful |
| Media | Cloudinary behind a `MediaProvider` abstraction | Vercel Blob, S3 direct |
| AI media | Higgsfield AI, catalogued in `data/higgsfield/asset-manifest.json` | — |
| Hosting | Vercel | — |
| 3D | `three` + `@react-three/fiber` + `drei`, dynamically imported | Always-loaded WebGL |
| Validation | Zod at every trust boundary | Hand-rolled guards |
| Tests | Vitest (unit), Playwright (e2e + visual QA matrix) | — |

**Business rules that override any reference spec:** no online checkout, no payment
gateway, no customer accounts. Conversion terminates in a persisted inquiry then WhatsApp.

## D2 — Repository layout (fixed)

```
app/
  (site)/                    public website route group
  (studio)/studio/           authenticated Studio route group
  (studio)/studio/login/     unauthenticated sign-in surface (proxy redirect target)
  api/                       route handlers (webhooks, cron, media sign)
  styles/                    tokens.css, base.css — shared by both route groups
components/
  primitives/                design-system atoms (Button, Field, Surface…)
  patterns/                  composed UI (ProductCard, Lightbox, MegaMenu…)
  sections/                  CMS block renderers, 1:1 with block types
  studio/                    Studio-only UI
  three/                     3D viewer, client-only
content/                     block schemas + seed content modules
lib/
  supabase/                  server/browser clients, typed DB
  media/                     MediaProvider abstraction (Cloudinary impl)
  cms/                       block registry, page resolution, publishing
  auth/                      RBAC helpers, permission checks
  whatsapp/                  template rendering
  scraper/                   core · adapters · normalization · validation · workflows · analytics
  analytics/ · seo/ · logging/ · flags/
supabase/migrations/         numbered SQL migrations
scripts/                     seeding, media migration, maintenance
data/higgsfield/             asset manifest + raw generation history
docs/                        see D7
tests/                       unit + e2e
```

Plus, at the repository root, `proxy.ts` — the Studio's redirect-only request filter
(amendment A6; Next 16's replacement for `proxy.ts`).

**Rule:** public marketing copy never lives in JSX. Components render
`section.heading`, never a literal headline.

## D3 — Public route map (fixed)

```
/                         /about                 /process
/large-format             /collection            /collection/[category]
/product/[slug]           /collections/[slug]    /custom-commissions
/portfolio                /portfolio/[slug]      /journal
/journal/[slug]           /journal/category/[slug]
/contact                  /faq                   /search
/privacy                  /terms                 404 · error
```

Seeded categories, in priority order:
`furniture · collectible-design · 3d-resin · wall-statement-art · preservation · decor · gifts`

## D4 — Studio route map (fixed)

```
/studio                                     overview · analytics · activity
/studio/login                               sign-in; the only unauthenticated Studio route
/studio/catalog/{products,categories,collections,materials,relationships,
                 customization-forms,bulk}
/studio/merchandising/{homepage,store,featured,scheduling}
/studio/content/{pages,homepage,portfolio,journal,testimonials,faqs,
                 navigation,footer,seo}
/studio/content/journal/categories          the nine SEED §19 subjects (amendment A16)
/studio/media/{all,images,videos,models,documents,higgsfield,brand}
/studio/inquiries/{all,product,commission,consultation,quote}
/studio/research/{dashboard,sources,scrape,jobs,runs,changes,explorer,
                  large-format,compare,similarity,opportunities,shortlist,
                  confirmed,sheets}
/studio/operations/{workflows,data-quality,imports,exports,audit,logs}
/studio/system/{users,settings,integrations,environment,documentation,flags}
```

Navigation is role-aware; every page re-checks permission server-side.

**The list above is the LEAF map, not every file under `app/(studio)`.** Three kinds of route sit
beneath a leaf and are deliberately absent from it, because none of them is a place the sidebar can
link to:

- a **detail** route — `/studio/catalog/products/[productId]`, `/studio/content/pages/[pageId]` —
  where there is no one record to link to;
- a **create** route — `/studio/catalog/products/new` — which is an action on a list, not a second
  destination for it;
- a **tab of a detail** route — `/studio/catalog/products/[productId]/{media,materials,
  specifications,related}`, added in Phase 15 — which is a section of one record.

Governance still flows from the leaf: each of these is reachable only beneath a route this map
names, and each re-checks permission for itself. `tests/unit/studio-nav.test.ts` enforces both
halves — a static route whose parent is static must appear above, and every detail route and tab
must call `requirePermission`.


## D5 — Database naming (fixed)

- `snake_case` tables and columns; plural table names; `id uuid primary key default gen_random_uuid()`.
- Every content-bearing table carries `status`, `created_at`, `updated_at`, `updated_by`.
- Content status enum: `DRAFT · REVIEW · APPROVED · PUBLISHED · ARCHIVED`.
- Owner-verification flag: `owner_verification` enum `NOT_REQUIRED · OWNER_VERIFICATION_REQUIRED · VERIFIED`.
- Fact classification: `BRAND_COPY · EDITORIAL_COPY · VERIFIED_BUSINESS_FACT · PRODUCT_FACT · SEO_COPY · LEGAL_COPY`.
- Scraped data lives in the `research_` prefix and never joins directly to public product tables.
- RLS on by default; public reads restricted to `status = 'PUBLISHED'`.

Roles: `owner · admin · editor · merchandiser · researcher · viewer`.

## D6 — Media & asset rules (fixed)

- Asset priority: real Rivya media → approved user asset → **existing Higgsfield asset** →
  existing render → new Higgsfield generation → technical fallback.
- Nothing already listed in `data/higgsfield/asset-manifest.json` may be regenerated.
- Cloudinary folders follow the manifest's `cloudinary_folder`.
- Every media row carries `alt_text`, `is_ai_generated`, `is_concept`.
- Naming: `<page>-<section>-<variant>.<ext>`; the Rivya asset ID is authoritative, not the filename.
- **Asset IDs come from two allocators sharing one namespace, and must not collide.**
  `scripts/media/build-higgsfield-manifest.py` mints `<FAMILY>-<NNN>` for assets that exist.
  Planned (GAP) assets are named in the `<PAGE>-<SECTION>[-<KIND>]-<NNN>` form and may **never**
  reuse a manifest family prefix — otherwise the ID collides the moment that family grows.
  `scripts/media/check-asset-ids.py` enforces this; run it in CI and before any media migration.
- Desktop/mobile media are separate CMS slots. Available ratios: 21:9, 16:9, 4:3, 3:2, 1:1, 4:5, 3:4, 9:16.

## D7 — Documentation map (fixed)

```
CLAUDE.md · PROJECT_STATE.md · CONTEXT.md · CHANGELOG.md · README.md
docs/SESSION-STATE.md
docs/project/{ROADMAP.md,PRD.md,BUSINESS_RULES.md,phases/*.md}
docs/architecture/{ARCHITECTURE.md,DATA_MODEL.md,CANONICAL-DECISIONS.md,SCRAPER.md}
docs/design/{DESIGN_SYSTEM.md,COMPONENT_REGISTRY.md}
docs/studio/STUDIO_GUIDE.md
docs/media/{MEDIA_GUIDE.md,CLOUDINARY.md,HIGGSFIELD_GUIDE.md,
            HIGGSFIELD_MASTER_ASSET_PLAN.md,HIGGSFIELD_ASSET_STATUS.md}
docs/content/{CONTENT_GUIDE.md,INITIAL_CONTENT_INVENTORY.md}
docs/ops/{DEPLOYMENT.md,ENVIRONMENT.md,SECURITY.md,ACCESSIBILITY.md,PERFORMANCE.md,TESTING.md}
docs/requirements/*                     specifications of record, never edited
```

## D8 — Environment variables (names only; values never committed or displayed)

Public: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_WHATSAPP_NUMBER`.

Server-only: `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `CLOUDINARY_API_KEY`,
`CLOUDINARY_API_SECRET`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SHEETS_SPREADSHEET_ID`,
`SCRAPER_USER_AGENT`, `REVALIDATE_SECRET`.

The Environment page reports *reachability only* — never a value, prefix or length.

## D9 — Phase completion contract

A phase is COMPLETE only when all ten hold: scope implemented · relevant tests run ·
no known scope-breaking error · documentation updated · CHANGELOG updated ·
PROJECT_STATE updated · SESSION-STATE updated · remaining issues documented ·
next phase identified · repository remains recoverable.

## D10 — Content integrity

Never fabricate product specifications, dimensions, pricing, delivered projects, named
customers, testimonials, sales claims, awards, certifications or durability claims.
Brand and editorial copy may be written; anything asserting business capability is seeded
`OWNER_VERIFICATION_REQUIRED`. Empty states are used instead of invented projects.

## Amendments

**2026-09-10 · A23 — Phase 23 takes migration `0214`, `search_documents.status` is `text`,
`content_relations` is an edge and not content, the relation vocabulary becomes a CHECK, the
suggest endpoint matches prefixes, and the island budget is six (PHASE-23-30 §Phase 23,
DATA_MODEL §12).**

Six readings the repository forced, none of which contradicts D1–D10.

- **`0214`, one past the phase document's `0210`–`0213`.** A generated policy file is rewritten
  whole by `npm run auth:gen-policies`, so it cannot also hold the DDL that creates its tables —
  and `0213` creates the relation tables. `0212` is therefore the generated RLS for the search
  index and `0214` for the relations, which is the split Phase 19 already made with `0172` and
  `0183`. Recorded in DATA_MODEL §12, which `check-migrations.mjs` reads.
- **`search_documents.status` is `text`, not `content_status`.** Seven of the eight indexed
  entities carry `content_status`; `inquiries` does not — §1.4 exempts it and it carries
  `pipeline_status` instead — so there is no legal `content_status` value an inquiry document could
  hold. The column stores the source row's own token verbatim under a CHECK over the union of both
  enums' twelve labels, and the anon predicate is unaffected because a second CHECK makes "only the
  five public types are ever `PUBLIC`" structural. DATA_MODEL's draft row said `content_status`;
  correcting it was a deliverable of this phase.
- **`content_relations` carries `created_at` and `created_by`, not Tier A+B.** DATA_MODEL's draft
  gave it the content tiers. It is an EDGE, and every shipped edge in the schema —
  `product_relations`, `entity_relations`, the four Phase 03 join tables — carries those two columns
  and nothing else. A `status` here would allow a DRAFT relation, which is a state nobody can act
  on: either an editor made the connection or they did not. `product_attribute_terms` is the one
  table in this phase that IS content, and it carries the full Tier B set and the D10 gate.
- **The relation vocabulary is a CHECK now, which `product-edges.ts` recorded as a deliberate
  non-decision.** That reasoning — the vocabulary is a component's business, and a constraint would
  turn a UI decision into a migration — held while one screen wrote one table. Phase 23 adds a
  second table, a suggestion engine and a workspace, so the vocabulary has four writers and "the
  component decides" stops being true. `is_relation_type()` fixes nine names and
  `is_relation_target()` six targets, both asserted against their TypeScript copies by test.
- **The suggest endpoint matches PREFIXES; the results page does not.** The phase document
  specifies `websearch_to_tsquery` for the query path, and running the site showed why that is only
  half the story: a tsquery matches whole lexemes, so `re` suggests nothing until the whole word is
  typed, and a type-ahead that only matches finished words is not a type-ahead. `p_prefix` builds a
  `:*` query from tokens the function itself extracts — `to_tsquery` raises on malformed input,
  unlike `websearch_to_tsquery`, so nothing the caller typed reaches the parser. The results page
  leaves it off and keeps the specified behaviour, relying on the 0.30 trigram fallback for a
  partial word.
- **The homepage island budget is six.** FEAT §18 asks for search from anywhere, so the combobox
  lives in the site shell and is therefore on the homepage's client graph beside the mega menu and
  the drawer. It cannot be a Server Component: everything it adds over the plain form beneath it is
  state that changes between keystrokes. `scripts/site/check-island-budget.mjs` names it and the
  number was raised in the same edit, because a gate whose number moves silently is not a gate.

**2026-09-10 · A22 — Phase 22 ships eleven slots and no reusable one, the categories trigger
makes a slot, `featured-collections` joins the block catalogue as its 34th member, the EDITORIAL
fallback draws its tiles from a named section, and the sweep records rather than publishes
(PHASE-16-22 §Phase 22, STUDIO_GUIDE §8).**

Five readings the repository forced, none of which contradicts D1–D10.

- **Eleven slots, all with a surface.** STUDIO_GUIDE §8 was written with six rows, one of them a
  reusable `FEATURED_COLLECTIONS` "for any surface" and one a single `CATEGORY_PINNED`. The phase
  document supersedes both: a slot with no surface is a list nothing renders, so there is none;
  `HOMEPAGE_FEATURED_COLLECTIONS` is the only featured-collections slot in the schema; and each D3
  category has its own `CATEGORY_PINNED_<SLUG>`. The rows are inserted by migration `0200` as
  STRUCTURE under the `check-migrations: allow-insert` marker — a slot carries no copy and names
  no entity, and an editor can neither create nor remove one. `merchandising_slots` therefore
  carries Tier A and `status` only: no verification columns (it asserts nothing) and no seed
  columns (no module writes it).

- **A category brings its slot by trigger.** The phase document has the per-category slot
  "created by the same server action that creates the category". No such action exists —
  categories are seeded — so `sync_category_pinned_slot()` fires on INSERT and on UPDATE OF `slug`,
  covering the seed runner, a Studio action written later and a hand-typed row alike, and carrying
  the slot along when a slug is renamed. The key rule is one function in SQL
  (`merchandising_category_slot_key`) and one in TypeScript (`categorySlotKey`), and a test holds
  them level.

- **`featured-collections` is a block, not a rewrite of `category-grid`.** SEED §10-03's seeded
  band is a `category-grid` of five hand-written cards, two of them withheld until the owner
  verifies a capability claim, and that band stays an editor's copy. The merchandised half is a
  new reference block that holds no cards, reads `HOMEPAGE_FEATURED_COLLECTIONS` by default on `/`,
  and hides itself below three. `BLOCK_TYPES` is therefore 34 (PHASE-05-09 §08's 28, A14's two,
  Phase 17's two, Phase 19's one, and this one); it is addable on `/` and `/collection` and is NOT
  seeded onto the homepage — placing it is an editor's act in Studio. The selector swap itself
  changed no renderer; the three reference renderers learned the fallback MODES afterwards,
  separately, which is what the phase's exit criterion means.

- **The editorial fallback draws from a section, and links only where a tile may.** An
  `EDITORIAL_BLOCK` fallback renders the seeded SEED §27 sentence AND tiles built from the section
  the slot or the block names — by default the page's own live `material-story` (SEED §10-05):
  heading, body, desktop still, and a CTA only when it targets `/large-format`, `/collection` or
  `/custom-commissions`. The seeded material story's "Discover Our Process" → `/process` is
  therefore dropped from the tile and stays with its own band. `EditorialTile` has no field for a
  price, a product link, a SKU or a dimension, so a tile cannot carry one. `HIDE_SECTION` removes
  the whole band, heading included; `SHOW_EMPTY_STATE` is the Phase 11 sentence alone.

- **The sweep records; the resolver decides.** Windows on `merchandising_entries` are honoured by
  the resolver (`isLive`, the same rule `page_sections` uses) and by the generated RLS clause on
  every read. `merch_run_schedule()` — the merchandising pass the Phase 08 cron gained — therefore
  puts nothing on or off the site: it records each window transition once in `activity_events`,
  archives an entry whose window closed so Studio tells the truth, and returns the D3 paths whose
  caches the cron must rebuild. Two route-level regions with no block to live in — the store's
  featured row on `/collection` and the pinned region on a category page — are rendered by
  `MerchandisedRow` (RC-243) beneath the page's sections, with a `global_content` heading each,
  and the pinned region is drawn on the category's default view only (page one, no facet, the
  curated sort); the grid itself is untouched. The order of the seven categories is
  `categories.sort_order` as Phase 03 declared it; the SEED §56 inversion is refused once with the
  warning and allowed on a second, acknowledged submit.

**2026-09-10 · A21 — Phase 21's migrations are `0194`–`0195`, React is pinned at 19.2.8 for as
long as `@react-three/fiber` caps it, `public/basis/` holds the Basis transcoder while meshopt ships
inside the viewer chunk, and the flag key is `three_d_viewer` (PHASE-16-22 §Phase 21).**

Four corrections to the phase document, each forced by something the repository or a dependency
actually does.

- **The numbers.** PHASE-16-22 assigns Phase 21 `0190`. Phase 20 took `0190`–`0193` after its own
  block was spent (A20). Phase 21 takes `0194` (viewer settings, ceilings, variant labels) and
  `0195` (generated RLS); DATA_MODEL §12 is re-registered. Phase 22's `0200`–`0201` are untouched.

- **React is pinned exactly.** `@react-three/fiber@9.7.0` declares `react >=19 <19.3` and
  `react-dom >=19 <19.3`. The repository carried `^19.2.8`, which npm resolves past that ceiling
  the moment a 19.3 is on the registry, and the install failed with ERESOLVE. `package.json` now
  pins `react` and `react-dom` at `19.2.8`. `legacy-peer-deps` was tried first and rejected: it
  silently drops packages that were installed as peers (`vite`, `@testing-library/dom`, `rolldown`)
  from the lockfile, which breaks the unit suite on the next `npm ci`. The pin is lifted when fiber
  lifts its ceiling, and not before. D1 is unchanged — `three` + `@react-three/fiber` + `drei`,
  dynamically imported.

- **Where the decoders live.** The phase document places Draco and meshopt under `public/draco/`
  and `public/basis/`. Draco is a runtime fetch and lives under `public/draco/` exactly as written.
  meshopt is not fetched at all: `meshoptimizer` exports its decoder as a JavaScript module with the
  WebAssembly embedded, so `components/three/**` imports it and it is served from the origin as part
  of the viewer chunk. `public/basis/` therefore holds what its name says — the Basis Universal
  transcoder `KTX2Loader` needs for `KHR_texture_basisu` textures — and a model with no KTX2 texture
  never requests it. All of it is vendored from `three@0.186.0`, version-pinned, Apache-2.0, with
  registry rows in COMPONENT_REGISTRY.md. No decoder is loaded from a CDN.

- **The flag is `three_d_viewer`.** The phase document, MEDIA_GUIDE §7.3 and COMPONENT_REGISTRY
  write `3d_viewer`. A flag key must be a legal identifier and the `feature_flags` CHECK requires a
  leading letter (Phase 19), so the key was registered as `three_d_viewer` in Phase 19 and every
  `3d_viewer` reference reads as that.

- **Posters are chosen, not captured.** The phase document's "poster capture action" is not built.
  A frame captured from the viewer is a rendering of a model presented as a photograph — the claim
  BR-E3 exists to prevent — so the poster is an `IMAGE` asset chosen from the library, enforced by
  `guard_model_still_references()`, and the mount renders it with the same srcset a hero gets.

Also recorded here rather than in the phase document, because each is a rule the database now
holds: the three model ceilings are CHECK constraints as well as inspector rules;
`associated_project_id` gains the foreign key Phase 06 said it would once its table existed; the
association columns are constrained to `MODEL_3D` rows, which they have only ever described; and
`set_model_association()` writes both sides of a product association in one SECURITY INVOKER
transaction (the `0184` pattern), so "no poster, no page" is enforced by the constraint firing
inside it.

**2026-09-09 · A20 — Phase 20's migrations are `0190`–`0191`, there is no `CONTACT` content
group, `inquiry_attachments` has no anon insert, and the anonymous submit path reads nothing back
(PHASE-16-22 §Phase 20).**

Four corrections to the phase document, each forced by something the repository or the database
actually does.

- **The numbers.** PHASE-16-22 assigns Phase 20 `0180`–`0182`. All three were spent while Phase 19
  was being finished: `0180` marks demonstration content, `0181` fixes a publication date a status
  trigger failed to carry, and `0182`/`0183` bring the rate limiter forward. Renumbering those would
  reorder the apply sequence relative to migrations that have already run on two databases. Phase 20
  takes `0190`–`0191`; DATA_MODEL §12 is re-registered.

- **There is no `global_content` group `CONTACT`, and no third migration.** The phase document adds
  one so that SEED §21's "do not hardcode these values in multiple components" holds. It already
  holds: Phase 09 put the phone, WhatsApp number, email and location in ONE `contact-details`
  section payload, which the footer and `/contact` both read through `lib/site/contact-details.ts`.
  Adding a `global_content` group now would create a SECOND home for the same four facts — two
  places to change a phone number, one of which somebody forgets — which is the exact failure §21's
  sentence warns about. The section carries `owner_verification` like any other content row, so the
  VERIFIED gate the number resolution needs is already there. Verification step 1's
  `select group, key from global_content where group = 'CONTACT'` therefore returns nothing, and
  should.

- **`inquiry_attachments` has no `anon` INSERT policy**, though the phase document names one. The
  reason is mechanical rather than a preference: an attachment references `media_assets`, and `anon`
  cannot create a row there — Phase 06's policies do not admit it and should not, because that table
  is the studio's library. An anon insert policy on the join table would describe a path with no way
  to satisfy its own foreign key. `attach_inquiry_references()` is SECURITY DEFINER instead: it
  checks the enquiry was created in the last ten minutes and refuses any `public_id` outside
  `rivya/inquiries/incoming/`, which is the folder `upload-sign` signs. Probed: a `rivya/brand/…`
  reference is silently not attached, an incoming one is, as `USER_UPLOAD`/`DRAFT`.

- **`INSERT ... RETURNING` DOES NOT WORK FOR `anon` ON A TABLE WITH NO SELECT POLICY**, and finding
  that out changed the shape of the write path. PostgreSQL applies the SELECT policy to a RETURNING
  clause, so the insert succeeds, the read of what was written is refused, and the error is
  `new row violates row-level security policy` — which reads exactly like a rejected write and is
  not one. That behaviour is correct and must not be worked around by giving `anon` a select policy:
  "its own row" is a claim the database has no way to check. So the application generates the `id`
  before inserting, and `inquiry_reference_code(uuid)` — SECURITY DEFINER, ten-minute window,
  `NEW` only — returns the trigger-allocated code. The anon INSERT policy remains the real guard on
  the real write path, and is the thing verification step 3 tests.

**The generated-policy machinery gained one concept for this.** `TablePolicy` now carries an
optional `anonInsert { withCheck, why }`; `gen-role-sql.ts` emits the policy and `check-rls.ts`
compares the predicate the database re-printed against the one declared, normalising the casts and
parentheses Postgres adds. It is not a fourth shape: a shape describes how a table is READ, and
`inquiries` is read by nobody outside the studio. Any anon policy that can SELECT on a shape-C table
is still an outright failure, declared insert or not.

**2026-09-09 · A19 — the form builder is one collapsed column with numeric ordering and a link to
the public page, not two panes with a drag tree and a live preview (STUDIO_GUIDE §7.6).**

STUDIO_GUIDE §7.6 describes the builder as "two panes: a drag-ordered step and field tree on the
left, a live preview of the public configurator on the right". Three of those four things were
built; the fourth was not, and the reasons are worth writing down rather than discovering again.

- **Ordering is a number per row and one save, not a drag tree** — the same decision A15·d already
  made for `portfolio_project_media`, for the same reasons, and one more that is specific to this
  table. A form's positions are renumbered by `normalise_form_step_order()` and the contact step is
  forced last whatever it is given, so the sequence has to be submitted whole:
  `cms_set_form_step_order` assigns every position in one statement, while ten dragged rows saved
  one at a time would be ten transactions racing that trigger, with the last to land deciding.
- **One collapsed column, not two panes.** A form is a sequence, and the question a builder is
  answering is whether the brief reads end to end. Two panes at this density would put the tree and
  the field being edited on different halves of the screen at every width the QA matrix names below
  1280. `<details>` collapses without state, without JavaScript and without removing the content
  from the document.
- **There is NO live preview pane, and this is the real divergence.** Mounting the real
  `Configurator` inside the Studio would have two side effects on a surface whose whole job is to be
  side-effect free. It writes a draft to `sessionStorage` under a fixed key, so a builder's
  exploratory answers would overwrite a visitor's saved brief in the same browser; and its upload
  control mints credentials against `app/api/inquiries/upload-sign`, the unauthenticated endpoint
  A18's rate limit exists to protect — a preview would spend a real visitor's allowance. The
  builder links to `/custom-commissions` instead, and the honest consequence is stated on the
  screen: a form is previewed there once it is published and the flag is on. A preview that reads
  drafts belongs with Phase 20's persistence, where the draft key stops being a single global.
- **`validation` is not editable in the builder.** The column carries an allowlist CHECK — nine Zod
  keys, and `price_multiplier` is not among them — and a free-text JSON box would be the only way
  an editor could trip a constraint whose refusal names a constraint rather than a field. The
  seeded templates set what they need; Phase 20 adds a typed control per key.
- ***Duplicate from template* IS built**, as `cms_duplicate_customization_form()` (migration
  `0184`): one transaction, because three PostgREST writes are three transactions and the
  interruption between the steps and the questions leaves a form that looks finished and asks
  nothing.

**2026-09-09 · A18 — `rate_limit_buckets` arrives in Phase 19, and Phase 41 inherits it
(SECURITY.md §8, PHASE-16-22 §Phase 19).**

SECURITY.md assigns the rate-limit table to Phase 41 and `app/api/media/sign` deferred its own
limit accordingly, with a comment recording the gap. That was defensible: the route demands a staff
session with `media.write`, so the exposure is a signed-in colleague or a stolen session.

Phase 19 adds `app/api/inquiries/upload-sign`, which is **unauthenticated by design** — a visitor
filling in a bespoke brief has no account and D1 forbids giving them one. An unauthenticated
endpoint that mints upload credentials with no limit is an open file host with the studio's
Cloudinary bill attached, and the phase document names that risk and lists the per-IP limit among
its mitigations. Deferring it would have meant shipping the risk together with a note that the
mitigation exists twenty-two phases ahead.

- Migration `0182` creates the table in the shape DATA_MODEL already specifies —
  `(bucket_key, window_start)` — so Phase 41 adds the staff-endpoint keys and the sweeper rather
  than creating anything. `0183` is its generated RLS.
- The number is outside Phase 19's `0170`–`0172` block because that block had already been applied
  when the need surfaced. Renumbering into it would have reordered the apply sequence relative to
  migrations that had already run.
- `consume_rate_limit()` counts and decides in ONE statement. A read-then-write limiter is a race
  two concurrent requests both win, and a limiter with a race is a limiter with a documented bypass.
- The bucket key is a salted hash. SECURITY.md forbids a raw visitor IP at rest and
  `activity_events` says the same in its own comment; the table never sees an address.
- It fails CLOSED. A database that cannot be reached is precisely when an endpoint is least able to
  absorb whatever is hitting it, so an unanswerable limiter refuses rather than admits.

**2026-09-09 · A17 — `system.flags.write` stays owner AND admin; STUDIO_GUIDE open question 5 is
closed in the matrix's favour (PHASE-16-22 §Phase 19).**

Phase 19's document calls `/studio/system/flags` "owner-only" in four places, including an exit
criterion and an RLS requirement. The Phase 04 matrix has said `['owner', 'admin']` since it
shipped, DATA_MODEL and STUDIO_GUIDE both already follow the matrix, and STUDIO_GUIDE's open
question 5 records the disagreement and asks for it to be resolved. It is resolved here, and the
matrix wins.

The reason is the one amendment A7 gave in the identical situation one phase block earlier: **a
later phase's prose does not narrow a shipped authorisation.** Phase 08's document said an editor
must not publish; the matrix said they may; the matrix won and the danger the sentence was reaching
for turned out to be held by a different permission. The same applies here — an admin already holds
`system.settings.write` and `system.users.manage`, so a role trusted to invite staff and edit the
WhatsApp template is not one to be locked out of a switch that turns an unreleased feature on.

- `feature_flags` is READABLE under `studio.access`, which every role holds. STUDIO_GUIDE §2.3
  considered and rejected hiding the register behind the write permission, and that reasoning is
  adopted: the list of what is switched on is how anyone in the Studio accounts for a surface that
  is missing.
- Every toggle is audited, so an admin's flip carries a name either way.
- The phase document's verification step 5 — "as `admin`, the toggle is absent and a direct POST is
  denied" — is superseded. What replaces it: as `editor`, `merchandiser`, `researcher` or `viewer`
  the toggle is absent and a direct write is refused by RLS and re-checked by the server action.

**2026-09-08 · A11 — the homepage's island budget is five, and the fifth is `SiteErrorCopyProvider`.**

The Phase 11 document names four client islands for `/` and says "a fifth island fails the build":
`MegaMenu`, `MobileNav`, `HeroMotion` and `MaterialSequence`. The real count is five, and the extra
one predates the phase document rather than being added by it.

`app/(site)/error.tsx` MUST be a Client Component — Next requires it, because the boundary takes a
`reset` callback — and D2 forbids a visitor-readable literal anywhere on the public site. A Client
Component cannot read `global_content`, so Phase 10 has the layout read the five error strings on
the server and pass them across the boundary through `SiteErrorCopyProvider`, which renders its
children unchanged. It has no DOM node, no state and no event handler; it is still a hydration
boundary, and a gate that excluded it would be measuring something other than what ships.

- `scripts/site/check-island-budget.mjs` names all five in `ALLOWED`, with the reason each one
  cannot be a Server Component, and fails on a sixth. `BUDGET` is written out rather than derived
  from `ALLOWED.size`, so listing a new island does not silently raise the budget.
- An island is a `'use client'` module that a SERVER module imports. `MediaVideo` inside
  `HeroMotion` is part of that island's bundle, not a boundary of its own.
- The gate walks `app/layout.tsx`, `app/(site)/layout.tsx` and `app/(site)/page.tsx`. The phase
  document says "reachable from `app/(site)/page.tsx`" and then that three of the four islands come
  from the shell, which is the layout; a walk from the page alone would report one island and pass
  while the shell grew four more.

**2026-09-09 · A16 — D4 gains `/studio/content/journal/categories` (PHASE-16-22 §Phase 18).**

Phase 18's Studio section asks for a screen editing the nine SEED §19 journal categories, and D4's
map did not list it. Adding a Studio route silently is exactly what `tests/unit/studio-nav.test.ts`
exists to prevent — it holds the navigation manifest, the D4 map and the files on disk to each
other, and it caught this — so the route is recorded here rather than added to the manifest alone.

It is a LEAF of its own rather than a tab of `/studio/content/journal`, and that is the decision
worth writing down. The article list edits `journal_articles`; this screen edits
`journal_categories`, whose `slug` is a public URL. Burying the one screen that can change a public
address behind the one that cannot would make it harder to find than the routine work — and an
editor visits it rarely and deliberately, which is what a leaf is for.

It is also the Studio's first non-dynamic sub-page: every other second-level route under a leaf is
a `[detailId]` or a tab of one. The nav test already models those two shapes and treats anything
else as undeclared, which is why this needed the map rather than an exemption.

**2026-09-09 · A15 — four corrections raised by Phase 17 (PHASE-16-22 §Phase 17).

*A15·a — the evidence gate is TWO functions, one per table, and the phase document's ordering of
its branches is wrong.* PHASE-16-22 §Phase 17 supplies pseudo-code putting the `WITHDRAWN` branch
LAST, after the publish checks. With that ordering, withdrawing consent on a row that is currently
PUBLISHED is REFUSED: the statement passes through the publish check on its way to the withdrawal
branch, the check fails, and the write is rejected — leaving the project live under the name of the
person who has just asked not to be named. The branch runs FIRST and unconditionally in `0150`.
`DATA_MODEL.md` §8.12 records this, and it also corrects that document's own description of a
single shared `enforce_evidence_gate()`, which cannot work: plpgsql resolves a record field at
execution, so one function referencing both tables' columns raises
`record "new" has no field …` on the first write to whichever table it was not written for.

*A15·b — the `/portfolio` empty state carries SEED §7's CTA label, not §28's.* §28 writes "Explore
the Collection". §7 is the reusable CTA vocabulary and contains "View the Collection" and "Start a
Custom Project", which is what the rest of the site already says for these two destinations. The
seed uses §7's labels: one label per destination is worth more than one section's phrasing. §28's
heading and body are seeded verbatim and are asserted as such by
`tests/unit/portfolio-empty.test.ts` — which found that the heading was not seeded at all, so the
page had been rendering half the empty state since Phase 09.

*A15·c — setting `owner_verification = 'VERIFIED'` requires `content.verify`, not
`content.publish`.* BUSINESS_RULES BR-H3 said `content.publish`, which also admits `editor`.
Confirming that Rivya delivered a project, or that a named person really said something, is a claim
made on the business's own behalf; `content.verify` is owner and admin only, and the two
permissions are separate precisely so an editor can prepare a page they cannot vouch for. The
implementation was already the stricter of the two; the rule now says so.

*A15·d — the gallery orders by a number, not by dragging.* The phase document asks for "drag
ordering" on `portfolio_project_media`. A drag-only reorder is unreachable by keyboard and by
screen reader, needs a client-side library and a persistence path of its own, and does not work
with JavaScript disabled — which every other Studio form does. The panel uses a numeric order field,
as `ProductMediaTab` already does. Drag may be added on top of it later; it may not be the only way
in.

**2026-09-09 · A14 — the block catalogue is 30, not 28, and the exhibition template is ten
elements rather than eleven (supersedes A8's count; PHASE-16-22 §Phase 16).**

Two corrections, both raised by Phase 16 and both about counting.

*The catalogue is 30.* A8 records that PHASE-05-09 §08 names 28 block types, and it did. Phase 16
adds `signature-media` and `collection-products`, which §08 could not have named because neither is
a page section in the homepage sense — they exist because FEAT §8 describes an exhibition page and
two of its eleven elements have no block that can express them. Both ship BUILT, so A8's tiering is
untouched: the split is still recorded in code rather than in prose, and the planned list is still
eight. `lib/cms/block-types.ts`, both registries and `tests/unit/cms-registry.test.ts` all say 30.

*The exhibition template inserts ten blocks, not eleven.* The phase document's element table maps
FEAT §8's eleven elements onto blocks, and element 9 — "Editorial copy" — maps to `rich-text`, which
is one of the eight PLANNED blocks: declared so a page can hold one, with `null` for its renderer
and nothing on the public site. The phase's own exit criterion asks that all eleven be available as
blocks, and that criterion and the registry cannot both be satisfied by this phase.

Building a `rich-text` renderer to close the gap would be the worse answer. It is the one block in
the catalogue whose payload is unbounded — a rich-text document needs a sanitiser, an allow-list of
elements, a decision about embedded media and a Studio editor that is not a JSON textarea — and
none of that is Phase 16's subject. A template that inserted a block which renders nothing would be
worse still: an editor would apply the template, see ten bands, and have no way to tell that the
eleventh is missing rather than empty.

So the template inserts the ten elements that have renderers, in FEAT §8 order, and
`content/templates/exhibition.ts` records element 9's absence and the phase that closes it. Every
block is optional and removable, which the phase document already says the template is for — a
starting point, not a constraint — so an editor who wants editorial copy today has `statement`.

*No `app/(site)/collections/[slug]/opengraph-image.tsx`.* The phase document lists one and says it
"uses the `og` preset from `lib/media/transform.ts`" — which is already what happens for every page
on the site: `buildPageMetadata` resolves `seo_entries.og_media_id` through `resolveSpec('og')`, so
the social image is a thing an editor picks in Studio. Next gives file-based metadata precedence
over the `metadata` export, so adding that route would override the editor's choice on exactly these
pages: the owner would change the image in Studio and watch nothing happen. No other route in the
project has one, for the same reason.

*Phase 17 takes the catalogue to 32 and builds no `ProjectCard`.* `project-gallery` and
`testimonial-strip` join it; `components/patterns/ProjectCard.tsx`, which the Phase 17 deliverables
table lists, is NOT built. `portfolio-strip` already renders project cards through `ReferenceCards`
with `marker="data-project-card"` — the same component that draws product and article cards, tested
once and behaving identically for all three. A second card component under a different name would
be a duplicate of working, tested code, and the two would drift the first time one was restyled.
The marker the phase's own e2e assertions use is already emitted.

*A third, smaller correction.* The phase document names the two renderers
`components/sections/CollectionProducts.tsx` and `SignatureMedia.tsx`. Every one of the other
twenty renderers in that directory is named `<Block>Section.tsx`, and the registry test reads the
directory; they are built as `CollectionProductsSection.tsx` and `SignatureMediaSection.tsx`.

**2026-09-09 · A13 — Phase 14's eight departures from what was written before it.**

Each is small, each is argued where it lives, and each is here so that a reader who finds the code
disagreeing with a document knows which one was decided later.

1. **`lib/site/routes.ts` gains `DYNAMIC_PUBLIC_ROUTES`.** `/collection/[category]` is the first
   dynamic public route, and `tests/unit/site-routes.test.ts` fails in both directions — a route
   file with no declaration is a URL nobody wrote down. Exempting bracketed segments from the
   "no undeclared route" half would have exempted every future dynamic family too, so the test now
   compares two lists instead of one. `STATIC_PUBLIC_PATHS` still declares exactly thirteen.

2. **`renderCmsPage(path, below?)` takes a second argument.** Only the two catalogue routes pass it,
   and only for something the CMS genuinely cannot hold: a grid of database rows with filters over
   them. Everything a section can express stays a section — the moment a route appends its own copy,
   the owner has lost the ability to change that copy. The slot does NOT rescue a page with no live
   sections: a category page whose hero is still DRAFT is still a 404, because SEED §55 is about
   whether the page has been published, and a product grid under a heading nobody approved is
   exactly the "looks finished" failure that rule exists to prevent.

3. **A second seed module, `content/seed/catalog-ui.ts`.** The phase document names one seed addition
   (`empty.collection.no_results`, which lives where the document puts it). It did not anticipate
   that a server-rendered filter rail needs its own vocabulary — names for its groups, its three
   sort options, Previous and Next. D2 and `scripts/cms/check-section-copy.ts` leave no room for
   typing those into JSX, so they are rows. It follows `site-chrome.ts`, which exists for the same
   reason and states it: strings a component needed are kept apart from strings the specification
   supplied, so a reader can tell which is which.

4. **`scripts/db/gen-types.mjs` excludes `schema_migrations`.** It is `db:migrate`'s own bookkeeping,
   created by the runner rather than by a migration, so whether it exists at generation time depends
   on how a database was built. That made the same schema generate two different type files and the
   drift check fail on a difference nobody made. No repository reads it and PostgREST never exposes
   it.

5. **`?collection=` is multi-valued.** The phase's parameter table says "collection slug", singular,
   and a slug is still what the parameter carries. Allowing more than one is a superset that keeps
   the rail one shape: a single-valued dimension needs a different control from a multi-valued one
   (a select with an "any" option rather than checkboxes), a different way to clear it, and its own
   word for "any".

6. **`products_edition_size_coherent` is stronger than specified.** The phase document requires that
   `LIMITED_EDITION` states a size. `0122` also requires that size to be positive, and requires every
   other edition state to carry none — "limited edition of 0" is a typo a visitor reads as inventory,
   and "One of One, edition of 12" is a contradiction a product card would render straight-faced.
   Same direction, one step further, argued in the migration.

7. **Facet counts are computed from the fully filtered set**, so the rail narrows as filters are
   applied and no option ever leads to an empty page. `docs/project/BUSINESS_RULES.md` BR-C5 records
   the trade and why the alternative — counts that do not describe the page they sit beside — is the
   kind of small dishonesty this project refuses.

8. **Two component-registry corrections.** RC-223 was planned as `FilterBar` (public) and is built as
   `FilterRail`, because the Studio already has a `FilterBar` and two components one word apart, one
   of them a Client Component, is how the wrong one gets imported. RC-217 `ProductCard` is **not a
   link** in Phase 14: `/product/[slug]` is Phase 15, and an anchor now would put a 404 behind every
   card in the grid — the dead door Phase 13's `resolveInternalTarget` exists to refuse. Both records
   carry the reason.

**2026-09-08 · A12 — `--container-full` is not bridged into Tailwind's theme (DESIGN_SYSTEM §5.3).**

Tailwind v4 reads the `--container-*` namespace for both `max-w-*` and `w-*`. `app/globals.css`
bridged all four §5.3 container sizes into `@theme`, which redefined `w-full` — a built-in utility
meaning `width: 100%` — as `width: 120rem`. Every `w-full` in the product therefore meant 1920px.

`AspectBox` is `w-full`, so every media frame on every page was 1920px wide inside whatever column
contained it. At a 1440px viewport the homepage's document was 2672px across; the design-system
gallery's own visual baseline had been recording a 2264px-wide page since Phase 02. The symptom was
known and worked around twice — `Accordion` and `Disclosure` each carry a comment explaining why
they avoid `w-full` — but the cause was never removed.

- The `full` bridge is gone; `prose`, `default` and `wide` stay, because they name no built-in
  utility. `Container` was never affected: it sets `max-inline-size` from the raw token as an
  inline style, which is what its own header says.
- A surface that wants the 120rem bound writes `max-w-(--rv-container-full)`.
- Found by `tests/e2e/homepage.spec.ts`, which asserts `document.documentElement.scrollWidth` does
  not exceed the viewport at each of FEAT §45's eight widths. Nothing had measured horizontal
  overflow before; every other check was on a property that this bug did not change.
- The eight design-system baselines were regenerated. The old ones recorded the bug.

**2026-09-08 · A9 — `/search` has a route file but no `pages` row (D3).**

D3 lists `/search` among the thirteen static public paths, and it keeps that address. What changed
is where its content comes from: Phase 09 decided the route gets no `pages` row, because it is a
query surface with nothing an editor composes — no sections, no blocks — so a row would exist only
to be empty and to appear in Studio inviting somebody to add content that would never render.

Recorded as an amendment because the Phase 10 document lists `/search` among the routes that
delegate to `renderCmsPage(path)`, and that would 404 the route outright: `renderCmsPage` resolves
a path to a `pages` row and answers `notFound()` when there is none. The route file is therefore
its own page, rendering the search form and SEED §26's no-results state from `global_content`
alone. It still holds no copy of its own, and it is still one of the thirteen.

- `lib/site/routes.ts` is the declaration; `tests/unit/site-routes.test.ts` asserts the route files
  and that list agree exactly, so the exception cannot quietly become a missing route.
- `/search` is `noindex` in its own metadata and absent from `sitemap.xml`. A results URL is not a
  document; its contents depend on a parameter.
- The search ENGINE is Phase 23. Until then any query returns the no-results surface, which is
  honest rather than broken — the form submits, the query survives in the URL, and the page says
  plainly that nothing matched.

**2026-09-08 · A10 — a `notFound()` page is delivered to the browser, not rendered into the HTML (D3).**

Measured on Next 16.3.4, not inferred: a route that calls `notFound()` returns a correct HTTP 404
whose HTML `<body>` is empty, with the not-found UI carried in the RSC payload and rendered on the
client. Verified in Chromium — with JavaScript the page is complete (the seeded eyebrow, heading,
body and both CTAs, inside the full site chrome); without JavaScript the body is blank. It is not
caused by anything in this repository: a page whose entire body is `notFound()`, with no `await`
before it, behaves identically, as does one with no `revalidate` and no `not-found.tsx` of its own.

Recorded rather than worked around. The remedy Next documents is a check in `proxy.ts` that
rewrites missing paths before the response starts — a database query on every public request, in
the one file amendment A2·b restricts to session refresh, to improve the page a visitor is not
meant to reach. What matters is intact: the status is a true 404 rather than a soft one, so
crawlers and monitoring are correct, and `app/not-found.tsx` — reached by a URL matching no route
at all — is fully prerendered and renders without JavaScript.

- Phase 39 (SEO) and Phase 41 (accessibility) inherit the decision to revisit.
- `tests/e2e/site-shell.spec.ts` asserts the 404 STATUS at all eight widths, which is the part that
  must never regress.

**2026-09-08 · A8 — the CMS block catalogue ships in two tiers, and the registry says which (D9).**

PHASE-05-09 §08 names 28 block types. Phase 08 builds the ENGINE plus six of them; the other 22
are declared and explicitly unbuilt. (A14 later raises the catalogue to 30: Phase 16 adds the two
blocks an exhibition page needs. The tiering below is unaffected.) This is an amendment rather than a silent scope cut because
the phase document reads as though all 28 arrive together, and a reader comparing the document to
the code needs the difference to be recorded rather than inferred.

*Which six, and why those.* `hero`, `statement`, `category-grid`, `process-steps`, `empty-state`
and `divider`. They were not chosen for coverage of any page — they were chosen so that between
them they exercise every payload family the other 22 will need: no payload (`statement`),
media-only (`hero`), repeating items with indexed media references (`category-grid`,
`process-steps`), query-and-global (`empty-state`), and the degenerate case of no payload AND no
copy fields (`divider`). The last is in Tier 1 deliberately: `sharedFields: []` must mean "no copy
fields" and never "no editor", or a divider would lose its visibility toggle and D9's second exit
criterion would be false for it.

*How the split is recorded in code, not in prose.* `lib/cms/block-types.ts` lists all 28;
`lib/cms/registry.ts` is `satisfies Record<BlockType, BlockModule>` so a missing entry fails the
build; each module declares `state: 'BUILT' | 'PLANNED'`. `components/sections/registry.ts` maps
the same union to renderers with `null` for planned, and a test asserts the two registries agree.
A planned block cannot be added in Studio and renders nothing on the public site — not a
placeholder, not a grey box, which would be a sentence nobody wrote appearing on the page.

*What Phase 09 inherits.* The 22 remaining blocks, and a repeater UI for arrays: a block with
repeating items is edited as JSON today, validated on save against its own schema and refused
rather than coerced. That is stated in `block-module.ts` as an admission, not a placeholder.

**2026-09-08 · A7 — two permissions added, and the twelve transition edges fixed (D5, D9).**

The Phase 08 documents describe the status workflow in three places that did not agree: one lists
eleven edges, another eight, and the permission column names `content.review` and `content.verify`
— neither of which existed in the matrix. Resolved by taking the UNION of the edges and adding
both permissions, because every edge either document names is one a real editorial workflow needs,
and an edge omitted from the machine is a state an editor cannot leave.

- `content.review` → owner, admin, editor. `content.verify` → owner, admin.
- `content.publish` is UNCHANGED and still includes editor. Narrowing it was tempting and would
  have been a different decision than the one recorded here; it is left alone deliberately.
- The twelve edges live in `lib/cms/transitions.ts` as the single source, and
  `scripts/cms/gen-transition-sql.ts` RENDERS `0052_phase08_transition_trigger.sql` from them.
  `npm run cms:check-transitions` byte-compares the file against a fresh render, so the trigger
  and the TypeScript cannot drift.
- **The trigger's permission arm is currently unreachable**, and that is recorded rather than
  removed: write, review and publish are held by the same three roles today, so no actor can reach
  an edge they lack the permission for — RLS refuses the UPDATE first, and an UPDATE matching no
  policy affects zero rows and SUCCEEDS. The arm is a latch for the day `content.publish` narrows.

**2026-09-08 · A6 — the Studio's auth redirect moves from `proxy.ts` to `proxy.ts` (D2).**

Next 16 deprecated the `middleware` file convention and renamed it to `proxy`. Same matcher, same
request object, same responses; the file name changes and the export renames from `middleware` to
`proxy`.

Adopted rather than deferred, for one reason: **Next does not read `proxy.ts` any more, and
does not warn about a file it was never going to open.** That makes this the rare deprecation whose
failure mode is silent and total — a `proxy.ts` restored from an older document or a stale
branch leaves every Studio route reachable with no session, a green build, and no message anywhere
saying so. Carrying the deprecated name through several more phases would have meant carrying that
trap alongside it.

- The file is `proxy.ts` at the repository root and its export is `proxy`. D2's tree is updated.
- A2·b is unchanged and still governs: this file may only redirect. Nothing about the rename
  loosens it, and `lib/auth/require.ts` remains the authorisation decision.
- `scripts/security/check-proxy.mjs` (npm `security:check-proxy`, wired into CI) refuses a
  `middleware.{ts,js}` anywhere Next would once have found one, an export still named `middleware`,
  and a missing `config`. Behaviour is proved separately by `tests/e2e/studio-access.spec.ts`, which
  walks six real Studio paths — the script checks the convention, the spec checks the redirect.
- Every document naming the file is corrected, including the **unbuilt** plans in
  `PHASE-39-46.md` that put response headers and the `request_id` there. Leaving those would plant
  the trap rather than describe it: whoever implements Phase 41 reads the plan, creates
  `proxy.ts`, and ships headers that are never set. `docs/requirements/**` is the one
  exception — CLAUDE.md makes it read-only history, and it is superseded by this amendment, not
  edited.

The word "middleware" is corrected in prose too, not only in filenames. That is not tidying: Next
renamed the convention *because* the term makes people reach for Express semantics, and a codebase
that keeps saying "middleware redirects" sends the next reader looking for a `middleware.ts` that
must not exist. The two places the old word survives on purpose are amendment **A2·b** below, which
is a dated record of what was decided and when, and `docs/requirements/**`.

**2026-09-08 · A5 — three Phase 04 resolutions, each taking the safer reading of a conflict.**

The phase document and `DATA_MODEL.md` disagreed in ten places about RLS. Seven were wording and are
corrected in `DATA_MODEL.md` §1.8. Three changed behaviour and are recorded here, because each was
decided on security grounds rather than on which document was written first.

*A5·a — a join row is public only when EVERY parent it names is published.* The phase document
requires both parents on `product_collections` and `product_materials`; `DATA_MODEL.md` §6
generalised the single-parent `product_media` rule across all three. The generalisation leaks: a
`PUBLISHED` product joined to a `DRAFT` collection would expose that collection's existence and id
to anonymous visitors, which is exactly what an unannounced exhibition must not do. The stricter
reading wins. `product_media` stays single-parent deliberately — the asset is filtered by
`media_assets`' own policy when the join resolves — and `product_relations` stays source-only
because its target is polymorphic and RLS cannot join a table chosen at runtime.

*A5·b — only the service role writes `audit_logs`.* The phase document's revoke line
(`revoke update, delete`) left `insert` ambiguous; `DATA_MODEL.md` §1.5 already said "insert by
trigger or service role". Ambiguity resolved to service-role-only: an `authenticated` insert policy
would let any signed-in staff member forge entries in the security log, including entries
implicating someone else, or bury their own actions in noise. `lib/auth/audit.ts` is the sole
writer. `update` and `delete` are revoked at the privilege level rather than merely left without a
policy, because a policy can be added by anyone who can write a migration while a revoked privilege
must be granted back explicitly and visibly.

*A5·c — a policy may never gate on `auth.role()`.* PostgREST decides which PostgreSQL role a request
runs as by verifying the JWT and issuing `set local role <claim>`, so a policy's `TO anon` /
`TO authenticated` grantee list is anchored to something that was verified. An
`auth.role() = '…'` predicate reads the same claim through a channel the database itself does not
verify; locally the two can be made to disagree outright. `scripts/auth/check-rls.ts` rejects any
policy whose expression mentions `auth.role()`.

**Also settled here, because both were discovered rather than planned:**

- **`staff_profiles` self-UPDATE is NOT in Phase 04.** `DATA_MODEL.md` §4 says a staff member may
  update their own row, display name only. That is a column-level grant plus a policy, and there is
  no profile surface to use it before Phase 05. Deferred to the phase that builds one, rather than
  shipped as an unused grant (`DATA_MODEL.md` §1.7).
- **Migrations must name `extensions` in their `search_path`.** Not a Phase 04 decision but a Phase
  03 defect found while building it: hosted Supabase projects install `citext`, `unaccent` and
  `pg_trgm` into an `extensions` schema, where `create extension if not exists` is a no-op. Every
  migration therefore resolved those objects through a path that does not contain them, and the
  whole Phase 03 set failed at `0003` against a hosted layout. `npm run db:check-hosted-layout`
  is the standing gate.


**2026-09-08 · A4 — the free-tier operating constraint, and three Phase 03 tooling decisions.**

*A4·a — NOTHING IN THIS PROJECT MAY INCUR A CHARGE WITHOUT THE OWNER'S PRIOR APPROVAL.* The owner
has stated this for GitHub Actions specifically and it is recorded here as a general rule, because
it governs every paid surface the stack touches — Actions minutes, Supabase, Cloudinary, Vercel and
any service a later phase proposes adding. Concretely:

- Work within the free tier of every service in D1.
- Before doing anything that would exceed a free tier, **stop and ask**, with the estimated cost.
  Proceed only after the owner approves.
- Design for frugality by default. Where a choice exists between a cheaper and a more convenient
  arrangement, take the cheaper one and record why. The CI workflow follows this: the database
  gates run in the **same job** as everything else, because a second job would pay a second runner
  startup and a second `npm ci` to buy parallelism a three-minute run does not need.
- Adding a paid dependency requires its own amendment, not a default chosen during a phase.

*A4·b — `newsletter_subscribers` does NOT land in Phase 03. A3·b is corrected.* A3·b assigned the
table to Phase 03; Phase 03's own scope never included it, and `DATA_MODEL.md` §1.7 forbids
creating a production table before the feature that uses it — "an empty table is not preparation;
it is an unvalidated schema plus an unmaintained RLS surface." The table lands with the phase that
builds newsletter capture, alongside its RLS policies and its double opt-in flow. Nothing else in
A3·b changes, including the still-open blocker: **no email service provider exists in D1**, so the
confirmation email cannot ship until one is chosen by amendment.

*A4·c — generated database types come from `scripts/db/gen-types.mjs`, not the Supabase CLI.* The
CLI's `gen types` shells out to a Docker image even when handed `--db-url`, so it cannot run where
Docker is unavailable, and it would make the CI drift check depend on pulling a container image on
every run — which A4·a argues against on its own. The replacement introspects `pg_catalog` over an
ordinary PostgreSQL connection and emits the same `Database` shape `@supabase/supabase-js` is typed
against. It is deterministic by construction (every catalog query explicitly ordered, output run
through Prettier), which is what `npm run db:check-types` depends on. `lib/supabase/database.types.ts`
remains generated-only; hand edits are reverted by the next run and rejected in review.

*A4·d — the seed runner connects over `DATABASE_URL`, not through `@supabase/supabase-js`.* It is
an operations script in the same family as a migration, not application code: it needs one
transaction per module — a half-applied seed leaves rows whose stored hashes disagree with the
module, and every later run reads that as an owner edit and skips them — and PostgREST cannot give
it one. Application reads and writes still go through `lib/supabase/repositories/**`, and
`scripts/db/check-data-layer.mjs` still fails the build on any `.from(` outside that directory.


**2026-09-08 · A3 — two content decisions the owner has now made (supersedes SEED §25, §31).**

*A3·a — "Place Order" is renamed, not routed.* SEED §31 seeds a `Place Order` action label
while D1 forbids checkout. The owner's decision is to **drop the label entirely**. The action
is `Send an Enquiry`, and the WhatsApp handoff is `Discuss on WhatsApp`. Nothing in the product
may render a label implying a transaction it cannot complete — a visitor who reads "Place
Order" reasonably expects a cart, a price, a payment and a confirmation, and gets none of them.
Phase 09 seeds the two replacement labels and does **not** seed `Place Order` at all.

*A3·b — the newsletter IS in scope.* SEED §25 leaves it conditional; the owner has chosen to
build it. Consequences, recorded because they are not free:

- A new table, `newsletter_subscribers` (DATA_MODEL §Newsletter), lands in Phase 03.
- It stores **personal data**, which nothing else in this product does at rest — inquiries are
  handed to WhatsApp, not accumulated as a marketing list. India's DPDP Act 2023 therefore
  applies: consent must be free, specific, informed and withdrawable, and erasure honoured.
  Double opt-in is the design, so an address nobody confirmed is never mailable.
- **OPEN, and blocking the feature's completion: no email service provider is in D1.** The
  approved stack can collect an address and can never send to it. Adding one — Resend,
  Postmark, SES, Mailchimp — is a new production dependency and needs its own amendment with
  the owner's choice, not a default picked here. Until then Phase 09 builds capture, consent,
  confirmation and unsubscribe, and the confirmation email itself is the one piece that cannot
  ship.

**2026-09-07 · A2 — two paths the build cannot avoid (D2, D4).** The phase documents raised these
as proposals rather than taking them silently, which is the required procedure. Both are adopted.
*A2·a* — D2's `app/` tree enumerated route directories only and named no home for the token layer.
D1 rejects CSS-in-JS, so tokens must be a real stylesheet, and Studio and the public site share one
token set (FEAT §6), so it must sit above both route groups: `app/styles/`. Needed by Phase 02.
*A2·b* — middleware may only redirect; the redirect target must be an unauthenticated page inside
the Studio group, and D4 listed authenticated surfaces only. `/studio/login` is now listed. Needed
by Phase 04. The dev-only design-system gallery is deliberately **not** part of this amendment: it
lives under `app/(site)/design-system/**`, which D2 already covers, and calls `notFound()` in
production, so it adds no route to a production build and D3 is unchanged.

**2026-09-07 · A1 — asset ID allocation (D6).** The Higgsfield audit exposed two allocators
minting into one asset-ID namespace: the manifest generator numbering within a family, and the
media plan naming assets that do not exist yet. Three planned IDs had already collided with real
videos. D6 now fixes the gap-ID form and `scripts/media/check-asset-ids.py` enforces it.
