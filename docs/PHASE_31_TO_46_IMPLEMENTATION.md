# Phases 31 → 46 — implementation record

> Owned by the block that runs Phases 31–46 (amendment A31 adds this path to D7). One section per
> phase, in the field set the owner specified. Status vocabulary: `NOT STARTED` · `IN PROGRESS` ·
> `COMPLETED` · `BLOCKED`. Where a phase ships behind a flag that is off, the status says so.
>
> Companion: `docs/ASSET_GENERATION_PROMPTS.md` — every asset a phase needs and cannot make from
> the 250-asset manifest, as a prompt the owner runs and a Cloudinary URL the owner pastes back.

## Owner decisions this block runs under

| # | Decision | Where it bites |
|---|---|---|
| 1 | One PR per phase, merged into `main` after CI is green | every phase |
| 2 | One Supabase project (`ccvarsmzickdkryoakdg`); no staging project | Phase 44 |
| 3 | Competitor images are referenced by URL only and never fetched | Phase 33 ships its first-party half; the competitive hashing amendment is closed as declined |
| 4 | The Phase 35 product bridge ships behind `research_product_bridge = false` | Phase 35 |
| 5 | An owner-authorised demo catalogue (`is_demo`) of 30+ products, articles, FAQs, with ChatGPT prompts for their imagery; AI product imagery is labelled a concept visualisation, never presented as a photograph | Phase 35b, Phase 43 |

## Things only the owner can do (surfaced here, never blocked on)

- Set Vercel environment variables — the Vercel MCP exposes no write tool. Names, types and
  environments are in `docs/ops/ENVIRONMENT.md` §5.2 and `.env.example`; Phase 38's environment
  page reports what is reachable.
- Create the first owner user on the hosted project (`auth.users` is empty), disable public sign-up.
- Paste each generated image's Cloudinary URL into `docs/ASSET_GENERATION_PROMPTS.md`.

---

## Phase 31 — Analytics + Comparison

**Status:** COMPLETED

### Objective
The research corpus becomes measurable. Three analyses — assortment, price architecture,
dimensions — each returning a coverage record (`n`, denominator, percentage, exclusions by reason)
beside its result; named comparison sets recomputed on demand with a stored snapshot history; a
per-source coverage panel on the dashboard. Evidence, not opinion.

### Requirements Found
`docs/project/phases/PHASE-31-38.md` §Phase 31 (scope, four tables, deliverables, risks,
verification 1–12, exit criteria); `DATA_MODEL.md` §12 row 31 (`0290`–`0292`); STUDIO_GUIDE §12.8.

### Implementation Completed
- Pure modules: `lib/scraper/analytics/{rows,bands,price-architecture,dimensions,assortment}.ts`;
  `coverage.ts` extended with the coverage record, its Zod schema, the seven-reason vocabulary,
  `SAMPLE_FLOOR = 12` and the `n + Σexcluded = denominator` identity.
- Workflow: `lib/scraper/workflows/analytics.ts` (`snapshotScope`, `computeFamilies`,
  `resolveSetScope`) — the one place a snapshot is produced; splits by currency before pricing.
- Repository + schemas: `lib/supabase/repositories/research/analytics.ts`,
  `lib/supabase/schemas/research-analytics.ts`.
- Studio: `/studio/research/compare` (list + create), `/compare/[setId]` (members, recompute,
  four panels, settings, delete behind ConfirmDialog), `SourceCoveragePanel` on the dashboard.
- Charts: `components/patterns/{BarSeries,BandStrip,Scatter,Sparkline}` + `charts/shared.tsx`.
- CLI `npm run research:analytics` (`--scope`, `--snapshot`, `--dry-run`); cron
  `app/api/cron/research-analytics` at 02:30 UTC (`CRON_SECRET`).

### Files Added
`supabase/migrations/0290_phase31_research_analytics.sql`, `0291_phase31_research_analytics_rls.sql`
(generated), `0292_phase31_analytics_indexes.sql`; `lib/scraper/analytics/{rows,bands,price-architecture,dimensions,assortment}.ts`;
`lib/scraper/workflows/analytics.ts`; `lib/supabase/repositories/research/analytics.ts`;
`lib/supabase/schemas/research-analytics.ts`; `components/patterns/charts/shared.tsx`;
`components/patterns/{BarSeries,BandStrip,Scatter,Sparkline}/index.tsx`;
`components/studio/research/{CoverageBadge,ComparisonBuilder,AnalysisPanels,SourceCoveragePanel,DeleteSetButton}.tsx`;
`app/(studio)/studio/(shell)/research/compare/actions.ts`, `compare/[setId]/page.tsx`;
`app/api/cron/research-analytics/route.ts`; `scripts/research/analytics.ts`;
`tests/unit/analytics-{coverage,price,dimensions,assortment,cli}.test.ts`, `tests/unit/analytics-fixture.ts`;
`tests/unit/rls/phase31.test.ts`; `tests/e2e/research-compare.spec.ts`; this file.

