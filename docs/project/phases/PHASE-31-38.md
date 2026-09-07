# PHASES 31–38 — Research Analytics, Opportunity, Similarity, Direction, Confirmation, Sheets, Studio Analytics, System

> Binding parent: `docs/architecture/CANONICAL-DECISIONS.md`. Where this document and the
> canonical decisions differ, the canonical decisions win and this document is wrong.
> Source specifications: `docs/requirements/01-ADVANCED-FEATURE-EXPANSION.md` (cited as
> *FEAT §n*) and `docs/requirements/02-INITIAL-CONTENT-SEED-SYSTEM.md` (cited as *SEED §n*).
> Predecessor documents: `PHASE-00-04.md`, `PHASE-05-09.md`, `PHASE-10-15.md`, `PHASE-16-22.md`,
> and `PHASE-23-30.md` (search, bulk, scraper foundation through the large-format workspace).

Phases 23–30 produce a research corpus: enabled sources, scheduled runs, extracted records,
normalised and validated rows, detected changes and a large-format workspace over the top. That
corpus is inert. This block turns it into judgement, and then stops — deliberately — one manual
step short of the catalogue.

Phase 31 measures the corpus and lets a researcher compare parts of it. Phase 32 scores it with a
formula a person can recompute by hand. Phase 33 tells you when two pictures are the same picture,
and says plainly when it does not know. Phase 34 gives a human a place to write a design direction
with the evidence attached. Phase 35 gives the two stages that already matter — `SHORTLISTED`,
`CONFIRMED` — the records and screens they have been missing, and adds the one hand-operated gate
between research and the real catalogue. Phase 36 pushes any of it into
a Google Sheet, one way only. Phase 37 finally fills the Studio Analytics tab that Phase 05 stubbed,
with a coverage figure beside every number. Phase 38 closes the System group: a read-only
environment page that never shows a secret, a documentation browser that only serves an allowlist,
and an operational log that is not the audit trail.

Nothing in this block writes to a public route, publishes a competitor's text or image, invents a
price, dimension, material, lead time or capability, or moves the project any closer to checkout,
payment or customer accounts. Nothing creates a product **automatically or by copying a field** —
Phase 35's bridge is a button a person presses, carrying a slug they typed, and it is narrowed by
name inside the isolation guard rather than merely promised in prose.

## Assumed predecessor surface (Phases 25–30)

Every phase below reads tables that `PHASE-23-30.md` owns. **That document is authoritative for
their names.** If this document spells one differently, this document is wrong and the correct
repair is a rename here plus an `Amendments` entry — never a second table. The columns listed are
the ones this block depends on; each table has more. Every name below is quoted from
`PHASE-23-30.md`'s **Database** tables, with the phase that introduced it in the last column.

| Assumed table | Columns this block relies on | From | Consumed by |
|---|---|---|---|
| `research_sources` | `id`, `slug citext`, `name`, `base_url`, `region`, `currency char(3)`, `source_type`, `analytics_league`, `collection_mode`, `image_extraction_mode`, `adapter_key`, `is_enabled`, `policy_status`, `rate_limit_rpm`, `request_delay_ms`, `concurrency` | 25, 26 | 31, 32, 33, 36, 37 |
| `research_source_category_map` | `id`, `source_id`, `source_label`, `source_path`, `category_id uuid references categories`, `is_ignored` | 26 | 31, 37 |
| `research_source_health_v` (view) | `source_id`, `last_run_at`, `last_run_status`, `success_rate_7d`, `queue_depth`, `health` | 26 | 31, 37 |
| `research_runs` | `id`, `job_id`, `source_id`, `status research_run_status`, `trigger research_trigger`, `queued_at`, `started_at`, `finished_at`, `stats jsonb`, `error_summary`, `is_dry_run` | 25 | 31, 33, 37 |
| `research_fetches` | `id`, `run_id`, `source_id`, `url`, `final_url`, `http_status`, `robots_decision`, `content_hash`, `bytes`, `duration_ms`, `storage_key`, `fetched_at`, `error` | 25 | 33 |
| `research_products` | `id`, `source_id`, `source_url`, `source_external_id`, `stage research_stage`, `disposition research_disposition`, `first_seen_at`, `last_seen_at`, `current_version_id`, `title_normalized`, `brand_text`, `currency char(3)`, `price_state`, `price_min_minor bigint`, `price_max_minor bigint`, `dimensions_mm jsonb`, `dimension_parse_state`, `material_tokens text[]`, `availability`, `variant_count`, `image_urls text[]`, `category_labels text[]`, `matched_category_id`, `match_confidence`, `match_method`, `duplicate_of_id`, `normalized_overrides jsonb`, `scale_band`, `is_large_format boolean` (nullable), `longest_axis_mm`, `large_format_source` | 25, 28, 30 | all eight |
| `research_product_versions` | `id`, `research_product_id`, `run_id`, `fetch_id`, `raw jsonb`, `content_hash`, `storage_key`, `adapter_key`, `adapter_version`, `observed_at`, `normalized jsonb`, `normalizer_version` | 27, 28 | 31, 32, 33, 34 |
| `research_changes` | `id`, `research_product_id`, `source_id`, `field`, `change_kind`, `materiality`, `before jsonb`, `after jsonb`, `version_before_id`, `version_after_id`, `run_id`, `snapshot_before_key`, `snapshot_after_key`, `detected_at`, `decided_action`, `decided_by`, `decided_at` | 29 | 31, 32, 35 |
| `research_pipeline_events` | `id`, `entity_type`, `entity_id`, `from_stage`, `to_stage`, `actor_user_id`, `actor_kind`, `reason`, `occurred_at` | 25 | 35 |
| `research_review_actions` | `id`, `research_product_id`, `change_id`, `action`, `reason`, `actor_user_id`, `actor_role`, `occurred_at`, `undone_by_action_id` | 29 | 35 |
| `research_tags` · `research_product_tags` | `id`, `slug citext`, `label`, `colour`, `is_enabled` · `(research_product_id, tag_id)` composite PK, `assigned_by`, `assigned_at` | 29 | 34, 35 |
| `research_notes` | `id`, `research_product_id`, `body`, `author_user_id`, `created_at`, `superseded_by` | 29 | 34, 35 |

**The pipeline enum this block inherits, and does not extend.** `PHASE-23-30.md` fixes
`research_stage` at exactly the seven FEAT §23 values — `RAW · NORMALIZED · VALIDATED · MATCHED ·
REVIEW · SHORTLISTED · CONFIRMED` — and states that **rejection is not a stage**: `IGNORED ·
REJECTED · DUPLICATE` are values of the separate `research_disposition` column, whose fourth value
is `NONE`. `SHORTLISTED` and `CONFIRMED` therefore already exist, delivered by Phases 25 and 29;
Phase 35 below adds neither, adds no eighth value, and creates no second transition log. There is
no `research_pipeline_state` type anywhere in this project, and no `research_product_images` or
`research_product_snapshots` table — competitor images are `research_products.image_urls text[]`
(Phase 28) and per-run evidence is `research_product_versions` plus the `snapshot_*_key` storage
keys on `research_changes`.

**The isolation invariants this block inherits.** `PHASE-23-30.md` states I1–I4 and enforces them
with `scripts/research/check-research-isolation.mjs`, `scripts/research/check-no-autoimport.mjs`
and `tests/unit/research-isolation.test.ts`. Two of them constrain new schema in this block
directly:

- **I1** — no `research_*` table may have a foreign key to, or be referenced by, `products`,
  `categories`, `collections`, `materials`, `media_assets`, `portfolio_projects`,
  `journal_articles`, `pages`, `page_sections`, `product_relations` or `content_relations`, **except**
  the two allowlisted taxonomy references (`research_source_category_map.category_id`,
  `research_products.matched_category_id`). The guard's allowlist holds exactly those two constraint
  names and fails on a third. **No phase in this block adds a third**; where one was tempted — the
  media hashes in Phase 33 and the target category in Phase 34 — the schema is arranged to avoid it,
  and the arrangement is stated where it occurs.
- **I4** — as literally written, there is no code path of any kind that writes to `products` from a
  `research_*` read. Phase 35's manual bridge is the one place in this block that touches that
  sentence; it does not proceed on an assertion of compliance but on an explicit, narrow, proposed
  amendment recorded in *Open questions* 11.

## Conventions used by all eight phases

| Convention | Value |
|---|---|
| Migration blocks | 31 → `0290–0299`, 32 → `0300–0309`, 33 → `0310–0319`, 34 → `0320–0329`, 35 → `0330–0339`, 36 → `0340–0349`, 37 → `0350–0359`, 38 → `0360–0369` |
| Migration filename | `supabase/migrations/<nnnn>_phase<nn>_<subject>.sql`, forward-only |
| Permission naming | `<domain>.<action>`, the **dot** form owned by `lib/auth/permissions.ts` (Phase 04). See *Inherited-name reconciliation* |
| Route notation | `/studio/...` = D4 Studio route; `app/api/...` = route handler; no D3 public route is touched anywhere in this block |
| Data-layer rule | only `lib/supabase/repositories/**` may call `.from(...)` (Phase 03), enforced by `scripts/db/check-data-layer.mjs` |
| Research isolation | I1–I4 above, already enforced by `scripts/research/check-research-isolation.mjs` (Phase 25) and `scripts/research/check-no-autoimport.mjs` (Phase 29). This block adds **no second guard**: Phase 33 and Phase 34 keep their new tables inside I1 without an allowlist entry, and Phase 35 amends the existing I4 rule *in that script* rather than writing a new check elsewhere |
| Never automatic | no research row, score, similarity pair, direction brief or Sheet cell ever creates, edits, publishes or unpublishes a Rivya product, page or media row (FEAT §25). Exactly two things in the block act without a person asking, and both only ever **prevent**: Phase 33's upload guard refuses a duplicate before insert, and Phase 35's stage trigger refuses a write made outside `stage.ts` |
| Competitor image bytes | Never persisted, in any phase. Phase 33 fetches them transiently to hash them, behind four gates and an amendment the owner must accept before the flag may be turned on; nothing else in the block touches them. See Phase 33 and *Open questions* 12 |
| Coverage rule | every analytic number this block renders carries `n`, its denominator and an `as of` timestamp. A metric with no data renders `UNAVAILABLE` with a named reason and is never estimated, interpolated or filled (FEAT §28) |
| Never invented | product names presented as inventory, prices, dimensions, materials, lead times, delivered projects, clients, testimonials, awards, certifications, durability claims (D10, FEAT §38, SEED §32/§55) |
| Competitor content | competitor titles, descriptions, prices and images are research references only (SEED §40). None is ever copied into a Rivya row, rendered on a public route, or exported to a customer-facing surface |
| Feature flags | new flags are registered in `lib/flags/flags.ts` (Phase 19), default `false`, toggled at `/studio/system/flags` by owner or admin |

### Permissions added by this block

Added to the Phase 04 matrix in `lib/auth/permissions.ts`, regenerated into SQL by
`scripts/auth/gen-role-sql.ts`, and back-written into the matrix table in `PHASE-00-04.md` by
whichever phase adds them. Roles not listed hold the permission not at all.

| Permission | Phase | owner | admin | editor | merchandiser | researcher | viewer |
|---|---|---|---|---|---|---|---|
| `research.score.manage` | 32 | ✓ | ✓ | — | — | — | — |
| `research.similarity.run` | 33 | ✓ | ✓ | — | — | ✓ | — |
| `research.direction.write` | 34 | ✓ | ✓ | — | ✓ | ✓ | — |
| `research.direction.approve` | 34 | ✓ | ✓ | — | ✓ | — | — |
| `integrations.sheets.manage` | 36 | ✓ | ✓ | — | — | — | — |
| `integrations.sheets.run` | 36 | ✓ | ✓ | — | ✓ | ✓ | — |
| `system.environment.read` | 38 | ✓ | ✓ | — | — | — | — |
| `system.docs.read` | 38 | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `operations.logs.export` | 38 | ✓ | ✓ | — | — | — | — |

Existing permissions this block reuses unchanged: `research.read`, `research.write`,
`research.confirm`, `analytics.read`, `catalog.write`, `bulk.execute`, `destructive.execute`,
`inquiries.export`, `operations.logs.read`, `operations.audit.read`, `system.flags.write`.

### Inherited-name reconciliation

`PHASE-10-15.md` and `PHASE-00-04.md` write permissions as `<domain>.<action>` (`research.read`);
`PHASE-16-22.md` writes `<resource>:<action>` (`catalog:write`). This document uses the **dot**
form, because Phase 04 owns the module that declares the `Permission` union type and its matrix is
the one CI checks for drift. The divergence is restated in *Open questions*; nothing below depends
on which spelling wins.

### Shared D9 completion checklist

Every phase inherits all ten points of D9 and is **not COMPLETE** until each is true:

- [ ] 1. Scope implemented
- [ ] 2. Relevant tests run
- [ ] 3. No known scope-breaking error
- [ ] 4. Documentation updated (per the D7 map and FEAT §43)
- [ ] 5. `CHANGELOG.md` updated
- [ ] 6. `PROJECT_STATE.md` updated
- [ ] 7. `docs/SESSION-STATE.md` updated with the FEAT §40 field set
- [ ] 8. Remaining issues documented
- [ ] 9. Next phase identified
- [ ] 10. Repository remains recoverable (migrations replay from clean, no uncommitted generated state)

---

## PHASE 31 — Analytics + Comparison

**Goal** — The research corpus becomes measurable. A researcher can ask three questions of the
competitor set and get an answer with its own error bars attached: what is actually being made and
in what proportion (assortment), at what price levels and how those levels are spaced (price
architecture), and at what physical sizes (dimensions). The same phase gives them a workbench —
`/studio/research/compare` — where a named set of research products or whole sources is put
side by side and the three analyses run over just that set. Every figure produced here carries the
number of rows it was computed from and the number it *could* have been computed from, so nobody
ever reads a median derived from four records as though it described a market. After this phase the
Studio holds evidence; it still holds no opinion.

**Depends on** — Phase 26 (sources, currency, `research_source_category_map`, `analytics_league`,
`research_source_health_v`), Phase 27 (extraction, `research_product_versions`), Phase 28
(normalisation and validation: `price_state`, `price_min_minor`, `price_max_minor`, `dimensions_mm`,
`dimension_parse_state`, `material_tokens`, `matched_category_id`), Phase 29 (change detection),
Phase 30 (`scale_band`, `is_large_format`, `longest_axis_mm`, and the workspace's filters), Phase 05
(`DataTable`, `FilterBar`, `StatCard`, `EmptyState`), Phase 03 (repository layer).

**Scope**

- `lib/scraper/analytics/` gains five pure, side-effect-free modules — `assortment.ts`,
  `price-architecture.ts`, `dimensions.ts`, `coverage.ts`, `bands.ts` — each taking an array of
  normalised research rows and returning a typed result plus its coverage record. No module reads
  the database; the repository fetches, the module computes, the route renders.
- The **coverage record**, returned beside every result and stored with every snapshot:
  `{ metric_key, n, denominator, coverage_pct, excluded_reasons: Record<string, number>, as_of }`.
  `excluded_reasons` is a count per reason (`no_price`, `quote_only_price`, `ambiguous_currency`,
  `no_dimensions`, `dimensions_unparsed`, `unmapped_category`, `stale`), so a thin result explains
  itself rather than looking like a small market.
- **Assortment analysis** — per enabled source and per mapped category: live item count, share of
  that source's assortment, large-format share (`is_large_format`, three-valued, so `true`, `false`
  and `unknown` are all reported), share of items carrying a parsed price, and first/last-seen
  spread. Categories are the seven D3 categories reached through `research_products.matched_category_id`
  (set in Phase 28 from `research_source_category_map`); a row with `matched_category_id is null` is
  reported as `unmapped` and never silently distributed across the seven.
- **Price architecture** — a histogram of `price_min_minor` **within a single currency**, plus p10,
  p25, median, p75, p90 and the band edges. Only rows with `price_state in ('FIXED','STARTING_FROM')`
  and a non-null `price_min_minor` are included; `REQUEST_QUOTE`, `PRICE_ON_REQUEST` and `UNKNOWN`
  rows are excluded and counted under `quote_only_price`, never imputed as zero. For a range row
  (`STARTING_FROM`, carrying `price_max_minor`) the comparable point is `price_min_minor`, stated on
  the panel, and `price_max_minor` is used only for the range-width figure beside the histogram.
  Cross-currency comparison is refused by default: a set containing more than one currency renders
  one panel per currency with a notice, not a converted total. `bands.ts` produces bands by a
  declared rule (`QUANTILE` over the set, or `FIXED` edges entered by the researcher), and the rule
  used is stored with the result.
- **Dimension analysis** — width/depth/height/diameter in millimetres from `dimensions_mm`, only for
  rows with `dimension_parse_state = 'PARSED'`. `AMBIGUOUS` and `UNPARSED` rows are excluded and
  counted in `excluded_reasons.dimensions_unparsed`; there is no numeric confidence to threshold on,
  because Phase 28 records a parse **state** rather than a score, deliberately — it refuses to infer
  a unit from a magnitude, so a row either parsed or it did not. Outputs: per-axis percentiles, a
  longest-axis distribution built from `longest_axis_mm`, a width-versus-height scatter, and a
  "table-scale" cut (longest axis ≥ 1800 mm) that Phase 30's workspace already uses, so the two
  surfaces agree row for row.
- **Comparison sets** — a named, saved, Studio-visible selection. A set holds members of two kinds:
  whole sources, and individual research products. Sets are re-runnable; the analysis is recomputed
  against current data and a snapshot is written each time so a set has a history.
- **Snapshots** — `research_analytics_snapshots` stores one computed result payload per
  (scope, metric family) so `/studio/research/dashboard` and Phase 37 read a stored row rather than
  scanning the corpus on page load. `npm run research:analytics -- --snapshot` recomputes; a cron
  route recomputes nightly.
- A **coverage panel** added to `/studio/research/dashboard`: per source, rows captured, rows with a
  usable price, rows with `dimension_parse_state = 'PARSED'`, and — read straight from Phase 26's
  `research_source_health_v`, not recomputed here — `last_run_at`, `last_run_status`,
  `success_rate_7d` and `health`. This is the honest header the rest of the block inherits.
- Charts render through `components/patterns/charts/*` — token-driven inline SVG (`BarSeries`,
  `BandStrip`, `Scatter`, `Sparkline`), no new runtime dependency. Any external chart library must
  go through the FEAT §7 registry process first.

**Out of scope**

- Scoring, ranking or any statement that one product is a better opportunity than another — Phase 32.
- Image comparison of any kind — Phase 33.
- The Studio Analytics tab and every first-party metric — Phase 37. Phase 31 builds the competitive
  computation library; Phase 37 presents it beside first-party figures.
- Currency conversion. No FX rate source is configured, and inventing one would fabricate a
  business figure. Multi-currency comparison stays refused until a rate snapshot table is proposed
  and accepted.
- Exporting any of this to a spreadsheet — Phase 36.
- Any public surface. FEAT §19 forbids exposing scraper data publicly and this phase adds no route
  under `app/(site)/**`.
- Trend lines longer than the run history. A metric with fewer than two snapshots renders a single
  value, never a projected line.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Migration | `supabase/migrations/0290_phase31_research_analytics.sql` | comparison sets, members, snapshots, coverage |
| RLS | `supabase/migrations/0291_phase31_research_analytics_rls.sql` | staff-only; no `anon` policy on any table |
| Indexes | `supabase/migrations/0292_phase31_analytics_indexes.sql` | `(scope_type, scope_id, metric_family, computed_at desc)`, `(set_id, position)` |
| Assortment | `lib/scraper/analytics/assortment.ts` | `computeAssortment(rows, opts): AssortmentResult` |
| Price architecture | `lib/scraper/analytics/price-architecture.ts` | percentiles, histogram, band edges, per-currency split |
| Dimensions | `lib/scraper/analytics/dimensions.ts` | mm normalisation, per-axis percentiles, longest-axis buckets |
| Bands | `lib/scraper/analytics/bands.ts` | `QUANTILE` and `FIXED` band rules; pure |
| Coverage | `lib/scraper/analytics/coverage.ts` | the coverage record and its Zod schema; used by 32, 33, 37 |
| Repository | `lib/supabase/repositories/research-analytics.ts` | set CRUD, member CRUD, snapshot read/write |
| Row schemas | `lib/supabase/schemas/research-analytics.ts` | Zod for every new table |
| Compare list | `app/(studio)/studio/research/compare/page.tsx` | sets, owner, member count, last computed |
| Compare workbench | `app/(studio)/studio/research/compare/[setId]/page.tsx` + `actions.ts` | three analysis panels, recompute action |
| Set builder | `components/studio/research/ComparisonBuilder.tsx` | search sources and products, add, reorder, remove |
| Coverage badge | `components/studio/research/CoverageBadge.tsx` | `n / denominator · coverage% · as of`; reused by 32, 33, 37 |
| Charts | `components/patterns/charts/{BarSeries,BandStrip,Scatter,Sparkline}.tsx` | inline SVG, tokens only, `role="img"` + table fallback |
| Dashboard panel | `components/studio/research/SourceCoveragePanel.tsx` | mounted on `/studio/research/dashboard` |
| CLI | `scripts/research/analytics.ts` (`npm run research:analytics`) | `--snapshot`, `--scope=source:<slug>\|set:<id>\|corpus`, `--dry-run` |
| Cron | `app/api/cron/research-analytics/route.ts` | nightly snapshot; `REVALIDATE_SECRET` header, 401 without it |
| Docs | `docs/architecture/SCRAPER.md`, `docs/studio/STUDIO_GUIDE.md`, `docs/architecture/DATA_MODEL.md` | analysis definitions, the compare screen, four new tables |
| Tests | `tests/unit/analytics-assortment.test.ts`, `analytics-price.test.ts`, `analytics-dimensions.test.ts`, `analytics-coverage.test.ts`, `tests/e2e/research-compare.spec.ts` | fixed fixtures with hand-checked expected values |

**Database**

