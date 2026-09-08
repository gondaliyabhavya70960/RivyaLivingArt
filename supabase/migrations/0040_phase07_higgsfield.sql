-- 0040_phase07_higgsfield.sql — Phase 07
--
-- One row per `npm run media:migrate:higgsfield` invocation, dry runs included. It is the record
-- that makes a 250-asset migration auditable and, more usefully, RESUMABLE in a way somebody can
-- inspect: what was attempted, what landed, what was skipped because it was already there, and
-- what failed with which HTTP status.
--
-- WHAT THIS TABLE IS *NOT*. It is not the resume mechanism. That is
-- `data/higgsfield/migration-log.json`, keyed by `higgsfield_generation_id` and committed to the
-- repository — because the migration must be resumable by somebody who has the repo and a
-- Cloudinary key but no database yet, and because a ledger in git is reviewable in a pull request
-- while a table is not. This table is the per-RUN summary; the ledger is the per-ASSET state.
-- Keeping them separate is what lets the ledger answer "has this generation already been
-- uploaded" without a database round trip per asset.
--
-- APPEND-ONLY RUN RECORD, NOT CONTENT (DATA_MODEL §1.4). No `content_status`, no
-- `owner_verification`, no Tier C columns. Same family as `content_seed_runs` (0007), and
-- deliberately the same shape so the two read alike.
--
-- NO `media_assets` SCHEMA CHANGE. Phase 06's `0030` already declared every column this phase's
-- import writes — `source`, `higgsfield_generation_id`, `higgsfield_model`, `higgsfield_prompt`,
-- `manifest_version`, `migrated_at`, `tags`, `subject_tags`. Phase 07 populates; it does not
-- extend. DATA_MODEL §12 says so, and a migration here that altered `media_assets` would mean one
-- of the two documents was wrong.

set search_path = public, extensions;

create table higgsfield_migration_runs (
  id               uuid primary key default gen_random_uuid(),
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,

  -- Which manifest produced this run. `rivya-hf-v1` today. Recorded per run rather than assumed,
  -- so that a run made against a rebuilt manifest is distinguishable afterwards — which is the
  -- whole question anyone debugging a renumbered family will be asking.
  manifest_version text not null,

  -- What was asked for: `--family=process-pour`, `--limit=10`, or `all`. Free text because it is
  -- a record of a command line, not a query the database needs to understand.
  requested_scope  text not null default 'all',

  attempted        int not null default 0,
  migrated         int not null default 0,
  skipped          int not null default 0,
  failed           int not null default 0,

  dry_run          boolean not null default false,

  -- Nullable, and usually null. The migration runs from a CLI over DATABASE_URL, where there is
  -- no session and therefore no `auth.uid()`. It is here for the day the Studio offers a
  -- "resume migration" button, and it references auth.users so that day needs no migration.
  run_by           uuid references auth.users(id),

  -- The per-asset outcome list. jsonb rather than a child table for the same reason
  -- `content_seed_runs.report` is: it is read whole, by a human, and never joined.
  log              jsonb not null default '{}',

  constraint higgsfield_migration_runs_counts_non_negative check (
    attempted >= 0 and migrated >= 0 and skipped >= 0 and failed >= 0
  ),

  -- The arithmetic must hold. A run reporting more outcomes than attempts has lost track of
  -- something, and the summary line it prints would be a lie in the direction that matters —
  -- "migrated 250" when it attempted 200.
  constraint higgsfield_migration_runs_counts_add_up check (
    migrated + skipped + failed <= attempted
  )
);

create index higgsfield_migration_runs_started_idx
  on higgsfield_migration_runs (started_at desc);

alter table higgsfield_migration_runs enable row level security;

comment on table higgsfield_migration_runs is
  'One row per Higgsfield migration invocation, dry runs included. Append-only. The per-asset resume state lives in data/higgsfield/migration-log.json, not here.';
comment on column higgsfield_migration_runs.manifest_version is
  'The manifest this run read. Recorded rather than assumed so a run against a rebuilt manifest is identifiable afterwards.';
comment on constraint higgsfield_migration_runs_counts_add_up on higgsfield_migration_runs is
  'migrated + skipped + failed <= attempted. A run reporting more outcomes than attempts has lost track of an asset.';
