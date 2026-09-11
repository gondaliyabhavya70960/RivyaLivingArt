-- ============================================================================================
-- 0300 — Phase 32: Opportunity Engine
--
-- A RANKED VIEW OF WHERE THE MARKET LOOKS UNDER-SERVED, AND — THE WHOLE POINT — ANYONE CAN SEE
-- EXACTLY WHY A ROW IS WHERE IT IS. A score is the weighted mean of seven declared signals, each
-- normalised to 0–100 by a rule written in a versioned model. Every stored score keeps its own
-- arithmetic: one component row per signal holding the raw input, the normalised value, the
-- weight and the contribution, plus the model version that produced it. A researcher with a pocket
-- calculator can reproduce the total. No machine-learning model, no language model, no embedding,
-- no hidden term — anywhere.
--
-- THREE TABLES.
--
--   research_scoring_models        versioned. DRAFT → ACTIVE → RETIRED, exactly one ACTIVE (partial
--                                  unique index). A model becomes IMMUTABLE the moment it leaves
--                                  DRAFT: `freeze_active_scoring_model()` rejects any change to its
--                                  definition, so changing weights means publishing a new version,
--                                  and old scores keep pointing at the model that produced them.
--   research_opportunity_scores    one row per (product, model, moment). `score` is stored even
--                                  when `state = 'INSUFFICIENT_DATA'`, and never ranked then.
--   research_opportunity_components  one row per signal per score — the arithmetic, stored.
--
-- EXCLUDED IS NOT ZERO. A signal whose coverage requirement is unmet contributes nothing and LOWERS
-- confidence; it never contributes 0, which would read as "a poor fit" rather than "we do not
-- know". `research_opportunity_components_included_means_value` is that rule at the row.
--
-- NOTHING HERE TOUCHES A RIVYA PRODUCT. A score of 100 does nothing except sort first. The
-- category-gap and price-band-gap signals READ the published catalogue (a select, never a join
-- across the boundary — the comparison happens in application code) and write nothing back.
-- NOTHING HERE IS PUBLIC (I2): no anon policy on any of the three.
-- ============================================================================================

set search_path = public, extensions;

-- --- 1. The model register --------------------------------------------------------------------

create table research_scoring_models (
  id              uuid primary key default gen_random_uuid(),

  version         text not null unique,
  name            text not null,
  description     text,

  /*
   * THE SIGNAL DOCUMENT: an array of { key, weight, direction, normalisation, minimumCoverage }.
   * `lib/scraper/analytics/opportunity/model.ts` is the Zod schema for it and asserts the weights
   * sum to 100; `weights_total` repeats that sum as a column so the CHECK below can refuse a
   * document whose weights do not, without the database parsing jsonb.
   */
  signals         jsonb not null,
  weights_total   integer not null,
  min_confidence  numeric(3,2) not null default 0.50,

  lifecycle       text not null default 'DRAFT',
  activated_at    timestamptz,
  activated_by    uuid references auth.users (id),
  retired_at      timestamptz,

  created_at      timestamptz not null default now(),
  -- NULLABLE, because `0302` seeds v1 as configuration and configuration has no author.
  created_by      uuid references auth.users (id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id),

  constraint research_scoring_models_version_shape check (version ~ '^v[0-9]+(\.[0-9]+)*$'),
  constraint research_scoring_models_name_not_blank check (btrim(name) <> ''),
  constraint research_scoring_models_signals_is_array check (jsonb_typeof(signals) = 'array'),
  constraint research_scoring_models_weights_total check (weights_total = 100),
  constraint research_scoring_models_min_confidence_range
    check (min_confidence >= 0 and min_confidence <= 1),
  constraint research_scoring_models_lifecycle_allowlist
    check (lifecycle in ('DRAFT', 'ACTIVE', 'RETIRED')),
  -- Activation is attributed and dated together; retirement is dated. A row cannot claim to be
  -- ACTIVE without saying when, or RETIRED without saying when.
  constraint research_scoring_models_activation_is_dated
    check ((lifecycle = 'DRAFT') = (activated_at is null)),
  constraint research_scoring_models_retirement_is_dated
    check ((lifecycle = 'RETIRED') = (retired_at is not null))
);

-- EXACTLY ONE ACTIVE MODEL. A partial unique index over a constant: the second ACTIVE row collides.
create unique index research_scoring_models_one_active_idx
  on research_scoring_models ((true)) where lifecycle = 'ACTIVE';

comment on table research_scoring_models is
  'Phase 32. Versioned opportunity-scoring models. DRAFT is the only mutable lifecycle; ACTIVE and '
  'RETIRED definitions are frozen by trigger so every historical score keeps pointing at the '
  'model that produced it. Exactly one ACTIVE at a time.';

