---
doc: CANONICAL-DECISIONS
status: CURRENT
owning_phase: 00
last_reviewed: 2026-09-12
owner_verification: NOT_REQUIRED
---

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
| HTML parsing | `node-html-parser`, behind `lib/scraper/adapters/parse.ts` and nowhere else (amendment A27) | jsdom in production, regex over markup, a headless browser |
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
  sheets/                    one-way Google Sheets export (amendment A37)
  ops/                       environment checks, the check runner, build information (amendment A39)
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
                  large-format,compare,similarity,opportunities,
                  opportunities/direction,shortlist,confirmed,sheets}
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
docs/PHASE_31_TO_46_IMPLEMENTATION.md · docs/ASSET_GENERATION_PROMPTS.md   (amendment A31)
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
`SCRAPER_USER_AGENT`, `REVALIDATE_SECRET`, `CRON_SECRET` (added by amendment A25 — see below),
`IP_HASH_SALT`, `RATE_LIMIT_SALT`, `CSP_ENFORCE` (added by amendment A41 — see below).

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

**2026-09-11 · A42 — Phase 44 deploys against ONE Supabase project, not two, by the owner's
decision; the production migrate workflow is the existing `db-migrate.yml` extended rather than a
second file; and the two deployment drills are recorded as NOT RUN rather than claimed (D1, D8,
DEPLOYMENT §1–§1.1, §7.0, §7.3, §11.1, §12, ENVIRONMENT §5.2, PHASE-39-46 §Phase 44).**

- **One Supabase project, and the consequence is stated rather than implied.** The phase document
  specifies `rivya-prod` and `rivya-staging`, with `check-env.ts` failing a preview whose project ref
  equals production's. The owner chose one project so the build adds no recurring cost. **A preview
  deployment therefore reads and writes production data**, and there is no technical stop — only
  deployment protection, the environment ribbon, and the habit of not exercising the enquiry form on
  a preview. `check-env.ts` reports that posture as a WARNING on every preview build rather than
  enforcing a comparison that would fail every time: a gate that always fails is a gate that gets
  deleted. DEPLOYMENT §1.1 lists what one project costs and exactly what a second would buy.
- **`migrate-staging.yml` does not exist**, because there is no staging database to push to. Saying
  so in the runbook is the point; a workflow file that pushed to production under a staging name
  would be worse than its absence.
- **The production migrate workflow is `db-migrate.yml`, extended.** It already did dispatch-only
  invocation, a typed project-ref confirmation and plan/apply. Phase 44 added a `pg_dump` snapshot
  before any apply (uploaded as a 30-day artefact — the lever the rollback table's data-corruption
  row depends on) and a GitHub Environment on the apply path only. Two workflows applying migrations
  to one project is how they drift until somebody runs the wrong one.
- **The approval gate is declared, not guaranteed.** GitHub protects an environment only once
  somebody configures a required reviewer on it; an unconfigured environment does not fail a run, it
  simply does not wait. DEPLOYMENT §12 lists creating `production-database` with a reviewer as an
  owner action rather than letting the workflow file imply a protection that is not there.
- **Neither deployment drill has been run, and no time is recorded.** The rollback drill needs a
  production deployment with a previous one to fall back to; the forward-fix drill, with one
  project, would apply a migration to the production database. Both procedures are written out and
  both are marked NOT RUN. A number nobody measured is worse than no number, because the first real
  incident is when somebody discovers the runbook was aspirational.
- **`scripts/docs/check-doc-contract.mjs` is created here, minimally.** Phase 01 named it, Phase 44
  needs it as preflight gate 5, and Phase 46 extends it with the D7 map and the claim vocabulary.
  Today it compares two sets in both directions: every name in `.env.example` must be documented in
  `ENVIRONMENT.md`, and every variable the product reads must be in `.env.example`. A gate that does
  not exist is a line in a table.
- **Ten of preflight's thirteen gates run today.** Gates 9 and 13 belong to Phases 42 and 46 and
  report SKIPPED naming the phase; gate 12 skips without `DATABASE_URL` and says to point it at a
  throwaway database. A preflight that reported twelve green gates as thirteen would be the exact
  failure the script exists to prevent.

**2026-09-11 · A41 — Phase 41 adds three server-only variables to D8, two of them secrets, and
records that the accessibility half of the phase ships its mechanisms without its proof (D8,
SECURITY §5, §7.3–§7.5, §8.1, §9.1, §10.1, ACCESSIBILITY §3.1–§3.3, ENVIRONMENT §5.1–§5.2,
DATA_MODEL §11.ah, PHASE-39-46 §Phase 41).**

- **`IP_HASH_SALT` and `RATE_LIMIT_SALT` are secrets, and there are two of them on purpose.** The
  bucket key became `hmac(salt, value)` rather than a salted hash: the IPv4 space is four billion
  values, so an unsalted digest of an address is the address. The two salts protect different things
  on different clocks — rotating the rate-limit salt costs one cleared window, while rotating the
  inquiry salt makes every stored `ip_hash` stop matching and a returning enquirer unrecognisable —
  so sharing a value between them would make the cheap rotation carry the expensive consequence.
  `salt()` keeps a fallback chain (`IP_HASH_SALT` → `RATE_LIMIT_SALT` → `SUPABASE_SERVICE_ROLE_KEY`
  → `'rivya'`) so a rename does not reset every live window on deploy; the last rung is public, and
  ENVIRONMENT §5.2 and `/studio/system/environment` both say so rather than letting it pass as
  configured.
- **`CSP_ENFORCE` is server-only but is NOT a secret.** It is a switch whose value is `1` or absent,
  and the Studio's Security section renders which header is in force. It is listed in D8 because
  every variable the server reads belongs in that list, not because knowing it helps an attacker —
  the policy itself is in every response.
- **The policy ships report-only and the flip is an owner act.** A content security policy that
  breaks the 3D viewer breaks it in production, on a device somebody is holding. Violations are
  posted to `/api/csp-report` and logged at `SECURITY` level, so the soak is readable in the Studio
  rather than in a vendor's dashboard. The default is report-only, which is the safe direction:
  forgetting the variable costs enforcement, not availability.
- **The byte validator refuses the ROW, not the upload, and the reason is architectural.** Uploads go
  from the browser straight to Cloudinary against a signature, so the server never holds the bytes.
  `saveUploadedAssetAction` fetches the first 4 kB of the stored original back, runs
  `validateUpload` against it with the reported length passed in separately, and on a refusal
  destroys the Cloudinary object and writes a `DENIED` audit row. Nothing in this product reads
  Cloudinary except through `media_assets`, so an object with no row is unreferenced storage.
- **EXIF stripping is NOT implemented and SECURITY §7 was corrected rather than left claiming it.**
  The fix is an incoming transformation on the visitor signature, and every signed parameter must
  also be sent by the browser byte for byte or Cloudinary rejects the upload — so it spans the
  provider and both uploaders and can only be verified against the real Cloudinary account. Shipping
  it blind risks breaking every upload in production to close a staff-only metadata leak. Recorded as
  outstanding, with the mechanism named, in SECURITY §7.5 and §15 row 8.
- **Erasure is owner-only by a role literal rather than a new permission.** A permission for a rule
  with exactly one holder would mean a migration, a generated policy file and a second place the rule
  could disagree with itself. `inquiries.export` gates the preview and the export; the erasure
  additionally checks the owner's own role inside the action, and writes a `DENIED` audit row when it
  refuses.
- **`media_assets.is_decorative` makes WCAG 1.1.1 expressible as one CHECK.** An asset has a usable
  text alternative, or it is explicitly marked decorative. There is no third state and no way to store
  a blank alternative by accident. `0391` is unused: `rate_limit_buckets` already shipped in `0182`
  under amendment A18, so the number is recorded as allocated-and-unused in DATA_MODEL §12 rather
  than filled with a migration that had nothing to do.
- **The accessibility half ships its mechanisms without its proof, by the owner's instruction.** Two
  offline guards, three route-specific skip links, the decorative flag, the alt-text quality rules and
  the Studio panel are built. The seven axe specs, `exceptions.json`, the alt-text coverage test and
  the `gitleaks` and `npm audit` workflows are Phase 42 work: the owner asked for all development
  across the remaining phases before any testing work. ACCESSIBILITY §3.2 states the gap on the page
  where somebody would otherwise read the sweep as done.

