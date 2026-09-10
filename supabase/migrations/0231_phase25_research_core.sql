-- ============================================================================================
-- 0231 — Phase 25: the research pipeline's spine
--
-- EIGHT TABLES AND NOT ONE FOREIGN KEY CROSSING INTO PUBLIC CONTENT. That is isolation invariant
-- I1, and this migration is where it is either kept or lost. No column here references `products`,
-- `categories`, `collections`, `materials`, `media_assets`, `portfolio_projects`,
-- `journal_articles`, `pages`, `page_sections`, `product_relations` or `content_relations`, and
-- `scripts/research/check-research-isolation.mjs` reads `information_schema` to prove it on every
-- build, with an allowlist that is EMPTY at this phase. A research row becomes a Rivya product
-- only by an owner typing one.
--
-- THE POLICY GATE IS A CHECK CONSTRAINT, NOT A CODE PATH. `is_enabled = false or policy_status =
-- 'APPROVED'` makes an enabled-but-unreviewed source impossible to store — so the question "may
-- Rivya read this website" cannot be skipped by a bug, a fixture, a migration, or a well-meaning
-- Studio control. The determination itself is the owner's assertion about a third party's terms;
-- this repository is not competent to make it and does not seed a single source row.
--
-- A RUN IS NOT THE UNIT OF PROGRESS; A WORK ITEM IS (0232). Vercel functions are short-lived, so a
-- run is drained across many cron invocations and must survive a cold start halfway through. That
-- is why the queue is a table with leases rather than a loop with a promise.
--
-- POLITENESS IS STORED, NOT REMEMBERED. `rate_limit_rpm`, `request_delay_ms`, `concurrency`,
-- `next_fetch_not_before`, `in_flight_count`, `consecutive_failures` and `circuit_open_until` are
-- columns because they are enforced in the LEASE QUERY — one statement, under contention, across
-- concurrent invocations — and not by hopeful `sleep()` calls inside a function that may be
-- terminated mid-wait.
--
-- SNAPSHOTS ARE EVIDENCE, KEPT OUT OF CLOUDINARY. `research_fetches.storage_key` names an object
-- in a PRIVATE Supabase Storage bucket; the row records the hash and the byte count. Cloudinary is
-- Rivya's media pipeline and a competitor's page body is not media — putting it there would put
-- somebody else's HTML behind a public CDN URL. Retained 180 days, pruned by the same cron.
-- ============================================================================================

set search_path = public, extensions;

-- --- 1. The source -------------------------------------------------------------------------------

create table research_sources (
  id                   uuid primary key default gen_random_uuid(),

  slug                 citext not null unique,
  name                 text not null,
  base_url             text not null,
  region               text,
  currency             char(3),
  source_type          text,

  -- FALSE, AND IT CANNOT BE TRUE WITHOUT AN APPROVAL. See the constraint below.
  is_enabled           boolean not null default false,

  -- Phase 27 registers real adapters. `generic` fetches a page and reads its title and links.
  adapter_key          text not null default 'generic',

  -- POLITENESS, AS COLUMNS. Read by the lease query in 0232's partial index and by
  -- `lib/scraper/core/rate-limit.ts`. The defaults are deliberately timid: twenty requests a
  -- minute, three seconds apart, one at a time. A source is slowed by robots.txt and never sped up
  -- by it.
  rate_limit_rpm       int not null default 20,
  request_delay_ms     int not null default 3000,
  concurrency          int not null default 1,

  next_fetch_not_before timestamptz,
  in_flight_count      int not null default 0,
  consecutive_failures int not null default 0,
  circuit_open_until   timestamptz,

  policy_status        research_policy_status not null default 'UNREVIEWED',
  policy_reviewed_by   uuid references auth.users (id),
  policy_reviewed_at   timestamptz,
  policy_notes         text,

  status               content_status not null default 'DRAFT',
  /*
   * NO `owner_verification` COLUMN, AND ITS ABSENCE IS THE DECISION.
   *
   * A source is exactly the kind of row D10 governs — it asserts a business fact, namely that
   * Rivya may read somebody else's website — so the obvious move was to give it the D5 verification
   * flag defaulting to OWNER_VERIFICATION_REQUIRED. That would have been two columns answering one
   * question, and only one of them enforced: `policy_status` starts UNREVIEWED, only an owner or
   * admin may move it to APPROVED, and `research_sources_enabled_requires_approval` makes an
   * enabled-but-unapproved source unstorable. A second flag carrying the same meaning with no
   * constraint behind it is a flag that drifts out of agreement with the one that decides, and
   * then somebody reads the wrong one.
   *
   * `policy_status` IS the verification gate for this table, and it is stronger than the generic
   * one: the generic flag blocks publication, and this blocks the fetch.
   */
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  updated_by           uuid references auth.users (id),

  -- THE GATE. An enabled source must have been approved; approving is owner/admin only, enforced
  -- by RLS and by the server action. Stated as a CHECK because a constraint cannot be forgotten.
  constraint research_sources_enabled_requires_approval
    check (is_enabled = false or policy_status = 'APPROVED'),

  -- An approval names who made it and when. A policy_status of APPROVED with nobody's name against
  -- it is exactly the record that would be useless in the conversation it exists for.
  constraint research_sources_approval_is_attributed
    check (policy_status <> 'APPROVED'
           or (policy_reviewed_by is not null and policy_reviewed_at is not null)),

  constraint research_sources_base_url_is_http
    check (base_url ~* '^https?://'),
  constraint research_sources_rate_limit_sane
    check (rate_limit_rpm between 1 and 120),
  constraint research_sources_delay_sane
    check (request_delay_ms between 250 and 600000),
  constraint research_sources_concurrency_sane
    check (concurrency between 1 and 4)
);

