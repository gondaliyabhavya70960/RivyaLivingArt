# PHASES 10–15 — Public Website, Homepage, About, Process, Large Format, Catalogue, PDP

> Binding parent: `docs/architecture/CANONICAL-DECISIONS.md`. Where this document and the
> canonical decisions differ, the canonical decisions win and this document is wrong.
> Source specifications: `docs/requirements/01-ADVANCED-FEATURE-EXPANSION.md` (cited as
> *FEAT §n*) and `docs/requirements/02-INITIAL-CONTENT-SEED-SYSTEM.md` (cited as *SEED §n*).
> Predecessor documents: `docs/project/phases/PHASE-00-04.md`, `docs/project/phases/PHASE-05-09.md`.

Phases 00–09 produced a toolchain, a design system, a database, staff auth, a Studio, a governed
media library, 250 migrated Higgsfield assets, a page-block CMS and a fully seeded first-pass
website — all of it invisible. This block makes it public. Phase 10 builds the shell that every
public route renders inside. Phases 11–13 turn the structurally-correct block renderers Phase 08
shipped into the finished material experience for the three narrative pages. Phases 14–15 add the
catalogue and the product detail page — the only surfaces that read the `products` table, which is
still and deliberately empty.

## Division of labour with Phase 08 — read this before writing a renderer

Phase 08 registered every block type, its Zod schema, its Studio editor and a **structural**
renderer in `components/sections/<Type>.tsx`: correct semantics, correct fields, unit-tested in
isolation, no art direction. Phases 11–13 do **not** create block types and do **not** rename those
files. They promote the same renderers from structural to finished: responsive art direction across
the D6 ratio slots, motion and its reduced-motion branch, LCP and layout-stability budgets, empty
and partial states, and the composition rules that make a page read as one piece of work.

A new block type in Phases 10–15 is a defect unless this document names it. It would mean Phase 08's
catalogue was incomplete, and the correct repair is a registry entry plus an editor plus a
`CONTENT_GUIDE.md` row — not a bespoke component inside a page file.

## Conventions used by all six phases

| Convention | Value |
|---|---|
| Migration numbering | 10 → `0080–0089`, 11 → `0090–0099`, 12 → `0100–0109`, 13 → `0110–0119`, 14 → `0120–0129`, 15 → `0130–0139` |
| Migration filename | `supabase/migrations/<nnnn>_phase<nn>_<subject>.sql` |
| Public route group | `app/(site)/**` per D2; the Studio group is untouched except where a phase says "fills" |
| Rendering default | Server Component. `'use client'` requires a named reason in the file header comment and a `components/patterns/**` or `components/three/**` home (FEAT §46) |
| Page read path | `lib/cms/resolve.ts` → `resolvePage(path, { draft })`. No route queries `page_sections` directly |
| Catalogue read path | `lib/supabase/repositories/**` only. No route calls `.from(...)` (Phase 03 rule) |
| Copy | Never a literal in JSX (SEED §1, D2). Every string a visitor reads comes from `page_sections`, `global_content`, `faqs`, `seo_entries` or a `products` column |
| Media slots | Desktop and mobile are separate CMS columns (D6): `media_desktop_id`, `media_mobile_id`. A missing mobile asset falls back to the desktop asset re-cropped, never to a placeholder image |
| Concept media | An asset with `is_concept = true` may illustrate a **material** or a **process**. It may never be attached to a product or a portfolio project, and may never be captioned with a product name, price, dimension, client or project (D6, D10, SEED §32) |
| Owner verification | A section whose `owner_verification = 'OWNER_VERIFICATION_REQUIRED'` cannot reach `PUBLISHED` (Phase 08 trigger). Public renderers therefore never need a runtime check — but every phase below asserts the invariant in a test |
| Verification database | Phases 10–15 are proved against a Playwright fixture that seeds **and publishes** the Phase 09 content. Nothing unverified is published to production to make a test pass |

### Inherited-name reconciliation

Two predecessor documents disagree on one string. `PHASE-00-04.md` defines the permission matrix in
`lib/auth/permissions.ts` as `<domain>.<action>` (`catalog.write`); `PHASE-05-09.md` writes
`<resource>:<action>` (`content:publish`). This document uses the **dot** form, because Phase 04
owns the module that declares the union type. `PHASE-05-09.md` also introduces `content:review`,
which is absent from the Phase 04 matrix. Both are raised in *Open questions*; neither is resolved
here, and no phase below depends on which spelling wins.

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

## PHASE 10 — Public Website Foundation

**Goal** — Rivya becomes a website that a stranger can load. This phase builds the single public
shell every route renders inside: a Server-Component root layout, an announcement bar, a header
whose Collection item opens a keyboard-complete mega menu, a footer, the 404 and 500 surfaces, the
metadata and revalidation plumbing, and the WhatsApp handoff module. Every string in that chrome is
read from the Phase 09 seed, so the owner can change the announcement, reorder the navigation or
rewrite the footer without a deploy. Nothing about the *content* of any page changes here — what
changes is that a published page now has somewhere to appear, and an unpublished one returns a real
404 rather than a broken layout.

**Depends on** — Phases 02 (tokens, primitives, patterns), 04 (RLS, so anonymous reads see only
`PUBLISHED`), 06 (`MediaProvider`, `MediaImage`, `MediaVideo`), 08 (`resolvePage`, block registry,
renderers, preview route), 09 (all seeded chrome copy and navigation rows).

**Scope**

- Root and site layouts. `app/layout.tsx` sets `<html lang="en-GB">`, loads the Phase 02 token
  stylesheet and the font faces, and renders nothing else. `app/(site)/layout.tsx` is the public
  shell: skip link → announcement bar → header → `<main id="main">` → footer.
- One request-scoped chrome fetch. `lib/site/chrome.ts` exports `getSiteChrome()`, wrapped in
  `React.cache`, returning announcement, header menu, mobile menu, category children, footer groups
  and site settings in a single round trip. The layout calls it once; no component fetches chrome.
- Announcement bar from `global_content` group `ANNOUNCEMENT`: honours `is_enabled`, renders its CTA,
  and is dismissible per browser via a cookie (`rv_ann_dismissed=<row id>`) read on the server so the
  bar does not flash in and out.
- Header and mega menu. Header is a Server Component; only the mega-menu panel and the mobile drawer
  are client (`components/patterns/MegaMenu/`, `components/patterns/MobileNav/`). Menu content comes
  from `navigation_items` (`menu = 'HEADER'`, children `menu = 'CATEGORY'`). Keyboard model:
  `Escape` closes and restores focus to the trigger, `ArrowDown` enters the panel, `Tab` traverses in
  DOM order, `aria-expanded` on the trigger, panel labelled by the trigger. Hover opens on desktop
  only after a 120 ms intent delay; touch and keyboard open on activation.
- Footer from `navigation_items` (`menu = 'FOOTER'`) grouped into the four SEED §24 columns, plus the
  brand statement and the contact column sourced from site settings — never from a literal.
- Static page routes. One thin file per seeded path, each delegating to `renderCmsPage(path)`:
  `/`, `/about`, `/process`, `/large-format`, `/collection`, `/custom-commissions`, `/portfolio`,
  `/journal`, `/contact`, `/faq`, `/search`, `/privacy`, `/terms`. Later phases replace a file body
  without changing its path.
- `renderCmsPage(path)` in `lib/cms/render-page.tsx`: resolves the page, calls `notFound()` when no
  page row is `PUBLISHED` at that path, and maps each section to its registry renderer through
  `<SectionRenderer />`. An unknown `block_type` renders nothing in production and a visible red
  diagnostic in development.
- 404 and 500. `app/not-found.tsx` and `app/(site)/error.tsx` render SEED §45 and §46 copy from
  `global_content` group `EMPTY_STATE`. Both are token-only surfaces with **no image**, so they still
  render when media delivery is what failed. `app/global-error.tsx` is a last-resort static shell.
- Media failure state (SEED §47). `MediaImage`/`MediaVideo` are wrapped by
  `components/patterns/MediaSlot.tsx`, which reserves the aspect box from the CMS ratio so a failure
  never collapses the layout, and paints a neutral material-toned token surface with the seeded
  "Image temporarily unavailable" label.
- Metadata. `lib/seo/metadata.ts` builds `Metadata` from `seo_entries` with the SEED §41 fallbacks
  (`%s | Rivya Living Art`), OpenGraph and Twitter cards from the social defaults, and `canonical`
  from `NEXT_PUBLIC_SITE_URL`. A page with zero published sections is emitted `noindex` so a
  half-published route cannot enter the index.
- `app/robots.ts` and `app/sitemap.ts` listing published paths only. Full SEO is Phase 39.
- Revalidation. `app/api/revalidate/route.ts`, POST-only, `REVALIDATE_SECRET`-guarded, accepts an
  array of paths and tags. Phase 08's publishing service calls it; this phase supplies the endpoint.
- WhatsApp plumbing (FEAT §51 conversion, D1 business rules). `lib/whatsapp/` renders the SEED §36/§37
  templates from `global_content` group `WHATSAPP_TEMPLATE` with a token allowlist, graceful
  shortening and a hard `wa.me` length cap. Two distinct builders, and the difference is the point:

  | Builder | Signature | Where it may be used |
  |---|---|---|
  | `buildHandoffUrl` | `({ inquiryId: string, template, values })` — `inquiryId` is **required, non-optional** | Only after an inquiry row is persisted (Phase 20). It cannot be called without one, so a conversion cannot skip persistence |
  | `buildDirectContactUrl` | `({ source })` — generic greeting, no inquiry data | Announcement bar, footer contact column, `/contact` "continue on WhatsApp". Nowhere else |

- Guardrails as code: `scripts/site/check-client-boundary.mjs` (no `'use client'` in any
  `app/(site)/**/page.tsx` or `layout.tsx`), `scripts/site/check-whatsapp-usage.mjs` (no literal
  `wa.me` or `api.whatsapp.com` outside `lib/whatsapp/**`; `buildDirectContactUrl` importable only
  from the allowlist above), and `tests/unit/site-routes.test.ts` (the set of route files equals the
  D3 static path set — no missing route, no undeclared route).

**Out of scope**

- Any page's finished appearance. Phase 10 proves a page renders; Phases 11–13 make it good.
- `/collection/[category]`, `/product/[slug]`, `/collections/[slug]`, `/portfolio/[slug]`,
  `/journal/[slug]`, `/journal/category/[slug]` — dynamic routes belong to Phases 14, 15, 16, 17, 18.
- The search *engine* behind `/search` (Phase 23). Phase 10 renders the page's seeded copy and the
  SEED §26 no-results state; the input is present and submits, and returns the no-results surface
  until Phase 23 lands.
- Contact and commission form submission (Phases 19–20). The form renders from its seeded schema and
  its submit button is `disabled` with the seeded helper note until Phase 20 provides persistence.
