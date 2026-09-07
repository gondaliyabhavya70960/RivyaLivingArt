# PHASES 39–46 — SEO, Performance, Accessibility, Security, Testing, Media Finalisation, Deployment, Polish, Handoff

> Binding parent: `docs/architecture/CANONICAL-DECISIONS.md`. Where this document and the canonical
> decisions differ, the canonical decisions win and this document is wrong.
> Source specifications: `docs/requirements/01-ADVANCED-FEATURE-EXPANSION.md` (cited as *FEAT §n*)
> and `docs/requirements/02-INITIAL-CONTENT-SEED-SYSTEM.md` (cited as *SEED §n*).
> Predecessor documents: `PHASE-00-04.md`, `PHASE-05-09.md`, `PHASE-10-15.md`, `PHASE-16-22.md`,
> `PHASE-23-30.md`, and the phase document covering 31–38.

Phases 00–38 built the product: a toolchain, a design system, a database with RLS, staff auth, a
Studio, a governed media library of 250 migrated Higgsfield assets, a page-block CMS, a seeded
first-pass website, thirteen public routes, a catalogue, a product detail page, collections,
portfolio, journal, a commission configurator, an inquiry-to-WhatsApp conversion, a 3D viewer, a
merchandising layer, search, bulk management, a research subsystem, analytics, and the system
surfaces that make all of it legible to an operator.

Phases 39–46 do not add product surface. They make what exists **findable, fast, usable, safe,
proven, completely illustrated, deployable, finished, and handed over**. That is a different kind
of work and it fails in a different way: each of these phases can be declared done while being
mostly cosmetic. So every phase below states its evidence before its scope — the command that
proves it, the assertion that fails when it regresses, and the artefact a reviewer reads.

Three rules govern the whole block and are repeated because they are easiest to break at the end
of a project, under launch pressure:

1. **Nothing here may assert a business fact the owner has not verified.** Structured data, an OG
   description, a keyword target, a deployment region justified by "our customers are in India" —
   all of these are claims. Where a claim is unavoidable it ships behind
   `owner_verification = 'OWNER_VERIFICATION_REQUIRED'` and does not render (D10, FEAT §38, SEED §55).
2. **Nothing here regenerates media that already exists.** The 250-asset manifest is the library
   (D6, FEAT §33, manifest `policy.rules[4]`). Phase 43 may append; it may not replace.
3. **Nothing here introduces checkout, payment or customer accounts.** Conversion terminates in a
   persisted inquiry then WhatsApp (D1, FEAT §39). A "buy" affordance added during polish is a
   defect, not a feature.

## Conventions used by all eight phases

| Convention | Value |
|---|---|
| Migration numbering | 39 → `0370–0379`, 40 → `0380–0389`, 41 → `0390–0399`, 42 → `0400–0409`, 43 → `0410–0419`, 44 → `0420–0429`, 45 → `0430–0439`, 46 → `0440–0449` (the `10N − 20` rule from `PHASE-10-15.md`) |
| Migration filename | `supabase/migrations/<nnnn>_phase<nn>_<subject>.sql` |
| Migration shape | Expand/contract only. Every migration is backward-compatible with the currently deployed code; a column is added nullable, backfilled, adopted, and dropped in a **later** migration (Phase 44 rule, applies retroactively to this block) |
| Permission spelling | `<domain>.<action>`, the Phase 04 form (`seo.write`, `media.publish`), per the reconciliation in `PHASE-10-15.md` |
| Data access | `lib/supabase/repositories/**` only. No route, action or script calls `.from(...)` directly |
| Validation | Zod at every trust boundary (D1) |
| Rendering default | Server Component. `'use client'` requires a named reason and a `components/patterns/**`, `components/three/**` or `components/studio/**` home |
| Copy | Never a literal in JSX (SEED §1, D2). This includes error copy, a11y labels and empty states added by these phases; they come from `global_content` |
| Documentation ownership | FEAT §43 mapping, enforced by `scripts/docs/check-doc-contract.mjs` (Phase 01). 39 → `ARCHITECTURE.md` + `CONTENT_GUIDE.md` (D7 has no SEO document — see *Open questions*), 40 → `PERFORMANCE.md`, 41 → `ACCESSIBILITY.md` + `SECURITY.md`, 42 → `TESTING.md`, 43 → `MEDIA_GUIDE.md` + `HIGGSFIELD_GUIDE.md` + the two Higgsfield asset documents, 44 → `DEPLOYMENT.md` + `ENVIRONMENT.md`, 45 → `DESIGN_SYSTEM.md` + `COMPONENT_REGISTRY.md`, 46 → every path in D7 |
| New documentation paths | **None.** D7 fixes the documentation map. Where a phase below needs a new report it is written as a generated section inside an existing D7 file, never as a new path |
| Owner facts | Any statement asserting real business capability is seeded `OWNER_VERIFICATION_REQUIRED` and marked in this document as **OWNER_VERIFICATION_REQUIRED** at the point it appears |

### The visual QA widths

FEAT §45 fixes **eight** widths and this document uses exactly those eight, matching every
predecessor phase document:

| Class | Widths (CSS px) |
|---|---|
| Desktop | 1920 · 1440 · 1280 |
| Tablet | 1024 · 768 |
| Mobile | 430 · 390 · 360 |

The brief that commissioned this document referred to nine widths. §45 lists eight, the
`playwright.config.ts` projects created in Phase 00 are eight, and `PHASE-10-15.md` and
`PHASE-16-22.md` both say "eight FEAT §45 widths". Eight is used. The discrepancy is raised in
*Open questions* rather than resolved by inventing a ninth width.

### Shared D9 completion checklist

Every phase inherits all ten points of D9 and is **not COMPLETE** until each is true:

- [ ] 1. Scope implemented
- [ ] 2. Relevant tests run
- [ ] 3. No known scope-breaking error
- [ ] 4. Documentation updated (per D7 map and FEAT §43)
- [ ] 5. `CHANGELOG.md` updated
- [ ] 6. `PROJECT_STATE.md` updated
- [ ] 7. `docs/SESSION-STATE.md` updated with the FEAT §40 field set
- [ ] 8. Remaining issues documented
- [ ] 9. Next phase identified
- [ ] 10. Repository remains recoverable (migrations replay from clean, no uncommitted generated state)

---

## PHASE 39 — SEO

**Goal** — search engines stop seeing thirteen pages with fallback metadata and start seeing a
governed, owner-editable information architecture. Phase 10 shipped `lib/seo/metadata.ts`, a single
`robots.ts` and a single `sitemap.ts` as scaffolding, and Phase 15 shipped one JSON-LD builder for
products. Phase 39 turns those into a system: a four-level metadata resolution ladder ending in the
SEED §41 defaults, a split sitemap index covering every published entity type, a structured-data
allowlist in which every emitted property is traceable to something the owner typed and verified, a
redirect table so a slug change never produces a dead link, and a keyword workspace that records the
SEED §42 themes as **research targets with no claimed ranking opportunity**. When this lands, the
owner can change any title, description, social card, canonical or robots directive on any page or
entity from `/studio/content/seo` without an engineer, and nothing machine-readable asserts a fact
Rivya has not confirmed.

**Depends on** — Phase 08 (`seo_entries`, publishing workflow), 09 (SEED §41/§42/§44 seed rows), 10
(`lib/seo/metadata.ts`, `app/robots.ts`, `app/sitemap.ts`, `renderCmsPage`, the revalidate endpoint),
14–15 (categories, products, `lib/seo/product-jsonld.ts`), 16–18 (collections, portfolio, journal),
23 (`/search`, for the `SearchAction` and its `noindex` rule), 38 (`/studio/system/settings`,
feature flags, system logs).

**Scope**

- **Resolution ladder, four levels, first hit wins.** `lib/seo/resolve.ts` composes a route's
  `Metadata` from, in order: `seo_entries` scope `ENTITY` for the exact entity → scope `PATH` for
  the exact path → **derived** values computed from the page's own published content → scope
  `GLOBAL`. Derivation is deliberately dumb and stated in one place: title = the page's first
  `heading` field, description = the first 155 characters of the first `body` field, truncated on a
  word boundary. It never invents a sentence and never concatenates unrelated sections.
- **The title template.** `app/layout.tsx` sets `title.template = '%s | Rivya Living Art'` and
  `title.default = 'Rivya Living Art'` (SEED §41). The home route sets `title.absolute` so `/` never
  renders `Rivya Living Art | Rivya Living Art`. Both strings come from `seo_entries` scope
  `GLOBAL`, not from a literal — an owner can change the template itself.
- **Length guidance, not length enforcement.** Studio shows a live character count and a SERP
  preview at the 60 (title) / 155 (description) marks, warns beyond, and **never blocks a save**. A
  title is editorial; an engineer's cap is not a reason to reject the owner's sentence.
- **Canonical rules**, one table, no exceptions:

  | Case | Canonical |
  |---|---|
  | Any static path | `${NEXT_PUBLIC_SITE_URL}${path}`, no trailing slash, no query |
  | `/collection/[category]` with filters | the **unfiltered** category path |
  | `/collection/[category]?page=n`, `n > 1` | the paginated URL itself, plus `rel=prev`/`rel=next` link tags |
  | `/search` and any `?q=` | none — the route is `noindex, follow` |
  | Draft preview routes | none — `noindex, nofollow` and blocked in `robots.txt` |
  | An entity with an owner-set `seo_entries.canonical_url` | that value, absolute, validated as same-origin |

- **Robots directives by route class.** `X-Robots-Tag` is set in `middleware.ts` for whole
  subtrees; per-page `robots` fields come from `seo_entries.robots`.

  | Route class | Directive | Reason |
  |---|---|---|
  | Published `(site)` routes | `index, follow` | |
  | Page with zero published sections | `noindex, follow` | Phase 10 rule, kept |
  | `/search`, filtered catalogue URLs | `noindex, follow` | Thin and infinite |
  | `/studio/**` | `noindex, nofollow` header **and** auth **and** a `Disallow` | Three independent layers |
  | `/api/**` | `noindex, nofollow` | |
  | Preview deployments (whole host) | `noindex, nofollow` header on every response | Phase 44 sets `VERCEL_ENV != 'production'` |

- **Split sitemap.** `app/sitemap.ts` becomes an index referencing six children generated through
  `generateSitemaps`: `pages`, `categories`, `products`, `collections`, `portfolio`, `journal`. Each
  lists `PUBLISHED` rows only, `lastModified` from `published_at` (falling back to `updated_at`),
  5 000 URLs per file, `revalidate = 3600`. **No `priority` and no `changefreq`** — both are ignored
  by major engines and both invite a fabricated freshness signal. **No image sitemap**: 100% of
  current imagery is concept media (`is_concept = true`), and an image sitemap would actively invite
  Google Images to surface AI concept renders as Rivya products (D6, D10).
- **Structured-data allowlist.** `lib/seo/jsonld/` gains one builder per type. Every builder is a
  pure function returning `object | null`, and returns `null` when its gate fails. Nothing else in
  the codebase may emit a `<script type="application/ld+json">` — enforced by
  `scripts/seo/check-jsonld-scope.mjs`.

  | Type | Route | Emitted only when | Never includes |
  |---|---|---|---|
  | `Organization` | root layout | `global_content` brand rows are `VERIFIED`; `logo` only when a brand logo asset exists (Phase 43); `sameAs` only from owner-entered profile URLs | `foundingDate`, `numberOfEmployees`, `address`, `telephone`, `award`, `hasCredential`, `aggregateRating` |
  | `WebSite` | root layout | always; `potentialAction` `SearchAction` → `/search?q={search_term_string}` | `alternateName` unless owner-set |
  | `BreadcrumbList` | category, product, collection, project, article | the trail is derived from real published parents | a fabricated parent |
  | `Product` | `/product/[slug]` | Phase 15 builder, tightened here: `offers` only when `price_state = 'FIXED'` **and** the row is `VERIFIED` | `aggregateRating`, `review`, `gtin*`, `mpn`, invented `sku`, `material` unless a `product_materials` row exists |
  | `CollectionPage` | `/collections/[slug]`, `/collection/[category]` | the page is `PUBLISHED` | item counts implying stock |
  | `Article` | `/journal/[slug]` | `PUBLISHED`; `author` is the organisation unless an owner-entered author exists | a fabricated `author` person |
  | `FAQPage` | `/faq` | **only** the FAQ rows whose `owner_verification = 'VERIFIED'`; if none are, the block is omitted entirely | any unverified answer |
  | `ContactPoint` | `/contact` | contact rows are `VERIFIED` | an unverified phone, email or address |

  Explicitly **never emitted anywhere**: `LocalBusiness`, `Store`, `OpeningHoursSpecification`,
  `Offer` for a non-`FIXED` price state, `Review`, `Rating`, `AggregateRating`, `Award`,
  `Certification`, `Service.areaServed`, `deliveryTime`, `shippingDetails`, `returnPolicy`. Each of
  these asserts a capability, a delivered outcome or a commercial term Rivya has not confirmed, and
  three of them (`Offer`, `shippingDetails`, `returnPolicy`) would additionally contradict the
  no-checkout business rule.
- **The verification gate as code.** `lib/seo/jsonld/guard.ts` exports
  `verifiedOnly<T>(value: T, verification: OwnerVerification): T | undefined`. Every builder passes
  every capability-bearing property through it. A unit test enumerates the builders, feeds each an
  `OWNER_VERIFICATION_REQUIRED` fixture, and asserts the output contains none of the forbidden keys.
- **Keyword themes, recorded not claimed.** `seo_keyword_themes` is seeded with the seventeen SEED
  §42 themes at `research_status = 'UNRESEARCHED'`. **No volume, difficulty, CPC, rank or
  opportunity number is seeded, computed or displayed** — SEED §42 says the strategy "must be refined
  through research before claiming ranking opportunity", and this phase treats that as binding. The
  Keywords tab shows theme, mapped path, status, owner notes, and an evidence URL the owner pastes
  from whatever research tool they use. Two themes are additionally flagged
  **OWNER_VERIFICATION_REQUIRED** on seed because they assert a service geography rather than a
  product category: `custom furniture India` and `resin furniture India`. No keyword string is ever
  rendered on a public page; there is no keywords meta tag.

  | Seeded theme (SEED §42, verbatim) | Suggested mapped path | Note |
  |---|---|---|
  | resin furniture · epoxy resin furniture · bespoke resin furniture | `/collection/furniture` | head terms |
  | resin dining table · river table · custom resin table | `/large-format` | |
  | resin coffee table · resin console table | `/large-format` | thin media coverage (Phase 43) |
  | sculptural furniture · collectible furniture | `/collection/collectible-design` | no bound media yet |
  | 3D printed furniture | `/collection/3d-resin` | |
  | resin wall art · large resin art | `/collection/wall-statement-art` | |
  | custom resin art | `/custom-commissions` | |
  | resin preservation | `/collection/preservation` | |
  | custom furniture India · resin furniture India | `/contact` | **OWNER_VERIFICATION_REQUIRED** — geography |

- **Redirects without middleware cost.** `seo_redirects` holds `from_path`, `to_path`, `status_code`
  (301/308), `reason`, `created_by`. `renderCmsPage` and each dynamic route consult it **only on the
  path that would otherwise call `notFound()`**, so the happy path pays nothing. A slug change in
  Studio offers "create a redirect from the old slug" pre-ticked. Loop and chain detection runs at
  write time, capped at one hop.
- **Social cards.** OG and Twitter images are the Cloudinary `og` preset (`c_fill,g_auto,w_1200,h_630`,
  Phase 06) applied to the entity's bound hero, falling back to a brand OG asset. **No runtime
  text-on-image generation** (`next/og` is not used): baked-in text cannot be corrected by an owner
  edit, drifts from the CMS, and is invisible to the SEED §55 content rules.
- **Single locale.** `lang="en-GB"` (Phase 10). No `hreflang`, no locale routing, no translated
  metadata. Stated so a later phase does not read the absence as an oversight.

**Out of scope**

- Any claim about ranking, traffic, competitive difficulty or opportunity. The Keywords tab records
  research; it does not perform it, and the Studio copy says so.
- Third-party SEO tooling, Search Console API integration, backlink data, rank tracking, and any
  script tag from a third party (Phase 40 forbids the last outright).
- Content rewriting for keywords. Copy is owned by the CMS and the owner; SEO does not edit prose.
- Product data. No product exists unless the owner entered it; SEO adds no product.
- `LocalBusiness` markup and Google Business Profile, both of which require a verified premises.
- Internationalisation, AMP, and dynamic OG image generation.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Migrations | `supabase/migrations/0370_phase39_seo.sql`, `0371_phase39_seo_rls.sql` | Keyword themes, redirects, `seo_entries` columns, policies |
| Resolution ladder | `lib/seo/resolve.ts` | Four levels; pure; unit-tested per level |
| Metadata builder | `lib/seo/metadata.ts` (extended) | Title template, canonical, robots, OG/Twitter |
| Canonical helper | `lib/seo/canonical.ts` | Absolute URL, query allowlist, pagination rules |
| Sitemap index | `app/sitemap.ts` | Index only |
| Child sitemaps | `app/sitemaps/[type]/sitemap.ts` | `generateSitemaps`; six types; published-only |
| Robots | `app/robots.ts` (extended) | Sitemap index reference, `Disallow` set |
| JSON-LD builders | `lib/seo/jsonld/{organization,website,breadcrumb,product,collection,article,faq,contact,guard,index}.ts` | One per type; `null` when gated |
| JSON-LD component | `components/patterns/JsonLd.tsx` | Server; the only emitter of `application/ld+json` |
| Redirect resolver | `lib/seo/redirects.ts` | Consulted only on the 404 path; one hop |
| Repositories | `lib/supabase/repositories/{seo,keywords,redirects}.ts` | Sole DB access |
| Studio SEO workspace | `app/(studio)/studio/content/seo/**` | Fills the D4 leaf; seven tabs |
| SERP preview | `components/studio/seo/SerpPreview.tsx` | Client; counts, truncation preview |
| Scope guard | `scripts/seo/check-jsonld-scope.mjs` | Fails on `ld+json` outside `JsonLd.tsx` |
| Structured-data validator | `scripts/seo/validate-jsonld.mjs` | Crawls a local build, parses every block, asserts the forbidden-key list is absent |
| Coverage report | `scripts/seo/build-seo-coverage.ts` | Appends a generated section to `docs/content/INITIAL_CONTENT_INVENTORY.md` |
| Tests | `tests/unit/{seo-resolve,seo-canonical,jsonld-guard,jsonld-builders,sitemap-scope,redirect-chain}.test.ts`, `tests/e2e/{seo-metadata,studio-seo}.spec.ts` | Ladder, gates, published-only, editability |
| Docs | `docs/architecture/ARCHITECTURE.md`, `docs/content/CONTENT_GUIDE.md`, `docs/studio/STUDIO_GUIDE.md` | Ladder, allowlist, workspace |

