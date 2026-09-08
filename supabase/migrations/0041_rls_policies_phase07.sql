-- 0041_rls_policies_phase07.sql — Phase 07
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for higgsfield_migration_runs, which migration 0040 creates. Its own file for the
-- same reason 0031 and 0021 were: a generated policy file is never re-opened once shipped.
--
-- ONE POLICY, and the absence of the other three is the point. This table is written by a CLI
-- migration over DATABASE_URL, which bypasses RLS by role attribute — so an insert policy would
-- describe a path nothing uses, and reviewing it later would suggest a session can write run
-- records when none can. Staff read it; nothing else touches it through PostgREST.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- higgsfield_migration_runs — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. Run record, not content — the same shape and the same reasoning as
-- content_seed_runs. No anon policy, and no authenticated WRITE policy: the migration script
-- connects over DATABASE_URL and bypasses RLS entirely, so granting a session write access here
-- would add reach without adding capability. Read is media.read rather than operations.logs.read
-- because the thing being audited is the media library, and the people who need to ask "did all
-- 250 land" are the six roles that can already see the assets.
-- read: media.read (owner, admin, editor, merchandiser, researcher, viewer)

-- No anon policy. Shape C tables are never publicly readable.

create policy higgsfield_migration_runs_select_staff on higgsfield_migration_runs for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

-- No write policy for authenticated: see the deviation note above.