- Any direct `wa.me` link from a product or commission surface. See the table above.
- Analytics, consent banner, newsletter capture, A/B variants, localisation.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Root layout | `app/layout.tsx` | `lang="en-GB"`, tokens, fonts, nothing visual |
| Site shell | `app/(site)/layout.tsx` | Skip link, announcement, header, `<main>`, footer |
| Chrome loader | `lib/site/chrome.ts` | `getSiteChrome()`, `React.cache`, one round trip |
| Page renderer | `lib/cms/render-page.tsx` | `renderCmsPage(path)`, `<SectionRenderer />` |
| Header | `components/patterns/SiteHeader.tsx` | Server; sticky, scroll-state via CSS only |
| Mega menu | `components/patterns/MegaMenu/{index.tsx,MegaMenuPanel.tsx}` | Client; full keyboard model |
| Mobile nav | `components/patterns/MobileNav/index.tsx` | Client; focus trap from Phase 02 `Drawer` |
| Announcement | `components/patterns/AnnouncementBar.tsx` | Server render, client dismiss action |
| Footer | `components/patterns/SiteFooter.tsx` | Server; four seeded columns + contact |
| Media slot | `components/patterns/MediaSlot.tsx` | Ratio box, desktop/mobile art direction, §47 fallback |
| Static routes | `app/(site)/{page.tsx,about/page.tsx,process/page.tsx,large-format/page.tsx,collection/page.tsx,custom-commissions/page.tsx,portfolio/page.tsx,journal/page.tsx,contact/page.tsx,faq/page.tsx,search/page.tsx,privacy/page.tsx,terms/page.tsx}` | Thin `renderCmsPage` delegates |
| Error surfaces | `app/not-found.tsx`, `app/(site)/error.tsx`, `app/global-error.tsx` | SEED §45/§46 copy, no media |
| Metadata | `lib/seo/metadata.ts`, `app/robots.ts`, `app/sitemap.ts` | SEED §41/§44 fallbacks |
| Revalidation | `app/api/revalidate/route.ts` | POST, secret-guarded, path + tag |
| WhatsApp | `lib/whatsapp/{templates.ts,link.ts,shorten.ts,index.ts}` | Token allowlist, two builders |
| Guardrails | `scripts/site/{check-client-boundary.mjs,check-whatsapp-usage.mjs}` | Wired into `npm run check` |
| Tests | `tests/unit/{site-routes,whatsapp-template,seo-metadata}.test.ts`, `tests/e2e/{site-shell,navigation-a11y}.spec.ts` | Route parity, template safety, keyboard model |
| Docs | `docs/architecture/ARCHITECTURE.md` (public rendering section), `docs/ops/ACCESSIBILITY.md` (navigation model) | FEAT §43 |

**Database** — **None.** Every table this phase reads was created by Phase 06 (`media_assets`) or
Phase 08 (`pages`, `page_sections`, `navigation_items`, `global_content`, `seo_entries`, `faqs`), and
every row it reads was written by Phase 09. Adding a chrome table here would duplicate
`navigation_items` and `global_content`.

**Studio surface** — **None created.** Two additions to existing pages: a "View on site" link on
`/studio/content/pages` that opens the public path (draft mode for unpublished pages, via the Phase 08
preview route), and a resolved-URL preview on `/studio/content/navigation` so an editor can see that
a `href` actually resolves before publishing.

**Public surface** — the thirteen static D3 paths above, plus `404` and `error`. A path whose `pages`
row is not `PUBLISHED` returns 404 with the seeded copy; it does not render an empty shell and it does
not appear in `sitemap.xml`.

**Media** — the mega menu's seven category thumbnails, drawn from `categories.hero_media_id` as bound
in Phase 09: `3d-resin` → `three-d-resin` (13 assets), `wall-statement-art` → `wall-art` (20),
`preservation` → `preservation-varmala` (15) + `preservation-keepsake` (4), `decor` → `decor` (18),
`gifts` → `gifts` (10). `furniture` and `collectible-design` have no bound asset — Phase 09 recorded
both as gaps — so their menu cards render as text-only cards. That is the required behaviour: no
placeholder, no borrowed image from another category. Error pages consume no media by design.

**Risks**

| Risk | Mitigation |
|---|---|
| The mega menu becomes a client-side data fetch and the header waterfalls | `getSiteChrome()` is `React.cache`d and called once in the layout; the menu panel receives its data as props. A Playwright network assertion proves zero client requests for navigation data |
| A `wa.me` link ships from a product surface and bypasses inquiry persistence | `buildHandoffUrl` requires a non-optional `inquiryId`, so the bypass does not type-check; `check-whatsapp-usage.mjs` bans literal WhatsApp hosts outside `lib/whatsapp/**` and fails CI |
| A WhatsApp template leaks an internal field or exceeds the URL limit | Interpolation runs against an allowlist of the exact SEED §36/§37 token names; unknown tokens throw. `shorten.ts` truncates the longest free-text token first, then drops optional blocks in a fixed order, and a unit test asserts the encoded URL stays under 1 800 characters |
| `'use client'` creeps up into a page and destroys Server-Component-by-default | `check-client-boundary.mjs` in `npm run check`; a client component may only live in `components/patterns/**`, `components/three/**` or `components/studio/**` |
| An unpublished page renders an empty shell that reads as "Coming Soon" (SEED §55) | `renderCmsPage` calls `notFound()` when the page or all of its sections are unpublished; an e2e test asserts a 404 status code, not a 200 with an empty `<main>` |
| The announcement bar shifts layout on hydration | Dismissal state is a cookie read on the server; the bar renders in its final state in the first response, and a CLS assertion runs at 390 px |
| Category thumbnails get filled with a "close enough" image from another family | Media binding is Phase 09's map; this phase reads `categories.hero_media_id` and renders text-only when null. A unit test asserts the text-only branch for `furniture` and `collectible-design` |

**Verification**

1. `npm run check` — includes `check-client-boundary.mjs` and `check-whatsapp-usage.mjs`, both green.
2. `npm run build && npm start`. Request `/about` while its `pages` row is `DRAFT` → HTTP 404 with the
   seeded 404 heading. Publish it in the fixture, request again → HTTP 200.
3. `npx playwright test tests/e2e/site-shell.spec.ts` — header, announcement, footer and skip link
   render at all eight FEAT §45 widths; `<main id="main">` is the skip-link target; exactly one `<h1>`.
4. `npx playwright test tests/e2e/navigation-a11y.spec.ts` — keyboard only: `Tab` reaches the
   Collection trigger, `Enter` opens, `aria-expanded="true"`, `ArrowDown` enters the panel, `Escape`
   closes and focus returns to the trigger. The mobile drawer traps focus and restores it. axe reports
   zero critical or serious violations on `/` at 390 px and 1440 px.
5. `grep -rn "wa.me\|api.whatsapp.com" app components | grep -v lib/whatsapp` → no matches.
6. In a Node REPL, call `buildHandoffUrl` without `inquiryId` → TypeScript compile error (assert via
   `tsc` on a fixture file that is expected to fail).
7. `curl -X POST localhost:3000/api/revalidate` without the secret → 401; with it → 200 and the named
   path is refetched on the next request.
8. Throttle Cloudinary to failure in the fixture and load a page with a bound image → the aspect box
   is preserved, the neutral fallback with the seeded label renders, no layout shift.
9. `curl localhost:3000/sitemap.xml` — lists only paths whose page is `PUBLISHED`.
10. `node -e` assert that `tests/unit/site-routes.test.ts` fails when a D3 static path's route file is
    deleted.

**Exit criteria**

- [ ] Every one of the thirteen static D3 paths has a route file, and the route-parity test proves the set is exact.
- [ ] Every visitor-visible string in the chrome comes from `global_content`, `navigation_items` or site settings — zero copy literals in `components/patterns/Site*`.
- [ ] Header, mega menu, mobile nav and footer are keyboard-complete with zero critical/serious axe violations at all eight FEAT §45 widths.
- [ ] The announcement bar honours `is_enabled`, its CTA target and per-browser dismissal, with no hydration shift.
- [ ] 404 and 500 render seeded copy and consume no media.
- [ ] `MediaSlot` preserves the CMS ratio and renders the SEED §47 fallback on failure without collapsing layout.
- [ ] Metadata, `robots.txt` and `sitemap.xml` are driven by `seo_entries` and publication state; a page with zero published sections is `noindex`.
- [ ] `app/api/revalidate` is secret-guarded and is the only revalidation entry point.
- [ ] `buildHandoffUrl` cannot be called without a persisted `inquiryId`, and no WhatsApp host literal exists outside `lib/whatsapp/**`.
- [ ] No `'use client'` in any `app/(site)/**` `page.tsx` or `layout.tsx`.
- [ ] Phase-specific D9 evidence: docs updated = `ARCHITECTURE.md`, `ACCESSIBILITY.md`, `COMPONENT_REGISTRY.md`; tests run = `site-routes`, `whatsapp-template`, `seo-metadata`, `site-shell.spec.ts`, `navigation-a11y.spec.ts`; next phase = 11.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 11 — Homepage + Material Experience

**Goal** — the homepage stops being thirteen correct boxes and becomes the argument for the brand.
This phase finishes all thirteen SEED §10 sections as a single scroll composition: a cinematic hero
that does not cost the Largest Contentful Paint, a material narrative that carries FEAT §4's
`WOOD → RESIN → LIGHT → FORM → SPACE → ART` progression, honest empty behaviour where there is
nothing real to show, and a closing conversion band. It also binds the homepage to the Higgsfield
families that actually exist, and accepts the two places where they do not.

**Depends on** — Phase 10 (shell, `renderCmsPage`, `MediaSlot`), 08 (all thirteen renderers exist
structurally), 09 (all thirteen sections seeded with copy, media bindings and verification flags),
07 (250 migrated assets).

**Scope**

- Promote thirteen Phase 08 renderers to finished. No new block types.
- Hero (`hero`): the LCP element is the **still**, never the video. The desktop still renders as a
  priority `MediaImage` with a Cloudinary AVIF/WebP ladder; the motion layer mounts only after the
  still has painted, only when `prefers-reduced-motion: no-preference`, only when
  `navigator.connection.saveData !== true`, and only above 768 px. `MediaVideo` is `muted`, `loop`,
  `playsInline`, `preload="none"`, poster = the still.
- Material story (`material-story`): the `LIQUID. FORM. CRAFT. OBJECT.` sequence as four stages
  driven by `IntersectionObserver` in `components/patterns/MaterialSequence.tsx`. Reduced motion and
  no-JS both render the same four stages as a static vertical list with all four media visible — a
  *different layout*, not a faster animation.
- Material palette (`material-palette`): four cards. The third card's copy is a capability claim and
  is seeded `OWNER_VERIFICATION_REQUIRED`, so it will not be published until the owner verifies —
  the renderer must therefore lay out correctly with three cards as well as four.
- `selected-works`, `portfolio-strip` and `journal-strip` are **reference blocks**: they render
  entities that may not exist. Each resolves through a selector interface
  (`lib/cms/selectors/{products,projects,articles}.ts`) so Phase 22 can replace the product selector
  with real merchandising without touching the block. With zero published products, zero projects and
  ten `DRAFT` articles, all three render their seeded editorial fallback — never a fabricated card,
  never a skeleton that implies content is loading.
- Section rhythm and theming: alternating `theme` values from the CMS drive light/dark bands; the
  composition is verified as a whole in a full-page visual snapshot, not section by section.
