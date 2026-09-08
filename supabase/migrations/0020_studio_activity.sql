-- 0020_studio_activity.sql — Phase 05
--
-- Two tables the Studio shell needs: the human-readable activity feed, and each staff member's own
-- chrome state.
--
-- THREE LOGS, NEVER MERGED. `audit_logs` (0012) answers "was this allowed"; `system_logs`
-- (Phase 41) answers "what did the machine do"; `activity_events` here answers "who changed what",
-- for people. They look similar enough that merging them is a recurring temptation, and each merge
-- costs something specific: the audit log would gain rows a viewer may read, the activity feed
-- would gain rows nobody can act on, and the retention rules differ.
--
-- The policies for both tables are NOT in this file. They are generated into
-- 0021_rls_policies_phase05.sql from the permission matrix, which is what keeps the role lists and
-- lib/auth/permissions.ts from drifting apart. This file creates the tables, the indexes and the
-- RLS switch; 0021 grants the access.

set search_path = public, extensions;

-- ------------------------------------------------------------------------------------------------
-- activity_events — the feed
-- ------------------------------------------------------------------------------------------------
-- Append-only, so it is exempt from Tier A (DATA_MODEL §1.2: "every table except pure join tables
-- and append-only logs"). An `updated_at` on a row that must never be updated would be a promise
-- the table cannot keep.

create table activity_events (
  id            uuid primary key default gen_random_uuid(),
  occurred_at   timestamptz not null default now(),

  -- Who. Nullable and `on delete set null`: an event outlives the account that caused it, and
  -- losing the whole row when somebody leaves would erase the history of what they changed.
  -- actor_role is stored rather than joined for the same reason — it records the role AT THE TIME,
  -- which is the only version that explains the action, and a join would show today's.
  actor_id      uuid references auth.users(id) on delete set null,
  actor_role    user_role,

  -- What. `action` is a dotted verb from the controlled vocabulary in lib/logging/activity.ts.
  -- entity_label is denormalised on purpose: the feed must still read sensibly after the record is
  -- renamed or deleted, and a join cannot show the name a thing had when it was archived.
  action        text not null,
  entity_type   text,
  entity_id     uuid,
  entity_label  text,
  summary       text,

  metadata      jsonb not null default '{}'::jsonb,

  constraint activity_events_action_present check (length(btrim(action)) > 0)
);

-- The feed's three reads: newest first, one record's history, one person's history.
create index activity_events_occurred_idx on activity_events (occurred_at desc);
create index activity_events_entity_idx on activity_events (entity_type, entity_id);
create index activity_events_actor_idx on activity_events (actor_id, occurred_at desc);

alter table activity_events enable row level security;

-- Append-only by privilege, not only by the absence of a policy. A policy can be added by anyone
-- who can write a migration; a revoked privilege has to be granted back explicitly and visibly.
-- This is only meaningful because `authenticated` holds UPDATE and DELETE on every table in public
-- by default on Supabase — so this is a real removal, not decoration.
revoke update, delete on activity_events from authenticated, anon;

comment on table activity_events is
  'Human-readable "who changed what" feed. Written only by the service role via lib/logging/activity.ts; update and delete are revoked. Distinct from audit_logs (authorisation) and system_logs (machine).';
comment on column activity_events.actor_role is
  'The role held WHEN the action happened. Stored, not joined: a join would show the actor''s role today, which does not explain what they did last month.';
comment on column activity_events.entity_label is
  'The record''s name at the time. Denormalised so the feed still reads sensibly after a rename or a delete.';

-- ------------------------------------------------------------------------------------------------
-- studio_preferences — per-user chrome state
-- ------------------------------------------------------------------------------------------------
-- Tier A only. Not content: it has no status, is never published, and is never seeded.
--
-- Its policies are scoped to `user_id = auth.uid()` (see 0021). That scope is the security, not
-- the role list: every role holds `studio.access`, so without it any staff member could overwrite
-- anyone else's sidebar.

create table studio_preferences (
  id                   uuid primary key default gen_random_uuid(),

  -- `unique` is the invariant the upsert depends on: one row per person, so a preference write is
  -- an insert-or-update on a single key rather than a read-modify-write that can race itself.
  -- `on delete cascade` because this row is worthless without its account — unlike an activity
  -- event, nobody needs to know what a departed colleague's sidebar looked like.
  user_id              uuid not null unique references auth.users(id) on delete cascade,

  sidebar_collapsed    boolean not null default false,
  pinned_routes        text[] not null default '{}',
  dashboard_card_order text[] not null default '{}',

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  updated_by           uuid references auth.users(id)
);

create trigger studio_preferences_set_updated_at
  before update on studio_preferences
  for each row execute function set_updated_at();

alter table studio_preferences enable row level security;

-- No delete policy in 0021, so this revoke is belt and braces on the same reasoning as above: a
-- staff member deleting their own preferences row is harmless, but it is not a capability anything
-- needs, and the default grant would otherwise provide it silently.
revoke delete on studio_preferences from authenticated, anon;

comment on table studio_preferences is
  'Per-user Studio chrome state. Every policy is additionally scoped to user_id = auth.uid(); no cross-user read or write.';
