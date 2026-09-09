# PROJECT_STATE — what is actually built

> Verified against the repository, not against intent. Update at the end of every phase.
> Last verified: Phase 15 (Product Detail Experience), 2026-09-09.

## Summary

The design system is built; the database spine exists, carries RLS policies for all six roles, and
has been verified against a real PostgreSQL **and against the hosted Supabase project**. What
exists: the toolchain, the token layer, 32 primitives, 3 motion helpers, 7 behavioural patterns, a
dev-only gallery, **twenty-three tables, all with RLS on, and 90 policies**, generated types with a
drift gate, a repository layer with Zod at its boundary, an idempotent seed runner proved not to
overwrite an owner's edit, the Studio shell with its ⌘K palette and user management, the media
layer end to end, the Higgsfield migration, gap engine and tracker, **the CMS engine — pages,
blocks, the status workflow, media binding, scheduling, revisions and the Studio surfaces that
drive them** — a forward-only migration runner, and **28 gates** that fail the build on the
mistakes they were written for, the newest of which counts the client islands a route ships.

**A page can now be built and rendered, and the copy is written.** `/studio/content/pages/[pageId]`
adds, edits, reorders and removes blocks; `lib/cms/resolve.ts` is the single server read path;
`components/sections/` renders six of the twenty-eight catalogue blocks. A test takes rows out of a
real PostgreSQL, parses them with the repository's own schemas and renders the page, so the chain
from column to markup is proved end to end and not only in fixtures.

**The public website exists.** `app/(site)/` carries a shell — skip link, announcement, header with
a keyboard-complete mega menu, `<main id="main">`, footer — and thirteen route files, one per D3
static path. Every string in that chrome is a `navigation_items`, `global_content` or
`contact-details` row; `npm run cms:check-copy` fails the build on a literal. Twelve routes build
static and are invalidated by `app/api/revalidate`; `/search` is dynamic because its query is its
state. Verified on a production build against a local PostgREST: `/process` 404 → publish its
sections → POST to the endpoint → 200, with `sitemap.xml` gaining exactly that path.

**The content seed is applied.** 20 pages, 53 sections, 10 FAQs, 47 navigation items, 9 SEO
entries and the global string library — 231 records, every one from the specification verbatim, 22
more authored and deferred to Phases 18 and 19. `docs/content/INITIAL_CONTENT_INVENTORY.md` audits
all 332 of them, generated from the database.

**The homepage is a composition.** Sixteen of the twenty-eight blocks are built — Phase 11 added
the ten the homepage needed — and all thirteen SEED §10 sections render from the CMS in seeded
order. Verified on a production build against a local PostgREST, with the sections walked to their
launch-day state: eleven publish, two are refused by the publish gate because the claim IS the
section, all fifteen entry-level withholdings are absent from the page, and the five sections around
them still render. 171.7 kB of gzipped client JavaScript, five client islands, no horizontal
overflow at any of the eight QA widths.

What does not exist: **a page a visitor can read**, and the reason is unchanged. Every route
renders, and every one answers 404, because Phase 09 seeds all 53 sections `DRAFT` and
`renderCmsPage` refuses to serve a published route with nothing on it — SEED §55, as code.
Publishing is an editorial act in Studio, and 25 of those sections cannot be published at all until
the owner verifies what they claim. Twelve of the twenty-eight blocks are still declared and
unbuilt (amendment A8); a block with repeating items is edited as JSON until a repeater is built. No
product rows, and there will be none from a seed — `products` is not a member of the
`SeedableTable` union. **No media**: `media_assets` is empty until the Higgsfield migration runs, so
every image on every page is the SEED §47 fallback well and no visual baseline of a page is worth
taking yet.

**80 seeded rows await owner verification** and cannot be published until it is given — every FAQ
answer, every process step, and every sentence that asserts what Rivya can physically make.
`cms_publish_section` refuses them with RV002. That is D10 as a schema rule.

