# PROJECT_STATE — what is actually built

> Verified against the repository, not against intent. Update at the end of every phase.
> Last verified: Phase 01.

## Summary

The repository is at **planning baseline**. There is no application code yet: no `package.json`,
no Next.js app, no Supabase project wired, no Cloudinary migration. What exists is the
specification-of-record, the binding architecture contract, the complete phase plan, and a
real, machine-readable inventory of the 250 Higgsfield assets the build will consume.

## Phase status

| Phase | Title | Status | Evidence |
|---|---|---|---|
| 00 | Repository Audit & Baseline | **COMPLETE** | Audit performed on an empty repo (single initial commit, README only). Requirements captured to `docs/requirements/`. `.gitignore` added. |
| 01 | PRD, Architecture & Documentation | **COMPLETE** | `docs/architecture/CANONICAL-DECISIONS.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `SCRAPER.md`; `docs/project/PRD.md`, `BUSINESS_RULES.md`, `ROADMAP.md`, `phases/`; `docs/ops/*`; session-recovery file set. |
| 02 | Reference UI Audit + Design System | **PLANNED** | `docs/design/DESIGN_SYSTEM.md` + `COMPONENT_REGISTRY.md` specify it; no tokens or components implemented. |
| 03 | Supabase Database + Data Layer | **PLANNED** | `docs/architecture/DATA_MODEL.md` specifies the schema; no migrations written. |
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

No `package.json`, no `app/`, no `components/`, no `lib/`, no `supabase/migrations/`, no tests,
no CI, no deployment. No Supabase project or Cloudinary account is connected — none of the
environment variables in CANONICAL-DECISIONS.md D8 are set in this environment.

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

## Known risks carried forward

1. No Supabase or Cloudinary credentials in this environment — Phases 03 and 06 cannot be
   executed until the owner provisions them.
2. Every seeded statement about fabrication capability is unverified and carries
   `OWNER_VERIFICATION_REQUIRED`. The site cannot publish those claims until the owner confirms.
3. Competitor scraping (Phases 25–35) needs a per-source legal/ToS review before any source is
   enabled; the plan records the requirement but the review itself is an owner decision.
