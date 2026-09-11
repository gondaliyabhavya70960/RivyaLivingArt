-- ============================================================================================
-- 0360 — Phase 38: system_logs, the two log enums, the dedupe writer and workflow_runs_v
--
-- THE THIRD LOG, AND WHY IT IS NOT THE FIRST TWO. audit_logs (0012) answers "who was allowed or
-- refused to do what"; activity_events (0020) answers "what has been happening in the Studio";
-- this table answers "what the machine did and where it failed" — background jobs, integrations,
-- cron, workflow runs. FEAT §31's single list mixes severity with subject, so it is decomposed
-- into two orthogonal columns, `level` and `channel`, and "SCRAPER errors in the last hour" is one
-- query.
--
-- APPEND-ONLY, LIKE ITS TWO SIBLINGS: no UPDATE or DELETE for any session role, the service role
-- the only writer (through system_log_write below), the retention cron the only deleter.
--
-- VOLUME CONTROL IS IN THE DATABASE, NOT IN THE CALLER. Every write carries a dedupe key; a repeat
-- within five minutes increments occurrence_count on the existing row instead of inserting. The
-- unique key (dedupe_key, first_minute) makes two concurrent first writes collide on the row
-- rather than both landing; `first_minute` is an epoch-minute integer column because a unique
-- constraint over date_trunc(timestamptz) would need an IMMUTABLE expression and there is none.
-- ============================================================================================

set search_path = public, extensions;

create type log_level as enum ('INFO', 'WARNING', 'ERROR', 'SECURITY');
create type log_channel as enum (
  'WORKFLOW', 'SCRAPER', 'MEDIA', 'CONTENT', 'AUTH', 'SHEETS', 'ANALYTICS', 'SYSTEM'
);

create table system_logs (
  id                 uuid primary key default gen_random_uuid(),
  level              log_level not null,
  channel            log_channel not null,
  event              text not null,
  message            text not null,
  context            jsonb not null default '{}'::jsonb,
  actor_id           uuid references auth.users (id) on delete set null,
  actor_role         user_role,
  request_id         text,
  workflow_run_id    uuid,
  research_source_id uuid,
  entity_type        text,
  entity_id          uuid,
  dedupe_key         text not null,
  occurrence_count   integer not null default 1,
  first_occurred_at  timestamptz not null default now(),
  occurred_at        timestamptz not null default now(),
  -- The minute the first occurrence fell in, as an epoch-minute integer. A plain column with a
  -- default rather than a generated one: every date function over timestamptz is STABLE, which a
  -- generated column refuses, while a DEFAULT may call now(). The writer below sets it from the
  -- same clock as first_occurred_at, and no session can insert a row at all.
  first_minute       bigint not null default (floor(extract(epoch from now()) / 60))::bigint,

  constraint system_logs_event_shape check (event ~ '^[a-z][a-z0-9_.-]{1,99}$'),
  constraint system_logs_message_bounded
    check (length(btrim(message)) > 0 and length(message) <= 2000),
  constraint system_logs_context_is_object check (jsonb_typeof(context) = 'object'),
  constraint system_logs_dedupe_key_bounded check (length(dedupe_key) between 1 and 300),
  constraint system_logs_occurrence_positive check (occurrence_count >= 1),
  constraint system_logs_occurred_after_first check (occurred_at >= first_occurred_at),
  constraint system_logs_dedupe_per_minute unique (dedupe_key, first_minute)
);

create index system_logs_occurred_idx on system_logs (occurred_at desc);
create index system_logs_level_idx on system_logs (level, occurred_at desc);
create index system_logs_channel_idx on system_logs (channel, occurred_at desc);
create index system_logs_actor_idx on system_logs (actor_id, occurred_at desc)
  where actor_id is not null;
create index system_logs_workflow_idx on system_logs (workflow_run_id)
  where workflow_run_id is not null;
-- The retention cron deletes by level and age.
create index system_logs_retention_idx on system_logs (level, first_occurred_at);

comment on table system_logs is
  'Phase 38. The operational log: what the machine did and where it failed. level × channel, a '
  'redacted context (lib/logging/redact.ts, before insert), a dedupe key with a five-minute '
  'window. Append-only: no session UPDATE or DELETE; the service role writes through '
  'system_log_write() and the retention cron deletes (INFO/WARNING 90 days, ERROR/SECURITY 400).';