**The media migration has RUN.** All 250 Higgsfield assets are in Cloudinary — 231 uploaded, 19
adopted from an earlier partial run, 0 failed — and `media_assets` holds 250 rows on the local
cluster and on hosted, verified by two independent fingerprints (structural and full-text) that
matched exactly. Fidelity was checked against the plan before any database write: the id set matches
the manifest exactly, no id was invented, no `rivya_asset_id` or `generation_id` drifted, and all 26
videos carry a duration.

**What still blocks the site going live is owner-side and is one thing, not two.** Every one of
those assets is APPROVED *and* `OWNER_VERIFICATION_REQUIRED`, so `cms_publish_section` refuses
(RV006) any section that binds one until the owner verifies it. Recorded in *Remaining Work*.

**The hosted project is level with the repository.** Every migration through
`0132_phase15_specifications_omitted.sql` is applied to `ccvarsmzickdkryoakdg` and recorded in
`public.schema_migrations` with the runner's own SHA-256, so `db:migrate` treats them as applied
rather than pending. Phase 14's `0120`–`0122` and Phase 15's `0130`–`0132` were applied through the
Supabase MCP server — this sandbox cannot reach the pooler — and each set was then verified against
local by fingerprint rather than assumed: column hash, constraint definitions, policy expressions,
index definitions, trigger names, enum values and the `is_valid_dimensions` function body all match,
and the function refuses `{"length_inches": 90}`, a zero, a negative, a string value and an array
identically on both.

Hosted content has been replayed and fingerprint-matched across all seven content tables.
`content_seed_runs` is deliberately EMPTY there: copying the local audit row would assert a seed run
that never happened on that database.

`0050`–`0055` and `0070`–`0071` were applied through the Supabase MCP server rather than by
`npm run db:migrate`, because the workflow that runs it lives on GitHub Actions, which has never
executed a step on this repository, and this sandbox's proxy refuses a Postgres connection to the
pooler. The ledger rows carry the same per-file SHA-256 the runner computes, so a run from a
machine that can reach the database sees them as applied and unedited.

Verified after applying, not assumed: `deferred_count` present, ten `content_seed_version` indexes,
`set_owner_edited` running as SECURITY DEFINER, and `BRAND` in the group constraint.

`0050`–`0055` were applied through the Supabase MCP server rather than by `npm run db:migrate`,
because the workflow that runs it lives on GitHub Actions, which has never executed a step on this
repository, and this sandbox's proxy refuses a Postgres connection to the pooler. The ledger rows
carry the same SHA-256 of each FILE that `scripts/db/migrate.mjs` computes, so a future run from a
machine that can reach the database sees them as applied and unedited rather than re-applying them.

**Verified after applying, not assumed from six success replies.** Hosted reports 7 CMS tables, all
with RLS on, 90 policies (identical to local), 6 `cms_*` functions, 8 triggers on `page_sections`,
and `page_sections_media_needs_slot_key` present. The only difference between the two schemas is
`public.schema_migrations` itself, which `db:reset` does not create locally.

**Hosted carries no content yet.** The whole seed — 231 records — has been applied locally only.
It is one command from a machine that can reach the database: `npm run seed:content`.
Hand-inserting those rows here would have written them without the `seed_content_hash` the runner
uses to tell its own writes from an owner's edit, which would make every future run skip them
permanently. The schema is ready for them; nothing else is needed.

**GitHub Actions has still never executed a step** on this repository — 57 runs, every one dead in
2–3 seconds with a 404 on its logs, unchanged after a payment method was added. Vercel builds the
same commits successfully, which isolates the fault to Actions at the account layer. Every figure
in this document is from a local run.

## Phase status

