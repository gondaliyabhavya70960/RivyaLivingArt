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
/studio/media/{all,images,videos,models,documents,higgsfield,brand}
/studio/inquiries/{all,product,commission,consultation,quote}
/studio/research/{dashboard,sources,scrape,jobs,runs,changes,explorer,
                  large-format,compare,similarity,opportunities,shortlist,
                  confirmed,sheets}
/studio/operations/{workflows,data-quality,imports,exports,audit,logs}
/studio/system/{users,settings,integrations,environment,documentation,flags}
```

Navigation is role-aware; every page re-checks permission server-side.

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
are declared and explicitly unbuilt. This is an amendment rather than a silent scope cut because
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
