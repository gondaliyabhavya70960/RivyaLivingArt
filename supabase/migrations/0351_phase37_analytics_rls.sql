-- 0351_phase37_analytics_rls.sql — Phase 37
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for the one table migration 0350 creates. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote.
--
--   `analytics_snapshots`   analytics.read select (every staff role), and a COMPETITIVE row
--                           additionally needs research.read — the predicate below, so a direct
--                           request as an editor returns no competitive row. No session write:
--                           the daily cron and npm run analytics:snapshot write as the service
--                           role. No anon leg: nothing here is public.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- analytics_snapshots — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. Written by the service role only — the snapshot writer runs from the cron
-- and the CLI with no user session, and a row a session could insert would be an analytics figure
-- nobody computed. No anon policy: nothing here is public.
-- read: analytics.read (owner, admin, editor, merchandiser, researcher, viewer)

-- No anon policy. Shape C tables are never publicly readable.

-- SELECT SCOPE. A COMPETITIVE snapshot is a reading of competitor data and stays behind
-- research.read; the FIRST_PARTY rows are every staff member's. The role list is research.read's,
-- derived here so it cannot drift from the matrix.
create policy analytics_snapshots_select_staff on analytics_snapshots for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer') and (dimension <> 'COMPETITIVE' or public.has_role('owner','admin','merchandiser','researcher','viewer')));

-- No write policy for authenticated: see the deviation note above.