comment on column system_logs.context is
  'Redacted before insert. Never a secret, a token, a connection string or an upstream response body.';

-- No session may rewrite or erase the operational record.
revoke update, delete on system_logs from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- The writer. SECURITY DEFINER so the dedupe update and the insert share one transaction under
-- PostgREST, which gives the caller none; executable by the service role only.
-- ---------------------------------------------------------------------------------------------
create or replace function system_log_write(
  p_level              log_level,
  p_channel            log_channel,
  p_event              text,
  p_message            text,
  p_context            jsonb,
  p_actor_id           uuid,
  p_actor_role         user_role,
  p_request_id         text,
  p_workflow_run_id    uuid,
  p_research_source_id uuid,
  p_entity_type        text,
  p_entity_id          uuid,
  p_dedupe_key         text
) returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  -- A repeat inside the window: bump the newest matching row and stop.
  select id into v_id
    from system_logs
   where dedupe_key = p_dedupe_key
     and first_occurred_at > now() - interval '5 minutes'
   order by first_occurred_at desc
   limit 1
     for update;
  if v_id is not null then
    update system_logs
       set occurrence_count = occurrence_count + 1,
           occurred_at = now()
     where id = v_id;
    return v_id;
  end if;

  -- A first occurrence — or a concurrent first occurrence that lost the race on the same minute,
  -- which lands on the winner's row.
  -- check-migrations: allow-insert (a function body, not a seeded row — inserts nothing at migration time)
  insert into system_logs (
    level, channel, event, message, context, actor_id, actor_role, request_id,
    workflow_run_id, research_source_id, entity_type, entity_id, dedupe_key,
    first_occurred_at, occurred_at, first_minute
  ) values (
    p_level, p_channel, p_event, p_message, coalesce(p_context, '{}'::jsonb), p_actor_id,
    p_actor_role, p_request_id, p_workflow_run_id, p_research_source_id, p_entity_type,
    p_entity_id, p_dedupe_key,
    now(), now(), (floor(extract(epoch from now()) / 60))::bigint
  )
  on conflict (dedupe_key, first_minute) do update
    set occurrence_count = system_logs.occurrence_count + 1,
        occurred_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function system_log_write(
  log_level, log_channel, text, text, jsonb, uuid, user_role, text, uuid, uuid, text, uuid, text
) from public, anon, authenticated;
grant execute on function system_log_write(
  log_level, log_channel, text, text, jsonb, uuid, user_role, text, uuid, uuid, text, uuid, text
) to service_role;

comment on function system_log_write(
  log_level, log_channel, text, text, jsonb, uuid, user_role, text, uuid, uuid, text, uuid, text
) is
  'Phase 38. The one writer of system_logs: dedupes a repeat within five minutes onto the existing '
  'row (occurrence_count), inserts otherwise. Service role only; the caller redacts first.';

-- ---------------------------------------------------------------------------------------------
-- workflow_runs_v — one place to see every long-running job (DATA_MODEL §10, STUDIO_GUIDE §13.1).
-- A workflow run already exists in five tables; a sixth would be a copy that drifts. Security
-- invoker: each underlying table's RLS still applies to the reader.
-- ---------------------------------------------------------------------------------------------
create view workflow_runs_v with (security_invoker = true) as
  select 'RESEARCH'::text as kind, id, source_id::text as scope, status::text as status,
         started_at, finished_at
    from research_runs
  union all
  select 'SHEETS', id, definition_id::text, status, started_at, finished_at
    from sheets_sync_runs
  union all
  select 'SEED', id, seed_version,
         case when finished_at is null then 'RUNNING' else 'SUCCEEDED' end,
         started_at, finished_at
    from content_seed_runs
  union all
  select 'HIGGSFIELD', id, manifest_version,
         case when finished_at is null then 'RUNNING' else 'SUCCEEDED' end,
         started_at, finished_at
    from higgsfield_migration_runs
  union all
  select 'BULK', id, target_entity, status, started_at, finished_at
    from bulk_operations;

comment on view workflow_runs_v is
  'Phase 38. The five run tables as one list: kind, id, scope, status, started_at, finished_at. '
  'security_invoker, so each table''s own policies decide what a reader sees; the page requires '
  'operations.logs.read. Each row joins to its log lines through system_logs.workflow_run_id.';

grant select on workflow_runs_v to authenticated, service_role;

alter table system_logs enable row level security;