**Database**

| Table | Key columns | Notes |
|---|---|---|
| `seo_keyword_themes` | `id`, `theme text not null`, `normalized_theme citext`, `mapped_path text`, `research_status text check (research_status in ('UNRESEARCHED','RESEARCHED','TARGETED','REJECTED')) default 'UNRESEARCHED'`, `notes text`, `evidence_url text`, `researched_by uuid`, `researched_at timestamptz`, `seed_key text`, plus the D5 common set | `unique (normalized_theme)`. **No numeric metric column exists** — there is deliberately nowhere to store a fabricated volume or difficulty |
| `seo_redirects` | `id`, `from_path text not null`, `to_path text not null`, `status_code int not null default 308 check (status_code in (301,308))`, `reason text`, `hit_count int default 0`, `last_hit_at timestamptz`, plus the D5 common set | `unique (from_path)`; `check (from_path <> to_path)`; write-time chain detection |
| `seo_entries` (altered) | `+ structured_data_type text`, `+ noindex boolean not null default false`, `+ nofollow boolean not null default false`, `+ derived boolean not null default false` | `derived` marks a row Studio generated from page content so an owner edit can be distinguished from a default |

RLS: `seo_entries` and `seo_keyword_themes` — `select` for any active staff role, write requires
`seo.write` (owner, admin, editor). `seo_redirects` — `select` additionally granted to `anon` for
`status = 'PUBLISHED'` rows only, because the 404 path resolves them for anonymous visitors; write
requires `seo.write`. No table in this phase is readable by `anon` beyond that one case.

**Studio surface** — **fills** `/studio/content/seo` with seven tabs: **Global** (site name, title
template, default description, social title/description, default OG asset — the SEED §41/§44 rows),
**Pages** (one row per D3 path with resolved title/description and the level each came from),
**Entities** (products, collections, projects, articles; filterable by "using derived metadata"),
**Keywords** (the table above; add, map, status, notes, evidence URL), **Structured Data** (per type:
enabled, gate status, and a read-only rendering of exactly what would be emitted for a chosen
entity), **Redirects** (list, add, test a path, chain warnings), **Coverage** (pages with derived
metadata, missing OG asset, missing description, duplicate titles, entities `noindex`). Every tab
shows the resolution level so an editor knows whether they are looking at their own words or a
default. **Extends** `/studio/catalog/products` and the collection, project and article editors with
an SEO panel writing `seo_entries` scope `ENTITY`.

**Public surface** — no new route. Changed output on every existing `(site)` route: `<head>`
metadata, canonical, OG/Twitter, JSON-LD. New machine surfaces: `/sitemap.xml` (index) and
`/sitemaps/{pages,categories,products,collections,portfolio,journal}.xml`; `/robots.txt` extended.
A 404 that matches a `seo_redirects` row becomes a 308 instead.

**Media** — no new asset and no generation. The `og` preset is derived from assets already bound in
Phases 09–22: `three-d-resin` (13), `wall-art` (20), `preservation-varmala` (15) +
`preservation-keepsake` (4), `decor` (18), `gifts` (10), plus each page's bound hero. `furniture`
and `collectible-design` have no bound asset, so their category OG falls back to the brand OG asset
— which does not exist yet and is a Phase 43 gap; until then those two categories emit no
`og:image` rather than borrowing another category's picture (D6).

**Risks**

| Risk | Mitigation |
|---|---|
| Structured data asserts a capability the owner never confirmed | Every capability-bearing property passes `verifiedOnly()`; `jsonld-guard.test.ts` feeds unverified fixtures to all eight builders and asserts the forbidden-key list is absent; `validate-jsonld.mjs` re-checks the rendered HTML of a real build |
| A price reaches `offers` for a quote-only product | Phase 15's rule kept and tightened: `offers` requires `price_state = 'FIXED'` **and** `VERIFIED`; the unit test asserts absence for the other three states |
| Derived metadata quietly becomes the site's voice | `seo_entries.derived` marks it, the Coverage tab counts it, and the Pages tab shows the resolution level on every row. Derivation truncates on a word boundary and never joins two sections |
| The keyword table becomes a strategy document nobody researched | Status defaults to `UNRESEARCHED`; there is no metric column to fill with a guess; Studio helper copy states SEED §42's caveat verbatim; the Coverage tab reports the count still unresearched |
| A slug change breaks inbound links | Studio pre-ticks redirect creation on slug change; `redirect-chain.test.ts` covers loops, chains and self-redirects; `hit_count` shows an owner which redirects are load-bearing |
| Draft or research content enters the index | Sitemaps read `PUBLISHED` only; `sitemap-scope.test.ts` inserts a `DRAFT` row of every entity type and asserts zero appear; the research isolation guard (Phase 25, I3) already forbids research identifiers in `lib/seo/**` |
| Preview deployments get indexed | Phase 44 sets `X-Robots-Tag: noindex, nofollow` on every response when `VERCEL_ENV != 'production'`, and preview hosts are additionally access-protected |
| An image sitemap surfaces concept renders as products | No image sitemap is produced; `sitemap-scope.test.ts` asserts the index contains exactly six children and none is `images` |

**Verification**

1. `npm run db:migrate && npm run db:types && git diff --exit-code lib/supabase/database.types.ts` — clean.
2. `npm run build && npm start`. `curl -s localhost:3000/about | grep -o '<title>[^<]*</title>'` → `<title>About | Rivya Living Art</title>`; the same on `/` → `<title>Rivya Living Art</title>` with no repeated suffix.
3. `curl -s localhost:3000/sitemap.xml` → an index with exactly six `<sitemap>` children. `curl -s localhost:3000/sitemaps/products.xml` → zero `<url>` entries while `products` is empty; publish one product, revalidate, re-request → one entry.
4. Set a journal article to `DRAFT`, re-request `/sitemaps/journal.xml` → the URL is gone; request the article path → 404.
5. `node scripts/seo/validate-jsonld.mjs --base http://localhost:3000` — parses every emitted block on every route; exits non-zero if any of `aggregateRating`, `review`, `award`, `offers` (non-`FIXED`), `LocalBusiness`, `shippingDetails`, `returnPolicy` appears.
6. `npm run test:unit -- seo-resolve seo-canonical jsonld-guard jsonld-builders sitemap-scope redirect-chain` — all green.
7. `node scripts/seo/check-jsonld-scope.mjs` — exits 0. Add an inline `ld+json` to any page and confirm it exits non-zero naming the file.
8. In Studio: set an entity title on a product, reload the PDP → the entity title wins. Delete it → the path-level value wins. Delete that → the derived value appears and the Pages tab labels it `DERIVED`.
9. Keywords tab: all seventeen SEED §42 themes present, all `UNRESEARCHED`, `custom furniture India` and `resin furniture India` flagged `OWNER_VERIFICATION_REQUIRED`. Confirm no numeric metric field exists anywhere in the UI or the schema (`\d seo_keyword_themes`).
10. Change a product slug in Studio with the redirect box ticked; request the old path → 308 to the new path with `Location` absolute. Create `a → b` then attempt `b → a` → rejected as a loop.
11. `curl -sI localhost:3000/studio` → `X-Robots-Tag: noindex, nofollow`; `curl -s localhost:3000/robots.txt` → `Disallow: /studio`, `Disallow: /api`, and the sitemap index line.
12. `npx playwright test tests/e2e/seo-metadata.spec.ts tests/e2e/studio-seo.spec.ts` — green.

**Exit criteria**

- [ ] The four-level ladder resolves in the stated order, is unit-tested per level, and the resolution level is visible in Studio for every page and entity.
- [ ] `%s | Rivya Living Art` is the template, read from `seo_entries`, and `/` renders an absolute title.
- [ ] `/sitemap.xml` is an index over six children; every child lists `PUBLISHED` rows only, with `lastModified`, no `priority`, no `changefreq`, and no image sitemap exists.
- [ ] Every JSON-LD type in the allowlist is emitted by exactly one gated builder; every forbidden key is proved absent by both a unit test and a validator run against a real build.
- [ ] `offers` appears only for `FIXED` **and** `VERIFIED` products; no rating, review, award or shipping term is ever emitted.
- [ ] All seventeen SEED §42 themes are seeded `UNRESEARCHED`, the two geography themes carry `OWNER_VERIFICATION_REQUIRED`, and the schema has no field capable of storing a claimed ranking metric.
- [ ] `seo_redirects` resolves only on the 404 path, detects loops and chains, and is offered automatically on slug change.
- [ ] `/studio/content/seo` exposes all seven tabs; every SEO field on every page and entity is editable without code.
- [ ] `check-jsonld-scope.mjs` and `validate-jsonld.mjs` are wired into `npm run check` and CI.
- [ ] Phase-specific D9 evidence: docs updated = `ARCHITECTURE.md`, `CONTENT_GUIDE.md`, `STUDIO_GUIDE.md`; tests run = the six unit suites and two e2e specs above; next phase = 40.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 40 — Performance

**Goal** — the performance budget stops being a property of the homepage and becomes a property of
the site. Phase 11 set a Lighthouse budget for `/` and every phase since has been asked to respect
it without a mechanism to prove it. Phase 40 publishes a per-route budget table, enforces it in CI
against a production build, adds a bundle baseline that fails on unexplained growth, writes down the
caching contract that has so far been decided route by route, and starts collecting first-party
field data so that the lab numbers can be checked against real devices. It also converts FEAT §46's
rules from prose into guards: Server Components by default, one `priority` image per route, no
third-party script, no 3D byte in a first load, posters on every video.

**Depends on** — Phase 00 (`npm run check`, CI), 02 (design tokens, motion primitives), 06
(`lib/media/transform.ts` presets, poster policy), 10 (site shell, client-boundary guard), 11
(`lighthouserc.json`, the `/` budget), 14–18 (the routes being budgeted), 19 (`feature_flags`), 21
(3D viewer and its dynamic-import contract), 23 (suggest endpoint caching), 37 (analytics surface
that will render field data), 39 (sitemap and metadata, which affect crawl not paint).

**Scope**

- **Core Web Vitals targets.** Site-wide, at the 75th percentile, on a Moto G4 / Slow 4G lab profile
  and — once field data exists — on real devices:

  | Metric | Target | Rivya budget | Fails the build above |
  |---|---|---|---|
  | LCP | ≤ 2.5 s | ≤ 2.5 s, ≤ 2.0 s on text-led routes | 2.5 s |
  | CLS | ≤ 0.1 | ≤ 0.05 | 0.05 |
  | INP | ≤ 200 ms | ≤ 200 ms | 200 ms |
  | TTFB | ≤ 800 ms | ≤ 600 ms warm ISR, ≤ 1.2 s cold render | 800 ms warm |

- **Per-route budgets**, asserted by Lighthouse CI. "First-load JS" is gzipped and excludes any
  dynamically imported chunk that is not requested on load. "Islands" is the count of distinct
  client component roots.

  | Route | LCP | First-load JS | Islands | Notes |
  |---|---|---|---|---|
  | `/` | 2.5 s | 180 kB | 3 | Phase 11 budget, unchanged |
  | `/about`, `/process`, `/large-format` | 2.5 s | 150 kB | 2 | Media-heavy, low interactivity |
  | `/collection`, `/collection/[category]` | 2.5 s | 175 kB | 3 | Filters, sort, mobile filter drawer |
  | `/product/[slug]` | 2.5 s | 190 kB | 4 | Gallery, lightbox, inquiry launcher, viewer mount |
  | `/collections/[slug]` | 2.5 s | 165 kB | 3 | |
  | `/portfolio`, `/portfolio/[slug]` | 2.5 s | 150 kB | 2 | |
  | `/journal`, `/journal/[slug]`, `/journal/category/[slug]` | 2.0 s | 140 kB | 2 | Text-led |
  | `/custom-commissions` | 2.5 s | 200 kB | 4 | Configurator is the heaviest public client code |
  | `/contact` | 2.0 s | 160 kB | 2 | |
  | `/faq`, `/privacy`, `/terms` | 2.0 s | 120 kB | 1 | |
  | `/search` | 2.0 s | 170 kB | 3 | |
  | 3D viewer chunk | — | 350 kB | — | Measured separately; **never** in a first load |
  | `/studio/**` | — | 320 kB | — | Staff tool, authenticated, not indexed; INP ≤ 300 ms, CLS ≤ 0.1 |

  Transferred bytes for the initial viewport: ≤ 1.6 MB desktop, ≤ 900 kB mobile, on every public
  route.
- **Caching contract**, written down once:

  | Surface | Strategy | Invalidation |
  |---|---|---|
  | CMS pages (13 static paths) | ISR, `revalidate = 3600` | `revalidateTag('page:<path>')` from the Phase 08 publish service |
  | `/product/[slug]` | ISR, `revalidate = 3600`, `generateStaticParams` over published products | tags `product:<slug>`, `category:<slug>` |
  | `/collection/[category]` unfiltered | ISR, `revalidate = 3600` | tag `category:<slug>` |
  | `/collection/[category]` filtered | Dynamic; the list is an `unstable_cache` read keyed by the filter tuple, TTL 300 s | tag `category:<slug>` |
  | `/collections/[slug]`, `/portfolio/**`, `/journal/**` | ISR, `revalidate = 3600` | per-entity tags |
  | `/search` | Dynamic, `no-store` | — |
  | `/api/search/suggest` | `public, s-maxage=60, stale-while-revalidate=300` | Phase 23 rule, unchanged |
  | `/api/vitals`, `/api/inquiries`, `/api/revalidate` | `no-store` | — |
  | `/studio/**` | `private, no-store` on every response | — |
  | Cloudinary delivery | `public, max-age=31536000, immutable` | version-pinned public ids |
  | Static assets (`/_next/static`) | Vercel default immutable | build hash |

- **Guards, one per FEAT §46 rule.**

  | FEAT §46 rule | Guard | Failure mode |
  |---|---|---|
  | Server Components by default | `scripts/site/check-client-boundary.mjs` (Phase 10, extended to count islands per route against the budget table) | CI red |
  | Responsive Cloudinary transformations | `scripts/perf/check-image-props.mjs` — every `MediaImage` usage has `sizes`; no raw `<img>` outside `lib/media/**` | CI red |
  | AVIF/WebP where appropriate | `f_auto` is the only format directive permitted in `lib/media/transform.ts`; a unit test asserts no hard-coded `f_jpg` outside the `og` preset | Unit test |
  | Optimised video, posters | `scripts/perf/check-video-props.mjs` — every `MediaVideo` has a poster, `preload="none"`, `muted`, `playsInline`, and no `autoplay` attribute in markup | CI red |
  | Dynamic imports, lazy 3D | `scripts/perf/check-bundle.mjs` — asserts no route's first-load graph contains `three`, `@react-three/*` or a Draco/meshopt decoder | CI red |
  | Caching, CDN delivery | `scripts/perf/check-cache-headers.mjs` run against a running production build; asserts the table above | CI red |
  | JavaScript | `perf/bundle-baseline.json` committed; growth > 5 % on any route, or any new dependency in a first-load graph, fails until the baseline is updated in the same PR with a stated reason | CI red |

