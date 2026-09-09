# SESSION-STATE

> Updated at the end of every phase, per requirement FEAT §40. Read this second, after
> `CLAUDE.md`, before doing anything. **Verify the claims below against the repository** —
> never assume a phase completed because this file says so.

---

## Current Phase

**Phase 15 — Product Detail Experience. CODE COMPLETE; THE ROUTE RENDERS FOR NOBODY, WHICH IS THE
FINISHED STATE.** `/product/[slug]` serves published products only and 404s otherwise, and
`products` holds zero rows — so today it serves nothing. That is the intended end of this phase: a
product exists when an owner types one in (SEED §32), and the Studio is the only thing that can.

### Phase 15: what is built

**Migrations `0130`–`0132`, LOCAL AND HOSTED.** `product_specs` with its non-blank checks and
`unique (product_id, label)`; `is_valid_dimensions()` and the `products_dimensions_shape`
constraint; the generated RLS file; and `products.specifications_omitted`. Hosted was verified
against local by fingerprint — columns, constraints, policies, indexes, triggers and the function
definition all match, and the function refuses inches, zero, negatives, string values and arrays
identically on both. The ledger rows carry the runner's own SHA-256, so `db:migrate` will not
re-apply them.

**The public route.** `/product/[slug]` with `generateStaticParams` over published products,
`generateMetadata` with the SEED §41 fallbacks, `Product` JSON-LD whose `offers` key is emitted only
for `FIXED`, and five patterns: `ProductGallery` (RC-238), `ProductSpecifications` (RC-239),
`ProductMaterialStory` (RC-240), `ProductInquiryRail` (RC-241), `RelatedContent` (RC-242). Every
band is absent when it has nothing to show, rather than empty.

**The Studio.** Four tabs under `/studio/catalog/products/[productId]` — Media, Materials,
Specifications, Related — each a route rather than a pane. The eleventh readiness item,
Specifications, is required and satisfiable either by a spec row or by the recorded decision that a
piece publishes none.