| Table | Change | Key columns |
|---|---|---|
| `research_comparison_sets` | new | `id uuid pk`, `name text not null`, `slug citext unique`, `description text`, `scope_note text`, `band_rule text not null default 'QUANTILE' check (band_rule in ('QUANTILE','FIXED'))`, `band_edges bigint[]`, `last_computed_at timestamptz`, `created_at`, `created_by uuid not null`, `updated_at`, `updated_by` |
| `research_comparison_members` | new | `id uuid pk`, `set_id uuid not null references research_comparison_sets(id) on delete cascade`, `member_type text not null check (member_type in ('SOURCE','RESEARCH_PRODUCT'))`, `source_id uuid null references research_sources(id) on delete cascade`, `research_product_id uuid null references research_products(id) on delete cascade`, `position int not null default 0`, `note text`, `created_at`, `created_by`; `check ((member_type = 'SOURCE') = (source_id is not null))`, `check ((member_type = 'RESEARCH_PRODUCT') = (research_product_id is not null))`, `unique (set_id, member_type, source_id, research_product_id)` |
| `research_analytics_snapshots` | new | `id uuid pk`, `scope_type text not null check (scope_type in ('CORPUS','SOURCE','SET','CATEGORY'))`, `scope_id uuid null`, `metric_family text not null check (metric_family in ('ASSORTMENT','PRICE_ARCHITECTURE','DIMENSIONS'))`, `currency char(3) null`, `payload jsonb not null`, `row_count int not null`, `computed_at timestamptz not null default now()`, `computed_by uuid null`, `input_run_max_id uuid null`; `unique (scope_type, scope_id, metric_family, currency, computed_at)` |
| `research_metric_coverage` | new | `id uuid pk`, `snapshot_id uuid not null references research_analytics_snapshots(id) on delete cascade`, `metric_key text not null`, `n int not null`, `denominator int not null`, `coverage_pct numeric(5,2) generated always as (case when denominator = 0 then 0 else round(100.0 * n / denominator, 2) end) stored`, `excluded_reasons jsonb not null default '{}'`, `as_of timestamptz not null` |

These are append-mostly operational tables, not content, so — like `activity_events` (Phase 05) —
they are a documented exemption from the D5 rule that content-bearing tables carry `status`,
`owner_verification` and `fact_classification`. `research_comparison_sets` does carry the full audit
column set because a human names and owns it.

RLS: no `anon` policy exists on any of the four tables. `select` requires `research.read`; insert
and update on sets and members require `research.write`; snapshots and coverage are written by the
service role only (CLI and cron), so no `insert` policy is granted to `authenticated` at all.

**Studio surface** — fills `/studio/research/compare` (set list, create, duplicate, delete behind
`ConfirmDialog`) and creates `/studio/research/compare/[setId]` (the workbench: **Members**,
**Assortment**, **Price architecture**, **Dimensions**, each panel headed by its `CoverageBadge`).
Adds the source-coverage panel to `/studio/research/dashboard`. Both routes call
`requirePermission('research.read')` server-side; mutations re-check `research.write`.

**Public surface** — None.

**Media** — None. No asset from `data/higgsfield/asset-manifest.json` is consumed, referenced or
generated. Competitor images are not rendered on this screen at all; the workbench shows titles,
sources and numbers, and links out to the source URL in a new tab.

**Risks**

| Risk | Mitigation |
|---|---|
| A median over six rows is read as a market fact | Every panel is headed by `CoverageBadge`; below a configurable floor (default `n < 12`) the panel renders the distribution but suppresses percentiles and shows `INSUFFICIENT SAMPLE`, asserted by a unit test |
| Currencies are silently mixed and produce a meaningless price band | `price-architecture.ts` throws `MixedCurrencyError` if handed rows of more than one currency; the route splits before calling it and renders one panel per currency |
| Dimension parse noise inflates the size distribution | Only `dimension_parse_state = 'PARSED'` rows are measured; `AMBIGUOUS` and `UNPARSED` rows are excluded, counted under `dimensions_unparsed` and displayed; an e2e test flips one row to `AMBIGUOUS` and asserts `n` drops by exactly one while `denominator` is unchanged |
| Unmapped categories quietly vanish and shares add to less than 100% | `unmapped` is a first-class bucket in the assortment result; a unit test asserts shares sum to 100 ± 0.01 including it |
| Recomputing the whole corpus on page load times out | Routes read `research_analytics_snapshots`; recompute is an explicit action or the cron; the CLI is the only full-corpus path and is measured in `tests/unit/analytics-*.test.ts` fixtures, not in the request path |
| A set silently changes meaning as sources are disabled | The snapshot stores `input_run_max_id` and `row_count`; the workbench shows "computed from N rows on <date>" and a stale badge when the corpus has grown since |
| Competitor imagery leaks into Rivya media | This phase never fetches or stores an image; `check-media-provenance` (Phase 06) already fails any `media_assets` row whose `source` is a research origin |

**Verification**

1. `npx supabase db reset && npx supabase db push` — `0290`–`0292` apply from clean; a re-run is a
   no-op.
2. `npm run test:unit -- analytics-assortment analytics-price analytics-dimensions analytics-coverage`
   — all pass against fixtures whose expected percentiles and shares are written in the test file
   by hand, not snapshotted from the implementation.
3. Seed the Playwright research fixture, whose composition is fixed so the assertions below are
   arithmetic rather than approximate: **three sources, 140 rows, two currencies** — sources A and B
   in `INR` (95 rows) and source C in `GBP` (45 rows) — **38 rows without a usable price** (26 `INR`,
   12 `GBP`, all in a quote or unknown `price_state`) and **51 rows whose `dimension_parse_state` is
   not `PARSED`**. Then `npm run research:analytics -- --scope=corpus --snapshot`.
4. Because `price-architecture.ts` throws `MixedCurrencyError` on mixed input, the route splits by
   currency before calling it and `research_analytics_snapshots` is keyed by `currency`, so a
   two-currency corpus produces **two** `PRICE_ARCHITECTURE` snapshots, not one. Assert both:

   ```sql
   select s.currency, c.n, c.denominator, c.coverage_pct
   from research_analytics_snapshots s
   join research_metric_coverage c on c.snapshot_id = s.id
   where s.scope_type = 'CORPUS' and s.metric_family = 'PRICE_ARCHITECTURE'
     and c.metric_key = 'price_architecture'
     and s.computed_at = (select max(computed_at) from research_analytics_snapshots
                          where scope_type = 'CORPUS' and metric_family = 'PRICE_ARCHITECTURE')
   order by s.currency;
   ```

   Expected: exactly two rows — `GBP` with `n = 33`, `denominator = 45`; `INR` with `n = 69`,
   `denominator = 95`. `sum(n) = 102` (140 − 38) and `sum(denominator) = 140`. **No row has
   `n = 102`**, and no snapshot exists with a null `currency` for this metric family — a combined
   figure across currencies is not merely unrendered, it is never computed.
5. Repeat step 4 against a single-currency scope for the scalar case:
   `npm run research:analytics -- --scope=source:source-a --snapshot`, then the same query with
   `scope_type = 'SOURCE'` — one row, `INR`, whose `denominator` equals source A's row count and
   whose `n + Σ excluded_reasons` equals that denominator.
6. Open `/studio/research/compare`, create a set with two sources of different currencies, recompute
   — two price panels render, each labelled with its currency, and no combined total appears
   anywhere on the page.
7. Remove one source so the set holds nine priced rows in a single currency; recompute — the price
   panel renders `INSUFFICIENT SAMPLE` and no median is shown.
8. Flip one fixture row's `dimension_parse_state` from `PARSED` to `AMBIGUOUS`, recompute the
   `DIMENSIONS` family — `n` falls by exactly one, `denominator` is unchanged, and
   `excluded_reasons->>'dimensions_unparsed'` rises by exactly one.
9. `npx playwright test tests/e2e/research-compare.spec.ts` — create, add members, reorder,
   recompute, read each coverage badge, delete behind the confirm dialog, at 1920 and 390.
10. As `viewer`, POST the recompute server action directly → 403 and a `DENIED` row in `audit_logs`.
    As `researcher` → succeeds.
11. `psql "$DATABASE_URL" -c "select count(*) from research_comparison_sets"` as the `anon` role —
    permission error, proving no public policy exists.
12. `npm run check:data-layer` — passes; no `.from(` outside the repositories.
    `node scripts/research/check-research-isolation.mjs` — passes; the four new tables add no
    referential constraint to any public table, so the I1 allowlist still holds exactly two entries.

**Exit criteria**

- [ ] The three analyses exist as pure modules with no database access, each unit-tested against
      hand-computed expectations.
- [ ] Every rendered figure in this phase is accompanied by `n`, denominator, coverage percentage
      and an `as of` timestamp.
- [ ] `excluded_reasons` accounts for every row not counted; `n + Σ excluded = denominator` is
      asserted by a unit test.
- [ ] Multi-currency price comparison is refused, not converted, and the refusal is visible to the
      user rather than silent: a two-currency scope stores two snapshots and never one combined row.
- [ ] Dimension analysis measures only `dimension_parse_state = 'PARSED'` rows and reports how many
      it excluded, under `dimensions_unparsed`.
- [ ] `/studio/research/compare` and `/studio/research/compare/[setId]` are filled, permission-gated
      and reachable from the research navigation.
- [ ] `/studio/research/dashboard` shows per-source coverage and staleness.
- [ ] No table in this phase has an `anon` policy; snapshots are service-role writes only.
- [ ] No competitor image is fetched, stored or rendered.
- [ ] Charts have a `role="img"` label and a screen-reader-reachable data table (FEAT §48).
- [ ] Phase-specific D9 evidence: docs updated = `SCRAPER.md`, `STUDIO_GUIDE.md`, `DATA_MODEL.md`;
      tests run = the four unit suites and `research-compare.spec.ts`; next phase = 32.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 32 — Opportunity Engine

**Goal** — Rivya gets a ranked view of where the market looks under-served, and — this is the whole
point of the phase — anyone can see exactly why a row is where it is. A score is the weighted mean
of seven declared signals, each normalised to 0–100 by a rule written in a versioned model file.
Every stored score keeps its own arithmetic: raw input, normalised value, weight and contribution
per signal, plus the model version that produced it. The Studio shows that arithmetic as a table
that adds up on screen, and a researcher with a pocket calculator can reproduce the total. There is
no machine-learning model, no language model, no embedding and no hidden term anywhere in this
phase. When the inputs are too thin, the engine returns `INSUFFICIENT_DATA` instead of a low number,
because a low score and an absent score mean opposite things.

**Depends on** — Phase 31 (assortment, price bands, dimension buckets, the coverage record), Phase
28 (validated fields and completeness: `price_state`, `price_min_minor`, `material_tokens`,
`matched_category_id`, and `research_product_versions.normalized`), Phase 30 (`is_large_format`,
three-valued), Phase 29 (`research_changes.materiality` for velocity), Phase 26 (enabled source
count and each source's `attribute_extraction` capabilities), Phase 14 (published Rivya products,
the first-party side of the gap signals).

**Scope**

- **Versioned scoring models.** `research_scoring_models` holds `version`, a `signals jsonb`
  document (key, weight, normalisation rule, minimum coverage, direction) and a lifecycle:
  `DRAFT → ACTIVE → RETIRED`. Exactly one model may be `ACTIVE` (partial unique index). A model
  becomes immutable the moment it leaves `DRAFT` — a trigger rejects any update to `signals` or
  `weights_total` on a non-draft row. Changing weights means publishing a new version, which means
  old scores keep pointing at the model that produced them.
- **The seven signals**, defined once in `lib/scraper/analytics/opportunity/signals/` (one file per
  signal, each exporting `key`, `describe()`, `inputs()`, `normalise()`), and seeded as model
  version `v1`:

| Signal key | Question it answers | Input | Normalisation to 0–100 | Weight | Minimum coverage |
|---|---|---|---|---|---|
| `category_gap` | how thinly does Rivya's published catalogue cover this mapped category? | count of `products` with `status='PUBLISHED'` in the mapped category | 0 → 100; ≥ 12 → 0; linear between | 20 | none (a first-party count is always knowable, including zero) |
| `large_format_fit` | does it sit where SEED §56 says Rivya's priority sits? | `is_large_format` (three-valued), `matched_category_id` | the full table below | 20 | `is_large_format is not null` **and** `matched_category_id is not null` |
| `price_band_gap` | is this price band unoccupied by Rivya's published range? | the row's Phase 31 band, from `price_min_minor`, vs bands occupied by published Rivya products in the same currency | unoccupied → 100; adjacent → 50; occupied → 0 | 15 | the row's `price_state in ('FIXED','STARTING_FROM')` **and** ≥ 5 published Rivya products carrying a price in that currency |
| `assortment_density` | how many independent sources list something comparable? | distinct `source_id` in the same `matched_category_id` and band | 1 → 30; 2 → 60; ≥ 3 → 100 | 15 | ≥ 3 enabled sources |
| `change_velocity` | is this part of the market moving? | `research_changes` rows with `materiality = 'MATERIAL'` for the category in the last 90 days | 0 → 0; ≥ 10 → 100; linear between | 10 | ≥ 30 days of run history for the source |
| `customisation_signal` | does the market treat this as customisable, as Rivya's model assumes? | the `customization` token set in `research_product_versions.normalized` for the row's `current_version_id` (Phase 28) | present and true → 100; present and false → 0 | 10 | the source's `attribute_extraction` declares a `customization` key **and** the version's `normalized` payload carries the key |
| `material_adjacency` | is it made of what Rivya works in? | `research_products.material_tokens` ∩ the `materials` table's token vocabulary, compared in application code — no SQL join crosses the research boundary | matched share × 100 | 10 | `material_tokens` is non-empty for the row |

  **`large_format_fit` in full**, because a partial table is a licence to guess. `is_large_format` is
  three-valued (Phase 30 makes it `null` whenever `dimension_parse_state <> 'PARSED'` and no editor
  has overridden it), and `matched_category_id` is nullable, so the rule must resolve every
  combination of the seven D3 categories and the three flag states, plus the unmapped case:

| `matched_category_id` slug | `is_large_format = true` | `is_large_format = false` | `is_large_format is null` |
|---|---|---|---|
| `furniture` | 100 | **50** | excluded — `large_format_unknown` |
| `collectible-design` | 100 | 75 | excluded — `large_format_unknown` |
| `3d-resin` | 100 | 70 | excluded — `large_format_unknown` |
| `wall-statement-art` | 100 | 60 | excluded — `large_format_unknown` |
| `preservation` | 100 | 40 | excluded — `large_format_unknown` |
| `decor` | 100 | 25 | excluded — `large_format_unknown` |
| `gifts` | 100 | 10 | excluded — `large_format_unknown` |
| *unmapped* (`null`) | excluded — `unmapped_category` | excluded — `unmapped_category` | excluded — `unmapped_category` |

  The `false` column is SEED §56's priority ladder read literally: collectible/sculptural 75, 3D +
  resin 70, statement art 60, preservation 40, décor 25, gifts 10. `furniture` that is **not**
  large-format is the one cell SEED §56 does not name, because its tier 1 is "large-format
  furniture" and the scale is what puts it there. It scores **50** — above statement art because it
  is still Rivya's core craft, below collectible design because it is neither at the priority scale
  nor a collectible piece. That number is a judgement, it is written in the model file as a
  judgement, and changing it means publishing a new model version like any other weight.

  **Excluded is not zero.** Both exclusion paths lower `confidence` through the formula below; they
  never contribute a value of 0, which would read as "a poor fit" rather than "we do not know".
  `tests/unit/opportunity-signals.test.ts` asserts that all **24** combinations above — seven
  categories plus unmapped, times three flag states — resolve to either a number or a named
  exclusion reason, with no fall-through and no default.

- **The formula**, implemented once in `lib/scraper/analytics/opportunity/score.ts` and printed
  verbatim in `docs/architecture/SCRAPER.md`:

```text
included   = signals whose coverage requirement is met
raw        = Σ(weight_i × normalised_i) / Σ(weight_i)          for i in included
confidence = Σ(weight_i) / Σ(weight_all)
completeness = share of Phase 28 required fields present on the row
score      = round(raw × (0.6 + 0.4 × completeness))
state      = confidence < 0.5  →  INSUFFICIENT_DATA   (score is stored but never ranked)
```

- **Component storage.** One `research_opportunity_components` row per signal per score, holding
  the raw input as text, the normalised value, the weight, the contribution and — when excluded —
  the reason. The explain drawer renders these rows directly; it does not recompute, so what the
  user sees is what the database stored.
- **Recomputation is explicit.** `npm run research:score` and a Studio action recompute; nothing
  recomputes on read. A score row records `model_version`, `computed_at`, `computed_by` and
  `analytics_snapshot_id` (the Phase 31 snapshot its band inputs came from), so a score can be
  traced to the exact evidence.
- `/studio/research/opportunities`: a ranked, filterable `DataTable` (source, category, band,
  score, confidence, state, last computed) with a per-row **Explain** drawer, a model-version
  selector, and a persistent header stating the active model version and the date of the last run.
- A **model diff** view: two versions side by side, weight by weight, and the count of rows whose
  rank would move by more than ten places. Shown before a `DRAFT` model is activated.

**Out of scope**

- Any machine-learned, embedded, clustered or language-model-derived score. If a future phase wants
  one it needs a canonical amendment, because FEAT §22's prohibition on opaque scores is the design
  constraint here.
- Demand forecasts, sales estimates, revenue projections, margin estimates or recommended prices.
  Every one of those would be a fabricated business fact (D10).
- Any automatic consequence. A score of 100 does nothing except sort first.
- Shortlisting, rejecting or confirming — Phase 35 owns the states and the actions.
- Image or visual signals — Phase 33, and even then similarity never feeds the score without a new
  model version and an amendment to this document.
- Scoring Rivya's own products. This engine scores research rows only; `publication_readiness`
  (Phase 14, FEAT §22) is the first-party checklist and stays separate.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Migration | `supabase/migrations/0300_phase32_opportunity.sql` | models, scores, components, enums, immutability trigger |
| RLS | `supabase/migrations/0301_phase32_opportunity_rls.sql` | staff read; model writes owner/admin only |
| Seed model | `supabase/migrations/0302_phase32_model_v1.sql` | inserts model `v1` as `DRAFT`; activation is a human action |
| Signal modules | `lib/scraper/analytics/opportunity/signals/*.ts` | seven files, one per signal, pure |
| Score function | `lib/scraper/analytics/opportunity/score.ts` | the formula above; no I/O |
| Model registry | `lib/scraper/analytics/opportunity/model.ts` | Zod schema for `signals jsonb`; weight-sum assertion |
| Repository | `lib/supabase/repositories/research-opportunity.ts` | models, scores, components, ranked reads |
| Row schemas | `lib/supabase/schemas/research-opportunity.ts` | Zod per table |
| Opportunities route | `app/(studio)/studio/research/opportunities/page.tsx` + `actions.ts` | ranked table, filters, recompute action |
| Explain drawer | `components/studio/research/ScoreExplain.tsx` | component table that visibly sums to the total |
| Model manager | `components/studio/research/ScoringModelPanel.tsx` | version list, diff, activate behind `ConfirmDialog` |
| CLI | `scripts/research/score.ts` (`npm run research:score`) | `--model=<version>`, `--source=<slug>`, `--dry-run`, `--explain=<id>` |
| Cron | `app/api/cron/research-score/route.ts` | nightly, after the Phase 31 snapshot job; `REVALIDATE_SECRET` |
| Docs | `docs/architecture/SCRAPER.md`, `docs/studio/STUDIO_GUIDE.md`, `docs/architecture/DATA_MODEL.md` | the formula, every signal, the model lifecycle |
| Tests | `tests/unit/opportunity-signals.test.ts`, `opportunity-score.test.ts`, `opportunity-model-immutability.test.ts`, `tests/e2e/research-opportunities.spec.ts` | worked example verified by hand |

**Database**

| Table | Change | Key columns |
|---|---|---|
| `research_scoring_models` | new | `id uuid pk`, `version text unique not null`, `name text not null`, `description text`, `signals jsonb not null`, `weights_total int not null`, `min_confidence numeric(3,2) not null default 0.50`, `lifecycle text not null default 'DRAFT' check (lifecycle in ('DRAFT','ACTIVE','RETIRED'))`, `activated_at`, `activated_by`, `retired_at`, `created_at`, `created_by`, `updated_at`, `updated_by`; `check (weights_total = 100)`; partial unique index `where lifecycle = 'ACTIVE'` |
| `research_opportunity_scores` | new | `id uuid pk`, `research_product_id uuid not null references research_products(id) on delete cascade`, `model_id uuid not null references research_scoring_models(id)`, `model_version text not null`, `score int null check (score between 0 and 100)`, `raw numeric(6,2)`, `confidence numeric(4,3) not null`, `completeness numeric(4,3) not null`, `state text not null check (state in ('SCORED','INSUFFICIENT_DATA'))`, `analytics_snapshot_id uuid null references research_analytics_snapshots(id)`, `computed_at timestamptz not null default now()`, `computed_by uuid null`; `unique (research_product_id, model_id, computed_at)`; index `(model_id, state, score desc)` |
| `research_opportunity_components` | new | `id uuid pk`, `score_id uuid not null references research_opportunity_scores(id) on delete cascade`, `signal_key text not null`, `raw_input text`, `normalised numeric(6,2) null`, `weight int not null`, `contribution numeric(7,3) null`, `included bool not null`, `exclusion_reason text null`; `unique (score_id, signal_key)`; `check (included = (normalised is not null))` |

Immutability trigger, verbatim:

```sql
create or replace function public.freeze_active_scoring_model() returns trigger
  language plpgsql as $$
begin
  if old.lifecycle <> 'DRAFT'
     and (new.signals is distinct from old.signals
          or new.weights_total is distinct from old.weights_total
          or new.min_confidence is distinct from old.min_confidence) then
    raise exception 'scoring model % is % and its definition is immutable; publish a new version',
      old.version, old.lifecycle;
  end if;
  return new;
end $$;
```

RLS: `select` on all three requires `research.read`. `insert`/`update` on
`research_scoring_models` requires `research.score.manage` (owner, admin). Scores and components
are written by the service role only. No `anon` policy anywhere.

**Studio surface** — fills `/studio/research/opportunities`. Three regions: the ranked table
(default filter `state = 'SCORED'`, with an `INSUFFICIENT_DATA` tab that is visible, not hidden),
the explain drawer, and the model panel (owner/admin only) holding versions, the diff and the
activate action. The active model version and last computation date are rendered in the page header
on every load, so no score is ever read without its provenance.

**Public surface** — None.

**Media** — None.

**Risks**

| Risk | Mitigation |
|---|---|
| The score is treated as a fact about the market rather than a weighted opinion | The header states the model version and date; the explain drawer shows every term; `docs/architecture/SCRAPER.md` opens the section with the sentence that this is a ranking heuristic over research data, not a measurement of demand |
| Weights are quietly tuned until a favoured row ranks first | `DRAFT` is the only mutable lifecycle; activation is audited, requires `research.score.manage`, and shows the rank-movement diff first; every historical score keeps its `model_version` |
| Missing data produces a flattering score | Signals below their coverage requirement are excluded, not defaulted; exclusion lowers `confidence`; below `min_confidence` the row is `INSUFFICIENT_DATA` and is not ranked; the completeness multiplier caps a sparse row at 60% of its raw value |
| Two implementations of the formula drift (UI vs CLI) | `score.ts` is the only implementation; the UI renders stored components and never recomputes; `opportunity-score.test.ts` asserts the drawer's displayed total equals the stored `score` for a fixture row |
| `category_gap` inverts as the Rivya catalogue fills, and old scores mislead | Scores are stamped with `computed_at` and the snapshot id; the table shows a staleness badge past 14 days and the cron recomputes nightly |
| A signal quietly becomes uncomputable when an adapter changes | `exclusion_reason` is stored per component; a dashboard tile counts exclusions per signal per source, so a silently-broken adapter surfaces as a coverage collapse |

