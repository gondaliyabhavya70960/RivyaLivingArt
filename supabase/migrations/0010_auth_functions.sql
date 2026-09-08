-- 0010_auth_functions.sql — Phase 04
--
-- The three helpers every RLS policy calls. Keeping the role test in one place is what lets a
-- policy stay one line long and stops six subtly different spellings of "is this person staff"
-- accumulating across a hundred policies.
--
-- ALL THREE ARE `security definer`, and that is not optional. A policy on staff_profiles that
-- called a plain function reading staff_profiles would re-enter that table's own policies and
-- recurse. `security definer` runs the body as the function's owner, whose access to the table is
-- decided by ownership rather than by policy, which breaks the loop.
--
-- `set search_path = public, pg_temp` is the companion half. A `security definer` function with an
-- unpinned search_path is a privilege-escalation primitive: anyone able to create a schema earlier
-- on the caller's path can supply their own `staff_profiles` and be answered with any role they
-- like. pg_temp is named LAST deliberately — a temp table shadowing a real one is the specific
-- attack, and putting pg_temp anywhere but last re-opens it.
--
-- `stable` lets the planner call these once per statement rather than once per row, which matters
-- because they appear in the policy of every table in the schema.

set search_path = public, extensions;

-- The role of the CURRENT request's user, or null.
--
-- `status = 'ACTIVE'` is doing real work: an INVITED user who has not accepted, or a SUSPENDED one,
-- resolves to null and therefore fails every has_role() test in the database. Suspension is
-- enforced by RLS, not merely by hiding a button.
create or replace function public.current_staff_role()
returns user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role
    from public.staff_profiles
   where user_id = auth.uid()
     and status = 'ACTIVE'
$$;

-- Is the caller an active staff member of ANY role?
--
-- This is the shorthand DATA_MODEL §1.5 records for the RLS-PUBLIC staff select. Phase 04's
-- policies deliberately do NOT use it: they name their role list explicitly, so that
-- scripts/auth/check-rls.ts can compare each policy's list against the roles holding that table's
-- *.read permission and fail on any difference. The shorthand is only equivalent to the explicit
-- list when all six roles hold the permission — true for every Phase 03 table, false for
-- `inquiries` (Phase 20) and every `research_*` table (Phase 25), where copying it would hand a
-- researcher every customer's phone number or a viewer the security log.
--
-- It is defined here because it is a named deliverable of this migration and because a later
-- phase's application code legitimately wants "is this anyone at all" without caring which role.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_staff_role() is not null
$$;

-- Does the caller hold one of these roles?
--
-- variadic so a policy reads `has_role('owner','admin')` rather than passing an array literal.
-- Returns false rather than null for an unauthenticated caller, because a null in a USING clause
-- is not a grant but reads like an accident.
create or replace function public.has_role(variadic roles user_role[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_staff_role() = any(roles), false)
$$;

-- anon needs execute too: a policy's own predicate runs in the table owner's context, but
-- application code calls these directly, and an anonymous request that cannot call has_role()
-- errors rather than being denied.
grant execute on function public.current_staff_role(), public.is_staff(), public.has_role(user_role[])
  to anon, authenticated, service_role;

comment on function public.current_staff_role() is
  'The active role of the current request''s user, or NULL. security definer + pinned search_path: see 0010 header.';
comment on function public.has_role(user_role[]) is
  'Role test used by every RLS policy. Prefer an explicit role list over is_staff() — check-rls.ts enforces the list matches the table''s read permission.';