**2026-09-11 · A39 — Phase 38 adds `lib/ops/` to D2's domain list beside `lib/sheets/` (closing
open question 4 in full); build information travels as a string `next.config.ts` inlines rather
than a generated module; the documentation index is a `prebuild` artefact traced into the
deployment; the dedupe window is a defaulted epoch-minute column; the retention cron uses
`CRON_SECRET`; `/studio/operations/workflows` is filled from `workflow_runs_v`; the environment
page's two database reads live in a repository and the admin client gains an injectable `fetch`
(D2, D8, DATA_MODEL §11.ae, STUDIO_GUIDE §13.1–13.11, ENVIRONMENT §7, SECURITY §5.2 and §10,
DEPLOYMENT §3.1, PHASE-31-38 §Phase 38).**

- **`lib/ops/` is a D2 domain.** An environment check is not a log: it performs outbound
  reachability probes, holds timeouts and returns a status shape the logger merely records. It holds
  `env-checks/` (one module per check), `environment.ts` (the runner) and `build-info.ts` (the
  reader). `lib/cms/docs/` sits inside `lib/cms/` because rendering authored Markdown into a Studio
  page is what `lib/cms` does. The block therefore added exactly two `lib/` domains — `lib/sheets/`
  (A37) and `lib/ops/` — as the phase document proposed.
- **Build information is inlined, not generated.** The phase document's
  `lib/ops/build-info.generated.ts` (gitignored) cannot exist before the build and the type-checker
  runs first in CI; a placeholder committed beside it would be a second source of truth.
  `scripts/build/build-info.mjs` computes commit, branch, build time, environment and the migration
  files on disk (git first, Vercel's variables second, `unknown` last, never throwing);
  `next.config.ts` inlines the JSON as `RIVYA_BUILD_INFO`; `lib/ops/build-info.ts` parses it at
  request time. Nothing runs git on a request and no variable value travels.
- **The documentation index is a `prebuild` artefact.** `npm run docs:index` writes
  `content/docs/index.generated.json` (gitignored) from the ten allowlisted paths, redacted;
  `outputFileTracingIncludes` carries it — and the Higgsfield manifest the environment page counts —
  into the serverless bundle, so the production runtime reads no `docs/` directory. A dev server
  started without the step sees an honest "index not built" state.
- **`first_minute` is a defaulted integer column, not a generated one.** The document's
  `unique (dedupe_key, date_trunc('minute', first_occurred_at))` cannot be built: every date function
  over `timestamptz` is STABLE and a unique expression or generated column needs IMMUTABLE. The
  writer function sets `first_minute` from the same `now()` as `first_occurred_at`, no session can
  insert a row at all, and `on conflict (dedupe_key, first_minute)` gives the concurrent-first-write
  guarantee the document wanted. The five-minute dedupe is the function's own lookup.
- **`CRON_SECRET`** for `/api/cron/log-retention` (A25); DEPLOYMENT §3.1's row is corrected. The
  purge covers `system_logs`; Phases 40 and 41 extend the same tick to their tables.
- **The workflows page is Phase 38's.** DATA_MODEL §12 allocates `workflow_runs_v` to `0360` and
  STUDIO_GUIDE §13.1 describes the page; both are built here so `workflow_run_id` filters have a
  list to start from. `security_invoker` means a reader sees only the runs their role may read.
- **Repository discipline held.** The `select 1` ping and the ledger read are
  `lib/supabase/repositories/ops.ts`; `createAdminClient()` accepts an optional `fetch` so the checks
  can be run against a stubbed, echoing network in the sentinel test without a network of their own.
- **`request_id`** exists on both logs and is filterable; `proxy.ts` assigning one per request lands
  with Phase 41's security headers (SECURITY §10 corrected).


**2026-09-11 · A40 — Phase 39 delivers the SEO system with five readings the repository forced:
`seo.write` is checked in every Server Action while the shipped `0051` policy on `seo_entries`
keeps the name `content.write` (the same three roles — a generated policy file is never
re-opened); the sitemap index and its six children are route handlers (`app/sitemap.xml/route.ts`,
`app/sitemaps/[file]/route.ts`) because the metadata-file convention cannot write a
`<sitemapindex>`; `X-Robots-Tag` by route class is declared in `next.config.ts` `headers()` rather
than `proxy.ts` (A2·b keeps the proxy to two jobs, and a whole-deployment header from there would
widen its matcher to every path); a redirect stored as 301 is served as 308 by
`permanentRedirect`, the column recording the owner's choice; and a redirect is offered on slug
change for products only, because the collection, project and article editors do not change a
slug after creation (D3, D4, D8, DATA_MODEL §11.af, STUDIO_GUIDE §9.4, ARCHITECTURE, CONTENT_GUIDE
§10, PHASE-39-46 §Phase 39).**

- **The ladder is per field.** ENTITY → PATH → DERIVED → GLOBAL, climbed once per field, so a path
  row with a title and no description lends its title and lets the description fall through. An
  entity's own SEO columns (`products.seo_title`) sit inside the ENTITY rung, below its
  `seo_entries` row.
- **A category page is one address.** `/collection/<slug>` is a `pages` row and a `categories`
  row; the Studio and the coverage report resolve them as one row under Pages, with the category's
  own columns as its ENTITY rung, and categories do not appear again under Entities.
- **The keyword table has no number.** `seo_keyword_themes` carries status, path, notes and an
  evidence link; `research_status` is the one `research_` identifier the two isolation gates
  exempt, because it records the owner's progress on a keyword and nothing about a competitor.
- **`KEYWORD_STATUSES`, not `RESEARCH_STATUSES`.** The schema module sits on the public search
  path (the redirect resolver imports it), and the search-scope gate refuses a `RESEARCH_`
  identifier there; the constant is named for what it is.
- **One emitter.** `components/patterns/JsonLd` is the only file that writes a structured-data
  script element; `scripts/seo/check-jsonld-scope.mjs` exempts `lib/scraper/**`, which reads a
  competitor's page and never renders a byte to a visitor.

**2026-09-11 · A38 — Phase 37: the policy generator gains a `selectScope` predicate (a row-level
narrowing of the staff SELECT alone); `advanced_analytics` gates presentation, never access; the
analytics cron authenticates with `CRON_SECRET`; the dashboard card registry is raised to Phase 36
with a query per card; and four repository-forced readings of the phase document are recorded (D2,
D8, DATA_MODEL §11.ad, STUDIO_GUIDE §5.3–5.4, PERFORMANCE §7.5, DEPLOYMENT §3.1, PHASE-31-38
§Phase 37).**

- **`selectScope`.** The phase document asks that a COMPETITIVE snapshot row require `research.read`
  on top of `analytics.read`, "enforced by a policy predicate rather than filtered in application
  code". The generator had `ownerScope` (ANDed into every policy, for rows that belong to a person)
  and `extraSelectPolicy` (an additional, widening SELECT). Neither is a narrowing of the read by a
  column, so `TablePolicy.selectScope` is added: a clause ANDed into the staff SELECT only, its role
  list derived from `rolesWithPermission('research.read')` so it cannot drift. Every earlier
  generated file re-renders byte-identically; `check-rls.ts` reads the union of roles in the
  expression and still holds the read list to the matrix.
- **The flag is not the access control.** `advanced_analytics` shows or hides the market section
  and the trend lines. Off, an editor and a researcher both see eight tiles; on, the researcher sees
  eighteen and the editor still eight, because the policy — not the page — decides what a request
  returns. Verified by `tests/unit/rls/phase37.test.ts` with a direct query as `editor`.
- **`CRON_SECRET`** for `/api/cron/analytics-snapshot` (A25); DEPLOYMENT §3.1's row is corrected.
  It runs at 03:45 UTC, after the 02:30 research analytics and 03:15 opportunity jobs, so the
  competitive metrics read tonight's snapshots.
- **The cards.** `BUILT_THROUGH_PHASE` in `lib/analytics/dashboard-cards.ts` rises from 5 to 36 and
  every card whose table exists gets one explicit head-count under the signed-in session. The Data
  Quality card counts the research half (`severity = 'ERROR'`, not dismissed); the catalogue half is
  computed per product on its editor and is not summed on every dashboard load. System Health (38)
  and Missing Media (43) stay unavailable and say so.
- **Four readings.** (1) `product_scale`: the phase table says "needs ≥ 5 products with
  dimensions"; verification 7 publishes three and expects availability. The table is normative and
  wins; three products render `UNAVAILABLE: fewer than 5 products with dimensions (3 recorded)`,
  which is legible and honest. (2) `customization`: a source can be configured to extract the key
  (Phase 26) and the adapter can read it (Phase 27), but Phase 28's normaliser maps dimensions,
  materials, availability, lead time and variants — no column carries customisation, so the metric
  reports exactly that rather than a share over nothing. (3) The no-fabrication suite runs the
  registry against an in-memory empty implementation of `AnalyticsReads` — the one interface every
  metric computes from — rather than an empty PostgreSQL, which the snapshot writer cannot reach
  from the RLS harness; the database's own invariant is tested separately by the RLS suite. (4) The
  tab reads the eighteen definition sentences from the modules and the guide prints the same
  sentences; a unit test holds them equal.

**2026-09-11 · A37 — Phase 36 adds `lib/sheets/` to D2's domain list (open question 4, the
`lib/ops/` half deferred to Phase 38); the Sheets cron authenticates with `CRON_SECRET`; `0342`
seeds the seven default export definitions as structure; the integration is one-way by
construction and a build gate proves it (D2, D8, DATA_MODEL §11.ac and §12, STUDIO_GUIDE §12.14,
ENVIRONMENT §4, DEPLOYMENT §3.1, PHASE-31-38 §Phase 36).**

