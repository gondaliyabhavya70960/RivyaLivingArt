# PROJECT_STATE — what is actually built

> Verified against the repository, not against intent. Update at the end of every phase.
> Last verified: Phase 07 (Higgsfield Asset Audit + Initial Asset Plan), 2026-09-08.

## Summary

The design system is built; the database spine exists, carries RLS policies for all six roles, and
has been verified against a real PostgreSQL **and against the hosted Supabase project**. What
exists: the toolchain, the token layer, 32 primitives, 3 motion helpers, 7 behavioural patterns, a
dev-only gallery, **sixteen tables, all with RLS on, and 59 policies**, generated types with a
drift gate, a repository layer with Zod at its boundary, an idempotent seed runner proved not to
overwrite an owner's edit, the Studio shell with its ⌘K palette and user management, the **media
layer end to end** — provider seam, signed uploads, the two render patterns and the six-section
Media Manager — **the Higgsfield migration, gap engine and tracker**, a forward-only migration
runner, and **20 gates** that fail the build on the mistakes they were written for.

What does not exist: any product page, any CMS, and no content bound to a media slot. The Media
Manager can upload and list; nothing on the public site renders from it yet, because no public page
exists to render. **And the 250 Higgsfield assets are still on the Higgsfield CDN** — the migration
that moves them is written and tested but has never executed, because this sandbox's proxy refuses
CONNECT to both Cloudinary and the CDN origin. That is the one owner-side step Phase 07 needs.

**The hosted project is current.** All 19 migrations are applied to `ccvarsmzickdkryoakdg` and
recorded in `public.schema_migrations` with checksums; the latest is
`0041_rls_policies_phase07.sql`.

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
| 08 | CMS / Editable Content System | **PLANNED** | — |
| 09 | Initial Website Content Seed | **PLANNED** | `docs/content/INITIAL_CONTENT_INVENTORY.md` maps every field to a Studio control; no seed modules written. |
| 10–46 | Public site, Studio, research, ops, launch | **PLANNED** | Specified in `docs/project/phases/`. |

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

No product page under `app/(site)`, no CMS block renderer, no media delivery. The Studio shell
EXISTS but every leaf below `/studio` is a stub: a real route with a real permission check and a
notice naming the phase that will fill it, which is what stops navigation dead-ending — except
`/studio/media/higgsfield`, which Phase 07 filled. All 19 migrations are applied to BOTH the local
cluster and the hosted project; the earlier claim that the hosted schema was empty was true only
until 2026-09-08.

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
