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

**Status:** COMPLETED

### Objective
A ranked view of where the market looks under-served, with the arithmetic on screen: a score is
the weighted mean of seven declared signals under a versioned model, every stored score keeps one
component row per signal, and the Explain drawer's footer reproduces the total from those rows.
No machine learning, no hidden term, no demand forecast.

### Requirements Found
`docs/project/phases/PHASE-31-38.md` §Phase 32 (scope, three tables, the immutability trigger
verbatim, the seven-signal table, the formula, the 24-cell `large_format_fit` ladder, verification
1–12, exit criteria); `DATA_MODEL.md` §12 row 32 (`0300`–`0302`); STUDIO_GUIDE §12.10; the
no-ML CI gate; the `research.score.manage` permission proposal.

### Implementation Completed
- Pure modules under `lib/scraper/analytics/opportunity/`: `model.ts` (Zod for the signal
  document, weights must sum to 100, `MODEL_V1`), `context.ts`, `completeness.ts` (six required
  fields), `score.ts` (the formula, once), `rank.ts` (rank movement, threshold 10) and seven
  signal modules under `signals/` with a shared `types.ts`.
- Workflow `lib/scraper/workflows/score.ts` (`scoreScope`, `explainRow`; refuses to store under a
  DRAFT) — the one place a score is produced.
- Repository `lib/supabase/repositories/research/opportunity.ts`: models CRUD and activation,
  service-role score writes, latest-score listing with filters, components, exclusion tallies, and
  `buildScoringContext()` reading `products` and `materials` by `select` only.
- Studio: `/studio/research/opportunities` (provenance header with model version and last run,
  stale badge, Scored and Insufficient-data tabs, filters in the URL, Explain drawer, exclusions
  panel, Recompute action) and the model panel for owner and admin (versions, weights beside the
  active model's, rank-movement diff, New draft, Activate behind the confirm dialog, audited).
- CLI `npm run research:score` (`--model`, `--source`, `--dry-run`, `--explain`); cron
  `app/api/cron/research-score` at 03:15 UTC (`CRON_SECRET`, `skipped: no_active_model` until a
  human activates one); gate `npm run research:check-no-ml` wired into `npm run check` and CI.
- Permission `research.score.manage` (owner, admin) in `lib/auth/permissions.ts`, the Phase 04
  matrix back-written, role SQL regenerated.

### Files Added
`supabase/migrations/0300_phase32_opportunity.sql`, `0301_phase32_opportunity_rls.sql` (generated),
`0302_phase32_model_v1.sql`; `lib/scraper/analytics/opportunity/**` (13 files);
`lib/scraper/workflows/score.ts`; `lib/supabase/repositories/research/opportunity.ts`;
`app/(studio)/studio/(shell)/research/opportunities/{page.tsx,actions.ts}`;
`components/studio/research/{ScoreExplain,ScoringModelPanel,ActivateModelButton}.tsx`;
`scripts/research/score.ts`, `scripts/research/check-no-ml.mjs`;
`app/api/cron/research-score/route.ts`; tests `tests/unit/opportunity-{fixture,signals.test,score.test,model.test,no-ml.test}.ts`,
`tests/unit/rls/phase32.test.ts`, `tests/e2e/research-opportunities.spec.ts`.

### Files Modified
`lib/auth/permissions.ts`, `lib/auth/permissions.test.ts` (count 31 → 32),
`lib/auth/table-permissions.ts`, `scripts/auth/gen-role-sql.ts`, `scripts/db/check-schema.mjs`,
`lib/supabase/database.types.ts`, `lib/logging/activity.ts`, `components/studio/strings.ts`,
`eslint.config.mjs` (admin-client allowlist), `package.json`, `vercel.json`,
`.github/workflows/ci.yml`, `docs/project/phases/PHASE-00-04.md`, `docs/architecture/{SCRAPER,DATA_MODEL,CANONICAL-DECISIONS}.md`,
`docs/studio/STUDIO_GUIDE.md`, `docs/design/COMPONENT_REGISTRY.md`, `CHANGELOG.md`,
`PROJECT_STATE.md`, `docs/SESSION-STATE.md`.

### Database Changes
Three tables, one trigger function (`freeze_active_scoring_model()`, verbatim), one partial unique
index for the single ACTIVE model, two score indexes, 14 CHECK constraints, 6 policies (models
read `research.read`, write `research.score.manage`; scores and components read only). v1 seeded
DRAFT under `allow-insert`. No enum change. I1 allowlist unchanged.

### Supabase Changes
`0300`–`0302` applied to `ccvarsmzickdkryoakdg` through the MCP with ledger rows carrying the
local files' SHA-256 (88 ledger rows on both). Parity digest by object kind: tables (88),
constraints (686), indexes (358), policies (282) and triggers (112) identical on both sides; the
48 Phase 32 constraints, indexes, policies and triggers identical; `freeze_active_scoring_model()`
identical. The function-kind digest differs only on 18 functions from Phases 05–27 whose hosted
copies were applied from comment-stripped SQL in earlier sessions (`rivya_slugify` checked line by
line: same statements, comments absent) — a text difference, not a behavioural one. Security
advisor: nothing new for the phase (the pre-existing SECURITY DEFINER warnings on the inquiry RPCs
are unchanged).

### Environment Variables
None new. `CRON_SECRET` (existing) authenticates the new cron route.

### GitHub Actions Changes
`ci.yml` gains the `research:check-no-ml` gate step (through `npm run check`). No new workflow.

### Tests Performed
`npm run check` (all gates, now including the no-ML gate); unit project 153 files / 2,507 tests;
RLS project with `RLS_TESTS_REQUIRED=1` against the migrated and seeded local database including
`phase32.test.ts` (8 cases); production build through `scripts/db/local-rest.mjs`;
`security:check-bundle`. E2E `research-opportunities.spec.ts` anonymous half runs everywhere; the
signed-in half is guarded by `STUDIO_STORAGE_STATE`.

### Issues Found
- The worked example's second case assumed `assortment_density` excluded for an unpriced row; the
  signal is included at the `(category, no band)` cell, so the expected raw is 73.33 → 73.
- Two RLS assertions matched the wrong CHECK because the fixture row tripped a stricter constraint
  first (`activation_is_dated`, `excluded_has_reason`); the fixtures now satisfy every other rule.
- `Date.now()` inside a Server Component render is rejected by the React compiler lint rule.
- The permission-count test pinned 31; the new permission makes it 32.
- `tests/unit/rls/phase22.test.ts` never loaded the fixture itself and passed or failed on the
  runner's file order (first on a fresh database, its seed found no fixture product). It now loads
  the fixture and releases the advisory lock like every other database suite.

### Issues Fixed
All five above.

### Build Status
Green — `next build` against the seeded local database through PostgREST; bundle secret check clean.

### Deployment Status
Merged to `main`; Vercel builds from `main`. The `research-score` cron entry appears in
`vercel.json`; it needs `CRON_SECRET` present in Production (already required).

### Commit
See the PR for this phase (`feat(phase-32)`); hash recorded in the final summary.

### Remaining Notes
- Model v1 is a DRAFT on production. Activation is an owner or admin decision on
  `/studio/research/opportunities`; until then the cron answers `skipped: no_active_model`.
- The corpus is empty (no approved source), so both tabs render their empty states on production.

## Phase 33 — Visual Similarity (first-party half)

**Status:** COMPLETED

### Objective
"Have we seen this picture before?" answered with 64-bit perceptual hashes and a Hamming distance,
never with a claim about the object. Under the owner's decision (competitor images are referenced
by URL only and never fetched — amendment A33) the machinery is turned inward: Rivya's own library
is hashed, a re-upload of one of its pictures is refused at the upload step by name, and the band
legend with its "does not mean" column sits above every result.

### Requirements Found
`docs/project/phases/PHASE-31-38.md` §Phase 33 (the fetch-to-hash amendment as open question 12,
the band table, blocking with a measured recall, the two hash tables on two sides of I1, the upload
guard before the insert, the 250-asset backfill with 224 pHashes and 26 checksums, the precision
rule, verification 1–14, exit criteria); `DATA_MODEL.md` §12 row 33; the owner's decision from the
planning session.

### Implementation Completed
- Pure modules `lib/scraper/analytics/similarity/{gray,dhash,phash,hamming,bands,blocking,index}.ts`:
  area-average resize, dHash (9×8), DCT pHash (32×32 → 8×8), Hamming, the band table as the single
  source (thresholds, "means", "does not mean", `PRECISION_NOT_YET_MEASURED`, an empty
  `MEASURED_PRECISION`), seven-segment blocking with NEAR_DUPLICATE recall 1.0 by construction.
- First-party: `lib/media/hashes.ts` (the one decoder module; video = checksum only),
  `lib/media/duplicate-guard.ts` (two injected reads, compared in TypeScript),
  `lib/media/library-check.ts` (the self-check), `originalUrl()` in `lib/media/url.ts`.
- Repositories `lib/supabase/repositories/media-hashes.ts` (first-party, imports no research
  module) and `lib/supabase/repositories/research/similarity.ts`; schemas
  `lib/supabase/schemas/similarity.ts`.
- The upload guard wired into `saveUploadedAssetAction` before the `media_assets` insert: fetch the
  original back, hash in memory, refuse a byte-identical file on either side or an image within six
  bits, destroy the Cloudinary object, audit DENIED naming the match; write the accepted asset's
  hash row.
- Studio `/studio/research/similarity`: decision and flags, `SimilarityLegend`, library coverage,
  `LibraryCheckPanel` (`research.similarity.run`), run history.
- CLI `npm run media:hash` (`--dry-run --limit --only`), `npm run research:similarity`
  (`--scope=corpus|source:<slug>|media --method --rehash --dry-run`),
  `npm run research:similarity-sample`; gate `npm run media:check-decoder` in `check` and CI;
  workflow `.github/workflows/media-hash.yml` (dispatch only).
- Flags `research_image_hashing` and `advanced_similarity` registered `false` with the decision in
  their descriptions; permission `research.similarity.run` (owner, admin, researcher).

### Files Added
`supabase/migrations/0310_phase33_similarity.sql`, `0311_phase33_media_hashes.sql`,
`0313_phase33_similarity_rls.sql` (generated); `lib/scraper/analytics/similarity/*` (7 files);
`lib/media/{hashes,duplicate-guard,library-check}.ts`; `lib/supabase/schemas/similarity.ts`;
`lib/supabase/repositories/media-hashes.ts`, `lib/supabase/repositories/research/similarity.ts`;
`app/(studio)/studio/(shell)/research/similarity/actions.ts`;
`components/studio/research/{SimilarityLegend,LibraryCheckPanel}.tsx`;
`scripts/media/{hash-media.ts,check-decoder-scope.mjs}`,
`scripts/research/{similarity,similarity-sample}.ts`; `.github/workflows/media-hash.yml`;
tests `tests/unit/similarity-{fixture,phash.test,bands.test,blocking.test,legend.test,decoder-scope.test}.ts*`,
`tests/unit/media-duplicate-guard.test.ts`, `tests/unit/rls/phase33.test.ts`,
`tests/e2e/research-similarity.spec.ts`.

