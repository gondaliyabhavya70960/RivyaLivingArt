-- ============================================================================================
-- 0143 — close the five functions that were left callable
--
-- `0022_function_grants.sql` states the rule and the reason: **every function is created with
-- EXECUTE granted to PUBLIC**, that is PostgreSQL's default rather than anything this project
-- asked for, and Supabase turns anything callable into a PostgREST RPC endpoint. Every function
-- created since was supposed to revoke it. Five did not.
--
-- Found by asking the database rather than by reading the migrations:
--
--     select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute');
--
--     is_valid_dimensions(value jsonb)      0130   Phase 15
--     reject_concept_flag_on_used_asset()   0122   Phase 14
--     reject_concept_product_hero()         0122   Phase 14
--     reject_concept_product_media()        0122   Phase 14
--     reset_schedule_state()                0050   Phase 08
--
-- THE FIVE ARE NOT ALIKE, AND TREATING THEM ALIKE BREAKS THE SITE. The first version of this file
-- revoked all three grants from all five, and twenty tests went red with
-- `permission denied for function is_valid_dimensions`. The distinction it missed:
--
--   * FOUR RETURN `trigger`. A trigger function is invoked by the executor as part of firing the
--     trigger, and that path does not test the writing user's EXECUTE privilege. PostgREST also
--     refuses to expose a function returning `trigger`. Revoking everything from these costs
--     nothing and closes the endpoint.
--
--   * `is_valid_dimensions(jsonb)` RETURNS BOOLEAN AND BACKS A CHECK CONSTRAINT.
--     `products_dimensions_shape` calls it on every insert and update of `products`, and A CHECK
--     CONSTRAINT IS EVALUATED AS THE WRITING USER. Revoking EXECUTE from `authenticated` therefore
--     does not harden the function — it makes the `products` table unwritable by every member of
--     staff, with an error naming a function they have never heard of.
--
-- So `anon` and `public` lose it, and the roles that legitimately write the table keep it. That is
-- the honest reading of `0022`'s rule: the grant to PUBLIC is the accident, and the fix is to name
-- who actually needs it rather than to revoke from everyone and see what breaks.
--
-- WHAT THE REMAINING EXPOSURE WAS, so the value of this file is not overstated: the four trigger
-- functions were unreachable in practice, and `is_valid_dimensions` is a pure predicate over an
-- argument the caller already holds — it reads no table and returns a boolean. Closing it matters
-- because the reasoning "this one is harmless" is what stops being true when somebody adds a table
-- read to a helper, and because a convention followed sometimes is not a convention.
--
-- `0050` IS INCLUDED AND THAT IS NOT SCOPE CREEP — the query above does not know which phase wrote
-- what, and leaving one of five closed-by-accident would make the next audit report a lapse that is
-- really an omission from this file.
--
-- No schema change. Re-running is harmless: REVOKE of a privilege nobody holds is a no-op.
-- ============================================================================================

-- --- the four trigger functions: nobody needs to call these directly --------------------------
revoke execute on function public.reject_concept_flag_on_used_asset() from public, anon, authenticated;
revoke execute on function public.reject_concept_product_hero() from public, anon, authenticated;
revoke execute on function public.reject_concept_product_media() from public, anon, authenticated;
revoke execute on function public.reset_schedule_state() from public, anon, authenticated;

-- --- the constraint function: close the endpoint, keep the writers ----------------------------
-- `revoke ... from public` also removes what `authenticated` inherited through PUBLIC, so the grant
-- that follows is required rather than belt-and-braces. Without it every staff write to `products`
-- fails.
revoke execute on function public.is_valid_dimensions(jsonb) from public, anon, authenticated;
grant execute on function public.is_valid_dimensions(jsonb) to authenticated, service_role;
