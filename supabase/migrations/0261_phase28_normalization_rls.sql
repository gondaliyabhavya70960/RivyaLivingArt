-- 0261_phase28_normalization_rls.sql — Phase 28
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for the three tables migration 0260 creates. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote. Its own
-- file for the reason every generated policy file has one: 0260 carries the DDL, and a shipped
-- generated file is never re-opened.
--
-- THREE TABLES, THREE DIFFERENT WRITE POSTURES, AND THE DIFFERENCE IS THE PHASE DOCUMENT'S RULE
-- MADE VISIBLE: the dividing line is the COLUMN, not the screen.
--
--   `research_material_lexicon`   research.write   — configuration, like a URL pattern
--   `research_validation_issues`  research.write   — UPDATE ONLY. The dismissal is the person's
--                                                    part; an ERROR raised by hand is a way to hold
--                                                    rows back with nothing saying why
--   `research_match_candidates`   research.confirm — UPDATE ONLY. Deciding one writes
--                                                    `duplicate_of_id` and `disposition`, and a
--                                                    researcher who may not set those directly must
--                                                    not reach them through a candidate
--
-- NEITHER OF THE TWO UPDATE-ONLY TABLES HAS A DELETE POLICY. An issue that turned out to be wrong
-- is a fact about the RULE that raised it, and deleting the row deletes the evidence that the rule
-- needs changing; a rejected candidate is the record that somebody looked at two rows and said they
-- were different, which is exactly what stops the matcher proposing them again as though nobody had.
--
-- ISOLATION INVARIANT I2 IS UNCHANGED: not one `anon` leg appears below, on any of the three, and
-- `scripts/research/check-research-isolation.mjs` fails the build the moment one does.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- research_validation_issues — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. One finding per (product, version, rule, field). No anon policy may ever
-- exist on any research_* table (isolation invariant I2). Update under research.write is the
-- dismissal; there is no insert policy and no delete policy, because an issue that was wrong is a
-- fact about the rule that raised it and deleting it deletes the evidence that the rule needs
-- changing.
-- read: research.read (owner, admin, merchandiser, researcher, viewer)   write: research.write (owner, admin, researcher)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_validation_issues_select_staff on research_validation_issues for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

-- NO INSERT POLICY. An issue is raised by lib/scraper/validation/rules.ts from the evidence, never
-- by a person. An ERROR blocks promotion past VALIDATED, so a hand-written one holds rows back
-- silently; what a person does here is dismiss one, with a reason the row demands.

create policy research_validation_issues_update_staff on research_validation_issues for update
  to authenticated using  (public.has_role('owner','admin','researcher'))
                with check (public.has_role('owner','admin','researcher'));

-- ----------------------------------------------------------------------------------------------
-- research_match_candidates — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. A proposal, never a verdict. Write is research.confirm rather than
-- research.write because deciding one writes duplicate_of_id and disposition on the product, and a
-- researcher who may not set those directly must not be able to set them through a candidate. No
-- insert policy: the matcher writes these through the service role.
-- read: research.read (owner, admin, merchandiser, researcher, viewer)   write: research.confirm (owner, admin, merchandiser)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_match_candidates_select_staff on research_match_candidates for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

-- NO INSERT POLICY. The matcher proposes; a merchandiser decides. A candidate somebody inserted by
-- hand is not a proposal the matcher made, and accepting it would write a duplicate flag on
-- evidence that never existed.

create policy research_match_candidates_update_staff on research_match_candidates for update
  to authenticated using  (public.has_role('owner','admin','merchandiser'))
                with check (public.has_role('owner','admin','merchandiser'));

-- ----------------------------------------------------------------------------------------------
-- research_material_lexicon — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. A parsing vocabulary for other people's words, editable in Studio so that a
-- material nobody anticipated is added without a deploy. Delete is destructive.execute because
-- removing a token unmatches it on every stored row the next re-normalisation touches.
-- read: research.read (owner, admin, merchandiser, researcher, viewer)   write: research.write (owner, admin, researcher)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_material_lexicon_select_staff on research_material_lexicon for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

create policy research_material_lexicon_insert_staff on research_material_lexicon for insert
  to authenticated with check (public.has_role('owner','admin','researcher'));

create policy research_material_lexicon_update_staff on research_material_lexicon for update
  to authenticated using  (public.has_role('owner','admin','researcher'))
                with check (public.has_role('owner','admin','researcher'));

create policy research_material_lexicon_delete_staff on research_material_lexicon for delete
  to authenticated using (public.has_role('owner','admin'));