- **`lib/sheets/` is a D2 domain.** D2's `lib/` tree named no home for a third-party integration
  that is neither `media/` nor `scraper/`. `lib/sheets/` holds the client (service-account JWT
  minted with `node:crypto`, `spreadsheets` scope only, `import 'server-only'` first line), the
  atomic writer, the retry policy, the schedule matcher, the column allowlists and the run engine.
  The phase document raised this as open question 4 together with Phase 38's `lib/ops/`; that
  half is recorded when Phase 38 lands.
- **One-way, enforced.** No code under `lib/sheets/` reads cell values back; the one GET is of
  sheet ids and titles for the atomic swap. `scripts/sheets/check-no-read.mjs` fails the build on
  `values.get`, `batchGet`, grid data or a `/values/` GET (`npm run sheets:check-no-read`, in
  `check` and CI), proved to refuse by `tests/unit/sheets-no-read.test.ts`.
- **`CRON_SECRET`** for `app/api/cron/sheets-sync`, as A25 settled for every scheduled route; the
  phase document's `REVALIDATE_SECRET` is superseded. DEPLOYMENT §3.1's row is corrected.
- **`0342` is structure, not content.** The seven definitions name an entity, its default
  columns and a tab — the shape of an export — all `MANUAL`, all `includes_pii = false`, inert
  while `google_sheets` is off. Under the `allow-insert` marker with that reason, as `0302` was.
- **The secret never becomes data.** No table carries a credential column; `spreadsheet_id` and
  the service-account email are identifiers and are displayed; `sheets_sync_runs.error_code` is a
  CHECKed vocabulary and never a response body. `tests/unit/sheets-redaction.test.ts` injects a
  generated key and searches every surface for a fragment of it.
- **Two isolation guards, read rather than bent.** I4 holds that no module imports both the
  direction repository and a catalogue repository; the row builders are therefore five modules by
  import (`lib/sheets/builders/`), the category read in `research.ts`, the direction read in
  `direction.ts`, and the index importing neither. The no-auto-import guard, which matches
  first-party write symbols under the research routes, exempts `repositories/sheets`: an export
  definition is integration configuration, its repository touches no product, media or CMS table,
  and two fixture cases prove a catalogue write imported beside it is still refused.
- **`0341` is the generated policy file**, one past the document's `0340`, for A23's reason.