- Performance budget for `/`, enforced in CI by Lighthouse CI: LCP ≤ 2.5 s on Moto G4 / Slow 4G,
  CLS ≤ 0.05, INP ≤ 200 ms, total client JS for the route ≤ 180 kB gzipped, at most three client
  component islands (mega menu, mobile nav, material sequence).
- Homepage `seo_entries` wiring, OpenGraph image selection, and `WebSite` + `Organization` JSON-LD
  containing only the brand name, URL and logo. No `aggregateRating`, no `award`, no `founder`, no
  `foundingDate` — nothing the owner has not supplied (D10).

**Out of scope**

- Homepage merchandising controls — Phase 22 owns `Studio → Merchandising → Homepage`. Phase 11 ships
  the selector seam and the fallback.
- Any product card with a real product in it. `products` has zero rows and Phase 14/15 do not seed any.
- The 3D viewer inside the `three-d-resin` section (Phase 21). Its model slot is reserved and renders
  nothing when empty.
- Journal article pages (Phase 18) and portfolio project pages (Phase 17).
- Generating any new media. Every asset named below already exists in the manifest (D6, FEAT §33).

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Homepage route | `app/(site)/page.tsx` | Unchanged delegate; `export const revalidate` + tag `page:/` |
| Finished renderers | `components/sections/{Hero,Manifesto,CategoryGrid,SelectedWorks,MaterialStory,MaterialPalette,CommissionCta,ThreeDResin,PortfolioStrip,ProcessSteps,SecondaryObjects,JournalStrip,FinalCta}.tsx` | Art direction, motion, empty states |
| Material sequence | `components/patterns/MaterialSequence.tsx` | Client; `IntersectionObserver`; static reduced-motion branch |
| Hero motion | `components/patterns/HeroMotion.tsx` | Client; mounts after paint, gated on reduced motion + save-data + width |
| Entity selectors | `lib/cms/selectors/{products,projects,articles}.ts` | Interface + Phase 11 implementations; Phase 22 swaps products |
| Fallback pattern | `components/patterns/EditorialFallback.tsx` | Renders a seeded `empty-state` payload inside a reference block |
| Perf budget | `lighthouserc.json`, `.github/workflows/lighthouse.yml` | Asserts the budget above on `/` |
| Tests | `tests/unit/selectors-empty.test.ts`, `tests/e2e/{homepage,homepage-motion}.spec.ts`, `tests/e2e/homepage.visual.spec.ts` | Empty behaviour, motion branches, eight-width snapshots |
| Docs | `docs/design/COMPONENT_REGISTRY.md`, `docs/ops/PERFORMANCE.md` | Registry rows for the two new client patterns; the `/` budget |

**Database** — **None.** The selector seam reads existing `products`, `portfolio_projects` (Phase 17)
and `journal_articles` (Phase 18) tables where they exist and returns an empty result where they do
not, so Phase 11 neither creates nor alters a table.

**Studio surface** — **None created.** `/studio/content/homepage` (Phase 08) already edits these
thirteen sections; this phase proves the edits reach the live page. A "preview at breakpoint" control
is added to that editor: 1440, 768 and 390 px, using the Phase 08 preview route.

**Public surface** — `/` only.

**Media** — every family below is real, with the count taken from `data/higgsfield/asset-manifest.json`
(`counts.by_family`). Nothing is generated.

| # | Section | Block type | Primary family (assets) | Supporting family (assets) | Slot ratios |
|---|---|---|---|---|---|
| 01 | Hero | `hero` | `largeformat-dining` (5: 3 image, 2 video) | `interior-lifestyle` (5) | Desktop still 21:9 `LARGEFORMAT-DINING-002`; mobile still 9:16 `LARGEFORMAT-DINING-001`; motion = the video rows sharing those two ids |
| 02 | Manifesto | `manifesto` | `material-macro` (39) | — | 4:5 (4 available in family) |
| 03 | Signature Collections | `category-grid` | Tables → `largeformat-dining` (5) · `largeformat-coffee` (1) · `largeformat-console` (4); Sculptural Furniture → `largeformat-seating` (4); 3D + Resin → `three-d-resin` (13); Statement Art → `wall-art` (20); Architectural → `largeformat-monumental` (1) | — | 4:5 and 3:4 per card |
| 04 | Selected Works | `selected-works` | **None** — zero published products | `interior-lifestyle` (5) as band backdrop only | 16:9 |
| 05 | Material Story | `material-story` | `material-macro` (39, incl. 6 video) | `process-pour` (12, incl. 4 video) | Four stages at 1:1 (11 available in `material-macro`) |
| 06 | Material Palette | `material-palette` | Resin → `material-macro` (39); Wood → `process-timber` (7, incl. 2 video); Fabricated Form → `three-d-resin` (13); Finish → `process-finish` (8) | — | 1:1 / 4:5 |
| 07 | Custom Commission | `commission-cta` | `process-studio` (19, incl. 4 video) | `process-mould` (12) | 3:2 / 4:5 |
| 08 | 3D + Resin | `three-d-resin` | `three-d-resin` (13, 10 at 16:9) | — | 16:9 |
| 09 | Portfolio | `portfolio-strip` | `gallery-scene` (5, incl. 1 video) — **atmosphere behind the editorial statement, never captioned as a project** | — | 21:9 `GALLERY-SCENE-002` |
| 10 | Process | `process-steps` | `process-studio` (19) · `process-pigment` (13) · `process-mould` (12) · `process-pour` (12) · `process-finish` (8) — one per step | — | 4:5 |
| 11 | Secondary Objects | `secondary-objects` | Preservation → `preservation-varmala` (15) + `preservation-keepsake` (4); Décor → `decor` (18, incl. 1 video); Gifts → `gifts` (10) | — | 3:4 / 4:5 |
| 12 | Journal | `journal-strip` | `editorial` (19, incl. 3 video; 11 at 16:9) | `workshop-session` (5, all 16:9) | 16:9 |
| 13 | Final CTA | `final-cta` | `material-macro` 21:9 — `MATERIAL-MACRO-009`, `-011`, `-015`, `-027` | — | 21:9 |

Two honest gaps, both recorded by Phase 09 and neither filled: the homepage has **no dedicated hero
family** (the `home` page bucket contains only the five `interior-lifestyle` assets, none at 21:9 or
9:16), which is why the hero borrows the large-format dining pair; and the section-11 "Personalised
Pieces" card has no family of its own and draws from `gifts` — a personalisation capability claim,
and therefore **OWNER_VERIFICATION_REQUIRED**.

Sections seeded `OWNER_VERIFICATION_REQUIRED` and therefore absent from the published homepage until
the owner verifies them: 03's "3D + Resin" and "Architectural Pieces" cards, 06's "Fabricated Form"
card, 07's six capability chips, 08 in its entirety, 10's five process statements, and 11's
"Personalised Pieces" card (SEED §10). Every one is **OWNER_VERIFICATION_REQUIRED**. The homepage must
read as complete with all of them hidden — that is the launch-day state and it is what the visual
snapshot baseline records.

**Risks**

| Risk | Mitigation |
|---|---|
| The hero video becomes the LCP element and the page fails Core Web Vitals | The still is the LCP element by construction; the video mounts post-paint behind three gates. Lighthouse CI asserts the LCP element selector is the image, not the video |
| Concept media reads as a real, buyable product | Sections 03, 09 and 11 render no price, dimension, product name or project name. A unit test asserts the `category-grid`, `portfolio-strip` and `secondary-objects` payload schemas expose no price or dimension field at all |
| The homepage looks broken when the seven unverified sections are hidden | The visual snapshot baseline is taken with exactly the launch-day published set; a second snapshot with everything verified proves both compositions hold |
| The material sequence pins the page and traps keyboard users | It never captures scroll; it observes it. Reduced motion and no-JS render the static list. A keyboard test asserts every stage's content is reachable by `Tab` in both branches |
| `selected-works` gets "temporarily" hardcoded to make the design look full | The selector returns `[]` and the block renders the seeded fallback; `tests/unit/selectors-empty.test.ts` asserts zero product cards render when `products` is empty, and CI runs against an empty catalogue |
| Borrowing the large-format hero blurs the homepage's own identity | Recorded as a Phase 07 gap with a written brief; the binding is a stated interim, not a silent default, and is listed in `INITIAL_CONTENT_INVENTORY.md` |
| Thirteen sections of media wreck the transfer budget | Only the hero still is `priority`; everything below the fold is lazy with explicit `sizes`; the Lighthouse budget fails the build on regression |

**Verification**

1. `npx playwright test tests/e2e/homepage.spec.ts` — all thirteen sections present in seeded order;
   heading hierarchy is a single `h1` followed by `h2` per section with no level skipped.
2. With an empty catalogue: `selected-works`, `portfolio-strip` and `journal-strip` each render their
   seeded fallback; assert **zero** elements matching `[data-product-card]`, `[data-project-card]`,
   `[data-article-card]`.
3. `npx playwright test tests/e2e/homepage-motion.spec.ts` under
   `prefers-reduced-motion: reduce` — no `transform` or `opacity` transition is applied, the material
   sequence renders four static stages, and the hero video element is absent from the DOM.
4. Emulate Slow 4G with JS disabled → the hero still, all copy and all four material stages render.
5. `npx lhci autorun --collect.url=http://localhost:3000/` — LCP ≤ 2.5 s, CLS ≤ 0.05, INP ≤ 200 ms,
   route JS ≤ 180 kB gzipped; the reported LCP element is the hero image.
6. `npx playwright test tests/e2e/homepage.visual.spec.ts` — snapshots pass at 1920, 1440, 1280, 1024,
   768, 430, 390, 360.
7. `select count(*) from page_sections s join pages p on p.id = s.page_id where p.path = '/' and
   s.owner_verification = 'OWNER_VERIFICATION_REQUIRED' and s.status = 'PUBLISHED'` → 0.
8. Every media id rendered on `/` exists in the manifest:
   `jq -r '.assets[].rivya_asset_id' data/higgsfield/asset-manifest.json` contains each id captured
   from the page's `data-rivya-asset-id` attributes.
9. `curl -s localhost:3000/ | grep -c 'application/ld+json'` → 1; the payload has no `offers`,
   `aggregateRating` or `award` key.
10. Change the hero heading in `/studio/content/homepage`, publish, and confirm the live page updates
    without a deploy.

**Exit criteria**

- [ ] All thirteen SEED §10 sections render from the CMS in seeded order, with zero copy literals in `components/sections/**`.
- [ ] Each section is bound to the families in the media table above; every rendered asset id exists in the manifest and nothing was regenerated.
- [ ] The LCP element on `/` is the hero still; the video mounts only post-paint behind the three gates.
- [ ] Reduced-motion and no-JS branches render complete, readable content — not a degraded animation.
- [ ] `selected-works`, `portfolio-strip` and `journal-strip` render seeded fallbacks with zero fabricated cards against an empty catalogue.
- [ ] The seven `OWNER_VERIFICATION_REQUIRED` sections are absent from the published page, and the page composition holds with and without them.
- [ ] Lighthouse budget met at the stated thresholds; at most three client islands on the route.
- [ ] Visual snapshots pass at all eight FEAT §45 widths; zero critical/serious axe violations at 390 px and 1440 px.
- [ ] JSON-LD asserts nothing the owner has not supplied.
- [ ] Phase-specific D9 evidence: docs updated = `COMPONENT_REGISTRY.md`, `PERFORMANCE.md`, `CONTENT_GUIDE.md`; tests run = `selectors-empty`, `homepage.spec.ts`, `homepage-motion.spec.ts`, `homepage.visual.spec.ts`, Lighthouse CI; next phase = 12.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 12 — About + Process