- **Exactly one `priority` image per route.** The LCP element is chosen deliberately, is always an
  image (never a video, never a WebGL canvas — Phase 11's rule generalised), and is asserted by
  Lighthouse CI's reported LCP element selector plus `scripts/perf/check-priority-images.mjs`.
- **No third parties.** No analytics script, tag manager, chat widget, font CDN, cookie banner
  vendor, A/B tool or pixel. `scripts/perf/check-third-party.mjs` fails on any `<script src>`,
  `<link href>` or `fetch` to an origin outside `{self, res.cloudinary.com, *.supabase.co}`. This is
  also a privacy and CSP position (Phase 41), not only a performance one.
- **Fonts.** `next/font` self-hosted, subset to Latin, at most two families (one display, one text),
  `font-display: swap`, and only the display face used above the fold is preloaded. Metric-compatible
  fallbacks are declared so a swap costs no layout shift.
- **First-party field data.** `web-vitals` reports LCP/CLS/INP/TTFB/FCP through `navigator.sendBeacon`
  to `app/api/vitals/route.ts`, sampled at 10 %. The payload carries route **pattern** (not the
  resolved URL, so no slug or query), metric, value, rating, `connection.effectiveType`,
  `deviceMemory` bucket, and a coarse viewport bucket. It carries **no** cookie, no IP, no user
  agent string, no identifier of any kind, and no session id — there are no customer accounts (D1)
  and this must not become the thing that creates one. Retention 90 days, pruned by the Phase 38
  cron.
- **Server-side latency.** Request-scoped query counting in development with a per-route budget
  (public route ≤ 4 database round trips, Studio list page ≤ 6); `React.cache` on every shared
  loader; no sequential awaits where `Promise.all` is correct. The counter logs a `WARNING` system
  log in preview and is a hard failure in `npm run test:e2e` for the routes it covers.
- **Documentation.** `docs/ops/PERFORMANCE.md` becomes the single source for the tables above and
  records, per route, the last measured value and the date.

**Out of scope**

- Any third-party RUM, APM or error-tracking SaaS. Errors go to `system_logs` (Phase 38).
- Edge runtime migration, streaming SSR redesign, partial pre-rendering, and any Next.js
  experimental flag. These are architecture changes, not tuning, and would need an amendment.
- Image or video **re-encoding** of manifest assets. Cloudinary derives; originals are untouched (D6).
- Database index tuning driven by the research subsystem (Phase 25–30 owns its own budgets).
- Removing features to hit a budget. A budget miss is reported and triaged; it does not authorise
  deleting a scoped capability.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Migration | `supabase/migrations/0380_phase40_web_vitals.sql` | `web_vitals_samples`, RLS, retention index |
| Vitals endpoint | `app/api/vitals/route.ts` | POST, beacon, Zod, rate-limited, `no-store` |
| Vitals reporter | `components/patterns/VitalsReporter.tsx` | Client; 10 % sample; no identifiers |
| Budgets as data | `perf/budgets.json` | The per-route table, read by both Lighthouse CI and the guards |
| Bundle baseline | `perf/bundle-baseline.json` | Committed; regenerated deliberately |
| Lighthouse config | `lighthouserc.json` (extended), `.github/workflows/lighthouse.yml` | Route matrix, mobile + desktop profiles |
| Bundle guard | `scripts/perf/check-bundle.mjs` | Baseline diff; 3D exclusion assertion |
| Island counter | `scripts/perf/count-islands.mjs` | Per-route island census vs budget |
| Image guard | `scripts/perf/check-image-props.mjs` | `sizes`, no raw `<img>`, one `priority` |
| Video guard | `scripts/perf/check-video-props.mjs` | Poster, `preload`, gates |
| Header guard | `scripts/perf/check-cache-headers.mjs` | Asserts the caching contract |
| Third-party guard | `scripts/perf/check-third-party.mjs` | Origin allowlist |
| Analyzer wiring | `next.config.ts` | `@next/bundle-analyzer` behind `ANALYZE=1` |
| Vitals card | `components/studio/analytics/VitalsCard.tsx` | Feeds the Phase 37 surface |
| Tests | `tests/unit/{vitals-payload,budget-config}.test.ts`, `tests/e2e/{perf-headers,perf-no-third-party}.spec.ts` | Payload has no identifier; headers match |
| Docs | `docs/ops/PERFORMANCE.md` | Targets, budgets, caching contract, measurement log |

**Database**

| Table | Key columns | Notes |
|---|---|---|
| `web_vitals_samples` | `id`, `route_pattern text not null`, `metric text check (metric in ('LCP','CLS','INP','TTFB','FCP'))`, `value numeric not null`, `rating text check (rating in ('good','needs-improvement','poor'))`, `nav_type text`, `effective_type text`, `device_memory_bucket text`, `viewport_bucket text`, `occurred_at timestamptz default now()` | **No** IP, user agent, session id, user id, referrer, slug or query string. Index on `(route_pattern, metric, occurred_at)`; 90-day retention |

RLS: no `anon` `select`. Insert is performed by the route handler with the service role after Zod
validation and rate limiting. `select` requires `analytics.read`.

**Studio surface** — no new route. Adds a Web Vitals card to `/studio` overview and a Performance
panel to the Phase 37 analytics surface (p75 per metric per route pattern, last 28 days, with an
explicit "sampled at 10 %, lab targets are separate" caption so nobody reads it as complete data —
FEAT §28: do not manufacture unavailable analytics).

**Public surface** — `app/api/vitals` only. Every existing public route changes in bytes and headers,
not in markup semantics.

**Media** — none consumed and none generated. This phase changes only the derived transformations
requested from Cloudinary for assets already bound.

**Risks**

| Risk | Mitigation |
|---|---|
| The budget becomes advisory and is quietly exceeded | `perf/budgets.json` is the single source for both Lighthouse assertions and the guard scripts; exceeding it fails CI, and raising it requires editing the file in the same PR with a stated reason a reviewer sees |
| Field data becomes visitor tracking | The payload schema has no field capable of identifying anyone; `vitals-payload.test.ts` asserts the Zod schema rejects any extra key, and `perf-no-third-party.spec.ts` asserts no cookie is set on any public route |
| A single slow route drags a site-wide claim | Budgets are per route and reported per route; `PERFORMANCE.md` records the measured value and date per route, never one number for "the site" |
| The 3D chunk leaks into a first load | `check-bundle.mjs` asserts the module graph; `tests/e2e/model-viewer.spec.ts` (Phase 21) already asserts zero 3D bytes with the flag off; both run in CI |
| Cloudinary transformations multiply and blow the derived-asset quota | The preset list in `lib/media/transform.ts` is closed (Phase 06); `check-image-props.mjs` rejects an inline transformation string; the width ladder is fixed |
| Lighthouse variance produces flaky red builds | Three runs per URL, median taken, `assertions` use `warn` for the first two weeks then `error`; a genuine regression shows on all three runs and in the bundle diff, which is deterministic |
| Someone adds a cookie banner vendor to satisfy a legal review | Forbidden by `check-third-party.mjs`. If consent tooling is required, it is a first-party component and an amendment — raised in *Open questions* |

**Verification**

1. `npm run build` then `node scripts/perf/check-bundle.mjs` — every route within baseline + 5 %; no `three`, `@react-three/fiber`, `@react-three/drei`, Draco or meshopt module in any first-load graph.
2. `node scripts/perf/count-islands.mjs` — every route at or under its island budget; add a fourth island to `/about` and confirm it fails naming the route.
3. `npx lhci autorun` over the route matrix — every route meets its LCP, CLS, INP and JS budget; the reported LCP element on each route is an `<img>`.
4. `npm start` then `node scripts/perf/check-cache-headers.mjs` — every row of the caching contract matches, including `private, no-store` on `/studio` and `immutable` on a Cloudinary URL.
5. `node scripts/perf/check-third-party.mjs --base http://localhost:3000` — zero external origins; add a Google Fonts `<link>` and confirm it fails.
6. `node scripts/perf/check-image-props.mjs` and `check-video-props.mjs` — green. Remove `sizes` from one `MediaImage` usage and confirm failure; remove a poster and confirm failure.
7. `npm run test:unit -- vitals-payload budget-config` — green, including the assertion that the vitals Zod schema rejects `ip`, `userAgent`, `sessionId`, `userId` and `url`.
8. Load `/` in a real browser, confirm exactly one beacon to `/api/vitals` per metric within the sample, and inspect the request body: no identifier, route **pattern** only (`/product/[slug]`, never `/product/some-slug`).
9. `psql -c "select count(*) from web_vitals_samples"` as `anon` → permission denied.
10. Throttle to Slow 4G in DevTools on `/product/[slug]` with a published product: LCP element is the hero still, TTFB warm ≤ 600 ms, no layout shift on video mount.

**Exit criteria**

- [ ] `perf/budgets.json` contains every public route with LCP, JS and island budgets, and is the only place those numbers live.
- [ ] Lighthouse CI asserts the budget on the full route matrix, not only `/`, and is red on regression.
- [ ] The bundle baseline is committed and a > 5 % growth fails until deliberately updated.
- [ ] Zero 3D bytes appear in any route's first load, proved by the module-graph guard.
- [ ] Every image usage declares `sizes`; exactly one `priority` image exists per route; every video has a poster and mounts behind the Phase 11 gates.
- [ ] The caching contract is implemented and asserted against a running production build.
- [ ] No third-party origin is contacted by any public route, proved by script and by e2e.
- [ ] `web_vitals_samples` collects field data with no identifier of any kind, at 10 % sampling, with 90-day retention.
- [ ] `docs/ops/PERFORMANCE.md` records targets, per-route budgets, the caching contract and dated measurements.
- [ ] Phase-specific D9 evidence: docs updated = `PERFORMANCE.md`, `ARCHITECTURE.md`; tests run = `vitals-payload`, `budget-config`, `perf-headers.spec.ts`, `perf-no-third-party.spec.ts`, Lighthouse CI matrix; next phase = 41.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 41 — Accessibility + Security

**Goal** — the two qualities that cannot be retrofitted are audited and locked. Accessibility work
has been done per-phase (keyboard models, focus traps, axe checks at two widths) but never as a
whole: this phase runs a full WCAG 2.2 AA conformance pass across every public route and the Studio,
fixes what it finds, and installs guards so a later change cannot silently regress it. Security work
has been layered in the same way (RLS in Phase 04, signed uploads in Phase 06, permission checks
everywhere, research isolation in Phase 25) and here becomes a stated posture: a response-header set
including a nonce-based CSP, a rate-limit table, an upload-safety contract, a PII and retention
policy for inquiry data, secret-scanning in CI, and a written, tested statement of exactly which
values may never leave the server.

**Depends on** — Phase 02 (tokens, focus styles, `Dialog`/`Drawer` primitives), 04 (RBAC, RLS,
`audit_log`), 05 (Studio shell), 06 (signed upload endpoint, MIME allowlist, size caps), 10 (site
shell, skip link, navigation keyboard model), 14–21 (the surfaces being audited), 20 (`inquiries`
and its uploads — the only personal data in the system), 25–30 (research subsystem, whose isolation
invariants this phase re-asserts), 38 (system logs, environment page), 40 (the third-party ban that
makes a strict CSP achievable).

**Scope**

The phase has two halves. They ship together because they share the same audit-and-guard shape and
the same surfaces, and because separating them invites one of the two to be deferred.

*Part A — Accessibility (FEAT §48)*

- **Stated target: WCAG 2.2 Level AA**, plus two Rivya rules that exceed it: a 44 × 44 CSS px minimum
  touch target (AA requires 24 × 24), and `prefers-reduced-motion` honoured by every animation
  without exception.
- **Every §48 item mapped to a criterion and a mechanism:**

  | FEAT §48 item | Criterion | Mechanism | Enforced by |
  |---|---|---|---|
  | Semantic HTML | 1.3.1 | One `<header>`, `<nav>`, `<main>`, `<footer>` per page; lists are lists; tables have `<caption>` and `<th scope>` | axe + `tests/e2e/a11y/landmarks.spec.ts` |
  | Heading hierarchy | 1.3.1, 2.4.6 | Exactly one `<h1>` per route, no skipped levels; CMS section headings render at the level the block declares, not the level that looks right | `tests/e2e/a11y/headings.spec.ts` walks the tree per route |
  | Keyboard navigation | 2.1.1, 2.1.2 | Every interactive element reachable and operable; no keyboard trap outside an intentional modal | Route-by-route keyboard scripts in Playwright |
  | Focus visibility | 2.4.7, 2.4.11 | A single `:focus-visible` token pair (ring + offset) with ≥ 3:1 contrast against both adjacent surfaces; never `outline: none` without a replacement | `scripts/a11y/check-focus-styles.mjs` greps for unreplaced `outline: none` |
  | Form labels | 1.3.1, 3.3.2 | Every control has a programmatic label; placeholder is never the label; `autocomplete` tokens on name, email, tel | axe + `tests/e2e/a11y/forms.spec.ts` |
  | Screen-reader labels | 4.1.2 | Icon-only controls carry `aria-label` from `global_content`, not a literal; live regions for search results, filter counts, save confirmations | Manual pass + axe |
  | Alt text | 1.1.1 | `media_assets.alt_text` non-empty for every bound asset; decorative images set `media_assets.is_decorative = true` which renders `alt=""` — an empty string is never produced by accident | `tests/unit/alt-text-coverage.test.ts` |
  | Contrast | 1.4.3, 1.4.11 | ≥ 4.5:1 body text, ≥ 3:1 large text and UI boundaries, on every token pair the design system permits | `scripts/a11y/check-contrast.mjs` over the token matrix |
  | Reduced motion | 2.3.3 | One `usePrefersReducedMotion` source; a global CSS block that neutralises transitions and animations; video autoplay suppressed | `tests/e2e/a11y/reduced-motion.spec.ts` |
  | Accessible dialogs | 2.4.3, 4.1.2 | `role="dialog"` + `aria-modal`, labelled, focus moved in and restored out, `Escape` closes, background inert | Per-component e2e (lightbox, drawer, confirm, command palette) |
  | Accessible tabs | 4.1.2 | APG tab pattern: roving tabindex, `aria-selected`, arrow keys | Studio tab components |
  | Accessible navigation | 2.4.1, 2.4.5 | Skip link first in DOM; mega menu and mobile drawer per Phase 10's model; breadcrumbs with `aria-current="page"` | `tests/e2e/navigation-a11y.spec.ts` (Phase 10, extended) |
  | Touch target size | 2.5.8 | 44 × 44 minimum, measured as the hit box not the glyph | `tests/e2e/a11y/touch-targets.spec.ts` at 390 px |

- **Three additional skip links** beyond Phase 10's: skip to filters on `/collection/[category]`,
  skip to results on `/search`, skip to the section list in the Studio page editor.
- **Automated sweep.** `@axe-core/playwright` over every public route and seven representative
  Studio routes, at 1440 px and 390 px, asserting **zero critical and zero serious** violations.
  Moderate and minor violations are logged to an artefact and triaged, not ignored. An exception
  file `tests/e2e/a11y/exceptions.json` exists but ships with **zero rows**; adding a row requires a
  reason, an owner, and a dated review, and the test prints the whole list on every run.
- **Manual passes that automation cannot replace**, recorded in `docs/ops/ACCESSIBILITY.md` with
  tester, date, tool version and outcome: a full keyboard-only traversal of the conversion path
  (`/` → category → product → inquiry → WhatsApp handoff), a screen-reader pass of the same path,
  a 200 % zoom and a 320 px-reflow pass, and a Studio pass of the publish workflow. These are
  statements of work done, not capability claims; the document records what was tested, not that the
  site "is accessible".
- **Accessibility statement page.** Not built. A published accessibility statement is a legal and
  factual claim about an organisation, and only the owner can make it — recorded as
  **OWNER_VERIFICATION_REQUIRED** in the Phase 46 handoff backlog with a drafted skeleton in
  `global_content` at `DRAFT`.

*Part B — Security (FEAT §47)*

- **The never-expose list.** These values must never reach a client bundle, a client-side network
  response, a log line, an error message, a Studio screen, a screenshot, a support email, or the
  Environment page. D8 already forbids showing even a prefix or a length.

  | Variable | Class | May appear in client bundle | May appear in logs | Environment page shows |
  |---|---|---|---|---|
  | `SUPABASE_SERVICE_ROLE_KEY` | Secret — full database bypass | Never | Never | Reachability boolean only |
  | `DATABASE_URL` | Secret — contains credentials | Never | Never | Migration state only |
  | `CLOUDINARY_API_SECRET` | Secret — signs uploads and deletions | Never | Never | Reachability boolean only |
  | `CLOUDINARY_API_KEY` | Sensitive — paired with the secret | Never | Never | Reachability boolean only |
  | `GOOGLE_SERVICE_ACCOUNT_JSON` | Secret — impersonates a service identity | Never | Never | Reachability boolean only |
  | `GOOGLE_SHEETS_SPREADSHEET_ID` | Sensitive — identifies private data | Never | Never | Boolean configured/not |
  | `REVALIDATE_SECRET` | Secret — forces cache invalidation | Never | Never | Boolean configured/not |
  | `SCRAPER_USER_AGENT` | Server-only, not secret | Never | Value permitted | Value permitted |
  | `NEXT_PUBLIC_*` (five names, D8) | Public by design | Yes | Yes | Value permitted |

  Enforcement, four independent layers: (1) every module reading a server secret imports
  `server-only`; (2) `scripts/security/check-secret-exposure.mjs` greps the built `.next/static`
  output for each server-only name **and** for high-entropy strings matching known key shapes,
  failing the build on a hit (this generalises the Phase 04 check, which covered two names);
  (3) `lib/logging/redact.ts` runs an allowlist redactor over every log payload and every
  `audit_log` `before`/`after` blob; (4) `gitleaks` scans history and the diff in CI.
- **Response headers**, set in `middleware.ts` for every response and asserted by e2e:

  | Header | Value |
  |---|---|
  | `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'nonce-<per-request>' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://res.cloudinary.com; media-src 'self' blob: https://res.cloudinary.com; font-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.cloudinary.com; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests` |
  | `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
  | `X-Content-Type-Options` | `nosniff` |
  | `Referrer-Policy` | `strict-origin-when-cross-origin` |
  | `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()` |
  | `Cross-Origin-Opener-Policy` | `same-origin` |
  | `X-Frame-Options` | `DENY` (belt and braces with `frame-ancestors`) |

  Two documented exceptions with reasons, both recorded in `docs/ops/SECURITY.md`:
  `style-src 'unsafe-inline'` is required by Next.js's inline style injection and Tailwind's runtime
  style element; `worker-src blob:` is required by the Draco and meshopt decoders the Phase 21
  viewer loads. `payment=()` is deliberate and permanent — there is no payment surface (D1). The
  WhatsApp handoff is a link navigation, not a form submission, so `form-action 'self'` does not
  affect it. CSP ships `Report-Only` for one week against a preview deployment, with reports
  collected to `system_logs`, then enforced.
- **Rate limiting**, fixed-window counters in Postgres (no Redis exists in the stack — D1):

  | Surface | Limit | Key |
  |---|---|---|
  | `POST /api/inquiries` | 5 per 10 min | `ip_hash` + form fingerprint |
  | Inquiry file upload | 10 per hour | `ip_hash` |
  | `POST /api/uploads/sign` (Studio) | 20 per hour | staff `user_id` |
  | `GET /api/search/suggest` | 60 per min | `ip_hash` |
  | `POST /api/vitals` | 60 per min | `ip_hash` |
  | `POST /api/revalidate` | 30 per min | secret |
  | Studio sign-in | 10 per 15 min | email hash + `ip_hash` |
  | Research single-URL probe | Phase 26 rule, unchanged | source |

  `ip_hash` is `hmac(ip, server_salt)`; the raw address is never stored, matching the `ip_hash`
  convention already used by Phase 20. A limited request returns 429 with `Retry-After` and writes a
  `SECURITY` system log, never an `audit_log` row (it has no actor).
- **Upload safety.** Magic-byte sniffing, not extension trust; the Phase 06 MIME allowlist enforced
  server-side after sniffing; size caps 25 MB image / 200 MB video / 50 MB model; **SVG rejected
  outright** for every upload path, staff included, because a sanitiser is a permanent liability and
  no Rivya surface needs an uploaded SVG; EXIF and GPS stripped on ingest; GLB parsed with
  `@gltf-transform/core` before acceptance (Phase 21) and rejected on parse failure; inquiry
  attachments stored in a **private** bucket, served only through an authenticated, short-lived
  signed URL, always with `Content-Disposition: attachment`.
- **Mutation surface.** Every server action and route handler: origin check, Zod parse, session
  resolve, permission check, then work; `audit_log` row on success and on denial (Phase 04). A
  destructive action additionally requires typed confirmation (Phase 24) and re-authentication if
  the session is older than 30 minutes. `scripts/security/check-action-guards.mjs` asserts every
  exported server action calls the permission helper.
- **Auth hardening.** Public sign-up disabled in the Supabase project (a deployment checklist item,
  Phase 44); staff created by invitation only; role changes require `owner`; session cookies
  `HttpOnly`, `Secure`, `SameSite=Lax`, rotated on privilege change; idle timeout 8 hours, absolute
  30 days. MFA for `owner` and `admin` is **strongly recommended** and configured in the Supabase
  dashboard — an owner decision, recorded **OWNER_VERIFICATION_REQUIRED** in the handoff.
- **Personal data.** The only personal data in the system is in `inquiries` and its attachments:
  name, contact details, message, uploaded reference files. Policy: minimum retention of 24 months
  from last activity, then anonymisation (contact fields nulled, row kept for counts); an owner-only
  Studio action to export or erase a single enquirer's data on request; personal fields never in
  `search_documents` (Phase 23 rule, re-asserted by test), never in `web_vitals_samples`, never in
  `audit_log` blobs (redactor), never in a WhatsApp URL beyond what the enquirer themselves typed.
  The privacy and terms pages describe these mechanisms but **cannot** name a legal entity,
  jurisdiction, controller or statutory basis — all four are **OWNER_VERIFICATION_REQUIRED** and the
  pages stay `DRAFT` until the owner supplies them.
- **Dependency and supply chain.** `npm audit --audit-level=high` in CI; Dependabot on weekly
  cadence; the lockfile is the only accepted resolution source; `scripts/security/check-licenses.mjs`
  rejects a copyleft licence entering `dependencies`.

**Out of scope**

- A penetration test or a formal security audit. Both are engagements the owner commissions; this
  phase produces the posture and the evidence they would review.
- Any compliance certification claim (ISO, SOC 2, PCI). Naming one would violate D10 and PCI is
  meaningless here — there is no payment surface.
- WAF, bot management, DDoS tuning beyond the platform default.
- A cookie consent banner. No third-party script, no analytics cookie and no advertising identifier
  exists (Phase 40), so the site sets only a dismissal preference and the session cookie. Whether a
  banner is nonetheless legally required is **OWNER_VERIFICATION_REQUIRED**.
- Encryption at rest beyond what Supabase and Cloudinary provide by default.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Migrations | `supabase/migrations/0390_phase41_security.sql`, `0391_phase41_a11y.sql` | `rate_limit_buckets`, `media_assets.is_decorative`, retention job metadata |
| Middleware headers | `middleware.ts` | Nonce generation, the header table, preview `noindex` |
| CSP nonce plumbing | `lib/security/csp.ts` | Nonce per request, propagated to `<Script>` and inline styles |
| Rate limiter | `lib/security/rate-limit.ts` | Fixed window over Postgres; `ip_hash` helper |
| Redactor | `lib/logging/redact.ts` | Allowlist; used by logs and `audit_log` |
| Upload validation | `lib/media/validate-upload.ts` | Magic bytes, size, SVG rejection, EXIF strip |
| PII tooling | `lib/inquiries/pii.ts`, `scripts/ops/anonymise-inquiries.ts` | Export, erase, scheduled anonymisation |
| Focus + contrast guards | `scripts/a11y/{check-focus-styles.mjs,check-contrast.mjs}` | Token matrix; wired into `npm run check` |
| Secret guards | `scripts/security/{check-secret-exposure.mjs,check-action-guards.mjs,check-licenses.mjs}` | Build output, action guards, licences |
| Gitleaks | `.github/workflows/security.yml`, `.gitleaks.toml` | History + diff scan, `npm audit`, Dependabot |
| a11y suite | `tests/e2e/a11y/{axe-sweep,landmarks,headings,forms,touch-targets,reduced-motion,zoom-reflow}.spec.ts` | Every public route + 7 Studio routes |
| a11y exceptions | `tests/e2e/a11y/exceptions.json` | Ships with zero rows |
| Security tests | `tests/unit/{redaction,rate-limit-window,upload-validation,pii-scope}.test.ts`, `tests/e2e/{security-headers,studio-authz}.spec.ts` | Redaction, limits, sniffing, headers, authz |
| Docs | `docs/ops/ACCESSIBILITY.md`, `docs/ops/SECURITY.md` | Conformance table, manual pass log, posture, never-expose list, runbooks |

**Database**

| Table | Key columns | Notes |
|---|---|---|
| `rate_limit_buckets` | `bucket_key text not null`, `window_start timestamptz not null`, `count int not null default 0`, `primary key (bucket_key, window_start)` | Fixed window; pruned by the Phase 38 cron; service-role writes only, no `anon` policy |
| `media_assets` (altered) | `+ is_decorative boolean not null default false` | Renders `alt=""` deliberately; `alt_text` must be non-empty **unless** this is true — enforced by a check constraint |

RLS: `rate_limit_buckets` has no policy for `anon` or `authenticated`; only the service role touches
it. The `media_assets` constraint is
`check (is_decorative or (alt_text is not null and length(btrim(alt_text)) > 0))`.

**Studio surface** — no new route. Adds: an "Accessibility" panel to the media asset drawer (alt
text, decorative toggle, contrast preview of any text overlay), a "Data request" action on
`/studio/inquiries/all` gated to `owner` (export or erase one enquirer), and a Security section on
`/studio/system/environment` showing header presence, CSP mode, rate-limit configuration and the
last dependency-audit result — **reachability and configuration state only, never a value** (D8).

**Public surface** — no new route. Every response gains the header set. `/collection/[category]` and
`/search` gain skip links. 429 responses become possible on the five public endpoints listed above,
rendering the SEED §49 form-error copy rather than a raw status page.

**Media** — none consumed, none generated. All 250 manifest assets are audited for alt-text quality:
the manifest's `alt_text_draft` values are truncated prompt text (they end mid-sentence with an
ellipsis), which fails 1.1.1 in spirit even though the field is non-empty. Rewriting them is Phase
43's job; this phase supplies the constraint and the count.

**Risks**

| Risk | Mitigation |
|---|---|
| A secret reaches the client bundle | Four independent layers (`server-only`, build-output grep including entropy patterns, redactor, gitleaks), all in CI; `check-secret-exposure.mjs` is seeded with a deliberate counter-example in its own test |
| A strict CSP breaks the 3D viewer or Cloudinary media in production only | Report-Only for a week on a preview deployment with reports to `system_logs`; `security-headers.spec.ts` loads a page with the viewer enabled and asserts zero violation reports before enforcement |
| Rate limiting locks out a legitimate enquirer | Limits are per action and generous (5 inquiries per 10 minutes); a 429 renders seeded copy with `Retry-After`; the owner can see limited attempts in `SECURITY` logs and raise a limit from settings without a deploy |
| Fixed-window limiting allows a 2× burst at a window boundary | Accepted and documented. The threat is abuse volume, not precision; a sliding window would need Redis, which D1 does not include |
| The axe sweep is satisfied while the site is unusable by keyboard | Automated axe is one of seven suites; keyboard traversal, headings, touch targets, reflow and reduced motion are separate specs, and two manual passes with a named tester and date are exit criteria |
| The a11y exception file becomes a dumping ground | It ships empty, prints in full on every run, requires a reason and owner per row, and its row count is an exit-criterion assertion |
| Anonymisation destroys data the owner still needs | Anonymisation nulls contact fields and keeps the row, its type, its status and its timestamps, so counts and history survive; the script is dry-runnable and reports exactly which rows it would touch |
| Legal copy asserts a jurisdiction or entity nobody confirmed | Privacy and terms stay `DRAFT` with `OWNER_VERIFICATION_REQUIRED`; the Phase 08 publish trigger physically prevents publication until the owner verifies (D10) |

**Verification**

1. `npm run build && node scripts/security/check-secret-exposure.mjs` — exits 0. Add `console.log(process.env.SUPABASE_SERVICE_ROLE_KEY)` to a client component, rebuild, confirm it exits non-zero naming the chunk.
2. `npm run test:unit -- redaction rate-limit-window upload-validation pii-scope` — green, including: the redactor removes every never-expose name from a nested payload; a fixed window resets correctly at the boundary; a `.png` file with a `.svg` payload is rejected by magic-byte sniffing; no inquiry personal field appears in `search_documents` or `web_vitals_samples`.
3. `npm start` then `curl -sI localhost:3000/` — every header in the table present with the exact value; `curl -sI localhost:3000/studio` additionally `private, no-store` and `X-Robots-Tag: noindex, nofollow`.
4. `npx playwright test tests/e2e/security-headers.spec.ts` — CSP nonce differs per request; no inline script without a nonce; the 3D viewer loads with the flag on and produces zero CSP violations.
5. `npx playwright test tests/e2e/studio-authz.spec.ts` — as `viewer`, direct POSTs to publish, bulk-apply, media-delete and role-change all return 403 and each writes an `audit_log` row with `result='DENIED'`.
6. POST `/api/inquiries` six times in ten minutes from one client → the sixth returns 429 with `Retry-After` and a `SECURITY` system log; the first five persist.
7. Upload an SVG through `/studio/media/all` → rejected with a stated reason. Upload a 30 MB JPEG → rejected on size. Upload a JPEG renamed `.glb` → rejected on sniffing.
8. `npx playwright test tests/e2e/a11y/` — the full sweep: zero critical and zero serious axe violations on every public route and the seven Studio routes at 1440 px and 390 px; heading order valid on every route; every interactive target ≥ 44 × 44 at 390 px; `exceptions.json` has zero rows.
9. `node scripts/a11y/check-contrast.mjs` — every permitted token pair meets its ratio. Darken one body-text token by 10 % and confirm failure naming the pair.
10. `node scripts/a11y/check-focus-styles.mjs` — no unreplaced `outline: none`.
11. Manual, recorded in `ACCESSIBILITY.md` with tester and date: keyboard-only traversal of `/` → category → product → inquiry → WhatsApp handoff, completing the conversion without a mouse; the same path with a screen reader; 200 % zoom and 320 px reflow with no horizontal scroll and no lost content.
12. `psql -c "update media_assets set alt_text='', is_decorative=false where id='<id>'"` → rejected by the check constraint.
13. `gitleaks detect --redact` and `npm audit --audit-level=high` — both clean in CI.

**Exit criteria**

- [ ] WCAG 2.2 AA is the stated target; every FEAT §48 item maps to a criterion, a mechanism and a passing test.
- [ ] Zero critical and zero serious axe violations across every public route and seven Studio routes at 1440 px and 390 px, with `exceptions.json` empty.
- [ ] Heading order, landmarks, form labelling, touch targets (44 × 44), reduced motion, 200 % zoom and 320 px reflow all pass by automated spec or recorded manual pass.
- [ ] Every bound media asset has non-empty alt text or an explicit `is_decorative` flag, enforced by a database constraint.
- [ ] The full response-header set including a nonce-based CSP is enforced on every route, with both exceptions documented and justified.
- [ ] No value on the never-expose list can reach a client bundle, a log, an error, a Studio screen or the Environment page — proved by four independent guards, each with a seeded counter-example.
- [ ] Rate limiting is active on all eight listed surfaces, returns seeded copy with `Retry-After`, and stores only `ip_hash`.
- [ ] Upload validation sniffs magic bytes, rejects SVG outright, strips EXIF, parses GLB, and serves inquiry attachments only through short-lived signed URLs from a private bucket.
- [ ] Inquiry personal data is absent from every index, sample, log and audit blob, proved by test; export, erase and scheduled anonymisation all work and are dry-runnable.
- [ ] Privacy and terms remain `DRAFT` with `OWNER_VERIFICATION_REQUIRED`; no accessibility, compliance or certification claim is published anywhere.
- [ ] `gitleaks`, `npm audit` and the licence check run in CI and are green.
- [ ] Phase-specific D9 evidence: docs updated = `ACCESSIBILITY.md`, `SECURITY.md`, `DATA_MODEL.md`, `MEDIA_GUIDE.md`; tests run = four unit suites, seven a11y specs, two security specs; next phase = 42.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 42 — Comprehensive Testing

**Goal** — the test suite stops being the sum of per-phase specs and becomes a single, deterministic,
documented QA system that a reviewer can run in one command and trust. Phase 42 builds the fixture
database that every suite shares, defines what belongs in each of the four layers, installs the
visual QA matrix at the eight FEAT §45 widths across a tiered route list, sets coverage requirements
that cannot be gamed by testing getters, defines a flake policy, and writes `docs/ops/TESTING.md` as
the document a new engineer reads before writing their first test. When this lands, "the tests pass"
is a meaningful sentence.

**Depends on** — Phase 00 (`vitest.config.ts`, `playwright.config.ts` with the eight §45 projects,
CI), 03 (migrations, `db:reset`), 04 (roles, for fixtures per role), 06 (media provider, to be
intercepted), 09 (the seed, which the fixture publishes), and every phase 10–41 that contributed a
spec. Phases 40 and 41 own their budgets and their a11y assertions; Phase 42 runs them, it does not
redefine them.

**Scope**

- **Four layers, with a rule for what goes where.**

  | Layer | Runner | Environment | Owns | Never |
  |---|---|---|---|---|
  | Unit | Vitest | `node`, no network, no DB | Pure functions: validation, transforms, WhatsApp rendering, price-state logic, SEO builders, relation rules, adapters, redaction | Rendering a page, touching Supabase |
  | Integration | Vitest | Local Supabase via `supabase start` | Repositories, RLS policies, triggers, migrations, seed idempotency, publish gates | Browser behaviour |
  | E2E | Playwright | Production build + fixture DB | User journeys, permissions in the real request path, keyboard models, forms, the conversion path | Asserting pixel colour |
  | Visual | Playwright snapshots | Same, animations frozen | Layout and composition at the eight widths | Asserting text content |

- **One deterministic fixture, built not seeded ad hoc.** `scripts/test/seed-fixture.ts` produces a
  known database state: the Phase 09 content **published**, three products entered as an owner would
  (with `PRICE_ON_REQUEST`, `STARTING_FROM` and `FIXED` price states so every branch is covered),
  one collection, one portfolio project, two journal articles, ten FAQs, five inquiries in different
  states, one research source with one run and twenty research products, and one staff user per
  role. IDs and slugs are fixed constants in `tests/fixtures/ids.ts`; timestamps come from a frozen
  clock at `2026-01-15T12:00:00Z`. Nothing in the fixture is a business fact — the products are
  obviously fictional test rows, they exist only in the fixture database, and
  `scripts/test/check-fixture-isolation.mjs` fails if a fixture id, slug or title string appears
  anywhere outside `tests/**`.
- **Media determinism.** Cloudinary is never contacted in tests. A Playwright route handler
  intercepts `res.cloudinary.com` and serves twelve committed low-resolution derivatives under
  `tests/fixtures/media/` — one per ratio plus one poster and one short video — so snapshots do not
  depend on a CDN, a network, or a quota. The derivatives are generated once by
  `scripts/test/build-fixture-media.ts` from assets already in the manifest and are committed as
  small files; the originals are untouched (D6).
- **The visual QA matrix.** Routes are tiered so the matrix is exhaustive where composition is
  load-bearing and economical where it is not.

  | Tier | Widths | Routes | Snapshots |
  |---|---|---|---|
  | A — all eight §45 widths | 1920 · 1440 · 1280 · 1024 · 768 · 430 · 390 · 360 | `/`, `/large-format`, `/collection/[category]`, `/product/[slug]` | 32 |
  | B — five widths | 1920 · 1440 · 1024 · 768 · 390 | `/about`, `/process`, `/collection`, `/collections/[slug]`, `/custom-commissions`, `/portfolio`, `/journal`, `/journal/[slug]`, `/contact`, `/faq`, `/search` | 55 |
  | C — two widths | 1440 · 390 | `/privacy`, `/terms`, `/portfolio/[slug]`, `/journal/category/[slug]`, 404, 500 | 12 |
  | Studio — four widths | 1920 · 1440 · 1280 · 1024 | `/studio`, `/studio/catalog/products`, `/studio/content/pages`, `/studio/media/all`, `/studio/inquiries/all`, `/studio/research/dashboard`, `/studio/system/environment` | 28 |

  127 snapshots total. Studio is not snapshotted below 1024 px: it is a desktop tool, and Phase 05
  states so.
- **Snapshot stability rules**, all mandatory: `prefers-reduced-motion: reduce` forced;
  `animations: 'disabled'`; fonts preloaded and `document.fonts.ready` awaited; media from the
  fixture interceptor; the frozen clock; dynamic regions (relative timestamps, run durations,
  random ids) masked with `mask:`; `maxDiffPixelRatio: 0.002`; one platform (the CI container image,
  pinned) is the only source of accepted baselines — a local re-baseline is never committed.
- **FEAT §45 surface checklist.** Every item §45 names has a named owning spec, so "check the
  scraper at 768 px" is a file, not a memory:

  | §45 surface | Owning spec |
  |---|---|
  | navigation | `tests/e2e/site-shell.spec.ts`, `navigation-a11y.spec.ts` |
  | hero, typography, media crop | `tests/visual/tier-a.visual.spec.ts` |
  | product cards, product galleries | `tests/e2e/catalogue.spec.ts`, `product-gallery-a11y.spec.ts` |
  | 3D | `tests/e2e/model-viewer.spec.ts` (flag on and off) |
  | motion | `tests/e2e/a11y/reduced-motion.spec.ts` |
  | forms | `tests/e2e/{contact-form,commission-configurator,inquiry-conversion}.spec.ts` |
  | filters, search | `tests/e2e/{catalogue-filters,search-public,search-combobox-a11y}.spec.ts` |
  | CMS-driven content | `tests/e2e/cms-workflow.spec.ts`, `tests/integration/seed-idempotency.test.ts` |
  | Studio | `tests/visual/studio.visual.spec.ts`, `tests/e2e/studio-authz.spec.ts` |
  | scraper | `tests/e2e/{research-dashboard,research-run-lifecycle}.spec.ts` |
  | charts, tables | `tests/e2e/studio-analytics.spec.ts`, `tests/visual/studio.visual.spec.ts` |
  | responsive behaviour | the visual matrix above |
  | touch interactions | `tests/e2e/touch.spec.ts` — swipe on the gallery, tap targets, drawer drag, at 390 px with touch emulation |

- **Coverage requirements that resist gaming.** No single global percentage. Instead: statements
  ≥ 80 % over `lib/**`, and **100 % branch coverage** on a named critical list —
  `lib/whatsapp/shorten.ts`, `lib/catalog/price-state.ts`, `lib/auth/permissions.ts`,
  `lib/seo/jsonld/guard.ts`, `lib/security/rate-limit.ts`, `lib/logging/redact.ts`,
  `lib/media/validate-upload.ts`, `lib/relations/rules.ts`, `lib/scraper/normalization/**`. The list
  lives in `vitest.config.ts` and adding a file to it is easier than removing one: removal requires
  a reviewer note.
- **The conversion path is tested end to end, every run.** `/` → category → product → "Enquire" →
  form validation errors → successful submit → **inquiry row persisted** → success state (SEED §48)
  → WhatsApp URL built from the persisted reference. And the negative: force a persistence failure
  and assert the visitor is **not** redirected to WhatsApp and sees the SEED §49 save-error copy.
  This is the business rule that matters most (D1, SEED §49) and it is asserted, not assumed.
- **Flake policy.** A test that fails twice in thirty days on `main` is quarantined into a
  `@flaky`-tagged project that still runs and still reports, with a tracking issue naming an owner
  and a date. It is never deleted and never `.skip`-ped without that issue. CI reports the
  quarantine list size on every run; a non-zero list is visible, not hidden.
- **CI shape.** Unit and integration on every push. E2E and visual sharded four ways on pull
  requests to `main` and on `main` itself. Lighthouse (Phase 40) and the a11y sweep (Phase 41) as
  separate required jobs. Traces, videos and diff images uploaded as artefacts on failure, retained
  14 days. Total wall clock target ≤ 15 minutes for the required set.
- **Manual release checklist.** `docs/ops/TESTING.md` carries a per-release manual pass that
  automation cannot do: read every public page for tone and factual integrity against SEED §55, open
  the site on a real phone, complete one real WhatsApp handoff to a test number, and confirm no page
  presents concept media as delivered work (D6, D10).

**Out of scope**

- Load and stress testing. There is no traffic model yet; a synthetic number would be theatre.
- Cross-browser beyond Chromium, WebKit and Firefox at the matrix widths; no IE, no legacy Edge.
- Real-device cloud testing services (a third-party dependency; the manual pass covers one real
  device).
- Mutation testing, property-based testing and contract testing against third parties.
- Re-defining performance budgets (Phase 40) or a11y assertions (Phase 41). Phase 42 executes them.
- Testing the research subsystem against live competitor sites. Fixtures only — Phase 25's rule.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Fixture builder | `scripts/test/seed-fixture.ts` | Deterministic; idempotent; `--reset` |
| Fixture constants | `tests/fixtures/ids.ts` | Fixed uuids, slugs, reference codes |
| Fixture media | `tests/fixtures/media/**`, `scripts/test/build-fixture-media.ts` | Twelve committed derivatives |
| Media interceptor | `tests/support/media-route.ts` | Playwright route handler for `res.cloudinary.com` |
| Fixture isolation guard | `scripts/test/check-fixture-isolation.mjs` | Fixture strings never appear outside `tests/**` |
| Playwright projects | `playwright.config.ts` (extended) | Eight §45 widths, tiers, `@flaky` project, sharding |
| Visual specs | `tests/visual/{tier-a,tier-b,tier-c,studio}.visual.spec.ts` | 127 snapshots |
| Journey specs | `tests/e2e/{inquiry-conversion,touch,catalogue-filters}.spec.ts` | New in this phase |
| Integration suite | `tests/integration/{rls-policies,seed-idempotency,publish-gates,migrations-replay}.test.ts` | Against local Supabase |
| Coverage config | `vitest.config.ts` (extended) | Thresholds + critical-file branch list |
| Quarantine registry | `tests/flaky.json` | Tagged tests, owner, issue, date |
| CI | `.github/workflows/{ci.yml,e2e.yml}` (extended) | Sharding, artefacts, required-job set |
| Docs | `docs/ops/TESTING.md` | Layers, fixture contract, matrix, coverage, flake policy, manual checklist |

**Database** — **None.** The fixture database is created by the same `supabase/migrations` set that
production uses; that is the point. `tests/integration/migrations-replay.test.ts` asserts every
migration replays from an empty database in order with no error, which is D9 point 10 made testable.

**Studio surface** — **None created.** Seven Studio routes gain visual baselines; no Studio code
changes.

**Public surface** — **None.** No route is added, changed or removed by this phase.

**Media** — no manifest family is consumed at runtime. Twelve small derivatives generated once from
existing manifest assets are committed under `tests/fixtures/media/` purely so snapshots are
deterministic; no asset is regenerated, no original is modified, and `manifest:verify` still passes
byte-identically (D6).

**Risks**

| Risk | Mitigation |
|---|---|
| Visual snapshots become permanently red and get bypassed | Stability rules are mandatory and listed; baselines come only from the pinned CI container; `maxDiffPixelRatio` allows sub-pixel noise; a genuine diff shows the image in the artefact so a reviewer decides, and re-baselining is a reviewable commit |
| Fixture data is mistaken for real inventory | Fixture rows exist only in the fixture database, are obviously fictional, and `check-fixture-isolation.mjs` fails if any fixture id, slug or title appears in `app/**`, `content/**`, `lib/**` or `scripts/seed/**` |
| A 127-snapshot matrix makes CI too slow to keep | Four-way sharding, snapshots only on PRs to `main` and on `main`, tiering that reserves all eight widths for the four routes where composition matters most, and a 15-minute wall-clock target that is itself monitored |
| Coverage percentage becomes the goal | No global percentage gate beyond `lib/**` statements; the branch gate applies to a named list of files where a missed branch is a real business failure |
| The conversion path regresses without anyone noticing | It runs in the required E2E set on every PR, in both the success and the persistence-failure direction |
| Quarantined tests accumulate silently | `tests/flaky.json` requires owner, issue and date per row; CI prints the count; an exit criterion caps it and `TESTING.md` states the policy |
| Local re-baselining hides a real regression | Baselines are accepted only from the CI platform; a `.png` committed from a developer machine is rejected by a CI check comparing the image's platform metadata |

**Verification**

1. `supabase start && npm run db:reset && npx tsx scripts/test/seed-fixture.ts` — completes; re-run → identical state, zero changed rows.
2. `npm run test` (unit + integration) — green; `migrations-replay.test.ts` applies every migration to an empty database in order.
3. `npm run test -- --coverage` — `lib/**` statements ≥ 80 %; every file on the critical list at 100 % branch. Remove a branch test from `lib/whatsapp/shorten.ts` and confirm the gate fails naming the file.
4. `npm run build && npx playwright test` — all E2E and visual projects green across the eight §45 widths; snapshot count reported is 127.
5. `npx playwright test tests/e2e/inquiry-conversion.spec.ts` — success path persists the row then opens the WhatsApp URL containing the persisted reference; the forced-failure path shows the SEED §49 copy and performs **no** navigation to `wa.me`.
6. `npx playwright test tests/e2e/touch.spec.ts --project=mobile-390` — swipe advances the gallery, every tap target ≥ 44 px, the filter drawer opens and traps focus.
7. Disconnect the network and re-run the visual suite — it still passes, proving no test contacts Cloudinary or any external origin.
8. `node scripts/test/check-fixture-isolation.mjs` — exits 0; paste a fixture slug into a seed module and confirm it exits non-zero.
9. Deliberately shift a token that changes spacing on `/product/[slug]`, run the visual suite → exactly the Tier A product snapshots fail, and the diff artefacts are attached.
10. Inspect the CI run: unit, integration, e2e (4 shards), visual, lighthouse and a11y appear as separate required jobs; total wall clock ≤ 15 minutes; artefacts retained on failure.

**Exit criteria**

- [ ] Four layers are defined, documented in `TESTING.md`, and every existing spec is classified into one.
- [ ] One deterministic fixture builds the same database state every time, with fixed ids and a frozen clock, and is proved isolated from production code.
- [ ] No test contacts an external origin; the media interceptor serves twelve committed derivatives and the suite passes offline.
- [ ] The visual matrix runs at the eight FEAT §45 widths over the tiered route list, producing 127 stable snapshots with a documented stability ruleset.
- [ ] Every surface named in FEAT §45 has an owning spec listed in `TESTING.md`.
- [ ] `lib/**` statement coverage ≥ 80 % and 100 % branch coverage on the named critical list, enforced by config.
- [ ] The conversion path is asserted in both directions, including that a failed persistence never reaches WhatsApp.
- [ ] `migrations-replay.test.ts` proves every migration applies from empty, satisfying D9 point 10 mechanically.
- [ ] The flake policy is documented, `tests/flaky.json` holds at most three rows, each with owner, issue and date.
- [ ] CI runs the required set in ≤ 15 minutes with artefacts on failure; Phase 40 and Phase 41 suites are separate required jobs.
- [ ] Phase-specific D9 evidence: docs updated = `TESTING.md`, `ARCHITECTURE.md`; tests run = the whole suite plus the four new specs; next phase = 43.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 43 — Media Coverage + Higgsfield Finalization

**Goal** — every CMS media slot in the finished site is either filled by a real asset, filled by a
deliberate re-crop of an existing asset, or is an honest empty state — and the small number of
genuinely missing assets are generated **once**, after a documented gap analysis proves they are
missing. Phase 07 migrated 250 assets and produced a projected gap list before most slots existed.
Phases 09–22 then created the real slots and bound what they could. Phase 43 re-runs the analysis
against reality, resolves each gap with one of four dispositions, rewrites the draft alt text that
is currently truncated prompt output, and closes the media system with the regeneration guard still
armed.

**Depends on** — Phase 06 (`MediaProvider`, presets, folders), 07 (the 250 migrated assets,
`computeGaps()`, `content/media-slots.ts`, the regeneration guard, the two Higgsfield documents),
09 (seed bindings), 10–22 (the slots themselves), 39 (the OG asset requirement), 41 (the alt-text
constraint and `is_decorative`), 42 (fixture media, which must keep working).

**Scope**

- **Gap analysis first, generation never before.** `scripts/media/build-coverage-report.ts` joins
  `content/media-slots.ts` against `page_sections`, `categories`, `collections`,
  `portfolio_projects`, `journal_articles` and `media_usages`, and writes a generated **Coverage**
  section into `docs/media/HIGGSFIELD_ASSET_STATUS.md`. No new documentation path is created; D7 is
  fixed.
- **Four dispositions, one per gap, decided by a human.** No script generates anything.

  | Disposition | Meaning | Requires |
  |---|---|---|
  | `REUSE_FROM_FAMILY` | An existing manifest asset in the right family fits the slot | An editor binds it |
  | `RECROP_EXISTING` | An existing asset's subject survives a crop to the needed ratio | A `media_crops` row with gravity or an explicit box |
  | `GENERATE_NEW` | Nothing existing fits; a brief is written | `assert-no-regeneration` passes for the target |
  | `LEAVE_EMPTY` | The honest answer is an empty state | A seeded empty-state message (D10) |

- **The decision gate before any brief.** Four questions, in order, recorded per slot in the coverage
  report: (1) Is there real Rivya media? (2) Is there an approved owner-supplied asset? (3) Is there
  an existing manifest asset in a matching family? (4) Can an existing asset be re-cropped without
  destroying the subject? Only four "no" answers permit `GENERATE_NEW` (D6 asset priority, FEAT §33).
- **Re-crop before regenerate, as a first-class mechanism.** `media_crops` stores a per-(asset,
  ratio) crop so one 4800 px master serves several D6 ratio slots without a second generation. The
  Studio crop editor shows the crop live over the real asset; an editor chooses the box, a script
  never guesses. Cloudinary applies it as `c_crop` followed by the preset.
- **Verified coverage facts**, read from `data/higgsfield/asset-manifest.json` at the time of
  writing and re-derived by the coverage script:

  | Fact | Value | Consequence |
  |---|---|---|
  | Total assets | 250 (224 image, 26 video) across 24 families and 23 Cloudinary folders | The library |
  | Pages with zero assets | `/collection` landing, `/collection/furniture`, `/collection/collectible-design`, `/custom-commissions`, `/contact`, `/faq`, `/search`, `/privacy`, `/terms` | Gap or `LEAVE_EMPTY` |
  | `home` coverage | 5 assets, all `interior-lifestyle`, all stills; **no video** | The `/` hero video + poster remain the two largest gaps |
  | Thin families | `largeformat-coffee` = 1 (3:2 only), `largeformat-monumental` = 1 (21:9 only) | No mobile ratio for either |
  | Images below 1600 px wide | 14 | Cannot fill the `hero` preset (`w_1600`) without upscaling |
  | Assets below 2560 px wide | 120 (94 images, all 26 videos) | Cannot fill `hero-xl` (`w_2560`) |
  | Videos below 1920 px wide | 19 of 26 | Only 7 videos are 1920 × 1080; the rest are 1280–1344 px |
  | 3D models in the manifest | 0 | The viewer stays flag-off (below) |
  | Product photography | 0 | Products come from the owner, never from AI |
  | Brand assets (logo, wordmark, favicon, default OG) | 0 | Owner-supplied, not generated (below) |
  | Portfolio project media | 0 project assets; 5 `gallery-scene` atmosphere stills | Portfolio stays an empty state (D10) |
  | Alt text | 250 `alt_text_draft` values are truncated prompt text ending mid-sentence | All must be rewritten |

- **The `/` hero.** The largest single gap. Disposition: `GENERATE_NEW` for `HOME-HERO-VIDEO-001`
  and `HOME-HERO-POSTER-001`, at 21:9 desktop and 9:16 mobile, because no `home` video exists and
  because upscaling a 1280 px process video into a full-bleed hero is visibly worse than generating
  at the right size. The poster is the LCP element (Phase 11) and must be generated at ≥ 2560 px.
- **Brand assets are not generated.** A logo, a wordmark and a favicon are an organisation's
  identity; an AI-generated mark presented as Rivya's would be a fabricated fact about the business
  and would also carry unresolved provenance. Disposition: **OWNER_VERIFICATION_REQUIRED** — the
  owner supplies them through `/studio/media/brand`. Until then the site uses a typographic wordmark
  built from design tokens (no image), and `/collection/furniture` and `/collection/collectible-design`
  emit no `og:image` rather than borrowing one (Phase 39).
- **No speculative 3D models.** Higgsfield can produce a 3D asset, but a model of a product Rivya has
  not made is a fabricated product, not concept media: it has dimensions, a form and an implied
  specification. Disposition for every 3D slot: `LEAVE_EMPTY`. The `3d_viewer` flag stays off until
  the owner supplies a GLB of a real object (Phase 21's contract, unchanged).
- **Alt-text finalisation.** Every one of the 250 draft values is rewritten to describe what is
  visible, in one sentence, without prompt vocabulary, hex codes, camera language or the word
  "AI" (SEED §43). Assets bound to a published slot are rewritten first and reviewed by an editor;
  unbound assets are rewritten by the same rules and stay `OWNER_VERIFICATION_REQUIRED` until used.
  Decorative uses set `is_decorative` (Phase 41) instead of an empty string.
- **New generation protocol**, if and only if a slot reached `GENERATE_NEW`:
  1. The brief is added to `docs/media/HIGGSFIELD_MASTER_ASSET_PLAN.md` with target Rivya asset id,
     family, page, section, desktop and mobile ratio, minimum long-edge pixels, Cloudinary folder,
     prompt, negative prompt, and the palette already established across the library (deep ocean
     `#08283A`, obsidian `#080A0E`, sapphire `#164E6B`, champagne gold `#B89B63`).
  2. `npm run media:assert-no-regen` must pass — it fails if the target matches an existing
     `rivya_asset_id` or an already-satisfied family/section pair (Phase 07 guard, unchanged).
  3. Generation runs; outputs are appended by the existing Python builder, bumping
     `manifest_version` to `rivya-hf-v2`. **The 250 existing rows are byte-identical**;
     `npm run manifest:verify` proves the builder is still deterministic.
  4. The Phase 07 migration script moves the new assets into Cloudinary and `media_assets` with
     `is_ai_generated = true`, `is_concept = true`, `owner_verification = 'OWNER_VERIFICATION_REQUIRED'`.
  5. An editor writes real alt text and binds the slot.
- **Concept-media discipline, re-asserted.** No new or existing concept asset may be attached to a
  product, a portfolio project, or any caption naming a product, price, dimension, client or
  project. The Phase 14 trigger already forbids the first; this phase adds a coverage-report column
  that lists every concept asset bound to any slot so the owner can see exactly where they appear.

**Out of scope**

- Regenerating, replacing, upscaling or re-encoding any of the 250 existing assets (D6, manifest
  `policy.rules[4]`). Cloudinary derives; originals are immutable.
- Product photography of any kind, real or generated.
- Brand identity design, logo generation or favicon generation.
- 3D model generation.
- Portfolio project imagery. Portfolio stays an empty state until the owner has a project to show.
- Video editing, colour grading, music, voiceover or captions beyond a poster and a muted loop.
- Changing `content/media-slots.ts` to remove a slot in order to close a gap. A slot is removed only
  when the design no longer has it, and that is a Phase 45 decision, not a media one.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Migration | `supabase/migrations/0410_phase43_media_crops.sql` | `media_crops`, indexes, RLS |
| Coverage report | `scripts/media/build-coverage-report.ts` | Writes the generated Coverage section of `HIGGSFIELD_ASSET_STATUS.md` |
| Gap engine | `lib/media/gaps.ts` (extended) | Adds disposition, ratio fit, resolution fit |
| Crop resolver | `lib/media/crop.ts` | `media_crops` → `c_crop` prefix before the preset |
| Crop editor | `components/studio/media/CropEditor.tsx` | Client; live crop over the real asset, per ratio |
| Alt-text workspace | `components/studio/media/AltTextQueue.tsx` | Queue ordered by binding status; rewrite, approve |
| Alt-text linter | `scripts/media/check-alt-text.mjs` | Fails on prompt vocabulary, hex codes, trailing ellipsis, "AI", `<` 15 chars |
| Master plan | `docs/media/HIGGSFIELD_MASTER_ASSET_PLAN.md` | Briefs for `GENERATE_NEW` slots only |
| Asset status | `docs/media/HIGGSFIELD_ASSET_STATUS.md` | Regenerated; adds Coverage and Concept-Placement sections |
| Manifest (if generated) | `data/higgsfield/asset-manifest.json` | `rivya-hf-v2`; existing 250 rows byte-identical |
| Tests | `tests/unit/{gap-disposition,crop-resolver,alt-text-lint}.test.ts`, `tests/e2e/{studio-crop,studio-alt-queue}.spec.ts` | Dispositions, crop maths, linter, editors |
| Docs | `docs/media/MEDIA_GUIDE.md`, `docs/media/HIGGSFIELD_GUIDE.md` | Re-crop-first rule, disposition ladder, v2 protocol |

**Database**

| Table | Key columns | Notes |
|---|---|---|
| `media_crops` | `id`, `media_asset_id uuid not null references media_assets(id) on delete cascade`, `aspect_ratio text not null check (aspect_ratio in ('21:9','16:9','4:3','3:2','1:1','4:5','3:4','9:16'))`, `x int`, `y int`, `width int`, `height int`, `gravity text`, `note text`, plus the D5 common set | `unique (media_asset_id, aspect_ratio)`; either a full box or a gravity, enforced by check. The ratio list is exactly D6's eight |

`media_assets` gains no column in this phase. RLS: `select` for `anon` where the parent asset is
readable; write requires `media.write`.

**Studio surface** — no new route. **Extends** `/studio/media/higgsfield` with a **Coverage** tab
(every slot, its disposition, its bound asset, its ratio and resolution fit) and a
**Concept Placement** tab (every concept asset currently bound to a published slot). **Extends**
`/studio/media/all` and the asset drawer with the crop editor and the alt-text queue. **Extends**
`/studio/media/brand` with the owner-supplied brand asset upload and a banner naming the four
missing brand assets. No regeneration control is added anywhere — that prohibition is Phase 07's and
it stands.

**Public surface** — no new route. Slots that were empty become filled; slots that stay empty render
their seeded empty state. `/collection/furniture` and `/collection/collectible-design` gain hero
media only if a disposition of `REUSE_FROM_FAMILY` or `GENERATE_NEW` was actually taken.

**Media** — this phase consumes **all 24 manifest families**: `decor` 18, `editorial` 19,
`gallery-scene` 5, `gifts` 10, `interior-lifestyle` 5, `largeformat-coffee` 1,
`largeformat-console` 4, `largeformat-dining` 5, `largeformat-monumental` 1, `largeformat-seating` 4,
`largeformat-side` 3, `material-macro` 39, `preservation-keepsake` 4, `preservation-varmala` 15,
`process-cure` 8, `process-finish` 8, `process-mould` 12, `process-pigment` 13, `process-pour` 12,
`process-studio` 19, `process-timber` 7, `three-d-resin` 13, `wall-art` 20, `workshop-session` 5.
It appends only what the disposition table marks `GENERATE_NEW`, and it modifies none of the 250.

**Risks**

| Risk | Mitigation |
|---|---|
| A slot gets filled by regenerating something that already exists | `assert-no-regeneration.ts` runs in CI over the master plan and fails on any brief whose target matches an existing asset; the disposition ladder requires four documented "no" answers before `GENERATE_NEW`; the tracker has no generate control |
| A low-resolution asset is bound to a hero and upscales visibly | The coverage report computes resolution fit per slot against the preset's target width; a slot whose only candidate is below the preset width is reported as a gap, not silently bound |
| A concept image is read as a delivered Rivya project | The Concept Placement tab lists every published binding; portfolio stays empty; no caption may name a product, price, dimension, client or project; the Phase 14 trigger blocks product attachment |
| An AI-generated logo becomes the brand mark | Brand assets are explicitly out of scope and flagged `OWNER_VERIFICATION_REQUIRED`; the interim wordmark is typographic and uses no image |
| A speculative 3D model implies a product that does not exist | Every 3D slot is `LEAVE_EMPTY`; the `3d_viewer` flag stays off; the media guide states the rule |
| Rewritten alt text still reads like a prompt | `check-alt-text.mjs` rejects hex codes, camera vocabulary, trailing ellipses, "AI-generated", and strings under 15 characters; every asset bound to a published slot needs editor approval |
| The manifest is edited by hand to close a gap | `manifest:verify` (Phase 00) re-runs the Python builder and fails on any diff; the builder is the only writer |
| Fixture media breaks when the manifest goes to v2 | `tests/fixtures/media/**` is committed and independent of the manifest; the Phase 42 interceptor does not read it |

**Verification**

1. `npx tsx scripts/media/build-coverage-report.ts && git diff --exit-code docs/media/HIGGSFIELD_ASSET_STATUS.md` — the generated section is current.
2. Read the Coverage section: every slot in `content/media-slots.ts` appears with exactly one disposition, and every `GENERATE_NEW` row has a corresponding brief in `HIGGSFIELD_MASTER_ASSET_PLAN.md`.
3. `npm run media:assert-no-regen` — passes. Add a brief targeting `WALL-ART-001` and confirm it fails naming the asset; remove it.
4. `npm run manifest:verify` — no diff. After any generation: `jq '.counts.total' data/higgsfield/asset-manifest.json` shows the new total, `jq '.manifest_version'` shows `rivya-hf-v2`, and `git diff` on the file shows **only appended objects** — no modification to any of the original 250.
5. `npm run test:unit -- gap-disposition crop-resolver alt-text-lint` — green, including a crop that would fall outside the source bounds being rejected.
6. `node scripts/media/check-alt-text.mjs` — zero failures for assets bound to a published slot. Set one alt text back to its truncated draft and confirm it fails.
7. `psql -c "select count(*) from media_assets where alt_text is null or btrim(alt_text)='' ) and is_decorative = false"` → 0 (the Phase 41 constraint should make this impossible; the query proves it).
8. `npx playwright test tests/e2e/studio-crop.spec.ts` — crop a 16:9 master to 4:5, save, and assert the public page requests a `c_crop` URL with the saved box and that the rendered box matches at 390 px.
9. Open the Concept Placement tab: every listed binding is a material, process or atmosphere slot; none is a product, a portfolio project, or a caption naming one.
10. `/studio/media/brand` shows the four missing brand assets as outstanding and `OWNER_VERIFICATION_REQUIRED`; the site renders the typographic wordmark with no image request.
11. `npx playwright test tests/visual/` (Phase 42) — 127 snapshots still pass, or fail only where a slot was deliberately filled and the baseline was re-accepted in this PR.

**Exit criteria**

- [ ] The coverage report enumerates every declared media slot with exactly one of the four dispositions, and is generated, not hand-written.
- [ ] Every `GENERATE_NEW` disposition is justified by four recorded "no" answers to the decision gate and has a brief in the master plan.
- [ ] `assert-no-regeneration.ts` passes and is still wired into CI; no existing manifest asset was regenerated, replaced or modified.
- [ ] If any asset was generated, `manifest_version` is `rivya-hf-v2`, the original 250 objects are byte-identical, and `manifest:verify` is green.
- [ ] `media_crops` is in use; the crop editor lets an editor serve multiple D6 ratios from one master without a new generation.
- [ ] All 250 draft alt texts are rewritten; every asset bound to a published slot has editor-approved alt text passing the linter; decorative uses set `is_decorative`.
- [ ] Zero 3D models, zero product photographs, zero portfolio project images and zero brand marks were generated; each is recorded as owner-supplied or an honest empty state.
- [ ] The Concept Placement tab shows no concept asset attached to a product, a portfolio project or a caption naming one.
- [ ] `/collection/furniture` and `/collection/collectible-design` are either genuinely filled or genuinely empty — never filled with another category's image.
- [ ] Phase-specific D9 evidence: docs updated = `MEDIA_GUIDE.md`, `HIGGSFIELD_GUIDE.md`, `HIGGSFIELD_ASSET_STATUS.md`, `HIGGSFIELD_MASTER_ASSET_PLAN.md`, `DATA_MODEL.md`; tests run = three unit suites, two e2e specs, the visual suite; next phase = 44.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 44 — Vercel Deployment

**Goal** — the project stops being something that runs on a laptop. Phase 44 defines three
environments and two Supabase projects, states where every environment variable is set and who
rotates it, separates schema migration from code deployment so a rollback is always safe, publishes
a rollback decision table, protects preview deployments from indexing and from leaking draft
content, and produces a preflight script and a release runbook the owner's engineer can follow
without asking. The property this phase buys is not "it is deployed" — it is **"a bad deploy can be
undone in under five minutes without data loss"**.

**Depends on** — Phase 00 (CI, `npm run check`, `.env.example` with D8 names only), 01
(`docs/ops/DEPLOYMENT.md` and `ENVIRONMENT.md` stubs, doc contract), 03 (migrations), 04 (auth,
sign-up disablement), 25 (the research cron route), 38 (Environment page, system logs, retention
crons), 39–43 (everything being deployed), 41 (headers, which are set in middleware and must be
verified on the platform), 42 (the suite that gates a deploy).

**Scope**

- **Three environments, two databases.**

  | Environment | Git | Vercel | Supabase project | Purpose |
  |---|---|---|---|---|
  | Production | `main` (promoted) | Production deployment | `rivya-prod` | The public site |
  | Preview | every PR branch | Preview deployment, access-protected | `rivya-staging` | Review; never touches production data |
  | Development | local | `next dev` | local `supabase start` | Engineering |

  A preview deployment **never** connects to `rivya-prod`. `scripts/ops/check-env.ts` asserts this
  by comparing the configured Supabase project ref against an expected value per `VERCEL_ENV` and
  failing the build if a preview points at production.
- **Environment variable management.** Values are set only in the Vercel dashboard or CLI by the
  owner or an admin, and in the local `.env.local` for development. `.env.example` carries the D8
  names with empty values and is the only committed reference (Phase 00). Nothing prints a value, a
  prefix or a length, anywhere, ever (D8).

  | Variable | Scope | Prod | Preview | Dev | Rotation owner |
  |---|---|---|---|---|---|
  | `NEXT_PUBLIC_SITE_URL` | Public | apex domain | preview URL | `http://localhost:3000` | Engineer |
  | `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | Public | prod project | staging project | local | Engineer |
  | `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Public | same | same | same | Engineer |
  | `NEXT_PUBLIC_WHATSAPP_NUMBER` | Public | owner's number | a test number | a test number | **Owner** |
  | `SUPABASE_SERVICE_ROLE_KEY` | Secret | prod | staging | local | **Owner**, 90 days |
  | `DATABASE_URL` | Secret | prod pooled | staging pooled | local | **Owner**, 90 days |
  | `CLOUDINARY_API_KEY` / `_API_SECRET` | Secret | same account | same account | same account | **Owner**, 180 days |
  | `GOOGLE_SERVICE_ACCOUNT_JSON` | Secret | prod SA | staging SA | optional | **Owner**, 180 days |
  | `GOOGLE_SHEETS_SPREADSHEET_ID` | Sensitive | prod sheet | test sheet | test sheet | **Owner** |
  | `SCRAPER_USER_AGENT` | Server | set | set | set | Engineer |
  | `REVALIDATE_SECRET` | Secret | unique | unique | any | Engineer, 90 days |

  The production WhatsApp number is a real business contact and is
  **OWNER_VERIFICATION_REQUIRED**; preview and development must use a test number so a reviewer
  cannot message the owner's phone from a draft.
- **Vercel system variables.** `VERCEL_ENV`, `VERCEL_URL`, `VERCEL_GIT_COMMIT_SHA` and
  `VERCEL_GIT_COMMIT_REF` are injected by the platform, are not secrets, and are not configured by
  anyone. They are read for the Environment page's build/version panel (FEAT §29). D8 does not list
  them because D8 lists variables the project sets; this is raised in *Open questions* so a reader
  does not treat their use as a divergence.
- **Build and platform configuration.** `vercel.json` pins the framework, the install command
  (`npm ci`), the build command (`npm run build`), function memory and duration for the API routes
  that need more than the default (the research cron and the media sign endpoint), and the cron
  entries Phase 25 and Phase 38 declared. Default region `bom1`; the choice follows the expected
  audience, and **the audience geography is OWNER_VERIFICATION_REQUIRED** — the region is a
  reversible setting recorded in `DEPLOYMENT.md`, not a claim rendered anywhere.
- **Migrations are not run by the build.** This is the central decision of the phase. `next build`
  never touches a database. Migration is a separate, explicit, gated job:

  | Step | Trigger | Runs | Gate |
  |---|---|---|---|
  | 1. Replay proof | every PR | `supabase db reset` against an ephemeral Postgres, then the full test suite | CI required |
  | 2. Staging migrate | merge to `main` | `supabase db push --linked` against `rivya-staging`, then e2e smoke against the staging preview | CI required |
  | 3. Production migrate | manual `workflow_dispatch` | `supabase db push --linked` against `rivya-prod` after a `pg_dump` snapshot | Human approval in GitHub Environments |
  | 4. Promote | manual | Vercel promotes the already-built deployment to production | Human, after step 3 reports success |

  Because every migration is expand/contract, the code deployed **before** step 3 continues to work
  after it, and the code deployed **after** step 4 also worked against the pre-migration schema for
  the duration of the window. That property is what makes step 4 reversible.
- **Rollback decision table.**

  | Symptom | Lever | Time | Data loss |
  |---|---|---|---|
  | Bad code, schema unchanged or expand-only | Vercel instant rollback: promote the previous deployment | < 2 min | None |
  | Bad migration, no data written under it | Forward-fix migration reversing the change, then steps 3–4 | < 30 min | None |
  | Bad migration, data written under it | Forward-fix with a backfill; **never** a `down` migration | Hours | None if the backfill is correct |
  | Data corruption or destructive mistake | Supabase point-in-time restore to a chosen timestamp | Plan-dependent | Up to the RPO |
  | Cloudinary asset deleted in error | Cloudinary backup restore for the affected public id | Minutes | None if backups are enabled |

  **No `down` migrations exist in this project.** A down migration that has never been executed
  against production data is untested code that runs at the worst possible moment; forward-fix is
  the only supported path, and `docs/ops/DEPLOYMENT.md` says so. The Supabase plan's PITR window and
  the Cloudinary backup setting are both **OWNER_VERIFICATION_REQUIRED** — the runbook states the
  procedure and leaves the retention numbers for the owner to fill in.
- **Preview safety.** Every non-production deployment: Vercel deployment protection on (so a preview
  URL is not publicly readable), `X-Robots-Tag: noindex, nofollow` on every response, a visible
  environment ribbon rendered from `VERCEL_ENV`, and the staging database — never production data,
  never a real enquirer's name in a screenshot.
- **Domain, DNS and TLS.** Apex plus `www`, `www` 308-redirecting to apex, TLS and HSTS preload from
  Phase 41. The domain itself is owner-supplied: **OWNER_VERIFICATION_REQUIRED**, with the DNS
  records and the verification steps written out in `DEPLOYMENT.md` so the owner or their registrar
  can act without an engineer present.
- **Preflight and release runbook.** `scripts/ops/preflight.ts` runs, in order: `npm run check`,
  `manifest:verify`, the doc-contract check, all Phase 39–43 guard scripts, `check-env.ts`, a
  migration replay, and a report of every row still `OWNER_VERIFICATION_REQUIRED` that is blocking a
  publish. It exits non-zero on any failure and prints a single summary table. The release runbook in
  `DEPLOYMENT.md` is a numbered list ending in a post-deploy verification section.
- **Observability without third parties.** Runtime errors are caught by the route-segment error
  boundaries and written to `system_logs` (Phase 38) with the request id and the commit SHA; Vercel
  runtime logs are the second source; there is no APM vendor (Phase 40's rule). The Environment page
  shows commit SHA, build time, environment, migration state and integration reachability —
  **booleans and identifiers only, never a value** (D8, FEAT §29).
- **Secret rotation runbook.** Per secret: where it lives, who rotates it, the order of operations
  (create new → set in Vercel → redeploy → verify → revoke old), and the blast radius if it leaks.
  Rotating `SUPABASE_SERVICE_ROLE_KEY` and `CLOUDINARY_API_SECRET` requires a redeploy; rotating
  `REVALIDATE_SECRET` requires updating the Phase 08 publish service in the same window.

**Out of scope**

- Multi-region deployment, edge database replicas, and any active-active topology.
- Blue/green or canary releases. Vercel's atomic deployment plus instant rollback covers the risk at
  this scale.
- Infrastructure as code for Supabase or Cloudinary. Both are configured through their dashboards and
  the configuration is **documented**, not codified.
- Automated production migration on merge. Production schema changes require a human.
- A staging copy of production data. Staging is seeded from the Phase 42 fixture; copying real
  enquirer data into a lower environment is forbidden (Phase 41 PII policy).
- Uptime monitoring and alerting vendors, status pages and on-call rotation. There is no on-call
  rotation; `DEPLOYMENT.md` says so plainly rather than implying one exists.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Platform config | `vercel.json` | Framework, commands, function config, cron entries, region |
| Next config | `next.config.ts` (extended) | `www` → apex redirect, image config, analyzer flag |
| Env checker | `scripts/ops/check-env.ts` | Presence and shape; asserts preview ≠ prod project; prints no value |
| Preflight | `scripts/ops/preflight.ts` | Runs every gate; single summary table |
| Staging migrate | `.github/workflows/migrate-staging.yml` | On merge to `main`; push + smoke |
| Production migrate | `.github/workflows/migrate-production.yml` | `workflow_dispatch`; snapshot then push; GitHub Environment approval |
| Replay proof | `.github/workflows/ci.yml` (extended) | Ephemeral Postgres, `db reset`, suite |
| Environment ribbon | `components/patterns/EnvironmentRibbon.tsx` | Non-production only; reads `VERCEL_ENV` |
| Build panel | `components/studio/system/BuildPanel.tsx` | SHA, ref, build time, environment, migration state |
| Deployment doc | `docs/ops/DEPLOYMENT.md` | Environments, migration flow, rollback table, runbook, DNS, region |
| Environment doc | `docs/ops/ENVIRONMENT.md` | The variable table, rotation runbook, never-display rule |
| Tests | `tests/unit/env-schema.test.ts`, `tests/e2e/deploy-smoke.spec.ts` | Env Zod schema; post-deploy smoke |

**Database** — **None.** No table, column or enum. Build metadata is read from platform-injected
variables; migration state is read from Supabase's own migration table by the Environment page
(Phase 38). A `deployments` table would duplicate Vercel and immediately drift.

**Studio surface** — no new route. **Extends** `/studio/system/environment` with the build panel
(commit SHA, branch, build time, environment) and the migration-state row. Reachability booleans
only; the never-expose rule from Phase 41 and D8 is asserted by `tests/e2e/deploy-smoke.spec.ts`,
which scrapes the rendered page for every server-only variable name and for any value-shaped string.

**Public surface** — no new route. Changed: `www` 308-redirects to apex; non-production hosts carry
`X-Robots-Tag: noindex, nofollow` and render the environment ribbon; production carries HSTS with
`preload`.

**Media** — **None.** Cloudinary configuration (folder allowlist, upload presets, backup setting) is
verified during preflight but no asset is uploaded, derived or generated.

**Risks**

| Risk | Mitigation |
|---|---|
| A preview deployment writes to the production database | `check-env.ts` compares the Supabase project ref against the expected value for `VERCEL_ENV` and fails the build; the preview environment's variables are set once, by the owner, in a separate Vercel environment scope |
| A migration runs during a build and half-applies under a function timeout | Builds never touch a database. Migration is a separate job with a full runner timeout and a snapshot taken first |
| A rollback is needed but the schema moved forward | Expand/contract makes the previous code compatible with the new schema; the rollback table names the lever per symptom; no `down` migration exists to tempt anyone |
| A preview URL is indexed or shows a real enquirer's data | Deployment protection plus `noindex` headers plus a staging database seeded from fixtures; copying production data down is forbidden by the PII policy |
| A secret is pasted into a log, an issue or a screenshot during a deploy | The never-expose list and its four guards (Phase 41); the Environment page shows booleans; `deploy-smoke.spec.ts` scrapes the rendered page for value-shaped strings |
| The production WhatsApp number is used in a preview and messages the owner | The variable is per-environment; preview and development use a test number; `check-env.ts` fails if the preview number equals the production number |
| The cron routes fire in preview and start scraping from a review deployment | The research master flag is off by default in every environment (Phase 25); cron entries are registered only for production in `vercel.json`; the route 404s without the platform cron header |
| The runbook rots and the first real incident is improvised | The runbook is executed as a drill during this phase — a deliberate bad deploy to staging, rolled back, timed, and the elapsed time recorded in `DEPLOYMENT.md` |

**Verification**

1. `npx tsx scripts/ops/check-env.ts` locally with a missing secret → exits non-zero naming the variable, and prints **no value, prefix or length**. Confirm by reading the output.
2. Open a PR: CI runs the replay proof against an ephemeral Postgres and the full suite; a preview deployment is created; `curl -sI <preview-url>` → `X-Robots-Tag: noindex, nofollow`; the preview is access-protected; the ribbon is visible.
3. Point a preview's Supabase variables at the production project and push → the build fails with the environment mismatch error.
4. Merge to `main` → `migrate-staging` runs `supabase db push` against `rivya-staging`, then `deploy-smoke.spec.ts` passes against the staging deployment.
5. Trigger `migrate-production` → it stops at the GitHub Environment approval gate; approve → a `pg_dump` snapshot is taken and recorded, then the push runs; the workflow log shows both.
6. Promote the deployment. `curl -sI https://<apex>/` → HSTS with `preload`, the Phase 41 header set, no `noindex`. `curl -sI https://www.<apex>/` → 308 to apex.
7. Open `/studio/system/environment` as `owner`: commit SHA matches `git rev-parse HEAD`, build time and environment are correct, every integration shows a reachability boolean, and no value, prefix or length appears anywhere. `npx playwright test tests/e2e/deploy-smoke.spec.ts` asserts the same automatically.
8. **Rollback drill**, timed and recorded: deploy a deliberately broken build to staging, promote it, then roll back by promoting the previous deployment. Record the elapsed time in `DEPLOYMENT.md`. Target under five minutes.
9. **Forward-fix drill**: apply an expand migration to staging, deploy code using it, then roll the code back only, and confirm the older code still functions against the newer schema.
10. `npx tsx scripts/ops/preflight.ts` — every gate green, and the report lists the outstanding `OWNER_VERIFICATION_REQUIRED` rows blocking a publish.
11. Confirm the production Supabase project has public sign-up disabled and that a sign-up attempt is rejected.
12. Confirm `vercel.json` registers cron entries for production only, and that hitting the research cron route on a preview returns 404.

**Exit criteria**

- [ ] Three environments exist with two Supabase projects; a preview can never reach the production database, proved by a deliberate misconfiguration failing the build.
- [ ] Every D8 variable has a documented scope, per-environment value source and rotation owner; no value, prefix or length is displayed anywhere, proved by script and by e2e.
- [ ] The production WhatsApp number is `OWNER_VERIFICATION_REQUIRED` and differs from the preview number, enforced by `check-env.ts`.
- [ ] `next build` never contacts a database; migrations run in a separate job with a human approval gate and a snapshot before production.
- [ ] Every migration in the repository is expand/contract; no `down` migration exists, and `DEPLOYMENT.md` states why.
- [ ] The rollback decision table is published, and both the rollback drill and the forward-fix drill have been executed with the elapsed time recorded.
- [ ] Preview deployments are access-protected, `noindex`, ribboned, and backed by fixture data — never production data.
- [ ] `www` redirects to apex; production carries HSTS with `preload` and the full Phase 41 header set.
- [ ] `/studio/system/environment` reports commit SHA, build time, environment, migration state and integration reachability — booleans and identifiers only.
- [ ] `scripts/ops/preflight.ts` runs every gate in one command and reports the outstanding owner-verification backlog.
- [ ] Cron entries exist for production only; public sign-up is disabled on the production Supabase project.
- [ ] Phase-specific D9 evidence: docs updated = `DEPLOYMENT.md`, `ENVIRONMENT.md`, `SECURITY.md`; tests run = `env-schema`, `deploy-smoke.spec.ts`, the full suite via preflight; next phase = 45.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 45 — Final Creative Polish

**Goal** — the eight FEAT §49 audit questions are asked properly, answered with evidence, and the
answers are acted on within a bounded remit. This is the phase where the site stops being correct
and starts being good. It is also the phase most likely to fail quietly: "polish" invites unbounded
subjective change, invented content to fill a thin page, and regressions in the budgets and
conformance the previous three phases just locked. So the remit is explicit — polish may change
composition, spacing, rhythm, motion, crop, tone and density; it may not add a block type, a
dependency, a fabricated fact, or a byte over the Phase 40 budget.

**Depends on** — Phase 02 (design system and tokens, which polish tunes rather than replaces), 11–22
(every finished surface), 39 (metadata, which polish must not break), 40 (budgets, the ceiling), 41
(a11y conformance, the floor), 42 (the visual matrix, which re-baselines as polish lands), 43 (media
coverage and crops, the raw material), 44 (a deployed preview the owner can actually look at).

**Scope**

- **The audit is evidenced, not felt.** Each FEAT §49 question gets: what is examined, the evidence
  required, the pass condition, and a verdict of `PASS`, `PASS_WITH_ACTIONS` or `FAIL`. Every `FAIL`
  produces a named, scoped work item; no numeric score is invented, because a 7/10 on "does it feel
  like a collectible-design studio" is false precision.

  | # | FEAT §49 question | Examined on | Evidence | Pass condition |
  |---|---|---|---|---|
  | 1 | Does it feel like a collectible-design studio? | `/`, `/about`, `/collections/[slug]`, `/large-format` at 1440 and 390 | Owner review session, recorded verdict and notes | The **owner** says yes. Nobody else can answer this |
  | 2 | Does large furniture visually dominate? | `/`, `/large-format`, `/collection/furniture` | Measured: hero media occupies ≥ 70 % of viewport height at 1440; the first scale reference is above the fold; no large-format piece is rendered smaller than a décor item in the same view | Measured and observed |
  | 3 | Can the visitor feel resin, wood, light and surface? | `/about` material palette, `/process`, product galleries | At least one macro asset above the fold on each material surface; crops preserve texture at 390 px; no material image cropped below 800 px of source detail | Observed at all eight widths |
  | 4 | Does 3D improve understanding rather than exist as a gimmick? | `/product/[slug]` with the flag on | With zero real models, the honest answer is that 3D is **not shown**; the flag stays off (Phase 43). The question is answered "not applicable until the owner supplies a model", not answered falsely | Recorded as N/A with the reason |
  | 5 | Can users discover and understand products easily? | `/`→category→product, `/search`, mega menu | Five-task unaided walkthrough with a first-time user; tasks completed without instruction; time recorded | ≥ 4 of 5 tasks completed unaided |
  | 6 | Can users Enquire · Customize · Request Quote · Request Consultation · Commission · Continue to WhatsApp? | Every conversion surface | Each of the six affordances reachable within two clicks of a product or commission page, present at 390 px, and each terminating in a persisted inquiry then WhatsApp | All six verified by hand and by the Phase 42 conversion spec |
  | 7 | Does mobile feel intentionally designed? | Every Tier A and B route at 430, 390, 360 | Not a shrunk desktop: mobile-specific crops from `media_crops`, thumb-reachable primary actions, no horizontal scroll, no truncated heading | Reviewed at all three mobile widths |
  | 8 | Can the owner manage everything without code changes? | The Phase 46 capability table, dry-run | The owner performs ten routine changes in Studio unaided | 10 of 10 completed |

- **The §50 quality bar, made checkable.** FEAT §50 asks for premium, artistic, architectural,
  cinematic, tactile, modern, memorable, calm, technically refined, trustworthy — and for technology
  to disappear. Translated into review criteria a reviewer can apply:

  | §50 word | What it means here | Check |
  |---|---|---|
  | Premium / artistic | Composition, not decoration; no stock-template patterns | Owner + designer review |
  | Architectural | Deliberate negative space; a consistent grid and container ladder | Grid overlay at 1440 and 390 |
  | Cinematic | Motion has intent, timing and easing consistency; one easing set, not six | `scripts/design/check-motion-tokens.mjs` |
  | Tactile | Material detail survives at every breakpoint | Crop review at all eight widths |
  | Modern / calm | Restraint: type scale steps used are a subset, not all of them; no competing emphasis in one view | Token usage audit |
  | Memorable | One idea per page carries it; the visitor can describe the page afterwards | The five-task walkthrough debrief |
  | Technically refined | No jank, no layout shift, no flash of unstyled or unloaded state | Phase 40 budgets still green |
  | Trustworthy | Nothing on the page asserts a fact the owner has not verified | `preflight` verification backlog is empty for published rows |
  | Technology disappears | No loading spinner is the first thing a visitor sees; no viewer control appears before its content | Manual pass on a cold cache, throttled |

- **Bounded remit.** A polish change is permitted only if all five hold: it fixes a `FAIL` or a
  `PASS_WITH_ACTIONS` item; it adds no CMS block type; it adds no npm dependency; it keeps every
  Phase 40 budget green; and it keeps the Phase 41 a11y sweep at zero critical and zero serious.
  Anything else is a post-launch backlog item recorded in `docs/project/ROADMAP.md`, not a quiet
  extension of this phase.
- **Where the work actually lands.** Polish is design-system work, not per-page work (FEAT §6: do
  not style every route independently). Changes go into tokens, primitives and patterns; a change
  that can only be expressed as a per-route override is a signal the token is wrong.

  | Area | Typical change |
  |---|---|
  | Type | Optical size steps, line-height rhythm, measure caps, hanging punctuation on display text |
  | Space | Section rhythm ladder, container widths, the gap scale actually used vs declared |
  | Motion | One easing set, one duration ladder, reveal thresholds, reduced-motion parity |
  | Media | Crop and focal-point review at all eight widths via `media_crops` (Phase 43) |
  | Empty states | Dignity: an empty portfolio should read as intent, not absence (SEED §28) |
  | Loading | Skeletons that match final layout so nothing shifts; no spinner above the fold |
  | Focus | `:focus-visible` that is beautiful as well as compliant |
  | Mobile | Thumb zones, drawer ergonomics, sticky conversion affordance, mobile-first crops |
  | Studio | Density, column defaults, empty-state helper copy, scan-ability of the inbox |
  | Copy tone | Editorial edits through the CMS only, by the owner or editor, never in JSX |

- **No new content, at all.** The highest-risk moment in a project is the day someone decides a page
  looks thin and writes a testimonial to fill it. D10, FEAT §38 and SEED §55 forbid it, and the
  Phase 08 publish trigger enforces it. This phase adds a review step: every copy change made during
  polish is diffed and classified, and any new sentence asserting a capability is flagged
  `OWNER_VERIFICATION_REQUIRED` before it can publish.
- **Re-baselining.** Visual snapshots (Phase 42) will legitimately change. Each polish PR re-accepts
  only the baselines it intends to change, and the diff images are attached so a reviewer sees
  exactly what moved.

**Out of scope**

- Any new page, route, block type, CMS field, table or dependency.
- A redesign. Phase 02 fixed the design system and Phases 11–22 built on it; polish tunes.
- New photography, new AI generation or new 3D. Phase 43 closed media; a polish gap is filled by a
  re-crop or an honest empty state.
- Copywriting new claims, adding testimonials, projects, awards, statistics, client names or
  capability statements — forbidden outright.
- Performance or accessibility work beyond keeping Phases 40 and 41 green. A regression found here
  is fixed here; a new optimisation is a new phase.
- Brand identity work (logo, wordmark, palette redefinition). Owner-supplied.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Audit record | `docs/design/DESIGN_SYSTEM.md` → *Final creative audit* section | Eight questions, verdicts, evidence, dated, named reviewers |
| Walkthrough record | `docs/ops/TESTING.md` → *Unaided walkthrough* section | Five tasks, participant count, completion, times, quotes |
| Token changes | `app/globals.css`, `components/primitives/**` | Type, space, motion, focus tokens |
| Pattern changes | `components/patterns/**`, `components/sections/**` | Composition only; no new block type |
| Motion guard | `scripts/design/check-motion-tokens.mjs` | Fails on an easing or duration outside the declared set |
| Token usage audit | `scripts/design/check-token-usage.mjs` | Reports raw values used where a token exists; fails on new ones |
| Crop review output | `media_crops` rows | Mobile and tablet focal points for Tier A and B heroes |
| Copy diff classifier | `scripts/content/classify-copy-diff.ts` | Flags new capability claims in a content diff |
| Backlog | `docs/project/ROADMAP.md` | Everything deliberately deferred, with the reason |
| Re-baselines | `tests/visual/**/*-snapshots/**` | Only where intended; diffs attached to the PR |
| Docs | `docs/design/{DESIGN_SYSTEM.md,COMPONENT_REGISTRY.md}` | Final token values; registry rows updated for changed patterns |

**Database** — **None.** Except `media_crops` rows (Phase 43's table) written by editors during the
crop review; no schema change.

**Studio surface** — **None created.** Copy and media changes are made through the existing CMS
surfaces, by the owner or an editor, which is itself the test for audit question 8.

**Public surface** — every D3 public route changes in appearance. No route is added, removed or
renamed; no URL changes (a URL change at this stage would invalidate Phase 39's sitemaps and any
inbound link).

**Media** — no new asset and no generation. Consumes the already-bound families through new
`media_crops` focal points, principally on the Tier A and B heroes: `interior-lifestyle` (5),
`largeformat-dining` (5), `largeformat-console` (4), `largeformat-seating` (4), `largeformat-side`
(3), `wall-art` (20), `three-d-resin` (13), `preservation-varmala` (15), `decor` (18), `gifts` (10),
`material-macro` (39), and the seven `process-*` families (79).

**Risks**

| Risk | Mitigation |
|---|---|
| Polish becomes an unbounded redesign | The five-condition remit; anything failing it goes to `ROADMAP.md`; a PR that adds a block type or a dependency is rejected on sight |
| A thin page is filled with invented content | `classify-copy-diff.ts` flags every new capability sentence; the Phase 08 publish trigger blocks unverified rows; the audit's trustworthiness criterion requires an empty verification backlog for published rows |
| Performance or accessibility regresses under visual improvement | Phase 40 budgets and the Phase 41 a11y sweep are required jobs on every polish PR; a regression blocks the merge |
| Visual baselines get bulk-accepted, hiding a real defect | Each PR re-accepts only its intended snapshots, and diff images are attached; a bulk re-baseline is a reviewable red flag |
| Per-route overrides accumulate and the design system stops being one | `check-token-usage.mjs` reports raw values and fails on new ones; a change expressible only as a route override is treated as a wrong token |
| The audit is performed by the people who built it and passes itself | Question 1 can only be answered by the owner; question 5 requires a first-time participant; both verdicts are recorded with names and dates |
| The 3D question is answered dishonestly to avoid an N/A | The recorded verdict is N/A with the reason (zero real models, flag off); inventing a model to answer it would fabricate a product |

**Verification**

1. The audit section in `DESIGN_SYSTEM.md` records all eight §49 questions with a verdict, the evidence, the reviewer names and the date. Question 1 carries the owner's own verdict; question 4 is recorded N/A with its reason.
2. Measure question 2: at 1440 px on `/` and `/large-format`, the hero media occupies ≥ 70 % of viewport height, and a scale reference is above the fold.
3. Run the five-task unaided walkthrough with at least three first-time participants; record tasks completed, time and verbatim comments in `TESTING.md`. ≥ 4 of 5 tasks completed unaided by each.
4. Verify all six FEAT §49 conversion affordances by hand at 390 px, each reachable within two clicks and each terminating in a persisted inquiry before WhatsApp; the Phase 42 conversion spec is green.
5. `node scripts/design/check-motion-tokens.mjs` — every animation uses a declared easing and duration. Add a bespoke cubic-bezier and confirm it fails.
6. `node scripts/design/check-token-usage.mjs` — no new raw value where a token exists.
7. `npx lhci autorun` over the Phase 40 route matrix — every budget still green after polish.
8. `npx playwright test tests/e2e/a11y/` — still zero critical and zero serious across every route; `exceptions.json` still empty.
9. `npx playwright test tests/visual/` — passes against the re-accepted baselines; `git log` shows each baseline change in a PR with its diff images attached.
10. `npx tsx scripts/content/classify-copy-diff.ts --base <pre-polish-sha>` — every new sentence classified; every capability claim flagged and either verified by the owner or left unpublished.
11. Cold-cache throttled pass on `/`, `/large-format` and `/product/[slug]`: no spinner is the first painted element, no layout shift on media or video mount, no flash of unstyled text.
12. Question 8 dry-run: the owner performs the ten routine changes from the Phase 46 capability table unaided; record 10 of 10 or list what needed an engineer.

**Exit criteria**

- [ ] All eight FEAT §49 questions are answered with a verdict, evidence, named reviewers and a date; question 1 carries the owner's own verdict.
- [ ] Every `FAIL` is either fixed within the remit or recorded in `ROADMAP.md` with the reason it was deferred.
- [ ] The scale, material, mobile and conversion criteria are verified at all eight FEAT §45 widths.
- [ ] The unaided walkthrough was run with at least three first-time participants and its results recorded.
- [ ] No block type, route, table, field or dependency was added; no URL changed.
- [ ] No new content asserting a business capability was published; the copy diff is classified and the verification backlog for published rows is empty.
- [ ] Phase 40 budgets and Phase 41 a11y results are unchanged or better; both suites are green.
- [ ] Motion and token guards pass; polish landed in tokens, primitives and patterns rather than route overrides.
- [ ] Visual baselines were re-accepted only where intended, with diffs attached to each PR.
- [ ] `DESIGN_SYSTEM.md` and `COMPONENT_REGISTRY.md` reflect the final token values and changed patterns.
- [ ] Phase-specific D9 evidence: docs updated = `DESIGN_SYSTEM.md`, `COMPONENT_REGISTRY.md`, `TESTING.md`, `ROADMAP.md`; tests run = Lighthouse matrix, a11y sweep, visual suite, conversion spec; next phase = 46.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 46 — Documentation + Handoff

**Goal** — the owner ends this phase able to run Rivya Living Art without an engineer for everything
that should not need one, and with a written, honest account of everything that does. Phase 46
produces the capability boundary (what changes without code, what requires an engineer), the owner
runbooks for the routine tasks, the outstanding owner-verification backlog that is still blocking
publication, the documentation completeness audit against D7, the deliberate-omission register from
FEAT §39, and a proof that the repository is recoverable from a clean clone by someone who was not
here. It is also the last chance to remove anything aspirational from the documentation: a document
that claims a capability the code does not have is worse than no document.

**Depends on** — Phase 01 (the D7 documentation map, front matter, the doc-contract checker), 38
(`/studio/system/documentation`, the sanitised viewer), 39–45 (everything being documented), 44
(the deployment runbook the handoff points at), and every phase's `SESSION-STATE.md` entry.

**Scope**

- **The capability boundary.** Two tables, and they are the centrepiece of the handoff. The first is
  what the owner changes alone.

  | The owner can change… | Where | Effect |
  |---|---|---|
  | Any page's headings, body copy, eyebrows, CTA labels and CTA links | `/studio/content/pages` | Live after publish |
  | Homepage section order, visibility, theme and layout variant | `/studio/content/homepage`, `/studio/merchandising/homepage` | Live after publish |
  | Any desktop or mobile image or video in any section | `/studio/content/pages` → media slots | Live after publish |
  | Navigation menu, mega-menu categories, footer columns | `/studio/content/navigation`, `/footer` | Live after publish |
  | Products: create, edit, price state, dimensions, materials, media, publish, archive | `/studio/catalog/products` | Live after publish |
  | Categories, collections, materials and their relationships | `/studio/catalog/*` | Live after publish |
  | Portfolio projects and journal articles, including scheduling | `/studio/content/{portfolio,journal}` | Live after publish |
  | FAQs, testimonials, empty-state copy, error copy, form labels and error messages | `/studio/content/faqs`, `/studio/content/pages` | Live after publish |
  | Contact details, WhatsApp number, WhatsApp message templates | `/studio/system/settings`, `global_content` | Live immediately |
  | Every SEO title, description, social card, canonical, robots flag and redirect | `/studio/content/seo` | Live after revalidation |
  | Inquiry handling: status, notes, assignment, export, erase | `/studio/inquiries/*` | Immediate |
  | Feature flags (3D viewer, configurator, research, Sheets, advanced analytics) | `/studio/system/flags` | Immediate |
  | Staff users, roles and access | `/studio/system/users` | Immediate |
  | Merchandising: featured selections, ordering, scheduling | `/studio/merchandising/*` | Live after publish |
  | Research sources, scrape jobs, review dispositions, shortlists | `/studio/research/*` | Internal only |
  | Media: upload, tag, crop, alt text, folder, archive | `/studio/media/*` | Live after publish |

  The second is the honest counterpart.

  | Requires an engineer | Why |
  |---|---|
  | A new page **type** or a new CMS block type | Schema, Zod, renderer, Studio editor, registry row |
  | A new public route or a URL change | Route file, sitemap, redirects, tests |
  | A new database table, column or enum | Migration, types, RLS, repository |
  | A new role or permission | The Phase 04 permission matrix is code |
  | Design tokens, typography scale, colour system | Design system, with visual re-baselining |
  | A new integration or third-party service | Environment, security review, CSP |
  | Anything on the FEAT §39 deferred list (checkout, payments, accounts, wishlist, reviews, AR, CRM) | Deliberately not built |
  | Secret rotation | Vercel access plus a redeploy (Phase 44 runbook) |

- **Owner runbooks**, each a numbered procedure with screenshots, written to be followed by someone
  who does not know what a migration is: publish a product · add a category · change the homepage
  hero · swap any image · schedule a journal article · respond to an inquiry and continue on
  WhatsApp · change the WhatsApp number · invite a staff member and set their role · turn a feature
  flag on · recover something you archived by mistake · read the Environment page and know whether
  something is wrong · request an engineer, and what to include. These live in
  `docs/studio/STUDIO_GUIDE.md` — D7's owner-facing document — not in a new file.
- **The owner-verification backlog.** `scripts/content/build-verification-report.ts` writes a
  generated section into `docs/content/INITIAL_CONTENT_INVENTORY.md` listing every row still
  `OWNER_VERIFICATION_REQUIRED`, grouped by surface, with the exact Studio path to resolve it and
  what the owner must confirm. Nothing in it can publish until the owner acts (Phase 08 trigger).
  Known contents at handoff: all ten FAQ answers, contact details, the About scale and bespoke
  sections, the Large Format customization section, the seven Process steps, capability-implying
  category descriptions, the 3D + resin form template, every Higgsfield-backed media binding, the
  commission starting points, the two geography keyword themes, the privacy and terms pages, the
  accessibility statement skeleton, and the MFA and PITR decisions.
- **Documentation completeness audit.** Every path in D7 exists, carries valid front matter, is
  `status: CURRENT` or explicitly stubbed with an owning phase, contains no secret, no environment
  value, no private URL, and no claim the code does not support.
  `scripts/docs/check-doc-contract.mjs` (Phase 01) is extended with a **claim check**: a documented
  capability must name the file or route that implements it.
- **The sanitised documentation viewer.** Phase 38 built `/studio/system/documentation`; Phase 46
  fixes its allowlist — architecture, studio guide, media guide, scraper guide, deployment,
  environment, business rules, content guide, component registry, Higgsfield guide (FEAT §30) — and
  its exclusion rules: never `docs/requirements/**` internals that quote unverified claims, never
  anything containing an environment value, never `.env*`, never a migration file.
- **Deliberate-omission register (FEAT §39).** What was intentionally not built, why, and where the
  seam is if it is ever wanted: online checkout, payment gateway, customer accounts, wishlist,
  reviews and ratings, shipping and returns, AR and room visualisation, advanced configurator
  pricing, CRM, quotation automation, newsletter delivery, multi-language, and the accessibility
  statement. Each row names the architectural seam (for example: "conversion terminates in
  `inquiries`; a commerce layer would consume that table rather than replace it") so a future team
  does not have to reverse-engineer the intent. **No dead tables were created for any of them.**
- **Session-recovery closure (FEAT §40, §41).** `docs/SESSION-STATE.md` carries the final entry with
  all eighteen fields; `PROJECT_STATE.md` and `docs/project/ROADMAP.md` show every phase 00–46 with
  a real status, and any phase that is `PARTIAL` says exactly what remains.
- **Recoverability proof.** On a clean machine with no prior state: clone, `nvm use`, `npm ci`,
  `supabase start`, `npm run db:reset`, `npm run seed:content`, `npm run build`, `npm run check`,
  `npx playwright test`. Timed, and the elapsed time and any manual step recorded in `README.md`.
  This is D9 point 10 proved rather than asserted.
- **Support model, stated honestly.** There is no on-call rotation, no SLA and no monitoring vendor.
  What exists: Vercel runtime logs, `system_logs`, the Environment page, the rollback table, and a
  named engineer contact the owner supplies. `DEPLOYMENT.md` says this plainly.
- **Handover session.** A walkthrough with the owner covering the capability boundary, the runbooks,
  the verification backlog and the incident path. Whether it happened, and when, is a fact about the
  world: recorded as **OWNER_VERIFICATION_REQUIRED** until the owner confirms it, not asserted by a
  document.

**Out of scope**

- Writing new features, new copy or new media. Documentation describes what exists.
- Marketing collateral, launch announcements, social content and press material.
- Training videos beyond the walkthrough the owner attends.
- A support contract, SLA or maintenance agreement — commercial, not technical.
- Publishing the owner-verification backlog's contents. Phase 46 hands the owner the list; only the
  owner can clear it.
- Editing `docs/requirements/**`. They are specifications of record and the doc-contract checker
  rejects any change to them (Phase 01).

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Capability boundary | `docs/studio/STUDIO_GUIDE.md` | The two tables above, verbatim, as the guide's opening section |
| Owner runbooks | `docs/studio/STUDIO_GUIDE.md` | Twelve numbered procedures with screenshots |
| Verification backlog | `scripts/content/build-verification-report.ts` → `docs/content/INITIAL_CONTENT_INVENTORY.md` | Generated section; grouped; with resolution paths |
| Claim check | `scripts/docs/check-doc-contract.mjs` (extended) | A documented capability must name its implementing file or route |
| Doc audit | `scripts/docs/audit-docs.mjs` | D7 completeness, front matter, `status`, secret scan, stub detection, and `--claims`: claim-term scan classified by prohibition marker |
| Viewer allowlist | `lib/docs/allowlist.ts` | The FEAT §30 set and the exclusion rules |
| Omission register | `docs/project/BUSINESS_RULES.md` → *Deliberately not built* | Thirteen rows with reason and seam |
| Final state | `docs/SESSION-STATE.md`, `PROJECT_STATE.md`, `docs/project/ROADMAP.md`, `CHANGELOG.md` | Final entries; every phase status real |
| Recovery proof | `README.md` → *From a clean clone* | The command sequence, elapsed time, manual steps |
| Support model | `docs/ops/DEPLOYMENT.md` | No on-call, no SLA; what exists instead; incident path |
| Tests | `tests/unit/docs-audit.test.ts`, `tests/e2e/studio-documentation.spec.ts` | Audit rules; viewer allowlist and exclusions |

**Database** — **None.**

**Studio surface** — **fills** `/studio/system/documentation` with its final allowlist and exclusion
rules (Phase 38 built the viewer; Phase 46 fixes what it may show). **Extends** `/studio` overview
with an "Outstanding owner verifications" card linking to the backlog, because a list in a Markdown
file is not where an owner will look.

**Public surface** — **None.** No route, no copy, no metadata change.

**Media** — **None consumed and none generated.** Screenshots taken for the runbooks are
documentation images stored under `docs/`, are not media assets, do not enter `media_assets` or
Cloudinary, and must not contain a real enquirer's personal data or any environment value.

**Risks**

| Risk | Mitigation |
|---|---|
| Documentation claims a capability the code lacks | The extended doc-contract claim check requires a documented capability to name its implementing file or route; `audit-docs.mjs` fails on a `status: CURRENT` document whose owning phase is not complete |
| The owner discovers something needs an engineer only when they try it | The capability boundary is dry-run as Phase 45's audit question 8: the owner performs ten routine changes unaided before this phase can pass |
| The verification backlog is handed over and quietly ignored | It is generated, not hand-maintained; it appears as a card on `/studio` overview; and nothing in it can publish until it is resolved |
| A screenshot in the runbooks leaks personal data or an environment value | Screenshots are taken against the Phase 42 fixture database on a preview deployment; `audit-docs.mjs` scans `docs/**` for the never-expose names and for value-shaped strings |
| The documentation viewer exposes a file it should not | The allowlist is code with a unit test; `studio-documentation.spec.ts` asserts that `.env`, migrations and requirement internals are unreachable |
| Handover is claimed but never happened | Recorded `OWNER_VERIFICATION_REQUIRED` until the owner confirms — a fact about the world, not a document's assertion (D10) |
| Recoverability is asserted rather than proved | The clean-clone sequence is executed on a machine with no prior state, timed, and its manual steps recorded; a step that cannot be automated is written down rather than omitted |
| The omission register becomes a roadmap promise | Each row states the reason and the seam, not a date or an intention; `BUSINESS_RULES.md` says these are decisions, not plans |

**Verification**

1. `node scripts/docs/audit-docs.mjs` — every D7 path exists, carries front matter, has a real `status`, contains no never-expose name and no value-shaped string, and no `status: CURRENT` document belongs to an incomplete phase.
2. `node scripts/docs/check-doc-contract.mjs --claims` — every documented capability names an implementing file or route. Add a sentence claiming an unbuilt feature and confirm it fails.
3. `npx tsx scripts/content/build-verification-report.ts && git diff --exit-code docs/content/INITIAL_CONTENT_INVENTORY.md` — the generated backlog is current and lists every `OWNER_VERIFICATION_REQUIRED` row with its Studio path.
4. Open `/studio` as `owner` — the outstanding-verifications card shows a count matching the report.
5. `npx playwright test tests/e2e/studio-documentation.spec.ts` — the ten FEAT §30 documents render; `.env.example`, any file under `supabase/migrations/`, and any requirement internal are unreachable, returning the seeded not-permitted state rather than a 500.
6. The owner performs, unaided and observed, the ten routine changes from the capability table. Record 10 of 10, or list precisely what needed an engineer and why the table was wrong.
7. **Clean-clone proof** on a machine with no prior state: `git clone` → `nvm use` → `npm ci` → `supabase start` → `npm run db:reset` → `npm run seed:content` → `npm run build` → `npm run check` → `npx playwright test`. All green. Record elapsed time and every manual step in `README.md`.
8. Read `docs/project/ROADMAP.md`: all 47 phases (00–46) carry a real status; every `PARTIAL` names what remains; `PROJECT_STATE.md` and `docs/SESSION-STATE.md` agree with it.
9. `node scripts/docs/audit-docs.mjs --claims` — the claim-term scan over `docs/**` (excluding `docs/requirements/**`) reports zero **assertions**. The scanner searches a fixed vocabulary (`award`, `certified`, `certification`, `testimonial`, `client`, `years of experience`, `guaranteed`, `delivered project`, `durability`, `sales`) and classifies each hit by the prohibition markers in its surrounding block — `never`, `not`, `no`, `forbidden`, `fabricat`, `must not`, `out of scope`, `D10`, `OWNER_VERIFICATION_REQUIRED`, `Deliberately not built`. A hit with no prohibition marker in its block is an assertion and fails the run. A plain `grep` is not sufficient here: these documents legitimately use every one of those words while forbidding them, and this document is itself full of such lines.
10. `grep -rn "SUPABASE_SERVICE_ROLE_KEY\|CLOUDINARY_API_SECRET\|GOOGLE_SERVICE_ACCOUNT_JSON" docs/` — matches only the never-expose lists that name them as forbidden, never a value.
11. Confirm the omission register lists all thirteen deferred capabilities with a reason and a seam, and that `\dt` shows no table exists for any of them.

**Exit criteria**

- [ ] The capability boundary is published in `STUDIO_GUIDE.md` as two tables and has been dry-run by the owner with a recorded result.
- [ ] Twelve owner runbooks exist, each a numbered procedure with screenshots taken against fixture data.
- [ ] The owner-verification backlog is generated, current, visible on `/studio`, and every row names the Studio path that resolves it.
- [ ] Every D7 path exists with valid front matter and a real status; no document claims a capability that has no implementing file or route.
- [ ] `/studio/system/documentation` shows exactly the FEAT §30 set and provably cannot reach `.env*`, migrations or requirement internals.
- [ ] The deliberate-omission register lists all thirteen deferred capabilities with reason and seam, and no dead table exists for any of them.
- [ ] `docs/SESSION-STATE.md`, `PROJECT_STATE.md`, `ROADMAP.md` and `CHANGELOG.md` are final, mutually consistent, and show a real status for all 47 phases.
- [ ] The clean-clone recovery sequence has been executed on a fresh machine, is green, and its elapsed time and manual steps are recorded in `README.md`.
- [ ] The support model states plainly that there is no on-call rotation and no SLA, and names the incident path that does exist.
- [ ] `audit-docs.mjs --claims` reports zero assertions: no document anywhere in `docs/**` (outside `docs/requirements/**`) asserts an award, certification, testimonial, client, delivered project, durability claim or sales figure — occurrences of those words survive only inside an explicit prohibition.
- [ ] The handover session is recorded `OWNER_VERIFICATION_REQUIRED` until the owner confirms it took place.
- [ ] Phase-specific D9 evidence: docs updated = every path in D7; tests run = `docs-audit`, `studio-documentation.spec.ts`, and the full suite via the clean-clone proof; next phase = **none — this is the final phase; subsequent work is tracked in `ROADMAP.md` as post-launch backlog**.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## Manifest position across Phases 39–46

| Phase | Manifest interaction |
|---|---|
| 39 | Reads bound assets to derive `og` crops. No generation. |
| 40 | None. Re-derives transformations of already-bound assets. |
| 41 | Audits `alt_text` and `is_decorative` on all 250 rows. No generation. |
| 42 | Commits twelve small fixture derivatives under `tests/fixtures/media/`. Originals untouched; `manifest:verify` green. |
| 43 | **The only phase permitted to append.** All 24 families consumed; new assets only where the four-question decision gate returns four "no" answers; `manifest_version` → `rivya-hf-v2` with the original 250 objects byte-identical. |
| 44 | None. Verifies Cloudinary configuration during preflight. |
| 45 | Adds `media_crops` focal points across the bound families. No generation. |
| 46 | None. Runbook screenshots are documentation images, not media assets. |

The Phase 07 regeneration guard (`assert-no-regeneration.ts`) remains armed and wired into CI for
the whole block. No phase above may modify, replace, upscale or re-encode any of the 250 original
assets (D6, FEAT §33, manifest `policy.rules[4]`).

---

## Open questions for the canonical decisions

These are raised, not acted on. Nothing above knowingly diverges from `CANONICAL-DECISIONS.md`.

1. **Eight widths or nine.** FEAT §45 lists eight viewport widths and every predecessor phase
   document says "eight". The brief that commissioned this document said nine. This document uses
   the eight from §45. If a ninth is genuinely wanted — 1536 and 414 are the two plausible
   candidates — it should be recorded as an amendment naming the width and the reason, because it
   changes `playwright.config.ts`, the Phase 42 snapshot count, and every prior phase's exit
   criteria that cite "all eight widths".
2. **`CRON_SECRET` is still absent from D8.** `PHASE-23-30.md` raised this for the research
   scheduler; Phase 44 needs the same value for the retention and anonymisation crons. Both
   currently authenticate on Vercel's `x-vercel-cron` header, which is untestable outside Vercel.
   Suggested amendment: add `CRON_SECRET` to D8's server-only list. Reusing `REVALIDATE_SECRET` was
   rejected for the same reason it was rejected in Phase 25.
3. **Vercel system variables are not in D8.** `VERCEL_ENV`, `VERCEL_URL`, `VERCEL_GIT_COMMIT_SHA`
   and `VERCEL_GIT_COMMIT_REF` are platform-injected, are not secrets and are not configured by the
   project, but Phase 44 reads all four and the Environment page displays two. D8 fixes the variable
   list without distinguishing "variables the project sets" from "variables the platform injects".
   Suggested amendment: a one-line note in D8 that platform-injected variables are permitted, read
   only, and never treated as secrets.
4. **A per-user rate-limit salt has no home in D8.** Phase 41 hashes IP addresses with an HMAC salt
   so no raw address is stored, matching the `ip_hash` convention Phase 20 already uses. That salt
   is a server secret and D8 does not list one. Suggested amendment: add `IP_HASH_SALT` to D8's
   server-only list, or state that `REVALIDATE_SECRET` may be reused for it — the latter widens one
   secret's blast radius and is not recommended.
5. **Which phase owns `docs/ops/SEO`?** D7 fixes six `docs/ops/*` files and none of them is an SEO
   document. Phase 39 therefore writes its metadata ladder and structured-data allowlist into
   `ARCHITECTURE.md` and `CONTENT_GUIDE.md`, which is defensible but splits the topic across two
   documents. Suggested amendment: either add `docs/ops/SEO.md` to D7, or state explicitly that SEO
   documentation lives in `ARCHITECTURE.md` so a later phase does not create the file.
6. **`media_crops` versus a focal point on `media_assets`.** Phase 43 adds a table keyed by
   `(media_asset_id, aspect_ratio)` so one master can serve several D6 ratios. A simpler design puts
   a single focal point on `media_assets` and lets Cloudinary's `g_auto` do the rest. The table was
   chosen because D6 makes desktop and mobile separate CMS slots and an editor needs different
   framing per ratio, not a single focal point. Confirm the table, or direct the simpler design
   before Phase 45's crop review writes rows into it.
7. **Retention periods are engineering guesses.** Phase 41 proposes 24 months for inquiry personal
   data, Phase 40 proposes 90 days for `web_vitals_samples`, and Phase 23 fixed 90 days for
   `search_queries`. None of these is derivable from any requirement, and the inquiry period in
   particular has legal consequences the owner alone can decide. Suggested amendment: record the
   three retention periods in D5 or `BUSINESS_RULES.md` once the owner has confirmed them; until
   then they are defaults, and this document marks the inquiry period
   **OWNER_VERIFICATION_REQUIRED**.
8. **A consent banner is forbidden by Phase 40 but may be legally required.** No third-party script,
   analytics cookie or advertising identifier exists, so the site sets only a session cookie and a
   dismissal preference — which is why `check-third-party.mjs` can ban vendor banners outright. If a
   jurisdiction nonetheless requires consent tooling, it must be first-party and it needs an
   amendment. Flagged so the owner's legal review has somewhere to land.
9. **Is `LEAVE_EMPTY` an acceptable answer for a category hero?** Phase 43 refuses to borrow one
   category's imagery for another, so `/collection/furniture` and `/collection/collectible-design`
   are either genuinely filled or genuinely empty. D6's asset-priority ladder ends at "temporary
   technical fallback only if unavoidable" without saying whether an empty state qualifies. This
   document reads an honest empty state as strictly better than a borrowed image and treats it as
   the correct fallback. Confirm, or state which fallback D6 intends.
10. **Phase 46 has no successor.** Every phase document ends by naming the next phase, and Phase 46
    is the last in FEAT §44's map. This document records "none — post-launch backlog in
    `ROADMAP.md`" as the answer to D9 point 9. Confirm that satisfies the contract, or state in D9
    what the final phase records instead.