### Files Modified
`app/(studio)/studio/(shell)/research/similarity/page.tsx` (stub → surface),
`app/(studio)/studio/(shell)/media/actions.ts`, `lib/media/url.ts`,
`lib/supabase/repositories/media.ts` (`checksum` on insert), `lib/scraper/analytics/similarity`
exports, `lib/auth/permissions.ts` (+ test count 33), `lib/auth/table-permissions.ts`,
`scripts/auth/gen-role-sql.ts`, `scripts/db/check-schema.mjs`, `lib/flags/flags.ts`,
`lib/supabase/database.types.ts`, `components/studio/strings.ts`, `eslint.config.mjs`,
`package.json`, `.github/workflows/ci.yml`, `tests/unit/extract-workflow.test.ts` (fixture column),
`docs/project/phases/PHASE-00-04.md`, `docs/architecture/{SCRAPER,DATA_MODEL,CANONICAL-DECISIONS}.md`,
`docs/studio/STUDIO_GUIDE.md`, `docs/media/MEDIA_GUIDE.md`, `docs/ops/{SECURITY,ENVIRONMENT}.md`,
`docs/design/COMPONENT_REGISTRY.md`, `CHANGELOG.md`, `PROJECT_STATE.md`, `docs/SESSION-STATE.md`.

### Database Changes
One enum, one column + CHECK on `research_sources`, five tables (four research, one first-party),
eleven indexes, 30 CHECK/unique constraints, 10 policies. No function, no trigger. I1 allowlist
unchanged at two entries; `media_asset_hashes → media_assets` is a first-party reference.

### Supabase Changes
`0310`, `0311`, `0313` applied to `ccvarsmzickdkryoakdg` through the MCP with ledger rows carrying
the local files' SHA-256 (91 ledger rows on both). Parity digest by object kind, identical on both
databases: tables 93 (`eb7e10ee…`), constraints 733 (`bac80966…`), indexes 376 (`59d21f37…`),
policies 292 (`017cb699…`), triggers 112 (`537c94b2…`), enums 34 (`a72caf60…`). Security advisor:
nothing new for the phase. `0312` not applied (unused). No storage, auth or edge-function change.

### Environment Variables
None new for the application. Three **repository secrets** for the dispatch-only backfill
workflow — `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` — documented in ENVIRONMENT §5.x; the owner sets them.

### GitHub Actions Changes
`ci.yml` gains the `media:check-decoder` gate step. New `media-hash.yml` (workflow_dispatch only:
`plan` lists the work and fetches nothing; `apply` hashes).

### Tests Performed
`npm run check` (all gates, now including `media:check-decoder`); unit project 159 files / 2,553
tests; RLS project 26 files / 566 tests with `RLS_TESTS_REQUIRED=1` against a fresh, seeded local
database, including `phase33.test.ts` (13 cases: five tables with RLS, I1 references, I2 no anon, the per-source
opt-in CHECK, who may read/open/dismiss, no session hash insert on either side, the pair CHECKs,
non-unique checksums, the media-scope CHECK, the video/image hash CHECK); production build
through the local PostgREST shim; `security:check-bundle`. E2E `research-similarity.spec.ts`
anonymous half runs everywhere; the signed-in half is guarded by `STUDIO_STORAGE_STATE`.

### Issues Found
- A 16-bit prefix bucket cannot meet the phase document's own ≥ 0.98 NEAR_DUPLICATE recall on
  uniformly placed bit flips (about 83 % of six-bit differences touch the prefix). Replaced by
  seven-segment blocking, recall 1.0 by the pigeonhole principle, measured against brute force.
- The document's "10 % centre crop ≤ 6" measures 8 on the synthetic fixture; the test records the
  measured figure (5 % → 2, 8 % → 4, 10 % → 8) instead of loosening the band.
- This container cannot reach `res.cloudinary.com` (proxy policy), so the 250-asset backfill
  cannot run here; built as a dispatch-only workflow for the owner.
- The guard's reads under the uploader's session would skip the research table for an editor;
  they run under the service role.
- The generated `research_sources` Row type gained a column, so one unit fixture needed it.

### Issues Fixed
All five above.

### Build Status
Green — `next build` against the seeded local database through PostgREST; bundle secret check clean.

### Deployment Status
Merged to `main`; Vercel builds from `main`. No cron. The backfill workflow awaits the owner's
dispatch with the three repository secrets.

### Commit
See the PR for this phase (`feat(phase-33)`); hash recorded in the final summary.

### Remaining Notes
- **Owner action:** set the three repository secrets and run `Media hash backfill (hosted)` in
  `plan` then `apply` mode. Expected result: `IMAGE 224 224 224`, `VIDEO 26 26 0`. Until then the
  Studio library panel shows coverage 0 of 250 and the upload guard compares against an empty
  Rivya hash table (it still refuses an exact re-upload of anything uploaded after this phase).
- No precision figure exists; `MEASURED_PRECISION` is empty and the Studio says so.
- The research-side tables hold no rows and will until the owner reverses A33.

## Phase 34 — Product Direction Tool

**Status:** COMPLETED

### Objective
Research becomes a written internal brief: nine prose sections a person writes, with the evidence
stapled to it by value, observed figures rendered with coverage and the observed-in-research label,
revisions with restore, approval as a recorded judgement — and no path to the catalogue.

### Requirements Found
`docs/project/phases/PHASE-31-38.md` §Phase 34 (the brief's sections, evidence capture by value,
observed-versus-intended, the four-status lifecycle, revisions, export, the checked slug and open
question 13, the import barrier, verification 1–11, exit criteria); `DATA_MODEL.md` §12 row 34;
STUDIO_GUIDE §12.11; BUSINESS_RULES §F.

### Implementation Completed
- Pure: `lib/scraper/analytics/direction/capture.ts` (seven capture schemas, `figuresFromSnapshotPayload`,
  `scoreDrift`, `snapshotDrift`), `export.ts` (Markdown render, `INTERNAL_DOCUMENT_HEADER`,
  `OBSERVED_LABEL`, `formatFigure`).
- Schema `lib/supabase/schemas/research-direction.ts` (four statuses, `.strict()` body input);
  repository `lib/supabase/repositories/research/direction.ts` (briefs, evidence, revisions, restore
  RPC, category counts, and every evidence-target read by `select` — no products import).
- Routes `/studio/research/opportunities/direction` (list, create) and `/[briefId]` (two-column
  editor; `?view=print` with `print.css`); `actions.ts` (create, save, attach, detach, status,
  restore); components `EvidenceRail`, `ObservedFigures`, `BriefStatusButton`.
- CLI `npm run research:direction-export -- --brief=<id> --format=md`.
- Gate: `scripts/research/direction-isolation.mjs` called under I4 by the isolation guard.
- Permissions `research.direction.write` (owner, admin, merchandiser, researcher) and
  `research.direction.approve` (owner, admin, merchandiser); activity action
  `research.direction.approved`.

### Files Added
`supabase/migrations/0320_phase34_direction_briefs.sql`, `0321_phase34_direction_rls.sql` (generated);
`lib/scraper/analytics/direction/{capture,export}.ts`; `lib/supabase/schemas/research-direction.ts`;
`lib/supabase/repositories/research/direction.ts`;
`app/(studio)/studio/(shell)/research/opportunities/direction/{page.tsx,actions.ts}`,
`.../direction/[briefId]/{page.tsx,print.css}`;
`components/studio/research/{EvidenceRail,ObservedFigures,BriefStatusButton}.tsx`;
`scripts/research/{direction-export.ts,direction-isolation.mjs,direction-isolation.d.mts}`;
tests `tests/unit/direction-{no-publish,isolation,evidence-capture}.test.ts`,
`tests/unit/rls/phase34.test.ts`, `tests/e2e/research-direction.spec.ts`.

### Files Modified
`lib/auth/permissions.ts` (+ test count 35), `lib/auth/table-permissions.ts`,
`scripts/auth/gen-role-sql.ts`, `scripts/db/check-schema.mjs`, `scripts/research/check-research-isolation.mjs`,
`lib/logging/activity.ts`, `lib/supabase/database.types.ts`, `components/studio/strings.ts`,
`package.json`, `docs/project/phases/PHASE-00-04.md`, `docs/architecture/{SCRAPER,DATA_MODEL,CANONICAL-DECISIONS}.md`,
`docs/studio/STUDIO_GUIDE.md`, `docs/project/BUSINESS_RULES.md`, `docs/design/COMPONENT_REGISTRY.md`,
`CHANGELOG.md`, `PROJECT_STATE.md`, `docs/SESSION-STATE.md`.

### Database Changes
Three tables, three functions (`write_direction_brief_revision()` SECURITY DEFINER,
`research_restore_brief_revision()` SECURITY DEFINER re-checking the write permission,
`guard_direction_brief_approval()`), three triggers, four indexes, 17 CHECK/unique constraints,
9 policies. No enum change. I1 allowlist unchanged at two entries.

### Supabase Changes
`0320`–`0321` applied to `ccvarsmzickdkryoakdg` through the MCP with ledger rows carrying the local
files' SHA-256 (93 ledger rows on both). Parity digest by object kind, identical on both databases:
tables 96 (`25b6fc42…`), constraints 760 (`36e7e8a5…`), indexes 386 (`75d84724…`), policies 300
(`69e7e0e6…`), triggers 115 (`11ae5647…`), enums 34 (`a72caf60…`). The three Phase 34 functions differ
in text only by the one `-- check-migrations: allow-insert` comment line inside
`write_direction_brief_revision()`, which the stripped hosted copy omits. Security advisor: one new
row, `research_restore_brief_revision` executable by `authenticated` as SECURITY DEFINER — by design:
it re-checks `research.direction.write` inside and refuses with `42501`, the same posture as Phase
08's restore. No storage, auth or edge-function change.

### Environment Variables
None new.

### GitHub Actions Changes
None. The direction↔products barrier runs inside the existing `research:check-isolation` step.

### Tests Performed
`npm run check` (all gates); unit project 162 files / 2,574 tests; RLS project 27 files / 575 tests
with `RLS_TESTS_REQUIRED=1` against a fresh, seeded local database, including `phase34.test.ts`
(9 cases: RLS on and no anon leg, I1, PUBLISHED / category / undated-approval CHECKs, viewer and
editor reads, researcher writes and is refused APPROVED, merchandiser approves with approver and
time, evidence CHECKs, revisions immutable and restore status-preserving, anon sees nothing);
production build through the local PostgREST shim; `security:check-bundle`. E2E
`research-direction.spec.ts` anonymous half runs everywhere; the signed-in half is guarded by
`STUDIO_STORAGE_STATE`.

### Issues Found
- The RLS harness rolls a session back at the end of its callback, so an assertion about a
  session's write must read inside the same callback; two cases were rewritten that way.