**Goal** — the two pages that explain who Rivya is and how a piece is made become finished, and they
become the site's proof that concept media can be used with integrity. About is five sections carried
almost entirely by the 39-asset `material-macro` family; Process is a hero plus seven chapters mapped
onto the seven process families, 79 assets in total. Both pages assert capability, so both are heavy
with `OWNER_VERIFICATION_REQUIRED` sections that will not publish until the owner confirms them — and
both must read as complete while those sections are withheld.

**Depends on** — Phases 10, 11 (the finished `hero`, `statement` and `process-steps` renderers and the
`MediaSlot` art-direction pattern).

**Scope**

- `/about`, five sections in seeded order, block types already registered by Phase 08:

  | # | SEED §11 section | Block type | Verification |
  |---|---|---|---|
  | 01 | About hero — "We work where material becomes expression." | `hero` | `NOT_REQUIRED` |
  | 02 | Philosophy — "The material is the object." | `statement` | `NOT_REQUIRED` |
  | 03 | Scale — "From intimate objects to room-defining pieces." | `scale-statement` | **OWNER_VERIFICATION_REQUIRED** |
  | 04 | Bespoke — "Designed around context." | `statement` | **OWNER_VERIFICATION_REQUIRED** |
  | 05 | Closing — "Living art is art that becomes part of living." + `Start a Commission` | `statement` with CTA | `NOT_REQUIRED` |

- `/process`, eight sections: a `hero` plus one `process-steps` section per SEED §16 step, each
  carrying a single step so it has its own media slots, its own position and its own verification
  flag. All seven step sections are **OWNER_VERIFICATION_REQUIRED** (SEED §16 explicitly, and Phase 09
  seeded them that way), and step 04 additionally carries the "avoid specific production claims until
  verified" note in its Studio helper copy.
- The About page's scale section is the site's one legitimate use of a 21:9 crop at editorial scale;
  it uses the `material-macro` 21:9 assets rather than a large-format product shot, so no reader can
  mistake it for a delivered piece.
- Process chapter treatment: each chapter is a two-column band that inverts on alternate steps, with
  the step number as a `technical` type-scale element from Phase 02. Chapters are individually
  hideable, so a page with three verified steps still reads as a sequence and renumbers by position,
  not by a hardcoded index.
- Concept-media honesty on both pages: every rendered asset carries `is_concept = true`. Captions,
  where present, describe the *material or process* shown. No caption names a piece, a project, a
  client, a timeline or a technique the owner has not verified.
- SEO from `seo_entries` for both paths, with the SEED §11 and §16 titles and descriptions.

**Out of scope**

- `/custom-commissions` (Phase 19) and `/portfolio` (Phase 17), even though both are linked from these
  pages. Phase 12 links to them; it does not build them.
- Any studio-team, founder, biography, timeline, "years of experience" or credentials content. None is
  seeded and none may be invented (D10, SEED §55).
- Video-led treatment of the process chapters. The six process videos exist and are bound as optional
  motion layers, but the chapters are complete without them.
- A "materials" index route. `/collection/[category]` covers material-led browsing from Phase 14.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| About route | `app/(site)/about/page.tsx` | Delegate; `revalidate` tag `page:/about` |
| Process route | `app/(site)/process/page.tsx` | Delegate; `revalidate` tag `page:/process` |
| Statement renderer | `components/sections/Statement.tsx` | Finished: measure, optional CTA, optional media |
| Scale renderer | `components/sections/ScaleStatement.tsx` | Finished: 21:9 desktop / 4:5 mobile art direction |
| Process chapter | `components/sections/ProcessSteps.tsx` | Single-step and multi-step modes; alternating bands; positional numbering |
| Chapter media | `components/patterns/ChapterMedia.tsx` | Still + optional muted motion layer, reduced-motion static |
| Tests | `tests/e2e/{about,process}.spec.ts`, `tests/e2e/{about,process}.visual.spec.ts`, `tests/unit/process-numbering.test.ts` | Order, hidden-section behaviour, renumbering |
| Docs | `docs/content/CONTENT_GUIDE.md`, `docs/media/MEDIA_GUIDE.md` | Chapter authoring rules; concept-caption rules |

**Database** — **None.**

**Studio surface** — **None created.** Both pages are edited through `/studio/content/pages` (Phase 08).
This phase adds one thing to that editor: a per-section verification banner that names the exact claim
requiring owner sign-off, sourced from the section's Studio helper copy seeded in Phase 09.

**Public surface** — `/about`, `/process`.

**Media** — the whole `about` and `process` page buckets from the manifest, 118 assets, all already
migrated in Phase 07.

| Page | Section | Family (assets) | Notes |
|---|---|---|---|
| `/about` | Hero | `material-macro` (39) | 16:9 desktop (13 available), 4:5 mobile (4 available) |
| `/about` | Philosophy | `material-macro` | 1:1 (11 available) |
| `/about` | Scale | `material-macro` 21:9 — `MATERIAL-MACRO-009`, `-011`, `-015`, `-027` | The only 21:9 crops in the family |
| `/about` | Bespoke | `material-macro` | 4:5 |
| `/about` | Closing | `material-macro` (incl. 6 video) | Optional motion layer |
| `/process` | Hero | `process-studio` (19, incl. 4 video) | 16:9 (13 available) |
| `/process` | 01 Brief | `process-studio` (19) | Tool wall, bench, workspace |
| `/process` | 02 Material Direction | `process-pigment` (13, incl. 2 video) + `process-timber` (7, incl. 2 video) | Colour and timber selection |
| `/process` | 03 Form Development | `process-mould` (12, incl. 1 video) | Mould building |
| `/process` | 04 Fabrication | `process-mould` (12) + `process-timber` (7) | Claims-sensitive; see helper copy |
| `/process` | 05 Resin Work | `process-pour` (12, incl. 4 video) + `process-cure` (8) | Pour and cure |
| `/process` | 06 Finishing | `process-finish` (8) | Sanding, edges, transitions |
| `/process` | 07 Final Review | `process-studio` (19) | Reviewed object in the studio |

Family totals reconcile to the manifest exactly: `material-macro` 39 = the `about` bucket;
`process-studio` 19 + `process-pigment` 13 + `process-mould` 12 + `process-pour` 12 + `process-cure` 8
+ `process-finish` 8 + `process-timber` 7 = 79 = the `process` bucket.

**Risks**

| Risk | Mitigation |
|---|---|
| A process chapter reads as a documented, guaranteed production method | All seven are **OWNER_VERIFICATION_REQUIRED** and cannot publish unverified; the Studio banner names the claim; captions describe only what is visible in the frame |
| The Process page publishes with gaps and looks unfinished | Numbering is positional, bands alternate by rendered index, and a unit test renders 1, 3 and 7 chapters asserting contiguous numbering and correct alternation |
| A concept image acquires a caption naming a piece or a client | `CONTENT_GUIDE.md` caption rule; an e2e assertion that no caption on `/about` or `/process` matches a currency symbol, a dimension pattern (a number followed by `mm`, `cm`, `m`, `in` or `ft`) or the word "client" |
| Six process videos autoplay together and saturate the connection | At most one motion layer plays at a time, gated by `IntersectionObserver`; all are `preload="none"` with posters; reduced motion and save-data render stills |
| About drifts into founder-story or credentials copy over time | No such field exists in the seeded schema; adding one requires a block-schema change and a `CONTENT_GUIDE.md` entry, which review rejects without owner-supplied facts |
| The 21:9 scale image is cropped to nothing on mobile | Mobile uses a separate 4:5 slot per D6, not a CSS crop of the 21:9 asset; a visual snapshot at 360 px proves it |

**Verification**

1. `npx playwright test tests/e2e/about.spec.ts` — five sections in seeded order; one `h1`; the
   closing CTA resolves to `/custom-commissions` and returns 200 or a deliberate 404 before Phase 19,
   never a broken link inside the page body.
2. `npx playwright test tests/e2e/process.spec.ts` — hero plus seven chapters; step numbers read
   01–07 contiguously.
3. Unpublish chapters 02 and 05 in the fixture; reload — five chapters render, numbered 01–05, bands
   still alternate. `tests/unit/process-numbering.test.ts` covers the same for 1, 3 and 7 chapters.
4. `select count(*) from page_sections s join pages p on p.id = s.page_id
   where p.path in ('/about','/process') and s.status = 'PUBLISHED'
     and s.owner_verification = 'OWNER_VERIFICATION_REQUIRED'` → 0.
5. Assert every rendered `data-rivya-asset-id` on `/about` belongs to `material-macro`, and on
   `/process` to one of the seven process families, by joining against the manifest.
6. Caption scan: no caption on either page matches `₹|\$|€|\d+\s?(mm|cm|m|in|ft)|client|customer|award`.
7. `npx playwright test tests/e2e/{about,process}.visual.spec.ts` — snapshots at all eight widths.
8. Reduced motion: no video element mounts on either page; all chapter stills render.
9. axe on both pages at 390 px and 1440 px — zero critical or serious violations.
10. Edit the About philosophy body in Studio, publish, reload — the change is live with no deploy.

**Exit criteria**

- [ ] `/about` renders exactly the five SEED §11 sections and `/process` the SEED §16 hero plus seven chapters, all from the CMS.
- [ ] Sections 03 and 04 of About and all seven Process chapters carry `OWNER_VERIFICATION_REQUIRED` and are absent from the published page until verified.
- [ ] Both pages read as complete with their unverified sections withheld, proven by a snapshot of the launch-day published set.
- [ ] Process chapters renumber positionally and alternate correctly at 1, 3, 5 and 7 chapters.
- [ ] Every asset used belongs to the page's own manifest bucket; no asset was regenerated.
- [ ] No caption, alt text or body on either page names a piece, price, dimension, client, award or timeline.
- [ ] At most one motion layer plays at a time; reduced motion renders stills only.
- [ ] Visual snapshots pass at all eight widths; zero critical/serious axe violations.
- [ ] Phase-specific D9 evidence: docs updated = `CONTENT_GUIDE.md`, `MEDIA_GUIDE.md`, `COMPONENT_REGISTRY.md`; tests run = `about.spec.ts`, `process.spec.ts`, `process-numbering`, both visual specs; next phase = 13.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 13 — Large Format Experience

**Goal** — the priority category gets the page it deserves. SEED §56 fixes large-format furniture as
position one in the content hierarchy, and until now nothing on the site has made that visible.
`/large-format` becomes the site's most cinematic page: a 21:9 hero, a category-framing statement, the
six SEED §12 category groupings, a customization statement about what changes when a piece gets large,
and a conversion band. It is also the page with the highest density of capability claims, and this
phase is explicit about which of them the owner must confirm before anything is published.

