-- ============================================================================================
-- 0290 — Phase 31: Analytics + Comparison
--
-- THE RESEARCH CORPUS BECOMES MEASURABLE, AND EVERY MEASUREMENT CARRIES ITS OWN ERROR BARS.
--
-- Four tables. Two of them are a person's workspace — a NAMED comparison set and the members it
-- holds — and two of them are the machine's record of what was computed, when, over how many rows,
-- and how many rows it could NOT use and why. The second pair is the phase's whole argument: a
-- median over four records reads exactly like a median over four hundred unless the four is written
-- down beside it, so nothing here stores a figure without storing its denominator.
--
-- SNAPSHOTS AND COVERAGE ARE WRITTEN BY THE SERVICE ROLE ONLY. A session that could insert a
-- snapshot could insert a market figure nobody computed, and it would sit in the dashboard looking
-- exactly like one that was. The CLI and the cron write them; a Studio "recompute" action runs the
-- same code under the admin client and records who asked.
--
-- CURRENCIES ARE NEVER MIXED, AND THE SCHEMA SAYS SO. `research_analytics_snapshots.currency` is a
-- column of the unique key, so a PRICE_ARCHITECTURE snapshot is per currency by construction and a
-- combined row across currencies has no key to live under. Phase 28's rule — no conversion exists
-- anywhere under lib/scraper/ — is kept at the table as well as in the code.
--
-- NOTHING HERE IS PUBLIC (isolation invariant I2: no anon policy on any research_* table), and
-- NOTHING HERE CROSSES THE BOUNDARY (I1: the four tables reference research_sources and
-- research_products and nothing else — the allowlist stays at its two entries).
-- ============================================================================================

set search_path = public, extensions;

-- --- 1. Comparison sets: a named selection a person owns -----------------------------------------

/*
 * A CHECK CONSTRAINT MAY NOT CONTAIN A SUBQUERY (0260 learned this twice), so the "edges are
 * strictly ascending" rule is an IMMUTABLE function over the array. Null and a one-element array
 * are trivially ascending; a repeated edge is refused because two equal edges make an empty band.
 */
create or replace function public.is_strictly_ascending_bigint_array(value bigint[]) returns boolean
  language sql
  immutable
  set search_path = pg_catalog, public
  as $$
  select value is null
      or cardinality(value) <= 1
      or not exists (
        select 1
        from generate_subscripts(value, 1) as i
        where i > 1 and value[i] <= value[i - 1]
      )
$$;

comment on function public.is_strictly_ascending_bigint_array(bigint[]) is
  'True when a bigint[] is null, has at most one element, or is strictly ascending. Backs research_comparison_sets_edges_ascending.';

-- A constraint function is evaluated as the writing user, so authenticated keeps EXECUTE (0022,
-- 0143). public is revoked because the default grant is what turns a function into an RPC endpoint.
revoke execute on function public.is_strictly_ascending_bigint_array(bigint[]) from public, anon;
grant execute on function public.is_strictly_ascending_bigint_array(bigint[]) to authenticated, service_role;

create table research_comparison_sets (
  id               uuid primary key default gen_random_uuid(),

  name             text not null,
  slug             citext not null unique,
  description      text,
  -- What this set is FOR, in the researcher's words. Rendered beside every panel so a reader knows
  -- what sample they are looking at without opening the member list.
  scope_note       text,

  /*
   * HOW THE PRICE BANDS ARE CUT, STORED WITH THE SET RATHER THAN CHOSEN AT RENDER TIME.
   *
   * `QUANTILE` derives edges from the priced rows themselves; `FIXED` uses edges the researcher
   * typed. The rule used is written into every snapshot, so two snapshots of one set are
   * comparable only when their rule agrees — and a reader can see when it does not.
   */
  band_rule        text not null default 'QUANTILE',
  band_edges       bigint[],

  last_computed_at timestamptz,

  status           content_status not null default 'PUBLISHED',
  created_at       timestamptz not null default now(),
  created_by       uuid not null references auth.users (id) on delete restrict,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id),

  constraint research_comparison_sets_name_not_blank check (btrim(name) <> ''),
  constraint research_comparison_sets_slug_shape check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint research_comparison_sets_band_rule_allowlist
    check (band_rule in ('QUANTILE', 'FIXED')),
  -- A FIXED rule with no edges would band nothing; a QUANTILE rule with edges would carry edges
  -- nothing reads. Either is a set whose stored rule and stored edges disagree about what it does.
  constraint research_comparison_sets_edges_match_rule
    check ((band_rule = 'FIXED') = (band_edges is not null and cardinality(band_edges) >= 1)),
  constraint research_comparison_sets_edges_ascending
    check (public.is_strictly_ascending_bigint_array(band_edges))
);

