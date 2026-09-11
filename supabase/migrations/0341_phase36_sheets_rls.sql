-- 0341_phase36_sheets_rls.sql — Phase 36
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for the two tables migration 0340 creates. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote.
--
--   `sheets_export_definitions`   analytics.read select; integrations.sheets.manage insert/update
--                                  (owner, admin). What leaves for a spreadsheet is decided here.
--
--   `sheets_sync_runs`            analytics.read select; no session write — the service role
--                                  records what a run did.
--
-- Running a definition is integrations.sheets.run (plus inquiries.export for INQUIRIES), checked
-- in the Server Action, the CLI and the cron; the run itself writes as the service role. No anon
-- leg on either table: a spreadsheet export is a staff act.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- sheets_export_definitions — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. An export definition decides what leaves for a spreadsheet, so owner and
-- admin write it; the run engine updates the circuit-breaker columns as the service role. Never
-- deleted through a session — a definition with history is disabled, not removed. No anon policy.
-- read: analytics.read (owner, admin, editor, merchandiser, researcher, viewer)   write: integrations.sheets.manage (owner, admin)

-- No anon policy. Shape C tables are never publicly readable.

create policy sheets_export_definitions_select_staff on sheets_export_definitions for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy sheets_export_definitions_insert_staff on sheets_export_definitions for insert
  to authenticated with check (public.has_role('owner','admin'));

create policy sheets_export_definitions_update_staff on sheets_export_definitions for update
  to authenticated using  (public.has_role('owner','admin'))
                with check (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- sheets_sync_runs — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. The record of what a run did: counts, attempts, a sanitised error code.
-- Written by the service role only — a run row a session could insert is a run nobody ran. No anon
-- policy.
-- read: analytics.read (owner, admin, editor, merchandiser, researcher, viewer)

-- No anon policy. Shape C tables are never publicly readable.

create policy sheets_sync_runs_select_staff on sheets_sync_runs for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

-- No write policy for authenticated: see the deviation note above.