**Depends on** — Phases 10, 11, 12 (`hero`, `category-intro`, `category-list`, `customization-note`,
`final-cta` renderers in their finished form).

**Scope**

- `/large-format`, five sections plus six category entries, exactly as Phase 09 seeded them:

  | # | SEED §12 section | Block type | Content |
  |---|---|---|---|
  | 01 | Hero — "Designed to shape the room around them." | `hero` | CTA `Discuss a Large-Format Project` |
  | 02 | Category intro — "Furniture as a focal point." | `category-intro` | Framing paragraph |
  | 03 | The six categories | `category-list` | Six entries, each with heading, description, media slot and its own verification flag |
  | 04 | Customization — "Scale changes the conversation." | `customization-note` | **OWNER_VERIFICATION_REQUIRED** |
  | 05 | CTA — "Planning a custom table, statement piece or spatial installation?" | `final-cta` | CTA `Start the Conversation` |

- The six category entries, their manifest section and their verification status:

  | Entry | Manifest section | Assets | Verification |
  |---|---|---|---|
  | Dining & Statement Tables | `dining-tables` | 5 (3 image, 2 video) | `NOT_REQUIRED` |
  | Coffee & Centre Tables | `coffee-tables` | 1 | `NOT_REQUIRED` |
  | Consoles & Side Pieces | `consoles` (4) + `side-pieces` (3) | 7 | `NOT_REQUIRED` |
  | Conference & Commercial Tables | — none | 0 | **OWNER_VERIFICATION_REQUIRED** (SEED §12 explicit) |
  | Sculptural Seating | `sculptural-seating` | 4 | **OWNER_VERIFICATION_REQUIRED** (SEED §12: "mark if not yet produced") |
  | Architectural & Statement Pieces | `architectural` | 1 | **OWNER_VERIFICATION_REQUIRED** (SEED §12 explicit) |

- **These six are editorial groupings on one page, not taxonomy.** They are `category-list` entries in
  `page_sections.payload`, not rows in the `categories` table, and they create no routes. The seven
  taxonomy categories in D3 are a different, disjoint set. A card links out only when a published
  target exists; otherwise it is non-interactive editorial. No card ever links to a 404.
- Hero art direction: desktop 21:9 `LARGEFORMAT-DINING-002`, mobile 9:16 `LARGEFORMAT-DINING-001`,
  with the two same-id video rows as the optional motion layer, gated exactly as the homepage hero.
- Scale as a design device: the category band uses the widest container in the design system and the
  largest display type step, and image crops favour the horizontal. This is where FEAT §49's "does
  large furniture visually dominate?" audit is answered.
- Cross-links to `/custom-commissions` (Phase 19) and `/contact` (Phase 20) render as CTAs whose
  targets are validated at render time; an unresolvable target is omitted rather than rendered dead.
- Two of the six categories have one asset each and one has none. The renderer therefore supports a
  text-only card as a first-class layout, not a degraded one.

**Out of scope**

- Product listings on this page. `/large-format` is editorial; browsing is `/collection` (Phase 14).
  No `products` query runs on this route.
- Any dimension, weight, capacity, seat count, lead time or price. Not one of these exists in the
  seeded payload schema for `category-list`, and none may be added without owner-supplied facts.
- A `/large-format/[entry]` route family. Adding one would make editorial groupings look like taxonomy
  and would need a D3 amendment.
- Generating a `largeformat-conference` family. The gap is recorded, briefed in
  `HIGGSFIELD_MASTER_ASSET_PLAN.md` and left unfilled (D6, FEAT §33).
- The large-format *research* workspace at `/studio/research/large-format` — Phase 30.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Route | `app/(site)/large-format/page.tsx` | Delegate; `revalidate` tag `page:/large-format` |
| Category list renderer | `components/sections/CategoryList.tsx` | Finished: media card, text-only card, optional link, per-entry verification |
| Category intro renderer | `components/sections/CategoryIntro.tsx` | Finished |
| Customization note renderer | `components/sections/CustomizationNote.tsx` | Finished; renders nothing when unverified |
| Wide hero treatment | `components/patterns/WideHero.tsx` | 21:9 desktop / 9:16 mobile art direction, shared with future exhibition pages |
| Link validator | `lib/site/resolve-target.ts` | `resolveInternalTarget(href)` → published path or `null` |
| Tests | `tests/e2e/large-format.spec.ts`, `tests/e2e/large-format.visual.spec.ts`, `tests/unit/resolve-target.test.ts` | Entry count, text-only card, dead-link absence |
| Docs | `docs/content/CONTENT_GUIDE.md`, `docs/media/HIGGSFIELD_ASSET_STATUS.md` | Editorial-vs-taxonomy rule; the conference gap |

**Database** — **None.** The six entries live in `page_sections.payload`, validated by the Phase 08
`category-list` Zod schema.

**Studio surface** — **None created.** Edited at `/studio/content/pages` → Large Format. This phase adds
per-entry controls to the existing `category-list` editor: reorder, hide, set desktop and mobile media,
set an optional target, and set the entry's verification flag. Setting `VERIFIED` remains owner/admin
only (Phase 08).

**Public surface** — `/large-format`.

**Media** — the entire `large-format` page bucket, 18 assets, already migrated.

| Section | Family (assets) | Slots |
|---|---|---|
| Hero | `largeformat-dining` (5) | Desktop 21:9 `LARGEFORMAT-DINING-002`; mobile 9:16 `LARGEFORMAT-DINING-001`; motion from the two video rows sharing those ids |
| Category intro | `largeformat-console` (4, three at 16:9) | 16:9 |
| Dining & Statement Tables | `largeformat-dining` (5) | 16:9 `LARGEFORMAT-DINING-003`, 21:9, 9:16 |
| Coffee & Centre Tables | `largeformat-coffee` (1) | 3:2 `LARGEFORMAT-COFFEE-001` — the family's only asset |
| Consoles & Side Pieces | `largeformat-console` (4) + `largeformat-side` (3) | 16:9 and 4:5 |
| Conference & Commercial Tables | none | Text-only card; gap recorded, not filled |
| Sculptural Seating | `largeformat-seating` (4, all 4:5) | 4:5 — no 16:9 exists in this family |
| Architectural & Statement Pieces | `largeformat-monumental` (1) | 21:9 `LARGEFORMAT-MONUMENTAL-001`; no mobile crop exists — Phase 09 recorded this gap |
| Customization + CTA | `interior-lifestyle` (5) or `material-macro` 21:9 | Atmosphere only |

Note for the implementer: the manifest splits `consoles` and `side-pieces` into two sections while
SEED §12 merges them into one category. The card therefore draws from both, selected by
`subject_tags`, not by `section`.

**Risks**

| Risk | Mitigation |
|---|---|
| Three thin or empty categories make the page look unfinished | The text-only card is a designed layout with its own snapshot, not a fallback; and three of the six are unverified at launch anyway, so the launch composition is four cards, which the baseline snapshot records |
| The six editorial groupings get mistaken for taxonomy and grow routes | Stated explicitly above and in `CONTENT_GUIDE.md`; `tests/unit/site-routes.test.ts` (Phase 10) fails if a `/large-format/*` route file appears |
| A card links to `/collection/furniture` before that page publishes | `resolveInternalTarget` returns `null` for an unpublished path and the card renders non-interactive; an e2e assertion finds zero anchors resolving to a 404 |
| The customization statement publishes unverified and asserts capability Rivya lacks | Seeded `OWNER_VERIFICATION_REQUIRED`; Phase 08 refuses to publish it; `CustomizationNote` also renders nothing if it ever arrives unverified — belt and braces |
| Someone fills the conference gap with a dining image | The binding map only accepts manifest ids for the declared family; the gap is listed in `HIGGSFIELD_ASSET_STATUS.md` and the CI regeneration guard from Phase 07 stays armed |
| Sculptural seating's four 4:5 assets get stretched into a 16:9 band | The card's ratio comes from the bound asset, not the layout; the layout adapts. A visual snapshot at 1440 px covers the mixed-ratio row |
| The page drifts into gift-store framing over time | SEED §56 priority is asserted by a test on `/`'s section order (`secondary-objects` must come after `category-grid`) and by this page's position in the header menu |

**Verification**

1. `npx playwright test tests/e2e/large-format.spec.ts` — five sections; the `category-list` renders
   the published entries in seeded order; each entry has a heading and a description.
2. With the launch-day published set, exactly three entries render (Dining, Coffee, Consoles & Side
   Pieces) — the other three are unverified. Mark all three `VERIFIED` in the fixture and assert six.
3. The Conference entry, when verified, renders as a text-only card with no image element and no
   broken-image icon.
4. `select count(*) from page_sections s join pages p on p.id = s.page_id where p.path =
   '/large-format' and s.status = 'PUBLISHED' and s.owner_verification =
   'OWNER_VERIFICATION_REQUIRED'` → 0.
5. Collect every internal `href` on the page and request each — zero 404s, zero anchors with an empty
   or `#` target.
6. Scan the rendered text for `₹|\$|€|\d+\s?(mm|cm|m|in|ft)|kg|seats` → no matches.
7. Assert the hero's desktop source is `LARGEFORMAT-DINING-002` at 21:9 and the mobile source is
   `LARGEFORMAT-DINING-001` at 9:16, and that under reduced motion no video element mounts.
8. `npx playwright test tests/e2e/large-format.visual.spec.ts` — snapshots at all eight widths,
   including the mixed-ratio category row.
9. axe at 390 px and 1440 px — zero critical or serious violations; the non-interactive cards are not
   focusable and are not announced as links.
10. `ls app/\(site\)/large-format/` → only `page.tsx`; no sub-route exists.

**Exit criteria**

- [ ] `/large-format` renders the five SEED §12 sections and the six category entries from the CMS, in seeded order.
- [ ] Conference & Commercial Tables, Sculptural Seating and Architectural & Statement Pieces each carry `OWNER_VERIFICATION_REQUIRED` and are withheld until verified; the customization statement likewise.
- [ ] The launch-day composition (three verified entries) and the fully-verified composition (six) both pass visual review.
- [ ] The text-only card is a designed state with its own snapshot; no placeholder image is used for the conference gap.
- [ ] The six entries create no routes and are documented as editorial groupings, not taxonomy.
- [ ] Every internal link resolves to a published path; unresolvable targets render non-interactive.
- [ ] No price, dimension, weight, seat count or lead time appears anywhere on the page.
- [ ] All 18 `large-format` bucket assets are accounted for: bound, or recorded as unused with a reason.
- [ ] Phase-specific D9 evidence: docs updated = `CONTENT_GUIDE.md`, `HIGGSFIELD_ASSET_STATUS.md`, `COMPONENT_REGISTRY.md`; tests run = `large-format.spec.ts`, `large-format.visual.spec.ts`, `resolve-target`; next phase = 14.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 14 — Product Catalog