- The policy generator writes one predicate per leg, so the APPROVED gate is a trigger.
- Typed routes require a `Route` cast on a dynamic `href` and `redirect`, as the compare route does.
- The scratch root of the isolation test was shared between cases; each case now has its own.
- The Studio manifest test refuses a static page the manifest does not name, so the brief list is a
  research leaf (`Direction briefs`) rather than the phase document's nested segment (A34).

### Issues Fixed
All five above.

### Build Status
Green — `next build` against the seeded local database through PostgREST; bundle secret check clean.

### Deployment Status
Merged to `main`; Vercel builds from `main`. No cron.

### Commit
See the PR for this phase (`feat(phase-34)`); hash recorded in the final summary.

### Remaining Notes
- No brief exists until a person writes one; the list renders its empty state on production.
- Whether Rivya can produce anything a brief describes is `OWNER_VERIFICATION_REQUIRED`; the
  Studio wording says so on every brief.

## Phase 35 — Shortlist + Confirmation

**Status:** COMPLETED — reported **COMPLETE-WITH-FLAG-OFF**, as the phase document requires: the
bridge is built, proved to copy nothing, and switched off (`research_product_bridge = false`) until
the owner accepts amendment A35 by enabling the flag.

### Objective

Give the FEAT §23 pipeline its workspace and its gate: a record of why a row was shortlisted and by
whom, a mandatory decision note behind every confirmation, the two screens a merchandiser works in,
the stage-writer guard at the database, and the one hand-operated bridge from a confirmed research
row to an **empty** draft product — with no new stage, no enum change, no second transition log and
no second state machine.

### Requirements Found

`docs/project/phases/PHASE-31-38.md` §Phase 35 (the movement table, the two decision records, the
guard trigger verbatim, the bridge and its I4 reconciliation, the field-provenance test, the two
bulk operations, the two screens, 14 verification steps, 14 exit criteria), DATA_MODEL §12 row 35
(corrected: it said `ARCHIVED_DECISION` and a `research_pipeline_transitions` table; the phase
document wins — A35), PHASE-23-30 (seven stages, four dispositions, `stage.ts` the only writer).

### Implementation Completed

- **Migrations** `0330_phase35_shortlist_confirmation.sql` (two tables, the guard trigger verbatim,
  `research_write_stage()` SECURITY DEFINER for the service role only, RLS enabled) and
  `0331_phase35_rls.sql` (generated: `research.read` select, `research.confirm` insert/update, no
  anon leg). No `alter type` in either.
- **Stage machine** — `MOVEMENTS` (eight rows, cell for cell from the phase document), `movementFor`,
  `requireMovementReason`, `MovementReasonError`, `InvalidStageTransitionError` (= the Phase 25
  error), `isLegalMove` admits `MATCHED → SHORTLISTED`. `writeProductStage` /
  `writeProductDisposition` now call the RPC that carries the flag; `match.ts`'s two session-client
  disposition writes moved to the admin client.
- **Review actions** — Shortlist opens an entry (score captured from the newest opportunity score)
  and from CONFIRMED archives the decision and reopens; Confirm requires a decision note, admits only
  a shortlisted row (or a confirmed row whose decision was archived), records the confirmation as the
  person, closes the entry, logs `research.product.confirmed`; `returnToReview`; `archiveDecision`
  (audit row, no pipeline event).
- **Bulk** — `research.close_entry`, `research.archive_confirmation` (one audit row per row), and
  Phase 29's five rerouted through `moveStage` / `setDisposition` with their own `undoItem`
  (`research.confirm` now takes the decision note); `RESEARCH_BULK_CAP = 200` refused by name in
  `previewResearchBulkAction`; the two new surfaces in the redirect allowlist; the reason field for
  the four reason-bearing kinds.
- **Studio** — `/studio/research/shortlist` (open entries oldest first; score at entry with
  confidence; age; tags; reason; Confirm with note, Send back to review, Reject; source and
  "open longer than N days" filters; stale-60-days panel; `PipelineBulkBar`) and
  `/studio/research/confirmed` (research-decision label and Stands/Archived pill; note; confirming
  person; brief link; product-started link resolved by `resolveStartedProducts`; Archive and Reopen
  with reasons; `StartProductDialog`); the decision note on `RowActionBar`; the dashboard's
  stale-entry count; ~60 Studio strings and three seeded `STUDIO_HELP` rows including the
  acknowledgement.
- **The bridge** — `startProductFromConfirmation` in `confirmed/actions.ts`: flag, `catalog.write`,
  `getConfirmationForBridge` (`.strict()` `{ id, stage, archived_at }`), slug + category +
  acknowledgement `yes`, claim-first `markProductStarted` (conditional on nothing started),
  `insertProduct` of exactly five fields from `lib/scraper/workflows/bridge-draft.ts`, release on a
  failed insert, audit + activity rows.
- **Guards** — `scripts/research/bridge-isolation.mjs` (+ `.d.mts`) under I4: one writer file, the
  symbol defined there only, research imports limited to the reader and the two claim writers;
  `checkCreatedProductResolution()`; `check-no-autoimport.mjs` admits `insertProduct` in that file
  only.
- **Registries** — `PHASE_35_POLICIES`, table permissions, `gen-role-sql` preamble, check-schema
  tiers, flag `research_product_bridge`, activity actions `research.product.started` /
  `research.product.confirmed`, DATA_MODEL §12 row corrected, `lib/supabase/database.types.ts`.

### Files Added

`supabase/migrations/0330_phase35_shortlist_confirmation.sql`, `0331_phase35_rls.sql`;
`lib/supabase/schemas/research-shortlist.ts`; `lib/supabase/repositories/research/shortlist.ts`;
`lib/scraper/workflows/bridge-draft.ts`; `lib/bulk/operations/research/close-entry.ts`,
`archive-confirmation.ts`; `app/(studio)/studio/(shell)/research/confirmed/actions.ts`;
`components/studio/research/PipelineBulkBar.tsx`, `StartProductDialog.tsx`;
`scripts/research/bridge-isolation.mjs`, `bridge-isolation.d.mts`;
`tests/unit/pipeline-transitions.test.ts`, `confirmation-no-import.test.ts`,
`tests/unit/rls/phase35.test.ts`, `tests/e2e/research-shortlist-confirm.spec.ts`.

### Files Modified

`lib/scraper/core/stage.ts`, `lib/scraper/workflows/review-actions.ts`, `match.ts`;
`lib/supabase/repositories/research/products.ts`, `review.ts`; `lib/bulk/operations/research/
index.ts`, `lib/bulk/research-surface.ts`; `app/(studio)/studio/(shell)/research/{shortlist,
confirmed,dashboard}/page.tsx`, `changes/actions.ts`, `bulk-actions.ts`;
`components/studio/research/BulkToolbar.tsx`, `RowActionBar.tsx`, `components/studio/strings.ts`;
`content/seed/studio-help.ts`; `lib/auth/table-permissions.ts`, `lib/flags/flags.ts`,
`lib/logging/activity.ts`, `lib/supabase/database.types.ts`; `scripts/auth/gen-role-sql.ts`,
`scripts/db/check-schema.mjs`, `scripts/research/check-research-isolation.mjs`,
`check-no-autoimport.mjs`; `eslint.config.mjs`; tests `research-isolation`, `review-actions`,
`bulk-engine`, `research-selection`, `research-no-autoimport`, `rls/phase25`, `rls/phase29`;
docs SCRAPER §26, STUDIO_GUIDE §12.12–12.13, BUSINESS_RULES BR-F2, DATA_MODEL §11.ab + §12,
CANONICAL-DECISIONS A35, COMPONENT_REGISTRY RC-334/335, CHANGELOG, PROJECT_STATE, SESSION-STATE.

### Database Changes

Two tables, two functions, one trigger, six generated policies, four indexes. `research_stage`
still seven values, `research_disposition` four. No foreign key from `research_confirmations` to
`products`.

### Supabase Changes

`0330`–`0331` applied to `ccvarsmzickdkryoakdg` with comment-stripped SQL, ledger rows carrying the
local files' SHA-256, parity digest local vs hosted: 95 ledger rows on both; digests by object kind for the phase's objects identical on both databases — tables 2 (`7fd8d809…`), constraints 18 (`88855f4b…`), indexes 6 (`16d5b2e5…`), policies 6 (`cf91bc40…`), trigger 1 (`3c891a68…`), functions 2 (`3613bfb3…`, after `alter function … set search_path` on both sides and the ledger checksum updated to the final file). Security advisors: no new finding attributable to Phase 35 once `guard_research_stage_writer()` carries `set search_path` (added over the verbatim body for the `function_search_path_mutable` lint); the remaining WARN/INFO rows pre-date this phase (inquiry RPCs, `has_role`, `schema_migrations` RLS without policies).

### Environment Variables

None added.

### GitHub Actions Changes

None. `ci.yml` runs the new unit and RLS suites through the existing steps.

### Tests Performed

- `npm run check`: exit 0 (every gate green; the six pre-existing `no-html-link-for-pages` warnings only).
- Unit project (`npx vitest run --project unit`): 164 files, 2,601 tests, all passing.
- RLS project (`RLS_TESTS_REQUIRED=1`, local PostgreSQL 16 after `db:reset` + `seed:content`):
  28 files, 589 tests, all passing, including `phase35.test.ts` (12 cases: enums unchanged, RLS on, no anon leg, no key to
  products, the guard refuses bare `stage` and `disposition` updates, `research_write_stage()` is
  service-role only, entry and confirmation constraints, orthogonality, archival, the sentinel test
  at the database).
- Verification 3 (the guard-widening proof) performed by hand: adding `getLiveConfirmation` to the
  bridge file's research import fails `findBridgeViolations` naming the symbol; the
  `research-isolation` suite carries the same fixture permanently. The `.strict()` projection
  refuses a widened row in `confirmation-no-import`.
- Production build through the local PostgREST shim: exit 0 (Next.js 16.3.4, compiled and type-checked); `security:check-bundle`:
  clean — no service-role key name, role name or service_role JWT in `.next/static`.
- Playwright `research-shortlist-confirm.spec.ts`: written; the signed-in half is guarded by
  `STUDIO_STORAGE_STATE` and could not run in this container (no Studio session), as for every
  Studio spec since Phase 23.

### Issues Found

1. The stage-writer trigger's transaction-local flag cannot be set by `stage.ts` under PostgREST
   (no transaction handle) — resolved with `research_write_stage()`.
2. The bulk engine's generic snapshot restore writes `stage` directly and would be refused by the
   trigger — resolved with per-operation `undoItem`s through the machine.
3. Three existing RLS tests updated `stage`/`disposition` directly (`phase25`, `phase29`) — adapted.
4. `research-no-autoimport`'s "CONFIRM calls nothing else" assertion listed two calls; Phase 35's
   confirm makes ten, all research writes or reads — the allowlist was updated and a negative check
   for catalogue writes added.