comment on table research_comparison_sets is
  'Phase 31. A named, saved selection of sources and research products a person compares. Owned by '
  'research.write; readable by research.read; never public (I2).';
comment on column research_comparison_sets.band_rule is
  'QUANTILE (edges derived from the priced rows) or FIXED (edges the researcher typed). Stored with '
  'every snapshot so two results are comparable only when their rule agrees.';

-- --- 2. Members: whole sources and individual rows, never anything else ---------------------------

create table research_comparison_members (
  id                   uuid primary key default gen_random_uuid(),
  set_id               uuid not null references research_comparison_sets (id) on delete cascade,

  member_type          text not null,
  source_id            uuid references research_sources (id) on delete cascade,
  research_product_id  uuid references research_products (id) on delete cascade,

  position             integer not null default 0,
  note                 text,

  created_at           timestamptz not null default now(),
  created_by           uuid references auth.users (id),

  constraint research_comparison_members_type_allowlist
    check (member_type in ('SOURCE', 'RESEARCH_PRODUCT')),
  -- EXACTLY ONE TARGET, AND THE TYPE NAMES IT. Both checks are needed: the first pins the source
  -- column to the SOURCE type and the second pins the product column to the RESEARCH_PRODUCT type,
  -- so a row can neither carry two targets nor none.
  constraint research_comparison_members_source_matches_type
    check ((member_type = 'SOURCE') = (source_id is not null)),
  constraint research_comparison_members_product_matches_type
    check ((member_type = 'RESEARCH_PRODUCT') = (research_product_id is not null)),
  constraint research_comparison_members_position_nonnegative check (position >= 0),
  -- `unique nulls not distinct`, for the reason 0270 gives research_change_rules: the default
  -- treats two nulls as different, and a source added twice would otherwise be two rows.
  constraint research_comparison_members_unique_target
    unique nulls not distinct (set_id, member_type, source_id, research_product_id)
);

comment on table research_comparison_members is
  'Phase 31. One member of a comparison set: a whole source or one research product, never both. '
  'Cascades with its set, its source and its product.';

-- --- 3. Snapshots: what was computed, over what, when --------------------------------------------

create table research_analytics_snapshots (
  id                uuid primary key default gen_random_uuid(),

  scope_type        text not null,
  scope_id          uuid,
  metric_family     text not null,
  /*
   * PART OF THE KEY, DELIBERATELY. A PRICE_ARCHITECTURE snapshot is per currency by construction:
   * there is no key under which a combined-currency figure could be stored, which is the schema
   * enforcing Phase 28's no-conversion rule from the other side. ASSORTMENT and DIMENSIONS carry
   * null here because money is not one of their inputs.
   */
  currency          char(3),

  payload           jsonb not null,
  row_count         integer not null,
  computed_at       timestamptz not null default now(),
  -- Null for the cron; a user id for a Studio recompute. "Who asked" is part of the provenance.
  computed_by       uuid references auth.users (id) on delete set null,
  -- The newest run the snapshot could have seen, so the workbench can say "the corpus has grown
  -- since" rather than quietly rendering a stale figure as current.
  input_run_max_id  uuid references research_runs (id) on delete set null,

  constraint research_analytics_snapshots_scope_allowlist
    check (scope_type in ('CORPUS', 'SOURCE', 'SET', 'CATEGORY')),
  constraint research_analytics_snapshots_family_allowlist
    check (metric_family in ('ASSORTMENT', 'PRICE_ARCHITECTURE', 'DIMENSIONS')),
  -- A corpus-wide snapshot has no id; every other scope names one.
  constraint research_analytics_snapshots_scope_has_id
    check ((scope_type = 'CORPUS') = (scope_id is null)),
  constraint research_analytics_snapshots_currency_shape
    check (currency is null or currency ~ '^[A-Z]{3}$'),
  -- MONEY IS ALWAYS IN A CURRENCY. A price snapshot with a null currency would be the combined row
  -- the phase refuses to compute; the other two families never carry one.
  constraint research_analytics_snapshots_currency_matches_family
    check ((metric_family = 'PRICE_ARCHITECTURE') = (currency is not null)),
  constraint research_analytics_snapshots_row_count_nonnegative check (row_count >= 0),
  constraint research_analytics_snapshots_payload_is_object check (jsonb_typeof(payload) = 'object'),
  constraint research_analytics_snapshots_unique_moment
    unique nulls not distinct (scope_type, scope_id, metric_family, currency, computed_at)
);