**Verification**

1. `npx supabase db push` — `0300`–`0302` apply. `select version, lifecycle, weights_total from
   research_scoring_models` returns one row, `v1`, `DRAFT`, `100`.
2. `npm run test:unit -- opportunity-signals opportunity-score` — includes a worked example: a
   fixture row whose seven normalised values and weights are written in the test, whose expected
   `raw`, `confidence`, `completeness` and `score` are written as literals, and which fails if the
   implementation changes any of them. `opportunity-signals` additionally enumerates the 24
   `large_format_fit` combinations (seven D3 categories plus unmapped × `true`/`false`/`null`) and
   asserts each returns either the tabled number or the named exclusion reason.
3. `psql "$DATABASE_URL" -c "update research_scoring_models set lifecycle='ACTIVE' where
   version='v1'"`, then attempt `update research_scoring_models set signals='{}'::jsonb where
   version='v1'` — rejected by `freeze_active_scoring_model` naming the version.
4. `npm run research:score -- --model=v1` over the Phase 31 fixture corpus; then
   `psql "$DATABASE_URL" -c "select s.score, sum(c.contribution) from research_opportunity_scores s
   join research_opportunity_components c on c.score_id = s.id where c.included group by s.id,
   s.score limit 5"` — every row's component sum, after the completeness multiplier, reproduces the
   stored score to within rounding.
5. `npm run research:score -- --explain=<research_product_id>` prints the component table to stdout;
   compare it line by line with the Studio drawer for the same row — identical values.
6. Disable two of the three fixture sources so `assortment_density` and `price_band_gap` fall below
   coverage; recompute — those rows return `state='INSUFFICIENT_DATA'`, are absent from the ranked
   tab, present in the `INSUFFICIENT_DATA` tab, and their components carry an `exclusion_reason`.
7. As `researcher`, POST the model-activate action → 403 with a `DENIED` audit row. As `admin` →
   the diff renders first and activation succeeds with an `activity_events` row.
8. `npx playwright test tests/e2e/research-opportunities.spec.ts` — rank, filter, open the drawer,
   assert the on-screen arithmetic sums to the displayed total, switch model version, at 1920/390.
9. `grep -rniE "machine learn|embedding|openai|llm|neural" lib/scraper/analytics/opportunity/` —
   no match, asserted as a CI check.

**Exit criteria**

- [ ] Exactly one `ACTIVE` model can exist, enforced by a partial unique index.
- [ ] A non-draft model's definition cannot be changed, enforced by trigger and proven by test.
- [ ] Every score stores its model version, its inputs' snapshot id and one component row per signal.
- [ ] The explain drawer's numbers are read from storage and visibly sum to the stored total.
- [ ] The formula in `docs/architecture/SCRAPER.md` is character-identical to `score.ts` and a unit
      test asserts a hand-computed example.
- [ ] Signals below their coverage requirement are excluded with a stored reason and lower the
      confidence rather than defaulting to zero — including `large_format_fit` on an unmapped
      category or a `null` `is_large_format`.
- [ ] `large_format_fit` resolves every one of the 24 category × flag combinations to a number or a
      named exclusion, with no default branch, proven by an exhaustive unit test.
- [ ] `INSUFFICIENT_DATA` rows are visible but never ranked.
- [ ] No ML, embedding, clustering or language-model call exists in the scoring path (CI grep).
- [ ] No score triggers any action on any Rivya product, page or media row.
- [ ] Model activation requires `research.score.manage`, shows a rank-movement diff, and is audited.
- [ ] Phase-specific D9 evidence: docs updated = `SCRAPER.md`, `STUDIO_GUIDE.md`, `DATA_MODEL.md`;
      tests run = three unit suites and `research-opportunities.spec.ts`; next phase = 33.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 33 — Visual Similarity

**Goal** — The Studio can answer "have we seen this picture before?" reliably, and "does this look
like that?" honestly. Perceptual hashing finds near-duplicates across sources, relistings of the
same item and re-crops of the same shoot, at a precision worth acting on. An optional embedding
path, behind a feature flag that ships off, finds loosely similar form and palette at a precision
that is not worth acting on alone — and the interface says so, in words, next to every pair it
shows. The phase also turns the same machinery inward: a Rivya media upload is checked against both
the research hash corpus and Rivya's own, so a competitor's photograph can never quietly become
Rivya media and a manifest asset cannot be re-uploaded as if it were new photography. No result from
this phase is ever described as "the same product", because two identical photographs prove a shared
image, not a shared object.

**Where the bytes come from — the one rule this phase amends.** `PHASE-23-30.md` stores competitor
images as `research_products.image_urls text[]` and nothing else. It says at Phase 26 that "**no
mode downloads or re-hosts an image**" and at Phases 28/29 that "**no image is fetched, measured by
download, cached**". There is therefore no stored byte and no checksum anywhere for this phase to
hash, and hashing without fetching is impossible. **This phase amends that rule, narrowly and
explicitly**, rather than pretending the bytes already exist:

| The amendment | Detail |
|---|---|
| What is fetched | Each entry of `research_products.image_urls`, once, at hash time |
| Under what governance | The **existing** Phase 25 politeness path — `lib/scraper/core/fetch.ts`, `robots.ts` and `rate-limit.ts` — so an image request is rate-limited, delayed, circuit-broken and robots-checked exactly like a page request, and a `DISALLOWED` decision performs no request. Every image fetch writes a `research_fetches` row with `storage_key = null` |
| What is kept | The 64-bit pHash, the 64-bit dHash, the SHA-256 `checksum` of the bytes, the source URL, and `source_image_key` = SHA-256 of the normalised URL. Nothing else |
| What is **not** kept | The bytes, in any form: no file, no buffer written to disk, no Supabase Storage object, no Cloudinary upload, no `media_assets` row, no thumbnail, no snapshot, no width, no height, no dominant colour, no EXIF. The decoded pixels exist only inside one function call and are released before it returns |
| What gates it | `research.enabled` (the master kill switch), a new per-source `image_hashing_enabled bool not null default false` on `research_sources`, a source `policy_status = 'APPROVED'`, and the new `research_image_hashing` flag, default `false`. All four must be true; any one false and the run skips that source with a stated reason |
| Where it is raised | *Open questions* 12, with the exact amendment text `PHASE-23-30.md` would need. Until the owner accepts it, `research_image_hashing` stays off and this phase ships the first-party half only |

A hash is not a copy: a 64-bit reduction cannot reconstruct an image and is not a substitute for
one. But a fetch is still a request to somebody else's server, which is why it is governed by the
politeness machinery rather than by a new one.

**Depends on** — Phase 25 (`fetch.ts`, `robots.ts`, `rate-limit.ts`, `research_fetches`, the
`research.enabled` kill switch), Phase 26 (`policy_status`, `image_extraction_mode`), Phase 27/28
(`image_urls` extraction and normalisation), Phase 31 (the coverage record), Phase 06/07
(`media_assets` and the migrated Higgsfield corpus, as the first-party side of the duplicate check),
Phase 19 (`feature_flags`).

**Scope**