5. The migration header said "contains no `alter type`", which the spec's `grep -c` would count —
   reworded.
6. `bridge-isolation.d.mts` needed `declare` for the lint parser.

### Issues Fixed

All six above. No open issue.

### Build Status

Green. `npm run check` exit 0; unit 164/2,601; RLS 28/589; production build exit 0; bundle clean.

### Deployment Status

Hosted schema level through `0331`. Vercel deploys from `main` on merge; the two screens render on
production once an owner user exists (hosted `auth.users` is still empty — Phase 44 checklist item 1).
The bridge is off on production by default (`feature_flags` row absent → off).

### Commit

See the PR for this phase (`feat(phase-35)`); hash recorded in the final summary.

### Remaining Notes

- **COMPLETE-WITH-FLAG-OFF.** Enabling `research_product_bridge` in `/studio/system/flags` is the
  owner's acceptance of amendment A35 (the I4 narrowing). Until then the button is disabled with the
  reason and a direct POST is refused.
- `stage-guard-trigger.test.ts` lives as a describe block inside `tests/unit/rls/phase35.test.ts`
  (it needs a database; the unit project is offline by gate).
- The spec's `PipelineBulkBar` wraps the Phase 29 toolbar rather than duplicating it; the "confirm
  dialog" it asks for is the engine's preview → typed-count → apply step.

## Phase 35b — Demo catalogue + image prompt book

**Status:** COMPLETED — the images themselves wait for the owner: every entry in the prompt book
reads `Cloudinary Status: WAITING_FOR_UPLOAD` until a URL is pasted in.

### Objective

Carry out owner decision 5: an owner-authorised placeholder catalogue of around thirty pieces that
suit the studio, with a ChatGPT prompt for each so the images can be made after launch; every demo
row present on the hosted project; and the same honesty rules the placeholders always had — no
price, dimension, material, lead time or claim, and AI imagery labelled a concept visualisation.

### Requirements Found

The owner's instruction (recorded verbatim in the plan and in amendment A36); CLAUDE.md and D10 on
fabricated business facts; `docs/content/DEMO_CONTENT.md` (the register the owner's authorisation
depends on); D6 (nothing in the manifest is regenerated; planned IDs never borrow a family prefix);
`HIGGSFIELD_GUIDE.md` §2 (the house prompt grammar, palette clause and `RIVYA-NEG-V2`); D7 as
amended by A31 (`docs/ASSET_GENERATION_PROMPTS.md` is a documented path).

### Implementation Completed

- **Thirty-five demo products** (`scripts/demo/content.ts`): the thirty from Phase 21 reviewed and
  kept; five added where a category was thin — `collectible-form-study-three`,
  `decor-catch-all-bowl`, `decor-bookends-pair`, `gift-ring-dish`, `gift-keepsake-box` — so every
  category holds at least four. All `is_demo`, `PRICE_ON_REQUEST`, `MADE_TO_ORDER`, no dimension,
  material, specification, lead time or claim (`tests/unit/demo-content.test.ts`, now 35 with a
  per-category floor).
- **`npm run demo:sql`** (`scripts/demo/build-sql.ts`): the seed — or the purge, `--purge` — as
  idempotent SQL for environments the seeder cannot connect to. Validated locally by purging and
  replaying twice (35 / 10 / 30 / 7 published / 6 / 6, unchanged on the second run).
- **Hosted seeded through the MCP** from that SQL: 35 products (20 before), 10 demo article pages
  with 30 sections (7 published, the 3 `OWNER_VERIFICATION_REQUIRED` articles hold their body in
  DRAFT), all 10 articles linked to a body, 6 DRAFT projects, 6 DRAFT testimonials; six categories
  published, `3d-resin` withheld by its own verification flag exactly as locally.
- **`docs/ASSET_GENERATION_PROMPTS.md`**: 45 entries — a 4:5 hero for every product
  (`PRODUCT-HERO-001…035`) and a 16:9 room scene for each of the ten furniture pieces
  (`PRODUCT-SCENE-001…010`) — each with Asset ID, name, required for, file type, minimum
  dimensions, ratio, filename, exact placement (`products.hero_media_id` on the slug, or a
  `product_media` gallery row; Cloudinary folder `rivya/product/<slug>`), purpose, the full prompt
  in the house grammar with the verbatim palette clause and `RIVYA-NEG-V2`, negative requirements,
  `Cloudinary Status: WAITING_FOR_UPLOAD`, `Cloudinary URL: TO_BE_PROVIDED`. Category heroes and
  journal covers are deliberately absent (the library binds them; D6); the Phase 43 gap briefs stay
  in the master plan.
- **Amendment A36** (proposed; the owner's instruction is the authority): a generated product image
  is a concept visualisation, registered `is_ai_generated = true, is_concept = true`, bound to a
  product only once Phase 43's `0411` and the seeded label exist; the intake path is Phase 43's
  `register-external-asset.ts`.
- Register regenerated (`demo:register`), `media:check-ids` passes on the new IDs, CHANGELOG,
  PROJECT_STATE row 35b, SESSION-STATE.

### Files Added

`scripts/demo/build-sql.ts`; `docs/ASSET_GENERATION_PROMPTS.md`.

### Files Modified

`scripts/demo/content.ts`, `scripts/demo/build-register.ts`, `package.json` (`demo:sql`),
`tests/unit/demo-content.test.ts`, `docs/content/DEMO_CONTENT.md` (generated),
`docs/architecture/CANONICAL-DECISIONS.md` (A36), `CHANGELOG.md`, `PROJECT_STATE.md`,
`docs/SESSION-STATE.md`, this document.

### Database Changes

No migration. Rows only, all `is_demo`, all removable by `npm run demo:purge` or
`npm run demo:sql -- --purge`.

### Supabase Changes

Demo rows written to `ccvarsmzickdkryoakdg` as listed above; no schema change, no ledger row.

### Environment Variables

None.

### GitHub Actions Changes

None. `demo:check-register` (in `npm run check`) and the unit suite cover the new rows.

### Tests Performed

- `npm run check` (all gates, including `demo:check-register` and `media:check-ids`); the
  `demo-content` unit suite (14 cases); local `demo:seed` (35/10/6/6) and the SQL replay after a
  purge, twice.
- Hosted counts read back after the replay: products 35, pages 10, sections 30, published 7,
  linked articles 10, projects 6, testimonials 6.

### Issues Found

1. The article bodies, projects and testimonials had never been seeded on hosted (only 20 products
   were) — replayed through the SQL.
2. `demo:check-register` and `content:check-inventory` compare against the committed file, so they
   fail locally on an uncommitted regeneration — a property of the gates, not a defect.

### Issues Fixed

Both above (the second by committing the regenerated files).

### Build Status

Green (no code path changed; the check gates and unit suite pass).

### Deployment Status

Hosted holds every demo row. The public site shows the 35 products with the seeded SEED §47
unavailable-media state until the owner uploads images and Phase 43 binds them.

### Commit

See the PR for this track (`feat(phase-35b)`); hash recorded in the final summary.

### Remaining Notes

- **Owner:** generate the 45 images from the prompt book, upload each to the folder named in its
  entry, paste the URL, set the status to `UPLOADED`. Phase 43 registers and binds them.
- **Owner:** verify the ten FAQ answers and the three verification-flagged articles in Studio;
  `3d-resin`'s category page stays a 404 until its description is verified.
- Portfolio projects and testimonials remain DRAFT layout previews behind the evidence gates and
  are not in the prompt book; a real project the owner confirms gets its own imagery then.

## Phase 36 — Google Sheets

**Status:** COMPLETED — the integration is built, gated and inert: the `google_sheets` flag is
`false`, no service account exists yet, and every definition is `MANUAL`. Turning it on is the
owner's five-step setup in ENVIRONMENT §4.

### Objective
A one-way bridge from the research and enquiry tables to a Google Sheets tab, so a person can sort,
filter and share in a spreadsheet without anything typed into a cell ever reaching Rivya. No new
dependency, no credential stored, no read path — and a build gate that proves the last of those.

### Requirements Found
`docs/project/phases/PHASE-31-38.md` §Phase 36 (the seven entities and their allowlisted columns,
the service-account JWT, the atomic staging-tab swap, the retry policy with `Retry-After`, the
circuit breaker, the PII flag on enquiries only with an audit row per run, the hourly minimum,
verification 1–12, exit criteria, open question 4); `DATA_MODEL.md` §12 row 36 (`0340`–`0342`);
FEAT §32; amendment A25 (`CRON_SECRET`); the Phase 04 permission matrix; D8 for the two variables.

### Implementation Completed
- `lib/sheets/client.ts` — `import 'server-only'` first line; the service-account assertion minted
  with `node:crypto` (`createSign('RSA-SHA256')`, `base64url`), the `spreadsheets` scope only, a
  cached access token refreshed a minute early; `getSpreadsheetSheets` (ids and titles — the one
  GET), `putValues`, `batchUpdate`; 429/5xx become a retryable marker, 401/403 `SheetsAuthError`,
  and **no response body is ever read into an error**.
- `lib/sheets/write.ts` — `<tab>__staging`, chunks of ≤ 5,000 cells, one `batchUpdate` that deletes
  the old tab and renames the staging tab, so a reader sees the old complete tab or the new one.
- `lib/sheets/retry.ts` — five attempts, base 500 ms, cap 30 s, full jitter, `Retry-After` in
  seconds or as a date, never on 401/403. `lib/sheets/schedule.ts` — `MANUAL` or a five-field cron
  expression whose minute field is one number (hourly or slower), `previousFire`, `isDue`.
- `lib/sheets/definitions.ts` — the per-entity column allowlist (no media, no secret, nothing from
  the audit or system logs), the PII columns (enquiries only), the generated-tab marker cell,
  `validateColumns`, the filter schemas. `lib/sheets/errors.ts` — the fixed code vocabulary.
- `lib/sheets/builders/` — one row builder per entity reading through the repositories only,
  split by import so no module carries both the direction repository and the catalogue read (I4).
- `lib/sheets/run.ts` — `runDefinition()`: permission (`integrations.sheets.run`, plus
  `inquiries.export` for enquiries), flag, paused/disabled, one RUNNING run per definition (partial
  unique index, a second start is a refused claim), dry run, the PII audit row `sheets.export.pii`,
  the circuit breaker (three consecutive failures pause the definition with the reason), activity
  `sheets.run.succeeded` / `sheets.run.failed` with a sanitised code.
- Repository `lib/supabase/repositories/sheets.ts`, schemas `lib/supabase/schemas/sheets.ts`
  (`.strict()` input with camelCase fields).
- Studio `/studio/research/sheets`: the banner (flag, spreadsheet id, service-account email or
  NOT_CONFIGURED), the definitions table (Run now / Pause / Resume / Enable / Disable / Edit), the
  form at `?edit=new|<id>` (`ExportDefinitionForm`, RC-336), run history with the > 50 % row-count
  warning (`SheetsRunHistory`, RC-337); a cross-link from `/studio/operations/exports`.
- CLI `npm run sheets:sync -- --definition=<slug> [--dry-run]` / `--due`; cron
  `app/api/cron/sheets-sync` hourly under `CRON_SECRET`, `skipped: flag_off` while the flag is off.
- Gate `npm run sheets:check-no-read` (`scripts/sheets/no-read.mjs`): fails on `values.get`,
  `batchGet`, grid data or a `/values/` GET under `lib/sheets/`; in `check` and CI.
- Permissions `integrations.sheets.manage` (owner, admin) and `integrations.sheets.run` (owner,
  admin, merchandiser, researcher); flag `google_sheets = false`; 72 Studio strings.

### Files Added
`supabase/migrations/0340_phase36_sheets.sql`, `0341_phase36_sheets_rls.sql` (generated),
`0342_phase36_default_definitions.sql`; `lib/sheets/{client,write,retry,schedule,definitions,errors,run}.ts`,
`lib/sheets/builders/{index,shared,research,direction,inquiries}.ts`;
`lib/supabase/repositories/sheets.ts`, `lib/supabase/schemas/sheets.ts`;
`app/(studio)/studio/(shell)/research/sheets/actions.ts`, `app/api/cron/sheets-sync/route.ts`;
`components/studio/sheets/{ExportDefinitionForm,SheetsRunHistory}.tsx`;
`scripts/sheets/{sync.ts,no-read.mjs,no-read.d.mts,check-no-read.mjs}`; tests
`tests/unit/sheets-{definitions,retry,schedule,no-read,redaction}.test.ts`,
`tests/unit/rls/phase36.test.ts`, `tests/e2e/sheets-studio.spec.ts`.

### Files Modified
`app/(studio)/studio/(shell)/research/sheets/page.tsx` (stub → surface),
`app/(studio)/studio/(shell)/operations/exports/page.tsx` (cross-link), `components/studio/strings.ts`,
`lib/auth/permissions.ts` (+ test count 37), `lib/auth/table-permissions.ts`,
`scripts/auth/gen-role-sql.ts`, `scripts/db/check-schema.mjs`, `lib/flags/flags.ts`,
`lib/logging/activity.ts`, `lib/supabase/database.types.ts`,
`scripts/research/check-no-autoimport.mjs` (the `repositories/sheets` exemption) and its test,
`eslint.config.mjs`, `package.json`, `vercel.json`, `.github/workflows/ci.yml`, `.env.example`,
`docs/project/phases/PHASE-00-04.md`, `docs/architecture/{DATA_MODEL,CANONICAL-DECISIONS}.md`,
`docs/studio/STUDIO_GUIDE.md`, `docs/ops/{ENVIRONMENT,DEPLOYMENT}.md`,
`docs/design/COMPONENT_REGISTRY.md`, `CHANGELOG.md`, `PROJECT_STATE.md`, `docs/SESSION-STATE.md`.

### Database Changes
Two tables (`sheets_export_definitions`, `sheets_sync_runs`), 21 constraints (the entity, status,
trigger and error-code vocabularies as CHECKs; `paused_at`/`paused_reason` together; `includes_pii`
only on INQUIRIES; `(status = 'RUNNING') = (finished_at is null)`), 6 indexes (one partial unique:
one RUNNING run per definition), 4 policies (select for all staff under `analytics.read`;
insert/update on definitions for owner and admin; runs read-only), no function, no trigger, no
enum. **No credential column.** `0342` seeds the seven default definitions under `allow-insert`.

### Supabase Changes
`0340`–`0342` applied to `ccvarsmzickdkryoakdg` through the MCP with ledger rows carrying the local
files' SHA-256 (98 rows on both). Parity: identical counts on both databases for tables 99,
constraints 799, indexes 398, policies 310, triggers 116, enum values 156, functions 105; the
Phase 36 objects' definitions digest identically on both sides (constraints `0f4447d2…`, indexes
`5e8f2afa…`, policies `3a36780f…`; 7 seeded definitions). A per-table comparison of rendered
definition text shows pre-existing differences on nine older tables that are the local `citext`
and `pg_trgm` operators rendering as `extensions.`-qualified (the extension lives in a different
schema locally) — the same objects, rendered differently, not a structural difference. Security
advisor: nothing new for the phase.