**Goal** — the catalogue becomes browsable. `/collection` and the seven `/collection/[category]` pages
render published products with server-driven filters, sort and pagination, a truthful price-state
vocabulary that never implies a number Rivya has not given, and empty states that say the collection
is being prepared rather than inventing something to fill the grid. This phase also builds the Studio
product editor, because "products come from owner entry" (SEED §32) is only true if there is somewhere
to enter them. At the end of this phase the catalogue is fully functional and completely empty, and
both of those are correct.

**Depends on** — Phases 03 (`products`, `categories`, `product_materials`, repositories), 04
(`catalog.write` / `catalog.publish`), 06 (media), 10 (shell), 13 (category-page copy verified).

**Scope**

- `/collection` — landing, two seeded sections (`hero`, `category-list`) listing the seven D3 categories
  in SEED §56 priority order: `furniture · collectible-design · 3d-resin · wall-statement-art ·
  preservation · decor · gifts`. Order is read from `categories.sort_order`, editable in Studio.
- `/collection/[category]` — `generateStaticParams` over published categories; an unknown or
  unpublished slug returns 404. Each page renders its seeded SEED §14 heading and description above the
  grid.
- Product grid. `components/patterns/ProductCard.tsx`: hero image (real media only), title, category,
  price-state label, and up to two state badges. No hover-reveal of specifications, no comparison
  checkbox, no cart affordance of any kind (D1).
- Filters, entirely in the URL, entirely server-rendered — no client state library, no client fetch:

  | Param | Values | Source |
  |---|---|---|
  | `material` | comma-separated material slugs | `product_materials` |
  | `price` | `FIXED · STARTING_FROM · REQUEST_QUOTE · PRICE_ON_REQUEST` | `products.price_state` |
  | `availability` | `READY_STOCK · MADE_TO_ORDER` | `products.availability_state` |
  | `edition` | `ONE_OF_ONE · LIMITED_EDITION · OPEN_EDITION` | `products.edition_state` |
  | `scale` | `large-format` | `products.is_large_format` |
  | `customizable` | `1` | `products.is_customizable` |
  | `collection` | collection slug | `product_collections` |
  | `sort` | `curated · newest · title` | see below |
  | `page` | integer ≥ 1 | pagination |

  `lib/catalog/query.ts` Zod-parses `searchParams`; an unparseable value is dropped and the canonical
  URL is emitted without it. Facet counts are computed from the same query, and a facet with a zero
  count is **hidden**, not rendered as a dead option.
- Sort. `curated` (default: `sort_order` nulls last, then `published_at desc`), `newest`
  (`published_at desc`), `title` (`title asc`, `citext`). **Price sort is deliberately absent**: with
  four price states, three of which carry no number, a price ordering would be a fiction. This is a
  decision, not an omission.
- Pagination. Page-number based, 24 per page, `?page=n`, with `rel="prev"`/`rel="next"` and a canonical
  URL per page. Not infinite scroll — crawlable and keyboard-navigable by construction.
- Price-state and badge vocabulary. Ten SEED §30 labels split by what they actually are:

  | Label | Kind | Column | Rendering rule |
  |---|---|---|---|
  | `Price` | price state `FIXED` | `price_minor` + `currency` | Label then formatted amount |
  | `From` / `Starting from` | price state `STARTING_FROM` | `price_from_minor` + `currency` | Label then formatted amount; which of the two words is used is a `global_content` label choice |
  | `Request a Quote` | price state `REQUEST_QUOTE` | — | Label only; never a number, never `0` |
  | `Price on Request` | price state `PRICE_ON_REQUEST` | — | Label only |
  | `Ready Stock` | availability | `availability_state` | Badge; seeded `OWNER_VERIFICATION_REQUIRED` (Phase 09) |
  | `Made to Order` | availability | `availability_state` | Badge |
  | `One of One` | edition | `edition_state` | Badge |
  | `Limited Edition` | edition | `edition_state` | Badge; requires `edition_size` to be set |
  | `Customizable` | capability | `is_customizable` | Badge; links to the customization entry point |

  Every label string is read from `global_content` group `COMMERCE_LABEL`; none is a literal.
- Empty states, three distinct ones:

  | Situation | Source | Key |
  |---|---|---|
  | The category has no published products | SEED §27, seeded in Phase 09 | `empty.collection` |
  | Filters exclude every product | new, seeded by this phase as `EDITORIAL_COPY` | `empty.collection.no_results` — with a "clear filters" action |
  | The whole catalogue is empty | SEED §27 | `empty.collection` on `/collection` too |

- Studio catalogue editor. Fills `/studio/catalog/products` (list, filter, create, edit, publish) and
  `/studio/catalog/{categories,collections,materials}`. The product form carries the FEAT §22
  publication-readiness checklist as a transparent list of unmet items — Title, Description, Category,
  Price state, Dimensions, Materials, Hero image, Gallery, SEO, Customization — never an opaque score,
  and publishing is refused while a required item is unmet.
- Data-quality validation at write time (FEAT §21): duplicate SKU, duplicate slug, impossible
  dimensions, malformed URL, broken media reference, invalid price state, a quote-only product carrying
  a price, and missing required publication data are each rejected with a named error.

**Out of scope**

- Seeding any product. `products` has zero rows at the end of this phase and every category page renders
  its empty state (SEED §32). No demo product, no fixture product in the production database.
- `/collections/[slug]` exhibition pages — Phase 16.
- Bulk import, bulk edit and CSV — Phase 24. Product relationships editor — Phase 23.
- The customization form builder — Phase 19. Phase 14 stores `is_customizable` and links out.
- Search — Phase 23. The catalogue's filters are not a search engine.
- Any checkout, cart, wishlist, stock decrement or payment affordance (D1, FEAT §39).

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Landing route | `app/(site)/collection/page.tsx` | Seeded sections + category list |
| Category route | `app/(site)/collection/[category]/page.tsx` | `generateStaticParams`, `generateMetadata` |
| Query parser | `lib/catalog/query.ts` | Zod over `searchParams`; canonical URL builder |
| Listing repository | `lib/supabase/repositories/catalog-listing.ts` | One query for rows, one for facet counts |
| Product card | `components/patterns/ProductCard.tsx` | Server component |
| Filter rail | `components/patterns/FilterRail.tsx` | Progressive enhancement: a `<form method="get">` that works without JS |
| Sort + pagination | `components/patterns/{SortSelect,Pagination}.tsx` | `SortSelect` is a no-JS-safe form control |
| Price presenter | `lib/catalog/price.ts` | `presentPrice(product, labels)`; the only place a price is formatted |
| Studio catalogue | `app/(studio)/studio/catalog/{products,categories,collections,materials}/**` | List, form, publish, readiness checklist |
| Validation | `lib/catalog/validation.ts` | FEAT §21 rules, shared by Studio and API |
| Migrations | `supabase/migrations/0120_phase14_commerce_enums.sql`, `0121_phase14_commerce_columns.sql`, `0122_phase14_catalog_guards.sql` | See **Database** |
| Seed addition | `content/seed/commerce-labels.ts` | Adds `empty.collection.no_results`; existing keys untouched |
| Tests | `tests/unit/{catalog-query,price-presenter,catalog-validation}.test.ts`, `tests/e2e/{collection,collection-empty,catalog-studio}.spec.ts` | Filters, labels, empty behaviour, owner entry |
| Docs | `docs/architecture/DATA_MODEL.md`, `docs/project/BUSINESS_RULES.md`, `docs/studio/STUDIO_GUIDE.md` | New columns; the price vocabulary; the product editor |

**Database**

`0120_phase14_commerce_enums.sql` — enum values only, so the transaction that adds them never uses them:

```sql
alter type price_state add value if not exists 'FIXED';
create type availability_state as enum ('READY_STOCK','MADE_TO_ORDER');
create type edition_state     as enum ('ONE_OF_ONE','LIMITED_EDITION','OPEN_EDITION');
```

`0121_phase14_commerce_columns.sql` — columns and indexes:

| Table | Change |
|---|---|
| `products` | `+ price_minor bigint`, `+ availability_state availability_state`, `+ edition_state edition_state`, `+ edition_size int`, `+ is_customizable boolean not null default false`, `+ sort_order int` |
| `products` | Index `products_listing_idx on (category_id, status, sort_order nulls last, published_at desc)` |
| `products` | Index `products_facets_idx on (status, is_large_format, price_state, availability_state, edition_state)` |
| `product_materials` | Index on `(material_id, product_id)` for the material facet |
| `commerce label rows` | No new table — `empty.collection.no_results` is a `global_content` row in group `EMPTY_STATE` |

`0122_phase14_catalog_guards.sql` — the constraints that make the vocabulary honest:

```sql
-- replaces the Phase 03 constraint; a quote-only product still can never carry a number
alter table products drop constraint products_price_state_coherent;
alter table products add  constraint products_price_state_coherent check (
     (price_state = 'FIXED'          and price_minor      is not null and price_minor      > 0
                                     and currency is not null and price_from_minor is null)
  or (price_state = 'STARTING_FROM'  and price_from_minor is not null and price_from_minor > 0
                                     and currency is not null and price_minor      is null)
  or (price_state in ('REQUEST_QUOTE','PRICE_ON_REQUEST')
                                     and price_minor is null and price_from_minor is null
                                     and currency is null)
);

-- Limited Edition must state its size
alter table products add constraint products_edition_size_coherent check (
  edition_state <> 'LIMITED_EDITION' or edition_size is not null
);

-- an unverified capability claim can never be published (mirrors the Phase 08 rule for sections)
alter table products add constraint products_verified_before_publish check (
  status <> 'PUBLISHED' or owner_verification <> 'OWNER_VERIFICATION_REQUIRED'
);

-- concept media may illustrate a material or a process, never a product (D6, D10)
create or replace function public.reject_concept_product_media() returns trigger
  language plpgsql as $$
begin
  if exists (select 1 from media_assets m where m.id = new.media_asset_id and m.is_concept) then
    raise exception 'concept media cannot be attached to a product (%)', new.media_asset_id;
  end if;
  return new;
end $$;
create trigger product_media_reject_concept before insert or update on product_media
  for each row execute function public.reject_concept_product_media();
```

RLS is inherited from Phase 04's four-policy pattern; the new columns need no new policy.

**Studio surface** — **fills** `/studio/catalog/products` (list with status and readiness columns;
create and edit form; publish/unpublish with the readiness gate), `/studio/catalog/categories` (order,
copy, hero media, SEO), `/studio/catalog/collections` (concepts stay `DRAFT_COLLECTION_CONCEPT` per
FEAT §9), `/studio/catalog/materials`. `/studio/catalog/{relationships,customization-forms,bulk}` remain
Phase 23/19/24 stubs. Every mutation goes through `withAudit()` and re-checks `catalog.write` or
`catalog.publish` server-side.

**Public surface** — `/collection`, `/collection/[category]` for the seven seeded slugs.

**Media** — category hero and card imagery only, from the Phase 09 bindings:
`3d-resin` → `three-d-resin` (13), `wall-statement-art` → `wall-art` (20), `preservation` →
`preservation-varmala` (15) + `preservation-keepsake` (4), `decor` → `decor` (18), `gifts` → `gifts`
(10). `furniture`, `collectible-design` and the `/collection` landing hero have no bound asset — three
gaps Phase 09 recorded — so those surfaces render type-led, with no borrowed image. **Product** imagery
consumes nothing from the manifest, by database trigger: a product's media must be real Rivya media
(D6 asset priority 1), and there is none yet.

