# PROJECT_STATE — what is actually built

> Verified against the repository, not against intent. Update at the end of every phase.
> Last verified: Phase 05 (Studio Foundation), 2026-09-08.

## Summary

The design system is built; the database spine exists, carries RLS policies for all six roles,
and has been verified against a real PostgreSQL. What exists: the toolchain, the token layer,
32 primitives, 2 motion helpers, 7 behavioural patterns, a dev-only gallery, **twelve tables with
RLS on and 51 policies**, generated types with a drift gate, a repository layer with Zod at its
boundary, an idempotent seed runner proved not to overwrite an owner's edit, the Studio's auth
surfaces (`proxy.ts`, login, sign-out, user management), a forward-only migration runner, and
**19 gates** that fail the build on the mistakes they were written for.

What does not exist: any product page, any media delivery, any Studio shell beyond the two pages
above — and **nothing has ever been applied to the hosted Supabase project.**

## Phase status

| Phase | Title | Status | Evidence |
|---|---|---|---|
| 00 | Repository Audit & Baseline | **COMPLETE** | Audit performed on an empty repo (single initial commit, README only). Requirements captured to `docs/requirements/`. `.gitignore` added. |
| 01 | PRD, Architecture & Documentation | **COMPLETE** | `docs/architecture/CANONICAL-DECISIONS.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `SCRAPER.md`; `docs/project/PRD.md`, `BUSINESS_RULES.md`, `ROADMAP.md`, `phases/`; `docs/ops/*`; session-recovery file set. |
| 02 | Reference UI Audit + Design System | **COMPLETE** | Toolchain, token layer, 32 primitives, 2 motion helpers, 7 behavioural patterns, dev gallery, 5 gates. 282 unit tests, 104 e2e across the 8 QA widths, 16 visual baselines. |
| 03 | Supabase Database + Data Layer | **COMPLETE** | Migrations `0001`-`0008` applied and verified against PostgreSQL 16.13. 10 tables, 6 enums, 2 functions, 24 indexes, RLS on everywhere with no policy. Generated types + drift gate, 6 repositories, Zod schemas, seed runner proved idempotent and owner-edit-safe. 5 new gates, 35 new tests. |
| 04 | Supabase Auth + RBAC + RLS | **SUBSTANTIALLY COMPLETE** | Migrations `0009`-`0012`, 51 RLS policies across 12 tables, the permission matrix as generator input, Studio login/sign-out/user-management, 6 new gates. **10 of 11 verification steps pass** against a real PostgreSQL; step 8 (audit trail end to end) and the authenticated half of step 6 need a reachable Supabase project — both are `test.fixme` in the spec, not omitted. |
| 05 | Studio Foundation | **SUBSTANTIALLY COMPLETE** | The D4 route map as one manifest (58 leaves + `/studio`), the shell and top bar, the Overview with all three tabs, migrations `0020`/`0021`, 15 Studio primitives, the ⌘K palette with its provider registry and search endpoint, per-user chrome. 8 of 10 D9 points; the two gaps are the per-role e2e matrix and the shell's visual baselines, both needing a reachable Supabase project. |
| 06 | Cloudinary Media Architecture | **PLANNED** | `docs/media/CLOUDINARY.md` specifies folders and the migration runbook. |
| 07 | Higgsfield Asset Audit + Initial Asset Plan | **PARTIAL** | **Audit half is done**: 250 assets inventoried and classified in `data/higgsfield/asset-manifest.json` by `scripts/media/build-higgsfield-manifest.py   deterministic classifier
scripts/media/check-asset-ids.py             gap-ID collision guard`. The Cloudinary migration and the Studio tracker remain. |
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
docs/requirements/                       the two governing specifications
docs/architecture/ docs/design/ docs/studio/ docs/media/ docs/content/ docs/ops/ docs/project/
docs/SESSION-STATE.md
```

## What does NOT exist yet

No product page under `app/(site)`, no CMS block renderer, no media delivery. The Studio shell
EXISTS but every leaf below `/studio` is a stub: a real route with a real permission check and a
notice naming the phase that will fill it, which is what stops navigation dead-ending. `supabase/migrations/0001`-`0012` DO exist and apply cleanly to a
local PostgreSQL — but **they have never been applied to the hosted Supabase project**, so the
hosted schema is still empty.

**CI still cannot run — 56 runs, none has ever executed a step.** Each job is created with its
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
- **555 unit and RLS tests** across 55 files, none skipped with `RLS_TESTS_REQUIRED=1`. All
  nineteen gates pass locally. E2E Studio access: 13 passed, 4 `test.fixme` (they need a real
  Supabase session) — and 104 assertions across all eight FEAT §45 widths.
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
2. **The pasted Supabase secrets are still unrotated.** The service-role key, secret key, JWT
   secret and database password were exposed in a chat transcript on 2026-09-08. Treat them as
   compromised until rotated.
3. Every seeded statement about fabrication capability is unverified and carries
   `OWNER_VERIFICATION_REQUIRED`. The site cannot publish those claims until the owner confirms.
4. Competitor scraping (Phases 25–35) needs a per-source legal/ToS review before any source is
   enabled; the plan records the requirement but the review itself is an owner decision.
