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