comment on table research_sources is
  'A competitor website Rivya may read, and the politeness settings it is read with. Ships with ZERO rows: a source is a business relationship with a third party''s terms of use, and this repository cannot assert that Rivya may read any particular site. is_enabled is refused unless policy_status = APPROVED, at the row.';
comment on column research_sources.policy_status is
  'The owner''s assertion that this site''s terms permit reading it. OWNER_VERIFICATION_REQUIRED in the Studio sense: engineering does not make this call. See docs/architecture/SCRAPER.md.';
comment on column research_sources.request_delay_ms is
  'The floor between two requests to this host. robots.txt Crawl-delay raises it and never lowers it — a source configured faster than robots asks is slowed.';
comment on column research_sources.circuit_open_until is
  'Set when five consecutive fetches fail. While it is in the future no work item for this source is leased at all, which is the difference between backing off and hammering a host that is already unhappy.';

create index research_sources_enabled_idx on research_sources (is_enabled, policy_status);

-- --- 2. The standing job and the single execution -------------------------------------------------

create table research_jobs (
  id              uuid primary key default gen_random_uuid(),
  source_id       uuid not null references research_sources (id) on delete cascade,

  job_type        research_job_type not null,
  name            text not null,

  -- Seed URLs and category paths. Phase 26 supplies the URL patterns that make this richer; the
  -- Zod schema in `lib/scraper/workflows/schedule.ts` is what actually constrains it.
  scope           jsonb not null default '{}',

  cron_expression text,
  next_run_at     timestamptz,
  is_enabled      boolean not null default false,
  max_urls        int,

  status          content_status not null default 'DRAFT',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id),

  constraint research_jobs_scope_is_object check (jsonb_typeof(scope) = 'object'),
  constraint research_jobs_max_urls_sane check (max_urls is null or max_urls between 1 and 5000),
  -- A SCHEDULED JOB NAMES ITS SCHEDULE. Enabling a job with no cron expression would produce a job
  -- that never runs and no message saying why.
  constraint research_jobs_enabled_has_schedule
    check (is_enabled = false or cron_expression is not null)
);

comment on table research_jobs is
  'The standing definition of work against a source: what kind, over what scope, on what schedule. A job is not a run — see research_runs — and an enabled job with no cron expression is refused rather than silently never firing.';

create index research_jobs_due_idx on research_jobs (next_run_at) where is_enabled;
create index research_jobs_by_source_idx on research_jobs (source_id);

create table research_runs (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid references research_jobs (id) on delete set null,
  source_id      uuid not null references research_sources (id) on delete cascade,

  status         research_run_status not null default 'QUEUED',
  trigger        research_trigger not null default 'SCHEDULED',
  requested_by   uuid references auth.users (id),

  queued_at      timestamptz not null default now(),
  started_at     timestamptz,
  finished_at    timestamptz,

  stats          jsonb not null default '{}',
  error_summary  text,
  is_dry_run     boolean not null default false,

  constraint research_runs_stats_is_object check (jsonb_typeof(stats) = 'object'),
  -- A MANUAL RUN NAMES THE PERSON. A scheduled one names nobody, because nobody pressed anything —
  -- the convention this repository uses everywhere for automated writes (actor_kind = 'SYSTEM').
  constraint research_runs_manual_has_actor
    check (trigger <> 'MANUAL' or requested_by is not null),
  constraint research_runs_finished_has_started
    check (finished_at is null or started_at is not null)
);