**Tests.** 1245 unit and RLS tests pass with none skipped, including `spec-rendering` (twelve cases,
all about absence) and `tests/unit/rls/phase15.test.ts` (the `0130` guards, the dimensions
constraint, and the RLS asymmetry the Studio's writes are shaped around). The three e2e specs
execute and skip: this sandbox cannot reach the Supabase host, so there is no published product to
find. They are written to be run where there is.

### Superseded — Phase 14's state

**Phase 14 — Product Catalog. CODE COMPLETE; THE CATALOGUE IS EMPTY, WHICH IS THE FINISHED STATE.**
`/collection` and all seven `/collection/[category]` pages are browsable, server-rendered from the
URL, filterable and pageable with JavaScript disabled — and every one of them renders SEED §27's
"this collection is being prepared", because `products` holds zero rows and no seed will ever add
one. The Studio catalogue editor is the only way that changes.

Phases 12 and 13 merged as PR #16; Phase 11 as PR #15.

### Phase 14: what is built

**Migrations `0120`–`0122`, LOCAL ONLY.** `FIXED` on `price_state`, the `availability_state` and
`edition_state` enums, six columns on `products`, the two listing indexes dropped and recreated in
their full form (`0008` created them short with an instruction to do exactly this), the replaced
price-coherence constraint, the edition-size constraint, and `reject_concept_product_media`. Hosted
is still at `0080` — applying these is owner-side, like every migration since `0050`.

**`lib/catalog/`** — `query.ts` (the whole listing parsed out of the URL, with a canonical builder
that omits what it dropped), `price.ts` (the only place a price becomes words), `validation.ts`
(FEAT §21 and §22 as pure functions, shared by the form and the action), `labels.ts`, `rail.ts`,
`listing.tsx`. Two repositories: `catalog-listing.ts` for the public read, `catalog-admin.ts` for
the Studio write.

**Four patterns, all server components, zero client JavaScript** — RC-217 `ProductCard`, RC-223
`FilterRail` (planned as `FilterBar` (public)), RC-234 `Pagination`, RC-237 `SortSelect`.

**The Studio catalogue editor.** `/studio/catalog/{products,categories,collections,materials}`, with
the ten-item FEAT §22 checklist computed from the saved row, publication refused with the unmet items
named, and a "Not ready" column on the list running the same computation per row.

**`content/seed/catalog-ui.ts`** — 22 rows for the listing's own controls, because a
server-rendered filter rail needs words for its groups and D2 leaves no room for typing them
into JSX.

### Phase 14: what is NOT built, and why

- **A link on a product card.** `/product/[slug]` is Phase 15. An anchor now would put a 404 behind
  every card in the grid, which is the dead door `resolveInternalTarget` exists to refuse.
- **The gallery editor with media roles**, the relationship editor, the customization form builder
  and bulk import — Phases 15, 23, 19 and 24. Each has a stub route with a real permission check.
- **The Specifications readiness item.** Eleven items were planned; ten shipped. `product_specs` is
  Phase 15's table, and an item that always reads "Missing" because the table it counts does not
  exist would train an owner to ignore the checklist.
- **The mobile filter drawer** RC-223 planned. A drawer opened by a button is a Client Component,
  and the phase requires the rail to filter with JavaScript disabled. A `<details>` disclosure would
  satisfy both and is the obvious Phase 41 revision.
- **The authenticated Studio e2e half.** `test.fixme`, as in Phases 04 and 05 and for the same
  reason: no reachable auth server, so no real session. The layers beneath it are proved where they
  can be — the write policies against a real PostgreSQL, the readiness gate as pure functions.
- **Visual baselines**, for the fifth phase running. Still no media.

### Phase 14: verification, as actually run

| Step | Result |
|---|---|
| 1 · `db:reset` + `db:migrate` + `db:types` | ✓ 31 migrations apply to an empty database; the types diff is the six columns and two enums and nothing else |
| 2 · quote-only product carrying a price | ✓ refused by `products_price_state_coherent`, including a zero |
| 3 · concept asset on a `product_media` row | ✓ refused by the trigger, naming the asset, on INSERT and on UPDATE |
| 4 · `collection-empty.spec.ts` against the empty catalogue | ✓ all seven category pages 200, own heading, SEED §27, **zero** `[data-product-card]` |
| 5 · three products with the four price states | ✓ each label from `COMMERCE_LABEL`; the `REQUEST_QUOTE` card contains not one digit; the limited edition states its size |
| 6 · filters, sort and page 2 with JavaScript disabled | ✓ all three; `?sort=price` and `?page=0` dropped from the canonical URL |
| 7 · `rel="next"` on page 1, `rel="prev"` on page 2, canonical per page | ✓ — and `?page=99` answers 404 rather than the 500 PostgREST's PGRST103 would otherwise cause |
| 8 · publication refused with a named unmet item | ✓ as pure functions in `catalog-studio.spec.ts`; the browser half is `test.fixme` |
| 9 · `select count(*) from products` | ✓ 0, after the fixture was removed |
| 10 · axe on `/collection/furniture` | ✓ zero critical or serious violations; no horizontal overflow |

**1000 unit assertions** (86 files), including 17 database guards in `tests/unit/rls/phase14.test.ts`.
`npm run check` clean; a production build compiles every new route.

### Phase 14: the D9 ten, recorded

| # | Point | Evidence |
|---|---|---|
| 1 | Scope implemented | `/collection`, `/collection/[category]`, four patterns, the four Studio catalogue surfaces, migrations `0120`–`0122`, the seed addition. Out of scope by the phase's own list and left alone: any seeded product, `/collections/[slug]`, bulk import, the relationship editor, the customization builder, search, and every cart affordance |
| 2 | Relevant tests run | 1152 unit assertions across 90 files (17 of them database guards), `collection.spec.ts` + `collection-empty.spec.ts` + `catalog-studio.spec.ts` at 1440, the full non-snapshot e2e suite at 1440 (98 passed), the design-system snapshots at 1440 |
| 3 | No known scope-breaking error | None. The known GAPS are listed above under *what is NOT built* and are all phase boundaries or the auth-server limitation Phases 04 and 05 already carry |
| 4 | Documentation updated | `DATA_MODEL.md` (the constraint as strengthened, the index replacement), `BUSINESS_RULES.md` (BR-C5), `STUDIO_GUIDE.md` (§7.1.1), `CONTENT_GUIDE.md` (§8.5), `COMPONENT_REGISTRY.md` (four rows to BUILT, three planned behaviours corrected), `CANONICAL-DECISIONS.md` (A13), `INITIAL_CONTENT_INVENTORY.md` regenerated |
| 5 | `CHANGELOG.md` | Phase 14 entry added |
| 6 | `PROJECT_STATE.md` | Phase-status row, the hosted-migration gap, and the "what does not exist" section |
| 7 | `docs/SESSION-STATE.md` | This block |
| 8 | Remaining issues documented | Hosted is at `0080` and needs `0120`–`0122`; the Higgsfield migration is still unrun; the six exposed secrets are still unrotated; GitHub Actions still provisions no runner |
| 9 | Next phase identified | Phase 15 — Product Detail Experience, under *Next Exact Action* |
| 10 | Repository recoverable | `npm run db:reset` replays all 31 migrations onto an empty database; `npm run db:types` produces no diff after it; `git status` is clean and the generated inventory is committed |

**The RLS fixture had to change.** `loadFixture` attached two `is_concept = true` assets to
`product_media`, which `reject_concept_product_media` now refuses — so the whole RLS suite failed to
load. Both are non-concept now, and a third asset carries the flag, attached to nothing, for the test
that proves the refusal. Note also that `tests/unit/rls/phase08.test.ts` DELETES every row from
`pages` and `page_sections`: after running the RLS suite locally, re-run `npm run seed:content` before
looking at the site.

---

**Phase 13 — Large Format Experience. CODE COMPLETE; NOT MEASURED.** `/large-format` renders, and
the phase's real contribution is smaller and wider than the page: a link is now rendered only when
its destination is live.

### Phase 13: what is built

**Three renderers** — `category-intro`, `category-list`, `customization-note` — so twenty of the
twenty-eight blocks have one and `/large-format` needs no further block.

**`lib/site/resolve-target.ts`.** An editor's `href` is a database value: `typedRoutes` cannot see
it, and a page whose sections are all DRAFT answers 404 while looking exactly like a real path.
`getSiteChrome` now carries `livePaths` — pages with at least one section the anonymous client can
see — and `SectionActions` and `CategoryListSection` both drop a link whose destination is not in
it, rendering the content without the anchor rather than hiding the content. Proved in both
directions: with `/custom-commissions` unpublished the page has no anchors in its body at all, and
publishing one section on it brings both CTAs back.

**Entry-level marks on three of the six groupings**, where the seed flagged the whole list before.

**A text-only card as a designed layout**, because one grouping has no photograph in the library —
recorded as DQ-14 in `HIGGSFIELD_ASSET_STATUS.md`, not filled from a neighbouring family.

### Phase 13: what is NOT built, and why

- **`components/patterns/WideHero.tsx`**, which the phase document lists. It would be a second
  implementation of what `HeroSection` and `ResponsiveMedia` already do: 21:9 desktop, 9:16 mobile,
  two assets rather than a CSS crop, motion behind `HeroMotion`'s five gates. `/large-format`'s hero
  uses the same `hero` block as every other page and needs nothing new. A wrapper would be a second
  place for the art-direction rules to drift.
- **The visual baselines**, for the fourth phase running: no media, so a snapshot records a page of
  fallback wells.
- **Any media binding.** The 18-asset `large-format` bucket is named in the phase document and
  cannot be bound until the Higgsfield migration runs.

### Phase 13: verification, as actually run

| Step | Result |
|---|---|
| 1 · publish `/large-format` | ✓ 4 of 5 sections; the customization statement refused by the verification constraint |
| 2 · entry-level query | ✓ exactly three withheld keys — conference, seating, architectural — and exactly the other three render |
| 3 · anchors inside `<main>` | ✓ none at all, because `/custom-commissions` has nothing published; publishing one section on it brought both CTAs back, then it was returned to DRAFT |
| 4 · `large-format.spec.ts` at 1440 and 390 | ✓ 12 assertions including the no-dead-anchor scan and zero serious axe violations |
| 5 · `resolve-target.test.ts` | ✓ 9 cases: live, not-live, empty, `#`, trailing slash, query, fragment, external, protocol-relative, `/search` |
| 6 · full unit suite | ✓ 942 tests |

**The local cluster had to be restarted mid-phase** — the container had lost it. It lives at
`/var/lib/postgresql/rivya/data` and its config says port 5432, so it must be started with an
explicit override: `pg_ctl -D /var/lib/postgresql/rivya/data -o '-p 5433'`. Starting the packaged
cluster instead takes 5432 and blocks it.

---

**Phase 12 — About + Process. CODE COMPLETE; NOT MEASURED.** `/about` and `/process` render from
the CMS, and both are built to read as complete while the claims inside them wait for the owner.
What is not done is the same pair Phase 11 left: the visual baselines and the Lighthouse numbers,
both waiting on media that does not exist yet.

Phase 11 merged as PR #15; Phase 10 as PR #14.

### Phase 12: what is built

**`scale-statement`** — seventeen of the twenty-eight blocks now have renderers, and `/about` needs
no further block. It is the site's one editorial 21:9 crop, with a separate 4:5 mobile asset rather
than a CSS crop of the wide one.

**The `/process` chapter layout.** A chapter is ONE section carrying ONE stage, which is what lets
the owner verify one stage without verifying the rest. Its number is its position among the
chapters that rendered — `SectionList` counts per block type and passes an `ordinal`, because a
renderer is a pure function of its own props and cannot see the page. Seeded as "01 — BRIEF", three
verified chapters would have read 01, 04, 06; they now read 01, 02, 03, and the bands alternate on
the same index.

**`ChapterMedia` (RC-216)** — one clip plays at a time across the page, gated by
`IntersectionObserver` on top of the five gates `HeroMotion` applies. Loaded through `next/dynamic`,
because `ProcessStepsSection` is imported by every page with a process band.

**A Studio verification banner** on every flagged section, quoting the section's own claim and, where
the specification has wording, its wording: SEED §16's "Avoid specific production claims until
verified" is seeded verbatim against step 04. The other six notes are this project's and are
labelled as such in each row's `description`.

### Phase 12: what is NOT built, and why

- **Visual baselines** (`about.visual.spec.ts`, `process.visual.spec.ts`). Same reason as Phase 11:
  `media_assets` is empty, so every image is the SEED §47 fallback well and a baseline would record
  a composition that is not the composition.
- **Any media binding**, so no chapter has a clip and `ChapterMedia` mounts nothing today. The
  Phase 12 media table names every family; binding is an edit to `content/seed/media-bindings.ts`
  once the Higgsfield migration has run.
- **The `/custom-commissions` destination** of About's closing CTA. Phase 19 builds that page; the
  route exists and answers 404 by design, which the About spec asserts as an acceptable outcome
  rather than treating as a broken link.

### Phase 12: verification, as actually run

| Step | Result |
|---|---|
| 1 · `npm run check` | ✓ 28 gates |
| 2 · publish `/about` and `/process` | ✓ 9 sections refused by the verification constraint — About's scale and bespoke, and all seven chapters. `/about` renders 3 of 5, `/process` its hero |
| 3 · verify three chapters out of order (authored positions 3, 6, 8) | ✓ they render 01, 02, 03 with one inverted band, then were returned to the launch state |
| 4 · `about.spec.ts` + `process.spec.ts` at 1440 and 390 | ✓ 22 assertions: seeded order, one `h1`, flagged sections absent, no forbidden copy, zero serious axe violations |
| 5 · `process-numbering.test.tsx` at 1, 3, 5 and 7 chapters | ✓ contiguous numbering and correct alternation, through the real `SectionList` |
| 6 · island budget after adding `ChapterMedia` | ✗ **failed** — the homepage would have shipped it. Fixed with `next/dynamic`; the gate now separates initial-bundle islands from lazy ones and was re-proved to fail on a sixth static island |
| 7 · re-seed and confirm | ✓ 7 records updated, 9 verification notes written, chapters reshaped to `chapter` with label-only eyebrows |

**933 unit tests**, 81 files.

---

**Phase 11 — Homepage + Material Experience. CODE COMPLETE; NOT MEASURED.** All thirteen SEED §10
sections render from the CMS in seeded order, the two motion islands are built, and the homepage's
client budget is measured and enforced. What is not done is the performance MEASUREMENT and the
visual baseline, and both wait on the same thing: `media_assets` is empty, so every image on the
page is the SEED §47 fallback well. A Lighthouse run against that would report an LCP for a page
with no images, and a snapshot would record a composition that is not the composition.

Phase 10 merged as PR #14; Phase 09 as PR #13; Phase 08 as PR #12. Phase 07 remains CODE COMPLETE
with its Higgsfield migration unrun.

### Phase 11: what is built

**Ten renderers, so sixteen of the twenty-eight blocks are built.** `manifesto`, `selected-works`,
`material-story`, `material-palette`, `commission-cta`, `three-d-resin`, `portfolio-strip`,
`secondary-objects`, `journal-strip`, `final-cta`. `components/sections/registry.ts` maps none of
them to `null` any more, and `tests/unit/cms-sections.test.tsx` asserts the two registries agree in
both directions.

**Entry-level owner verification** (`lib/cms/entry-visibility.ts`). The section-level column is the
right mechanism when the claim IS the section and the wrong one when a published band holds one
unverified item among five. Fifteen entries across five sections now carry the flag themselves;
each renders as nothing and is addressable in a test by `data-entry-key`. `BlockModule.entryArrays`
declares which payload arrays are editorial, because inference got it wrong in both directions —
"any object array" swept in `/contact`'s form fields, "has a `title`" missed the commission band's
six `label`-carrying capabilities.

**Three reference blocks with an honest empty state.** `lib/cms/selectors/` answers `OK`, `EMPTY`
or `NOT_YET_BUILT`; `components/patterns/EditorialFallback` renders a seeded `EMPTY_STATE.*`
sentence inside `data-empty-reason`. Never a skeleton, which says "loading" when nothing is
loading, and never a placeholder card, which is a product that does not exist.

**`HeroMotion` (RC-214) and `MaterialSequence` (RC-215).** The hero's still is now always the LCP
element and the clip is a layer over it that mounts after paint behind five gates, or does not
mount at all. The sequence observes scroll and never captures it; its stages are server-rendered
and passed in as children, and the dimming is `data-[active=false]`, which matches nothing until
the island runs.

**An island budget that counts modules, not chunks** (`scripts/site/check-island-budget.mjs`,
wired into `npm run check`). Five islands on `/`, named, with the fifth recorded as amendment A11.
It immediately found a real cost: `MediaSlot` — a Server Component nearly every renderer imports —
was importing `MediaVideo`, so every route with any section carried the video island. `BlockVideo`
moved into its own module (RC-235).

**Homepage JSON-LD.** One `application/ld+json` block, `WebSite` + `Organization`, a name and a URL
and nothing else. It renders nothing at all when either is missing.

### Phase 11: what is NOT built, and why

- **`tests/e2e/homepage.visual.spec.ts`.** Deferred, not forgotten. A baseline taken now records a
  page whose every image is a fallback well; it would be thrown away the day
  `npm run media:migrate:higgsfield` runs. What a snapshot would actually catch at eight widths —
  a band that overflows its viewport — is asserted directly in `tests/e2e/homepage.spec.ts`, and
  that assertion found amendment A12 on its first run.
- **The Lighthouse numbers.** `lighthouserc.json` and `.github/workflows/lighthouse.yml` exist; the
  workflow is **manual dispatch only** because of the owner's standing instruction about Actions
  minutes, and because a run against a media-less page would measure the wrong thing.
- **Any media binding.** `MEDIA_BINDINGS` is still empty and the hero's `motion-desktop` slot is
  unbound. An entry naming an asset that does not exist is a hard seed failure, so binding waits on
  the Higgsfield migration. The four `material-story` stages are seeded with `media_index: null`
  for the same reason.
- **The 21:9 hero motion gap.** The manifest holds no 21:9 video at all; the desktop clip is 16:9
  and plays inside the 21:9 still with `object-fit: cover`. Recorded in `content/media-slots.ts`
  (`home.hero.video`, resolution `GENERATE`) rather than filled by a new generation.

### Phase 11: verification, as actually run

Against a local PostgREST over the seeded local cluster, with the homepage's sections walked
DRAFT → REVIEW → APPROVED → PUBLISHED to reach the launch-day state.

| Step | Result |
|---|---|
| 1 · `npm run check`, including the new island gate | ✓ 28 gates |
| 2 · publish all thirteen homepage sections | ✓ 11 published, 2 refused by `page_sections_verified_before_publish` — positions 2 and 8, the two whose claim IS the section |
| 3 · `homepage.spec.ts` at all eight widths | ✓ 48 assertions: seeded order, one `h1`, no skipped level, zero fabricated cards, one JSON-LD block |
| 4 · the 15 withheld entry keys, scoped by block type | ✓ zero elements each, and all five parent sections still render |
| 5 · `homepage-motion.spec.ts`, both branches | ✓ four static stages and no `data-active` under reduced motion; a stage marked active with motion allowed; no `<video>` at any width, no clip being bound |
| 6 · horizontal overflow at eight widths | ✗ **failed at every width**, and that is amendment A12 — `w-full` meant 1920px product-wide. Fixed, re-run green |
| 7 · homepage client JS, gzipped, from a production `next start` | ✓ 171.7 kB against a 180 kB budget |
| 8 · island count | ✓ 5, named, gate proved to fail on a sixth |
| 9 · `curl /` piped to `grep -c ld+json` | ✓ 1, with no `offers`, `aggregateRating` or `award` |
| 10 · no-JavaScript HTML | ✓ 11 sections, 4 stages, 1 `h1`, 0 `<video>`, 0 `data-active` |

**924 unit tests**, 80 files, plus 96 e2e assertions on the two new specs across the eight QA
widths, and zero critical/serious axe violations on `/` at 390px and 1440px.

The whole e2e suite was run twice at 1440px and 390px after the A12 fix — 147 passed, 55 skipped
(the skips are the fixtures that need a reachable Supabase project). One run had a single failure,
`DropdownMenu opens on ArrowDown`, which passed alone, passed with its own spec at both widths, and
passed in the second full run: a flake under parallel load against `next dev`, recorded rather than
re-run until quiet. It is not related to A12 — that change moved widths, not focus.

The eight design-system visual baselines were regenerated. **The old ones recorded the bug**: at a
1440px viewport the gallery's baseline was 2264px wide.

### Phase 11 against D9's ten points

Eight hold outright: tests run, no known scope-breaking error, documentation updated
(`COMPONENT_REGISTRY.md`, `PERFORMANCE.md`, `TESTING.md`, `CONTENT_GUIDE.md`, `DESIGN_SYSTEM.md`,
`HIGGSFIELD_ASSET_STATUS.md` and two amendments), CHANGELOG updated, PROJECT_STATE updated,
SESSION-STATE updated, remaining issues documented, next phase identified, repository recoverable
(three commits, pushed, PR #15 open).

**Point 1 — scope implemented — is the one that does not, and it is media rather than code.** The
phase's media table binds each section to a Higgsfield family; `media_assets` is empty on both
databases because `npm run media:migrate:higgsfield` has never run, and a seeded entry naming an
asset that does not exist is a hard seed failure. So no binding was written, the four material
stages carry `media_index: null`, the hero's motion slots are declared and unbound, and two exit
criteria — the Lighthouse numbers and the eight-width visual baseline — wait on the same thing.
Everything that does not depend on an asset is done and verified. That is why the phase reads CODE
COMPLETE rather than COMPLETE.

---

**Phase 10 — Public Website Foundation. COMPLETE.** Rivya is a website a stranger can load: one
Server-Component shell, thirteen static routes, the metadata, sitemap and revalidation plumbing, and
the WhatsApp module. Every visitor-visible string in the chrome is a database row.

Phase 09 merged as PR #13; Phase 08 as PR #12. Phase 07 remains CODE COMPLETE with its Higgsfield
migration unrun.

### Phase 10: what is built

**The shell.** `app/(site)/layout.tsx` — skip link → announcement → header → `<main id="main">` →
footer. `lib/site/chrome.ts` fetches everything it needs once per request behind `React.cache`
(four parallel queries: `global_content`, `navigation_items`, `categories`, and the one
`contact-details` section), and the layout is its only caller.

**Three client islands, and no more.** `MegaMenu` and `MobileNav` hold open/closed state;
`SiteErrorCopy` is a context provider that renders `children` unchanged and exists only because
Next requires `error.tsx` to be a Client Component and a Client Component cannot query. The
announcement bar's dismissal is a `<form>` posting to a Server Action — no JavaScript, no island.

**A cookieless public read client.** `lib/supabase/public.ts`. The cookie-bound client would make
every route dynamic and would silently hold an expired token outside the `/studio` matcher that
`proxy.ts` refreshes. All twelve CMS routes build static as a result; `renderCmsPage` switches
clients only in draft mode.

**Thirteen routes**, one per D3 static path, twelve delegating to `renderCmsPage(path)`.
`tests/unit/site-routes.test.ts` asserts the file system and `lib/site/routes.ts` agree exactly —
proved by deleting `terms/page.tsx` and watching it fail.

**Metadata, robots and sitemap.** `lib/seo/metadata.ts` walks the SEED §41 chain — the path's entry,
the GLOBAL entry, then the `SEO_DEFAULT` strings — and emits `noindex` for a page with no live
sections whatever its row says. `sitemap.xml` inner-joins the sections so it lists only URLs that
actually load.

**`app/api/revalidate`**, POST only, `REVALIDATE_SECRET`-guarded with a constant-time compare, 503
when unconfigured.

**`lib/whatsapp/`** with two builders. `buildHandoffUrl` requires a non-optional `inquiryId` and now
also refuses a blank one at runtime; `buildDirectContactUrl` takes a closed union of three chrome
surfaces. Token allowlists in both directions, graceful shortening that never touches the inquiry
id, and a 1800-character cap.

**Two Studio additions.** An "On site" column on `/studio/content/pages` — a direct link when the
page is published, the draft-mode preview route when it is not — and `/studio/content/navigation`,
previously a stub, now listing every menu item with whether its `href` resolves. That second one is
the compensating control for `NavLink`'s `as Route` cast: a database href cannot be checked at build
time, so it is checked where it is typed.

**Migration `0080`** — a `UI_LABEL` group for `global_content`. Applied to hosted, which is current
at 28 migrations.

**Seed module `site-chrome.ts`**, 16 rows: the skip link, the menu controls, the dismiss button, the
search control, the landmark names, the two §45/§46 error CTAs, and the greeting a chat opens with
when there is no enquiry to reference.

### Phase 10: what is NOT built, and why

- **A page a visitor can read.** Every route renders and every one answers 404: Phase 09 seeds all
  53 sections `DRAFT`, and `renderCmsPage` refuses a published route with nothing on it (SEED §55).
  This is the designed outcome, not a gap. Publishing is an editorial act in Studio, and 25 of those
  sections cannot be published at all until the owner verifies what they claim.
- **`aria-current="page"`.** It needs the request pathname, which a Server Component cannot read
  without `headers()` — that would make every public route dynamic to mark one link. Deferred to
  Phase 41 with the trade recorded in `ACCESSIBILITY.md` §2.3a. It is a 2.4.8 AAA concern, not an AA
  failure.
- **A "skip to navigation" link.** Deliberately not built: the header is the first thing in the DOM,
  so a link at the top that jumps two elements forward adds a control to the tab order for nobody.
- **`MegaMenuPanel.tsx`.** The panel's contents are server-rendered by `SiteHeader` and passed as
  `children`, which is what lets the category cards use `MediaImage`. A second client file would
  have passed that markup straight through.
- **Category thumbnails.** `MEDIA_BINDINGS` is still empty and no category has a `hero_media_id`,
  so every mega-menu card renders text-only. That is Phase 09's recorded gap plus the unrun
  Higgsfield migration, not a Phase 10 omission.

### The defects the verification steps found

1. **`revalidatePath` was invalidating nothing, and returning 200.** Two independent causes, both
   invisible: without `export const revalidate` on the site layout every route builds as a pure
   static file with no cache entry behind it; and `revalidatePath` must be called with **no** `type`
   for a literal path — passing `'page'` alongside `/about` fails to match. Found by publishing a
   section and watching the page keep 404ing. `x-nextjs-cache` flipping `HIT` → `MISS` is what
   proved the fix.
2. **`stripCommentsAndStrings(source, { strings: false })` did not scan strings**, so the `//` in
   every URL started a "line comment" and blanked the rest of the line. The new WhatsApp gate was
   written against that view and passed a planted `https://wa.me/…` while reporting success. Phase
   06's `check-video-props.mjs` reads the same view and had the same hole. Two regression tests.
3. **`buildHandoffUrl` did not refuse a missing inquiry id at runtime.** The type stops a
   TypeScript caller; anything else got a message with an empty Inquiry ID, looking entirely normal
   and traceable to nothing. Found by writing the test for the type-level guarantee.

### Phase 10: verification, as actually run

Against a local PostgREST (`npm run site:rest`) over the seeded local cluster, because `supabase-js`
speaks HTTP and a bare Postgres verifies nothing about a page.

| Step | Result |
|---|---|
| 1 · `npm run check` incl. both new gates | ✓ 27 gates |
| 2 · `next build && next start`, `/about` DRAFT → 404, published → 200 | ✓ and the same for `/process` via the endpoint |
| 3 · `site-shell.spec.ts` at eight widths | ✓ skip link first, one `<h1>`, one `<main>`, distinct landmark names |
| 4 · `navigation-a11y.spec.ts` keyboard model + axe | ✓ 98 assertions, zero critical/serious |
| 5 · `grep -rn "wa.me" app components` | ✓ none, and the gate proves it by planting one |
| 6 · `buildHandoffUrl` without `inquiryId` | ✓ `@ts-expect-error` in the test holds the type; a blank id throws |
| 7 · `POST /api/revalidate` without / with the secret | ✓ 401 / 200, and the named path refetches |
| 8 · media failure keeps the ratio box | ✓ `MediaFrame`'s existing behaviour, unchanged by the move |
| 9 · `curl /sitemap.xml` | ✓ exactly the two paths with published sections |
| 10 · delete a route file, run the parity test | ✓ fails, naming the missing path |

**1020 unit tests**, 78 files, none skipped, with `RLS_TESTS_REQUIRED=1`.

---

**Phase 09 — Initial Website Content Seed. COMPLETE.** The empty CMS is now a coherent draft
website: every page, section, navigation item, label, empty state, FAQ, SEO default, WhatsApp
template and Studio helper string from the specification is in the database as
`content_seed_version = 'rivya-v1'`, and re-running the seed is safe forever after.

Phase 08 (Content Management Engine) is complete and open as PR #12. Phase 07 remains CODE
COMPLETE with its Higgsfield migration unrun. Phase 06 merged as PR #8; Phase 04 closed out in
PR #5 and #7; Phase 03 merged as PR #4.

### Phase 09: what is built

**Two migrations, `0070` and `0071`.** Most of what the phase document assigned to `0070` was
already done by earlier phases, and the file says so: `content_seed_version` has been the column
name since Phase 03, so there was no rename. What was missing — and is now there —
`content_seed_runs.deferred_count`, the seed lookup indexes (seven of ten tables had no `seed_key`
index and none had a version index), and `set_owner_edited` hardened to SECURITY DEFINER. `0071`
adds a `BRAND` group, because SEED §6 names it as a Studio location.

**Eighteen seed modules, 231 records applied and 22 deferred.** Every string is the
specification's, verbatim. The homepage's 13 sections, about, large-format with its six category
entries, the /collection landing and seven category pages (created by that module, taking `pages`
to 20), commissions, seven process steps, portfolio, journal, contact, ten FAQs, SEO, the label
library and Studio help.

**Five verdicts, three guards.** `inserted`, `updated`, `unchanged`, `skipped (owner edit)`,
`deferred`. `unchanged` exists because a no-op re-run was rewriting all 231 rows and
`write_revision` fires on any update — 231 revisions per re-seed saying nothing changed. `deferred`
is per-RECORD, not per-module, because the two deferring modules are mixed.

**The §54 inventory**, generated from the database rather than the modules: 316 rows, 80 awaiting
owner verification, 22 deferred. `content:check-inventory` regenerates and diffs, wired into CI.

### Phase 09: what is NOT built

- **Any public route.** Nothing under `app/(site)/` consumes `resolvePage`. The copy, the
  windowing, the media resolution and the renderers all exist; no route calls them. Phase 10.
- **Ten of the homepage's thirteen renderers.** Amendment A8's split: the copy is seeded against
  block types that have no renderer, so the page would show three sections today.
- **The `t()` swap.** `studio-help.ts` seeds the Studio strings into `global_content` under the
  keys `components/studio/strings.ts` already declares; making `t()` read them with the constant as
  its fallback is the remaining half, deliberately not done in the same commit that first wrote the
  rows.
- **Any media binding.** `content/seed/media-bindings.ts` is empty and says why: the Higgsfield
  migration has never run, so `media_assets` holds no Higgsfield rows and every binding would fail
  the run rather than bind. The bindings the phase plans are listed in that file.

### The three defects the verification steps found

Each was invisible without running the step that caught it.

1. A dry run on an empty database reported **91 failures**, one per reference — it writes no pages,
   so every section's `page_id` resolved to nothing. Phantom failures on a run whose whole job is
   to report what *would* happen.
2. Then **31 rows** reported themselves owner-edited on a clean re-run. PostgreSQL stores jsonb
   keys by length then bytewise, not insertion order, so a payload written as
   `{is_video, autoplay, scrim}` reads back reordered: identical data, different hash.
3. The generated inventory embedded **page UUIDs**, which change on every `db:reset` — a committed,
   diff-checked file cannot contain per-database values.

### Phase 08: what is built

**The database.** Six migrations, `0050`–`0055`. Seven tables (`pages`, `page_sections`,
`content_revisions`, `navigation_items`, `global_content`, `seo_entries`, `faqs`), five triggers,
five `cms_*` SECURITY DEFINER functions, and the generated policy and transition files. All applied
locally AND to `ccvarsmzickdkryoakdg`, and verified there afterwards rather than assumed: 7 CMS
tables, all with RLS on, 90 policies matching local exactly, 6 `cms_*` functions, 8 triggers on
`page_sections`, and `page_sections_media_needs_slot_key` present.

**The blocks.** All 28 catalogue types declared; six built, chosen to exercise every payload family
(amendment A8). Both registries are `satisfies Record<BlockType, …>`, so an omission is a build
error — verified by removing one and reading the failure.

**The renderers.** `components/sections/`, synchronous and pure: `lib/cms/resolve.ts` decided what
is live, `lib/cms/media.ts` resolved every asset for the page in one query, `siteStrings` supplied
the chrome copy. `npm run cms:check-copy` parses each file with the TypeScript compiler and fails
on any literal a visitor would read.

**Studio.** `/studio/content/pages` and `/studio/content/pages/[pageId]` — add, edit, reorder,
remove, and only the status transitions the caller's role can actually take. A `MediaPicker` that
says at the moment of choosing whether an asset would block a publish.

**Scheduling and preview.** `cms_run_content_schedule` under `for update skip locked`, BLOCKING a
section after three refusals rather than retrying forever; `/api/preview` using the staff session
as its credential, with `draftMode()` correctly awaited.

**The seed.** Two modules — 12 route shells and 5 global strings, the latter carrying SEED §27–§29
verbatim. Applied locally; **not yet applied to hosted** (see *Remaining Work*).

### Phase 08: what is NOT built

- **22 of the 28 blocks.** Declared `PLANNED`, unaddable in Studio, rendering nothing publicly.
- **A repeater UI.** A block with repeating items is edited as JSON, validated on save against its
  own schema and refused rather than coerced.
- **Any section copy.** The engine is built and nothing is written into it. That is Phase 09.
- **Any public page route.** `app/(site)/[...]` does not consume `resolvePage` yet.

### The defect Phase 08 found in itself

`sync_media_usages` only writes a `media_usages` row when `media_slot_key` is present, and
`cms_publish_section`'s RV003 and RV006 gates are **both joins through that table**. A section
binding an asset with a null slot key therefore published with no media check at all. Reproduced: a
DRAFT, `OWNER_VERIFICATION_REQUIRED` asset went live and stayed DRAFT, invisible to the gap tracker
too. Migration `0054` closes it; re-verified after.

### Phase 07: what is built, and what is not

**Built and verified**

- **`scripts/media/migrate-higgsfield.ts`** — `--dry-run`, `--family=`, `--limit=`, resumable from
  a committed ledger. The decisions live in `lib/media/migration.ts`, which
  `tests/unit/higgsfield-migration.test.ts` drives with all 250 real manifest rows and a fake
  uploader, no network. The upsert key is `higgsfield_generation_id`, which survives a manifest
  renumbering; a test shifts twelve `process-pour` ids and asserts 250 skips, 0 uploads.
- **`content/media-slots.ts` and `lib/media/gaps.ts`.** 26 declared slots; against the manifest
  with nothing bound the report is 13 coverable, 2 thin, 11 gaps — matching the phase document's
  own gap table, including all seven pages verification step 8 names. `gallery-scene` surfaces as
  the one family no declared surface can use.
- **`/studio/media/higgsfield`** — Inventory (all thirteen FEAT §34 columns, six filters),
  Families, Gaps, with the concept banner on every tab and a read-only drawer with no regenerate
  control. Each tab is its own URL.
- **`scripts/media/assert-no-regeneration.ts`** — four rules, in CI and in `npm run check`.
  Verified to FAIL on a planted brief for `WALL-ART-001`, naming the asset and where it already
  lives, not merely to pass.
- **`scripts/media/build-asset-status.ts`** — regenerates §3 and §4 of
  `HIGGSFIELD_ASSET_STATUS.md` between markers. Manifest-only and deterministic; a second run
  produces no diff, which is what verification step 10 requires.
- **`0040` + `0041`** applied to both databases. The hosted project records 19 migrations with
  `0041_rls_policies_phase07.sql` as the latest, and `higgsfield_migration_runs` exists on both.
- **733 unit tests, 63 files, no skips** with `DATABASE_URL` set. 6 new e2e routing cases pass.

**Not built, and why**

- **The migration has not run.** 0 rows in `higgsfield_migration_runs` on both databases; the
  hosted `media_assets` holds the 3 Phase 06 canaries and nothing else. Proxy-blocked, not a
  defect. Exit criteria 1–5 cannot be ticked until the owner runs it locally.
- **8 of the 14 tracker e2e cases are `test.fixme`** — they need an authenticated session, the
  same wall `studio-access.spec.ts` documents. Their subject matter is not unproven in the
  meantime: the three filter counts and the seven gap pages are asserted against the real manifest
  in the unit suite, and "no regenerate control" is a build gate rather than a browser assertion.
- **No "Coverage" or "Concept Placement" tab.** Both are Phase 43 in `HIGGSFIELD_GUIDE.md` §7.

### Phase 07: the 10 verification steps, as actually run

| # | Step | Result |
|---|---|---|
| 1 | `check-asset-ids.py` | **PASS** — 31 documents against 250 manifest IDs, 0 collisions |
| 2 | `migrate-higgsfield --dry-run` | **NOT RUN** — needs `DATABASE_URL` plus Cloudinary reachability |
| 3 | `migrate-higgsfield` | **NOT RUN** — proxy blocks `api.cloudinary.com` and the CDN origin |
| 4 | Re-run reports 250 skipped | **NOT RUN** — depends on 3. Proved offline instead: the idempotency test drives all 250 through the real planner with a fake uploader |
| 5 | 26 video / 224 image rows | **NOT RUN** — depends on 3. The manifest split is asserted in the unit suite |
| 6 | Three "zero rows" identity queries | **NOT RUN** against imported rows; the manifest itself is proved to have no duplicate in any of the three |
| 7 | Tracker filters: 39 / 79 / 26 | **PASS, at the predicate** — asserted against the real manifest in `tests/unit/media-inventory.test.ts`. The UI wiring is `test.fixme` |
| 8 | Gaps tab shows all seven pages | **PASS, at the engine** — `tests/unit/media-gaps.test.ts`. The UI wiring is `test.fixme` |
| 9 | `media:assert-no-regen`, then plant a `WALL-ART-001` brief | **PASS both ways** — clean run passes; the planted brief exits 1 naming the asset |
| 10 | `media:build-status && git diff --exit-code` | **PASS** — second run produces no diff |

Steps 2–6 are the migration itself and everything downstream of it. They are the owner-side
action, not open questions.

### Phase 06: what is built, and what is not

**Built and verified**

- **The provider seam.** `MediaProvider` in `lib/media/types.ts`; `getMediaProvider()` is the only
  export the rest of the product uses. `lib/media/providers/cloudinary.ts` is `server-only` and is
  the ONLY file importing the SDK — `npm run media:check-provider` enforces both halves and was
  verified to fail on a planted violation, not merely to pass.
- **`lib/media/url.ts` builds delivery URLs with no SDK**, so a Client Component can render media
  without the secret-holding module reaching a browser bundle. Parameters are emitted in a fixed
  order: two spellings of one transformation are two derived assets, two cache entries and two
  bills for one picture.
- **The transform policy matches PHASE-05-09.md §06 and CLOUDINARY.md §5 exactly** — six presets
  (`thumb·card·grid·hero·hero-xl·og`) and the nine-rung srcSet ladder. An earlier draft invented a
  different set and was corrected; see *Known Issues* for why that mattered.
- **`0030` + `0031`**, applied to BOTH databases and proved equal by a 515-object signature hash,
  not by counting. `media_assets` gains 22 columns; `media_usages` is the reverse index.
- **`app/api/media/sign`** — five gates before the signature: session, `media.write`, Zod, the
  folder allowlist, then §7.1's MIME allowlist and byte ceiling.
- **`MediaImage` (RC-232) and `MediaVideo` (RC-233)**, both marked BUILT in the registry. Three
  perf gates guard their contracts, each verified to fail on a planted violation.
- **The Studio Media Manager** — six sections from one `MediaLibrary`, the uploader, and the save
  action. `npm run build` compiles all seven media routes.
- **All three Phase 06 canaries are uploaded** to the live Cloudinary account (cloud `dhaqpl1kz`,
  Free plan at 1.08% of 25 credits).
- **656 unit tests, 60 files, no skips** with `DATABASE_URL` set. 11 e2e cases pass; 7 are
  `test.fixme` pending a reachable auth server.

**Not built, and deliberately so**

- **`/studio/media/higgsfield`** stays a stub. AI Assets is not a `kind` — it is
  `source = 'HIGGSFIELD'` across IMAGE and VIDEO — and Phase 07 owns both the page and the import
  of the remaining 247 assets.
- **The §8 rate limit on the sign endpoint (20/hour per staff `user_id`) is NOT enforced.** It is a
  fixed-window counter over `rate_limit_buckets`, and that table belongs to Phase 41
  (`0390_phase41_security.sql`). Creating it here would take a table out of the phase that owns it.
  The exposure is bounded but real and is recorded in the route: a session holding `media.write`,
  or one that has been stolen, can mint signatures as fast as it can ask.
- **Magic-byte type detection** (`lib/media/validate-upload.ts`) cannot exist at signing time — the
  bytes do not. The route checks the DECLARED type, which is a different control, not a weaker one.
- **A detail drawer per asset.** The table shows alt text inline, which is the cheapest review of
  the field most likely to be wrong; editing it is Phase 08's surface.

### Phase 06: the 8 verification steps, as actually run

| # | Step | Result |
|---|---|---|
| 1 | Presets, srcset, ratio-crop rejection, poster derivation | **PASS** — 37 cases in `media-transform.test.ts`, incl. `UnsupportedRatioError` on a non-D6 ratio and on an inherited `Object` property (`'toString'`, which a naive `in` check would accept) |
| 2 | Sign endpoint: no session → 401; bad folder with a session → 422 | **PASS (401) / CODE CORRECT (422)** — the 401 is asserted in `media-upload.spec.ts`. The route returned 400 for a disallowed folder and now returns the specified 422; the authenticated assertion is `test.fixme` |
| 3 | Upload a JPEG through `/studio/media/images`, assert the row and the folder | **BLOCKED** — needs a browser session, and the sandbox cannot reach `*.supabase.co`. Same blocker as Phase 04 step 6's authenticated half |
| 4 | Import the three canaries and assert their rows | **PASS** — `npm run media:import-canaries`. `LARGEFORMAT-DINING-004` stores `resource_type = 'video'`, `duration_s = 6.041667`, `aspect_ratio = '9:16'`; all three carry `is_ai_generated`, `is_concept` and `source = 'HIGGSFIELD'`. The `so_0` poster derivative exists on Cloudinary. "No candidate above 2560" is asserted for both 4800px and 6336px sources |
| 5 | `rivya_asset_id` still unique after `0030` | **PASS** — on the hosted project: `media_assets_rivya_asset_id_key UNIQUE (rivya_asset_id)` alongside `media_assets_provider_identity UNIQUE (provider, resource_type, public_id)` |
| 6 | `MODEL_3D` without `model_format` → refused | **PASS** — `media_assets_model_format_present` rejects it; the same insert WITH `'GLB'` is accepted, so the check is not vacuous |
| 7 | Delete an asset a `media_usages` row references → refused | **PASS** — `media_usages_media_id_fkey` refuses it; unbinding first then deleting succeeds |
| 8 | Playwright at 390px: chosen candidate ≤ 1024px, `content-type` avif/webp | **BLOCKED** — needs a public page rendering `MediaImage` (none exists until Phase 10) AND network access to `res.cloudinary.com`, which the sandbox proxy denies with a 403 on CONNECT |

**Two steps are blocked by the environment, not by the code, and neither is hidden.** Step 3 and
step 8 are the same two blockers that have run through Phases 04–06: no browser-reachable auth
server, and no egress to the CDN. What step 8 would have proved about URL correctness was instead
proved *better* — by asking Cloudinary's own API to generate every chain this codebase emits, which
is how the `g_auto` defect surfaced.

**The canary rows are on both databases**, identical, and RLS was re-confirmed against the hosted
project with a baseline: 3 rows exist, `anon` sees 0. All three are `DRAFT` and
`OWNER_VERIFICATION_REQUIRED`, so the D10 gate keeps them unpublishable until an owner decides.

### Phase 05: what is built, and what is not

**Built and verified**

- **`lib/auth/studio-nav.ts` — the D4 map, once.** 8 groups, 58 leaves, each with a label *key*, a
  read permission, a write permission where one applies, and its owning phases. `nav-visibility.ts`
  now derives from it instead of holding a second copy, and the 58 `page.tsx` files are generated
  from it.
- **`tests/unit/studio-nav.test.ts`** asserts D4 ↔ manifest ↔ disk. D4 is *parsed* out of
  CANONICAL-DECISIONS rather than transcribed. Both failure directions were provoked and confirmed,
  including a page on disk the manifest does not name — an unreachable, ungoverned route.
- **The shell.** `app/(studio)/layout.tsx` (bone ground — the Phase 04 carry-forward) and
  `app/(studio)/studio/(shell)/layout.tsx`. `(shell)` is a route group so `/studio/login` stays
  outside the permission check; a layout at `studio/layout.tsx` would gate the sign-in page behind
  being signed in.
- **`/studio` Overview** with the three D4 tabs as query parameters, not client state. Activity
  reads real rows; Analytics says Phase 37 and shows no figure.
- **Migration `0020`** (`activity_events`, `studio_preferences`) and **`0021`**, generated.
- **`withPermission` writes exactly one audit row** and names the record — the Phase 04
  carry-forward, with nine tests and both regressions confirmed against the old behaviour.

- **All fifteen Studio primitives** in `components/studio/**`, each built around the distinction it
  exists to preserve rather than around rendering. Documented in `STUDIO_GUIDE.md` §4.1 with the
  reason each one is shaped the way it is. 20 tests.
- **The ⌘K command palette**, its provider registry (20 results / 200 ms per provider, enforced by
  the registry rather than trusted to providers), the route provider, and
  `app/api/studio/search/route.ts`. 13 tests, including that a provider is skipped *before* it runs
  when the role lacks its permission.
- **`loading.tsx` / `error.tsx` / `not-found.tsx`** for the Studio. The error boundary never renders
  `error.message` — only the digest.
- **`logActivity()` has three real callers**: all three user-management mutations.

**Not built yet, and Phase 05 is not complete without them**

1. **`tests/e2e/studio-rbac.spec.ts`** — the per-role route matrix. Blocked on the same thing as
   Phase 04 step 6: it needs real sessions, so it needs a reachable Supabase project.
2. **Visual baselines for the shell.** The unauthenticated Studio surfaces DO pass at all eight
   FEAT §45 widths — `studio-access.spec.ts` runs 104 assertions across them — but the shell itself
   cannot be reached without a session, so its baselines wait on Supabase too.
3. ~~The top bar~~ — **done.** `StudioTopBar` carries the identity, the role badge, a visible ⌘K
   hint and the deployment-environment badge. That last one is absent in production deliberately: a
   badge rendered everywhere becomes furniture, and its absence meaning "this is the real site" only
   works if it is genuinely absent. 9 tests, including that it leaks no deployment configuration.
4. ~~`studio_preferences` reader/writer~~ — **done except one column.** `lib/auth/preferences.ts`
   reads the chrome and writes `sidebar_collapsed` and `pinned_routes`; the top bar collapses the
   navigation, and every page can pin itself. Both are plain `<form>`s posting to Server Actions in
   `app/(studio)/studio/(shell)/actions.ts`, so they work before hydration.
   **`dashboard_card_order` still has no writer** — the column exists and nothing reorders cards.
5. **Verification step 6** (press ⌘K on a Studio page, type `journ`, assert Content → Journal is
   first and Enter navigates) needs a browser with a session. The logic beneath it is covered:
   `searchRoutes('journ', …)` is asserted to return the journal route first.
   **Step 7 is done** — and the step as written was wrong; see `PHASE-05-09.md`, which now records
   why, and `tests/unit/rls/phase05.test.ts`, which replaces it.
6. ~~`DATA_MODEL.md` Phase 05 pass~~ — **done**, and it corrected a divergence: the document said
   `activity_events.actor_role` was `text`; it is the `user_role` enum, matching
   `audit_logs.actor_role`. Verified against the live schema.
7. **`dashboard_card_order` has no writer.** The column exists, the shell reads the chrome, and
   nothing reorders dashboard cards. Not an exit criterion; deferred deliberately rather than
   forgotten.

## Status *(Phase 04, kept for its verification record)*

> The current phase's status is at the top of this file. The sections from here down are the
> accumulated record of Phases 02–04, newest first within each; they are kept because they carry
> verification detail that is still true and still occasionally needed.

**SUBSTANTIALLY COMPLETE — 10 of the 11 verification steps pass against a real database.**
Everything verifiable in this environment has been verified, against a real PostgreSQL 16.13
cluster: 19 gates green, 459 unit/RLS tests (none skipped — `RLS_TESTS_REQUIRED=1`), e2e 13 passed
and 4 `fixme`.

### The 11 verification steps, as actually run

| # | Result | Note |
|---|--------|------|
| 1 | PASS | `db:reset` then `check-rls` exits 0; 12 tables, all `rowsecurity`, 51 policies |
| 2 | PASS | Six roles × five tables, allow/deny matches the matrix |
| 3 | PASS | Shape B verified on all four join tables; a Shape-A policy pasted on does fail with `column "status" does not exist` |
| 4 | PASS | The tampered `0011` was rejected by `check-rls` naming the table and both role sets; reverted |
| 5 | PASS | anon sees `PUBLISHED` only; insert refused; `staff_profiles` / `content_seed_runs` / `audit_logs` return zero rows |
| 6 | **PARTIAL** | The unauthenticated half passes (13 tests). The authenticated half is `test.fixme` — see below |
| 7 | PASS | Zero hits for `service_role` / `SUPABASE_SERVICE_ROLE_KEY` in `.next/static` |
| 8 | **BLOCKED** | Needs a real session in the Studio UI. See below |
| 9 | PASS | The sole owner cannot be demoted — the trigger raises with `constraint = staff_profiles_last_owner`, and `isLastOwnerRefusal()` is unit-tested against both error shapes |
| 10 | PASS | `update audit_logs` as `authenticated` is refused at the privilege level, not merely unpolicied |
| 11 | PASS | No stale `audit_logs` references outside `docs/requirements/` |

**Why 6 and 8 are not closed, precisely.** Both need a *real Supabase session*. A forged cookie is
refused by `getUser()` — which is the reason `getUser()` is used rather than `getSession()`, so this
is the guard working, not an obstacle to route around. No amount of local PostgreSQL substitutes for
the auth server. The four unproved cases are `test.fixme` in the spec rather than omitted, so they
appear in every test report instead of only in this file.

What those cases would prove IS proved one layer down: the six-role matrix is exercised by the RLS
suite against a real PostgreSQL. What is unproved is the seam between a browser session and that
layer — not the layer.

### Carried into Phase 05

**A refusal writes TWO audit rows.** `withPermission()` logs `ERROR` alongside the explicit `DENIED`
written by the last-owner handler, and it takes no entity parameter so it cannot name the record
touched. Step 8 is worded against one row naming the target. A known defect, not an unknown — fix it
in Phase 05, when the Studio shell gives `withPermission` somewhere to learn the entity from.

**RLS became testable here, contrary to what Phase 03 concluded.** Supabase's policies rest on
ordinary Postgres roles plus `auth.uid()` reading a per-transaction GUC, all reproducible on a plain
cluster. `supabase/local/00-auth-shim.sql` does it. **The grants in that file are load-bearing**:
on Supabase, `anon` holds full DML on every table in `public` — GRANT is not the security boundary
there, RLS is the whole of it — so a shim without them makes every deny assertion pass for the wrong
reason. `assertHarnessIsHonest()` runs before the suite and fails if a table with RLS disabled is
not visible to anon.

## Completed

- Toolchain scaffolded per CANONICAL D1/D2: Next.js 16 App Router, React 19, TypeScript
  strict with `noUncheckedIndexedAccess`, Tailwind 4 CSS-first, Vitest, Playwright, ESLint,
  Prettier, and `.github/workflows/ci.yml` running every gate as its own step.
- **Token layer.** `app/styles/tokens.css` is the only file permitted a colour literal;
  `scheme.css` redeclares an identical 28-token semantic set for DEEP, INK and BONE;
  `globals.css` carries the Tailwind `@theme` bridge and no values of its own.
- **Every derived value re-verified before use.** The palette quartet re-counted against the
  Higgsfield manifest (114 assets each). The ten-step neutral ramp reproduces exactly from
  the OKLab rule in DESIGN_SYSTEM §2.2 — all ten hexes and luminances to four decimals.
  Every contrast claim recomputed, including champagne on bone at 2.52:1 (fails AA at every
  size) and its replacement champagne-deep at 5.05:1.
- **32 primitives** in `components/primitives/**`, each with behaviour-level tests.
- **Motion helpers** implementing the §4.3 contract: reduced motion renders the final state,
  not a shortened animation; content is never gated on motion; the static branch is used on
  both the server and the first client render so hydration agrees.
- **Dev gallery** at `/design-system`, verified 200 under `next dev` and 404 in a production
  build — and since the route is in the production manifest, the 404 provably comes from the
  `notFound()` guard rather than an absent route.
- **Licence audit of all eleven FEAT §7 sources.** 5 NOT_ADOPTED, 6 REJECTED, none adopted.
- **Five gates**, each proved to bite by provoking the failure it exists for.

## Files Created

**Phase 07**

```
content/media-slots.ts · content/asset-purposes.ts
lib/media/{manifest,migration,gaps,inventory}.ts
lib/media/providers/cloudinary-admin.ts
scripts/media/{migrate-higgsfield,assert-no-regeneration,build-asset-status}.ts
components/studio/{HiggsfieldTracker,HiggsfieldAssetDrawer,CopyBriefButton}.tsx
app/(studio)/studio/(shell)/media/higgsfield/page.tsx        (was a stub)
supabase/migrations/{0040_phase07_higgsfield,0041_rls_policies_phase07}.sql
tests/unit/{higgsfield-migration,media-gaps,media-inventory}.test.ts
tests/e2e/higgsfield-tracker.spec.ts
docs/media/HIGGSFIELD_ASSET_STATUS.md                        (now generated between markers)
```

**Phase 02 (original list)**

```
package.json · tsconfig.json · next.config.ts · postcss.config.mjs · eslint.config.mjs
playwright.config.ts · vitest.config.ts · .prettierrc.json · .github/workflows/ci.yml
app/layout.tsx · app/globals.css · app/styles/{tokens,scheme,base}.css
app/(site)/design-system/page.tsx
components/primitives/**  (32 components + motion/{Reveal,useReducedMotion})
components/devtools/Specimen.tsx
lib/ui/{cn.ts,polymorphic.ts}
scripts/design/{check-tokens,check-registry,check-utilities}.mjs
tests/setup/vitest.setup.ts · tests/e2e/design-system.spec.ts
tests/e2e/design-system.spec.ts-snapshots/  (8 baselines)
```

## Database Changes

**Migrations `0040` + `0041` (Phase 07).** `higgsfield_migration_runs` — the per-run audit record,
with `constraint higgsfield_migration_runs_counts_add_up check (migrated + skipped + failed <=
attempted)`, because a run that reports more outcomes than attempts is a bug in the script and the
database is the last place that can say so. `0041` is its generated select policy: readable with
`media.read`, insertable by the service role only. `db:check-schema` required a tier decision for
the new table; it is recorded as a §1.4 run-record exemption.

Both applied to the local cluster and to the hosted project, which now records **19 migrations**
with `0041_rls_policies_phase07.sql` as the latest. Verified 2026-09-08:
`higgsfield_migration_runs` exists on both, holds **0 rows** on both, and hosted `media_assets`
holds the 3 Phase 06 canaries — the migration has not been run.

**Migrations `0001`–`0008`** — the whole Phase 03 spine. Applied and verified against a local
PostgreSQL 16.13 cluster; **never applied to the hosted Supabase project** (see Migration
Requirements).

| Migration | Contents |
|---|---|
| `0001_extensions.sql` | `pgcrypto`, `citext`, `pg_trgm`, `unaccent` |
| `0002_enums.sql` | `content_status`, `owner_verification`, `fact_classification`, `media_kind`, `price_state` (three values — no `FIXED` until Phase 14), `collection_concept_state` |
| `0003_shared_functions.sql` | `set_updated_at()`, `rivya_slugify(text)` (IMMUTABLE, accent-folding) |
| `0004_taxonomy.sql` | `categories`, `collections`, `materials` |
| `0005_media_registry.sql` | `media_assets` (minimal), plus the two `hero_media_id` foreign keys `0004` could not declare |
| `0006_catalog.sql` | `products`, `product_collections`, `product_materials`, `product_media`, `product_relations` |
| `0007_seed_bookkeeping.sql` | `content_seed_runs` |
| `0008_indexes.sql` | 24 performance indexes |

RLS is enabled on all ten tables with **zero policies** — the intended state until Phase 04.

**Seed data:** the seven D3 categories, slug/name/order only. `3d-resin` is seeded
`OWNER_VERIFICATION_REQUIRED` because the name asserts a fabrication capability nobody has
confirmed; the `categories_verified_before_publish` constraint makes that row unpublishable until
an owner clears the flag. `products` has zero rows and always will under seed policy.

## Tests Run

```
npm run typecheck · lint · format:check · test · build
npm run manifest:verify · media:check-ids
npm run design:check-tokens · design:check-registry · design:check-utilities
npm run db:reset · db:check-migrations · db:check-schema · db:check-types · db:check-data-layer
npm run seed:content -- --dry-run   then twice for real, then after an owner edit, then --force
npx playwright test                 (8 projects = the FEAT §45 widths)
```

## Test Results

**Phase 07 (current).** **733 unit tests across 63 files, no skips**, with a local PostgreSQL
16.13 cluster reachable. Sixteen static gates and six database gates green. Playwright:
`higgsfield-tracker.spec.ts` 6 passed, 8 `fixme`.

New this phase: 21 migration tests driving all 250 real manifest rows through the planner with a
fake uploader; 32 gap-engine tests; 21 inventory tests including the three counts verification
step 7 asserts through the UI.

Three tests earned their existence by failing first:
- The Zod schema rejected the real manifest on its first run — `source_min_url` is `null` on the
  26 videos, not absent. The schema said `.optional()`; it is `.nullable()`.
- Two transform tests caught a fix that ran preset widths through `snapWidth`, turning `hero`
  into 1920 and `thumb` into 320.
- The ID-collision test caught `large-format.coffee` minting `LARGE-FORMAT-COFFEE-001`, the same
  name as the family allocator's future `LARGEFORMAT-COFFEE-001`.

---

**Phase 03 (original record).**

- Unit: **329 tests across 44 files**, all passing (was 282/41 at the end of Phase 02).
- All **thirteen** gates pass.
- Phase 03's nine verification steps, each executed against the real database:

  | # | Step | Result |
  |---|---|---|
  | 1 | Migrations apply to an empty database | 8/8, no error |
  | 2 | `db:types` then diff | no diff; two runs byte-identical |
  | 3 | Dry run on a fresh database | 7 inserted, 0 updated, 0 skipped |
  | 4 | Two real runs | 7 inserted; then 0 inserted, 7 updated, 0 skipped; `content_seed_runs` = 2 |
  | 5 | Owner edit, then re-seed | 1 `skipped_owner_edited`; `name` still `Owner Edit` |
  | 6 | `REQUEST_QUOTE` with price 0 | rejected by `products_price_state_coherent` |
  | 7 | `price_state` values / `FIXED` insert | exactly the three values; `FIXED` rejected as an invalid enum input |
  | 8 | `check-data-layer` | exits 0; exits 1 when a `.from(` is added to a component |
  | 9 | `vitest run tests/unit/repositories` | 19 tests pass |

- Every constraint was additionally probed with a value it must reject **and** one it must accept.
  The media identity key was confirmed to allow the same `public_id` under a different
  `resource_type` while rejecting a true duplicate — the behaviour DATA_MODEL §7 says the wider
  key exists for.
- Each of the five new gates was proved to bite by provoking the failure it exists for, and the
  layering gate was additionally proved **not** to fire on `.from(` inside a comment or a string.

**Step 4 sequencing note.** Verification steps 3 and 4 each begin from a fresh database. A dry run
writes a `content_seed_runs` row (that is what `is_dry_run` is for), so running step 3 and step 4
against the same database yields a count of 3, not 2. Step 4's assertion is only true from a
fresh start, and that is how it was run.

## Known Issues

### Phase 07 — four things worth knowing before touching this code

**1. The migration has never executed, and the first attempt to run it found two defects in
thirty seconds.** Neither was in the logic the 21 offline tests cover — both were in the wiring
around it, which is exactly where a fake uploader cannot look:

- **`.env.local` was never loaded.** Next.js loads it for the app; a `tsx` CLI is not Next.js and
  nothing was loading it here. Every asset failed with "Missing required environment variable
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME" while that variable sat in the file the whole time. Fixed with
  `process.loadEnvFile` (built into Node 22, no dependency). It does not override an
  already-exported variable — verified, because `db:reset` depends on that property.
- **A missing credential was recorded as 250 asset failures.** `configure()` is lazy, so the first
  upload threw inside the per-asset `try/catch`, which dutifully wrote a ledger entry and moved on.
  The result was a committed file describing a problem that was never about the assets. Now checked
  once, before anything is written.

The planner, ledger rules, row mapping and idempotency claim remain exercised over all 250 real
manifest rows — but with a fake uploader, and a fake uploader cannot 400. Phase 06 is the precedent:
23 URL-builder tests passed while every video URL would have been rejected, and a 20 MB PNG failed
an upload cap no test knew about. Treat the first real run as a source of new information, and run
`--limit=5` before the full 250.

**2. `slot_key` now carries the registry key, and Phase 08 must honour that.**
`MEDIA_GUIDE.md` §6 previously documented short section-scoped keys (`media`, `card.3`). Nothing
enforces the new contract — the database check constraint only requires non-blank — so a Phase 08
trigger that writes the old form will make the Gaps tab report every slot as unbound, silently and
plausibly. The reasoning is recorded in three places (the guide, the header of `lib/media/gaps.ts`,
and this file's *Next Exact Action*) precisely because nothing in code can catch it.

**3. The `EMPTY_STATE` resolution is load-bearing, not a nicety.**
`/portfolio` is a gap that must never be filled by generation: a portfolio entry asserts Rivya
delivered a piece to a client. `briefableGaps()` excludes it by construction and the Gaps tab
shows no "Copy brief" button on it. If a future change filters `report.gaps` directly instead of
calling `briefableGaps()`, that protection disappears with no test failing — the only thing that
would notice is a human reading a brief for work nobody has done.

**4. The tracker's `?asset=` drawer trusts nothing and 500s on nothing.**
An unknown asset id resolves to `null` and closes the drawer; an unknown `?tab=` falls back to
Inventory. Both are deliberate: these are pasted-link parameters, and a stale link in somebody's
messages should not take the page down. The e2e suite asserts the tab case.

### Phase 06 — three things the tests could not have caught, and one they did

**`g_auto` inline on a video is HTTP 400, and every video URL in the product had it.** Found by
putting the chains `lib/media/url.ts` builds to the live Cloudinary API during the canary run, not
by reading documentation. Cloudinary answers `"g_auto must be in a transformation component by
itself"` — but only on the video namespace; inline `g_auto` is perfectly valid on an image. All six
presets carry `gravity: 'auto'`, so **every video and every derived poster would have 400ed in
production**. `posterUrl` was hit by the same rule for a reason easy to miss: a poster is an image
in its output and a video-namespace delivery in its addressing.

Twenty-three unit tests over the URL builder passed throughout. They compared strings; none of them
sent one anywhere. **A URL builder is only testable against the service that parses the URL.** The
unit tests remain worth having for the cache-stability properties — parameter ordering, `dpr_1`
omission — which are ours to decide and cheap to regress. Fixed and re-verified against the live
API; the chains are tabulated in `CLOUDINARY.md`.

**The transform policy was invented rather than read.** My first `transform.ts` had five presets on
a ten-rung ladder; the phase document and `CLOUDINARY.md` §5 both fix six presets and a nine-rung
ladder. The miss that mattered: `SECURITY.md` §7.2 tells the owner what to supply for a default
social card by referring to "the Phase 06 `og` preset's output size" — and there was no `og`
preset. A specification other documents already cite is not a starting point to improve on.

**Two gates were missing from `MediaVideo`.** `saveData`/`deviceMemory` and, separately, the 768px
viewport gate. RC-233's own record names all four; I had implemented one, then three. Both are now
in and tested, including the `< 4` boundary.

**What the tests DID catch:** `source` being `not null` with no default broke two RLS fixtures
immediately. One of them was the write-permission probe — where a constraint rejecting the insert
would have made all four "may not" assertions pass without RLS being involved at all.

### Earlier

**Supabase credentials are configured but UNREACHABLE from this sandbox.** `.env.local` holds
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and a
direct (5432, non-pooled) `DATABASE_URL`. The egress proxy refuses `*.supabase.co` over HTTPS
(`CONNECT tunnel failed, 403`) and refuses raw TCP to 5432/6543, while npm:443 stays open in
the same test. **Phase 03 migrations and the seed can be written here but not applied or
tested here** — that needs a machine with ordinary egress, or CI. See docs/ops/ENVIRONMENT.md.

**Cloudinary works, through MCP.** Cloud `dhaqpl1kz`, Free plan, 1.04% of credits used. Direct
HTTPS to `res.cloudinary.com` is blocked like everything else, but the MCP server routes via
the allowlisted Anthropic proxy, so uploads run server-to-server with this sandbox never
touching the bytes.

**The Phase 06 migration path is settled, and it is not the obvious one.** Higgsfield's source
PNGs exceed the plan's 10 MB image cap (a canary was rejected at 20.8 MB). The `_min.webp`
variant Higgsfield serves alongside each image is *not* a downscale — same 4800×3584, 463 KB.
`source_min_url` is now in the manifest for all 224 images and is what the bulk run reads.

**SECRETS EXPOSED — rotation requested, not confirmed.** The service-role key, secret key, JWT
secret and database password were pasted into a chat transcript on 2026-09-08. They must be
rotated in the Supabase dashboard; `.env.local` needs re-filling afterwards. Until that is
done, treat these credentials as compromised.

**BLOCKING, and outside this session's reach: GitHub Actions cannot provision a runner.**
**40 of 40** runs — on `main` and on feature branches alike, including the very first — fail
about two seconds after creation with `runner_id: 0`, an empty runner name, **zero steps
executed** and `HTTP 404` for the job logs. A job that dies before a runner picks it up has
run none of this repository's code.

Ruled out with evidence: the code (all nine gates pass locally and Vercel builds the same
commits); the workflow file (an unparseable one yields a run with *zero* jobs, whereas the
`verify` job is created with its `ubuntu-latest` label intact and only then dies unassigned);
Actions permissions (set to "Allow all actions and reusable workflows"; runs created after
that change fail identically); and flakiness (a re-run reproduced the signature to the
second). What remains is the account layer — the repository is **private**, so its minutes are
metered, and this signature is what GitHub emits when Actions is refused at billing. Owner
action: `github.com/settings/billing` → Actions, any account-level banner, or make the
repository public. Full diagnosis in `docs/ops/ENVIRONMENT.md`; evidence on PR #3.

**Until a runner exists, CI is not a gate.** Run the nine `verify` steps locally before every
push and satisfy D9 from those runs, evidenced in the phase record — never from a green check.

**Resolved during this phase**, recorded because each was a real defect:

1. **Every button rendered unstyled.** `base.css` was imported unlayered and beat every
   Tailwind utility on `button` — no padding, no accent fill, no border. The visual baselines
   had been captured from that state and therefore endorsed it. This is the phase's most
   important lesson: **a snapshot proves nothing changed, never that anything is right.** The
   checks that found real defects were the ones asserting against an external standard —
   computed style, the OKLab rule, axe, a real keyboard — not the ones comparing the system
   to its own past output.
2. **Nine components had no transitions** — `duration-[--var]` compiles to invalid CSS that
   browsers drop silently. Gated in `check-tokens`.
3. **The QA matrix could not test touch** — mobile projects reported a fine pointer until
   `hasTouch` was set, so the 44px rule was unverifiable where it applies.
4. `Dialog` and `Drawer` **did not restore focus to their trigger**. `useModalSurface`
   applies `inert` in a layout effect; `FocusTrap` captured `document.activeElement` in a
   passive effect, which runs later, so it captured `<body>` after the browser had blurred
   the inert trigger. **jsdom does not implement `inert`'s focus behaviour**, so the unit
   test asserting restoration passed throughout — the Chromium test caught it. Recorded above
   that test so it is not trusted alone.
5. `Switch` rendered a button with **no accessible name** — a critical axe violation. The
   unit tests had hidden it by passing `aria-label` themselves. Now optional `label` with a
   dev-time assertion covering all three name sources, plus a test that the name does not
   change when toggled.
6. Four component groups independently hit the **polymorphic ref** error. Fixed in
   `lib/ui/polymorphic.ts` and documented as DESIGN_SYSTEM §6.3 so a fifth does not.
7. **False positives in my own gates** — unescaped variant selectors, bare utility
   roots matching prose, unstripped block comments, and CSS leading-digit escaping.
8. Playwright polled `/` for readiness, which legitimately 404s until Phase 10.

## Remaining Work

### Owner-side, from Phase 11

0. **Run `npm run media:migrate:higgsfield`, then bind the homepage's families.** This is the one
   action that unblocks the most: `media_assets` is empty, so every image on every page is the
   SEED §47 fallback well, no visual baseline is worth taking, and no Lighthouse number would mean
   anything. The Phase 11 document's media table names every family and asset id the homepage
   needs, including the hero pair (`LARGEFORMAT-DINING-002` still 21:9, `-001` mobile 9:16,
   `-005` desktop motion 16:9, `-004` mobile motion 9:16). Binding is an edit to
   `content/seed/media-bindings.ts` and a re-seed — but an entry naming an asset that does not
   exist is a hard seed failure, so it cannot be done before the migration runs.

0a. **Decide about the Lighthouse workflow.** `.github/workflows/lighthouse.yml` is manual dispatch
   only, deliberately: three Chrome runs per route per push is the most expensive thing this
   repository could add, and the standing instruction is to stay inside the free Actions tier.
   Running it on pull requests needs an explicit decision — and the Actions spending limit below
   fixed first, since no workflow on this repository has ever executed a step.

0b. **The 21:9 hero motion gap.** The manifest holds no 21:9 video at all, so the desktop clip is
   16:9 played inside the 21:9 still with `object-fit: cover` — accepted, and recorded in
   `content/media-slots.ts` as `home.hero.video`, resolution `GENERATE`. Filling it is a new
   generation and needs the owner's approval under D6.

### Owner-side, from Phase 09

0. **Run `npm run seed:content` against the hosted database.** The schema is current at 27
   migrations; the content is local only. 231 records. It must be the RUNNER, not hand-written
   SQL: the runner stores a `seed_content_hash` per row, which is how it later tells its own
   writes from an edit a person made. Rows inserted without it would be treated as owner-edited
   and skipped by every future run.

0a. **Verify the 80 flagged rows in Studio.** Every FAQ answer, every process step, and every
   sentence asserting what Rivya can physically make. None of them can be published until the
   owner clears the flag — `cms_publish_section` refuses with RV002.
   `docs/content/INITIAL_CONTENT_INVENTORY.md` lists all of them.

0b. **Supply the Google Maps location for the contact page.** SEED §21 refers to an "existing
   supplied Google Maps destination" and supplies none, so the field is seeded null rather than
   guessed. Everything else on that section — phone, WhatsApp, email — is seeded from §21 and needs
   only confirming.

### Owner-side, from Phase 08

0. **Run `npm run seed:content` against the hosted database.** The schema is there; the content is
   not. This writes 12 `pages` route shells and 5 `global_content` strings. It must be the RUNNER,
   not hand-written SQL: the runner stores a `seed_content_hash` per row, which is how it later
   tells its own writes from an edit a person made. Rows inserted without it would be treated as
   owner-edited and skipped by every future run. One command, from any machine whose
   `DATABASE_URL` can reach the pooler.

0b. **Verify the 250 Higgsfield assets in the Media Manager.** Every one is `APPROVED` *and*
   `OWNER_VERIFICATION_REQUIRED`, which is exactly what `cms_publish_section` refuses with RV006.
   Until they are verified, **no section that binds one can be published** — so the site cannot go
   live on Higgsfield media at all. This is the design working: the assets are AI-generated and
   assert things about Rivya's work that only the owner can confirm.

0c. **Decide the Vercel cron cadence.** `vercel.json` schedules the content sweep once a day at
   03:00 UTC, because the Hobby plan permits daily crons only. A section scheduled for 09:00
   therefore publishes at 03:00 the next day. Hourly or finer needs a paid plan; nothing has been
   changed that would incur a charge.

### Owner-side, blocking Phase 07's exit criteria

1. **Add `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` to `.env.local`, then run
   `npm run media:migrate:higgsfield`.** Both names are already in `.env.example` and documented in
   `ENVIRONMENT.md` §5; the working `.env.local` carries `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` but
   not those two. Phase 06's canaries hid this — they were uploaded through the Cloudinary MCP
   server, which carries its own credentials, so nothing had ever exercised the script's own
   authentication path. The script now checks all three before it uploads anything and names what
   is missing.

   Commands and expected output are under *Next Exact Action*. Verification step 2 (`--dry-run`)
   **has now been run here and passes**: `attempted 250, migrated 0, skipped 0, failed 0`. Steps 3
   onward still need Cloudinary: the sandbox proxy answers 403 to CONNECT for both
   `api.cloudinary.com` and `d8j0ntlcm91z4.cloudfront.net`, which its own README says to report
   rather than route around. Exit criteria 1–5 stay unticked until the run happens.

2. **Rotate six secrets, all exposed in a chat transcript on 2026-09-08.** Names only below; no
   value, prefix or length is recorded anywhere in this repository.

   | Secret | What it grants if leaked |
   |---|---|
   | `SUPABASE_SERVICE_ROLE_KEY` | Full read/write on every table, bypassing RLS entirely |
   | `SUPABASE_SECRET_KEY` | Same class of access |
   | `SUPABASE_JWT_SECRET` | Ability to MINT a valid session for any role, including `owner` |
   | `POSTGRES_PASSWORD` | Direct `psql` access to the hosted database |
   | `CLOUDINARY_API_KEY` | Paired with the secret below |
   | `CLOUDINARY_API_SECRET` | Upload, overwrite, transform and **delete** any asset in the account, and sign the browser upload endpoint |

   The four Supabase values were pasted earlier; the Cloudinary pair was pasted while working
   through the migration. Treat all six as compromised until confirmed rotated. The owner's
   instruction was to rotate once all phase work is finished, which is why this is a standing
   record rather than a blocker.

   **Rotating the Cloudinary pair does not disturb anything already delivered.** Delivery URLs are
   unsigned and keyed on the cloud name; only uploads and the sign endpoint use these credentials.
   Rotate in the Cloudinary console → Settings → API Keys, then update `.env.local` and the Vercel
   environment (`ENVIRONMENT.md` §5.2 lists which variables Vercel needs).

3. **GitHub Actions has still never executed a step.** Every run across every workflow reports
   `runner_id: 0`, an empty `runner_name`, a two-second created→completed span and 404 logs —
   including the 6 runs on `main`. Adding a payment method did not change it. Every gate CI would
   run has been run locally instead, and the results are in this file, but "CI is green" is not a
   claim anyone can currently make about this repository.

### Carried, and unblocked

- **The per-role RBAC e2e matrix** — 7 `test.fixme` in `media-upload.spec.ts`, 4 in
  `studio-access.spec.ts`, 8 in `higgsfield-tracker.spec.ts`. All need an authenticated Supabase
  session, which is now reachable; nobody has taken them.
- **The Studio shell's visual baselines**, and **`dashboard_card_order`**, which still has no
  writer.

**None outstanding for Phase 02.**

**Owner decisions — RESOLVED 2026-09-08**, recorded as CANONICAL-DECISIONS amendment A3:

| Question | Decision |
|---|---|
| Does `Place Order` survive the no-checkout rule? | **Renamed.** It is not seeded at all. The action is `Send an Enquiry`; the handoff is `Discuss on WhatsApp`. |
| Is a newsletter in scope? | **Yes, build it.** Double opt-in; `newsletter_subscribers` in Phase 03; capture, consent, confirmation and unsubscribe in Phase 09. |

**New open question, and it blocks part of Phase 09:** no email service provider exists in
CANONICAL D1. The newsletter can capture an address and can never send to it, so the
confirmation email — the thing that makes double opt-in mean anything — cannot ship until one
is chosen. Adding Resend, Postmark, SES or Mailchimp is a new production dependency and needs
its own amendment, so it is the owner's call rather than a default taken here. Phase 09 can
build capture, consent, confirmation-token handling and unsubscribe without it.

Two smaller questions from Phase 01 remain: whether to bless `/studio/content/pages/global` as
the CTA library's reserved page id or add a D4 route leaf, and whether `analytics` stays a tab
on `/studio` rather than a route segment.

## Next Exact Action

**Start Phase 16 — Collections / Exhibitions**, or run the owner-side actions below.

Phase 16 assumes a public shell that composes CMS blocks (10), a finished block vocabulary (11–13),
a catalogue it can filter by collection (14) and a product page to link into (15). All four exist.
Nothing in the repository blocks it.

The owner-side list has SHRUNK since Phase 14 — two of its five items are done:

1. ~~Apply the migrations to hosted.~~ **Done.** Hosted is at `0132` and fingerprint-matches local.
2. ~~`npm run media:migrate:higgsfield`.~~ **Done.** All 250 assets are in Cloudinary (231 new, 19
   adopted, 0 failed) and `media_assets` holds 250 rows locally and on hosted, verified by two
   independent fingerprints.
3. **`npm run seed:content` against hosted**, then publish in Studio. The content itself is already
   replayed and fingerprint-matched across all seven tables; what remains is the owner deciding what
   to publish.
4. **Enter the first products.** Still the one thing on this list no command can do:
   `/studio/catalog/products/new`, as `owner`, `admin` or `merchandiser`. Nothing seeds a product
   and nothing imports one. The readiness checklist on each names exactly what is missing — and the
   Specifications item can be satisfied by saying a piece publishes none, so it never asks anyone to
   invent a measurement.
5. **Rotate the six exposed secrets** — still outstanding, and still recorded under *Known Issues*.
   The owner asked for this to wait until all phase work is finished.

### Superseded — the Phase 15 plan

**Start Phase 15 — Product Detail Experience**, or run the owner-side actions, which are now five
phases old and have grown by one.

Phase 15 is the phase that makes a product card a link: it builds `/product/[slug]`, the gallery with
its media roles, the specification table and the eleventh readiness item. Nothing in the repository
blocks it.

The owner-side list, in the order of what each unlocks:

1. **Apply `0120`–`0122` to hosted.** The repository is at `0122`; `ccvarsmzickdkryoakdg` is at
   `0080`. Until they are applied, the deployed preview's `products` table has no `price_minor`, no
   `availability_state`, no `edition_state` and no concept-media trigger — so the catalogue routes
   would fail there even with content. `npm run db:migrate -- --apply --allow-remote` from a machine
   that can reach the session pooler, or the Supabase MCP server as `0050`–`0080` were applied.
2. **`npm run media:migrate:higgsfield`**, which still closes the visual-baseline and Lighthouse
   gaps for every page built so far.
3. **`npm run seed:content` against hosted**, then publish in Studio.
4. **Enter the first products.** This is the one thing on this list no command can do:
   `/studio/catalog/products/new`, as `owner`, `admin` or `merchandiser`. Nothing seeds a product,
   nothing imports one, and the checklist on each product names exactly what is still missing before
   it can be published.
5. **Rotate the six exposed secrets** — still outstanding, and still recorded under *Known Issues*.

### Superseded — the Phase 14 plan

**Start Phase 14 — Product Catalog**, or run the owner-side actions, which are now four phases old.

`npm run media:migrate:higgsfield` still closes the visual-baseline and Lighthouse gaps for every
page built so far. Phase 14 is the first phase that needs something else from the owner as well:
`products` has no rows and no seed will ever add any.

### Superseded — the Phase 13 plan

**Start Phase 13 — Large Format Experience**, or run the owner-side actions below, which still
unblock more than any code change can.

The two measurement gaps Phase 11 opened are now two phases old, and both close the moment
`npm run media:migrate:higgsfield` runs: no media means no visual baseline worth taking and no
Lighthouse number worth recording. After that, `npm run seed:content` against hosted, then publish
in Studio.

### Superseded — the Phase 12 plan

**Start Phase 12 — the remaining page compositions**, or run the two owner-side actions below,
which unblock more than any code change can.

Nothing in the repository is waiting on a decision. Phase 11 left two things measured-not-yet
(`PERFORMANCE.md` §8's LCP/CLS/INP for `/`, and a visual baseline), and both need media before the
number would mean anything. In order of what they unlock:

1. **`npm run media:migrate:higgsfield`** from a machine whose network reaches Cloudinary. It has
   never run; `media_assets` is empty on both databases; every image on every page is a fallback
   well until it does. Then bind the homepage's families in `content/seed/media-bindings.ts` — the
   Phase 11 document's media table names every family and asset id — re-seed, and the first
   Lighthouse run is worth taking.
2. **`npm run seed:content` against hosted.** The schema is current at 28 migrations; the content
   has only ever been written to the local cluster, so the deployed preview renders a wordless
   shell and 404s every CMS route.

Then publish. In `/studio/content/pages`, take a page's sections DRAFT → REVIEW → APPROVED →
PUBLISHED; the route turns 200 the moment one section is live. Twenty-eight of the fifty-three need
nothing but the workflow; the other twenty-five are refused with RV002 until the owner verifies the
claim they make.

### Superseded — the Phase 11 plan

**Start Phase 11 — Homepage + Material Experience.** The shell is built and every route answers
404, so the next phase is the one that gives the homepage something to say: ten of its thirteen
seeded sections have block types with no renderer (amendment A8), which is what stands between the
copy in the database and a page a visitor can read.

The first increment is the four Tier-2 blocks the homepage needs most — `manifesto`,
`selected-works`, `material-story` and `final-cta` — added to `components/sections/registry.ts`
against the modules `lib/cms/registry.ts` already declares. Nothing about the shell, the routing or
the data layer changes: `renderCmsPage` maps a `block_type` to a renderer and returns null for the
ones that have none, so each renderer added is one more section that appears.

**One owner-side action would make the site visible today, and it is not a code change.** In
`/studio/content/pages`, take a page's sections DRAFT → REVIEW → APPROVED → PUBLISHED; the route
turns 200 the moment one section is live. The 25 flagged sections need verification first — the
database refuses them with RV002 until the claim they make is confirmed — but the other 28 do not.
The "On site" column added this phase links straight to the result, in draft mode when the page is
not published.

### Superseded — the Phase 10 plan

**Start Phase 10 — Public Website Foundation.** Everything it needs exists and nothing renders:
`lib/cms/resolve.ts` is the single read path, `lib/cms/media.ts` hydrates a page's assets in one
query, `components/sections/` renders six block types, and 231 records of real copy are in the
database. What is missing is `app/(site)/[[...path]]` — a route that calls `resolvePage`, hydrates,
and renders `SectionList`. The first increment is the homepage and `/about`, which between them
exercise the hero, statement, category-grid and process-steps renderers.

*Built, with one deviation:* thirteen route files rather than a catch-all segment. A
`[[...path]]` route would also swallow `/product/x` and every other future path — resolving there,
finding no `pages` row and answering 404, instead of failing when a later phase forgets to add the
route. One file per D3 path keeps the map in the file system, and a test asserts they agree.

### Superseded — the Phase 09 plan

**Start Phase 09 — Initial Content Seed.** The engine is built and empty; Phase 09 writes the copy
into it. Nothing in Phase 09 is blocked by the two owner-side items below, and both should happen
alongside it rather than before it:

- `npm run seed:content` against hosted, which puts the route shells and the five global strings
  there. Phase 09's own modules extend the same runner, so doing this first means each later run is
  an increment rather than a first import.
- Verifying the 250 Higgsfield assets. Phase 09 can write and review every section without it;
  what it cannot do is PUBLISH one that binds an asset, because RV006 refuses. So the copy can be
  written, reviewed and approved in parallel, and the site goes live when the verification does.

Phase 09's first increment is the section modules for `/` and `/about`: `content/seed/sections/`,
one module per page, each record carrying its own `fact_classification` and — where it asserts
business capability — `OWNER_VERIFICATION_REQUIRED`, which is what makes D10 a schema rule here
rather than a review convention.

### Still outstanding from Phase 07

**Run the Higgsfield migration.** In this order relative to Phase 09 it no longer blocks: the CMS
binds assets by id, and `computeGaps()` already reports which slots the manifest could fill, so
sections can be written against slots whose assets have not landed yet.

#### The migration command (owner-side, ~20 minutes)

This cannot run in the sandbox: the proxy refuses CONNECT to `api.cloudinary.com` and to
`d8j0ntlcm91z4.cloudfront.net`, which is where the source files live. On a local machine with
`.env.local` present:

First add the two missing credentials to `.env.local` — the script refuses to start without them
and names them:

```
CLOUDINARY_API_KEY=...        # Cloudinary console → Settings → API Keys
CLOUDINARY_API_SECRET=...
```

Then:

```bash
npm run media:migrate:higgsfield -- --dry-run     # expect: attempted 250, migrated 0, skipped 0, failed 0
npm run media:migrate:higgsfield -- --limit=5     # a small real run first; check Cloudinary
npm run media:migrate:higgsfield                  # expect: migrated 245, failed 0
npm run media:migrate:higgsfield                  # expect: skipped 250, migrated 0
```

The script loads `.env.local` itself, so no `export` is needed — but an exported variable still
wins over the file, so a `DATABASE_URL` pointing at a local cluster is respected.

Then verification steps 5 and 6 from `PHASE-05-09.md` §07, and commit
`data/higgsfield/migration-log.json` — it is the resume mechanism and it belongs in git.

If an upload fails, the run records the failure per asset with its message, continues, and exits
non-zero. Re-running resumes from the ledger; nothing already uploaded is paid for twice.

### 2. Then Phase 08 — CMS / Editable Content System

Read `docs/project/phases/PHASE-05-09.md` §PHASE 08. Four things it inherits, each established
rather than guessed:

1. **`media_usages.slot_key` carries the registry key from `content/media-slots.ts` verbatim** —
   `home.hero.video`, not `media`. Repeating slots take the index form `key[0]`…`[3]`, which
   `slotKeyOf()` strips. This is a contract Phase 08 must honour or the Gaps tab silently reports
   everything as unbound; the reasoning is in `MEDIA_GUIDE.md` §6 and the header of
   `lib/media/gaps.ts`.
2. **Publishing promotes media explicitly.** §07's *Asset status on migration* specifies it: when
   a `page_sections` row goes `PUBLISHED`, every `APPROVED` asset reached through its
   `media_usages` rows is promoted in the same transaction, with an `activity_events` row each.
   An asset in `DRAFT`, `REVIEW` or `ARCHIVED` refuses the publish and the error names its
   `rivya_asset_id`. Unpublishing does **not** demote — an asset may serve several sections.
3. **The 250 land as `APPROVED`, never `PUBLISHED`.** Anon `SELECT` on `media_assets` requires
   `PUBLISHED` (D5), so without rule 2 Phase 09 would seed sections whose media is unreadable by
   the public and Phase 10 would render a missing image with no error anywhere.
4. **Studio copy still lives in `components/studio/strings.ts`.** Every entry declares the
   `global_content` key it becomes; Phase 08 creates that table and Phase 09 seeds it, at which
   point `t()` reads a request-scoped map and no call site changes.

Carried from Phase 05 and still open — both unblocked by the reachable Supabase project, so
whichever phase gets there first should take them: the per-role RBAC e2e matrix (7 `test.fixme`
cases in `media-upload.spec.ts`, 4 in `studio-access.spec.ts`, 8 in `higgsfield-tracker.spec.ts`),
the shell's visual baselines, and `dashboard_card_order`, which still has no writer.

## Relevant Documentation

`docs/project/phases/PHASE-00-04.md` §PHASE 02 · `docs/design/DESIGN_SYSTEM.md` ·
`docs/design/COMPONENT_REGISTRY.md` · `docs/architecture/CANONICAL-DECISIONS.md` D1/D2/D6

## Environment Requirements

Node 22, npm 10. **TypeScript is pinned to 6.0.3 and ESLint to 9.x** — the reasons are in
`eslint.config.mjs`; do not bump either without reading them. Playwright uses the image's
pre-installed Chromium via `PLAYWRIGHT_CHROMIUM_PATH`; do not run `playwright install`.
No Supabase or Cloudinary credentials are set; Phase 02 needs none.

## Migration Requirements

`supabase/migrations/0001`–`0012` exist and apply cleanly to an empty database, **and to one laid
out the way a hosted Supabase project is** (`npm run db:check-hosted-layout` — added after the
Phase 03 set was found to be un-appliable to a real project).

**APPLIED, 2026-09-08.** All fifteen migrations (`0001`–`0022`) are on the hosted project
`ccvarsmzickdkryoakdg`, PostgreSQL **17.6**. The Supabase MCP server reached it where ordinary
egress could not, so neither the `db-migrate.yml` workflow nor a GitHub runner was needed.

The hosted schema was compared to the local one field by field and every count matches: 14 tables,
14 with RLS, 55 policies, 63 indexes, 194 columns, 18 check constraints, 9 triggers, 7 functions.
That is PostgreSQL 17 matching a PostgreSQL 16.13 local cluster exactly.

**RLS was verified on the real project**, with a baseline that makes the zeros mean something —
two products (one PUBLISHED, one DRAFT) and one audit row seeded as the table owner, then read back
per role, then rolled back:

| | owner | anon | authenticated non-staff |
|---|---|---|---|
| `products` | 2 | 1 (PUBLISHED only) | 1 |
| `audit_logs` · `staff_profiles` · `activity_events` · `content_seed_runs` | seeded | 0 | 0 |

That closes **Phase 04 verification step 8** and the database half of **Phase 05's** gap.

`public.schema_migrations` is populated with the repository's own checksums, so
`npm run db:migrate` reports "0 pending" rather than trying to re-apply.

After a successful apply, still to run against the project: `npm run seed:content` and
`npm run auth:check-rls`.

Note `supabase/local/00-auth-shim.sql` is applied by `db:reset` and is LOCAL ONLY — it stands in for
roles, grants and `auth.uid()` that Supabase provisions itself. Applying it to a hosted project would
be wrong; it lives outside `supabase/migrations/` so `supabase db push` cannot pick it up.

Phase 14 must **drop and recreate** (not extend) `products_price_state_coherent`,
`products_listing_idx` and `products_facets_idx` — reasons in `0006_catalog.sql` and
`0008_indexes.sql`.