comment on table research_analytics_snapshots is
  'Phase 31. One computed result per (scope, metric family, currency, moment). Written by the '
  'service role only — the CLI, the cron and the Studio recompute action; never a session insert.';
comment on column research_analytics_snapshots.currency is
  'Part of the unique key so a price snapshot is per currency by construction. Null for the two '
  'families money is not an input to.';

-- --- 4. Coverage: the denominator, stored beside every result ------------------------------------

create table research_metric_coverage (
  id                uuid primary key default gen_random_uuid(),
  snapshot_id       uuid not null references research_analytics_snapshots (id) on delete cascade,

  metric_key        text not null,
  n                 integer not null,
  denominator       integer not null,
  -- GENERATED, so it can never disagree with the two integers beside it. Zero over zero is 0 %,
  -- not 100 %: an empty scope should say it is empty (lib/scraper/analytics/coverage.ts).
  coverage_pct      numeric(5,2) generated always as
                      (case when denominator = 0 then 0
                            else round(100.0 * n / denominator, 2) end) stored,
  -- A count per reason the rows were not used: no_price, quote_only_price, ambiguous_currency,
  -- no_dimensions, dimensions_unparsed, unmapped_category, stale. A thin result explains itself
  -- rather than looking like a small market.
  excluded_reasons  jsonb not null default '{}'::jsonb,
  as_of             timestamptz not null,

  constraint research_metric_coverage_key_not_blank check (btrim(metric_key) <> ''),
  constraint research_metric_coverage_counts_nonnegative check (n >= 0 and denominator >= 0),
  constraint research_metric_coverage_n_within_denominator check (n <= denominator),
  constraint research_metric_coverage_reasons_is_object
    check (jsonb_typeof(excluded_reasons) = 'object'),
  constraint research_metric_coverage_unique_per_snapshot unique (snapshot_id, metric_key)
);

comment on table research_metric_coverage is
  'Phase 31. n, denominator and the per-reason exclusion counts for one metric of one snapshot. '
  'coverage_pct is generated so it cannot disagree with the integers.';

-- --- 4b. A deleted set takes its history with it ------------------------------------------------
--
-- `scope_id` carries no foreign key, because one column points at a set, a source or a category
-- depending on `scope_type` and a uuid cannot reference three tables. So the cascade a foreign key
-- would have given a SET scope is written as a trigger instead: deleting a set removes every
-- snapshot computed over it, and their coverage rows go with them through the real cascade. A
-- session cannot delete a snapshot (no policy), which is why the function is SECURITY DEFINER —
-- it runs the one deletion the schema itself has decided is correct, and nothing else.

create or replace function public.tg_research_comparison_set_prune_snapshots() returns trigger
  language plpgsql
  security definer
  set search_path = pg_catalog, public
  as $$
begin
  delete from public.research_analytics_snapshots
   where scope_type = 'SET' and scope_id = old.id;
  return old;
end $$;

revoke execute on function public.tg_research_comparison_set_prune_snapshots() from public, anon, authenticated;

create trigger research_comparison_sets_prune_snapshots
  after delete on research_comparison_sets
  for each row execute function public.tg_research_comparison_set_prune_snapshots();

-- --- 5. Row security, on all four, before any policy exists --------------------------------------
-- The policies are in 0291, the GENERATED file. Enabling RLS here means the tables are unreadable
-- by every role until that file runs — closed by default, which is the only safe default.

alter table research_comparison_sets     enable row level security;
alter table research_comparison_members  enable row level security;
alter table research_analytics_snapshots enable row level security;
alter table research_metric_coverage     enable row level security;
