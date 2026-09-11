-- ============================================================================================
-- 0380 — Phase 40: web_vitals_samples
--
-- FIELD DATA, AND THE WHOLE DESIGN IS ABOUT WHAT IS *NOT* HERE.
--
-- The lab numbers in `perf/budgets.json` are measured on one throttled profile in a data centre.
-- They are worth having and they are not what a visitor on a phone in Rajkot experiences, so this
-- table collects the real thing: LCP, CLS, INP, TTFB and FCP as the browser measured them, at a
-- ten per cent sample, beaconed to `/api/vitals`.
--
-- THE RISK THIS TABLE CARRIES IS THAT IT QUIETLY BECOMES VISITOR TRACKING. A performance table and
-- an analytics tracker are the same table with three more columns — a session id "to deduplicate",
-- an IP "for geography", a user agent "to segment by browser" — and each of those arrives as a
-- reasonable request. D1 says there are no customer accounts and this must not become the thing
-- that creates one, so the defence is structural rather than a promise:
--
--   * THERE IS NOWHERE TO PUT AN IDENTIFIER. No ip, no ip_hash, no user_agent, no session_id, no
--     user_id, no referrer, no url, no fingerprint. A future patch that wants one has to ALTER
--     this table, in a migration, in a diff, where it can be refused.
--   * `route_pattern`, NEVER A RESOLVED PATH. `/product/[slug]` tells us the product page is slow;
--     `/product/teak-console-01` tells us which visitor looked at which piece. The CHECK below
--     refuses a query string or a fragment outright, and the bracket form is what the reporter
--     sends — see `tests/unit/vitals-payload.test.ts`, which proves the Zod schema rejects every
--     one of the forbidden keys by name.
--   * EVERY CONTEXT COLUMN IS A BUCKET. `effective_type`, `device_memory_bucket` and
--     `viewport_bucket` hold one of a handful of values each, CHECKed, so the tuple cannot become
--     narrow enough to single anybody out.
--
-- NO SESSION WRITE POLICY (0381). The route handler inserts as the service role after Zod
-- validation and rate limiting; a row a session could insert is a performance figure nobody
-- measured. `select` needs `analytics.read`. There is no anon leg — a visitor writes through the
-- endpoint and can never read back.
--
-- RETENTION IS 90 DAYS, pruned by the Phase 38 cron at 04:15 UTC, which was written expecting this
-- table by name.
-- ============================================================================================

set search_path = public, extensions;

create table web_vitals_samples (
  id                   uuid primary key default gen_random_uuid(),

  -- The Next.js route pattern, bracket form. Never a resolved URL.
  route_pattern        text not null,

  metric               text not null,
  value                numeric not null,
  rating               text not null,

  -- Coarse context, each a closed set. Nullable because a browser may not report them.
  nav_type             text,
  effective_type       text,
  device_memory_bucket text,
  viewport_bucket      text,

  occurred_at          timestamptz not null default now(),

  -- The five metrics `web-vitals` reports and this product acts on. Anything else is a typo.
  constraint web_vitals_samples_metric_allowed
    check (metric in ('LCP', 'CLS', 'INP', 'TTFB', 'FCP')),

  -- Google's three-band verdict, computed by the library, stored as sent.
  constraint web_vitals_samples_rating_allowed
    check (rating in ('good', 'needs-improvement', 'poor')),

  -- A PATTERN, AND THE CHECKS SAY SO THREE WAYS.
  -- Leading slash; no query string and no fragment (that is where a resolved URL hides its
  -- identifying half); and a length ceiling so the column cannot be used as a free-text sink.
  constraint web_vitals_samples_route_is_path check (route_pattern like '/%'),
  constraint web_vitals_samples_route_no_query check (route_pattern !~ '[?#]'),
  constraint web_vitals_samples_route_length check (length(route_pattern) between 1 and 120),
  -- Lower-case segments and bracket parameters only. `/product/[slug]` passes;
  -- `/product/Teak-Console` does not, and neither does anything with a dot or a colon in it.
  constraint web_vitals_samples_route_shape
    check (route_pattern ~ '^/$|^(/(\[[a-z][a-z0-9_]*\]|[a-z0-9][a-z0-9-]*))+$'),

  -- CLS is unitless and small; the other four are milliseconds. One ceiling covers both: an hour
  -- is not a measurement, it is a clock that went backwards or a payload somebody made up.
  constraint web_vitals_samples_value_range check (value >= 0 and value <= 3600000),

  constraint web_vitals_samples_nav_type_allowed
    check (nav_type is null or nav_type in
      ('navigate', 'reload', 'back-forward', 'back-forward-cache', 'prerender', 'restore')),
  constraint web_vitals_samples_effective_type_allowed
    check (effective_type is null or effective_type in ('slow-2g', '2g', '3g', '4g')),
  constraint web_vitals_samples_device_memory_allowed
    check (device_memory_bucket is null or device_memory_bucket in ('low', 'medium', 'high')),
  constraint web_vitals_samples_viewport_allowed
    check (viewport_bucket is null or viewport_bucket in ('mobile', 'tablet', 'desktop'))
);

-- The read the Studio panel makes: one route pattern's one metric over the last 28 days.
create index web_vitals_samples_route_metric_idx
  on web_vitals_samples (route_pattern, metric, occurred_at desc);
-- The read the retention cron makes.
create index web_vitals_samples_retention_idx on web_vitals_samples (occurred_at);

comment on table web_vitals_samples is
  'Phase 40. First-party Core Web Vitals field data at a 10% sample, beaconed to /api/vitals and '
  'inserted by the service role after Zod validation and rate limiting. Carries NO identifier of '
  'any kind — no IP, user agent, session id, user id, referrer, slug or query string — and there '
  'is deliberately no column to put one in (D1: there are no customer accounts and this must not '
  'become the thing that creates one). route_pattern is the bracket form, never a resolved URL. '
  'Retention 90 days, pruned by the Phase 38 cron. select requires analytics.read; no session '
  'write policy and no anon policy exist.';
comment on column web_vitals_samples.route_pattern is
  'Next.js route pattern, e.g. /product/[slug]. CHECKed to refuse a query string, a fragment and '
  'anything that is not a lower-case segment or a [bracket] parameter.';
comment on column web_vitals_samples.value is
  'Milliseconds for LCP, INP, TTFB and FCP; unitless for CLS. As the browser measured it.';
comment on column web_vitals_samples.effective_type is
  'navigator.connection.effectiveType, one of slow-2g/2g/3g/4g, or null when unreported. A bucket, '
  'never a bandwidth figure.';
comment on column web_vitals_samples.device_memory_bucket is
  'navigator.deviceMemory collapsed to low (<= 2 GB), medium (<= 4 GB) or high. Never the raw '
  'figure, which is narrow enough to help fingerprint a device.';
comment on column web_vitals_samples.viewport_bucket is
  'mobile (< 768 CSS px), tablet (< 1024) or desktop. Never the measured width.';

alter table web_vitals_samples enable row level security;