/*
 * THE IMMUTABILITY TRIGGER, VERBATIM FROM THE PHASE DOCUMENT.
 *
 * A non-draft model's definition — signals, weights_total, min_confidence — cannot change. Its
 * lifecycle can (ACTIVE → RETIRED), its name and description can, and nothing else. Changing
 * weights means publishing a new version.
 */
create or replace function public.freeze_active_scoring_model() returns trigger
  language plpgsql
  set search_path = pg_catalog, public
  as $$
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

revoke execute on function public.freeze_active_scoring_model() from public, anon, authenticated;

create trigger research_scoring_models_freeze
  before update on research_scoring_models
  for each row execute function public.freeze_active_scoring_model();

-- --- 2. Scores --------------------------------------------------------------------------------

create table research_opportunity_scores (
  id                     uuid primary key default gen_random_uuid(),
  research_product_id    uuid not null references research_products (id) on delete cascade,
  model_id               uuid not null references research_scoring_models (id),
  -- Denormalised beside the foreign key so a score row reads without a join, and so a row keeps
  -- naming its version even in a listing that never touches the models table.
  model_version          text not null,

  -- NULLABLE ONLY IN THE STATE THAT HAS NO TERMS AT ALL. Stored for INSUFFICIENT_DATA rows too (the
  -- phase document says so), never ranked in that state.
  score                  integer,
  raw                    numeric(6,2),
  confidence             numeric(4,3) not null,
  completeness           numeric(4,3) not null,
  state                  text not null,

  -- The Phase 31 snapshot the band inputs came from, so a score is traceable to its evidence.
  analytics_snapshot_id  uuid references research_analytics_snapshots (id) on delete set null,
  computed_at            timestamptz not null default now(),
  computed_by            uuid references auth.users (id) on delete set null,

  constraint research_opportunity_scores_score_range
    check (score is null or (score >= 0 and score <= 100)),
  constraint research_opportunity_scores_confidence_range
    check (confidence >= 0 and confidence <= 1),
  constraint research_opportunity_scores_completeness_range
    check (completeness >= 0 and completeness <= 1),
  constraint research_opportunity_scores_state_allowlist
    check (state in ('SCORED', 'INSUFFICIENT_DATA')),
  -- A SCORED row has a score. The reverse is not required: an INSUFFICIENT_DATA row may carry
  -- the number the included signals produced, and the drawer shows it greyed.
  constraint research_opportunity_scores_scored_has_score
    check (state <> 'SCORED' or score is not null),
  constraint research_opportunity_scores_unique_moment
    unique (research_product_id, model_id, computed_at)
);

create index research_opportunity_scores_rank_idx
  on research_opportunity_scores (model_id, state, score desc);
create index research_opportunity_scores_product_idx
  on research_opportunity_scores (research_product_id, computed_at desc);

comment on table research_opportunity_scores is
  'Phase 32. One score per (research product, model, moment): the weighted mean of the included '
  'signals, the confidence (share of weight included), the completeness multiplier and the state. '
  'Service-role writes only. A score of 100 does nothing except sort first.';

-- --- 3. Components — the arithmetic, stored -------------------------------------------------------

create table research_opportunity_components (
  id                uuid primary key default gen_random_uuid(),
  score_id          uuid not null references research_opportunity_scores (id) on delete cascade,
  signal_key        text not null,
  -- The input AS TEXT, so a number, a boolean, a category slug and a token list all fit the same
  -- column and the drawer prints exactly what was read.
  raw_input         text,
  normalised        numeric(6,2),
  weight            integer not null,
  contribution      numeric(7,3),
  included          boolean not null,
  exclusion_reason  text,

  constraint research_opportunity_components_key_not_blank check (btrim(signal_key) <> ''),
  constraint research_opportunity_components_weight_range check (weight >= 0 and weight <= 100),
  constraint research_opportunity_components_normalised_range
    check (normalised is null or (normalised >= 0 and normalised <= 100)),
  -- EXCLUDED IS NOT ZERO. An included signal carries a value; an excluded one carries none and
  -- carries a reason instead.
  constraint research_opportunity_components_included_means_value
    check (included = (normalised is not null)),
  constraint research_opportunity_components_excluded_has_reason
    check (included or exclusion_reason is not null),
  constraint research_opportunity_components_unique_signal unique (score_id, signal_key)
);

comment on table research_opportunity_components is
  'Phase 32. One row per signal per score — raw input, normalised value, weight, contribution — '
  'or the reason the signal was excluded. The explain drawer renders these rows; it never '
  'recomputes, so what a person sees is what the database stored.';

-- --- 4. Row security before any policy exists (0301) ----------------------------------------------

alter table research_scoring_models          enable row level security;
alter table research_opportunity_scores      enable row level security;
alter table research_opportunity_components  enable row level security;
