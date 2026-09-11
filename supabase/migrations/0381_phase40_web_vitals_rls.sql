-- 0381_phase40_web_vitals_rls.sql — Phase 40
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for the one table migration 0380 creates. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote.
--
--   `web_vitals_samples`  analytics.read select (every staff role). NO write policy of any kind
--                          and NO anon leg. The row starts life as an anonymous browser beacon,
--                          so an anon insert policy would be an unauthenticated write path into
--                          the database; /api/vitals validates with Zod, rate-limits, and inserts
--                          as the service role instead. A visitor contributes a sample and can
--                          never read one back.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- web_vitals_samples — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. Written by the service role only — the row originates in an anonymous
-- browser beacon, and an anon insert policy would be an unauthenticated write path into the
-- database; /api/vitals validates, rate-limits and inserts instead. No anon select either: a
-- visitor contributes a sample and never reads one back.
-- read: analytics.read (owner, admin, editor, merchandiser, researcher, viewer)

-- No anon policy. Shape C tables are never publicly readable.

create policy web_vitals_samples_select_staff on web_vitals_samples for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

-- No write policy for authenticated: see the deviation note above.