### Files Modified
`lib/scraper/analytics/coverage.ts`; `app/(studio)/studio/(shell)/research/compare/page.tsx`
(stub → list); `app/(studio)/studio/(shell)/research/dashboard/page.tsx`; `components/studio/strings.ts`
(47 keys); `lib/auth/table-permissions.ts`; `scripts/auth/gen-role-sql.ts`; `scripts/db/check-schema.mjs`;
`lib/logging/activity.ts` (`research.comparison.recomputed`); `eslint.config.mjs` (two
service-role importers allowlisted); `package.json`; `vercel.json`; `docs/design/COMPONENT_REGISTRY.md`
(RC-316 built, RC-318–325 added); `docs/architecture/{SCRAPER,DATA_MODEL,CANONICAL-DECISIONS}.md`;
`docs/studio/STUDIO_GUIDE.md`; `CHANGELOG.md`; `PROJECT_STATE.md`; `docs/SESSION-STATE.md`.

### Database Changes
Four tables, one IMMUTABLE predicate function, one SECURITY DEFINER trigger, five indexes, 10
policies. `coverage_pct` generated. No enum change. I1 allowlist unchanged at two entries.

### Supabase Changes
`0290`–`0292` applied to `ccvarsmzickdkryoakdg` through the MCP with ledger rows carrying the
local files' SHA-256 (85 ledger rows on both). Structure digest over 103 objects:
`9acc01582bfdada9d66d76252f60c3af` on both databases. Security advisor: nothing new for the phase.
No storage, auth or edge-function change.

### Environment Variables
None new. `CRON_SECRET` (existing) authenticates the new cron route.

### GitHub Actions Changes
None. `ci.yml` runs the new suites through the existing unit and RLS steps.

### Tests Performed
`npm run check` (all gates); unit project 154 files / 2,497 tests; RLS project 24 files / 545 tests
with `RLS_TESTS_REQUIRED=1` against the migrated and seeded local database; production build
through `scripts/db/local-rest.mjs`; `security:check-bundle`. E2E `research-compare.spec.ts`
anonymous half runs everywhere; the signed-in half is guarded by `STUDIO_STORAGE_STATE`.

### Issues Found
- `z.record(z.enum(...))` is exhaustive in Zod 4; the coverage schema needed `z.partialRecord`.
- A quantile edge at the minimum defines an empty band; edges at or below the minimum are skipped.
- A `CHECK` may not contain a subquery; the ascending-edges rule became an IMMUTABLE function.
- `scope_id` cannot carry a foreign key (three targets); deleting a set left orphan snapshots until
  the prune trigger was added.
- The registry gate resolves patterns at `components/patterns/<Name>/index.tsx` only; the phase
  document's `charts/` folder would have failed it (amendment A31).

### Issues Fixed
All five above.

### Build Status
Green — `next build` against the seeded local database through PostgREST; bundle secret check clean.

### Deployment Status
Merged to `main`; Vercel builds from `main`. The cron entry appears in `vercel.json`; it needs
`CRON_SECRET` present in Production (already required by the two existing crons).

### Commit
See the PR for this phase (`feat(phase-31)`); hash recorded in the final summary.

### Remaining Notes
- The hosted corpus is empty (no approved source), so every panel renders its empty state on
  production until the owner approves a source.
- Verification steps 3–9 of the phase document (the 140-row fixture) were exercised against the
  unit fixtures and the local database, never against hosted.

---

## Phase 32 — Opportunity Engine

**Status:** NOT STARTED

## Phase 33 — Visual Similarity (first-party half)

**Status:** NOT STARTED

## Phase 34 — Product Direction Tool

**Status:** NOT STARTED

## Phase 35 — Shortlist + Confirmation

**Status:** NOT STARTED

## Phase 35b — Demo catalogue + image prompt book

**Status:** NOT STARTED

## Phase 36 — Google Sheets

**Status:** NOT STARTED

## Phase 37 — Studio Analytics

**Status:** NOT STARTED

## Phase 38 — Environment + Documentation + Logs

**Status:** NOT STARTED

## Phase 39 — SEO

**Status:** NOT STARTED

## Phase 40 — Performance

**Status:** NOT STARTED

## Phase 41 — Accessibility + Security

**Status:** NOT STARTED

## Phase 42 — Comprehensive Testing

**Status:** NOT STARTED

## Phase 43 — Media Coverage + Higgsfield Finalization

**Status:** NOT STARTED

## Phase 44 — Vercel Deployment

**Status:** NOT STARTED

## Phase 45 — Final Creative Polish

**Status:** NOT STARTED

## Phase 46 — Documentation + Handoff

**Status:** NOT STARTED
