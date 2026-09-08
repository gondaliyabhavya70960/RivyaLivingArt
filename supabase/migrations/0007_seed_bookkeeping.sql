-- 0007_seed_bookkeeping.sql — Phase 03
--
-- One row per `npm run seed:content` invocation, including dry runs. This is the table that makes
-- seeding auditable: what ran, when, who ran it, and which seed_keys were skipped because an
-- owner had edited them.
--
-- It is an append-only run record, not content (DATA_MODEL.md §1.4), so it carries no
-- content_status, no owner_verification and no Tier C columns. Its `seed_version` keeps the short
-- name where row tables use `content_seed_version`, because this column records a run rather than
-- a row (DATA_MODEL.md §1.8 correction C2).

-- Extension objects (citext, unaccent, gin_trgm_ops) are resolved through this search_path.
-- Supabase installs extensions into the `extensions` schema; a plain cluster installs them into
-- `public`. Naming both means these migrations apply unmodified to either, which they did NOT
-- before: with unaccent in `extensions`, 0003 failed at CREATE time with
--   ERROR: text search dictionary "unaccent" does not exist
-- and 0004-0006 would have failed the same way on the `citext` type. See docs/ops/ENVIRONMENT.md.
set search_path = public, extensions;

create table content_seed_runs (
  id                          uuid primary key default gen_random_uuid(),
  seed_version                text not null,
  started_at                  timestamptz not null default now(),
  finished_at                 timestamptz,
  -- CLI user or CI job. Free text: this is a log line, not a foreign key, and the runner may be
  -- invoked by something that has no auth.users row at all.
  actor                       text,
  is_dry_run                  boolean not null default false,
  inserted_count              int not null default 0,
  updated_count               int not null default 0,
  skipped_owner_edited_count  int not null default 0,
  failed_count                int not null default 0,
  -- The per-seed_key outcome list. jsonb rather than a child table: it is read whole, by a human,
  -- and never joined.
  report                      jsonb not null default '{}',

  constraint content_seed_runs_counts_non_negative check (
    inserted_count >= 0 and updated_count >= 0
    and skipped_owner_edited_count >= 0 and failed_count >= 0
  )
);

comment on table content_seed_runs is
  'One row per seed runner invocation, dry runs included. Append-only; never updated after finish.';

alter table content_seed_runs enable row level security;
