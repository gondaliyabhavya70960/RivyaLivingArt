-- 0183_phase19_rate_limit_rls.sql — Phase 19
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for `rate_limit_buckets`, which migration 0182 creates. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote.
--
-- ONE POLICY, and the absence of the other three is the point. The table is written solely by
-- `consume_rate_limit()`, a SECURITY DEFINER function granted to `service_role` alone — because
-- the bucket key is derived from the caller's address, and a session that could pass its own key
-- could exhaust somebody else's window on their behalf. An INSERT policy here would describe a
-- path nothing uses and would tell a later reader that a session can move a counter.
--
-- NO ANON POLICY EITHER. A visitor who could read their own bucket would learn exactly how close
-- they are to the ceiling and exactly when it resets, which is the information needed to pace an
-- attack rather than to stop one.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- rate_limit_buckets — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. No anon policy and no write policy for any session role. Rows are written
-- solely by consume_rate_limit(), a SECURITY DEFINER function granted to service_role, because the
-- bucket key is derived from the caller and a session able to pass its own key could exhaust
-- somebody else's window. Nothing public reads it: a visitor learning how close they are to a rate
-- limit learns how to pace an attack.
-- read: operations.logs.read (owner, admin)

-- No anon policy. Shape C tables are never publicly readable.

create policy rate_limit_buckets_select_staff on rate_limit_buckets for select
  to authenticated using (public.has_role('owner','admin'));

-- No write policy for authenticated: see the deviation note above.