comment on table research_runs is
  'One execution of a job. A run that exceeds the cron tick''s budget stays RUNNING and continues on the next tick — work items are the unit of progress, not runs, because a Vercel function is short-lived and a run must survive a cold start.';

create index research_runs_recent_idx on research_runs (source_id, started_at desc);
create index research_runs_active_idx on research_runs (status) where status in ('QUEUED', 'RUNNING');

-- --- 3. What came back ----------------------------------------------------------------------------

create table research_fetches (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid references research_runs (id) on delete set null,
  source_id       uuid not null references research_sources (id) on delete cascade,
  work_item_id    uuid,

  url             text not null,
  final_url       text,
  http_status     int,

  -- A `DISALLOWED` ROW RECORDS A DECISION AND NO REQUEST. That is the point of writing the row at
  -- all: without it, "we did not fetch this" and "we never considered it" look identical, and the
  -- first is the one that demonstrates the robots rules were honoured.
  robots_decision text not null,

  content_hash    text,
  bytes           int,
  duration_ms     int,

  -- The object key in the PRIVATE snapshot bucket. Null for a decision that performed no request.
  storage_key     text,
  fetched_at      timestamptz not null default now(),
  error           text,

  constraint research_fetches_robots_decision_allowlist
    check (robots_decision in ('ALLOWED', 'DISALLOWED', 'NO_ROBOTS', 'ERROR')),
  -- A REFUSED URL HAS NO RESPONSE, and saying so at the row stops a later bug recording a status
  -- and a body against a request that must never have been made.
  constraint research_fetches_disallowed_has_no_response
    check (robots_decision <> 'DISALLOWED'
           or (http_status is null and content_hash is null and storage_key is null)),
  constraint research_fetches_bytes_sane check (bytes is null or bytes >= 0)
);

comment on table research_fetches is
  'One attempt per row, including the attempts that were refused before any packet left. robots_decision = DISALLOWED means no HTTP request was made at all, and the constraint on this table makes a row claiming otherwise unstorable.';
comment on column research_fetches.storage_key is
  'research/<source_slug>/<yyyy>/<mm>/<dd>/<sha256>.html.gz in a PRIVATE Supabase Storage bucket. Never Cloudinary — a competitor''s page body is not Rivya media and must not sit behind a public CDN URL. Pruned at 180 days.';

create index research_fetches_by_run_idx on research_fetches (run_id, fetched_at desc);
create index research_fetches_by_hash_idx on research_fetches (source_id, content_hash);
create index research_fetches_prune_idx on research_fetches (fetched_at) where storage_key is not null;

create table research_raw_items (
  id                 uuid primary key default gen_random_uuid(),
  run_id             uuid references research_runs (id) on delete set null,
  source_id          uuid not null references research_sources (id) on delete cascade,
  fetch_id           uuid references research_fetches (id) on delete set null,

  source_url         text not null,
  source_external_id text,

  -- EXACTLY WHAT CAME BACK AND NOTHING INTERPRETED. In this phase the Zod schema in
  -- `lib/scraper/core/raw.ts` accepts only { title, canonicalUrl, links } — anything richer fails
  -- validation, deliberately, so that a "temporary" parser cannot land here and quietly become the
  -- architecture Phase 27 was supposed to build.
  raw                jsonb not null,
  content_hash       text,
  adapter_key        text not null default 'generic',
  adapter_version    text,
  extracted_at       timestamptz not null default now(),

  constraint research_raw_items_raw_is_object check (jsonb_typeof(raw) = 'object')
);

comment on table research_raw_items is
  'What a page said, unstructured. Phase 27 fills `raw` properly through registered adapters; this phase''s generic pass stores only a title, a canonical URL and link candidates, and the Zod schema refuses anything richer so the adapter architecture is not pre-empted by a shortcut.';

create index research_raw_items_by_run_idx on research_raw_items (run_id);
create index research_raw_items_by_url_idx on research_raw_items (source_id, source_url);

-- --- 4. The discovered product, and the record of every move it makes -----------------------------