### Environment Variables
`GOOGLE_SERVICE_ACCOUNT_JSON` (secret; the service-account key file as one line) and
`GOOGLE_SHEETS_SPREADSHEET_ID` (sensitive identifier). Both optional: absent, the Sheets page says
NOT_CONFIGURED and nothing else degrades. Setup and the sharing step: ENVIRONMENT §4. **The owner
sets them in Vercel** (Production; Preview only if a preview should be able to sync). `CRON_SECRET`
already exists and now also authenticates `/api/cron/sheets-sync`.

### GitHub Actions Changes
`ci.yml` gains the step "Nothing reads a spreadsheet back into Rivya" (`sheets:check-no-read`).

### Tests Performed
`npm run check` (typecheck, lint, format, and the sixteen gates, now including
`sheets:check-no-read`); unit project 169 files / 2,631 tests, including `sheets-definitions` (8),
`sheets-retry` (7, stubbed clock and jitter), `sheets-schedule` (4), `sheets-no-read` (4 — the gate
proved to refuse each read shape on a fixture tree), `sheets-redaction` (5 — a generated RSA key
injected and searched for on every surface: errors, run rows, activity payloads, the token
request's own failure), and the two new `research-no-autoimport` cases; RLS project 29 files / 596
tests with `RLS_TESTS_REQUIRED=1` against a fresh, seeded local database, including
`phase36.test.ts` (7 cases: RLS on, no anon leg, who may read, who may insert/update definitions,
no session write on runs, the PII-only-on-enquiries CHECK, the one-RUNNING index); production
build through the local PostgREST shim; `security:check-bundle`. E2E `sheets-studio.spec.ts`
(3 tests) guarded by `STUDIO_STORAGE_STATE`.

### Issues Found
- A `*/15` inside a doc comment in `schedule.ts` closed the block comment early (three TypeScript
  parse errors and a failing test transform).
- The seeded opportunity-score columns named signals that do not exist; corrected to the seven
  real `SIGNAL_KEYS`.
- The `Text` primitive has no heading element; the form heading is a `Heading level={3}`.
- Comparison members carry `source_id` / `research_product_id`, not a `member_id`.
- TypeScript does not carry a null-check into a hoisted function declaration; the client binds the
  loaded credentials to a second const.
- I4 refused the single row-builder module because it imported both the direction repository and
  the category read; split into `lib/sheets/builders/` by import.
- The no-auto-import guard matched the Sheets repository's `update…`/`set…` symbols under the
  research route; `repositories/sheets` is exempted with the reason recorded in A37, and two
  fixture cases prove a catalogue write beside them is still refused.
- Two admin-importing files needed the eslint `no-restricted-imports` allowlist.

### Issues Fixed
All eight above.

### Build Status
Green — `next build` against the seeded local database through PostgREST; bundle secret check clean.

### Deployment Status
Merged to `main`; Vercel builds from `main`; the hourly cron is registered in `vercel.json` and
answers `skipped: flag_off` until the owner turns the flag on.

### Commit
See the PR for this phase (`feat(phase-36)`); hash recorded in the final summary.

### Remaining Notes
- **Owner action (five steps, ENVIRONMENT §4):** Google Cloud project → enable the Sheets API →
  service account + JSON key → set the two variables in Vercel → share the spreadsheet with the
  service-account email → turn `google_sheets` on. That a Google Workspace account and a
  spreadsheet exist for Rivya is `OWNER_VERIFICATION_REQUIRED`.
- The `comparison-set` definition has no scope until an admin picks a comparison set in the form.
- Nothing reads a spreadsheet back, by construction and by gate; a request to do so is a design
  change that goes through an amendment, not a pull request.

## Phase 37 — Studio Analytics

**Status:** COMPLETED — the tab is real and honest: every tile is a figure with `n`, a denominator
and a date, or `UNAVAILABLE` with the reason named. The market section waits for the owner to turn
`advanced_analytics` on; the row policy, not the flag, decides who may read a competitive figure.

### Objective
Fill the Analytics tab Phase 05 stubbed with the eighteen FEAT §28 metrics, declared once, computed
by a daily snapshot writer and never in the request path, with `UNAVAILABLE` rendered as a named
work item rather than a zero, a dash or an estimate — and give the FEAT §17 dashboard cards real
numbers wherever their tables exist.

### Requirements Found
`docs/project/phases/PHASE-31-38.md` §Phase 37 (the eighteen-row metric table with availability
rules, the adapter-capability declaration, the not-traffic rule for `content_performance`, snapshots
and trends, role scoping, rendering, the `analytics_snapshots` DDL with its CHECK, the RLS predicate,
verification 1–11, exit criteria); `DATA_MODEL.md` §12 row 37 (`0350`–`0351`); FEAT §28's last line
("do not manufacture unavailable analytics data"); STUDIO_GUIDE §5.3 (card definitions) and §5.4;
amendment A25 (`CRON_SECRET`).

### Implementation Completed
- `lib/analytics/metrics/ids.ts` (the eighteen ids, FEAT §28 order), `types.ts`, `shared.ts`,
  `first-party.ts` (8), `competitive.ts` (10), `index.ts` (the registry, `metricById`).
- `lib/analytics/reads.ts` — the one interface every metric computes from, with
  `emptyAnalyticsReads()`; `lib/analytics/availability.ts` — the fixed reason vocabulary (missing
  table; attribute key with the enabled sources that would need it, under an EXTRACT adapter;
  missing capability with the Phase 26/27 change named; no successful run in 30 days; no ACTIVE
  model); `lib/analytics/snapshot.ts` — the only caller of `compute()`, idempotent per date, a
  throwing metric stored UNAVAILABLE with the error's name, retention 400 days.
- `lib/supabase/repositories/analytics.ts` — `createAnalyticsReads()` (explicit selects; the enquiry
  read is five columns and no person), `createSnapshotWriter()` (upsert on `(metric_id, as_of)`,
  prune), `listLatestAnalyticsSnapshots()`, `listAnalyticsSeries()`; `lib/supabase/schemas/analytics.ts`.
- `lib/auth/table-permissions.ts` gains `selectScope` (A38) and the `analytics_snapshots` entry with
  the `research.read` role list derived from the matrix; `scripts/auth/gen-role-sql.ts` applies it
  to the staff SELECT alone and re-renders every earlier file byte-identically.
- The tab: `components/studio/analytics/{AnalyticsTab,MetricTile,MetricUnavailable,MetricTrend}.tsx`
  (RC-338–341), wired into `/studio?tab=analytics`; "This studio" with the traffic sentence,
  "The market" for `research.read` while `advanced_analytics` is on; `CoverageBadge`, `BarSeries`
  with its data table, `Sparkline` from two snapshots, the definition disclosure.
- Dashboard cards: `BUILT_THROUGH_PHASE` 5 → 36; thirteen new head-counts in
  `lib/supabase/repositories/metrics.ts`; `readCounts()` on the overview sources every card whose
  table exists.
- CLI `npm run analytics:snapshot -- [--date=] [--only=] [--dry-run]`; cron
  `app/api/cron/analytics-snapshot` at 03:45 UTC under `CRON_SECRET`; `vercel.json`; flag
  `advanced_analytics = false`; 51 Studio strings; five seeded Studio-help sentences (the traffic
  note among them); the content inventory regenerated (558 rows).

### Files Added
`supabase/migrations/0350_phase37_analytics_snapshots.sql`, `0351_phase37_analytics_rls.sql`
(generated); `lib/analytics/{reads,availability,snapshot}.ts`,
`lib/analytics/metrics/{ids,types,shared,first-party,competitive,index}.ts`;
`lib/supabase/repositories/analytics.ts`, `lib/supabase/schemas/analytics.ts`;
`components/studio/analytics/{AnalyticsTab,MetricTile,MetricUnavailable,MetricTrend}.tsx`;
`scripts/analytics/snapshot.ts`; `app/api/cron/analytics-snapshot/route.ts`; tests
`tests/unit/analytics-{registry,availability,no-fabrication}.test.ts`, `tests/unit/rls/phase37.test.ts`,
`tests/e2e/studio-analytics.spec.ts`.

### Files Modified
`app/(studio)/studio/(shell)/page.tsx` (stub → tab; every card counted),
`lib/analytics/dashboard-cards.ts`, `lib/supabase/repositories/metrics.ts`,
`lib/auth/table-permissions.ts`, `scripts/auth/gen-role-sql.ts`, `scripts/db/check-schema.mjs`,
`lib/flags/flags.ts`, `lib/supabase/database.types.ts`, `components/studio/strings.ts`,
`content/seed/studio-help.ts`, `docs/content/INITIAL_CONTENT_INVENTORY.md`, `eslint.config.mjs`,
`package.json`, `vercel.json`, `docs/studio/STUDIO_GUIDE.md` (§5.3, §5.4 with the eighteen
definitions verbatim), `docs/ops/PERFORMANCE.md` (§7.5), `docs/ops/DEPLOYMENT.md` (§3.1 row),
`docs/architecture/{DATA_MODEL,CANONICAL-DECISIONS}.md`, `docs/design/COMPONENT_REGISTRY.md`,
`CHANGELOG.md`, `PROJECT_STATE.md`, `docs/SESSION-STATE.md`.

### Database Changes
One table, `analytics_snapshots`: 11 constraints (the unique `(metric_id, as_of)`; `dimension`,
`availability` and the id shape CHECKed; **`(availability = 'UNAVAILABLE') = (unavailable_reason
is not null)`**; the reason non-blank; `value` an object; counts non-negative; `n ≤ denominator`),
4 indexes (retention by `as_of`, the series index), 1 policy (staff select with the COMPETITIVE
predicate), no function, no trigger, no enum, no seed. No session write policy of any kind.

### Supabase Changes
`0350`–`0351` applied to `ccvarsmzickdkryoakdg` through the MCP with ledger rows carrying the local
files' SHA-256 (100 rows on both). Parity on the new table: constraints 11 (`7aebba20…`), indexes 4
(`72406fe7…`), policies 1 (`bc0de5e1…`), identical on both databases; 100 tables, RLS on all.
Security advisor: nothing new for the phase. No storage, auth or edge-function change.

### Environment Variables
None new. `CRON_SECRET` (existing) now also authenticates `/api/cron/analytics-snapshot`.

### GitHub Actions Changes
None. The three new unit suites and the RLS suite run inside the existing steps.

### Tests Performed
`npm run check` (typecheck, lint, format, the sixteen gates) green; `db:check-migrations` green;
unit project 172 files / 2,652 tests, including `analytics-registry` (7: FEAT §28 id parity,
dimensions, definitions verbatim in STUDIO_GUIDE, `compute()` called only from the writer, the flag),
`analytics-availability` (9: every reason the resolver gives) and `analytics-no-fabrication` (5: the
whole registry against empty reads is a true zero or a named reason; the writer's rows satisfy the
CHECK; two runs for one date give eighteen rows, not thirty-six; no trend through one point; no
seed, fixture or demo inserts a row); RLS project 30 files / 603 tests with `RLS_TESTS_REQUIRED=1`
against a fresh, seeded local database, including `phase37.test.ts` (7: RLS on and no anon, no
session insert for the owner, editor sees the first-party row and no competitive row, researcher and
viewer see both, the reason-iff-unavailable and non-blank CHECKs, one row per metric per day,
dimension and n ≤ denominator). Verification 3–5 run against the local database through the
PostgREST shim: `npm run analytics:snapshot -- --dry-run` printed eighteen lines with a reason on
every UNAVAILABLE one and wrote nothing; two real runs for the same date left exactly 18 rows, every
UNAVAILABLE row with a non-empty reason and every AVAILABLE row with none. Production build through
the shim; `security:check-bundle` clean. E2E `studio-analytics.spec.ts` (anonymous half runs
everywhere; the signed-in half at 1920/1440/430/390 is guarded by `STUDIO_STORAGE_STATE`).

### Issues Found
- The generator had no way to narrow a staff SELECT by a column (only `ownerScope`, which narrows
  every policy to a person's rows, and `extraSelectPolicy`, which widens); added `selectScope`
  (A38) rather than misusing either.
- `filter(isRecord)` on a `Json[]` does not narrow (a `Record<string, unknown>` is not assignable to
  `Json`), so the source attribute keys are read through `unknown[]`.
- The generated `Json` type cannot see through a Zod object; the writer casts the validated payload.
- `listLatestScores` returns `state` as `string`; mapped to the two-value union at the seam.
- One unused re-export import after the split (eslint).
- The phase table and verification 7 disagree on `product_scale`'s floor (five versus three); the
  table wins and the reading is recorded in A38.

### Issues Fixed
All six above.

### Build Status
Green — `next build` against the seeded local database through PostgREST; bundle secret check clean.

### Deployment Status
Merged to `main`; Vercel builds from `main`; the daily cron is registered in `vercel.json` and
writes eighteen rows a day from the first production tick (all first-party true zeros or named
reasons until the catalogue and the corpus fill).

### Commit
See the PR for this phase (`feat(phase-37)`); hash recorded in the final summary.

### Remaining Notes
- **Owner action:** turn `advanced_analytics` on when a research corpus exists; until then the market
  section is absent for every role. Connecting a traffic-analytics provider is the owner's decision
  (PERFORMANCE §7.5, `OWNER_VERIFICATION_REQUIRED`) and nothing in the repository estimates traffic.
- `resin_styles`, `colours` and `production_model` stay `UNAVAILABLE` until Phase 26/27 gain an
  attribute key for them; `customization` until Phase 28 normalises it. Each tile says so.
- The role matrix on the tab (editor eight, researcher eighteen) is proved at the row by the RLS
  suite; the browser pass per role needs a storage state per role and is a manual step.

## Phase 38 — Environment + Documentation + Logs

**Status:** COMPLETED

### Objective
Three read-only System surfaces — reachability, documentation, the operational log — sharing one
redactor and one rule: none may ever show a secret. After this phase an operator answers "is it up,
what is deployed, what broke and where is that documented" without a terminal.

### Requirements Found
`docs/project/phases/PHASE-31-38.md` §Phase 38 (the redactor's three layers and fixed token; the
eight checks with their shape, statuses and fixed codes; `configured` from presence only; the
ten-path allowlist, no path parameter, no raw HTML; `system_logs` with orthogonal `level` and
`channel`, the dedupe window, the retention windows; the three-log table; verification 1–12; exit
criteria; open question 4 on `lib/ops/`); `DATA_MODEL.md` §12 row 38 (`0360`–`0361`, the view, the
two enums) and §10 (the view's SQL); ENVIRONMENT §7 (the page contract); SECURITY §5.2 and §10;
FEAT §29–31; amendment A25.

### Implementation Completed
- `lib/logging/redact.ts` — by key (secret- and person-shaped names, every D8 server-only variable
  name; `error_code`, `metric_key`, `dedupe_key` kept), by value (the current value of every D8
  server-only variable, wherever it appears), by shape (JWT, PEM block — raw and JSON-escaped —,
  Cloudinary URL, `postgres://user:pass@`, bearer token); always `[redacted]`.
- `lib/logging/system-log.ts` — `logSystem()`: redacts, derives a dedupe key, writes through the
  service role, never throws, console-only with one note when the service role is absent.
  `lib/logging/log-filters.ts` — the URL as the filter.
- `0360`: enums `log_level`, `log_channel`; `system_logs` (event shape, message bounds, context an
  object, `unique (dedupe_key, first_minute)`, `occurrence_count ≥ 1`); `update`/`delete` revoked
  from every session role; `system_log_write()` SECURITY DEFINER, service role only, five-minute
  dedupe with an `on conflict` fallback for a concurrent first write; `workflow_runs_v`
  (`security_invoker`). `0361` generated: `operations.logs.read` select, nothing else.
- `lib/supabase/repositories/system-logs.ts` (write via RPC, filtered list, purge by level and age,
  the view reader) and `repositories/ops.ts` (the ping and the ledger read).
- `lib/ops/env-checks/` — eight modules, each `{ id, requires, channel, probe }`; `types.ts` (the
  five statuses, the fixed codes, `outcomeForHttp`, `outcomeForError`); `lib/ops/environment.ts`
  (parallel, 3 s timeout, presence → boolean, detail redacted and reduced to primitives, failures
  logged on the check's channel, `worstStatus`); `lib/ops/build-info.ts` + `scripts/build/
  build-info.mjs` inlined by `next.config.ts` as `RIVYA_BUILD_INFO`.
- `lib/cms/docs/` — `allowlist.ts` (ten keys), `render.ts` (block parser with no HTML branch; link
  rewriting to keys, anchors, external-as-text), `index.ts` (the generated index, cached);
  `scripts/docs/build-index.ts` (`npm run docs:index`, the `prebuild` step); `outputFileTracingIncludes`
  for the index and the Higgsfield manifest.
- Pages: `/studio/system/environment` (banner with overall status and the two permanent lines,
  `EnvironmentChecks`, the build panel), `/studio/system/documentation` and `/[docKey]` (`DocBody`,
  contents, `notFound()` on any non-key), `/studio/operations/logs` (`LogFilters`, `LogTable`,
  `LogDetail`, export link for `operations.logs.export`), `/studio/operations/workflows`;
  `app/api/studio/logs/export` (CSV, audited); `app/api/cron/log-retention` (04:15 UTC,
  `CRON_SECRET`).
- Writers of the third log: `warnScraper` (SCRAPER channel, run and source ids), `lib/sheets/run.ts`
  on failure (`sheets.run.failed`, code only), the check runner on `UNREACHABLE`/`DEGRADED`, the
  retention purge's summary.
- Gate `npm run logs:check-separation` (`scripts/logging/check-log-separation.mjs`) in `check` and
  CI; permission `operations.logs.export` (owner, admin); 78 Studio strings; two seeded permanent
  lines; `createAdminClient({ fetch })`.

### Files Added
`supabase/migrations/0360_phase38_system_logs.sql`, `0361_phase38_system_logs_rls.sql` (generated);
`lib/logging/{system-log,log-filters}.ts`; `lib/ops/{environment,build-info}.ts`,
`lib/ops/env-checks/{types,index,supabase-db,supabase-auth,cloudinary,google-sheets,vercel,higgsfield,migrations,build}.ts`;
`lib/cms/docs/{allowlist,render,index}.ts`; `lib/supabase/repositories/{system-logs,ops}.ts`,
`lib/supabase/schemas/system-logs.ts`; `components/studio/ops/{EnvironmentChecks,LogTable,LogDetail,LogFilters}.tsx`,
`components/studio/docs/DocBody.tsx`; `app/(studio)/studio/(shell)/system/documentation/[docKey]/page.tsx`,
`app/api/studio/logs/export/route.ts`, `app/api/cron/log-retention/route.ts`;
`scripts/build/{build-info.mjs,build-info.d.mts}`, `scripts/docs/build-index.ts`,
`scripts/logging/{log-separation.mjs,log-separation.d.mts,check-log-separation.mjs}`; tests
`tests/unit/{redact,env-checks-no-secrets,docs-allowlist,log-separation}.test.ts`,
`tests/unit/rls/phase38.test.ts`, `tests/e2e/studio-system.spec.ts`.

### Files Modified
`lib/logging/redact.ts` (three layers), `lib/scraper/core/log.ts` (the seam filled),
`lib/sheets/run.ts`, `lib/supabase/admin.ts` (injectable `fetch`), `lib/auth/permissions.ts`
(+ test count 38), `lib/auth/table-permissions.ts`, `scripts/auth/gen-role-sql.ts`,
`scripts/db/check-schema.mjs`, `lib/supabase/database.types.ts`, `components/studio/strings.ts`,
`content/seed/studio-help.ts`, `docs/content/INITIAL_CONTENT_INVENTORY.md`, the three page stubs
(environment, documentation, logs) and the workflows stub, `next.config.ts`, `eslint.config.mjs`,
`package.json` (`prebuild`, `build:info`, `docs:index`, `logs:check-separation`, the `check` chain),
`.gitignore`, `vercel.json`, `.github/workflows/ci.yml`, `docs/project/phases/PHASE-00-04.md`,
`docs/architecture/{DATA_MODEL,CANONICAL-DECISIONS}.md`, `docs/studio/STUDIO_GUIDE.md`,
`docs/ops/{ENVIRONMENT,SECURITY,DEPLOYMENT}.md`, `docs/design/COMPONENT_REGISTRY.md`,
`CHANGELOG.md`, `PROJECT_STATE.md`, `docs/SESSION-STATE.md`.

### Database Changes
Two enums, one table (`system_logs`: 8 constraints incl. the per-minute unique, 6 indexes,
`update`/`delete` revoked from `anon` and `authenticated`), one SECURITY DEFINER function
(`service_role` only), one `security_invoker` view with `select` granted to `authenticated` and
`service_role`, one policy. No seed.

### Supabase Changes
`0360`–`0361` applied to `ccvarsmzickdkryoakdg` through the MCP with ledger rows carrying the local
files' SHA-256 (102 rows on both). Parity on the new objects, identical on both databases: `system_logs` constraints 9
(`557a41dc…`), indexes 8 (`024ae39c…`), policy 1 (`ffdc6ddf…`), the two enums' 12 values
(`7ddab7ea…`), `workflow_runs_v` (`a6d23e69…`); `system_log_write()` differs only in the SQL
comments the hosted copy was stripped of (both bodies read and compared); `anon` cannot execute it
on either. 101 tables, RLS on all. Security advisor: nothing new for the phase.

### Environment Variables
None new. `CRON_SECRET` (existing) now also authenticates `/api/cron/log-retention`.
`RIVYA_BUILD_INFO` is not a variable anyone sets: `next.config.ts` computes and inlines it.

### GitHub Actions Changes
`ci.yml` gains the step "Three logs stay three" (`logs:check-separation`). The build step's
`npm run build` now runs `prebuild` (`docs:index`) first.

### Tests Performed
`npm run check` (typecheck, lint, format, and the seventeen gates — now including
`logs:check-separation`) green; `db:check-migrations` green; unit project 176 files / 2,675 tests,
including `redact` (7: by key, by value for every D8 variable, by shape for five shapes, the fixed
token), `env-checks-no-secrets` (5: every check against an echoing 500 with every variable a
sentinel — no sentinel or four-character fragment on any result; NOT_CONFIGURED without a probe;
a 401 quoting the key maps to `AUTH` with nothing quoted; a hanging probe times out; a check that
returns four characters of a secret is caught), `docs-allowlist` (7: exactly the ten FEAT §30
paths; traversal, `SECURITY.md`, an absolute path and an empty key refused; the indexer reads the
allowlist alone and redacts; the index is gitignored; `<script>` and `onerror=` stay text; link
rewriting; heading ids) and `log-separation` (3: the repository passes, a fixture with one event in
both logs is refused, different events pass); RLS project 31 files / 610 tests with
`RLS_TESTS_REQUIRED=1` against a fresh, seeded local database, including `phase38.test.ts` (7: RLS
on and no anon leg, owner and admin read and an editor does not, no session insert/update/delete
for the owner (`update … set message='x'` refused), the writer executable by `service_role` only,
1,000 identical writes → one row with `occurrence_count = 1000`, a second dedupe key → a second
row, a malformed event and a blank message refused, `workflow_runs_v` security-invoker over the
five kinds) and `function-grants` unchanged; `npm run docs:index` → ten documents indexed and
redacted (851 KB); `npm run build:info` prints the six identifiers; production build (with
`prebuild`) through the local PostgREST shim; `security:check-bundle` clean. E2E
`studio-system.spec.ts` (anonymous half on four routes runs everywhere; the signed-in half at
1920/1440/1024/430/390 is guarded by `STUDIO_STORAGE_STATE`).

### Issues Found
- The phase document's `unique (dedupe_key, date_trunc('minute', first_occurred_at))` cannot be
  built: every date function over `timestamptz` is STABLE and both a generated column and a unique
  expression need IMMUTABLE (PostgreSQL 16 refused a generated `to_timestamp(...)` and an
  `extract(epoch …)` alike). `first_minute` is a defaulted epoch-minute integer set by the writer.
- A gitignored `lib/ops/build-info.generated.ts` would not exist when CI type-checks; build
  information is inlined by `next.config.ts` instead (A39).
- `.from()` in a check module would fail the data-layer gate; the two reads moved to
  `lib/supabase/repositories/ops.ts`, and `createAdminClient()` gained an injectable `fetch` so the
  sentinel test needs no network.
- The `check-migrations` gate saw the function body's `insert` as content; the marker sits above it,
  as `0009` and `0050` did.
- The original redactor's `message` key must stay redacted (an audit blob's `message` is an
  enquiry's text, and `lib/auth/audit.test.ts` holds it); the system log's message is scrubbed as a
  string instead.
- `revoke update, delete` makes a session's update a permission error, not a zero-row update; the
  RLS test asserts the refusal, as verification 1 asks.

### Issues Fixed
All six above.

### Build Status
Green — `prebuild` built the ten-document index, `next build` against the seeded local database
through PostgREST; bundle secret check clean.

### Deployment Status
Merged to `main`; Vercel builds from `main` (the `prebuild` index and the inlined build information
are produced in the build container; the environment page shows the deployed commit and branch). The
retention cron is registered in `vercel.json`.

### Commit
See the PR for this phase (`feat(phase-38)`); hash recorded in the final summary.

### Remaining Notes
- `request_id` exists on both logs and is filterable; `proxy.ts` assigning one per request lands
  with Phase 41's security headers.
- The Higgsfield check counts the manifest (250 / 224 / 26 / 24) and never calls the API.
- The role matrix in the browser (editor refused the environment page, allowed the documentation;
  viewer refused both) is proved server-side by `requirePermission` and the permission matrix;
  the per-role browser pass needs a storage state per role and is a manual step.

## Phase 39 — SEO

**Status:** COMPLETED

### Objective
Search engines stop seeing thirteen pages with fallback metadata and start seeing a governed,
owner-editable information architecture: a four-level resolution ladder ending in the SEED §41
defaults, a split sitemap over every published entity type, a structured-data allowlist in which
every emitted property is traceable to something the owner typed and verified, a redirect table so
a slug change never produces a dead link, and a keyword workspace that records the SEED §42 themes
as research targets with no claimed ranking opportunity.

### Requirements Found
`docs/project/phases/PHASE-39-46.md` §Phase 39 (the ladder, the title template, the canonical
table, the route-class robots table, the split sitemap with no priority / changefreq / image
sitemap, the allowlist with its gates and the never-emitted list, `verifiedOnly()`, the keyword
table with no metric column and two geography themes awaiting verification, redirects on the 404
path only with one-hop chain detection, the seven tabs, verification 1–13, exit criteria);
`DATA_MODEL.md` §12 row 39 and the register rows for both tables; STUDIO_GUIDE §9.3's row for
`/studio/content/seo`; SEED §41, §42, §44; D3, D6, D10.

### Implementation Completed
- **Permission** `seo.write` (owner, admin, editor) in `lib/auth/permissions.ts` (count 39),
  back-written into the `PHASE-00-04.md` matrix; the nav leaf's write permission.
- **`0370`**: `seo_entries` + `structured_data_type` (CHECKed to the eight-type allowlist),
  `noindex`, `nofollow`, `derived`; `seo_keyword_themes` (generated `normalized_theme citext`
  unique, `research_status` CHECK, path and evidence shapes, `researched_at` coherent with the
  status, Tier A+B+C, the Phase 08 triggers, **no numeric column**); `seo_redirects` (`unique
  (from_path)`, `from_path <> to_path`, `status_code in (301, 308)`, `hit_count`, Tier A+B, created
  PUBLISHED). **`0371`** generated: `seo_keyword_themes` shape C, `seo_redirects` shape A with
  the anon PUBLISHED leg; `seo_entries` keeps `0051`.
- **Seed**: the seventeen §42 themes as `seo_keyword_themes` rows (`keyword:<slug>`, two
  `OWNER_VERIFICATION_REQUIRED`), replacing the one `SEO_DEFAULT.keyword_themes` string; four
  `STUDIO_HELP` sentences; `seo_keyword_themes` in `SeedableTable`; `emit-sql.ts --table=`.
- **`lib/seo/`**: `resolve.ts` (ENTITY → PATH → DERIVED → GLOBAL per field; `deriveSeo` /
  `deriveEntitySeo`; `truncateAtWord` at 155 on a word boundary, no ellipsis); `canonical.ts`
  (the rule table; `siteOrigin`, `sameOriginCanonical`, `paginatedPath`); `metadata.ts` rewritten
  on the ladder with `entity`, `derived`, `listing`, `searchSurface` inputs and the object-form
  `robots`; `jsonld/` (`guard.ts` with `verifiedOnly`, `FORBIDDEN_KEYS`, `FORBIDDEN_TYPES`,
  `forbiddenKeysIn`; `organization`, `website`, `breadcrumb`, `product` — `offers` only FIXED and
  VERIFIED, `material` from the join —, `collection`, `article`, `faq`, `contact`, `index` with
  `graphOf` and `serialiseJsonLd`); `site-graph.ts`; `breadcrumbs.ts`; `redirects.ts`
  (`redirectOrNotFound`, 308, best-effort hit count as the service role); `redirect-rules.ts`;
  `sitemap.ts`; `coverage.ts`; `studio-resolution.ts`; `slug-redirect.ts`.
- **Public surface**: `components/patterns/JsonLd` (RC-347) as the only emitter; Organization +
  WebSite from `app/(site)/layout.tsx`; the product, collection, article, portfolio, FAQ and
  contact routes on the builders; every route on the ladder; `/search` as a search surface; the
  catalogue and journal listings on the canonical table (`isFilteredCatalogQuery`); the redirect
  resolver at every `notFound()` for a missing address; `app/sitemap.xml/route.ts` and
  `app/sitemaps/[file]/route.ts` (six children, `revalidate = 3600`, `images.xml` → 404);
  `robots.ts`; `X-Robots-Tag` in `next.config.ts` for `/studio`, `/api` and every non-production
  response.
- **Studio**: `/studio/content/seo` with seven tabs (`SeoTabs`, `GlobalSeoForm`, `PagesTable`,
  `EntitiesTable`, `SeoEntryForm` + `SerpPreview` (client), `KeywordsTable`,
  `StructuredDataPanel` with live gates and a builder rendering, `RedirectsTable` with a GET
  test box, `CoveragePanel`, `LevelBadge`); nine Server Actions under `seo.write`
  (`content.publish` to publish, `destructive.execute` to delete an entry); `EntitySeoPanel` on
  the product, collection, project and article editors; the product form's `create_redirect`
  checkbox and `redirectForSlugChange` in `saveProductAction`.
- **Repositories**: `seo.ts` (entries, entity summaries, derivable sections, global strings,
  structured-data facts), `keywords.ts`, `redirects.ts`, `sitemap.ts`; schema `seo.ts`;
  `OwnerVerification` type exported.
- **Gates**: `scripts/seo/check-jsonld-scope.mjs` (in `check` and CI; `lib/scraper/**` exempt as
  a reader), `scripts/seo/validate-jsonld.mjs` (CI step "Structured data on the real build":
  crawls the sitemap and the static paths of a `next start`, one graph per route, forbidden keys
  and types, `Offer` without a price, `robots.txt`, `X-Robots-Tag`), `scripts/seo/build-seo-
  coverage.ts` feeding the inventory's "SEO coverage" section; the two research isolation gates
  exempt `research_status`.

### Files Added
`supabase/migrations/0370_phase39_seo.sql`, `0371_phase39_seo_rls.sql` (generated);
`lib/seo/{resolve,canonical,redirect-rules,redirects,sitemap,site-graph,breadcrumbs,coverage,studio-resolution,slug-redirect}.ts`,
`lib/seo/jsonld/{guard,organization,website,breadcrumb,product,collection,article,faq,contact,index}.ts`
(three moved from `lib/seo/*-jsonld.ts`); `lib/supabase/schemas/seo.ts`;
`lib/supabase/repositories/{seo,keywords,redirects,sitemap}.ts`; `components/patterns/JsonLd/index.tsx`;
`components/studio/seo/{SeoTabs,LevelBadge,SerpPreview,SeoEntryForm,GlobalSeoForm,PagesTable,EntitiesTable,KeywordsTable,StructuredDataPanel,RedirectsTable,CoveragePanel,EntitySeoPanel}.tsx`;
`app/(studio)/studio/(shell)/content/seo/actions.ts`; `app/sitemap.xml/route.ts`,
`app/sitemaps/[file]/route.ts`; `scripts/seo/{jsonld-scope.mjs,jsonld-scope.d.mts,check-jsonld-scope.mjs,validate-jsonld.mjs,validate-jsonld.d.mts,build-seo-coverage.ts}`;
tests `tests/unit/{seo-resolve,seo-canonical,jsonld-guard,jsonld-builders,sitemap-scope,redirect-chain}.test.ts`,
`tests/unit/rls/phase39.test.ts`, `tests/e2e/{seo-metadata,studio-seo}.spec.ts`.

### Files Modified
`lib/auth/{permissions,permissions.test,table-permissions,studio-nav}.ts`, `scripts/auth/gen-role-sql.ts`,
`scripts/db/check-schema.mjs`, `scripts/research/check-research-isolation.mjs`,
`scripts/search/check-search-scope.mjs`, `scripts/seed/emit-sql.ts`,
`scripts/content/build-content-inventory.ts`, `lib/supabase/{database.types,schemas/cms,schemas/common,schemas/index}.ts`,
`lib/seo/metadata.ts`, `lib/cms/render-page.tsx`, `lib/cms/docs/allowlist.ts` (PR #44),
`lib/catalog/query.ts`, `content/seed/{seo,types,studio-help}.ts`, `components/studio/strings.ts`,
`components/studio/catalog/ProductForm.tsx`, `app/(site)/layout.tsx` and the `page.tsx` of `/`,
`/product/[slug]`, `/collections/[slug]`, `/journal/[slug]`, `/journal`, `/journal/category/[slug]`,
`/portfolio/[slug]`, `/collection`, `/collection/[category]`, `/faq`, `/contact`, `/search`;
`app/robots.ts` (`app/sitemap.ts` removed); `app/(studio)/studio/(shell)/content/seo/page.tsx`,
`catalog/actions.ts`, the four entity editor pages; `next.config.ts`, `eslint.config.mjs`,
`package.json`, `.github/workflows/ci.yml`; tests `seo-metadata`, `homepage-jsonld`,
`product-jsonld`, `seed-modules`, `e2e/collection.spec.ts`; docs
`docs/project/phases/PHASE-00-04.md`, `docs/architecture/{DATA_MODEL,CANONICAL-DECISIONS,ARCHITECTURE}.md`,
`docs/content/{CONTENT_GUIDE,INITIAL_CONTENT_INVENTORY}.md`, `docs/studio/STUDIO_GUIDE.md`,
`docs/ops/SECURITY.md`, `docs/design/COMPONENT_REGISTRY.md`, `CHANGELOG.md`, `PROJECT_STATE.md`,
`docs/SESSION-STATE.md`.

### Database Changes
`0370`: `seo_entries` + four columns and the allowlist CHECK; `seo_keyword_themes`;
`seo_redirects` (DDL above). `0371`: nine policies. Local: 104 migrations, 103 tables, RLS on all,
D10 gate on 15 content tables (the two new tables added), `db:check-migrations`,
`auth:check-policies`, `auth:check-rls` green.

### Supabase Changes
Hosted `ccvarsmzickdkryoakdg`: `0370` and `0371` applied (comment-stripped), ledger rows with the
local files' SHA-256 (ledger 104 rows); seventeen keyword themes and four help rows seeded with
their content hashes through `emit-sql.ts`; parity digests identical for constraints, indexes,
policies and triggers on the three tables; security advisor: the standing findings only
(`schema_migrations` RLS-no-policy INFO; the SECURITY DEFINER warnings on the inquiry functions,
`has_role`, `is_staff`, `current_staff_role`, `research_restore_brief_revision`), nothing new.

### Environment Variables
None added. `NEXT_PUBLIC_SITE_URL` now also decides whether the sitemap index exists and whether
an owner canonical can be checked; `VERCEL_ENV` decides the deployment-wide `X-Robots-Tag`.

### GitHub Actions Changes
`ci.yml`: "One structured-data emitter" (`seo:check-jsonld-scope`) and "Structured data on the real
build" (restarts the PostgREST shim, `next start`, `validate-jsonld.mjs --base`). `check` chain
gains `seo:check-jsonld-scope`.

### Tests Performed
- `npm run check` green (18 gates).
- Unit: the six Phase 39 suites plus the updated `seo-metadata`, `homepage-jsonld`,
  `product-jsonld`, `seed-modules`; whole unit project green: 182 files / 2,752 tests. RLS project:
  32 files / 621 tests.
- RLS: `phase39` (11 cases: no anon leg and no numeric column on the keyword table; editor
  add/edit/refused duplicate in one transaction; merchandiser refused, viewer reads; status stamp
  CHECK; anon sees a PUBLISHED redirect and not a paused one; self / duplicate / 302 refused;
  editor writes, merchandiser and anon refused; the four columns' defaults and the allowlist
  CHECK; the seeded themes; a DRAFT page of every kind invisible to anon).
- Build through the local PostgREST shim, `security:check-bundle`, then `next start` and
  `validate-jsonld.mjs` against it; `content:inventory` regenerated (580 rows + the coverage
  section).
- e2e `seo-metadata.spec.ts` and `studio-seo.spec.ts` written; the signed-in half is guarded by
  `STUDIO_STORAGE_STATE` as every Studio spec is.

### Issues Found / Fixed
- The Vercel preview of the fix branch failed to build once because staged JSON-LD moves slipped
  into the Phase 38 fix commit; the commit was rewritten to its two intended files.
- `research_status` tripped both research isolation gates (`content/` and the public search path
  are policed trees); the gates exempt exactly that name and the status constant was renamed
  `KEYWORD_STATUSES`.
- The `check-jsonld-scope` gate flagged the scraper's JSON-LD reader; `lib/scraper/**` is exempt as
  a reader, with the reason in the gate.
- The RLS harness rolls every `asSession` block back, so the suite was restructured to keep an
  insert and its dependent statements in one block and to commit cross-block fixtures as the
  superuser.
- The category page and the category entity resolved as two rows; they are one address and now
  resolve as one.

### Build Status
Production build green through the local PostgREST shim; `security:check-bundle` clean;
`validate-jsonld.mjs` green against `next start`.

### Deployment Status
Landed on `main` by PR (merge commit after CI green); hosted database level `0371`.

### Commit
`feat(phase-39): SEO` (hash in the PR).

### Remaining Notes
- The brand OG asset does not exist yet (Phase 43): pages without a bound hero emit no `og:image`
  rather than borrowing one; the Global tab's default social image is empty until then.
- Product structured data carries `offers` only once a FIXED price is VERIFIED — the seeded demo
  products are PRICE_ON_REQUEST and carry none by design.
- Every seeded PATH entry is DRAFT (Phase 09's choice); the Pages tab shows the GLOBAL rung until
  the owner publishes them.
- The owner asked for a stop after Phase 39 lands; Phase 40 starts on their word.

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
