-- 0361_phase38_system_logs_rls.sql — Phase 38
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for the one table migration 0360 creates. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote.
--
--   `system_logs`   operations.logs.read select (owner, admin); no session write of any kind —
--                   the service role writes through system_log_write() and the retention cron
--                   deletes; update and delete are revoked in 0360. No anon leg.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- system_logs — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. Append-only operational log. No anon policy, no authenticated write policy
-- of any kind — lib/logging/system-log.ts writes through the service role and system_log_write();
-- update and delete are revoked outright (0360) so a session cannot rewrite what the machine did.
-- read: operations.logs.read (owner, admin)

-- No anon policy. Shape C tables are never publicly readable.

create policy system_logs_select_staff on system_logs for select
  to authenticated using (public.has_role('owner','admin'));

-- No write policy for authenticated: see the deviation note above.
