-- ============================================================================================
-- 0340 — Phase 36: Google Sheets export definitions and sync runs
--
-- ONE-WAY, BY CONSTRUCTION. Rivya writes a spreadsheet tab; the spreadsheet reads. Nothing in this
-- schema, and nothing in `lib/sheets/`, carries a value from a cell back into a Rivya table — a
-- spreadsheet is not a source of truth, and an inbound path would be the easiest place in the
-- whole system to inject a fabricated fact. `scripts/sheets/check-no-read.mjs` fails the build on
-- a Sheets read of cell values.
--
-- TWO TABLES:
--
--   `sheets_export_definitions`   what to export: an entity from a closed list, a column set drawn
--                                 from that entity's allowlist, a filter, a destination tab, a
--                                 schedule (`MANUAL` or a cron expression, hourly at most), the PII
--                                 flag, and the circuit-breaker state (paused after three
--                                 consecutive failures).
--   `sheets_sync_runs`            one row per run: status, counts, attempts, a SANITISED error code
--                                 and never a response body — a Google error payload can echo a
--                                 request URL and must not be persisted verbatim.
--
-- ONE RUN PER DEFINITION AT A TIME, enforced by a partial unique index on RUNNING; a second attempt
-- records SKIPPED rather than piling up behind a slow one.
--
-- WHAT IS NOT HERE: no credential column of any kind. `GOOGLE_SERVICE_ACCOUNT_JSON` is read from
-- the environment inside `lib/sheets/client.ts` and never written anywhere. `spreadsheet_id` is an
-- identifier, not a secret, and is displayed; the service-account EMAIL is displayed too, because
-- sharing the sheet with it is a step an admin must perform.
-- ============================================================================================

set search_path = public, extensions;

create table sheets_export_definitions (
  id                   uuid primary key default gen_random_uuid(),
  slug                 citext not null unique,
  name                 text not null,
  entity               text not null,
  scope_id             uuid,
  columns              text[] not null,
  filter               jsonb not null default '{}'::jsonb,
  spreadsheet_id       text,
  tab_name             text not null,
  schedule             text not null default 'MANUAL',
  includes_pii         boolean not null default false,
  is_enabled           boolean not null default true,
  paused_at            timestamptz,
  paused_reason        text,
  consecutive_failures integer not null default 0,
  last_run_at          timestamptz,
  last_status          text,
  created_at           timestamptz not null default now(),
  created_by           uuid references auth.users (id) on delete set null,
  updated_at           timestamptz not null default now(),
  updated_by           uuid references auth.users (id) on delete set null,

  constraint sheets_export_definitions_entity_allowed check (
    entity in ('RESEARCH_PRODUCTS', 'COMPARISON_SET', 'OPPORTUNITY_SCORES', 'SHORTLIST',
               'CONFIRMED', 'DIRECTION_BRIEFS', 'INQUIRIES')
  ),
  constraint sheets_export_definitions_columns_bounded
    check (array_length(columns, 1) between 1 and 40),
  constraint sheets_export_definitions_filter_is_object check (jsonb_typeof(filter) = 'object'),
  constraint sheets_export_definitions_tab_not_blank check (length(btrim(tab_name)) > 0),
  constraint sheets_export_definitions_schedule_not_blank check (length(btrim(schedule)) > 0),
  -- Paused means paused for a reason; running means neither.
  constraint sheets_export_definitions_paused_together
    check ((paused_at is null) = (paused_reason is null)),
  constraint sheets_export_definitions_failures_non_negative check (consecutive_failures >= 0),
  -- PII columns exist on one entity. The definition cannot claim them anywhere else.
  constraint sheets_export_definitions_pii_only_inquiries
    check (not includes_pii or entity = 'INQUIRIES'),
  constraint sheets_export_definitions_last_status_allowed
    check (last_status is null or last_status in ('RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED'))
);

create index sheets_export_definitions_due_idx
  on sheets_export_definitions (schedule) where is_enabled and paused_at is null;

comment on table sheets_export_definitions is
  'Phase 36. A one-way export to a Google Sheets tab: entity, allowlisted columns, filter, tab, '
  'schedule, PII flag and circuit-breaker state. Managed under integrations.sheets.manage; run '
  'under integrations.sheets.run (INQUIRIES additionally under inquiries.export). No credential '
  'column exists; the service account is read from the environment and never stored.';

create table sheets_sync_runs (
  id             uuid primary key default gen_random_uuid(),
  definition_id  uuid not null references sheets_export_definitions (id) on delete cascade,
  status         text not null,
  trigger        text not null,
  row_count      integer not null default 0,
  cell_count     integer not null default 0,
  attempts       integer not null default 0,
  error_code     text,
  duration_ms    integer,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  actor_id       uuid references auth.users (id) on delete set null,

  constraint sheets_sync_runs_status_allowed
    check (status in ('RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED')),
  constraint sheets_sync_runs_trigger_allowed check (trigger in ('MANUAL', 'CRON', 'CLI')),
  constraint sheets_sync_runs_counts_non_negative
    check (row_count >= 0 and cell_count >= 0 and attempts >= 0),
  -- A finished run has a finish time; a running one has none.
  constraint sheets_sync_runs_finished_together
    check ((status = 'RUNNING') = (finished_at is null)),
  -- The error code is a fixed vocabulary, never a message and never a response body.
  constraint sheets_sync_runs_error_code_allowed check (
    error_code is null or error_code in ('NOT_CONFIGURED', 'FLAG_OFF', 'AUTH', 'QUOTA', 'UPSTREAM',
      'WRITE', 'NO_SCOPE', 'INVALID_COLUMNS', 'PAUSED', 'DISABLED', 'RUNNING', 'FORBIDDEN',
      'DRY_RUN')
  )
);

-- One RUNNING run per definition. A second attempt records SKIPPED.
create unique index sheets_sync_runs_one_running_idx
  on sheets_sync_runs (definition_id) where status = 'RUNNING';
create index sheets_sync_runs_definition_idx on sheets_sync_runs (definition_id, started_at desc);

comment on table sheets_sync_runs is
  'Phase 36. One row per export run: status, row and cell counts, attempts, a sanitised error '
  'code from a fixed vocabulary, duration. Never a response body. Written by the service role.';

alter table sheets_export_definitions enable row level security;
alter table sheets_sync_runs enable row level security;