- **Hashing.** `lib/scraper/analytics/similarity/` implements `dhash.ts` and `phash.ts` — 64-bit
  difference and DCT perceptual hashes over an 8×8 / 32×32 grayscale reduction — plus `hamming.ts`.
  Both take a decoded pixel buffer and return a `bit(64)` string; neither performs I/O, so the
  fetch, the decode and the discard all live in `lib/scraper/analytics/similarity/hash-run.ts`,
  which is the only module anywhere in the repository that touches a **competitor's** image bytes.
  (`lib/media/hashes.ts` handles Rivya's own uploads and never fetches anything.) Hashes are stored
  as `bit(64)` so PostgreSQL computes Hamming distance in SQL.
- **Two hash tables, on two sides of the isolation boundary.** Research-side hashes live in
  `research_image_hashes`, keyed to `research_products`. Rivya-side hashes live in
  `media_asset_hashes`, keyed to `media_assets` and owned by `lib/media/`. They are **never joined**:
  I1 forbids a `research_*` table from referencing `media_assets` and forbids a third allowlisted
  constraint in either direction, so `checkMediaAgainstResearch()` reads one table, reads the other,
  and compares in TypeScript. Two repository calls, no SQL join, no foreign key, no allowlist entry.
- **Runs.** A similarity run takes a scope (whole corpus, one source, one comparison set, one
  research product, or one `media_assets` row), computes missing hashes, then compares. Comparison
  is blocked into buckets by the top 16 bits of the pHash to avoid an O(n²) sweep; the bucket rule
  and its recall trade-off are documented, because a blocking scheme that silently misses pairs is
  worse than a slow one. A `MEDIA_ASSET` scope is the one scope that **stores no pair row**:
  `research_similarity_pairs` references `research_image_hashes` on both sides by design, so a
  Rivya-versus-research comparison returns its verdict to the caller and records only the run's
  counts. There is nowhere in the schema for a cross-corpus pair to live, and that is deliberate.
- **Hashing is idempotent by URL key, not by checksum.** A `source_image_key` already present for a
  `research_product_id` is not re-fetched; `--rehash` is the only way to make a second request for
  the same URL. This is both a correctness rule and a politeness one: a nightly re-run must cost the
  source zero requests.
- **Bands, and what each one is allowed to claim.** This table is rendered in the Studio next to
  every result set, not only written in the docs:

| Band | Method | Threshold | What it reliably means | What it does **not** mean |
|---|---|---|---|---|
| `NEAR_DUPLICATE` | pHash, 64-bit | Hamming ≤ 6, **including distance 0** | the same image file, or a re-encode, resize or mild crop of it | that the two listings are the same physical object, or that either seller made it |
| `PROBABLE_VARIANT` | pHash | 7–12 | very likely the same photo shoot, set or listing family | that the products are the same, or comparable in size or price |
| `WEAK` | pHash | 13–18 | similar composition, crop or palette | anything at all about the object, its material or its maker |
| `FORM_SIMILAR` | embedding, cosine | ≥ 0.86 | similar visual form and material impression, at low precision | similarity of design, dimensions, construction, or that one copies the other |

  Pairs above the `WEAK` ceiling are discarded, not stored. `FORM_SIMILAR` exists only when the
  `advanced_similarity` flag is on.
- **Byte-identical images are a result, not a deduplication.** Two sources listing the same image
  file produce **two** hash rows — one per `(research_product_id, source_image_key)` — with the same
  `checksum`, and the run stores a `NEAR_DUPLICATE` pair between them at distance 0. `checksum` is
  indexed but **not unique**: collapsing byte-identical rows into one would delete exactly the fact
  the phase exists to surface, and would make it impossible to hold a Rivya asset that happens to be
  byte-identical to a research image — the single case the upload guard is built for. The run
  reports exact matches separately in its counts (`pairs_exact`) so "the same file, twice" is
  distinguishable on screen from "≤ 6 bits apart".
- **Honest precision.** The thresholds above are thresholds, not accuracy claims. Before the flag
  may be turned on in production, a researcher labels a stratified sample of 200 candidate pairs
  (50 per band) as correct or incorrect, and the measured precision per band is recorded in
  `docs/architecture/SCRAPER.md` with the sample date and size. Until that table exists, the Studio
  renders `PRECISION NOT YET MEASURED` beside the band legend. No precision figure is ever written
  down that was not measured on this corpus.
- **Embeddings, optional.** `embed.ts` behind `advanced_similarity`. If `pgvector` is unavailable
  the flag cannot be enabled and the Studio says why. Embeddings are stored with `model_name` and
  `dim`; a model change invalidates the table rather than mixing spaces, enforced by a check that a
  run may only compare embeddings sharing `model_name`.
- **Rivya-side duplicate guard.** `checkMediaAgainstResearch(bytes)` runs in the Phase 06 upload path
  **before** a `media_assets` row is inserted — it hashes the incoming bytes in memory, then makes two
  reads: `media_asset_hashes` (is this already a Rivya asset?) and `research_image_hashes` (is this a
  competitor's photograph?). A `NEAR_DUPLICATE` match on either side blocks the upload with a named
  reason. Because it refuses before the insert, no row and no Cloudinary object is created, and there
  is nothing to link the two tables with. This is the phase's only automatic consequence, and it only
  ever *prevents* something.
- **Videos.** A perceptual hash over an 8×8 / 32×32 grayscale reduction is defined for a still image
  and for nothing else. `media_asset_hashes.phash` and `.dhash` are therefore **nullable**: a video
  row carries its SHA-256 `checksum` and null hashes, and the guard falls back to exact-checksum
  matching for it. A re-uploaded manifest video is caught; a re-encoded one is not, and the guard
  says so rather than implying a coverage it does not have.
- `/studio/research/similarity`: run launcher, run history, and a results view grouped into clusters
  with the band legend, the pair distance, both source links, and per-pair actions **Mark duplicate**
  (sets `disposition = 'DUPLICATE'` and `duplicate_of_id` through Phase 29's existing
  `review-actions.ts` — this phase adds no second write path for it) and **Dismiss pair** (stores a
  suppression so the pair never resurfaces).

**Out of scope**

- Any claim that two research products are the same product, or that one seller copied another.
  The interface has no such label and the schema has no such column.
- Feeding similarity into the Phase 32 score. A new model version and an amendment to this document
  would be required.
- Similarity between Rivya products (a first-party "related products" engine is Phase 23).
- **Persisting a competitor image in any form.** The amendment above buys exactly one thing: the
  right to fetch bytes, hash them and drop them. It does not buy a cache, a proxy, a thumbnail
  store, a width, a height, a colour histogram or a re-host. Results link out; they do not build a
  gallery of other people's photography.
- Any foreign key, view or SQL join between `research_image_hashes` and `media_asset_hashes`, or
  between either and `media_assets` on the research side (I1).
- Text similarity, description matching or title clustering — Phase 28 owns matching.
- Any public surface.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Migration | `supabase/migrations/0310_phase33_similarity.sql` | `research_image_hashes`, runs, pairs, suppressions, bands enum, `research_sources.image_hashing_enabled` |
| Migration | `supabase/migrations/0311_phase33_media_hashes.sql` | `media_asset_hashes` — a **first-party** table, in its own migration so a reviewer can see it is not part of the research schema |
| Optional migration | `supabase/migrations/0312_phase33_embeddings.sql` | `research_image_embeddings`; guarded by `create extension if not exists vector` and skipped cleanly when unavailable |
| RLS | `supabase/migrations/0313_phase33_similarity_rls.sql` | staff read; service-role writes; `media_asset_hashes` follows the Phase 06 `media_assets` read policy, not the research one |
| Hashers | `lib/scraper/analytics/similarity/{dhash,phash,hamming}.ts` | pure, no I/O, take a decoded pixel buffer, exhaustively unit-tested |
| Hash run | `lib/scraper/analytics/similarity/hash-run.ts` | the **only** module that fetches image bytes; uses Phase 25's `fetch.ts`/`robots.ts`/`rate-limit.ts`, writes a `research_fetches` row, discards the buffer |
| Blocking | `lib/scraper/analytics/similarity/blocking.ts` | prefix bucketing; documented recall trade-off |
| Bands | `lib/scraper/analytics/similarity/bands.ts` | the table above, as the single source of the thresholds |
| Embeddings | `lib/scraper/analytics/similarity/embed.ts` | flag-gated; `model_name` + `dim` recorded |
| Media hashes | `lib/media/hashes.ts` | first-party hashing of a `media_assets` upload; writes `media_asset_hashes`; nullable hashes for video |
| Media guard | `lib/media/duplicate-guard.ts` | `checkMediaAgainstResearch(bytes)`; two repository reads, compared in TypeScript; called by the Phase 06 upload path **before** insert |
| Repository | `lib/supabase/repositories/research-similarity.ts` | research hashes, runs, pairs, suppressions |
| Repository | `lib/supabase/repositories/media-hashes.ts` | `media_asset_hashes` only; imports nothing from the research repositories |
| Similarity route | `app/(studio)/studio/research/similarity/page.tsx` + `actions.ts` | launcher, history, cluster results |
| Band legend | `components/studio/research/SimilarityLegend.tsx` | renders the band table verbatim, including the "does not mean" column |
| Cluster view | `components/studio/research/SimilarityClusters.tsx` | remote thumbnails at ≤ 240 px rendered straight from the source URL, distance, source links, per-pair actions |
| CLI | `scripts/research/similarity.ts` (`npm run research:similarity`) | `--scope=`, `--method=phash\|embedding`, `--rehash`, `--dry-run` |
| CLI | `scripts/media/hash-media.ts` (`npm run media:hash`) | backfills `media_asset_hashes` over the existing library, including the migrated manifest |
| Sampling tool | `scripts/research/similarity-sample.ts` | draws the 200-pair stratified sample and writes a labelling CSV |
| Isolation guard | `scripts/research/check-research-isolation.mjs` (unchanged) | must still pass with an I1 allowlist of exactly two constraints — this phase adds no third |
| Flags | `lib/flags/flags.ts` | adds `advanced_similarity` and `research_image_hashing`, both default `false` |
| Docs | `docs/architecture/SCRAPER.md`, `docs/studio/STUDIO_GUIDE.md`, `docs/media/MEDIA_GUIDE.md`, `docs/ops/SECURITY.md` | bands, measured precision table, the upload guard, and the fetch-to-hash amendment with its four gates |
| Tests | `tests/unit/similarity-phash.test.ts`, `similarity-bands.test.ts`, `similarity-blocking.test.ts`, `similarity-no-persist.test.ts`, `tests/unit/media-duplicate-guard.test.ts`, `tests/e2e/research-similarity.spec.ts` | known-image fixtures with known distances; the no-persist test is load-bearing |

**Database**

| Table | Change | Key columns |
|---|---|---|
| `research_sources` | altered | `+ image_hashing_enabled bool not null default false`; `check (image_hashing_enabled = false or policy_status = 'APPROVED')`, mirroring the Phase 25 constraint on `is_enabled`. Setting it requires `research.write` **and** `system.settings.write` — the same pair Phase 26 requires to enable a source at all, because both decisions commit Rivya to making requests of somebody else's server |
| `research_image_hashes` | new | `id uuid pk`, `research_product_id uuid not null references research_products(id) on delete cascade`, `source_id uuid not null references research_sources(id) on delete cascade`, `source_image_url text not null`, `source_image_key text not null` (SHA-256 of the normalised URL), `position int not null default 0`, `checksum text not null` (SHA-256 of the fetched bytes), `phash bit(64) not null`, `dhash bit(64) not null`, `fetch_id uuid null references research_fetches(id) on delete set null`, `computed_at timestamptz not null default now()`; `unique (research_product_id, source_image_key)`; index on `checksum` (**not unique**); index on `substring(phash from 1 for 16)`; index `(source_id)` |
| `media_asset_hashes` | new, **first-party** | `id uuid pk`, `media_asset_id uuid not null unique references media_assets(id) on delete cascade`, `kind text not null check (kind in ('IMAGE','VIDEO'))`, `checksum text not null`, `phash bit(64) null`, `dhash bit(64) null`, `computed_at timestamptz not null default now()`; index on `checksum` (**not unique**); partial index on `substring(phash from 1 for 16)` `where phash is not null`; `check ((kind = 'IMAGE') = (phash is not null))` |
| `research_similarity_runs` | new | `id uuid pk`, `scope_type text not null check (scope_type in ('CORPUS','SOURCE','SET','PRODUCT','MEDIA_ASSET'))`, `scope_id uuid null`, `method text not null check (method in ('PHASH','EMBEDDING'))`, `model_name text null`, `status text not null check (status in ('RUNNING','SUCCEEDED','FAILED'))`, `images_fetched int not null default 0`, `images_hashed int not null default 0`, `sources_skipped jsonb not null default '{}'` (source slug → skip reason), `pairs_considered bigint not null default 0`, `pairs_stored int not null default 0`, `pairs_exact int not null default 0`, `started_at`, `finished_at`, `error_code text`, `created_by uuid` |
| `research_similarity_pairs` | new | `id uuid pk`, `run_id uuid not null references research_similarity_runs(id) on delete cascade`, `left_hash_id uuid not null references research_image_hashes(id) on delete cascade`, `right_hash_id uuid not null references research_image_hashes(id) on delete cascade`, `method text not null`, `distance int null`, `cosine numeric(5,4) null`, `band similarity_band not null`, `created_at`; `check (left_hash_id < right_hash_id)`, `unique (run_id, left_hash_id, right_hash_id)` |
| `research_similarity_suppressions` | new | `id uuid pk`, `left_hash_id uuid not null`, `right_hash_id uuid not null`, `reason text not null`, `created_at`, `created_by uuid not null`; `unique (left_hash_id, right_hash_id)` |
| `research_image_embeddings` | new, optional | `id uuid pk`, `hash_id uuid unique not null references research_image_hashes(id) on delete cascade`, `model_name text not null`, `dim int not null`, `embedding vector not null`, `computed_at` |

New enum: `similarity_band` = `NEAR_DUPLICATE · PROBABLE_VARIANT · WEAK · FORM_SIMILAR`.

**Why the tables are split, and why that is not a formality.** I1 forbids any `research_*` table
from referencing `media_assets`, `check-research-isolation.mjs` reads
`information_schema.referential_constraints` to prove it, and its allowlist holds exactly two
constraint names with the note "there is never a third". A single `research_image_hashes` carrying
`media_asset_id uuid references media_assets(id)` would fail that guard in CI — not as a style
objection but as a failed build. So Rivya-side hashes live in `media_asset_hashes`, which is a
first-party table owned by `lib/media/` and may legitimately reference `media_assets`; research-side
hashes reference only research tables; and the cross-corpus comparison the guard performs happens in
application code, over two ordinary reads. Neither table names the other in any constraint, view or
query.

RLS: on the research tables, `select` requires `research.read`; run creation requires
`research.similarity.run`; suppressions require `research.write`; hashes, pairs and embeddings are
service-role writes; no `anon` policy. `media_asset_hashes` is not a research table and follows the
Phase 06 media policy instead: `select` requires `media.read`, writes are service-role only, and it
likewise has no `anon` policy — a hash is not published content.

**Studio surface** — fills `/studio/research/similarity`: a **Run** panel (scope, method, flag
state, an explicit note when `advanced_similarity` is off), **History** (`DataTable` of runs with
counts and duration), and **Results** (clusters, band legend, per-pair actions). The band legend is
not collapsible and is rendered above the first result, not behind a tooltip.

**Public surface** — None.

**Media** — None generated and no Higgsfield family consumed for display (D6, FEAT §33). The phase
writes a `media_asset_hashes` row for each of the manifest's **250 migrated assets** so the upload
guard can detect a Higgsfield asset being re-uploaded as if it were new photography — but it
computes a **perceptual** hash for only the **224 images** (`counts.image` in
`data/higgsfield/asset-manifest.json`). The **26 videos** (`counts.video`) are out of scope for
dHash/pHash: an 8×8 / 32×32 grayscale reduction is defined for a still frame, and picking one frame
of a video and calling it the video's hash would be a fabricated measurement. A video row therefore
carries `kind = 'VIDEO'`, its SHA-256 `checksum`, and `phash`/`dhash` null, and the guard catches a
re-uploaded video only by exact bytes. The screen renders none of the 250 and creates no new asset.

**Risks**

| Risk | Mitigation |
|---|---|
| A `WEAK` pair is read as evidence that two products are the same | The "does not mean" column ships in the UI, not just the docs; the band name never contains the word *same*; a unit test asserts the rendered legend contains all four "does not mean" strings |
| Precision numbers get invented to make the feature look good | No precision figure may exist in the repository unless `similarity-sample.ts` produced the sample it came from; the docs table has mandatory `sample_size` and `sampled_on` columns and CI fails if a precision cell is populated without them |
| The corpus grows and comparison becomes O(n²) | Prefix blocking with a documented recall trade-off; `pairs_considered` is recorded per run so a regression is visible; runs are CLI/action-triggered, never on page load |
| Blocking silently loses true matches | `similarity-blocking.test.ts` runs an unblocked brute-force comparison over a 2,000-image fixture and asserts recall ≥ 0.98 for `NEAR_DUPLICATE`; the measured recall is printed in the docs |
| A competitor image becomes Rivya media | The Phase 06 upload path calls `checkMediaAgainstResearch()` **before** the insert and blocks on `NEAR_DUPLICATE`; `media-duplicate-guard.test.ts` uploads a known research image and asserts rejection with a named reason, an `audit_logs` row, no `media_assets` row and no Cloudinary object |
| Embeddings from two different models are compared as if they shared a space | A run may only compare embeddings with matching `model_name`; a mismatch fails the run with `error_code = 'EMBEDDING_MODEL_MISMATCH'` |
| The fetch-to-hash amendment quietly widens into an image cache | `similarity-no-persist.test.ts` runs a full hash pass against a local fixture server and asserts: no file written under the process working directory, no Supabase Storage object created, no Cloudinary call made, no `media_assets` row inserted, and no column anywhere holding more than 64 bits of image-derived data. `hash-run.ts` is the only module permitted to import an image decoder, asserted by a CI grep |
| Image fetching hammers a source, or fetches a path robots disallows | Image requests go through the same `fetch.ts`/`robots.ts`/`rate-limit.ts` path as page requests, write a `research_fetches` row each, and honour the source's `request_delay_ms`, `rate_limit_rpm`, `concurrency`, `Crawl-delay` and circuit breaker. Four gates must all be true before a single request is made: `research.enabled`, `research_image_hashing`, `policy_status = 'APPROVED'` and `image_hashing_enabled` |
| A byte-identical pair is deduplicated away and the duplicate is never found | `checksum` is indexed but not unique on either table; one hash row exists per `(research_product_id, source_image_key)`; exact matches are stored as `NEAR_DUPLICATE` pairs at distance 0 and counted in `pairs_exact` |
| Storing thumbnails of other people's photography becomes a de-facto image archive | Thumbnails are rendered by the browser straight from the source URL at ≤ 240 px with `referrerpolicy="no-referrer"`; Rivya's servers proxy nothing and persist nothing; the phase stores hashes only |

**Verification**

1. `npx supabase db push` — `0310`, `0311` and `0313` apply; `0312` applies where `vector` is
   available and is skipped with a notice where it is not, without failing the run.
2. `node scripts/research/check-research-isolation.mjs` — passes. The I1 allowlist still holds
   exactly the two Phase 26/28 constraint names; `research_image_hashes` references only
   `research_products`, `research_sources` and `research_fetches`, and `media_asset_hashes`
   references only `media_assets`. Temporarily add
   `alter table research_image_hashes add column media_asset_id uuid references media_assets(id);`
   and confirm the guard fails naming the third constraint; revert. `npm run test:unit --
   research-isolation` — passes (I1–I4).
3. `npm run test:unit -- similarity-phash similarity-bands similarity-blocking` — includes fixture
   pairs with hand-known distances: identical file (0), re-encode at 80% JPEG quality (≤ 2), 10%
   centre crop (≤ 6), different object same background (≥ 14).
4. `npm run test:unit -- similarity-no-persist` — a full hash pass against a local fixture server
   leaves no file, no storage object, no Cloudinary call and no `media_assets` row. Temporarily make
   `hash-run.ts` write the buffer to a temp file and confirm the test fails; revert.
5. **The four gates, one at a time.** With `research_image_hashing` off, run
   `npm run research:similarity -- --scope=corpus --method=phash` → zero HTTP requests (fetch spy),
   `images_fetched = 0`, and every source listed in `sources_skipped` with reason `FLAG_OFF`. Turn
   the flag on but leave `image_hashing_enabled` false → same result with reason `SOURCE_OPT_OUT`.
   Set `image_hashing_enabled = true` on a source whose `policy_status` is `UNREVIEWED` → rejected
   by the check constraint. Turn `research.enabled` off → reason `KILL_SWITCH`.
6. Enable all four for one fixture source, then
   `npm run research:similarity -- --scope=source:fixture --method=phash` — `research_fetches` gains
   one row per fetched image URL, each with a `robots_decision` and `storage_key is null`; a URL
   under a robots-disallowed path records `DISALLOWED` and produces no request; the observed request
   spacing is ≥ the source's `request_delay_ms`.
7. `psql "$DATABASE_URL" -c "select band, count(*) from research_similarity_pairs group by band"` —
   no row with a distance above 18 exists. Then plant two research products in **different sources**
   carrying the identical image file and re-run: two `research_image_hashes` rows exist with the same
   `checksum` (proving `checksum` is not unique), and exactly one `research_similarity_pairs` row
   joins them with `band = 'NEAR_DUPLICATE'` and `distance = 0`, counted in `pairs_exact`.
8. `psql "$DATABASE_URL" -c "select count(*) from research_similarity_pairs where left_hash_id >=
   right_hash_id"` — zero, proving the ordering constraint prevents mirrored duplicates.
9. Open `/studio/research/similarity`; assert the band legend renders all four bands with their
   "does not mean" text, and that `PRECISION NOT YET MEASURED` is shown before the sample exists.
10. `npm run research:similarity -- --scope=source:fixture` twice — the second run reports
    `images_fetched = 0` and `images_hashed = 0` and makes zero HTTP requests (fetch spy), proving
    hashing is idempotent by `source_image_key`. Re-run with `--rehash` → requests are made again and
    the row count is unchanged.
11. `npm run media:hash` over the migrated manifest —
    `select kind, count(*), count(phash) from media_asset_hashes group by kind` returns
    `IMAGE 224 224` and `VIDEO 26 0`, matching `counts.image` and `counts.video` in the manifest.
12. Attempt to upload a file byte-identical to a research image through `/studio/media/all` → the
    upload is rejected before insert, the reason names the research source, `select count(*) from
    media_assets` is unchanged, and an `audit_logs` row exists with `result = 'DENIED'`. Repeat with a
    file byte-identical to a migrated manifest **video** → rejected on exact checksum against
    `media_asset_hashes`, with a reason that names the existing Rivya asset id.
13. With `advanced_similarity` off, POST the embedding-run action directly → 403/409 with a flag
    reason. Turn it on as `owner`, re-run → succeeds, or fails with a clear `pgvector` unavailable
    message where the extension is absent.
14. `npx playwright test tests/e2e/research-similarity.spec.ts` — run, cluster, dismiss a pair,
    assert it does not return on the next run, at 1920 and 390.

**Exit criteria**

- [ ] pHash and dHash are implemented as pure functions and validated against fixture pairs with
      hand-known distances.
- [ ] Bands, thresholds and the "does not mean" column exist in exactly one module and are rendered
      in the Studio above the results.
- [ ] No precision claim exists anywhere in the repository that was not produced by
      `similarity-sample.ts`, with sample size and date recorded.
- [ ] Blocking recall for `NEAR_DUPLICATE` is measured against brute force and documented.
- [ ] Pairs beyond the `WEAK` ceiling are discarded; mirrored pairs cannot exist.
- [ ] `checksum` is non-unique on both hash tables; two byte-identical images from two sources form a
      `NEAR_DUPLICATE` pair at distance 0 rather than collapsing into one row.
- [ ] Hashing is idempotent by `source_image_key`; a second run over an unchanged corpus makes zero
      HTTP requests and stores nothing new.
- [ ] Research hashes and Rivya hashes live in separate tables, neither referencing the other's
      corpus; `check-research-isolation.mjs` passes with an I1 allowlist of exactly two constraints,
      demonstrated to fail when a third is added.
- [ ] Image bytes are fetched only through the Phase 25 politeness path, only behind all four gates,
      and are never persisted in any form — proven by `similarity-no-persist.test.ts`, demonstrated
      to fail when a write is introduced.
- [ ] The amendment to `PHASE-23-30.md`'s no-download rule is written down, raised as *Open
      questions* 12, and `research_image_hashing` ships `false` until the owner accepts it.
- [ ] The Rivya upload guard blocks a near-duplicate of a research image **before** the
      `media_assets` insert and audits the refusal.
- [ ] `media_asset_hashes` covers all 250 manifest assets, with perceptual hashes on the 224 images
      and null hashes plus exact-checksum coverage on the 26 videos.
- [ ] `advanced_similarity` ships `false`, and embeddings are unreachable while it is off.
- [ ] No label anywhere in the UI, schema or docs asserts that two research products are the same
      product or that one copies another.
- [ ] No competitor image is persisted by Rivya; results link out and render at thumbnail scale
      directly from the source.
- [ ] Phase-specific D9 evidence: docs updated = `SCRAPER.md`, `STUDIO_GUIDE.md`, `MEDIA_GUIDE.md`,
      `SECURITY.md`; tests run = five unit suites and `research-similarity.spec.ts`; next phase = 34.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 34 — Product Direction Tool

**Goal** — Research becomes a written internal brief instead of a folder of tabs. A direction brief
is a Rivya document, authored by a person, that states what kind of piece the studio might develop
and why — scale intent, form language, material direction, finish direction, the questions still
open — with the evidence stapled to it: the comparison set it came from, the opportunity scores as
they stood, the similarity cluster that prompted it, the price and dimension bands observed. The
tool assembles the evidence automatically and writes not one sentence of prose. It has no path to
the catalogue: a brief cannot become a product, cannot be published, and cannot carry a Rivya price,
dimension, material claim or lead time. It is the artefact a maker reads before sketching.

**Depends on** — Phase 31 (comparison sets and snapshots), Phase 32 (scores and components), Phase
33 (clusters, where a run exists), Phase 30 (large-format workspace filters), Phase 08 (revision
history pattern), Phase 05 (`DrawerForm`, `StatusPill`, `ConfirmDialog`).

**Scope**

- **The brief**, `research_direction_briefs`, with a fixed section set so two briefs are comparable:
  `title`, `intent` (why now), `scale_intent`, `form_language`, `material_direction`,
  `finish_direction`, `constraints`, `open_questions`, `not_doing`. Every one of those is free prose
  written by a human and stored as text. The tool never pre-fills them, never suggests wording and
  never calls a language model.
- **Evidence attachment**, `research_direction_brief_evidence`: a typed row per attached item —
  `COMPARISON_SET`, `ANALYTICS_SNAPSHOT`, `OPPORTUNITY_SCORE`, `SIMILARITY_PAIR`, `RESEARCH_PRODUCT`,
  `RESEARCH_NOTE`, `MEDIA_ASSET` (Rivya concept media only, for mood) — each with a `rationale`
  written by the person attaching it. Evidence is captured **by value where it is volatile**: a
  score attachment stores the score, confidence and model version as they were at attachment time,
  in `captured jsonb`, alongside the id. A brief read a year later shows what its author saw.
- **Observed-versus-intended discipline.** The brief renders two visually distinct column types.
  *Observed* fields are numbers copied from research (price band observed across N sources,
  longest-axis p50 across N rows) and always carry their coverage badge and the words "observed in
  competitor research". *Intended* fields are Rivya's own direction and are prose only — a brief may
  say "scale intent: dining-table scale, longest axis around two metres" but may not populate a
  dimensions field, because a Rivya dimension does not exist until a maker makes one.
- **Lifecycle.** `status content_status` restricted by check constraint to
  `DRAFT · REVIEW · APPROVED · ARCHIVED`. `PUBLISHED` is rejected at the database level: a direction
  brief is internal by construction, and there is no public route that could render one. `APPROVED`
  requires `research.direction.approve` and records `approved_at`, `approved_by`.
- **Revisions.** Every save writes a `research_direction_brief_revisions` row (full body snapshot,
  actor, timestamp, note) reusing the Phase 08 revision UI pattern, with restore.
- **Export.** A brief renders to a print stylesheet at `/studio/research/opportunities/direction/[briefId]?view=print`
  and exports to Markdown through `scripts/research/direction-export.ts`. Sheets export is Phase 36.
- **Route placement.** D4 fixes the research leaf set and contains no `direction` leaf, so briefs
  are mounted as child segments of the existing `opportunities` leaf:
  `/studio/research/opportunities/direction` (list) and `.../direction/[briefId]` (editor). This is
  a nested segment, not a new D4 leaf; it is raised in *Open questions* in case the owner would
  rather amend D4 and give direction briefs their own leaf.

**Out of scope**

- Creating a product. There is no code path from `research_direction_briefs` to `products`, and
  `scripts/research/check-research-isolation.mjs` — the existing I4 guard, extended in place, not a
  new script — gains an assertion that no file importing the direction repository also imports the
  products repository. Product creation is a Phase 35 action taken from the confirmed list, by hand.
- A foreign key from a brief to `categories`. The category is a checked slug; see the note under
  **Database**.
- Any generated prose. No language model, no template sentence, no "suggested description". A brief
  with empty prose sections is a valid `DRAFT` and stays empty until a person writes it.
- Rivya prices, dimensions, materials, lead times, tolerances or capability statements. The schema
  has no columns for them.
- Publishing. There is no `PUBLISHED` state, no public route, no sitemap entry, no SEO record.
- Attaching competitor images or copying competitor text into the brief body. Evidence links to a
  research row; it does not embed the row's imagery or description.
- Higgsfield generation from a brief. Phase 43 owns the media plan; a brief may name a gap, which
  Phase 43 reads.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Migration | `supabase/migrations/0320_phase34_direction_briefs.sql` | briefs, evidence, revisions, the no-publish constraint |
| RLS | `supabase/migrations/0321_phase34_direction_rls.sql` | staff only; write and approve split |
| Repository | `lib/supabase/repositories/research-direction.ts` | brief CRUD, evidence attach/detach, revision write/restore |
| Row schemas | `lib/supabase/schemas/research-direction.ts` | Zod; `status` union excludes `PUBLISHED` at the type level |
| Evidence capture | `lib/scraper/analytics/direction/capture.ts` | builds the `captured jsonb` payload per evidence type |
| Brief list | `app/(studio)/studio/research/opportunities/direction/page.tsx` | status, owner, evidence count, updated |
| Brief editor | `app/(studio)/studio/research/opportunities/direction/[briefId]/page.tsx` + `actions.ts` | nine prose sections, evidence rail, revisions, approve |
| Evidence rail | `components/studio/research/EvidenceRail.tsx` | attach from set, score, cluster, product, note, media |
| Observed panel | `components/studio/research/ObservedFigures.tsx` | numbers only, each with `CoverageBadge` and the observed-in-research label |
| Print view | `app/(studio)/studio/research/opportunities/direction/[briefId]/print.css` | A4 print stylesheet; header states "internal research document" |
| Export CLI | `scripts/research/direction-export.ts` | `--brief=<id> --format=md` |
| Docs | `docs/architecture/SCRAPER.md`, `docs/studio/STUDIO_GUIDE.md`, `docs/project/BUSINESS_RULES.md` | the brief's purpose, its limits, the no-product rule |
| Tests | `tests/unit/direction-no-publish.test.ts`, `direction-evidence-capture.test.ts`, `direction-isolation.test.ts`, `tests/e2e/research-direction.spec.ts` | the constraint, value capture, the import barrier |

**Database**

| Table | Change | Key columns |
|---|---|---|
| `research_direction_briefs` | new | `id uuid pk`, `slug citext unique not null`, `title text not null`, `intent text`, `scale_intent text`, `form_language text`, `material_direction text`, `finish_direction text`, `constraints text`, `open_questions text`, `not_doing text`, `target_category_slug text null check (target_category_slug is null or target_category_slug in ('furniture','collectible-design','3d-resin','wall-statement-art','preservation','decor','gifts'))`, `status content_status not null default 'DRAFT' check (status in ('DRAFT','REVIEW','APPROVED','ARCHIVED'))`, `owner_verification owner_verification not null default 'NOT_REQUIRED'`, `fact_classification fact_classification not null default 'EDITORIAL_COPY'`, `approved_at`, `approved_by`, `created_at`, `created_by`, `updated_at`, `updated_by` |
| `research_direction_brief_evidence` | new | `id uuid pk`, `brief_id uuid not null references research_direction_briefs(id) on delete cascade`, `evidence_type text not null check (evidence_type in ('COMPARISON_SET','ANALYTICS_SNAPSHOT','OPPORTUNITY_SCORE','SIMILARITY_PAIR','RESEARCH_PRODUCT','RESEARCH_NOTE','MEDIA_ASSET'))`, `evidence_id uuid not null`, `captured jsonb not null default '{}'`, `rationale text not null`, `position int not null default 0`, `created_at`, `created_by uuid not null`; `unique (brief_id, evidence_type, evidence_id)`; `check (length(btrim(rationale)) > 0)` |
| `research_direction_brief_revisions` | new | `id uuid pk`, `brief_id uuid not null references research_direction_briefs(id) on delete cascade`, `revision int not null`, `body jsonb not null`, `note text`, `created_at`, `created_by uuid not null`; `unique (brief_id, revision)` |

**`target_category_slug` carries no foreign key, and that is the whole point.** A brief is filed
under one of the seven D3 categories so Phase 37 can report direction coverage per category — but
`categories.id` is already the target of the **second and last** allowlisted research→public
reference (`research_products.matched_category_id`, Phase 28), and `PHASE-23-30.md` states plainly
that "there is never a third". `scripts/research/check-research-isolation.mjs` reads
`information_schema.referential_constraints` against a two-name allowlist, so
`references categories(id)` here would fail CI, not merely offend the rule. The column is therefore
a plain `text` slug, constrained to D3's fixed seven values by a check constraint — D3 fixes that
list, so the check is as durable as a foreign key and costs no coupling — and resolved to a category
row, when a screen needs one, by the direction repository alone. Whether the owner would rather
amend D5 and permit a real third reference is raised as *Open questions* 13; nothing below depends
on the answer.

The rationale requirement is not decorative — evidence attached without a stated reason is how a
brief turns into a scrapbook. The `check` above makes an empty rationale impossible.

RLS: `select` requires `research.read`. `insert`/`update` require `research.direction.write`.
Setting `status = 'APPROVED'` requires `research.direction.approve`, enforced by a policy on the
update and re-checked in the server action. No `anon` policy; `PUBLISHED` is unreachable.

**Studio surface** — creates `/studio/research/opportunities/direction` and
`/studio/research/opportunities/direction/[briefId]`. The editor is two columns: the nine prose
sections on the left with per-section helper copy seeded through `global_content` group
`STUDIO_HELP` (SEED §40), and the evidence rail plus observed figures on the right. A permanent
banner reads that the brief is an internal research document and is never published. Approve and
Archive sit behind `ConfirmDialog`.

**Public surface** — None. A direction brief has no public route, no slug on a D3 path, no sitemap
entry and no `PUBLISHED` state that could produce one.

**Media** — a brief may attach existing Rivya concept media as mood reference, drawn only from
families that carry material and process atmosphere rather than any suggestion of finished product
photography: `material-macro` (39 assets), `process-*` (79 across seven families), `three-d-resin`
(13), `wall-art` (20), `interior-lifestyle` (5) and the six `largeformat-*` families (18). Every one
of these is `is_ai_generated = true` and `is_concept = true`, so the Phase 07 concept banner renders
on each thumbnail and the caption field is disabled for product-style descriptions. **Nothing is
generated**; the manifest's 250 assets are reused as-is (D6, FEAT §33). No competitor image is ever
attached as mood reference.

**Risks**

| Risk | Mitigation |
|---|---|
| A brief drifts into a product specification | The schema has no price, dimension, material or lead-time column; the *intended* sections are prose only; a unit test asserts the Zod schema rejects any numeric dimension field |
| Someone builds a "create product from brief" button because it seems obvious | `direction-isolation.test.ts` fails the build if the direction repository and the products repository are imported into the same module; the exclusion is stated in `BUSINESS_RULES.md` |
| Observed competitor figures are read as Rivya specifications | Observed figures render in a distinct panel, always with `CoverageBadge` and the label "observed in competitor research"; the print stylesheet keeps the label on the printed page |
| Evidence rots — a score changes and the brief's reasoning becomes unreadable | Volatile evidence is captured by value in `captured jsonb` at attachment time; the rail shows both the captured value and the current one when they differ |
| A brief accumulates evidence with no reasoning | `rationale` is `not null` and non-empty by check constraint |
| Competitor prose is pasted into the brief body | The editor shows the SEED §40 helper copy for scraped material on every save; `BUSINESS_RULES.md` states the rule; review before `APPROVED` is a human step with a named approver |
| A brief is treated as an approved product plan by a maker | `APPROVED` means "the studio agrees this direction is worth exploring"; the wording is fixed in `STUDIO_GUIDE.md` and rendered as the status tooltip |

**Verification**

1. `npx supabase db push` — `0320`/`0321` apply. `psql "$DATABASE_URL" -c "update
   research_direction_briefs set status='PUBLISHED' where slug='<any>'"` — rejected by the check
   constraint.
2. `npm run test:unit -- direction-no-publish direction-evidence-capture direction-isolation` —
   passes; the isolation test fails when a deliberate import of `repositories/products` is added to
   `repositories/research-direction.ts`, proving it is not vacuous.
3. Create a brief in Studio; attempt to save an evidence attachment with an empty rationale → the
   server action returns a field error and the database would reject it regardless.
4. Attach an opportunity score, then recompute scores with a new model version. Reload the brief —
   the rail shows the captured value, the current value, and a "changed since attachment" marker.
5. `psql "$DATABASE_URL" -c "select count(*) from research_direction_brief_evidence where captured =
   '{}'::jsonb and evidence_type in ('OPPORTUNITY_SCORE','ANALYTICS_SNAPSHOT')"` — zero.
6. As `researcher`, POST the approve action → 403 with a `DENIED` audit row. As `merchandiser` →
   succeeds, `approved_by` and `approved_at` are set, an `activity_events` row exists.
7. Attach three concept media assets; confirm each thumbnail renders the concept banner and that no
   free-text caption field offers a product-style description.
8. `npm run research:direction-export -- --brief=<id> --format=md` — the Markdown contains the nine
   sections, every observed figure with its coverage, and the internal-document header; it contains
   no price, dimension or material presented as a Rivya specification.
9. `npx playwright test tests/e2e/research-direction.spec.ts` — create, write, attach, revise,
   restore a revision, approve, print-preview, at 1920 and 390.
10. `node scripts/research/check-research-isolation.mjs` — passes; the three new tables add no
    referential constraint to any public table, so the I1 allowlist still holds exactly two entries
    (I3's grep for `research_` under `app/(site)/**`, `lib/cms/**` and `components/sections/**`
    already covers the manual grep this step used to perform). Temporarily change
    `target_category_slug` to `target_category_id uuid references categories(id)` and confirm the
    guard fails naming the third constraint; revert.
11. `psql "$DATABASE_URL" -c "update research_direction_briefs set target_category_slug='sofas'"` —
    rejected by the check constraint; `'furniture'` is accepted.

**Exit criteria**

- [ ] A brief cannot reach `PUBLISHED` in the database, in the Zod schema, or in the UI.
- [ ] No code path exists from a brief to `products`, proven by an import-barrier test that is shown
      to fail when the barrier is removed.
- [ ] The nine prose sections are never machine-filled; a new brief is empty except for its title.
- [ ] Every evidence row carries a non-empty rationale, enforced in the database.
- [ ] Volatile evidence is captured by value and shows drift against the current value.
- [ ] Observed competitor figures always render with coverage and the observed-in-research label,
      on screen and in print.
- [ ] The brief schema contains no Rivya price, dimension, material or lead-time field.
- [ ] The brief schema adds no foreign key to any public table: the target category is a checked
      slug, and `check-research-isolation.mjs` still passes with a two-entry I1 allowlist,
      demonstrated to fail when a real reference is added.
- [ ] Approval requires `research.direction.approve`, is audited, and records approver and time.
- [ ] Mood media is limited to existing manifest concept assets; nothing is generated and no
      competitor image is attached.
- [ ] Revision history and restore work, reusing the Phase 08 pattern rather than a second one.
- [ ] Phase-specific D9 evidence: docs updated = `SCRAPER.md`, `STUDIO_GUIDE.md`,
      `BUSINESS_RULES.md`; tests run = three unit suites and `research-direction.spec.ts`;
      next phase = 35.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 35 — Shortlist + Confirmation

**Goal** — The FEAT §23 pipeline gets its **workspace and its gate**. The two stages that matter —
`SHORTLISTED` and `CONFIRMED` — already exist: `PHASE-23-30.md` fixes `research_stage` at exactly
seven values and Phase 29 already ships Shortlist and Confirm as two of its nine review actions.
What does not exist is anywhere to *work*: no record of why a row was shortlisted or by whom, no
decision note behind a confirmation, no list a merchandiser can sit down in front of, and no way to
get from a confirmed research row to a Rivya product without leaving the Studio. This phase adds
those records and those two screens, and then adds the one deliberate, hand-operated bridge to the
catalogue: a person with `catalog.write` opens a new `products` row in `DRAFT` carrying a category
and a slug **they type**, and nothing else. No competitor title, description, price, currency,
dimension, material, availability, lead time or image crosses that line, in any code path, ever.
After this phase the pipeline is complete end to end and the catalogue is still only fillable by
hand.

**What this phase does *not* add, stated first because the temptation is real.** No new stage. No
new enum value. No second transition log beside `research_pipeline_events`. No second state machine
beside `lib/scraper/core/stage.ts`. `PHASE-23-30.md` is authoritative for all four, and this block's
own rule at the top of the document says the repair for a disagreement is a rename here, never a
second table. Archival of a decision is a column on the decision record —
`research_confirmations.archived_at` — not an eighth stage, because a row whose confirmation was
archived is still a confirmed research reference, and FEAT §23's ladder ends at `CONFIRMED`.

**Depends on** — Phase 25 (`research_stage`, `research_disposition`, `lib/scraper/core/stage.ts`,
`research_pipeline_events`), Phase 29 (the nine review actions in
`lib/scraper/workflows/review-actions.ts`, `research_review_actions`, `research_tags`), Phase 32
(scores, as a sort order on the shortlist), Phase 34 (briefs, linkable from a confirmation), Phase 24
(bulk selection machinery and `lib/bulk/operations/research/`), Phase 14 (`products` and its
repository), Phase 04 (`research.confirm`, `catalog.write`, audit).

**Scope**

- **The movements, expressed in the columns that already exist.** `stage` is the ladder;
  `disposition` is the verdict; they are orthogonal, and a row carries one of each. Every movement
  below goes through Phase 25's `lib/scraper/core/stage.ts` — extended with the entries this phase
  needs, **not** replaced — which is the only writer of `research_products.stage`, emits a
  `research_pipeline_events` row for every stage move, and is called by Phase 29's
  `review-actions.ts`, by the bulk operations and by the CLI alike. There is no `transition()`
  beside it and no `lib/scraper/workflows/pipeline.ts`.

| Column | From | Allowed to | Permission | Reason required |
|---|---|---|---|---|
| `stage` | `MATCHED` · `REVIEW` | `SHORTLISTED` | `research.confirm` (Phase 29's Shortlist action) | no |
| `stage` | `SHORTLISTED` | `CONFIRMED` | `research.confirm` | **yes** — it becomes `research_confirmations.decision_note` |
| `stage` | `SHORTLISTED` | `REVIEW` | `research.confirm` | yes — closes the shortlist entry |
| `stage` | `CONFIRMED` | `SHORTLISTED` | `research.confirm` | yes — archives the confirmation and reopens the entry |
| `disposition` | `NONE` | `IGNORED` | `research.confirm` | no |
| `disposition` | `NONE` | `REJECTED` | `research.confirm` | **yes** |
| `disposition` | `NONE` | `DUPLICATE` | `research.confirm` | **yes**, plus a surviving row for `duplicate_of_id` |
| `disposition` | `IGNORED` · `REJECTED` · `DUPLICATE` | `NONE` | `research.confirm` | yes |
| either | any | anything not in this table | — | `stage.ts` raises `InvalidStageTransitionError` |

  Two properties of that table are load-bearing. First, **a disposition never moves a stage and a
  stage never sets a disposition**: rejecting a shortlisted row leaves it at `SHORTLISTED` with
  `disposition = 'REJECTED'`, exactly as Phase 29 specifies, so the corpus keeps the history of what
  it once was. Second, **`stage.ts` is extended, not forked**: the new rows above are added to its
  existing table, and `tests/unit/pipeline-transitions.test.ts` reads that table from the module and
  asserts it matches this document cell for cell.
- **The database enforces what the convention already asserted.** `PHASE-23-30.md` states that no
  code path sets `stage` outside `stage.ts`, but nothing stops an ad-hoc `psql` update. This phase
  adds `guard_research_stage_writer()`, a trigger on `research_products` that rejects a change to
  `stage` or `disposition` unless the transaction-local flag `stage.ts` sets is present. It enforces
  the **existing** rule at a second layer; it defines no transitions of its own and holds no
  transition table.
- **Shortlist entries**, `research_shortlist_entries`: the row, who shortlisted it, why, the tags
  applied, the score at the moment of shortlisting (`captured jsonb`), and an optional link to a
  direction brief. A row leaving stage `SHORTLISTED` closes the entry (`closed_at`, `closed_reason`)
  rather than deleting it, so the shortlist has a history.
- **Confirmations**, `research_confirmations`: the decision record behind a `CONFIRMED` stage.
  `decision_note` is mandatory and non-empty. `brief_id` optionally links the direction brief that
  argued for it. `archived_at`/`archived_reason` retire a decision without touching the stage — the
  row remains a confirmed research reference, and the partial unique index means a new decision can
  then be recorded. `created_product_id` is a **nullable uuid with no foreign key**, written only
  when the manual bridge action is used, read only by Studio research screens, and never joined into
  any public read path — the D5 isolation rule is honoured by keeping the reference on the research
  side and forbidding the join rather than by pretending the link does not exist.
- **The manual bridge, and its reconciliation with I4.** One server action,
  `startProductFromConfirmation`, with all of the following required before it will run: the row's
  stage is `CONFIRMED` with an unarchived confirmation; the actor holds `catalog.write`; the actor
  types a slug and picks a category; the actor ticks an explicit acknowledgement whose label is
  seeded copy stating that no competitor data is being imported. It inserts a `products` row with
  `slug`, `category_id`, `status = 'DRAFT'`, `price_state = 'PRICE_ON_REQUEST'` and `title` set to
  the slug's title case — a placeholder the owner must replace — and writes nothing else. It then
  writes `created_product_id` back to the confirmation, an `audit_logs` row and an `activity_events`
  row.

  **This action, as specified, fails invariant I4 as it is literally written.**
  `PHASE-23-30.md` says: "There is no code path — no server action, no script, no SQL function, no
  Studio button — that writes to `products` from a `research_*` read", enforced by
  `check-research-isolation.mjs` and `tests/unit/research-isolation.test.ts`; and its Phase 29
  Confirm action says confirming "creates no product, no draft product". The bridge copies no
  competitor field, so it does not breach FEAT §25 or SEED §32 — but it does read a
  `research_confirmations` row and then insert into `products`, and the guard would fail the build.
  Asserting compliance would be a lie. Instead:

  1. The needed narrowing is written out in *Open questions* 11 as a proposed amendment: I4 becomes
     "no **automatic** and no **field-copying** path", with one named carve-out.
  2. `scripts/research/check-research-isolation.mjs`'s I4 rule is **edited in place** — this phase
     touches no other guard script — to encode the carve-out exactly: the single symbol
     `startProductFromConfirmation`, exported from
     `app/(studio)/studio/research/confirmed/actions.ts`, is the only permitted writer of `products`
     that also imports a research repository. The guard fails on a second such symbol, on the symbol
     appearing in any other file, and on that file importing any research field-reading helper beyond
     `getConfirmationForBridge(id): { id, stage, archived_at }` — a deliberately narrow projection
     that returns no competitor text at all.
  3. Until the owner accepts the amendment, the bridge ships behind the `research_product_bridge`
     flag, default `false`, and `/studio/research/confirmed` renders the button in a disabled state
     with the reason stated.

  The guard is the specification here: the amendment describes the carve-out in English, and
  `check-research-isolation.mjs` is where it becomes true.
- **Field-provenance test.** `tests/unit/confirmation-no-import.test.ts` builds a research row whose
  every text field is a unique sentinel string, runs the bridge, and asserts no sentinel appears in
  any column of the created `products` row, in `product_media`, `product_materials` or
  `product_collections`. It is the phase's load-bearing test.
- **Bulk actions** (FEAT §20/§25) over the explorer and shortlist: shortlist, reject, mark duplicate,
  ignore, assign tags, confirm. These are the Phase 24 registrations Phase 29 already enabled in
  `lib/bulk/operations/research/` — this phase adds the two new operations the shortlist screens need
  (close entry, archive confirmation) to that existing registry rather than a second bulk path. Each
  goes through `stage.ts`, each requires a reason where the table above says so, each is capped at
  200 rows per invocation, each is confirmed through `ConfirmDialog`, and each writes one `audit_logs`
  row and one `research_pipeline_events` row per row whose stage moved. Per `PHASE-23-30.md`'s
  permission mapping, any bulk disposition of more than one row requires `research.confirm` **and**
  `bulk.execute` — so the roles that can operate the bulk bar here are owner, admin and merchandiser.
- `/studio/research/shortlist` and `/studio/research/confirmed` are filled: filterable tables, the
  score column with its confidence, entry age, tags, the reason text, and the per-row actions above.
  `/studio/research/confirmed` additionally shows whether a Rivya product was started, and links to
  it — a link, not a join.

**Out of scope**

- Any automatic import of competitor data, at any threshold, under any flag (FEAT §25). The bridge
  copies nothing; there is no "import fields" option to disable.
- Copying competitor imagery into `media_assets`. Phase 33's upload guard already blocks it; this
  phase adds no image path at all.
- Publishing the created product. It lands `DRAFT` and must pass the Phase 14 publication-readiness
  checklist and a human publish action like any other product.
- Prices. The created row is `PRICE_ON_REQUEST`; the observed competitor price is not written, not
  suggested and not shown on the product editor.
- Deleting research rows. `REJECTED`, `DUPLICATE` and `IGNORED` are **dispositions**, not deletions
  and not stages; the corpus keeps its history so change detection stays meaningful.
- Any new stage, any eighth `research_stage` value, any second transition log and any second state
  machine. `research_stage`, `research_disposition`, `research_pipeline_events` and
  `lib/scraper/core/stage.ts` are Phase 25's and stay Phase 25's.
- Sheets export of the shortlist — Phase 36 defines it.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Migration | `supabase/migrations/0330_phase35_shortlist_confirmation.sql` | entries, confirmations, the stage-writer guard trigger. **No enum is altered**: `SHORTLISTED` and `CONFIRMED` already exist in `research_stage` from Phase 25's `0230` |
| RLS | `supabase/migrations/0331_phase35_rls.sql` | staff read; confirm gated to `research.confirm` |
| Stage machine | `lib/scraper/core/stage.ts` (**extended**, Phase 25) | the new rows in its existing transition table; `InvalidStageTransitionError`; sets the transaction flag the trigger checks |
| Review actions | `lib/scraper/workflows/review-actions.ts` (**extended**, Phase 29) | Shortlist and Confirm now write a `research_shortlist_entries` / `research_confirmations` row alongside the existing `research_review_actions` row |
| Bulk operations | `lib/bulk/operations/research/{close-entry,archive-confirmation}.ts` | added to the Phase 24 registry beside Phase 29's five |
| Bridge action | `lib/supabase/repositories/research-confirmations.ts` + `app/(studio)/studio/research/confirmed/actions.ts` | `startProductFromConfirmation` — the only writer of the bridge; the repository exposes `getConfirmationForBridge(id)` returning `{ id, stage, archived_at }` and nothing else |
| Repository | `lib/supabase/repositories/research-shortlist.ts` | entries, close, tag application |
| Row schemas | `lib/supabase/schemas/research-shortlist.ts`, `research-confirmation.ts` | Zod; `decision_note` min length 1 |
| Shortlist route | `app/(studio)/studio/research/shortlist/page.tsx` + `actions.ts` | table, filters, bulk bar |
| Confirmed route | `app/(studio)/studio/research/confirmed/page.tsx` + `actions.ts` | table, decision notes, bridge action |
| Bulk bar | `components/studio/research/PipelineBulkBar.tsx` | 200-row cap, reason field, confirm dialog |
| Bridge dialog | `components/studio/research/StartProductDialog.tsx` | slug, category, acknowledgement checkbox, no other field |
| Seeded copy | `content/seed/studio-help.ts` (extended) | the acknowledgement label and the shortlist/confirmed helper copy (SEED §40) |
| Isolation guard | `scripts/research/check-research-isolation.mjs` (**I4 rule edited in place**) | encodes the single-symbol carve-out for `startProductFromConfirmation`; fails on a second such symbol, on the symbol outside its one file, or on that file importing any research reader beyond `getConfirmationForBridge`. No rule is added to `check-data-layer.mjs`; I3 already covers the public-route containment this phase used to claim |
| Flag | `lib/flags/flags.ts` | adds `research_product_bridge`, default `false`, until the I4 amendment is accepted |
| Docs | `docs/architecture/SCRAPER.md`, `docs/project/BUSINESS_RULES.md`, `docs/studio/STUDIO_GUIDE.md` | the movement table, the gate, the bridge's exact field list, the I4 carve-out |
| Tests | `tests/unit/pipeline-transitions.test.ts`, `confirmation-no-import.test.ts`, `stage-guard-trigger.test.ts`, `research-isolation.test.ts` (**extended**), `tests/e2e/research-shortlist-confirm.spec.ts` | the movement matrix read from `stage.ts`, the sentinel test, the trigger, the I4 carve-out |

**Database**

| Table | Change | Key columns |
|---|---|---|
| `research_stage` · `research_disposition` | **unchanged** | Seven stages and four dispositions, exactly as Phase 25's `0230` created them. This phase alters no type and adds no value |
| `research_shortlist_entries` | new | `id uuid pk`, `research_product_id uuid not null references research_products(id) on delete cascade`, `reason text not null check (length(btrim(reason)) > 0)`, `captured jsonb not null default '{}'` (score, confidence, model version at entry), `brief_id uuid null references research_direction_briefs(id) on delete set null`, `opened_at timestamptz not null default now()`, `opened_by uuid not null`, `closed_at timestamptz null`, `closed_reason text null`, `closed_by uuid null`; partial unique index `(research_product_id) where closed_at is null` |
| `research_confirmations` | new | `id uuid pk`, `research_product_id uuid not null references research_products(id) on delete cascade`, `decision_note text not null check (length(btrim(decision_note)) > 0)`, `brief_id uuid null references research_direction_briefs(id) on delete set null`, `confirmed_at timestamptz not null default now()`, `confirmed_by uuid not null`, `created_product_id uuid null`, `product_started_at timestamptz null`, `product_started_by uuid null`, `archived_at timestamptz null`, `archived_reason text null`; partial unique index `(research_product_id) where archived_at is null`; `check ((archived_at is null) = (archived_reason is null))`; **no foreign key on `created_product_id`** — see the note below |

**Archival is a column, not a stage.** A retired decision sets `archived_at` and `archived_reason`
on the confirmation; the research row keeps stage `CONFIRMED`, because it remains a confirmed
research reference and FEAT §23's ladder has no rung for "was confirmed once". The partial unique
index means archiving frees the row for a fresh decision. This is why no `ARCHIVED_DECISION` value
is added to `research_stage`, and why the seven-value enum in `PHASE-23-30.md` stands untouched.

`created_product_id` deliberately carries no `references products(id)`. D5 states that research
tables never join directly to public product tables, and I1's allowlist is closed at two constraint
names; a foreign key would breach both, would cascade a product deletion into research history, and
would let a careless query join the two. Instead the column is an opaque identifier, the research
repository resolves it with a second query when a Studio screen asks, and
`check-research-isolation.mjs` forbids any file outside `lib/supabase/repositories/research-*.ts`
from resolving it. This reading of D5 is raised in *Open questions* 3.

Stage-writer guard, verbatim. It **enforces the Phase 25 rule** that only `lib/scraper/core/stage.ts`
writes `stage`; it defines no transitions and holds no table of its own:

```sql
create or replace function public.guard_research_stage_writer() returns trigger
  language plpgsql as $$
begin
  if (new.stage is distinct from old.stage
      or new.disposition is distinct from old.disposition)
     and coalesce(current_setting('rivya.stage_transition', true), '') <> 'on' then
    raise exception 'stage/disposition on research_product % may only be changed by lib/scraper/core/stage.ts',
      old.id;
  end if;
  return new;
end $$;
```

RLS: `select` on both new tables requires `research.read`. Writes on both require
`research.confirm` — **not** `research.write` — because `PHASE-23-30.md`'s permission mapping puts
all nine FEAT §25 dispositions, Shortlist and Confirm included, behind `research.confirm` (owner,
admin, merchandiser), and a `researcher` operates the pipeline while a `merchandiser` judges its
output. Archiving a confirmation is a write on `research_confirmations` and inherits the same
requirement. The bridge additionally requires `catalog.write`, checked in the server action before
the insert. No `anon` policy on either table.

**Studio surface** — fills `/studio/research/shortlist` (open entries, score, confidence, age, tags,
reason, bulk bar) and `/studio/research/confirmed` (decision note, confirming actor, linked brief,
product-started state and link, archive action). Phase 29 already put the bulk toolbar on
`/studio/research/explorer`; this phase adds its two new operations to that existing toolbar and
mounts the same component on the Phase 30 large-format workspace. The bridge dialog is the only
place in the entire Studio where a research
screen can create a catalogue row, and it renders the seeded acknowledgement text above an unticked
checkbox that the submit button depends on.

**Public surface** — None. Invariant I3, already enforced by `check-research-isolation.mjs` since
Phase 25, makes that structural rather than conventional; this phase writes no new containment rule
because the one that exists already covers `app/(site)/**`, `lib/cms/**`, `lib/catalog/**`,
`lib/seo/**`, `components/sections/**` and `content/**`.

**Media** — None. No asset is consumed, created or attached; the created product row has no
`hero_media_id` and shows the Phase 14 missing-media state until the owner attaches real photography.

**Risks**

| Risk | Mitigation |
|---|---|
| Competitor fields are copied into the created product, now or in a later "convenience" change | `confirmation-no-import.test.ts` sentinels every research text field and asserts none reaches `products` or its join tables; the bridge repository exposes only `getConfirmationForBridge(id) → { id, stage, archived_at }`, so there is no competitor string in scope to copy; the bridge's field list is written into `BUSINESS_RULES.md` and the test is named in the exit criteria |
| The I4 carve-out widens into a general research→product write path | The guard encodes **one** symbol in **one** file with **one** permitted reader; a second writer, a move of the symbol, or a wider import fails `check-research-isolation.mjs`. The `research_product_bridge` flag ships `false` until the owner accepts the amendment, so the carve-out is inert by default |
| A bulk action moves 4,000 rows and nobody can explain why | 200-row cap per invocation, mandatory reason where the movement table says so, one `audit_logs` row per row, and one `research_pipeline_events` row per row whose stage moved |
| Stage or disposition is changed by an ad-hoc SQL update or a stray repository call | `guard_research_stage_writer()` rejects any change made without the flag `stage.ts` sets; `stage-guard-trigger.test.ts` attempts a direct update and asserts the exception. The trigger enforces the Phase 25 rule; it does not restate the transition table |
| A second pipeline grows beside the first | This phase creates no enum value, no transition table and no transition log; `pipeline-transitions.test.ts` imports the table from `lib/scraper/core/stage.ts` and asserts it matches this document, so a fork would have to be committed to that one module in plain sight |
| A confirmed row is read as a Rivya product | `/studio/research/confirmed` labels every row as a research decision; the created product is a `DRAFT` with a placeholder title and no price; the Phase 14 readiness checklist blocks publication until a human fills it |
| The shortlist becomes a graveyard nobody prunes | Entries carry `opened_at`; the table sorts by age by default and the research dashboard shows a count of entries open longer than 60 days |
| Deleting a product orphans a confirmation's reference | Intentional: `created_product_id` has no FK, so a deleted product leaves the historical decision intact; the Studio resolves it and renders "product no longer exists" rather than a broken link |
| A row is confirmed twice, or shortlisted twice | Partial unique indexes on the open entry and the unarchived confirmation |

**Verification**

1. `npx supabase db push` — `0330`/`0331` apply from clean and replay as a no-op. Then
   `psql "$DATABASE_URL" -c "select unnest(enum_range(null::research_stage))"` — **seven** rows, the
   FEAT §23 seven, unchanged; and `select unnest(enum_range(null::research_disposition))` — four.
   This phase's migrations must contain no `alter type`, asserted by
   `grep -c "alter type" supabase/migrations/033*.sql` returning zero.
2. `npm run test:unit -- pipeline-transitions stage-guard-trigger` — `pipeline-transitions` imports
   the transition table from `lib/scraper/core/stage.ts` and asserts it equals the movement table in
   this document cell for cell, including the illegal movements that must raise
   `InvalidStageTransitionError`. Assert also that no module named
   `lib/scraper/workflows/pipeline.ts` exists.
3. `npm run test:unit -- confirmation-no-import` — the sentinel test passes. Temporarily widen
   `getConfirmationForBridge` to return `title_normalized` and copy it into the insert; confirm the
   test fails **and** `check-research-isolation.mjs` fails on the wider projection; revert both.
4. `psql "$DATABASE_URL" -c "update research_products set stage='CONFIRMED' where id='<id>'"` —
   rejected by `guard_research_stage_writer` naming the row. Repeat with
   `set disposition='REJECTED'` — likewise rejected.
5. In Studio as `researcher`: attempt to shortlist a row → **403** with a `DENIED` audit row.
   `PHASE-23-30.md` puts all nine FEAT §25 dispositions behind `research.confirm`, which a
   `researcher` does not hold; a researcher operates the pipeline, a merchandiser judges it.
6. As `merchandiser`: shortlist a row with a reason → a `research_shortlist_entries` row opens,
   `stage` is `SHORTLISTED`, and one `research_pipeline_events` row records `REVIEW → SHORTLISTED`.
   Confirm with a decision note → a `research_confirmations` row exists, `stage` is `CONFIRMED`, a
   second `research_pipeline_events` row records the move, the shortlist entry is closed, and
   `activity_events` and `audit_logs` rows exist. Attempt to confirm with an empty note → rejected in
   the action and by the check constraint.
7. Reject that same confirmed row → `disposition = 'REJECTED'` and **`stage` is still `CONFIRMED`**,
   proving the two columns are orthogonal and that a disposition is not a stage.
8. Archive the confirmation with a reason → `archived_at` and `archived_reason` are set, `stage` is
   **unchanged at `CONFIRMED`**, no `research_pipeline_events` row is written (no stage moved), and a
   fresh confirmation on the same row is now permitted by the partial unique index.
9. Turn `research_product_bridge` on as `owner`, then run the bridge: type slug `demo-console`, pick
   `furniture`, tick the acknowledgement → a `products` row exists with `status='DRAFT'`,
   `price_state='PRICE_ON_REQUEST'`, `title='Demo Console'`, `price_from_minor is null`,
   `dimensions is null`, and zero rows in `product_media`, `product_materials`,
   `product_collections`. With the flag off, the button renders disabled and a direct POST is
   refused with the flag reason.
10. Untick the acknowledgement → the submit button is disabled, and a direct server-action POST
    without the acknowledgement field returns a validation error.
11. Select 250 rows in the explorer and bulk-reject → the action refuses above 200 with a message
    naming the cap; at 200 it succeeds and writes 200 audit rows (and zero
    `research_pipeline_events` rows, because a rejection moves no stage).
12. `node scripts/research/check-research-isolation.mjs` and
    `npm run test:unit -- research-isolation` — both pass with the edited I4 rule. Prove the
    carve-out is exactly one symbol wide: (a) add a second server action that inserts into `products`
    while importing a research repository → the guard fails naming it; (b) move
    `startProductFromConfirmation` into another file → the guard fails; (c) add
    `import { getConfirmation } from '@/lib/supabase/repositories/research-confirmations'` to a file
    under `app/(site)/` → I3 fails. Revert all three.
13. `npm run check:data-layer` — passes; no `.from(` outside the repositories. This phase adds no
    rule to it.
14. `npx playwright test tests/e2e/research-shortlist-confirm.spec.ts` — review → shortlist →
    confirm → start product → open the product in `/studio/catalog/products` and assert it is empty
    but for slug, title placeholder and category, at 1920 and 390.

**Exit criteria**

- [ ] `research_stage` still holds exactly seven values and `research_disposition` exactly four; this
      phase alters no enum and creates no transition table or transition log.
- [ ] Every stage movement goes through `lib/scraper/core/stage.ts`, emits a
      `research_pipeline_events` row, and is enforced at the database by
      `guard_research_stage_writer()`.
- [ ] The movement table in this document, the table inside `lib/scraper/core/stage.ts` and the one
      in `SCRAPER.md` agree exactly, checked by a unit test that reads the table from the module.
- [ ] Stage and disposition remain orthogonal: rejecting a row changes no stage, and archiving a
      confirmation changes no stage.
- [ ] Every confirmation carries a non-empty decision note and a named confirming actor.
- [ ] The bridge writes exactly `slug`, `title` (from the slug), `category_id`, `status='DRAFT'` and
      `price_state='PRICE_ON_REQUEST'`, and nothing else — proven by the sentinel test, which is
      demonstrated to fail when the barrier is removed.
- [ ] The bridge requires `catalog.write`, an explicit typed slug, a chosen category and a ticked
      acknowledgement whose copy is seeded, not hard-coded.
- [ ] The I4 carve-out is written into `check-research-isolation.mjs` as one named symbol in one
      named file with one permitted reader, demonstrated to fail on a second writer, on a move and on
      a wider projection; the proposed amendment is recorded in *Open questions* 11 and
      `research_product_bridge` ships `false` until it is accepted.
- [ ] No foreign key exists from `research_confirmations` to `products`, and no file outside the
      research repositories resolves `created_product_id`.
- [ ] I3 still fails on any `research_` reference in the public route group, `lib/cms`,
      `lib/catalog`, `lib/seo`, `components/sections` or `content`, demonstrated by a temporary
      violation. No new containment rule is added to `check-data-layer.mjs`.
- [ ] Bulk actions are capped at 200 rows, require a reason where the movement table says so, and
      write one audit row per affected row and one pipeline event per stage moved.
- [ ] Rejected, duplicate and ignored rows are retained, never deleted, and remain at the stage they
      had reached.
- [ ] No competitor text, price, dimension, material or image reaches any Rivya table.
- [ ] Phase-specific D9 evidence: docs updated = `SCRAPER.md`, `BUSINESS_RULES.md`,
      `STUDIO_GUIDE.md`, `DATA_MODEL.md`; tests run = four unit suites and
      `research-shortlist-confirm.spec.ts`; next phase = 36.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 36 — Google Sheets

**Goal** — Anything the Studio can list, the owner can read in a spreadsheet. A named export
definition binds an entity, a column set, a filter and a destination tab; running it writes the
current rows into a Google Sheet through a service account, atomically enough that a reader never
sees a half-written tab. The integration is deliberately one-way: Rivya writes, the Sheet reads.
Nothing typed into a spreadsheet cell can ever change a research state, a product, a price or a
piece of content, because a spreadsheet is not a source of truth and an inbound path would be the
easiest way in the whole system to inject a fabricated fact. Failures are loud, bounded and
self-limiting — three consecutive failures pause a definition rather than retrying forever.

**Depends on** — Phase 31, 32, 34, 35 (the data worth exporting), Phase 20 (inquiries and
`inquiries.export`), Phase 19 (`feature_flags`), Phase 04 (audit), D8 (`GOOGLE_SERVICE_ACCOUNT_JSON`,
`GOOGLE_SHEETS_SPREADSHEET_ID`).

**Scope**

- **Auth.** A Google service account, credentials read once at request time from
  `GOOGLE_SERVICE_ACCOUNT_JSON`, parsed and validated by Zod, cached in memory for the process
  lifetime and never logged, echoed, returned from an API route or written to a database column.
  The default spreadsheet is `GOOGLE_SHEETS_SPREADSHEET_ID`; a definition may override it with an
  id an admin types. Scope requested: `https://www.googleapis.com/auth/spreadsheets` only — no Drive
  scope, so the integration can never list, open or modify anything it was not explicitly shared.
- **Export definitions.** `sheets_export_definitions` binds `entity` (one of the seven below), a
  `columns text[]` chosen from a per-entity allowlist, a `filter jsonb` (the same shape the Studio
  table filters produce), the destination spreadsheet and tab, a schedule (`MANUAL` or a cron
  expression), and `includes_pii bool`.

| Entity | Source | Default columns | Permission to run |
|---|---|---|---|
| `RESEARCH_PRODUCTS` | `research_products` + source | source, `title_normalized`, mapped category, `price_state`, `price_min_minor`, `price_max_minor`, currency, `dimensions_mm`, `dimension_parse_state`, `stage`, `disposition`, `first_seen_at`, `last_seen_at`, `source_url` | `integrations.sheets.run` + `research.read` |
| `COMPARISON_SET` | Phase 31 set + its latest snapshot | member, source, category, price band, longest axis, coverage | same |
| `OPPORTUNITY_SCORES` | Phase 32 scores + components | research product, score, confidence, state, model version, one column per signal contribution | same |
| `SHORTLIST` | Phase 35 open entries | research product, reason, tags, score at entry, opened, opened by | same |
| `CONFIRMED` | Phase 35 confirmations | research product, decision note, confirmed by, confirmed at, product started | same |
| `DIRECTION_BRIEFS` | Phase 34 | title, status, `target_category_slug`, evidence count, approver, updated | same |
| `INQUIRIES` | Phase 20 | reference code, kind, pipeline status, created, city, enquiry type, WhatsApp state | `integrations.sheets.run` + `inquiries.export` |

- **PII discipline.** Name, phone and email are available to the `INQUIRIES` export only, only when
  `includes_pii = true`, only when the definition was created by owner or admin, and every run of
  such a definition writes an `audit_logs` row naming the actor, the row count and the destination
  spreadsheet id. A definition cannot be flipped to `includes_pii` by anyone below admin.
- **The write, made atomic.** Each run writes into a scratch tab named `<tab>__staging`: create or
  clear it, write values in `spreadsheets.values.batchUpdate` chunks of ≤ 5,000 cells, then a single
  `spreadsheets.batchUpdate` that deletes the previous tab and renames the staging tab into its
  place. A reader either sees the previous complete tab or the new complete one, never a partial
  one. If the run fails before the swap, the live tab is untouched and the staging tab is left in
  place with the run id in cell A1 for diagnosis.
- **Failure handling.** Retries on `429` and `5xx` with exponential backoff and jitter (5 attempts,
  base 500 ms, cap 30 s), honouring `Retry-After`. `401`/`403` are not retried — they mean
  credentials or sharing, and the run fails with `AUTH` and a Studio banner telling the admin to
  share the spreadsheet with the service-account email (which is shown; it is an identifier, not a
  secret). Three consecutive failures set `paused_at` and `paused_reason` on the definition; a paused
  definition is skipped by the cron and shows a banner until an admin resumes it.
- **Run records.** `sheets_sync_runs` stores status, row count, cell count, duration, attempt count,
  a sanitised `error_code`, and never the response body — a Google error payload can echo a request
  URL and must not be persisted verbatim.
- **Flag.** `google_sheets` (FEAT §32), default `false`. With the flag off the Studio page renders
  the definitions read-only and every run action is refused with a stated reason.
- `/studio/research/sheets` is filled with the definition list, the run history, the last-run status
  per definition and the manual **Run now** action. `/studio/operations/exports` (Phase 24) gains a
  link to it rather than growing a second exporter.

**Out of scope**

- Any read from a Sheet into Rivya. No import, no two-way sync, no "update status from column F".
  This is a business-integrity decision, not a scheduling one; changing it needs an amendment.
- Google Drive access of any kind, file creation, folder browsing, or sharing management.
- Exporting media binaries, page content, secrets, environment values, or anything from
  `audit_logs`, `system_logs` or `staff_profiles`.
- Formulas, charts, conditional formatting or pivot tables inside the Sheet. Rivya writes values
  and a header row; the owner may build whatever they like on top in another tab.
- A generic CSV/XLSX exporter — Phase 24 owns file exports; this phase is Sheets only.
- Real-time sync. The minimum schedule is hourly and the default is `MANUAL`.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Migration | `supabase/migrations/0340_phase36_sheets.sql` | definitions, runs, pause state |
| RLS | `supabase/migrations/0341_phase36_sheets_rls.sql` | manage vs run split; no `anon` policy |
| Seed | `supabase/migrations/0342_phase36_default_definitions.sql` | the seven definitions above, all `MANUAL`, all `includes_pii = false`, all paused off but flag-gated |
| Client | `lib/sheets/client.ts` | service-account JWT, token cache, `spreadsheets` scope only; `import 'server-only'` first line. **`lib/sheets/` is not in D2's domain list** — raised in *Open questions* 4 alongside Phase 38's `lib/ops/` |
| Writer | `lib/sheets/write.ts` | staging-tab write, chunking, atomic swap |
| Retry | `lib/sheets/retry.ts` | backoff, jitter, `Retry-After`, non-retryable classes |
| Definitions | `lib/sheets/definitions.ts` | entity → column allowlist → row builder; one builder per entity |
| Errors | `lib/sheets/errors.ts` | `SheetsAuthError`, `SheetsQuotaError`, `SheetsWriteError`, sanitised codes only |
| Repository | `lib/supabase/repositories/sheets.ts` | definitions, runs, pause/resume |
| Sheets route | `app/(studio)/studio/research/sheets/page.tsx` + `actions.ts` | list, edit, run now, resume |
| Definition form | `components/studio/sheets/ExportDefinitionForm.tsx` | entity, column picker from allowlist, filter, tab, schedule, PII toggle |
| Run history | `components/studio/sheets/SheetsRunHistory.tsx` | status, rows, cells, duration, attempts, error code |
| CLI | `scripts/sheets/sync.ts` (`npm run sheets:sync`) | `--definition=<slug>`, `--dry-run` (builds rows, prints counts, writes nothing) |
| Cron | `app/api/cron/sheets-sync/route.ts` | scheduled definitions only; `REVALIDATE_SECRET`; skips paused |
| Flag | `lib/flags/flags.ts` | adds `google_sheets`, default `false` |
| Docs | `docs/ops/ENVIRONMENT.md`, `docs/ops/DEPLOYMENT.md`, `docs/studio/STUDIO_GUIDE.md` | service-account setup, sharing step, failure semantics |
| Tests | `tests/unit/sheets-definitions.test.ts`, `sheets-retry.test.ts`, `sheets-redaction.test.ts`, `tests/e2e/sheets-studio.spec.ts` | column allowlist, backoff, no-secret-leak, UI walk |

**Database**

| Table | Change | Key columns |
|---|---|---|
| `sheets_export_definitions` | new | `id uuid pk`, `slug citext unique not null`, `name text not null`, `entity text not null check (entity in ('RESEARCH_PRODUCTS','COMPARISON_SET','OPPORTUNITY_SCORES','SHORTLIST','CONFIRMED','DIRECTION_BRIEFS','INQUIRIES'))`, `scope_id uuid null`, `columns text[] not null`, `filter jsonb not null default '{}'`, `spreadsheet_id text null`, `tab_name text not null`, `schedule text not null default 'MANUAL'`, `includes_pii bool not null default false`, `is_enabled bool not null default true`, `paused_at timestamptz null`, `paused_reason text null`, `consecutive_failures int not null default 0`, `last_run_at`, `last_status text`, `created_at`, `created_by`, `updated_at`, `updated_by`; `check (array_length(columns, 1) between 1 and 40)` |
| `sheets_sync_runs` | new | `id uuid pk`, `definition_id uuid not null references sheets_export_definitions(id) on delete cascade`, `status text not null check (status in ('RUNNING','SUCCEEDED','FAILED','SKIPPED'))`, `trigger text not null check (trigger in ('MANUAL','CRON','CLI'))`, `row_count int not null default 0`, `cell_count int not null default 0`, `attempts int not null default 0`, `error_code text null`, `duration_ms int null`, `started_at timestamptz not null default now()`, `finished_at timestamptz null`, `actor_id uuid null` |

`spreadsheet_id` is an identifier, not a secret, and is displayed. The service-account **email** is
displayed too, because sharing the sheet with it is a step the admin must perform. The private key
inside `GOOGLE_SERVICE_ACCOUNT_JSON` is never read into any column, log line, error message or API
response — `sheets-redaction.test.ts` proves it.

RLS: `select` on both tables requires `research.read` or `analytics.read`; creating and editing a
definition requires `integrations.sheets.manage`; running requires `integrations.sheets.run`, and
the `INQUIRIES` entity additionally requires `inquiries.export`, checked in the action. Runs are
written by the service role. No `anon` policy.

**Studio surface** — fills `/studio/research/sheets`: definitions table (name, entity, tab,
schedule, PII, last run, status), the definition form, run history, **Run now**, **Pause**,
**Resume**. A banner states the flag state, the destination spreadsheet id and the service-account
email to share it with. Adds a cross-link from `/studio/operations/exports`.

**Public surface** — None.

**Media** — None. No asset id, Cloudinary URL or media binary is exported; media columns are absent
from every allowlist.

**Risks**

| Risk | Mitigation |
|---|---|
| The service-account private key leaks into a log, an error message or a run record | The credential is parsed inside `lib/sheets/client.ts`, never returned; `errors.ts` maps upstream errors to fixed codes; `sheets-redaction.test.ts` injects a fake key and greps every log line, run row and HTTP response for it |
| Someone edits the Sheet and expects Rivya to change | The integration has no read path; the header row of every generated tab ends with a fixed cell reading that the tab is generated and edits are overwritten; `STUDIO_GUIDE.md` says so |
| A reader sees a half-written tab | Staging tab plus a single atomic delete-and-rename `batchUpdate`; a failed run leaves the previous tab intact, asserted by an integration test against a fixture spreadsheet |
| Quota exhaustion turns into an infinite retry loop | 5 attempts, capped backoff, `Retry-After` honoured, and a circuit breaker that pauses the definition after three consecutive failed runs |
| Customer PII is exported by someone who should not | PII columns exist only on `INQUIRIES`, require `includes_pii`, an admin-created definition, `inquiries.export` at run time, and produce an audit row per run |
| A definition silently exports the wrong rows after a filter change | Every run stores `row_count` and the filter is versioned with the definition's `updated_at`; the run history shows both, and a row-count change greater than 50% renders a warning badge |
| Cron runs pile up when a run is slow | One run per definition at a time, enforced by a partial unique index on `(definition_id) where status = 'RUNNING'`; a second attempt records `SKIPPED` |

**Verification**

1. `npx supabase db push` — `0340`–`0342` apply; `select slug, entity, schedule, includes_pii from
   sheets_export_definitions order by slug` returns the seven seeded definitions, all `MANUAL`, all
   `false`.
2. `npm run test:unit -- sheets-definitions sheets-retry sheets-redaction` — the column allowlist
   rejects an unknown column; backoff produces the expected delay sequence with a stubbed clock; the
   redaction test finds no fragment of the injected fake private key anywhere.
3. With `google_sheets` off, POST the run action → refused with a flag reason and no network call
   (asserted by a fetch spy).
4. Turn the flag on as `owner`. `npm run sheets:sync -- --definition=research-products --dry-run` —
   prints the row and cell counts, performs no write, creates a `SKIPPED` run record.
5. `npm run sheets:sync -- --definition=research-products` against a test spreadsheet — the tab is
   replaced, `sheets_sync_runs` shows `SUCCEEDED` with row and cell counts, and the tab's header row
   matches the definition's column list in order.
6. Revoke the spreadsheet share and re-run → the run fails with `error_code = 'AUTH'`, is not
   retried, the Studio banner names the sharing step, and no response body is stored.
7. Force three consecutive failures → `paused_at` is set, the cron skips the definition, and the
   Studio shows the paused banner with a **Resume** action gated to `integrations.sheets.manage`.
8. Create an `INQUIRIES` definition as `admin` with `includes_pii = true`; run it as **`researcher`**
   — who holds `integrations.sheets.run` per this block's permission table and does **not** hold
   `inquiries.export` in the Phase 04 matrix → refused with a `DENIED` audit row and no network call.
   The actor here must not be `merchandiser`: the Phase 04 matrix grants `inquiries.export` to owner,
   admin **and** merchandiser, so a merchandiser can never produce this refusal. Run the same
   definition as `merchandiser` → it succeeds, which is the paired assertion.
9. Attempt to set `includes_pii = true` as `merchandiser` → refused (`integrations.sheets.manage` is
   owner and admin only).
10. `curl -X POST $NEXT_PUBLIC_SITE_URL/api/cron/sheets-sync` without the secret → 401; with it →
    only scheduled, enabled, unpaused definitions run.
11. `npx playwright test tests/e2e/sheets-studio.spec.ts` — create a definition, pick columns, run,
    read the history, pause, resume, at 1920 and 390.

**Exit criteria**

- [ ] Authentication uses a service account with the `spreadsheets` scope only; no Drive scope is
      requested anywhere.
- [ ] The private key never appears in a log, run row, error message or HTTP response, proven by a
      test that injects a known fake key and searches for it.
- [ ] The integration has no inbound path: no code reads cell values back into any Rivya table, and
      a CI grep for a Sheets read method in `lib/sheets/` fails the build.
- [ ] Writes are atomic from a reader's perspective via the staging-tab swap; a failed run leaves the
      previous tab intact.
- [ ] Retries are bounded, honour `Retry-After`, and never retry `401`/`403`.
- [ ] Three consecutive failures pause a definition, and resuming requires `integrations.sheets.manage`.
- [ ] Only one run per definition can be `RUNNING`, enforced by a partial unique index.
- [ ] PII is exportable only from `INQUIRIES`, only with `includes_pii`, only by a holder of
      `inquiries.export`, and every such run is audited.
- [ ] Columns come from a per-entity allowlist; an arbitrary column name is rejected.
- [ ] `google_sheets` ships `false`, and every run path is unreachable while it is off.
- [ ] `docs/ops/ENVIRONMENT.md` documents the setup and the sharing step without naming a secret
      value; `OWNER_VERIFICATION_REQUIRED` is recorded against the statement that a Google Workspace
      account and spreadsheet exist for Rivya.
- [ ] Phase-specific D9 evidence: docs updated = `ENVIRONMENT.md`, `DEPLOYMENT.md`,
      `STUDIO_GUIDE.md`, `DATA_MODEL.md`; tests run = three unit suites and `sheets-studio.spec.ts`;
      next phase = 37.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 37 — Studio Analytics

**Goal** — The Analytics tab that Phase 05 stubbed on `/studio` becomes real, and becomes honest.
Eighteen metrics — the eight first-party and ten competitive dimensions of FEAT §28 — are declared
in a registry, each with its own definition, its own data requirement and its own coverage rule.
A metric that can be computed renders a figure with `n`, denominator and an as-of date. A metric
that cannot renders `UNAVAILABLE` with the named reason it cannot: not zero, not a dash, not an
estimate, not a plausible-looking placeholder. Several of FEAT §28's competitive dimensions will be
unavailable on day one because no source adapter captures them, and several first-party ones will
read zero because the catalogue is genuinely empty — both are correct outputs and the tab is
designed to make them legible rather than embarrassing.

**Depends on** — Phase 31 (competitive computation and snapshots), Phase 32 (opportunity scores),
Phase 26 (source freshness), Phase 14/16 (catalogue and collections), Phase 17/18 (portfolio,
journal), Phase 20 (inquiries), Phase 06/07 (media registry), Phase 05 (`StatCard`, the dashboard
card registry, the Analytics tab shell).

**Scope**

- **The metric registry**, `lib/analytics/metrics/` — one module per metric exporting
  `{ id, label, dimension, definition, requires, compute, coverage, availableFrom }`. The registry
  is the only list; the tab renders whatever it contains, and `tests/unit/analytics-registry.test.ts`
  asserts the registry contains exactly the eighteen FEAT §28 ids and no others.

| # | Metric id | Dimension | Definition | Availability rule |
|---|---|---|---|---|
| 1 | `catalog` | first-party | products by status, by readiness score band, created in the last 30/90 days | always; reads zero when empty |
| 2 | `product_categories` | first-party | published products per D3 category, share of catalogue | always |
| 3 | `product_scale` | first-party | longest declared axis distribution for products with `dimensions` | needs ≥ 5 products with dimensions, else `UNAVAILABLE: no product dimensions recorded` |
| 4 | `large_format_share` | first-party | share of published products with `is_large_format` | needs ≥ 1 published product |
| 5 | `collection_mix` | first-party | published collections, products per collection, unassigned products | always |
| 6 | `inquiry_trends` | first-party | inquiries per week by `kind` and `pipeline_status`; WhatsApp handoff share | needs ≥ 1 inquiry |
| 7 | `content_performance` | first-party | **database-derived only**: published vs draft pages, sections per page, days since update, inquiries attributed by `source_path` | always — see the note below |
| 8 | `media_coverage` | first-party | share of published entities with hero, gallery ≥ 3, a mobile slot and non-empty alt text; share of `media_assets` used in the CMS; concept-asset share | always |
| 9 | `assortment` | competitive | Phase 31 assortment snapshot per source and category | needs ≥ 1 successful run in 30 days |
| 10 | `price_architecture` | competitive | Phase 31 percentiles and bands, per currency | needs ≥ 12 priced rows in that currency |
| 11 | `dimensions` | competitive | Phase 31 axis percentiles over rows whose dimensions parsed | needs ≥ 12 rows at `dimension_parse_state = 'PARSED'` |
| 12 | `materials` | competitive | frequency of `material_tokens` across research rows | needs materials captured by ≥ 1 enabled adapter |
| 13 | `resin_styles` | competitive | frequency of normalised resin-style terms | `UNAVAILABLE: no enabled adapter captures resin style` until an adapter declares the capability |
| 14 | `colours` | competitive | frequency of normalised colour terms | `UNAVAILABLE` on the same rule |
| 15 | `customization` | competitive | share of research rows offering customisation | needs the attribute captured by ≥ 1 adapter |
| 16 | `production_model` | competitive | made-to-order vs stocked, where stated by the source | `UNAVAILABLE` on the same rule |
| 17 | `opportunity_scores` | competitive | Phase 32 score distribution, per category, with the active model version | needs an `ACTIVE` model and ≥ 1 scored row |
| 18 | `source_freshness` | competitive | per source, read from `research_source_health_v`: `last_run_at`, `last_run_status`, `success_rate_7d`, `queue_depth`, `health` (`HEALTHY · DEGRADED · FAILING · STALE · DISABLED`), plus rows captured | always |

- **Adapter capability declaration.** Metrics 12–16 depend on whether an adapter extracts a field at
  all. Phase 27's `SourceAdapter` already declares `capabilities: AdapterCapability[]` (`DISCOVER ·
  EXTRACT · PAGINATE`) and Phase 26's `research_sources.attribute_extraction` declares which
  attribute keys a source is configured to pull. The registry reads **both** — the adapter for the
  shape it can produce, the source for the keys it is configured to look for — so `UNAVAILABLE`
  names the missing attribute key and the sources that would need it rather than saying "no data".
  This turns an empty chart into a work item. Adding a new attribute key is a Phase 26/27 change,
  not a Phase 37 one; this phase reads the declaration and never widens it.
- **`content_performance` is not pageviews.** No web-analytics provider exists in D1's stack. Rather
  than invent one or leave the metric blank, the metric is redefined as the database-derived content
  health described above, and the tab states in one line that traffic analytics are not connected.
  Adding a provider is an owner decision recorded as `OWNER_VERIFICATION_REQUIRED` in
  `docs/ops/PERFORMANCE.md` and raised in *Open questions*.
- **Snapshots and trends.** `analytics_snapshots` stores one row per metric per day, written by
  `npm run analytics:snapshot` and a daily cron, so a sparkline has real history. A metric with
  fewer than two snapshots renders a single figure and no line — never an extrapolation. Retention:
  400 days.
- **Role scoping.** `analytics.read` (every role) sees first-party metrics. Competitive metrics
  additionally require `research.read`, so `editor` sees eight tiles and `researcher` sees eighteen.
  The tab does not render a locked placeholder for metrics a role cannot see; they are absent.
- **Rendering.** `StatCard` for scalars, the Phase 31 chart primitives for distributions, and
  `CoverageBadge` on every tile. Every chart has an adjacent, screen-reader-reachable data table.
  Export of any tile goes through a Phase 36 definition rather than a second exporter.

**Out of scope**

- Web analytics, pageviews, sessions, bounce rate, funnels, referrers, heatmaps, or any behavioural
  measurement. None is instrumented and none may be estimated.
- Revenue, conversion value, average order value, forecast or attribution modelling. Rivya has no
  checkout, so any of these would be fabricated (D1, D10).
- Ranking sources or products as better or worse — Phase 32 owns the only ranking in the system.
- A public-facing dashboard, or any metric on a D3 route.
- New computation of competitive analytics. Phase 37 reads Phase 31 and 32 snapshots; if a snapshot
  is stale the tile says so rather than recomputing in the request path.
- Per-user or per-visitor data of any kind.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Migration | `supabase/migrations/0350_phase37_analytics_snapshots.sql` | `analytics_snapshots`, retention index |
| RLS | `supabase/migrations/0351_phase37_analytics_rls.sql` | read by `analytics.read`; service-role writes |
| Registry | `lib/analytics/metrics/index.ts` | the eighteen ids; the only list |
| Metric modules | `lib/analytics/metrics/<id>.ts` | eighteen files, each with `definition`, `requires`, `compute`, `coverage` |
| Availability | `lib/analytics/availability.ts` | resolves `requires` against tables, adapter capabilities and row counts; returns a named reason |
| Snapshot writer | `lib/analytics/snapshot.ts` | one row per metric per day, idempotent per date |
| Repository | `lib/supabase/repositories/analytics.ts` | snapshot read/write, trend series |
| Analytics tab | `app/(studio)/studio/page.tsx` (Analytics tab) + `components/studio/analytics/AnalyticsTab.tsx` | replaces the Phase 05 stub |
| Tiles | `components/studio/analytics/{MetricTile,MetricUnavailable,MetricTrend}.tsx` | `UNAVAILABLE` renders the named reason and the work item |
| Dashboard cards | `lib/analytics/dashboard-cards.ts` (extended) | FEAT §17 cards now resolve real numbers where their tables exist |
| CLI | `scripts/analytics/snapshot.ts` (`npm run analytics:snapshot`) | `--date=`, `--only=<metric>`, `--dry-run` |
| Cron | `app/api/cron/analytics-snapshot/route.ts` | daily; `REVALIDATE_SECRET` |
| Flag | `lib/flags/flags.ts` | adds `advanced_analytics` (gates trends and the competitive block), default `false` |
| Docs | `docs/studio/STUDIO_GUIDE.md`, `docs/ops/PERFORMANCE.md`, `docs/architecture/DATA_MODEL.md` | every metric's definition and availability rule, verbatim |
| Tests | `tests/unit/analytics-registry.test.ts`, `analytics-availability.test.ts`, `analytics-no-fabrication.test.ts`, `tests/e2e/studio-analytics.spec.ts` | id parity, availability reasons, empty-database behaviour |

**Database**

| Table | Change | Key columns |
|---|---|---|
| `analytics_snapshots` | new | `id uuid pk`, `metric_id text not null`, `dimension text not null check (dimension in ('FIRST_PARTY','COMPETITIVE'))`, `as_of date not null`, `value jsonb not null`, `n int null`, `denominator int null`, `availability text not null check (availability in ('AVAILABLE','UNAVAILABLE'))`, `unavailable_reason text null`, `computed_at timestamptz not null default now()`, `computed_by uuid null`; `unique (metric_id, as_of)`; `check ((availability = 'UNAVAILABLE') = (unavailable_reason is not null))` |

The final check constraint is the phase's core invariant in one line: an unavailable metric must
carry a reason, and an available one must not pretend to have been unavailable. No other table is
created; every metric reads existing tables and Phase 31/32 snapshots.

RLS: `select` requires `analytics.read`; rows with `dimension = 'COMPETITIVE'` additionally require
`research.read`, enforced by a policy predicate on `current_staff_role()` rather than filtered in
application code. Writes are service-role only. No `anon` policy.

**Studio surface** — fills the **Analytics** tab of `/studio` (D4 lists analytics as an overview
concern, not a route segment; Phase 05 rendered it as a tab and this phase fills it, per Phase 05's
open question 5). Two sections: **This studio** (metrics 1–8) and **The market** (metrics 9–18,
`research.read` only, gated additionally by `advanced_analytics`). Each tile shows label, figure,
coverage badge, trend where two snapshots exist, and a definition popover carrying the exact wording
from `STUDIO_GUIDE.md`. The FEAT §17 dashboard cards on the Overview tab stop showing their
Phase 05 unavailable state wherever a real number now exists.

**Public surface** — None.

**Media** — None rendered. `media_coverage` reads `media_assets` as data, including the 250 migrated
manifest assets, and reports the concept-asset share so the owner can see how much of the site is
still illustrated with AI concept media rather than real photography. It displays no image.

**Risks**

| Risk | Mitigation |
|---|---|
| An empty catalogue makes the tab look broken, and someone fills it with sample numbers | `analytics-no-fabrication.test.ts` runs the whole registry against an empty database and asserts every tile is either a true zero with `n = 0` or `UNAVAILABLE` with a reason, and that no fixture or seed inserts analytics rows |
| `UNAVAILABLE` is read as a bug rather than a fact | The tile names the reason and, for metrics 12–16, the adapter capability and the sources that would supply it; the copy is seeded through `global_content` group `EMPTY_STATE`, never hard-coded |
| Trend lines are drawn through one data point | `MetricTrend` requires ≥ 2 snapshots; below that it renders the scalar only, asserted by a unit test |
| Competitive figures leak to a role without research access | The RLS predicate, not the UI, enforces it; `studio-analytics.spec.ts` signs in as `editor` and asserts the competitive section is absent from the DOM, not merely hidden |
| The tab becomes slow as the corpus grows | Every metric reads `analytics_snapshots` or a Phase 31 snapshot; nothing scans `research_products` in the request path; a unit test asserts each `compute()` is called only by the snapshot writer |
| Metric definitions drift between the docs and the code | Each module exports `definition` as a string, and a unit test asserts the eighteen strings appear verbatim in `STUDIO_GUIDE.md` |
| Content performance is mistaken for traffic data | The section header states that traffic analytics are not connected; the metric's `definition` string says so; `PERFORMANCE.md` records the owner decision as outstanding |

**Verification**

1. `npx supabase db push` — `0350`/`0351` apply.
2. `npm run test:unit -- analytics-registry analytics-availability analytics-no-fabrication` —
   registry ids equal the eighteen FEAT §28 ids exactly; the no-fabrication suite runs against an
   empty database and passes.
3. `npm run analytics:snapshot -- --date=$(date -I) --dry-run` — prints eighteen lines, each with
   availability and, when unavailable, a reason. No row is written.
4. `npm run analytics:snapshot` twice for the same date — the second run updates rather than
   duplicating; `select count(*) from analytics_snapshots where as_of = current_date` equals 18.
5. `psql "$DATABASE_URL" -c "select metric_id, availability, unavailable_reason from
   analytics_snapshots where as_of = current_date order by metric_id"` — every `UNAVAILABLE` row has
   a non-empty reason and every `AVAILABLE` row has none; the constraint makes the alternative
   impossible.
6. With zero published products, open `/studio` → Analytics. Metrics 1, 2, 4, 5 read zero with
   `n = 0`; metric 3 renders `UNAVAILABLE: no product dimensions recorded`; nothing renders a
   placeholder figure, a dash-as-number, or an invented total.
7. Publish three products with dimensions, re-snapshot, reload — metric 3 becomes available with
   `n = 3` and, being below the Phase 31 sample floor, suppresses percentiles.
8. Sign in as `editor` → eight tiles, and `curl` the analytics data endpoint directly → competitive
   rows are absent (RLS), not merely hidden. Sign in as `researcher` → eighteen tiles.
9. Disable every research source, re-snapshot — metrics 9–11 render `UNAVAILABLE: no successful run
   in the last 30 days` and name the sources.
10. Turn `advanced_analytics` off → the market section is absent and the first-party section is
    unchanged.
11. `npx playwright test tests/e2e/studio-analytics.spec.ts` — tab render, role matrix, coverage
    badges, definition popovers, keyboard access to every chart's data table, at 1920/1440/430/390.

**Exit criteria**

- [ ] The registry contains exactly the eighteen FEAT §28 metrics, proven by id-parity test.
- [ ] Every metric declares a definition string, a data requirement and a coverage rule, and the
      definition strings appear verbatim in `STUDIO_GUIDE.md`.
- [ ] An unavailable metric always carries a named reason, enforced by a check constraint.
- [ ] Against an empty database every tile is a true zero or a reasoned `UNAVAILABLE`; no sample,
      seeded or estimated analytics value exists anywhere in the repository.
- [ ] Metrics 13, 14 and 16 render an adapter-capability reason rather than an empty chart.
- [ ] `content_performance` is database-derived and the tab states that traffic analytics are not
      connected; the owner decision is recorded, not silently assumed.
- [ ] Trends require two snapshots; nothing is extrapolated or interpolated.
- [ ] Competitive metrics are gated by RLS, not by UI filtering, proven by a direct request as
      `editor`.
- [ ] No metric computes in the request path; the tab reads snapshots.
- [ ] Every chart has an accessible data table and every tile a coverage badge.
- [ ] Phase-specific D9 evidence: docs updated = `STUDIO_GUIDE.md`, `PERFORMANCE.md`,
      `DATA_MODEL.md`; tests run = three unit suites and `studio-analytics.spec.ts`; next phase = 38.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 38 — Environment + Documentation + Logs

**Goal** — The System group stops being the place where an operator has to guess. Three read-only
surfaces land together because they share one piece of machinery — a redactor — and one rule: none
of them may ever show a secret. `/studio/system/environment` reports whether each integration is
configured and reachable, which migration the database is on, and which commit is deployed, using
only booleans, statuses, durations and identifiers. `/studio/system/documentation` serves the ten
FEAT §30 documents from a build-time allowlist, rendered without raw HTML. `/studio/operations/logs`
gives the operational log its own home, distinct from the audit trail and the activity feed, with
filters that make an incident findable and a retention policy that keeps the table from becoming the
largest thing in the database. After this phase, an operator can answer "is it up, what is deployed,
what broke and where is that documented" without opening a terminal.

**Depends on** — Phase 04 (`audit_logs`, roles, `requirePermission`), Phase 05 (`activity_events`,
Studio primitives, stubbed System routes), Phase 06 (Cloudinary), Phase 25–30 (scraper modules that
emit logs), Phase 36 (Sheets health), D8 (the environment-variable names).

**Scope**

- **One redactor for all three surfaces.** `lib/logging/redact.ts` exports `redact(value)` and
  `redactDeep(obj)`. It removes, by name, every D8 server-only variable and any key matching
  `/(secret|token|key|password|credential|authorization|cookie)/i`, and, by shape, JWT-like strings,
  `-----BEGIN … PRIVATE KEY-----` blocks, Cloudinary URLs containing credentials, and
  `postgres(ql)?://user:pass@` connection strings. It replaces with a fixed `[redacted]` — never a
  prefix, never a suffix, never a length, never a hash (D8's "never a value, prefix or length" is
  taken literally). Every log write, every environment check result and every documentation render
  passes through it.
- **Environment page (FEAT §29, D8).** For each integration a check returns
  `{ id, configured: boolean, status, latency_ms, checked_at, code }` where `status` is one of
  `OK · DEGRADED · UNREACHABLE · NOT_CONFIGURED · UNKNOWN` and `code` is from a fixed enum — an
  upstream error message is never rendered, because upstream messages quote request URLs.

| Check | What it does | What it never does |
|---|---|---|
| `supabase_db` | `select 1` through the server client, timed | print the connection string or host credentials |
| `supabase_auth` | `getSession()` round-trip against the project URL | print keys |
| `cloudinary` | signed ping of the account usage endpoint | print `CLOUDINARY_API_SECRET` or a signed URL |
| `google_sheets` | token mint only, no spreadsheet read | print the service-account private key |
| `vercel` | reads the build-info module, not an API | require a Vercel token |
| `higgsfield` | manifest presence and asset count from `data/higgsfield/asset-manifest.json` | call the Higgsfield API — the manifest is the record of truth (D6) |
| `migrations` | applied count and latest version from `supabase_migrations.schema_migrations` vs files in `supabase/migrations/` | run or repair a migration |
| `build` | commit SHA, branch, build time, environment from `lib/ops/build-info.generated.ts` | expose environment variable values |

  `configured` is computed from the **presence of the variable name** in the process environment,
  never from its content. `scripts/build/write-build-info.ts` generates
  `lib/ops/build-info.generated.ts` at build time from `git rev-parse` with a `VERCEL_GIT_COMMIT_SHA`
  fallback, so no new secret and no runtime git dependency is introduced.
- **Documentation browser (FEAT §30).** A build step, `npm run docs:index`, reads an **allowlist**
  of exactly ten paths — `docs/architecture/ARCHITECTURE.md`, `docs/studio/STUDIO_GUIDE.md`,
  `docs/media/MEDIA_GUIDE.md`, `docs/architecture/SCRAPER.md`, `docs/ops/DEPLOYMENT.md`,
  `docs/ops/ENVIRONMENT.md`, `docs/project/BUSINESS_RULES.md`, `docs/content/CONTENT_GUIDE.md`,
  `docs/design/COMPONENT_REGISTRY.md`, `docs/media/HIGGSFIELD_GUIDE.md` — runs each through
  `redactDeep`, and writes `content/docs/index.generated.json`. No directory walk, no path
  parameter that touches the filesystem, no `..` to defend against: a request names an allowlist
  **key**, and an unknown key is `notFound()`. Rendering disallows raw HTML and scripts, rewrites
  relative links to in-app doc keys, and marks links that leave the allowlist as external and
  unclickable within the browser.
- **System logs (FEAT §31).** FEAT §31's single list mixes severity with subject, so it is
  decomposed into two orthogonal columns: `level` (`INFO · WARNING · ERROR · SECURITY`) and
  `channel` (`WORKFLOW · SCRAPER · MEDIA · CONTENT · AUTH · SHEETS · ANALYTICS · SYSTEM`). Every
  FEAT §31 type is therefore representable, and filtering by "SCRAPER errors" becomes one query.
  `lib/logging/system-log.ts` exports `logSystem({ level, channel, event, message, context, … })`,
  redacts, and inserts. Filters on the page: time range, level, channel, actor, workflow run,
  research source, entity type and id, and free-text over `event`.
- **Three logs, three jobs — stated once so nobody merges them:**

| Log | Table | Written by | Read by | Answers |
|---|---|---|---|---|
| Audit | `audit_logs` (Phase 04) | every privileged mutation and every denial | owner, admin | who was allowed or refused to do what |
| Activity | `activity_events` (Phase 05) | human Studio actions worth showing in a feed | any staff member | what has been happening in the Studio |
| System | `system_logs` (this phase) | background jobs, integrations, cron, workflow runs | owner, admin | what the machine did and where it failed |

- **Volume control.** Every log call carries a `dedupe_key`; repeated identical events within a
  five-minute window increment `occurrence_count` instead of inserting. Retention: `INFO` and
  `WARNING` 90 days, `ERROR` and `SECURITY` 400 days, purged by a daily cron that logs its own
  summary at `INFO`.

**Out of scope**

- Staff user administration. `PHASE-05-09.md` states that role management UI is Phase 38, but Phase
  04 already delivered `/studio/system/users` with invite, role change and suspend. This phase does
  not rebuild it; the contradiction is recorded in *Open questions*.
- Site settings and integration credentials editing. `/studio/system/settings` and
  `/studio/system/integrations` stay as their owning phases left them; the environment page is
  read-only and offers no "fix it" action.
- The feature-flags screen. Phase 19 shipped the primitive and the owner-only toggle at
  `/studio/system/flags`; this phase extends neither, answering `PHASE-16-22.md` open question 6:
  Phase 38 does not replace it, and the flags added by Phases 33, 36 and 37 register themselves.
- Editing documentation from the Studio. The browser is read-only; the repository is the source.
- Serving `README.md`, `CLAUDE.md`, `docs/ops/SECURITY.md`, `docs/SESSION-STATE.md`,
  `docs/requirements/**`, `.env*`, migrations or any file outside the ten-path allowlist.
- Log shipping to a third-party observability service, alerting, paging or metrics scraping.
- Any public surface.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Migration | `supabase/migrations/0360_phase38_system_logs.sql` | `system_logs`, enums, dedupe index, retention index |
| RLS | `supabase/migrations/0361_phase38_system_logs_rls.sql` | `operations.logs.read` only; no update, no delete policy |
| Redactor | `lib/logging/redact.ts` | `redact`, `redactDeep`, the name list and the shape patterns |
| System logger | `lib/logging/system-log.ts` | `logSystem()`, dedupe window, redaction before insert |
| Env checks | `lib/ops/env-checks/*.ts` | one module per check in the table above; each returns the fixed shape. **`lib/ops/` is not in D2's domain list** — see the note below and *Open questions* 4 |
| Check runner | `lib/ops/environment.ts` | runs checks in parallel with a 3 s per-check timeout |
| Build info | `scripts/build/write-build-info.ts` → `lib/ops/build-info.generated.ts` | git SHA, branch, built-at, environment; generated, gitignored, and placed inside `lib/ops/` so the block adds one new `lib/` domain rather than a loose top-level module |
| Docs indexer | `scripts/docs/build-index.ts` (`npm run docs:index`) | allowlist read, redact, write `content/docs/index.generated.json` |
| Docs renderer | `lib/cms/docs/render.ts` | Markdown without raw HTML; link rewriting; heading anchors. Placed under `lib/cms/` — a D2 domain — because rendering authored Markdown into a Studio page is exactly what `lib/cms` does; no `lib/docs/` domain is created |
| Environment page | `app/(studio)/studio/system/environment/page.tsx` | server-rendered, no client fetch of check results |
| Documentation page | `app/(studio)/studio/system/documentation/page.tsx` + `[docKey]/page.tsx` | allowlist keys only |
| Logs page | `app/(studio)/studio/operations/logs/page.tsx` + `actions.ts` | filters, detail drawer, CSV export |
| Log components | `components/studio/ops/{LogTable,LogFilters,LogDetail}.tsx` | `context` rendered as redacted JSON |
| Retention cron | `app/api/cron/log-retention/route.ts` | daily purge; `REVALIDATE_SECRET` |
| Docs | `docs/ops/ENVIRONMENT.md`, `docs/ops/SECURITY.md`, `docs/studio/STUDIO_GUIDE.md`, `docs/architecture/DATA_MODEL.md` | the check list, the redaction rule, the three-log distinction |
| Tests | `tests/unit/redact.test.ts`, `env-checks-no-secrets.test.ts`, `docs-allowlist.test.ts`, `system-log-dedupe.test.ts`, `tests/e2e/studio-system.spec.ts` | the load-bearing leak tests |

**Phase 38 adds one new `lib/` domain, named rather than smuggled.** D2 fixes the `lib/` list at
`supabase · media · cms · auth · whatsapp · scraper · analytics · seo · logging · flags`, and
`lib/ops/` is not on it. It is not folded into `lib/logging/` because an environment check is not a
log — it performs
outbound reachability probes, holds timeouts and returns a status shape that the logger merely
happens to record — and burying it under `logging` would misfile the one module in the system whose
whole job is to touch every integration. `lib/cms/docs/render.ts` and `lib/media/hashes.ts`
(Phase 33) both sit inside existing D2 domains for the same reason in reverse: they genuinely belong
there. So this block adds exactly two new domains across eight phases — `lib/sheets/` (Phase 36) and
`lib/ops/` (Phase 38) — both raised together in *Open questions* 4, following the precedent
`PHASE-10-15.md` (`lib/site/`, `lib/catalog/`) and `PHASE-23-30.md` (`lib/search/`, `lib/relations/`,
`lib/bulk/`) already set. Neither is a silent divergence.

**Database**

| Table | Change | Key columns |
|---|---|---|
| `system_logs` | new | `id uuid pk`, `level log_level not null`, `channel log_channel not null`, `event text not null`, `message text not null`, `context jsonb not null default '{}'`, `actor_id uuid null`, `actor_role user_role null`, `request_id text null`, `workflow_run_id uuid null`, `research_source_id uuid null`, `entity_type text null`, `entity_id uuid null`, `dedupe_key text not null`, `occurrence_count int not null default 1`, `first_occurred_at timestamptz not null default now()`, `occurred_at timestamptz not null default now()`; indexes `(occurred_at desc)`, `(level, occurred_at desc)`, `(channel, occurred_at desc)`, `(actor_id, occurred_at desc)`, `(workflow_run_id)`, unique `(dedupe_key, date_trunc('minute', first_occurred_at))` |

New enums: `log_level` = `INFO · WARNING · ERROR · SECURITY`; `log_channel` = `WORKFLOW · SCRAPER ·
MEDIA · CONTENT · AUTH · SHEETS · ANALYTICS · SYSTEM`. Like `audit_logs` and `activity_events`,
`system_logs` is an append-only operational table and a documented exemption from the D5
content-column rule.

RLS: `select` requires `operations.logs.read` (owner, admin). There is no `update` or `delete`
policy for any application role; the retention cron runs as the service role. No `anon` policy. The
environment page and the documentation browser create no tables at all — the environment page holds
no state, and documentation is a build artefact.

**Studio surface** — fills `/studio/system/environment` (`system.environment.read`),
`/studio/system/documentation` and `/studio/system/documentation/[docKey]` (`system.docs.read`), and
`/studio/operations/logs` (`operations.logs.read`, with export gated by `operations.logs.export`).
The environment page carries a permanent line stating that it reports reachability only and never
displays a value; the documentation browser carries a line stating that documents are served from a
fixed allowlist and are redacted at build time.

**Public surface** — None.

**Media** — None rendered. The `higgsfield` environment check reads
`data/higgsfield/asset-manifest.json` and reports `manifest_version`, the total (250), the image and
video split (224 / 26) and the family count (24), so an operator can see at a glance that the
manifest is present and intact. It displays no asset and generates nothing (D6, FEAT §33).

**Risks**

| Risk | Mitigation |
|---|---|
| A secret reaches one of the three surfaces | One redactor, applied on every path, plus `env-checks-no-secrets.test.ts`: each D8 server-only variable is set to a unique sentinel, all three surfaces are rendered, every check result and every log row is serialised, and the test fails if any sentinel or any four-character fragment of it appears |
| An upstream error message quotes a credentialed URL | Checks never render upstream text; they map to a fixed `code` enum, asserted by a test that stubs an error containing a sentinel URL |
| The documentation browser becomes a file reader | The route takes an allowlist key, not a path; `docs-allowlist.test.ts` requests `../../.env`, `docs/ops/SECURITY.md` and an absolute path and asserts 404 for each; the index is a build artefact so the production runtime has no docs directory to traverse |
| Markdown renders raw HTML or a script | The renderer disallows raw HTML; a test feeds a document containing `<script>` and an `onerror` attribute and asserts both are escaped |
| A log storm fills the database | Dedupe key plus a one-minute unique window and `occurrence_count`; retention cron with level-dependent windows; `system-log-dedupe.test.ts` writes 1,000 identical events and asserts one row with `occurrence_count = 1000` |
| The three logs collapse into one and the audit trail loses its meaning | The table above is in `DATA_MODEL.md` and `SECURITY.md`; a CI check fails if `logSystem()` is called from a server action that also calls `writeAudit()` for the same event name |
| An operator believes a green environment page means the site is correct | Every check reports reachability with a timestamp; the page states that it is not a functional test and links to `docs/ops/TESTING.md` |
| `configured` leaks whether a secret is short or empty | `configured` is `name in process.env && value.length > 0` collapsed to a boolean before it leaves the check; the length is never returned, asserted by a type-level test on the check result shape |

**Verification**

1. `npx supabase db push` — `0360`/`0361` apply. `psql "$DATABASE_URL" -c "update system_logs set
   message='x'"` as the authenticated role — permission denied, proving append-only.
2. `npm run test:unit -- redact env-checks-no-secrets docs-allowlist system-log-dedupe` — all pass.
   Temporarily return `process.env.CLOUDINARY_API_SECRET.slice(0, 4)` from a check and confirm
   `env-checks-no-secrets` fails; revert.
3. `npm run docs:index` — `content/docs/index.generated.json` contains exactly ten entries whose
   keys match the FEAT §30 list. Add `docs/ops/SECURITY.md` to the output by hand and re-run —
   regenerated without it.
4. Open `/studio/system/environment` as `admin` — eight checks render with status, latency and a
   checked-at time. View source: no value, prefix, length, hash or masked form of any D8 server-only
   variable appears. Unset `GOOGLE_SERVICE_ACCOUNT_JSON` and reload → `NOT_CONFIGURED`, not an error
   trace.
5. Break Cloudinary credentials deliberately → the check reports `UNREACHABLE` with a fixed code and
   no upstream message; a `system_logs` row exists at `ERROR` on channel `MEDIA` with a redacted
   context.
6. `curl -s "$NEXT_PUBLIC_SITE_URL/studio/system/documentation/../../../etc/passwd"` and
   `/studio/system/documentation/security` → 404 for both.
7. Open `/studio/system/documentation/scraper` → the scraper guide renders with working in-app
   internal links, external links marked, and no raw HTML executed.
8. As `editor`, request `/studio/system/environment` → refused server-side with a `DENIED` audit
   row; `/studio/system/documentation` → allowed. As `viewer`, both refused.
9. Trigger a failing scraper run and a failing Sheets run; open `/studio/operations/logs`, filter to
   `level = ERROR`, `channel = SCRAPER` → the run appears with its `workflow_run_id`; switch to
   `SHEETS` → the Sheets failure appears with `error_code` and no response body.
10. Run the retention cron with a back-dated fixture: `INFO` rows older than 90 days are removed,
    `ERROR` rows older than 90 but younger than 400 days remain, and the purge writes its own `INFO`
    summary row.
11. `npx playwright test tests/e2e/studio-system.spec.ts` — all three pages, the role matrix, the
    log filters and the CSV export, at 1920/1440/1024/430/390.
12. `npm run build` — `lib/ops/build-info.generated.ts` is produced, is gitignored, and the environment
    page shows the current commit SHA and branch.

**Exit criteria**

- [ ] One redactor is used by the environment page, the documentation browser and every log write.
- [ ] No D8 server-only variable's value, prefix, suffix, length or hash appears on any surface,
      proven by the sentinel test, which is demonstrated to fail when a leak is introduced.
- [ ] Every environment check returns the fixed shape with a status from the five-value enum and a
      code from a fixed set; no upstream error text is rendered or stored.
- [ ] `configured` is derived from the presence of the variable name only.
- [ ] The documentation browser serves exactly the ten FEAT §30 documents, by allowlist key, with no
      filesystem path reaching the request handler, and rejects traversal and non-allowlisted keys.
- [ ] Markdown rendering escapes raw HTML and scripts.
- [ ] `system_logs` exists with orthogonal `level` and `channel`, covers every FEAT §31 type, is
      append-only, deduplicates repeats and is purged on a documented retention schedule.
- [ ] The audit / activity / system distinction is documented and enforced by a CI check.
- [ ] All three routes are permission-gated server-side and verified against the role matrix in e2e.
- [ ] The environment page states that it reports reachability only and is not a functional test.
- [ ] The Higgsfield check reports the manifest's 250 assets without regenerating or displaying any.
- [ ] Phase-specific D9 evidence: docs updated = `ENVIRONMENT.md`, `SECURITY.md`, `STUDIO_GUIDE.md`,
      `DATA_MODEL.md`; tests run = four unit suites and `studio-system.spec.ts`; next phase = 39
      (SEO).
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## Cross-phase notes

**What must be true before Phase 39 begins.** SEO assumes: no research surface is reachable from a
public route or present in `sitemap.xml` (31–35, enforced by invariant I3 in
`scripts/research/check-research-isolation.mjs`, which already covers `lib/seo/**`);
the only products that exist are ones a human created, so a product URL never encodes a competitor's
title (35); the documentation browser and environment page are behind `noindex` because they live in
the Studio route group (38); and `system_logs` exists, so Phase 39's redirect and canonical-drift
checks have somewhere to report to. Phase 39 must not add a public route for anything in this block.

**Statements requiring owner verification before they are relied upon.** Each is created
`OWNER_VERIFICATION_REQUIRED` by the phase that introduces it and cannot be treated as a business
fact until the owner sets `VERIFIED`.

| Statement | Phase | Why it is not a fact yet |
|---|---|---|
| That a Google Workspace account and a spreadsheet exist for Rivya to export into | 36 | Asserts a real business account and its ownership |
| That the service account has been shared onto that spreadsheet | 36 | An operational fact only the owner can confirm |
| Any measured similarity precision figure | 33 | Must be measured on this corpus, on a dated sample, before it is written down |
| That competitor sources may lawfully be scraped at the configured rate | 26/31 | A policy question; the analytics in 31 make the volume visible but do not settle it |
| That an approved direction brief reflects Rivya's intent | 34 | `APPROVED` means a named person agreed; it is not a capability claim |
| That Rivya can produce anything a direction brief describes | 34 | Manufacturing capability is a business fact (D10) |
| That a confirmed research row corresponds to a piece Rivya will make | 35 | Confirmation records a decision to explore, nothing more |
| That traffic analytics should be connected at all | 37 | Adding a provider is an owner decision with privacy consequences |
| That Rivya may fetch a competitor's image bytes at all, even transiently and only to hash them | 33 | It amends a rule `PHASE-23-30.md` states four times; a policy question the owner settles, not this document |

**Never-crossed lines, restated once.** No phase in this block creates a product from research data
**automatically or by copying a field** — Phase 35's bridge is hand-operated, copies nothing, and is
narrowed into `check-research-isolation.mjs` by name; no phase copies competitor text, price,
dimension, material or imagery into a Rivya table; no phase persists a competitor image in any form,
the transient hashing fetch in Phase 33 included; no phase publishes anything to a public route; no
phase writes a score, similarity result or analytic figure that is not reproducible from stored
inputs; no phase displays a secret; no phase regenerates a Higgsfield asset; and no phase moves the
project toward checkout, payment or customer accounts.

## Open questions for the canonical decisions

Raised, not acted on. **Three items below are real divergences, not hypotheticals**, and each names
where in the document it occurs: the two new `lib/` domains (4), the I4 narrowing that Phase 35's
bridge requires (11), and the fetch-to-hash amendment Phase 33 requires (12). Each is stated at the
point of use as well as here, each ships behind a flag defaulting to `false` where behaviour is
involved, and none is presented as already sanctioned. Everything else below is a question about
wording rather than about code.

1. **Permission spelling.** `PHASE-00-04.md` and `PHASE-10-15.md` use `<domain>.<action>`;
   `PHASE-16-22.md` uses `<resource>:<action>`. This document uses the dot form because Phase 04
   owns `lib/auth/permissions.ts`. Suggested amendment: fix the spelling in D5 beside the role list
   and correct whichever documents disagree, once.
2. **No D4 leaf for direction briefs.** D4's research leaf set has no `direction`. Phase 34 mounts
   briefs as nested segments under `/studio/research/opportunities/direction`, which keeps the leaf
   set intact but hides a significant workspace one level down. Suggested amendment: either bless
   the nesting or add a `direction` leaf to D4 between `opportunities` and `shortlist`.
3. **`created_product_id` and the D5 isolation rule.** D5 says research tables never join directly
   to public product tables, and `PHASE-23-30.md`'s I1 allowlist is closed at two constraint names.
   Phase 35 needs to record which product a confirmation started, and does so with a nullable uuid
   carrying no foreign key, resolved only by research repositories and forbidden elsewhere by
   `check-research-isolation.mjs`. Phase 34 does the same thing for a brief's target category, using
   a checked slug instead of a `references categories(id)`. Both honour the rule's intent while
   keeping the record. Suggested amendment: state explicitly in D5 that an unconstrained identifier
   or a checked slug recorded on the research side, with no query path into public reads, is
   permitted — and that this is the *only* way research may point at public data beyond the two
   allowlisted taxonomy references.
4. **Two new `lib/` domains: `sheets/` and `ops/`.** D2 fixes the `lib/` domain list at `supabase ·
   media · cms · auth · whatsapp · scraper · analytics · seo · logging · flags`, and this block adds
   two that fit none of them. Phase 36 adds **`lib/sheets/`** as a sibling of `lib/whatsapp/` — both
   are outbound integrations that render Rivya data into someone else's surface. Phase 38 adds
   **`lib/ops/`** for the environment checks, the check runner and the generated
   `lib/ops/build-info.generated.ts`; an integration reachability probe is not a log, and filing it
   under `lib/logging/` would misname it. Two candidates were *not* added, because they belong in
   existing domains: the documentation renderer is `lib/cms/docs/render.ts` and the first-party media
   hasher is `lib/media/hashes.ts`. `PHASE-10-15.md` (`lib/site/`, `lib/catalog/`) and
   `PHASE-23-30.md` (`lib/search/`, `lib/relations/`, `lib/bulk/`) already treat D2's list as
   extensible by precedent; this question asks the owner to make that explicit. Suggested amendment:
   add `sheets/` and `ops/` to D2's list, or bless an `integrations/` parent for outbound clients and
   state the rule by which a new `lib/` domain may be added at all.
5. **Cron secret.** Phases 08, 22, 31, 32, 36, 37 and 38 all expose cron route handlers guarded by
   `REVALIDATE_SECRET`, because D8 lists no dedicated cron secret. One secret now guards both cache
   revalidation and seven scheduled jobs. Suggested amendment: add `CRON_SECRET` to D8's server-only
   list, or record that the reuse is intentional.
6. **Role management UI ownership.** `PHASE-05-09.md` states that role management UI is Phase 38,
   but Phase 04 already delivered `/studio/system/users`. Phase 38 above does not rebuild it.
   Suggested correction: amend Phase 05's out-of-scope line to cite Phase 04.
7. **Feature flags after Phase 19.** `PHASE-16-22.md` open question 6 asks whether Phase 38 extends
   or replaces the Phase 19 flag primitive. This document answers: it does neither — Phases 33, 35,
   36 and 37 register `advanced_similarity`, `research_image_hashing`, `research_product_bridge`,
   `google_sheets` and `advanced_analytics` into the existing registry, all defaulting to `false`,
   and `/studio/system/flags` is unchanged. Two of those five are not conveniences: until questions
   11 and 12 are answered, `research_product_bridge` and `research_image_hashing` are the switches
   that keep an unaccepted amendment inert. FEAT §32's `higgsfield_tracker` remains unclaimed and
   should be assigned to Phase 43. Confirm.
8. **Traffic analytics.** FEAT §28 lists Content Performance as a first-party dimension, but D1's
   stack contains no web-analytics provider and D10 forbids inventing one. Phase 37 redefines the
   metric as database-derived content health and states plainly that traffic is not measured.
   Suggested amendment: either accept that definition in D1, or add a provider and its environment
   variable names to D8 as an explicit owner decision.
9. **Currency normalisation.** Phase 31 refuses cross-currency price comparison because no rate
   source exists and inventing one would fabricate a figure. If the owner wants a single-currency
   market view, a dated FX snapshot table and its source need to be specified. Raised, not designed.
10. **Retention windows.** Phase 37 keeps analytics snapshots for 400 days and Phase 38 keeps
    `INFO`/`WARNING` logs for 90 and `ERROR`/`SECURITY` for 400. No canonical section fixes
    retention for `audit_logs`, `activity_events` or research snapshots. Suggested amendment: state a
    retention table in D5 or `docs/ops/SECURITY.md` so the four logs do not drift apart.
11. **Invariant I4 and Phase 35's manual bridge — a real divergence, blocking that phase.**
    `PHASE-23-30.md` states I4 as: "There is no code path — no server action, no script, no SQL
    function, no Studio button — that writes to `products` from a `research_*` read", and its Phase
    29 Confirm action says confirming "creates no product, no draft product". Phase 35's
    `startProductFromConfirmation` is a Studio button that reads a `research_confirmations` row and
    inserts into `products`. It copies **no** competitor field — so it breaches neither FEAT §25 nor
    SEED §32 nor D10 — but it breaches I4 as literally written, and
    `scripts/research/check-research-isolation.mjs` would fail the build. The document does not
    resolve this unilaterally. **Proposed amendment**, to be recorded against `PHASE-23-30.md`'s I4
    row and echoed in D5:

    > A row in `research_*` can only ever become a Rivya product by a person typing one. There is no
    > **automatic** path and no **field-copying** path from a `research_*` read to `products`. Exactly
    > one manual path exists: the server action `startProductFromConfirmation`, exported from
    > `app/(studio)/studio/research/confirmed/actions.ts`, which requires `catalog.write`, a slug the
    > actor types, a category the actor picks and a ticked acknowledgement, and which reads from the
    > research side only `getConfirmationForBridge(id) → { id, stage, archived_at }`. It writes
    > `slug`, `title` (title-cased from the slug), `category_id`, `status = 'DRAFT'` and
    > `price_state = 'PRICE_ON_REQUEST'`, and nothing else.

    The guard must encode exactly that: one symbol, one file, one permitted reader, and a failure on
    a second writer, on a move, or on a wider projection. Until the owner accepts it, the bridge is
    behind `research_product_bridge`, default `false`, and Phase 35 is not COMPLETE.
12. **Fetching a competitor image to hash it — a real divergence, blocking Phase 33's competitive
    half.** `PHASE-23-30.md` says at Phase 26 that "**no mode downloads or re-hosts an image**" and
    at Phases 28/29 that "**no image is fetched, measured by download, cached**", storing only
    `research_products.image_urls text[]`. Perceptual hashing needs bytes; there are none stored and
    none obtainable without a request. **Proposed amendment**, narrowly scoped:

    > Image bytes may be fetched for the sole purpose of computing a perceptual hash, only through
    > `lib/scraper/analytics/similarity/hash-run.ts`, only through the Phase 25 politeness path
    > (`fetch.ts`, `robots.ts`, `rate-limit.ts`, one `research_fetches` row per request,
    > `storage_key` null), and only when all four of `research.enabled`, the
    > `research_image_hashing` flag, `research_sources.policy_status = 'APPROVED'` and
    > `research_sources.image_hashing_enabled` are true. Only the 64-bit pHash, the 64-bit dHash, the
    > SHA-256 checksum, the source URL and a URL-derived key are persisted. The bytes, and every
    > measurement derived from them other than those five values, are discarded before the function
    > returns. Nothing is written to disk, Storage, Cloudinary or `media_assets`.

    The rule this amends is a politeness and rights posture, not a schema detail, so it is the
    owner's to accept. Until then `research_image_hashing` ships `false` and Phase 33 delivers only
    its first-party half — `media_asset_hashes` and the Rivya-vs-Rivya upload guard. Recording this
    also settles the related `OWNER_VERIFICATION_REQUIRED` line above about the lawfulness of the
    fetch rate.
13. **A third research→public reference, or none.** `PHASE-23-30.md` closes I1's allowlist at two
    constraint names with the words "there is never a third". Phase 34 wants to file a direction
    brief under a D3 category and would naturally write `references categories(id)`; instead it
    stores `target_category_slug text` with a check constraint over D3's fixed seven, resolved by the
    direction repository. That works, and costs a slug rename. Suggested decision: either confirm
    that two is final and checked slugs are the pattern for everything after, or open the allowlist
    to a named third and let Phase 34 use a real reference. Phase 34 ships the slug either way; only
    a later migration changes if the answer is the second.