**Risks**

| Risk | Mitigation |
|---|---|
| A demo product is added "just to see the grid" and survives to production | Zero-product assertion in CI against the production-shaped fixture; `tests/e2e/collection-empty.spec.ts` is the primary listing test, not a secondary one; the seed runner's table allowlist (Phase 09) excludes catalogue tables |
| A quote-only product renders as `₹0` or `From —` | `presentPrice` returns a label-only result for `REQUEST_QUOTE`/`PRICE_ON_REQUEST` and the database constraint makes the numeric column null; a unit test covers all four states plus a null currency |
| A concept Higgsfield asset becomes a product hero | `product_media_reject_concept` trigger; a unit test attempts the insert and asserts the exception |
| Filters become a client-side app and lose SEO and no-JS support | The filter rail is a `<form method="get">`; an e2e test with JavaScript disabled applies a filter, sorts and paginates successfully |
| Facet lists show options that match nothing | Facet counts come from the same query as the rows; zero-count facets are hidden; a test seeds two products in one material and asserts the other materials are absent from the rail |
| Infinite scroll gets introduced later for "polish" | Pagination is `rel` prev/next with canonical URLs and is asserted by the SEO test; changing it needs a documented decision |
| `Ready Stock` publishes as a verified availability claim | Seeded `OWNER_VERIFICATION_REQUIRED` in Phase 09; `products_verified_before_publish` blocks a product asserting it until verified |
| The readiness checklist becomes an opaque score | It is a list of named unmet items rendered verbatim (FEAT §22); a Playwright assertion reads the item names off the page |

**Verification**

1. `npm run db:reset && npm run db:migrate` — `0120`–`0122` apply cleanly; `npm run db:types` produces
   no diff after regeneration.
2. `psql -c "insert into products (slug,sku,title,price_state,price_minor,currency)
   values ('x','X','X','REQUEST_QUOTE',100,'INR');"` → rejected by `products_price_state_coherent`.
3. `psql` attempt to insert a `product_media` row referencing any manifest asset → rejected by
   `product_media_reject_concept`.
4. `npx playwright test tests/e2e/collection-empty.spec.ts` against the empty catalogue — all seven
   category pages return 200, render their seeded heading and the SEED §27 empty state, and contain
   **zero** `[data-product-card]` elements.
5. Create three products in `/studio/catalog/products` as `merchandiser` with the four price states,
   publish them, then `npx playwright test tests/e2e/collection.spec.ts` — grid renders; each label
   matches the vocabulary table; the `REQUEST_QUOTE` card shows no digit.
6. With JavaScript disabled: apply `?material=…&price=REQUEST_QUOTE`, change sort, go to page 2 — all
   three work; the canonical URL matches the applied filters; an unparseable `?sort=price` is dropped
   from the canonical URL.
7. Assert `rel="next"` on page 1 and `rel="prev"` on page 2, and that `sort` and `page` are reflected
   in `<link rel="canonical">`.
8. Attempt to publish a product missing a hero image → refused, with "Hero image" named in the unmet
   list. As `viewer`, POST the publish action directly → 403 and a `DENIED` row in `audit_log`.
9. `select count(*) from products` on the production-shaped fixture → 0.
10. axe on `/collection/furniture` at 390 px and 1440 px — zero critical or serious violations; the
    filter rail is reachable and operable by keyboard.

**Exit criteria**

- [ ] `/collection` and all seven `/collection/[category]` pages render seeded copy and return 404 for an unknown or unpublished slug.
- [ ] Zero products are seeded; every category page renders its empty state and CI asserts `count(*) = 0`.
- [ ] All nine SEED §30/§31 label strings render from `global_content`; no label literal exists in `components/**`.
- [ ] A quote-only product can never display a number, enforced by constraint and by `presentPrice`.
- [ ] Filters, sort and pagination are URL-driven, server-rendered and fully functional with JavaScript disabled.
- [ ] Zero-count facets are hidden; facet counts match the rendered result set.
- [ ] Price sort is absent and the reason is documented in `BUSINESS_RULES.md`.
- [ ] Concept media cannot be attached to a product, proven by the trigger test.
- [ ] `/studio/catalog/{products,categories,collections,materials}` support create, edit and publish with the FEAT §22 readiness checklist and FEAT §21 validation, all audited.
- [ ] No cart, checkout, payment, stock-decrement or customer-account affordance exists anywhere on these routes.
- [ ] Phase-specific D9 evidence: docs updated = `DATA_MODEL.md`, `BUSINESS_RULES.md`, `STUDIO_GUIDE.md`, `CONTENT_GUIDE.md`; tests run = `catalog-query`, `price-presenter`, `catalog-validation`, `collection.spec.ts`, `collection-empty.spec.ts`, `catalog-studio.spec.ts`; next phase = 15.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 15 — Product Detail Experience

**Goal** — the product page becomes the place a visitor understands an object rather than a listing.
A gallery that rewards looking closely, a material story drawn from the materials the owner actually
attached, a specification block that contains only facts the owner typed and disappears entirely when
there are none, a customization entry point, editor-curated related content, and a conversion rail
that ends in an inquiry. It is built to look right for a product with three fields filled and for one
with everything filled, because early real products will be the former.

**Depends on** — Phases 03 (`products`, `product_media`, `product_materials`, `product_relations`), 06
(media), 10 (shell, WhatsApp plumbing), 14 (catalogue, price presenter, Studio product editor).

**Scope**

- `/product/[slug]` — `generateStaticParams` over published products, `generateMetadata` from
  `products.seo_title` / `seo_description` with the SEED §41 fallbacks. An unpublished or unknown slug
  returns 404. Draft products are visible only in Phase 08 draft mode, to staff.
- Gallery. `components/patterns/ProductGallery/` — server-rendered stills with a client lightbox.
  Sources are `product_media` ordered by `role` then `sort_order`, roles `hero · gallery · detail ·
  lifestyle · video · model` (Phase 03). Keyboard: arrows move, `Escape` closes and restores focus,
  `Home`/`End` jump, thumbnails are a roving-tabindex list. Zoom is a scale transform with a
  reduced-motion branch that swaps instantly instead of animating. The 3D slot renders only when
  `model_media_id` is set and Phase 21 has landed; until then it renders nothing, not a teaser.
- Material story. For each row in `product_materials`, render the material's name, `family` and
  `description` (Phase 03, `EDITORIAL_COPY`) with the material's own imagery. This is the one place a
  concept asset legitimately appears on a product page — it illustrates the **material**, is captioned
  as such, and is visually separated from the product gallery by a labelled band. A product with no
  attached materials renders no material band at all.
- Specification block — the strictest surface on the site. Rules, in order:
  1. Rows come only from owner-entered data: `product_specs` rows and the non-null keys of
     `products.dimensions`.
  2. A null or absent value produces **no row**. There is no `—`, no `N/A`, no "Contact us for
     details" placeholder, because each of those implies a value exists.
  3. Nothing is computed, converted, inferred, rounded or defaulted. A millimetre value entered by the
     owner is displayed in millimetres; unit conversion is not performed.
  4. Zero rows → the whole block is absent from the DOM, not rendered empty.
  5. Every row carries `fact_classification = 'PRODUCT_FACT'`; a row flagged
     `OWNER_VERIFICATION_REQUIRED` cannot be published with the product.
- Customization entry point. When `is_customizable`, render the seeded `Customize This Piece` action
  linking to `/custom-commissions?product=<slug>`. Phase 19 builds the configurator and reads that
  parameter; Phase 15 guarantees the parameter contract and nothing more.
- Related content (FEAT §11). Rendered strictly from editor-created `product_relations` edges —
  related products, collection, portfolio project, journal article, material story. **No relation is
  invented.** One permitted automatic behaviour, and it is labelled honestly: when a product has zero
  manual edges, render up to six other published products in the same category under the heading
  "More in {Category}", never "Related" or "You may also like".
- Conversion rail. `Ask About This Piece`, `Request a Quote` and, where applicable, `Customize This
  Piece` — all labels from `global_content` group `ACTION_LABEL`. Targets are
  `/contact?product=<slug>&type=product` and `/custom-commissions?product=<slug>`. **No WhatsApp link
  appears on this route in this phase**: persistence does not exist until Phase 20, and D1 requires the
  inquiry to be saved first. `Place Order` stays disabled (Phase 09 seeded it so).
- JSON-LD. `Product` with `name`, `description`, `image`, `brand`, `category`, and `sku` only where the
  owner set one. `offers` is emitted **only** when `price_state = 'FIXED'`; for every other state the
  key is omitted entirely rather than emitted with a zero, a null or a guessed `priceValidUntil`. No
  `aggregateRating`, no `review`.
- Studio: fills the Media, Materials, Specifications and Related tabs of the Phase 14 product form.

**Out of scope**

- The bespoke configurator itself (Phase 19), inquiry persistence and the WhatsApp handoff (Phase 20),
  the 3D viewer (Phase 21), the relationship-suggestion engine (Phase 23), reviews and ratings
  (permanently, D10), stock levels, delivery estimates and lead times (none exist).
- Any inference: no "typically", no "approximately", no derived weight, no computed seating capacity.
- Cross-sell driven by anything other than an editor's edge or the labelled same-category fallback.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Route | `app/(site)/product/[slug]/page.tsx` | Static params, metadata, 404 on unpublished |
| Gallery | `components/patterns/ProductGallery/{index.tsx,Lightbox.tsx,Thumbnails.tsx}` | Server stills, client lightbox |
| Material band | `components/patterns/ProductMaterialStory.tsx` | Absent when no materials attached |
| Specification block | `components/patterns/ProductSpecifications.tsx` | Owner-entered rows only; absent when empty |
| Conversion rail | `components/patterns/ProductInquiryRail.tsx` | Action labels from CMS; no WhatsApp link this phase |
| Related content | `components/patterns/RelatedContent.tsx` | Manual edges; labelled same-category fallback |
| Spec repository | `lib/supabase/repositories/product-specs.ts` | Read/write `product_specs` |
| Dimensions schema | `lib/catalog/dimensions.ts` | Zod: every key optional; unknown keys rejected |
| JSON-LD | `lib/seo/product-jsonld.ts` | `offers` only for `FIXED` |
| Studio tabs | `app/(studio)/studio/catalog/products/[id]/{media,materials,specifications,related}/**` | Fills the Phase 14 form |
| Migration | `supabase/migrations/0130_phase15_product_specs.sql` | `product_specs`, relation index |
| Tests | `tests/unit/{dimensions-schema,product-jsonld,spec-rendering}.test.ts`, `tests/e2e/{product-detail,product-gallery-a11y,product-minimal}.spec.ts` | Sparse product, keyboard gallery, JSON-LD |
| Docs | `docs/architecture/DATA_MODEL.md`, `docs/studio/STUDIO_GUIDE.md`, `docs/project/BUSINESS_RULES.md` | Spec table; spec-entry rules; the no-inference rule |

**Database**

`0130_phase15_product_specs.sql`:

