-- ============================================================================================
-- 0232 — Phase 25: the work queue, which is the unit of progress
--
-- WHY A TABLE AND NOT A LOOP. A Vercel function runs for at most sixty seconds and can be killed
-- at any point inside that. A run over four hundred URLs therefore cannot be a `for` loop holding
-- state in memory: the process that started it will not be the process that finishes it. One row
-- per URL, leased and released, means a run is resumable, a cold start costs one lease timeout
-- rather than the whole run, and two overlapping cron invocations cannot fetch the same URL twice.
--
-- THE LEASE IS `for update skip locked`, WHICH IS THE ENTIRE CONCURRENCY DESIGN. Two invocations
-- racing for the same batch do not block each other and do not both win: the second skips the rows
-- the first has locked and takes the next ones. Combined with `unique (run_id, url)` and the
-- partial index below, this is what makes "no double fetch" a property of the database rather than
-- a hope about scheduling.
--
-- POLITENESS IS ENFORCED HERE, AT LEASE TIME, NOT AT FETCH TIME. `not_before_at` on the item and
-- `next_fetch_not_before` on the source are both read by the lease query, so a request that is not
-- yet due is never claimed in the first place. The alternative — leasing everything and sleeping
-- before each fetch — burns the function's sixty seconds doing nothing and loses the delay
-- entirely when the function is terminated mid-sleep.
-- ============================================================================================

set search_path = public, extensions;

create table research_work_items (
  id            uuid primary key default gen_random_uuid(),
  run_id        uuid not null references research_runs (id) on delete cascade,
  source_id     uuid not null references research_sources (id) on delete cascade,

  url           text not null,
  depth         int not null default 0,

  state         text not null default 'PENDING',

  -- Held by whichever invocation claimed the row. An expired lease is reclaimable, which is how a
  -- run survives the function that was draining it being killed.
  lease_until   timestamptz,
  attempts      int not null default 0,

  -- The politeness clock and the backoff clock, in one column. `Retry-After` on a 429 writes it,
  -- and so does the source's `request_delay_ms` after every fetch.
  not_before_at timestamptz not null default now(),
  last_error    text,

  created_at    timestamptz not null default now(),

  constraint research_work_items_unique_url unique (run_id, url),
  constraint research_work_items_state_allowlist
    check (state in ('PENDING', 'LEASED', 'DONE', 'FAILED', 'SKIPPED')),
  constraint research_work_items_url_is_http check (url ~* '^https?://'),
  constraint research_work_items_depth_sane check (depth between 0 and 10),
  -- A LEASED ROW HOLDS A LEASE. Without this a crashed release could leave a row marked LEASED
  -- with no expiry, which is a row that is never reclaimed and never runs — the one failure mode
  -- this whole table exists to prevent.
  constraint research_work_items_leased_has_expiry
    check (state <> 'LEASED' or lease_until is not null),
  constraint research_work_items_failed_has_reason
    check (state <> 'FAILED' or last_error is not null)
);

comment on table research_work_items is
  'One URL per row: the unit of progress. Leased with `for update skip locked`, retried with backoff through not_before_at, unique per (run, url). A run is drained across many cron invocations and survives a cold start because the state lives here rather than in a function''s memory.';
comment on column research_work_items.not_before_at is
  'The earliest this item may be leased. Written by the source''s request_delay_ms after each fetch and by Retry-After on a 429 or 503. Read by the lease query, so an item that is not due is never claimed — the delay is not a sleep inside a function that may be killed mid-wait.';
comment on column research_work_items.lease_until is
  'When this claim expires. A function that dies holding a lease loses it at this moment and the item is reclaimed, which is why a killed invocation costs one lease timeout rather than a whole run.';

-- THE LEASE INDEX. Partial on `PENDING` because that is the only state the query looks at, and
-- ordered by the two columns it filters on, so claiming the next due batch for a source is an
-- index scan over a small slice rather than a scan of every URL ever queued.
create index research_work_items_lease_idx
  on research_work_items (source_id, not_before_at)
  where state = 'PENDING';

-- Reclaiming expired leases is the other query that runs on every tick.
create index research_work_items_expired_lease_idx
  on research_work_items (lease_until)
  where state = 'LEASED';

create index research_work_items_by_run_idx on research_work_items (run_id, state);

-- The fetch row points back at the item it came from. Added here rather than in 0231 because the
-- table it references is created in this file, and a forward reference is a migration that will
-- not replay from clean.
alter table research_fetches
  add constraint research_fetches_work_item_fk
  foreign key (work_item_id) references research_work_items (id) on delete set null;

