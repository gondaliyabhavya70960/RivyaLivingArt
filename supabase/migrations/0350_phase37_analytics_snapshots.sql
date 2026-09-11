-- ============================================================================================
-- 0350 — Phase 37: analytics_snapshots
--
-- ONE ROW PER METRIC PER DAY, and the phase's core invariant in one CHECK: an unavailable metric
-- must carry a reason, and an available one must not pretend to have been unavailable. The tab
-- reads these rows and computes nothing in the request path; the daily cron and
-- `npm run analytics:snapshot` write them as the service role. No other table is created — every
-- metric reads existing tables and the Phase 31/32 snapshots.
--
-- NOT A SECOND research_analytics_snapshots. That table (0290) is the competitive computation's
-- own record, keyed by scope and metric family; this one is the Studio tab's record, keyed by
-- metric id and date, and holds first-party figures too. A competitive metric here READS the
-- Phase 31 row and stores what the tile will show.
-- ============================================================================================

set search_path = public, extensions;

create table analytics_snapshots (
  id                 uuid primary key default gen_random_uuid(),
  metric_id          text not null,
  dimension          text not null,
  as_of              date not null,
  value              jsonb not null default '{}'::jsonb,
  n                  integer,
  denominator        integer,
  availability       text not null,
  unavailable_reason text,
  computed_at        timestamptz not null default now(),
  computed_by        uuid references auth.users (id) on delete set null,

  constraint analytics_snapshots_metric_per_day unique (metric_id, as_of),
  constraint analytics_snapshots_metric_id_shape check (metric_id ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint analytics_snapshots_dimension_allowed
    check (dimension in ('FIRST_PARTY', 'COMPETITIVE')),
  constraint analytics_snapshots_availability_allowed
    check (availability in ('AVAILABLE', 'UNAVAILABLE')),
  -- THE INVARIANT. Unexplained unavailability is unstorable; so is a reason on an available row.
  constraint analytics_snapshots_reason_iff_unavailable
    check ((availability = 'UNAVAILABLE') = (unavailable_reason is not null)),
  constraint analytics_snapshots_reason_not_blank
    check (unavailable_reason is null or length(btrim(unavailable_reason)) > 0),
  constraint analytics_snapshots_value_is_object check (jsonb_typeof(value) = 'object'),
  constraint analytics_snapshots_counts_non_negative
    check ((n is null or n >= 0) and (denominator is null or denominator >= 0)),
  constraint analytics_snapshots_n_within_denominator
    check (n is null or denominator is null or n <= denominator)
);

-- Retention is 400 days (PHASE-31-38 §Phase 37); the snapshot writer prunes by `as_of`.
create index analytics_snapshots_retention_idx on analytics_snapshots (as_of);
-- A trend is one metric's rows in date order.
create index analytics_snapshots_series_idx on analytics_snapshots (metric_id, as_of desc);

comment on table analytics_snapshots is
  'Phase 37. One row per Studio metric per day: the figure the Analytics tab shows, with n, '
  'denominator, and either AVAILABLE or UNAVAILABLE with a named reason (CHECKed). Written by '
  'the service role from the daily cron or npm run analytics:snapshot; read by analytics.read, '
  'COMPETITIVE rows additionally by research.read (policy predicate in 0351). Never a sample, '
  'seeded or estimated value: an empty catalogue snapshots as a true zero with n = 0.';
comment on column analytics_snapshots.value is
  'The tile payload: figure, unit, optional series and groups. Shape is lib/supabase/schemas/analytics.ts.';
comment on column analytics_snapshots.unavailable_reason is
  'Present exactly when availability = UNAVAILABLE. Names the missing table, attribute key, '
  'adapter capability, run or model — a work item, not "no data".';

alter table analytics_snapshots enable row level security;
