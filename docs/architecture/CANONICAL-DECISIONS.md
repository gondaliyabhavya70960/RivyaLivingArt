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
  (studio)/studio/login/     unauthenticated sign-in surface (middleware redirect target)
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
