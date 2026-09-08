-- 0022_function_grants.sql — Phase 06
--
-- Narrow EXECUTE on every function in `public` to the roles that actually need it.
--
-- FOUND BY A CHECK THIS PROJECT COULD NOT PREVIOUSLY RUN. Supabase's security advisor
-- (`get_advisors`) flagged eight warnings the first time the schema reached a real project: four
-- `SECURITY DEFINER` functions callable by `anon`, and the same four callable by `authenticated`,
-- each exposed as a PostgREST RPC endpoint at `/rest/v1/rpc/<name>`.
--
-- The cause is PostgreSQL's default, not anything written here: **every function is created with
-- EXECUTE granted to PUBLIC.** `\df+` shows it as the `=X/postgres` entry in the ACL. Migration
-- 0010's explicit `grant execute ... to anon, authenticated, service_role` was therefore redundant
-- — the access already existed — and it hid the fact that the trigger functions had it too.
--
-- WHAT IS REVOKED, AND WHY EACH
--
--   set_updated_at()        trigger function. PostgreSQL refuses to call a `returns trigger`
--   enforce_last_owner()    function outside a trigger, so neither was ever *invocable* through
--   handle_new_auth_user()  RPC. The grant was meaningless rather than dangerous — but
--                           `handle_new_auth_user` is SECURITY DEFINER and inserts into
--                           `staff_profiles`, so "meaningless because PostgreSQL happens to refuse
--                           it" is a thinner guarantee than "not granted". Defence in depth costs
--                           one line here.
--
--   rivya_slugify(text)     pure and harmless — it lower-cases and hyphenates a string — but
--                           slugging happens in the application, so nothing needs it over RPC.
--                           An endpoint nobody calls is an endpoint nobody notices changing.
--
-- WHAT IS KEPT, AND WHY IT IS NOT A COMPROMISE
--
--   current_staff_role() · is_staff() · has_role(...)   granted to `authenticated` only.
--
-- `authenticated` MUST hold EXECUTE on these: an RLS policy expression is evaluated as the querying
-- role, so revoking it would make every staff-select policy in 0011 and 0021 fail closed and lock
-- the Studio out of its own database.
--
-- They stay callable as RPC endpoints, and that is acceptable rather than merely tolerated: each
-- reports a fact about THE CALLER and nobody else. `current_staff_role()` returns the caller's own
-- role, which they can already read through `staff_profiles_select_self`; the other two are
-- booleans derived from it. None takes a user id, so none can be asked about somebody else.
--
-- `anon` IS REVOKED, which is the part that actually reduces exposure. 0010 granted it on the
-- assumption that anonymous policies might need a role test. They do not: every `to anon` policy in
-- 0011 tests `status = 'PUBLISHED'` or a parent's status, and none calls a helper. The grant was
-- reach without purpose, and it is what made four of the eight advisor warnings `EXTERNAL`-facing.

set search_path = public, extensions;

-- PUBLIC first: revoking from anon/authenticated alone leaves the default PUBLIC grant in place,
-- and the advisor would still — correctly — report the function as executable.
revoke execute on function public.set_updated_at()                    from public, anon, authenticated;
revoke execute on function public.enforce_last_owner()                from public, anon, authenticated;
revoke execute on function public.handle_new_auth_user()              from public, anon, authenticated;
revoke execute on function public.rivya_slugify(text)                 from public, anon, authenticated;
revoke execute on function public.current_staff_role()                from public, anon;
revoke execute on function public.is_staff()                          from public, anon;
revoke execute on function public.has_role(variadic user_role[])      from public, anon;

-- Re-stated explicitly after the PUBLIC revoke, so the remaining access is granted rather than
-- inherited. This is the whole set of roles that may call an RLS helper.
grant execute on function public.current_staff_role(), public.is_staff(), public.has_role(user_role[])
  to authenticated, service_role;

comment on function public.handle_new_auth_user() is
  'Trigger on auth.users. EXECUTE revoked from PUBLIC/anon/authenticated in 0022: it is SECURITY DEFINER and writes staff_profiles, so it is granted to nobody rather than relying on PostgreSQL refusing to call a trigger function directly.';
