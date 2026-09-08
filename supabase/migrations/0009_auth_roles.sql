-- 0009_auth_roles.sql — Phase 04
--
-- The six D5 roles, and the table that says which one a person holds.
--
-- staff_profiles is the single source of a user's role and status, and every RLS policy in the
-- schema resolves through it. That makes it the highest-consequence table in the database: an
-- error here is not one table's problem, it is every table's.
--
-- ITS POLICIES ARE NOT HERE. They live in 0011, because they call has_role(), which 0010 defines.
-- The phase document's deliverable list implies they sit alongside the table; they cannot.
--
-- NO CUSTOMER ACCOUNTS, EVER (D1, requirement §39). This authentication system exists for staff.
-- A customer identity would be a separate Supabase role with its own policy family — never a new
-- value in this enum.

set search_path = public, extensions;

create type user_role as enum (
  'owner',
  'admin',
  'editor',
  'merchandiser',
  'researcher',
  'viewer'
);

-- ---------------------------------------------------------------------------------------------
-- staff_profiles
-- ---------------------------------------------------------------------------------------------
-- Tier A only (DATA_MODEL §1.4): this is configuration, not content. A content_status on it would
-- imply a publication workflow that does not exist.
--
-- The primary key is the natural key `user_id`, one of the three documented departures from D5's
-- surrogate-key rule (§1.1). It is the only one of the three that is load-bearing for security:
-- the row is 1:1 with an auth.users row and has no identity of its own, and a surrogate key would
-- make two profiles for one account representable — which is exactly what current_staff_role()
-- must never face, because an ambiguous profile is an ambiguous RLS decision.
create table staff_profiles (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  email         citext unique,
  display_name  text,
  role          user_role not null default 'viewer',
  status        text not null default 'INVITED',
  last_seen_at  timestamptz,

  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id),

  constraint staff_profiles_status_allowed check (
    status in ('INVITED', 'ACTIVE', 'SUSPENDED')
  )
);

create trigger staff_profiles_set_updated_at
  before update on staff_profiles
  for each row execute function public.set_updated_at();

-- Answering "who holds this role" is a per-request question on every Studio page.
create index staff_profiles_role_status_idx on staff_profiles (role, status);

alter table staff_profiles enable row level security;

-- ---------------------------------------------------------------------------------------------
-- Provisioning: a new auth user arrives with the LEAST privilege, always
-- ---------------------------------------------------------------------------------------------
-- Public sign-up is disabled at the project level, so the only way an auth.users row appears is an
-- owner/admin invite. This trigger still assumes nothing about that: whatever creates the user,
-- the profile lands INVITED/viewer. Elevation is a separate, explicit, audited act.
--
-- `security definer` because the inserting session is GoTrue's, which holds nothing on public.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.staff_profiles (user_id, email, status, role)
  values (new.id, new.email, 'INVITED', 'viewer')
  -- An invite re-sent, or a user deleted and recreated with the same id, must not fail the whole
  -- auth insert. The existing profile — including any role an owner has since granted — wins.
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------------------------
-- The last owner cannot be demoted, suspended or deleted
-- ---------------------------------------------------------------------------------------------
-- Enforced by a trigger rather than only by the server action that offers the button. A rule that
-- lives solely in a server action is bypassed by any other code path, by the service-role client,
-- and by a psql session — and the failure mode is a project nobody can administer, recoverable
-- only by direct database surgery.
--
-- AFTER, and STATEMENT-level: a multi-row update that demotes one owner while promoting another
-- must be judged on its net effect, not row by row. Row-level BEFORE triggers would reject the
-- legitimate hand-over.
create or replace function public.enforce_last_owner()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  active_owners int;
begin
  select count(*) into active_owners
    from public.staff_profiles
   where role = 'owner' and status = 'ACTIVE';

  if active_owners = 0 then
    raise exception
      'refusing to leave the project with no active owner'
      using errcode = 'check_violation',
            hint = 'Promote another staff member to owner first, then demote or suspend this one.';
  end if;

  return null;
end;
$$;

-- No INSERT trigger: the very first owner is promoted from an INVITED row, at which point the
-- count goes 0 -> 1. Guarding inserts would make bootstrapping impossible.
create constraint trigger staff_profiles_last_owner_update
  after update on staff_profiles
  deferrable initially deferred
  for each row execute function public.enforce_last_owner();

create constraint trigger staff_profiles_last_owner_delete
  after delete on staff_profiles
  deferrable initially deferred
  for each row execute function public.enforce_last_owner();

comment on table staff_profiles is
  'One row per staff member: their role and status. Every RLS policy resolves through this table.';
comment on column staff_profiles.status is
  'INVITED and SUSPENDED both yield a NULL current_staff_role(), so suspension is enforced by RLS, not only by the application.';