| Table | Key columns | Notes |
|---|---|---|
| `product_specs` | `id uuid pk`, `product_id uuid not null references products on delete cascade`, `sort_order int not null default 0`, `label text not null`, `value text not null`, `unit text`, `group_label text`, plus the D5 common set (`status`, `owner_verification`, `fact_classification default 'PRODUCT_FACT'`, `created_at`, `updated_at`, `updated_by`) | Every row is owner-entered. Zero rows are seeded, ever. `unique (product_id, label)` prevents a duplicated field |

Also: `create index product_relations_source_idx on product_relations (source_product_id,
relation_type, sort_order);` and a check that `label` and `value` are non-blank after trim, so an
empty row cannot be saved and then render as a blank line.

`products.dimensions jsonb` gains a validating constraint mirroring `lib/catalog/dimensions.ts`: an
object whose keys are a subset of `{length_mm, width_mm, height_mm, depth_mm, diameter_mm, weight_g,
seats}` with positive numeric values. Anything else is rejected at the database, so a malformed blob
cannot reach the renderer.

RLS follows the Phase 04 four-policy pattern: anonymous `select` only where the parent product is
`PUBLISHED` and the spec row is `PUBLISHED`; writes require `catalog.write`.

**Studio surface** — **fills** four tabs on `/studio/catalog/products/[id]`: *Media* (attach, order and
role assignment, with the Phase 14 concept-media trigger enforcing the rule), *Materials* (attach
materials with an optional note), *Specifications* (add, reorder, rename and delete `product_specs`
rows, with an explicit "leave blank to omit the row" helper string), and *Related* (create and order
`product_relations` edges by hand). The readiness checklist from Phase 14 gains a Specifications item
that is satisfied by "at least one spec row **or** a deliberate 'no published specifications' choice",
so an owner is never pushed into inventing a value to publish.

**Public surface** — `/product/[slug]`.

**Media** — **None from the manifest.** A product's imagery is real Rivya media under D6 asset priority
1, and the Phase 14 trigger refuses any `is_concept = true` asset on `product_media`. The only concept
assets on this route arrive through the material band, attached to `materials` rows and captioned as
material studies — principally `material-macro` (39 assets), plus `process-timber` (7) for timber and
`process-finish` (8) for finish. Because zero products exist at the end of this phase, the route
renders for no one until the owner enters a product; that is the intended state.

**Risks**

| Risk | Mitigation |
|---|---|
| The specification block invents a value to avoid an ugly gap | Rows come only from non-null owner data; there is no placeholder branch in the component at all. `tests/unit/spec-rendering.test.ts` renders a product with one spec, with none, and with a null dimension key, asserting zero `—`, `N/A` or "contact us" strings |
| A concept image becomes the product hero | Database trigger from Phase 14, plus a Studio picker that filters `is_concept = true` out of the product media picker |
| The material band reads as a claim about this product's materials | The band is labelled as a material study, sits below the specification block, and its captions come from the `materials` row, not the product |
| Related content invents affinity | Only editor edges render as "Related"; the automatic branch is a different, honestly-labelled heading and is capped at six same-category published products |
| JSON-LD emits a price for a quote-only product and misleads Search | `offers` is emitted only for `FIXED`; `tests/unit/product-jsonld.test.ts` asserts the key is absent for the other three states, and that no `aggregateRating` or `review` key is ever emitted |
| The PDP looks broken for a sparse early product | `tests/e2e/product-minimal.spec.ts` publishes a product with title, category, price state, one image and nothing else, and asserts the page reads as complete — no empty headings, no orphan rails, no zero-height bands |
| A `wa.me` link is added to "save a step" before Phase 20 | Phase 10's `check-whatsapp-usage.mjs` fails the build; `buildHandoffUrl` cannot be called without a persisted `inquiryId` |
| Unit conversion creeps in as a convenience | `dimensions.ts` stores and renders one unit per key; the no-inference rule is written into `BUSINESS_RULES.md` and the Studio helper text |

**Verification**

1. `npm run db:migrate` — `0130` applies; `npm run db:types` regenerates with no diff.
2. `psql` insert of `product_specs` with a blank `value` → rejected; duplicate `(product_id, label)` →
   rejected; `products.dimensions = '{"length_inches": 90}'` → rejected by the key constraint.
3. Create and publish one product with title, category, `REQUEST_QUOTE`, one hero image and nothing
   else. `npx playwright test tests/e2e/product-minimal.spec.ts` — no specification block, no material
   band, no related section, no empty heading, no zero-height container; one `h1`.
4. Add two `product_specs` rows and two materials; reload — the specification block renders exactly two
   rows in `sort_order`, and the material band renders two studies.
5. Assert the rendered page contains no `—`, `N/A`, `TBD`, `Coming soon` or "contact us for
   dimensions" string.
6. `npx playwright test tests/e2e/product-gallery-a11y.spec.ts` — thumbnails are a roving-tabindex
   list; `Enter` opens the lightbox; arrows move; `Escape` closes and returns focus to the thumbnail;
   axe reports zero critical or serious violations with the lightbox open.
7. `curl -s /product/<slug> | jq` the JSON-LD block — `@type: Product`, no `offers` for a
   `REQUEST_QUOTE` product. Switch the product to `FIXED` with a price and confirm `offers` appears
   with the correct currency.
8. `grep -rn "wa.me" app/\(site\)/product` → no matches.
9. With zero manual relations, the related section heading reads "More in {Category}"; add one manual
   edge and confirm the heading and the set change to the curated one.
10. Request an unpublished product's slug anonymously → 404; request it in staff draft mode → 200.

**Exit criteria**

- [ ] `/product/[slug]` renders for published products only, 404s otherwise, and is reachable from `/collection/[category]`.
- [ ] The gallery is keyboard-complete with a focus-restoring lightbox and a reduced-motion branch; zero critical/serious axe violations.
- [ ] The specification block renders only owner-entered facts, omits absent values with no placeholder, performs no conversion or inference, and is absent entirely when empty.
- [ ] `product_specs` exists with the D5 common columns; zero rows are ever seeded.
- [ ] `products.dimensions` is constrained to the declared key set and positive values at the database.
- [ ] The material band is present only when materials are attached, is labelled as material study, and is the only place concept media appears on the route.
- [ ] Related content renders manual edges as "Related" and the same-category fallback under its own honest heading, capped at six.
- [ ] The conversion rail renders CMS action labels and contains no WhatsApp link, no cart and no payment affordance; `Place Order` remains disabled.
- [ ] JSON-LD omits `offers` for every non-`FIXED` price state and never emits ratings or reviews.
- [ ] A minimally-populated product renders as a complete page, proven by `product-minimal.spec.ts`.
- [ ] Studio Media, Materials, Specifications and Related tabs are functional and audited, and the readiness checklist accepts "no published specifications" as a deliberate choice.
- [ ] Phase-specific D9 evidence: docs updated = `DATA_MODEL.md`, `STUDIO_GUIDE.md`, `BUSINESS_RULES.md`, `COMPONENT_REGISTRY.md`; tests run = `dimensions-schema`, `product-jsonld`, `spec-rendering`, `product-detail.spec.ts`, `product-gallery-a11y.spec.ts`, `product-minimal.spec.ts`; next phase = 16 (Collections / Exhibitions).
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## Cross-phase notes

**What must be true before Phase 16 begins.** Collections / Exhibitions assumes a public shell that
composes CMS blocks (10), a finished block vocabulary it can reuse rather than re-invent (11–13), a
catalogue it can filter by collection (14) and a product page to link into (15). Starting Phase 16
before Phase 14 produces a second, divergent product-card implementation — exactly what FEAT §6 forbids.

**The launch-day published set.** At the end of Phase 15 the site is complete and mostly withheld. The
following are seeded, editable and invisible until the owner verifies them, and every phase above is
snapshot-tested in that state:

| Surface | Withheld until verified |
|---|---|
| `/` | 3D + Resin card, Architectural Pieces card, Fabricated Form card, the six commission capability chips, the whole 3D + Resin section, five process statements, the Personalised Pieces card |
| `/about` | Scale section, Bespoke section |
| `/process` | All seven chapters |
| `/large-format` | Conference & Commercial Tables, Sculptural Seating, Architectural & Statement Pieces, the customization statement |
| `/collection/*` | Category descriptions that imply capability — preservation, 3d-resin |
| `/product/*` | Every product, because the owner has entered none |

**Manifest reconciliation.** Phases 10–15 open ten of the manifest's eleven page buckets, 226 of the
250 assets: `about` 39, `process` 79, `large-format` 18, `collection/wall-statement-art` 20,
`collection/preservation` 19, `collection/decor` 18, `collection/3d-resin` 13, `collection/gifts` 10,
`home` 5 and `portfolio` 5 (the `gallery-scene` family, used as atmosphere behind the homepage
portfolio strip and never captioned as a project). The one untouched bucket is `journal` — `editorial`
19 plus `workshop-session` 5, 24 assets — which belongs to Phase 18. "Opened" is not "exhausted": most
buckets supply more assets than the bound slots need, and the surplus stays available to the owner in
the Studio media picker. Nothing in this block generates an asset, and the Phase 07 regeneration guard
remains armed throughout (D6, FEAT §33).

---

## Open questions for the canonical decisions

These are raised, not acted on. Nothing above diverges from `CANONICAL-DECISIONS.md`.

1. **Permission-string spelling.** `PHASE-00-04.md` defines `lib/auth/permissions.ts` with
   `<domain>.<action>` (`catalog.write`); `PHASE-05-09.md` writes `<resource>:<action>`
   (`content:publish`). This document uses the dot form. One of the two must be normalised before
   Phase 10 begins, and `PHASE-05-09.md` additionally introduces `content:review`, which is not in the
   Phase 04 matrix. Suggested amendment: state the spelling and the full permission list in D5.
2. **`price_state` value set.** D5 fixes the enum names but not their values. Phase 03 created
   `price_state` implying `STARTING_FROM · REQUEST_QUOTE · PRICE_ON_REQUEST`; Phase 14 adds `FIXED`
   plus two new enums, `availability_state` and `edition_state`, because SEED §30 mixes price states
   with availability and edition badges in one list. Suggested amendment: record the three enums and
   their values in D5 so a later phase does not re-split them differently.
3. **The six large-format groupings.** SEED §12 names six categories that are not the seven D3 taxonomy
   categories. Phase 13 treats them as editorial `category-list` entries with no routes. Confirm this
   is intended, or add them to the D3 seeded-category list — the two readings produce very different
   sitemaps.
4. **`/search` before Phase 23.** D3 lists `/search` as a public route and Phase 09 seeds its copy, but
   the engine is Phase 23. Phase 10 renders the page with a working input that always returns the
   seeded no-results state. Confirm this is preferable to omitting the route until Phase 23.
5. **Price sort.** Phase 14 deliberately offers no price sort, because three of the four price states
   carry no number. Confirm, so a later phase does not add it as a "missing feature".
6. **Concept media on products.** D6 orders asset priority but does not forbid a concept asset on a
   product. Phase 14 forbids it by trigger, on the strength of D10 and SEED §32. Suggested amendment:
   state the prohibition explicitly in D6 so the trigger is not later read as over-reach.