-- --- The lease, as one statement --------------------------------------------------------------
--
-- A FUNCTION BECAUSE POSTGREST CANNOT SAY `for update skip locked`, and that clause is not an
-- optimisation here — it is the entire concurrency design. Expressed as a read-then-write from the
-- application, two cron invocations would both select the same rows, both believe they had
-- claimed them, and both fetch them: exactly the double-request the politeness posture exists to
-- prevent, arriving through the queue meant to prevent it.
--
-- SECURITY DEFINER, GRANTED TO THE SERVICE ROLE ALONE. It writes `research_work_items`, which has
-- no session write policy at all — a member of staff who could lease items could clear a
-- `not_before_at` and edit the rate limit from inside the building. `search_path` is pinned so a
-- caller cannot shadow a table name.
--
-- IT CHECKS THE SOURCE'S OWN CLOCKS TOO, not only the item's. A source whose circuit is open, or
-- whose `next_fetch_not_before` has not arrived, or which is disabled or unapproved, leases
-- nothing — so every politeness control is evaluated in the same statement that hands out work,
-- and there is no window between "may we fetch this" and "we are fetching this".
create function public.research_lease_work_items(
  p_source_id     uuid,
  p_limit         int,
  p_lease_seconds int default 120
) returns setof research_work_items
language plpgsql volatile security definer
set search_path = public, extensions
as $fn$
declare
  v_now timestamptz := now();
begin
  if p_limit is null or p_limit <= 0 then
    return;
  end if;

  -- The source gate, first and in the same statement. `for update` on the source row also
  -- serialises two invocations racing to lease for the SAME source, which is what makes the
  -- concurrency ceiling a ceiling rather than a suggestion.
  perform 1
  from research_sources s
  where s.id = p_source_id
    and s.is_enabled
    and s.policy_status = 'APPROVED'
    and (s.circuit_open_until is null or s.circuit_open_until <= v_now)
    and (s.next_fetch_not_before is null or s.next_fetch_not_before <= v_now)
  for update;

  if not found then
    return;
  end if;

  return query
  with claimed as (
    select w.id
    from research_work_items w
    join research_runs r on r.id = w.run_id
    where w.source_id = p_source_id
      and w.state = 'PENDING'
      and w.not_before_at <= v_now
      -- A CANCELLED RUN LEASES NOTHING. The drain loop also checks between items; this makes the
      -- cancellation effective at the moment of claiming rather than one item later.
      and r.status in ('QUEUED', 'RUNNING')
    order by w.not_before_at
    limit p_limit
    for update of w skip locked
  )
  update research_work_items w
     set state = 'LEASED',
         lease_until = v_now + make_interval(secs => greatest(p_lease_seconds, 1)),
         attempts = w.attempts + 1
    from claimed
   where w.id = claimed.id
  returning w.*;
end;
$fn$;

comment on function public.research_lease_work_items(uuid, int, int) is
  'Claim up to p_limit due work items for one source, atomically. `for update skip locked` is what stops two overlapping cron invocations fetching the same URL; the source gate in the same statement is what stops a disabled, unapproved, circuit-open or not-yet-due source being fetched at all.';

revoke execute on function public.research_lease_work_items(uuid, int, int) from public, anon, authenticated;
grant execute on function public.research_lease_work_items(uuid, int, int) to service_role;

-- --- Reclaiming what a killed invocation left behind ---------------------------------------------
--
-- A FUNCTION AND NOT AN APPLICATION LOOP, for the same reason as the lease: it must be one
-- statement. Called at the top of every tick, before anything is leased, so an item whose holder
-- died is back in the queue within one lease period rather than at the end of time.
create function public.research_reclaim_expired_leases() returns int
language plpgsql volatile security definer
set search_path = public, extensions
as $fn$
declare
  v_count int;
begin
  with expired as (
    update research_work_items
       set state = case when attempts >= 6 then 'FAILED' else 'PENDING' end,
           lease_until = null,
           last_error = case
             when attempts >= 6 then 'Abandoned after six attempts; the last holder did not report back.'
             else last_error
           end
     where state = 'LEASED'
       and lease_until <= now()
    returning 1
  )
  select count(*) into v_count from expired;
  return v_count;
end;
$fn$;

comment on function public.research_reclaim_expired_leases() is
  'Return items whose lease expired to PENDING, or FAIL them once they have used their six attempts. This is what makes a killed function cost one lease period rather than a whole run.';

revoke execute on function public.research_reclaim_expired_leases() from public, anon, authenticated;
grant execute on function public.research_reclaim_expired_leases() to service_role;

alter table research_work_items enable row level security;