| Phase | Title | Status | Evidence |
|---|---|---|---|
| 00 | Repository Audit & Baseline | **COMPLETE** | Audit performed on an empty repo (single initial commit, README only). Requirements captured to `docs/requirements/`. `.gitignore` added. |
| 01 | PRD, Architecture & Documentation | **COMPLETE** | `docs/architecture/CANONICAL-DECISIONS.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `SCRAPER.md`; `docs/project/PRD.md`, `BUSINESS_RULES.md`, `ROADMAP.md`, `phases/`; `docs/ops/*`; session-recovery file set. |
| 02 | Reference UI Audit + Design System | **COMPLETE** | Toolchain, token layer, 32 primitives, 2 motion helpers, 7 behavioural patterns, dev gallery, 5 gates. 282 unit tests, 104 e2e across the 8 QA widths, 16 visual baselines. |
| 03 | Supabase Database + Data Layer | **COMPLETE** | Migrations `0001`-`0008` applied and verified against PostgreSQL 16.13. 10 tables, 6 enums, 2 functions, 24 indexes, RLS on everywhere with no policy. Generated types + drift gate, 6 repositories, Zod schemas, seed runner proved idempotent and owner-edit-safe. 5 new gates, 35 new tests. |
| 04 | Supabase Auth + RBAC + RLS | **SUBSTANTIALLY COMPLETE** | Migrations `0009`-`0012`, 51 RLS policies across 12 tables, the permission matrix as generator input, Studio login/sign-out/user-management, 6 new gates. **10 of 11 verification steps pass** against a real PostgreSQL; step 8 (audit trail end to end) and the authenticated half of step 6 need a reachable Supabase project — both are `test.fixme` in the spec, not omitted. |
| 05 | Studio Foundation | **SUBSTANTIALLY COMPLETE** | The D4 route map as one manifest (58 leaves + `/studio`), the shell and top bar, the Overview with all three tabs, migrations `0020`/`0021`, 15 Studio primitives, the ⌘K palette with its provider registry and search endpoint, per-user chrome. 8 of 10 D9 points; the two gaps are the per-role e2e matrix and the shell's visual baselines, both needing a reachable Supabase project. |
| 06 | Cloudinary Media Architecture | **COMPLETE** | `MediaProvider` behind `getMediaProvider()`, with a build gate proving `lib/media/providers/cloudinary.ts` is the only SDK importer. Migrations `0022`/`0030`/`0031` applied to both databases. Six presets and the srcSet ladder matching `CLOUDINARY.md` §5. `app/api/media/sign` with five gates before the signature. `MediaImage` + `MediaVideo` (RC-232/233, both BUILT). Six Media Manager sections from one component. **All three canaries uploaded to the live account**, which is how the `g_auto` defect was found. 5 new gates, 656 unit tests. The §8 rate limit is Phase 41's table and is not enforced; `/studio/media/higgsfield` is Phase 07's. |
| 07 | Higgsfield Asset Audit + Initial Asset Plan | **CODE COMPLETE; MIGRATION NOT RUN** | The migration script, its committed ledger, migrations `0040`/`0041` on both databases, the 26-slot registry and `computeGaps()`, the tracker at `/studio/media/higgsfield` with all thirteen FEAT §34 columns and six filters, a read-only drawer with no regenerate control, and two guards wired into CI and `npm run check` — the regeneration guard verified to FAIL on a planted `WALL-ART-001` brief, and the status-document generator verified idempotent. 733 tests, no skips. **What is missing is the run itself**: `higgsfield_migration_runs` holds 0 rows on both databases and the 250 assets are still on the Higgsfield CDN. Proxy-blocked here; see `docs/SESSION-STATE.md` → *Next Exact Action*. |
| 08 | CMS / Editable Content System | **COMPLETE** | Migrations `0050`–`0055` on both databases. The status trigger, revision writer, `sync_media_usages`, four `cms_*` SECURITY DEFINER functions, the block registry with 28 declared types, six built renderers, the Studio content surfaces, the preview route and the schedule cron. Amendments A7/A8. |
| 09 | Initial Website Content Seed | **COMPLETE** | Migration `0070`/`0071`, 15 seed modules, 231 records applied locally and 22 authored-and-deferred, the four-outcome runner contract, and `INITIAL_CONTENT_INVENTORY.md` generated from the database — 332 rows, 80 awaiting verification. Hosted carries none of it yet. |
| 10 | Public Website Foundation | **COMPLETE** | `app/(site)/` with the shell and thirteen route files, `renderCmsPage`, `MediaSlot`, the metadata/robots/sitemap/revalidate plumbing, the WhatsApp module and its usage gate. Verified against a local PostgREST on a production build; amendments A9/A10. |
| 11 | Homepage + Material Experience | **CODE COMPLETE; NOT MEASURED** | Ten new renderers (16 of 28 blocks built), entry-level owner verification, the three reference selectors and their editorial fallback, `HeroMotion` and `MaterialSequence`, the island-budget gate, the homepage JSON-LD. 8 e2e specs across 8 widths, 924 unit tests. Amendments A11/A12. **What is not done is the measurement**: LCP, CLS and INP are unmeasured because there is no media to measure, and `tests/e2e/homepage.visual.spec.ts` is deferred for the same reason. |
| 12 | About + Process | **CODE COMPLETE; NOT MEASURED** | `scale-statement` built (17 of 28 blocks), the `/process` chapter layout with positional numbering, `ChapterMedia` (RC-216) loaded on demand, the Studio verification banner and its nine seeded notes. 933 unit tests; `about.spec.ts` and `process.spec.ts` green at 1440 and 390 with zero serious axe violations. Both pages verified against a live database in their launch state — `/about` renders three of five sections, `/process` its hero — and `/process` was walked through a three-chapter state to prove the renumbering. Visual baselines deferred for the same reason as Phase 11: there is no media. |
| 13 | Large Format Experience | **CODE COMPLETE; NOT MEASURED** | `category-intro`, `category-list` and `customization-note` built (20 of 28 blocks), `lib/site/resolve-target.ts` and the live-path set on `getSiteChrome`, entry-level marks on three of the six groupings. 942 unit tests; `large-format.spec.ts` green at 1440 and 390. Verified against a live database: 4 of 5 sections publish, exactly the three confirmed groupings render, and both CTAs are dropped while `/custom-commissions` has nothing published — then reappear when it does. Visual baselines deferred; there is still no media. |
| 14 | Product Catalog | **CODE COMPLETE; CATALOGUE EMPTY BY DESIGN** | Migrations `0120`–`0122` (local only — hosted is still at `0080`). `lib/catalog/{query,price,validation,labels,rail,listing}`, `catalog-listing` and `catalog-admin` repositories, `/collection` and `/collection/[category]`, patterns RC-217/223/234/237, and the Studio catalogue editor with the FEAT §22 checklist. 1000 unit assertions including 17 database guards against a real PostgreSQL; `collection.spec.ts`, `collection-empty.spec.ts` and `catalog-studio.spec.ts` green at 1440, the filter/sort/pagination assertions all with JavaScript disabled. Verified against a live database in both states: three products with the four price states render their own labels and only two of them a number, 33 products paginate at 24 with correct `rel` and canonical links, then the catalogue was emptied and all seven category pages render SEED §27 with zero `[data-product-card]`. **The authenticated Studio half is `test.fixme`**, as in Phases 04 and 05, for the same reason: no reachable auth server. |
| 15–46 | Product detail, Studio, research, ops, launch | **PLANNED** | Specified in `docs/project/phases/`. |

## What exists on disk

```
CLAUDE.md · CONTEXT.md · PROJECT_STATE.md · CHANGELOG.md · README.md
data/higgsfield/asset-manifest.json      250 assets, machine-readable
data/higgsfield/raw/{images,videos}.json raw generation history
scripts/media/build-higgsfield-manifest.py   deterministic classifier
scripts/media/check-asset-ids.py             gap-ID collision guard
scripts/media/migrate-higgsfield.ts          the 250-asset migration (never run)
scripts/media/assert-no-regeneration.ts      the regeneration guard
scripts/media/build-asset-status.ts          writes HIGGSFIELD_ASSET_STATUS.md §3-§4
content/media-slots.ts                       26 declared CMS media slots
content/asset-purposes.ts                    the §2.1 purpose vocabulary
lib/media/{manifest,migration,gaps,inventory}.ts
data/higgsfield/migration-log.json           the resume ledger (absent until the first run)
docs/requirements/                       the two governing specifications
docs/architecture/ docs/design/ docs/studio/ docs/media/ docs/content/ docs/ops/ docs/project/
docs/SESSION-STATE.md
```

## What does NOT exist yet

Eight of the twenty-eight blocks have no renderer; the eight are listed as `null` in
`components/sections/registry.ts` and the two registries are asserted to agree, so a block cannot be
forgotten, only explicitly declared unbuilt.

`/product/[slug]` EXISTS as of Phase 15, and a product card is a link. What it does not have is
anything to render: see the paragraph below.

**`products` holds zero rows, and that is the finished state of Phases 14 and 15, not a gap.** A
product exists because an owner types one into `/studio/catalog/products/new` (SEED §32); nothing
seeds one, nothing imports one, and `tests/e2e/collection-empty.spec.ts` counts `[data-product-card]`
elements on all seven category pages to keep it that way. Phase 15's three e2e specs skip for the
same reason, and say so rather than passing silently.

Phase 15 closed two of the five gaps this paragraph used to list: the product DETAIL surface and the
gallery editor with media roles both exist, along with the Specifications and Related editors. What
the catalogue is still missing is the relationship ENGINE (Phase 23 — the editor exists, the
suggestions do not), the customization form builder (Phase 19), the 3D viewer (Phase 21) and bulk
import (Phase 24) — every one of which has a stub route with a real permission check rather than a
dead link.

The Studio shell EXISTS but most leaves below `/studio` are stubs: a real route with a real
permission check and a notice naming the phase that will fill it, which is what stops navigation
dead-ending — except `/studio/media/higgsfield` (Phase 07), the content surfaces (Phase 08) and the
catalogue (Phases 14–15). Every migration is applied to BOTH the local cluster and the hosted
project. Hosted now carries content as well, replayed and fingerprint-matched; what it does not
carry is anything PUBLISHED, so the deployed preview renders a wordless shell and 404s every CMS
route until
`npm run seed:content` runs against it.

**CI still cannot run — no run has ever executed a step.** Each job is created with its
`ubuntu-latest` label intact and dies 2-3 seconds later, unassigned: no `runner_id`, no steps, no
logs. Every run since has the identical signature, **including after a payment method was added to the
account**, so the payment method alone did not resolve it. Vercel builds and deploys the same
commits from the same branch successfully, which isolates the fault to Actions rather than to the
code. The
full gate sequence passes locally from a clean `npm ci`; this is an account-level condition and
only the owner can see the page that explains it.

The consequence is not only that gates go unverified remotely. `.github/workflows/db-migrate.yml`
exists to apply migrations to hosted Supabase **from a runner**, because a runner has the outbound
network access this sandbox lacks. Until Actions provisions a runner, that route is unavailable
too, and the hosted project cannot be migrated from here by any means.

## Verified facts

- Higgsfield workspace `ec502e11-f7e3-42e6-b11b-cca2088dbd9c` holds **224 images and 26 videos**,
  all completed, across 163 distinct prompt families.
- Aspect ratio coverage: 16:9 (121), 4:5 (50), 3:4 (21), 9:16 (16), 3:2 (16), 1:1 (13), 21:9 (9),
  4:3 (4) — desktop, portrait editorial and mobile-hero crops are all present.
- Node 22.22.2 / npm 10.9.7 available; npm registry reachable.
- The manifest regenerates byte-identically from the raw history; all 250 asset IDs and Cloudinary
  public IDs are unique (asserted by the generator); the gap-ID collision guard passes across
  31 documents.
- All 47 phases (00–46) are documented, each carrying all 12 required headings.
- Migrations `0001`-`0008` apply cleanly to an empty PostgreSQL 16.13 database; all ten tables
  have `relrowsecurity = true` and zero policies; `price_state` holds exactly
  `STARTING_FROM REQUEST_QUOTE PRICE_ON_REQUEST`; the type generator produces byte-identical
  output across runs.
- The seed runner inserts 7 rows on a fresh database, updates 7 and inserts 0 on a second run,
  and after an owner edits one row reports 1 `skipped_owner_edited` with that row's value intact.
  Publishing a row and re-seeding does not un-publish it.
- **733 unit and RLS tests** across 63 files, none skipped, with a local PostgreSQL 16.13 cluster
  reachable. All **twenty** gates pass locally. E2E: Studio access 13 passed / 4 `test.fixme`, the
  Higgsfield tracker 6 passed / 8 `test.fixme` (all needing a real Supabase session), and 104
  assertions across the eight FEAT §45 widths.
- **`computeGaps()` reproduces the phase document's own gap table** from the manifest: 13 coverable
  slots, 2 thin families, 11 gaps — including every page PHASE-05-09 §07 predicted (`/`,
  `/collection`, `/collection/furniture`, `/collection/collectible-design`,
  `/custom-commissions`, `/contact`, `/faq`) — plus one finding the document did not name,
  `gallery-scene`: 5 assets that no declared surface can use.
- **Both Phase 07 guards were proved to bite, not merely to pass.** `assert-no-regeneration.ts`
  exits 1 on a planted brief for `WALL-ART-001`, naming the asset and the folder it already
  occupies; `build-asset-status.ts` produces no diff on a second run.
- The navigation manifest is proved equal to D4 and to the filesystem: `tests/unit/studio-nav.test.ts`
  parses the route block out of `CANONICAL-DECISIONS.md` rather than transcribing it, so editing the
  contract fails the test. Both failure directions were provoked and confirmed.
- **Three defects were found by tests rather than by review** while building Phase 05, all of the
  same shape — code that looked right and quietly asserted something false: the environment badge
  rendered "Development" from an ABSENT variable; a test selecting "the first form" silently changed
  its subject when a control was added above it; and the command palette opened with focus on its
  close button, so ⌘K could not be typed into.
- `scripts/db/migrate.mjs` was verified against a real PostgreSQL: 12 migrations applied from
  empty, a second run is a no-op, a migration edited after being applied is refused, a deliberately
  broken migration left no ledger row and no leaked table, and the connection password appears in
  no output.
- `proxy.ts` is registered by Next — the production build reports `Proxy (Middleware)` in its
  route table — and all four refusals in `security:check-proxy` were verified by breaking the
  file four ways.

## Known risks carried forward

1. ~~The migration set has never been applied to the hosted Supabase project.~~ **RESOLVED
   2026-09-08.** All fifteen migrations are applied to `ccvarsmzickdkryoakdg` (PostgreSQL 17.6),
   verified field-by-field against the local schema, with RLS confirmed per role on the real
   project. Reached through the Supabase MCP server; ordinary egress to `*.supabase.co` is still
   blocked, and GitHub Actions still cannot provision a runner, so `db-migrate.yml` remains built
   and undispatched.
2. **Six pasted secrets are still unrotated.** The Supabase service-role key, secret key, JWT
   secret and database password, plus the Cloudinary API key and API secret, were exposed in chat
   transcripts on 2026-09-08. Treat all six as compromised until rotated; `docs/SESSION-STATE.md`
   carries the list and what each one grants. Names only are recorded — no value, prefix or length
   is written anywhere in this repository.
3. **The Higgsfield migration has never executed.** The planner, ledger and row mapping are
   exercised over all 250 real manifest rows — but with a fake uploader, and a fake uploader
   cannot 400. Phase 06 is the precedent worth remembering: 23 URL-builder tests passed while
   every video URL would have been rejected by Cloudinary, and a 20 MB PNG failed an upload cap
   no test knew about. Run `--limit=5` before the full 250.
4. **`media_usages.slot_key` must carry the registry key** from `content/media-slots.ts`
   verbatim. Nothing enforces it — the database requires only non-blank — so a Phase 08 trigger
   writing the old short form (`media`, `card.3`) will make the Gaps tab report every slot as
   unbound, silently and plausibly.
5. Every seeded statement about fabrication capability is unverified and carries
   `OWNER_VERIFICATION_REQUIRED`. The site cannot publish those claims until the owner confirms.
6. Competitor scraping (Phases 25–35) needs a per-source legal/ToS review before any source is
   enabled; the plan records the requirement but the review itself is an owner decision.
