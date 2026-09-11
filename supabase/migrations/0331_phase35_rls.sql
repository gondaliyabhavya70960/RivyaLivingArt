-- 0331_phase35_rls.sql — Phase 35
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for the two tables migration 0330 creates. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote.
--
--   `research_shortlist_entries`   research.confirm — owner, admin, merchandiser. Why a row was
--                                   shortlisted and by whom; closed, never deleted.
--
--   `research_confirmations`       research.confirm — the decision note behind CONFIRMED, archived
--                                   as a column and never deleted. created_product_id is written by
--                                   the service role from the hand-operated bridge and carries no
--                                   foreign key: research never joins the catalogue.
--
-- NOT research.write, and the phase document's permission table is explicit about why: a
-- researcher OPERATES the pipeline; a merchandiser JUDGES its output. ISOLATION INVARIANT I2 IS
-- UNCHANGED: not one `anon` leg appears below.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- research_shortlist_entries — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. Why a row was shortlisted, by whom, and the score as it stood.
-- research.confirm opens and closes an entry; nothing deletes one. No anon policy (I2).
-- read: research.read (owner, admin, merchandiser, researcher, viewer)   write: research.confirm (owner, admin, merchandiser)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_shortlist_entries_select_staff on research_shortlist_entries for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

create policy research_shortlist_entries_insert_staff on research_shortlist_entries for insert
  to authenticated with check (public.has_role('owner','admin','merchandiser'));

create policy research_shortlist_entries_update_staff on research_shortlist_entries for update
  to authenticated using  (public.has_role('owner','admin','merchandiser'))
                with check (public.has_role('owner','admin','merchandiser'));

-- ----------------------------------------------------------------------------------------------
-- research_confirmations — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. The decision record behind CONFIRMED. research.confirm records and archives
-- one; the bridge column created_product_id is written through the service role and carries no
-- foreign key. Nothing deletes a decision. No anon policy (I2).
-- read: research.read (owner, admin, merchandiser, researcher, viewer)   write: research.confirm (owner, admin, merchandiser)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_confirmations_select_staff on research_confirmations for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

create policy research_confirmations_insert_staff on research_confirmations for insert
  to authenticated with check (public.has_role('owner','admin','merchandiser'));

create policy research_confirmations_update_staff on research_confirmations for update
  to authenticated using  (public.has_role('owner','admin','merchandiser'))
                with check (public.has_role('owner','admin','merchandiser'));
