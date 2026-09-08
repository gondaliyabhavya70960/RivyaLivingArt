# PROJECT_STATE — what is actually built

> Verified against the repository, not against intent. Update at the end of every phase.
> Last verified: Phase 03.

## Summary

The design system is built, and the database spine now exists and has been verified against a
real PostgreSQL. What exists: the toolchain, the token layer, 32 primitives, 2 motion helpers,
7 behavioural patterns, a dev-only gallery, ten tables with RLS on and no policy yet, generated
types with a drift gate, a repository layer with Zod at its boundary, an idempotent seed runner
proved not to overwrite an owner's edit, and ten gates that fail the build on the mistakes they
were written for. What does not: any product page, any RLS policy, any media delivery.

## Phase status

| Phase | Title | Status | Evidence |
|---|---|---|---|
| 00 | Repository Audit & Baseline | **COMPLETE** | Audit performed on an empty repo (single initial commit, README only). Requirements captured to `docs/requirements/`. `.gitignore` added. |
| 01 | PRD, Architecture & Documentation | **COMPLETE** | `docs/architecture/CANONICAL-DECISIONS.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `SCRAPER.md`; `docs/project/PRD.md`, `BUSINESS_RULES.md`, `ROADMAP.md`, `phases/`; `docs/ops/*`; session-recovery file set. |
| 02 | Reference UI Audit + Design System | **COMPLETE** | Toolchain, token layer, 32 primitives, 2 motion helpers, 7 behavioural patterns, dev gallery, 5 gates. 282 unit tests, 104 e2e across the 8 QA widths, 16 visual baselines. |
| 03 | Supabase Database + Data Layer | **COMPLETE** | Migrations `0001`-`0008` applied and verified against PostgreSQL 16.13. 10 tables, 6 enums, 2 functions, 24 indexes, RLS on everywhere with no policy. Generated types + drift gate, 6 repositories, Zod schemas, seed runner proved idempotent and owner-edit-safe. 5 new gates, 35 new tests. |
| 04 | Supabase Auth + RBAC + RLS | **PLANNED** | Specified in `docs/project/phases/PHASE-00-04.md`. |
| 05 | Studio Foundation | **PLANNED** | — |
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

No product page under `app/(site)` or `app/(studio)` beyond the dev-only gallery, no CMS block
renderer, no `supabase/migrations/`, no media delivery. No Supabase project or Cloudinary
account is connected — none of the environment variables in CANONICAL-DECISIONS.md D8 are set
in this environment.

**CI cannot run.** GitHub Actions has not provisioned a runner for any workflow run: each fails
in 2-5 seconds with `runner_id: 0` and zero steps executed. The full sequence passes locally
from a clean `npm ci`. This is an account-level condition and needs the owner.

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
- 329 unit tests across 44 files. All thirteen gates pass locally.

## Known risks carried forward

1. **The migration set has never been applied to the hosted Supabase project**, only to a local
   cluster, because this sandbox cannot reach `*.supabase.co`. The first application needs a
   machine with ordinary egress, and until it happens the hosted schema is empty.
2. **The pasted Supabase secrets are still unrotated.** The service-role key, secret key, JWT
   secret and database password were exposed in a chat transcript on 2026-09-08. Treat them as
   compromised until rotated.
3. Every seeded statement about fabrication capability is unverified and carries
   `OWNER_VERIFICATION_REQUIRED`. The site cannot publish those claims until the owner confirms.
4. Competitor scraping (Phases 25–35) needs a per-source legal/ToS review before any source is
   enabled; the plan records the requirement but the review itself is an owner decision.