create table research_products (
  id                 uuid primary key default gen_random_uuid(),
  source_id          uuid not null references research_sources (id) on delete cascade,

  source_url         text not null,
  source_external_id text,

  stage              research_stage not null default 'RAW',
  disposition        research_disposition not null default 'NONE',

  first_seen_at      timestamptz not null default now(),
  last_seen_at       timestamptz not null default now(),
  first_seen_run_id  uuid references research_runs (id) on delete set null,
  last_seen_run_id   uuid references research_runs (id) on delete set null,

  -- Phase 27 adds the foreign key to `research_product_versions`. It is a bare uuid here because
  -- the table it will point at does not exist yet, and a column added later is a migration nobody
  -- needs when the shape is already known.
  current_version_id uuid,

  status             content_status not null default 'DRAFT',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  updated_by         uuid references auth.users (id),

  constraint research_products_unique_per_source unique (source_id, source_url),
  constraint research_products_seen_order check (last_seen_at >= first_seen_at)
);

comment on table research_products is
  'One discovered product per source URL, carried through the seven FEAT §23 stages. It has NO foreign key to any public table and never will (isolation invariant I1): a research row becomes a Rivya product only by an owner typing one.';
comment on column research_products.stage is
  'FEAT §23. Written only by lib/scraper/core/stage.ts, which emits a research_pipeline_events row for every move. Nothing else in the codebase may set it.';
comment on column research_products.disposition is
  'What a person decided, independent of the stage. A REJECTED row keeps the stage it reached, which is what makes "how far did this get before we said no" answerable.';

create index research_products_triage_idx
  on research_products (stage, disposition, last_seen_at desc);
create index research_products_by_source_idx on research_products (source_id, last_seen_at desc);

create table research_pipeline_events (
  id            uuid primary key default gen_random_uuid(),

  entity_type   text not null,
  entity_id     uuid not null,

  from_stage    research_stage,
  to_stage      research_stage,

  actor_user_id uuid references auth.users (id),
  actor_kind    text not null,
  reason        text,
  occurred_at   timestamptz not null default now(),

  constraint research_pipeline_events_actor_kind_allowlist
    check (actor_kind in ('STAFF', 'SYSTEM')),
  -- A STAFF EVENT NAMES THE PERSON AND A SYSTEM EVENT NAMES NOBODY. The convention every automated
  -- write in this repository follows, made unstorable-otherwise here because this table is the
  -- record that a stage move was legitimate.
  constraint research_pipeline_events_actor_matches_kind
    check ((actor_kind = 'STAFF') = (actor_user_id is not null)),
  constraint research_pipeline_events_moves_somewhere
    check (from_stage is not null or to_stage is not null)
);

comment on table research_pipeline_events is
  'Append-only. Every stage move, who made it and why. update and delete are revoked: the account of how a row reached CONFIRMED is not editable by the person who moved it.';

create index research_pipeline_events_by_entity_idx
  on research_pipeline_events (entity_type, entity_id, occurred_at desc);

-- --- 5. robots.txt, cached ------------------------------------------------------------------------

create table research_robots_cache (
  id            uuid primary key default gen_random_uuid(),
  host          text not null unique,
  body          text,
  fetched_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  crawl_delay_s numeric,

  constraint research_robots_cache_ttl_forward check (expires_at > fetched_at),
  constraint research_robots_cache_delay_sane
    check (crawl_delay_s is null or (crawl_delay_s >= 0 and crawl_delay_s <= 3600))
);

comment on table research_robots_cache is
  'One row per host, 24-hour TTL. Cached because re-fetching robots.txt before every request would itself be the impolite behaviour the file exists to prevent. A row whose fetch FAILED is still cached, with a null body, so a host that cannot serve robots.txt is not re-asked every three seconds.';

-- --- 6. Append-only, and the revokes that make it so ----------------------------------------------
--
-- No update or delete policy is generated for `research_pipeline_events` (0233), and these revokes
-- close the other half. A table-level grant is not the security boundary on Supabase, RLS is — but
-- a role with neither cannot reach the statement at all, and saying it twice costs nothing.

revoke update, delete on research_pipeline_events from anon, authenticated;

alter table research_sources          enable row level security;
alter table research_jobs             enable row level security;
alter table research_runs             enable row level security;
alter table research_fetches          enable row level security;
alter table research_raw_items        enable row level security;
alter table research_products         enable row level security;
alter table research_pipeline_events  enable row level security;
alter table research_robots_cache     enable row level security;