**2026-09-11 · A36 (proposed; the owner's instruction is the authority) — AI-generated product
imagery is a concept visualisation, registered as one and labelled as one; the demo catalogue grows
to thirty-five pieces and carries a prompt for each (D6, D10, DEMO_CONTENT, ASSET_GENERATION_PROMPTS,
PHASE_31_TO_46_IMPLEMENTATION §Phase 35b).**

- **The instruction.** The owner asked for around thirty placeholder products that suit the studio,
  with a ChatGPT prompt for each so the images can be made after launch, on the understanding that
  a piece that does not look right will be changed or removed — and that the same applies to every
  placeholder the sessions wrote (testimonials, products, articles, portfolio, FAQ).
- **What it does not suspend.** D10 and CLAUDE.md still forbid a fabricated business fact: the
  thirty-five demo products carry no price, dimension, material, lead time or claim
  (`tests/unit/demo-content.test.ts`); portfolio projects and testimonials stay DRAFT behind the
  evidence gates and are not in the prompt book; FAQ answers stay `OWNER_VERIFICATION_REQUIRED`.
- **The transparency rule, so the imagery stays honest under D6 and D10.** A generated product
  image is registered `is_ai_generated = true, is_concept = true`. Today `products_reject_concept_hero`
  (migration `0122`) refuses a concept asset on a product, and that stands until Phase 43 amends it
  (`0411`) so that a concept asset may be bound to a product ONLY when the product page and card
  render the seeded "concept visualisation" label from `global_content` — never presented as a
  photograph. Until then the prompt book records the images as `WAITING_FOR_UPLOAD` and the cards
  keep the seeded SEED §47 unavailable state.
- **Coverage under D6.** The prompt book asks for nothing the library already supplies: category
  heroes and journal covers are bound from the 250 manifest assets, and the Phase 43 gap briefs
  (G1–G12) keep their place in HIGGSFIELD_MASTER_ASSET_PLAN §6. What it asks for is what no
  library asset may supply — a product image — as a concept visualisation of each demo piece.
- **The intake path** is Phase 43's `scripts/media/register-external-asset.ts`: the owner pastes a
  Cloudinary URL into the prompt book entry, the script validates the URL belongs to the project
  cloud, registers the `media_assets` row with the planned ID and the two flags, and binds the slot.
- **Planned IDs** use the `<PAGE>-<SECTION>-<NNN>` form (`PRODUCT-HERO-001`, `PRODUCT-SCENE-001`),
  never a manifest family prefix; `scripts/media/check-asset-ids.py` scans the book with every
  other document. One new Cloudinary folder, `rivya/collection/collectible-design`, joins the
  allowlist when the first collectible image is registered (Phase 43).

**2026-09-11 · A35 (proposed; inert until the owner enables the flag) — Phase 35 narrows
invariant I4 to "no automatic and no field-copying path" with one named carve-out, the
hand-operated bridge `startProductFromConfirmation`; alters no enum and corrects DATA_MODEL §12's
row for the phase; `0331` is its generated policy file (D5, DATA_MODEL §11.ab and §12, SCRAPER §26,
BUSINESS_RULES BR-F2, PHASE-31-38 §Phase 35 open question 11).**

- **The carve-out, exactly.** I4 as literally written ("no code path writes `products` from a
  `research_*` read") would fail the bridge the phase document specifies, and asserting compliance
  would be a lie. The narrowed rule: no AUTOMATIC and no FIELD-COPYING path from research to the
  catalogue, with ONE carve-out — the symbol `startProductFromConfirmation`, defined in
  `app/(studio)/studio/(shell)/research/confirmed/actions.ts` and nowhere else, reading
  `getConfirmationForBridge(id) → { id, stage, archived_at }` and the two claim writers
  `markProductStarted` / `releaseProductStart`, and inserting exactly `slug`, `title` (the slug's
  title case), `category_id`, `status = 'DRAFT'`, `price_state = 'PRICE_ON_REQUEST'`. The guard is
  the specification: `scripts/research/bridge-isolation.mjs` under `check-research-isolation.mjs`
  fails the build on a second writer, a moved symbol or a wider projection, and
  `check-no-autoimport.mjs` admits `insertProduct` in that file only.
- **Proposed, not accepted.** The owner has not accepted the narrowing explicitly. The bridge
  therefore ships behind `research_product_bridge = false`; `/studio/research/confirmed` renders
  the button disabled with the reason, a direct POST is refused with the flag reason, and Phase 35
  is reported COMPLETE-WITH-FLAG-OFF. Enabling the flag is the acceptance.
- **No enum change.** DATA_MODEL §12's row for Phase 35 said `research_stage += ARCHIVED_DECISION`
  and a `research_pipeline_transitions` table; the phase document says archival is a column on
  the decision record and there is no second transition log, and the phase document wins. The row
  is corrected to `0330`–`0331`, no enum change, no second log.
- **The flag the trigger checks is carried by one function.** `guard_research_stage_writer()` is
  verbatim from the phase document; because PostgREST gives the repository no transaction of its
  own, `research_write_stage()` (SECURITY DEFINER, service role only) sets the transaction-local
  flag and writes in one call. `stage.ts` stays the only writer; the trigger enforces it at a
  second layer, as the document asks, and defines no transitions.
- **`0331` is the generated policy file**, one past the document's `0330`, for A23's reason.

**2026-09-11 · A34 — Phase 34 files a brief under a checked category slug and adds no third
research→public reference (open question 13); `0321` is its generated policy file; approval is a
trigger-held permission; direction briefs are a nested segment of the `opportunities` leaf (D4,
D5, DATA_MODEL §11.aa, SCRAPER §25, PHASE-31-38 §Phase 34).**

- **Two references is final.** `research_direction_briefs.target_category_slug` is `text`,
  CHECKed to D3's seven slugs, and resolved by the direction repository when a screen needs a
  category row. `check-research-isolation.mjs` keeps its two-name I1 allowlist; a real
  `references categories(id)` would fail the build, and the phase document says the slug is the
  pattern for everything after. DATA_MODEL §11's earlier row (`target_category_id uuid references
  categories(id)`) is superseded by §11.aa.
- **`0321` is the generated policy file**, one past the document's `0320`, for A23's reason.
- **Approval is held by a trigger, not a hand-written policy.** The generator writes one
  predicate per leg, so the narrower rule — entering APPROVED requires
  `research.direction.approve` (owner, admin, merchandiser) — lives in
  `guard_direction_brief_approval()`, fired on insert and update; the action checks and audits
  first. `research.direction.write` (owner, admin, merchandiser, researcher) and
  `research.direction.approve` join the Phase 04 matrix as the document proposes.
- **The list is a leaf of its own, and D4's research leaf set gains it.** The phase document
  mounts briefs as a nested segment of `opportunities`; the Studio manifest test governs every
  static route and refuses a static child of a static leaf that the manifest does not name, so
  `/studio/research/opportunities/direction` is a research leaf (`research.read`;
  `research.direction.write` to act) labelled *Direction briefs*, and the `[briefId]` editor is
  governed through it. The phase document's own open question anticipated this reading.
- **The revisions table is the brief's own**, written by `write_direction_brief_revision()` after
  Phase 08's `write_revision()` pattern rather than through `content_revisions`, whose
  `entity_type` allowlist names public content and should not learn a research entity.
- **The direction ↔ products import barrier is a build gate** (`direction-isolation.mjs`, under
  I4), proved to fail on a fixture; BR-F6 states the rule.

**2026-09-11 · A33 — Competitor images are referenced by URL only and never fetched: the owner's
decision on Phase 33's fetch-to-hash amendment (open question 12), and what it leaves built (D5,
D6, PHASE-31-38 §Phase 33, SCRAPER §24, DATA_MODEL §11.z).**

- **The decision.** PHASE-31-38 §Phase 33 proposed narrowing PHASE-23-30's rule — "no image is
  fetched, measured by download, cached" — so each `research_products.image_urls` entry could be
  fetched once through the politeness path, hashed and discarded. Asked directly, the owner chose
  the rule as written. No code path in the repository fetches a competitor's image bytes;
  `research_image_hashing` and `research_sources.image_hashing_enabled` exist, are false, and are
  read by nothing that could start a fetch. `advanced_similarity` (embeddings) is not built for the
  same reason: there are no bytes to embed.
- **The schema stays level with the phase document.** `0310` creates `research_image_hashes`, the
  runs, the pairs and the suppressions exactly as DATA_MODEL §12 allocates them; they hold no rows.
  `0312` (`research_image_embeddings`, `pgvector`) is NOT applied; the number stays allocated and
  unused. `0313` is the generated policy file, one past the document's `0310`–`0312` block, for
  A23's reason.
- **The first-party half ships live**, and it is the half the phase document calls "the same
  machinery turned inward": `media_asset_hashes` (`0311`, in its own file so a reviewer can see it
  is not research schema), `lib/media/hashes.ts` as the only module that may import an image
  decoder (a new build gate, `media:check-decoder`), the upload guard before the `media_assets`
  insert, `npm run media:hash` with a dispatch-only workflow because the development container
  cannot reach Cloudinary, and the library self-check on `/studio/research/similarity`.
- **`research.similarity.run` (owner, admin, researcher)** joins the Phase 04 matrix as the
  document proposes; a run is an operator's act and a suppression is a `research.write` judgement.
- **Blocking uses seven segments, not the document's 16-bit prefix**, because the prefix cannot meet
  the recall the same document requires (SCRAPER §24.4); the DDL keeps the named index.
- **The upload guard's reads run under the service role.** An editor's session cannot see the
  research table, and a guard that could only see what the uploader may read would let a
  competitor's photograph past exactly the person most likely to upload one. It is the one admin
  use in `media/actions.ts`, on the ESLint allowlist with that reason.
- **Should the owner ever accept the fetch-to-hash amendment**, the tables, the flag, the per-source
  gate, the run-count columns and the pair constraints are already in place; what would be added
  is `hash-run.ts` behind the four gates, and this amendment would be superseded.

**2026-09-11 · A32 — Phase 32 takes migration `0301` for its generated policies, seeds model v1 with
a nullable author, adds `research.score.manage`, and the rank-movement diff re-weights stored
components rather than rescanning the corpus (D5, PHASE-31-38 §Phase 32, DATA_MODEL §12, SCRAPER §23).**

- **`0301` is the generated policy file, one past the document's `0300`** — the tenth time, for
  A23's reason. `0302` seeds v1 as a DRAFT under `allow-insert`: configuration a human activates,
  not content, so `research_scoring_models.created_by` is nullable where the phase document writes
  it as attributed. A seeded row has no author, and inventing one would be the fabricated fact.
- **`research.score.manage` (owner, admin)** joins the Phase 04 matrix and the `PHASE-00-04.md`
  table, exactly as the block's permission table proposes. Recomputing scores under the active
  model stays `research.write`: operating the pipeline is not changing what it measures.
- **Scores and components take no session write policy of any kind** — the same posture as Phase
  31's snapshots, recorded so `auth:check-rls` fails if a later phase grants one.
- **The model diff re-weights stored components.** The normalisation rules live in code and are the
  same for every version; a version differs only in weights and its confidence floor, so "how many
  rows would move by more than ten places" is answerable from the active model's stored components
  without a scan, and that is exactly what activating the draft would do to the ranking.
- **A DRAFT can be dry-run and never stored.** A stored score must point at a model that cannot
  change under it; `scoreScope` refuses to store under a DRAFT and the CLI says why.
- **The cron uses `CRON_SECRET`** (A25, A31) and answers `200 skipped: no_active_model` rather than
  failing every night until a human has made the activation decision.

**2026-09-11 · A31 — Phase 31 takes migration `0291` for its generated policies and `0292` for its
indexes, two documentation paths the owner asked for join D7, the chart patterns follow the
registry's directory-per-pattern rule rather than the phase document's `charts/` folder, and every
new cron route authenticates with `CRON_SECRET` (D7, D8, PHASE-31-38 §Phase 31, DATA_MODEL §12,
SCRAPER §22).**

- **`0291` is the phase's generated policy file, one past the document's `0290`.** The ninth time,
  for the reason A23 gives for `0214` and every phase since: a generated policy file is rewritten
  whole by `auth:gen-policies` and cannot also carry the DDL that creates its tables. `0292` holds
  the indexes, which the phase document names as a deliverable of their own.
- **Two paths join D7 at the owner's instruction:** `docs/PHASE_31_TO_46_IMPLEMENTATION.md` (the
  per-phase implementation record for this block, with the field set the owner specified) and
  `docs/ASSET_GENERATION_PROMPTS.md` (every asset a phase needs and cannot make from the manifest,
  as a generation prompt the owner runs and a Cloudinary URL the owner pastes back). D7's map is
  otherwise unchanged and `PHASE-39-46.md`'s "no new documentation paths" rule applies to every
  other document.
- **The four chart components live at `components/patterns/{BarSeries,BandStrip,Scatter,Sparkline}/index.tsx`**,
  not under a `components/patterns/charts/` folder as the phase document writes. The registry gate
  resolves a BUILT pattern at `components/patterns/<Name>/index.tsx` and nowhere else, and the
  gate is the contract; the shared frame they compose sits at `components/patterns/charts/shared.tsx`
  because it is not a component of its own. Studio components are indexed `PLANNED · index only`,
  which is the registry's standing convention for `components/studio/**` — the gate does not
  path-check that directory and `StudioPage` has carried that state since Phase 05.
- **`app/api/cron/research-analytics` authenticates with `CRON_SECRET`**, as A25 settled for every
  scheduled route, where the phase document names `REVALIDATE_SECRET`. This answers PHASE-31-38's
  open question 5 for the whole block: the remaining cron routes (32, 36, 37, 38) take the same
  secret, and D8 needs no new name.
- **Snapshots and coverage take no session write policy of any kind.** The phase document says so
  in prose; this records it as the posture `lib/auth/table-permissions.ts` encodes (no
  `writePermission`), so `auth:check-rls` fails the build if a later phase grants one. A snapshot a
  session could insert is a market figure nobody computed.
- **`scope_id` carries no foreign key**, because one column that names a set, a source or a
  category cannot reference three tables; the cascade a SET scope needs is
  `tg_research_comparison_set_prune_snapshots()`, SECURITY DEFINER because sessions may not delete
  a snapshot. A `CHECK` may not contain a subquery (0260 learned this twice), so the ascending-edges
  rule is `is_strictly_ascending_bigint_array()`, IMMUTABLE.

**2026-09-11 · A30 — the three-valued verdict is about the MEASUREMENT and not the band, Phase 30
takes migration `0281`, `research_saved_views` is the first owner-scoped research table, the scale
rule editor sits with the other parsing configuration rather than on the settings page, and I3 bans
the scale IDENTIFIERS rather than the words (PHASE-23-30 §Phase 30, DATA_MODEL §12, SCRAPER.md §21).**

Five readings the repository forced, and the first is a defect this phase found in its own first
draft.

- **`is_large_format is null` MEANS "WE HAVE NO MEASUREMENT", NOT "WE COULD NOT PLACE IT".** The
  three-valued column is the phase's central decision, and the first implementation tied the null
  verdict to `scale_band = 'UNKNOWN'` — both in the classifier and in a CHECK constraint. The phase
  document's own four verification rows caught it: a well-measured 1 150 mm piece whose proportions
  match no band signature is banded `UNKNOWN`, and its SIZE is perfectly well known. Refusing it a
  verdict would have moved a confident answer into the bucket reserved for unanswerable ones —
  precisely the dishonesty the three-valued column exists to prevent, and it would have inflated the
  unknown count on every panel. What ships is
  `research_products_unmeasured_has_no_verdict`: `longest_axis_mm is null` implies
  `is_large_format is null`, and nothing else does.
- **`0281` is the phase's generated policy file, one past the document's `0280`.** The eighth time,
  for the eighth time the same mechanical reason: `auth:gen-policies` rewrites a policy file whole,
  and `db:migrate` refuses a migration edited after it was applied. A23 `0214`, A24 `0221`, A25
  `0233`, A26 `0241`, A27 `0251`, A28 `0261`, A29 `0271`, A30 `0281`.
- **`research_saved_views` IS THE FIRST RESEARCH TABLE WITH AN `ownerScope`, AND ITS SHARED LEG IS A
  SECOND SELECT POLICY.** Five of the six roles hold `research.read`, so the scope — not the
  permission — is what stops a viewer rewriting a merchandiser's views; the same shape
  `staff_preferences` uses. Sharing is expressed as an additional SELECT policy rather than by
  widening that scope, because sharing widens who may READ one row and must not widen who may edit
  it: a view somebody else can edit is a view whose results change under the person who linked to
  it. No admin client touches this table anywhere in the codebase, because one would bypass exactly
  the check that carries the security.
- **THE SCALE RULE EDITOR IS ON `/studio/operations/data-quality`, NOT `/studio/system/settings`.**
  The phase document places it on the settings page, which is gated on `system.settings.write` —
  held only by an owner and an admin. A scale rule is `research.write`, and a researcher is exactly
  who notices that a threshold is banding a corpus wrongly. Following the document would have put
  the control behind a permission its user does not have, which makes the "tune it without a deploy"
  design decorative. It now sits beside the Phase 28 material lexicon and the Phase 29 change
  thresholds: three editors, one permission, one screen. A29 records the same reading for the change
  thresholds.
- **I3 BANS THE SCALE IDENTIFIERS, NOT THE WORDS.** The phase document asks that any band token fail
  the isolation guard in `app/(site)/**` or `content/**`. Taken literally that bans "dining",
  "console" and "monumental" from a furniture maker's own website, which is absurd and is the kind
  of rule people work around rather than obey. What ships bans `scale_band`, `scaleBand`,
  `large_format_source` and `largeFormatSource` — the research identifiers, which mean something
  specific about a competitor's page. **`is_large_format` is deliberately NOT banned**:
  `products.is_large_format` is a first-party column the public Large Format experience reads, and
  banning the name would break the page whose vocabulary this phase borrowed. The two are different
  columns in different worlds, and the I1 leg is what proves nothing joins them.

**2026-09-11 · A29 — Phase 29 takes migration `0271`, a unique constraint over a nullable scope
column needs `nulls not distinct`, the decision cache on a change row is declared as a cache, and
the three "field" vocabularies are reconciled at eleven (PHASE-23-30 §Phase 29, DATA_MODEL §12,
SCRAPER.md §20).**

Four readings the repository forced.

- **`0271` is the phase's generated policy file, one past the document's `0270`.** The seventh time
  this has been necessary and for the seventh time the same mechanical reason: `auth:gen-policies`
  rewrites a policy file whole on every run, and `db:migrate` refuses a migration edited after it
  was applied, so the generated file cannot also carry the DDL that creates its tables. A23 `0214`,
  A24 `0221`, A25 `0233`, A26 `0241`, A27 `0251`, A28 `0261`, and now A29 `0271`.
- **`unique (source_id, field)` DOES NOT MAKE THE GLOBAL DEFAULT UNIQUE, because null is not equal
  to null.** `research_change_rules` uses `source_id is null` to mean "the default", which is the
  honest encoding — the alternative is a sentinel uuid that must then exist in `research_sources`.
  But PostgreSQL's default unique semantics are `nulls distinct`, so the phase document's
  `unique (source_id, field)` would permit any number of default rows for `price`, and the
  threshold in effect would be whichever row the resolver read first. What ships is
  `unique nulls not distinct (source_id, field)` (PostgreSQL 15+; local 16, hosted 17). This is the
  same family as A28's `array_length` reading: a constraint that looks watertight and admits
  exactly what it was written to refuse.
- **`research_changes.decided_action` IS A CACHE OF THE APPEND-ONLY ACTION LOG, and is declared as
  one.** The phase document lists the three decision columns on the change row and the
  `research_review_actions` table separately, without saying which is authoritative. They cannot
  both be: a decision that can be reversed, and whose reversal is a new row, has its truth in the
  log. So the log is written FIRST and the change row is stamped second, in that order, and the
  order is the design — a crash between the two leaves an audited decision the queue still shows as
  undecided, which is the safe direction. The reverse would hide a decision nobody can account for.
  Nothing but `lib/scraper/workflows/review-actions.ts` writes either.
- **ELEVEN FIELDS, AND THE THREE VOCABULARIES THAT NAME THEM NOW AGREE.** FEAT §24 lists the fields
  that may change, `NORMALIZED_FIELDS` in `lib/scraper/normalization/schema.ts` lists the ones that
  carry a parse state, and `DRAFT_FIELDS` lists what an adapter reads. They are three different
  lists for three different purposes and they overlap only partly — `description`, `customization`
  and `sku` are read and stored but never normalised, so they are diffed from the version's `raw`
  rather than from its `normalized`. `CHANGE_FIELDS` in `lib/scraper/analytics/materiality.ts` is
  the fourth and final list, it is the one `research_change_rules.field` is constrained to, and its
  eleven entries are the phase document's own materiality table. A field diffed with no rule row is
  a classification nobody chose, so the constraint refuses the name outright.

**2026-09-11 · A28 — the second and final research → public foreign key lands, a CHECK constraint
cannot hold the subquery the phase document's SQL uses (twice), `AMBIGUOUS` stores nothing, an
unlabelled triple is read positionally, and the *Scraped Products* provider is a table row rather
than a file (PHASE-23-30 §Phase 28, SCRAPER.md §19, DATA_MODEL §12).**

Six readings the repository forced. Two are defects this phase found in its own code and one is a
defect in the phase document's illustrative SQL; all three are recorded as decisions rather than as
fixes nobody would notice.

- **`research_products.matched_category_id` is the SECOND AND FINAL allowlisted crossing, and the
  allowlist is now closed.** A26 admitted the first — `research_source_category_map.category_id`,
  a label a researcher typed mapped to one of Rivya's categories. This is the same kind of pointer
  reached the same way: through that staff-authored map, or through a keyword rule that matches a
  category's own name exactly and records `match_method = 'KEYWORD'` with a confidence of 0.6 so the
  screen can show it as the weaker claim it is. It points at TAXONOMY and never at `products`, it is
  `on delete set null` so removing a category unmatches rather than deletes, and nothing writes it
  from what a page said on its own. `scripts/research/check-research-isolation.mjs` now names
  exactly two constraints and fails on a third; four test suites assert the same set against the
  database. **There is never a third**, and a phase that wants one is a phase that must amend this
  file first.
- **A CHECK CONSTRAINT MAY NOT CONTAIN A SUBQUERY, and the phase document's SQL does — twice.**
  `research_dimensions_sane` is written in PHASE-23-30 as `not exists (select 1 from
  jsonb_each(dimensions_mm) kv where ...)`, which PostgreSQL refuses outright with `cannot use
  subquery in check constraint`. Walking a jsonb object or a text array needs `jsonb_each` or
  `unnest`, and both are subqueries. So `0260` declares two IMMUTABLE functions —
  `is_sane_research_dimensions(jsonb)` and `has_no_blank_pattern(text[])` — and the constraints call
  them, exactly as `0130` did with `is_valid_dimensions`. The illustrative SQL in the phase document
  is not applicable as written and this is the shape that ships.
- **`array_length` ON AN EMPTY ARRAY IS NULL, AND A CHECK THAT EVALUATES TO NULL PASSES.**
  `research_material_lexicon_has_patterns` was written `array_length(patterns, 1) >= 1` and admitted
  exactly the row it was written to refuse: a lexicon term with no patterns at all, which matches
  nothing while looking perfectly configured in the Studio editor. Found by `tests/unit/rls/
  phase28.test.ts` asserting the refusal rather than assuming it. It reads `cardinality(patterns) >=
  1` now. The neighbouring `has_no_blank_pattern` closes the related hazard: `matchMaterials` builds
  a word-boundary expression per pattern, and an empty one matches at almost any boundary — a single
  blank row would tag every scraped product in the system with that material.
- **`AMBIGUOUS` STORES NOTHING, which is a stronger rule than the phase document states.**
  PHASE-23-30 asks that no unit be inferred from magnitude and that an unlabelled, unconfigured
  positional order be `AMBIGUOUS`. What ships is the invariant behind it: `dimensions_mm` is null
  unless `dimension_parse_state = 'PARSED'`. Every downstream reader — Phase 30's scale bands, Phase
  31's comparisons, Phase 33's similarity — reads that column and none of them can tell a guessed
  millimetre from a read one, so the guessed one is never written. The source string survives in the
  version's `raw` and in `normalized.sourceTexts.dimensions`, where the explorer shows it beside the
  word "ambiguous" and a person can correct it.
- **AN UNLABELLED TRIPLE IS READ AS LENGTH × WIDTH × HEIGHT, and that is a NAMING claim rather than
  a measurement one.** The phase document's own result table requires it (`120 x 60 x 45 cm` →
  `{length_mm: 1200, width_mm: 600, height_mm: 450}`) while its prose says positional order is never
  assumed. Both are honoured by observing what the conventions actually disagree about: in L×W×H and
  in W×D×H alike, the last number is the vertical extent and the first two are the two horizontal
  ones — what differs is which horizontal extent is called "length". Phase 30 bands by the largest
  extent and Phase 31 compares like with like, and neither depends on that naming. **Labels always
  win**, and a source that states its own order overrides the convention if a later phase adds one.
- **The *Scraped Products* provider is a third row in `providers/research.ts`, not the
  `providers/research-products.ts` the deliverable table names.** That file's own header made the
  argument two phases ago and `providers/index.ts` made it at length before that: near-identical
  provider files differing in three literals each are several places to get a permission wrong, and
  the one that matters is the one nobody re-reads. A fourth file holding six lines would contradict
  the file it sits beside. The same header also said Phase 29 would register this provider "once
  there is an explorer for a result to open" — the explorer landed a phase earlier than the plan
  expected, which is the only reason this is early rather than late.
- **`0261` is one past the phase document's `0260`**, for the reason A23 gives for `0214`, A24 for
  `0221`, A25 for `0233`, A26 for `0241` and A27 for `0251`. Two of its three tables are UPDATE-ONLY
  for every role including owner — rows are written by the pipeline under the service role and a
  person may only triage what it found — which required `scripts/auth/gen-role-sql.ts` to learn a
  `writeIsUpdateOnly` flag that skips the insert policy and emits a note saying why.

**2026-09-10 · A27 — D1 gains an HTML parser and one place to call it, Phase 27 takes migration
`0251`, the content hash is over the DRAFT rather than the page, an adapter is two registrations
rather than one, and the CPU budget measures what it cannot pre-empt (PHASE-23-30 §Phase 27,
SCRAPER.md §18, DATA_MODEL §12).**

Six readings the repository forced. The first genuinely extends D1; the fifth is a defect this phase
found in its own code and is recorded as a decision rather than a fix nobody would notice.

- **D1 gains an HTML-parsing row: `node-html-parser`, and `lib/scraper/adapters/parse.ts` is the only
  file allowed to call it.** D1 fixes the stack and named no parser because until this phase nothing
  parsed markup — Phase 25 read a `<title>` and a list of `href`s with a regex and said in its own
  header that a DOM parser would be "a general-purpose extraction tool one import away from every
  quick price regex". Phase 27 is the phase that builds the architecture around it, so the
  dependency is taken deliberately and bounded: `jsdom` stays a devDependency (it is a browser
  emulator, not a parser, and a production dependency on one would be a much larger surface for a
  third party's markup), a regex over markup for STRUCTURED data is rejected outright, and a
  headless browser remains permanently prohibited.
- **`0251`, one past the phase document's `0250`.** The reason A23 gives for `0214`, A24 for `0221`,
  A25 for `0233` and A26 for `0241`, unchanged. It is the shortest generated policy file yet — four
  `select` policies and no write policy of any kind — and that emptiness is the decision: these two
  tables are the RECORD of what happened, and a record its author can edit is not a record.
  `normalized` and `normalizer_version` are declared in `0250` though Phase 28 writes them, on the
  reasoning `0231` used for `current_version_id`: a column added later is a migration nobody needs
  when the shape is already known.
- **The content hash is over the DRAFT, not over the page body, and excludes `confidence` and
  `provenance`.** Two fetches of a page differing only in a session id, a CSRF token or a rotating
  banner are ONE product observation, and hashing bytes would write a version a night for four
  hundred unchanged pages until "what changed" became a question about noise. The exclusion of the
  two bookkeeping maps is the subtle half: a strategy change that finds the same value by a
  different route is not a change to the product, and including them would make an adapter fix look
  like every product on every source changing at once, on the same night, in Phase 29's review
  queue. Array order IS hashed — a re-ordered gallery is a change.
- **An adapter registers TWICE, into two registers, and the split is what keeps the Studio bundle
  clean.** A DESCRIPTOR — key, version, capabilities, `supports()` — goes into
  `lib/scraper/adapters/registry.ts`, which a Client Component may import; an IMPLEMENTATION goes
  into `lib/scraper/adapters/execution.ts`, which only the drain loop touches. A picker that
  imported implementations would drag every adapter's parser into a Client Component in order to
  render four strings. The cost of the split is that the two can disagree, and one test holds them
  together. The `generic` descriptor is bumped to a MAJOR version because its output shape changed:
  Phase 25's raw items held a title and links, these hold a `RawProductDraft`, and `adapter_version`
  on every row is what lets a value that later looks wrong be traced to the code that read it.
- **THE CPU BUDGET MEASURES; IT DOES NOT PRE-EMPT — AND A REAL DEFECT MADE THAT DISTINCTION
  EXPENSIVE.** FEAT §27 asks for "a 5-second CPU budget" per item. JavaScript cannot interrupt a
  synchronous function, so what shipped is a measurement around the call, a `budgetSpent()` predicate
  a well-behaved adapter checks inside its own loops, and an overrun counted as an item failure.
  That is honest but it is not a bound, and the gap showed: `node-html-parser` is super-quadratic in
  NESTING DEPTH — 500 unclosed divs take 29 ms, 2,000 take 791 ms, 4,000 take nearly six seconds,
  and twenty thousand take hours — so a hundred kilobytes of `<div>`, well inside the fetcher's 2 MB
  cap and trivially served by anybody who would like Rivya to stop reading them, wedges the cron
  invocation. The runaway is one call into a dependency with no loop of ours to ask. **The only
  defence is to refuse the input before handing it over**, so `parse.ts` estimates nesting depth in
  one linear pass and refuses past 200 levels. The contract suite's own malformed-input case is that
  exact string, and it hung the test run indefinitely the first time the generic adapter was
  actually registered — which is how this was found, and why the test was not made smaller.
- **A work item is `DONE` when extraction fails, and the fetcher is not asked again.** A work item is
  a URL TO FETCH, and it was fetched: the page is on disk, the fetch row is written, and retrying it
  would ask a third party's server for a document Rivya already holds because OUR reading of it was
  wrong. An adapter failure is accounted on `research_adapter_runs` and repaired by
  `scripts/research/reextract.ts`, which needs no network at all. Three consecutive ABORTED adapter
  runs open the same circuit five consecutive FETCH failures open, because from the host's point of
  view repeatedly asking for pages Rivya cannot use is the same behaviour.

**2026-09-10 · A26 — D5 admits a staff-authored taxonomy pointer, Phase 26 takes migration `0241`,
its four enums sit in `0240`, `base_url` admits loopback so the tests that prove a request was NOT
made can exist, three politeness ceilings tighten to FEAT §26's numbers, health is a
`security_invoker` view, and the cron grammar leaves a server-only module (PHASE-23-30 §Phase 26,
SCRAPER.md, DATA_MODEL §12).**

Eight readings the repository forced. The first genuinely amends D5 and was a stated blocker on this
phase — *Open question 4* in the phase document — rather than a reading discovered while building.

- **D5's "scraped data … never joins directly to public product tables" gains a narrow, named
  exception, and this is the amendment the phase document said had to exist before `0240` could
  ship.** Two research tables reference `categories`: `research_source_category_map.category_id`
  here, and `research_products.matched_category_id` in Phase 28. The distinction D5 was reaching for
  is between a scraped VALUE and a STAFF-AUTHORED POINTER, and only the first is what the rule is
  about. A category mapping is a person deciding that a label on somebody else's website corresponds
  to one of Rivya's seven categories; nothing about it came off a page. It points at TAXONOMY, never
  at `products`, and it is `on delete set null`, so removing a Rivya category unmaps the label rather
  than deleting research or blocking the delete. **The exception is exactly two constraints, named
  individually in `scripts/research/check-research-isolation.mjs`, and a third fails the build** —
  including the same column re-pointed at `products` under another name. The alternative the phase
  document offered — storing the category slug as text — was rejected because it buys the appearance
  of isolation with the loss of referential integrity: a renamed category silently unmaps every
  source label, and nothing anywhere notices.
- **`0241`, one past the phase document's `0240`.** The reason A23 gave for `0214`, A24 for `0221`
  and A25 for `0233`, unchanged: `npm run auth:gen-policies` rewrites a generated policy file whole,
  so it cannot also carry the DDL that creates its tables.
- **The four new enums sit inside `0240` rather than in a file of their own, which departs from
  0230.** That split exists because PostgreSQL refuses to USE an enum value in the same transaction
  that ADDS it with `alter type … add value`; it says nothing about `create type`, and each migration
  is applied by `psql --file` in autocommit besides. 0230 separated the subsystem's vocabulary from
  eight tables and was right to. These four are four columns' worth of allowlist on one table that
  the same file alters, and a second file holding only them would be a file nobody opens.
- **`research_sources.base_url` requires `https://` — or loopback `http://`, and the exception is
  named at the constraint rather than implied.** FEAT §26 field 2 says https and means it for every
  real source. But the claims that matter most in this subsystem are claims about requests that must
  NOT happen: a `Disallow`ed path never requested, a kill switch that produced zero traffic, a delay
  actually waited. The only way to check those is a fixture HTTP server this repository starts and
  reads the request log of, and such a server cannot present a certificate. Forcing https would not
  make the system safer; it would delete the tests that prove it is. The Zod schema carries the
  identical rule, so the form and the table refuse the same strings.
- **`rate_limit_rpm` narrows to 1–60, `request_delay_ms` rises to a 1,000 ms floor, and both are
  changed at the row.** Phase 25 set them wider because it had no field table to set them from;
  FEAT §26 fields 16–18 supply the numbers. A form stricter than its table is a form somebody
  bypasses with a server action, so the two now refuse the same values.
- **FEAT §26 fields 20 and 21 are not columns.** `research_source_health_v` computes last run and
  health on read, in the precedence DISABLED → FAILING → DEGRADED → STALE → HEALTHY. A cached health
  column is wrong between the event and the job that would update it, and the moment it is most
  likely to be wrong is the moment somebody looks at it. **`security_invoker = true` is the
  load-bearing word in that statement**: without it a view runs with its owner's privileges and a
  relation over nine staff-only tables becomes readable by anyone PostgREST will speak to.
  `check-research-isolation.mjs` gains a fifth assertion for the half a policy cannot cover — a VIEW
  has no policies, so its GRANTS are the whole of its access control, and Supabase exposes a new one
  through PostgREST by default. Tables are deliberately out of that check's scope: Supabase grants
  every role every privilege on every new table in `public`, and RLS, not the grant, is the boundary.
- **`readiness` is a second column beside `policy_status`, and the pair is not redundancy.**
  `readiness` is the researcher's side of the workflow — DRAFT, READY_FOR_REVIEW, REVIEWED — and
  `policy_status` is the owner's answer. Folding them into one column would let a researcher move a
  source towards approval by writing the column that records approval. `research_source_schedules`
  refuses any `timezone` but `UTC` for the mirror-image reason: `nextCronRun` evaluates every cron
  field in UTC, so a stored zone would be a column the scheduler silently ignores, and refusing the
  value is better than storing a lie.
- **The cron grammar moves to `lib/scraper/core/cron.ts`, and the adapter registry arrives one phase
  early.** `parseCronField` and `nextCronRun` lived in `lib/scraper/workflows/schedule.ts`, which
  begins `import 'server-only'`; Phase 26 needs the same grammar in a form validator a Client
  Component may reach. The module is pure, `schedule.ts` re-exports both so no caller changes, and
  the six-hour rule now exists twice on purpose — as a CHECK that cannot be bypassed, and in
  TypeScript so a form can say what is wrong before the write. `lib/scraper/adapters/registry.ts` is
  the other early arrival: FEAT §26 field 11 requires the adapter key to resolve against the Phase 27
  registry, and a picker with nothing to list is not a picker. It holds a DESCRIPTOR — key, version,
  capabilities, `supports()` — and exactly one entry; Phase 27 fills it with adapters that register
  an implementation beside the descriptor.

**2026-09-10 · A25 — Phase 25 takes migrations `0233` and `0234`, `research_sources` carries no
`owner_verification`, snapshots live in Supabase Storage rather than Cloudinary, the research cron
answers 401 rather than 404, and the flag is `research_enabled` (PHASE-23-30 §Phase 25, DATA_MODEL
§12, SCRAPER.md).**

Six readings the repository forced. None contradicts D1–D10; the third amends D8's silence rather
than any of its names.

- **`0233`, one past the phase document's `0232`, and `0234` beyond that.** The first is the reason
  A23 gave for `0214` and A24 for `0221`: a generated policy file is rewritten whole and cannot
  also carry the DDL that creates its tables. The second is a different and more interesting
  reason. Phase 23 created `research_search_documents` two phases early, deliberately, so the
  separation between the two corpora was visible in the schema from the day there was a search
  index at all — and gave its `status` column a CHECK admitting only the seven FEAT §23 pipeline
  stages. But the same table's `entity_type` allowlist admits `research_source` and `research_run`,
  and neither has a stage. Under the constraint as written, neither could be indexed, so the two
  command-palette providers this phase's deliverable names would have had nothing to query. `0234`
  widens the allowlist to the union of the three vocabularies — each named, so a typo stays
  unstorable — and fills the index by trigger. It is a correction to 0210, made by the first phase
  that had to use it.
- **`research_sources` has no `owner_verification` column.** It is the one research row D10 plainly
  governs: it asserts that Rivya may read somebody else's website. The obvious move was the D5
  verification flag defaulting to `OWNER_VERIFICATION_REQUIRED`, and it was wrong — it would have
  been two columns answering one question with only one of them enforced. `policy_status` starts
  `UNREVIEWED`, only owner and admin may move it to `APPROVED`, an approval that names nobody is
  refused, and `research_sources_enabled_requires_approval` makes an enabled-but-unapproved source
  unstorable. That is a stronger gate than the generic one, and in a different place: the generic
  flag blocks publication, and this blocks the fetch.
- **D8 gains no variable for the snapshot store, and that is worth recording even though the store
  itself was already specified.** `SCRAPER.md` §9.2 already said "a private Supabase Storage bucket,
  not Cloudinary" — this phase implemented it rather than decided it, and the reasoning there stands
  (Cloudinary serves from a public CDN, so a competitor's page body would be published from a Rivya
  origin). What is new is the consequence for D8: the bucket lives in the project
  `SUPABASE_SERVICE_ROLE_KEY` already points at, so it needs no new vendor, no new credential and no
  new environment name. D8 is unchanged by this phase, which is the answer to "what else do we have
  to buy": nothing.
- **A batch of politeness is enforced in the LEASE QUERY, not before the fetch.** Stated because a
  reader expecting `await sleep(delay)` will not find one. On a runtime that kills a function at
  sixty seconds, sleeping spends the invocation doing nothing and loses the delay entirely when the
  function is terminated mid-wait. `not_before_at` on the item and `next_fetch_not_before` on the
  source are filtered in the statement that hands out work, so the delay survives the process. It
  also means `for update skip locked` — which PostgREST cannot express — so leasing is a SECURITY
  DEFINER function granted to the service role alone.
- **The research cron answers 401, not the phase document's 404.**
  `app/api/cron/content-schedule/route.ts` established 401-with-`CRON_SECRET` for this repository,
  and two cron endpoints answering differently to the same mistake is worse than either answer on
  its own. A 404 also misleads the person most likely to hit this by hand: an operator debugging a
  missed tick reads "not found" as "wrong path" and goes looking for a routing problem that is not
  there. The endpoint's existence is not the secret; the secret is.
- **`CRON_SECRET` joins D8's server-only list, which is paperwork this phase should not have left
  open.** It has been read by `app/api/cron/content-schedule` since Phase 08 and is documented in
  `.env.example`, but it was never added here — so the code and the canonical decision disagreed
  about whether it exists, which is exactly the drift D8 is meant to prevent. Phase 25's cron route
  makes it the second reader, and `ENVIRONMENT.md` §6 open question 2 (six routes reusing
  `REVALIDATE_SECRET`, one route on `x-vercel-cron` alone) is settled by what shipped: both built
  cron routes authenticate with `CRON_SECRET` through `checkCronAuth`, and `REVALIDATE_SECRET`
  guards `/api/revalidate` and nothing else. **THE NAME IS NOT OURS TO CHOOSE** — Vercel attaches
  `Authorization: Bearer <value>` to a cron invocation only for a variable spelled exactly
  `CRON_SECRET`, so renaming it makes the header silently absent and every tick 401 with nothing
  logged anywhere.
- **The kill switch is `research_enabled`, not the phase document's `research.enabled`.** A flag key
  is an identifier — call sites spell it out — and the database CHECK requires a legal one. The
  same correction `three_d_viewer` made for `3d_viewer` in Phase 21.

**2026-09-10 · A24 — Phase 24 takes migration `0221`, a batch of fifty is the unit of progress
and not of atomicity, `media.move` is not destructive, confirmation is two constraints rather than
one, and `row_version_before` holds the version the operation LEFT behind (PHASE-23-30 §Phase 24,
DATA_MODEL §12).**

Five readings the repository forced, none of which contradicts D1–D10.

- **`0221`, one past the phase document's `0220`.** The reason A23 gives for `0214`, unchanged: a
  generated policy file is rewritten whole by `npm run auth:gen-policies`, so it cannot also hold
  the DDL that creates its tables. `0220` creates the four bulk tables and `0221` is their
  generated RLS. Recorded in DATA_MODEL §12, which `check-migrations.mjs` reads.
- **A batch of fifty is the unit of PROGRESS AND REPORTING, not of atomicity.** The phase document
  describes batches "inside one transaction each". PostgREST gives the engine one statement per
  call and no transaction handle, so what fifty actually buys is bounded memory, a progress point,
  and a `PARTIAL` outcome that names exactly which rows landed — which is the property the phase
  wanted the transaction for. A 500-row publish failing on row 499 still keeps its 498 good writes
  and reports the one that failed by id. Getting real per-batch atomicity would mean an RPC per
  operation kind, which trades eleven readable TypeScript operations for eleven PL/pgSQL functions
  and moves the permission checks away from `requirePermission`. Stated here because a later reader
  comparing the code with the phase document will otherwise think the transaction was forgotten.
- **`media.move` is NOT destructive, and `media.archive` is.** Moving assets between folders
  changes where they are filed and nothing else: no asset stops resolving, no page loses a picture,
  and the operation is its own inverse. Requiring `destructive.execute` for it would mean a
  merchandiser tidying a folder needs an owner, which teaches operators that the destructive
  confirmation is paperwork rather than a warning — and that is how a real archive gets waved
  through. `scripts/bulk/check-bulk-registry.mjs` pins the four operations that MUST be
  destructive (`product.unpublish`, `product.archive`, `media.archive`, `research.reject`), so this
  reading is enforced rather than remembered.
- **Confirmation is two constraints, not one pair.** The draft tied `confirmation_token` and
  `confirmed_at` together as an equivalence. Running the engine against a real database proved it
  wrong in both directions: the token is minted with the PREVIEW row, before any confirmation, and
  it is CLEARED at the finish — spending it is what makes a preview single-use against a
  double-submitted form. What holds at every state is that a PREVIEW carries the token that makes
  it applicable (`bulk_operations_preview_has_token`) and that nothing leaves PREVIEW without a
  confirmation behind it (`bulk_operations_confirmed_before_running`).
- **`row_version_before` is the version the operation LEFT the row at, read AFTER its own write.**
  The name is the phase document's and reads correctly from the undo's point of view — it is what
  the row held before the UNDO. The value is what nearly went wrong: recording the version the
  operation READ meant comparing against a version the operation had itself already moved on, so
  undo mismatched on every row it had touched, skipped all of them, and reported each as edited by
  somebody else. An undo that restores nothing and misattributes why is worse than no undo. Nothing
  short of running the engine against a real database caught it; the regression guard is an
  ordering assertion (read, write, read) in `tests/unit/bulk-media-immutable.test.ts`.

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
