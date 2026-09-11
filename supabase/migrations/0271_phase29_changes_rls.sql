-- 0271_phase29_changes_rls.sql — Phase 29
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for the seven tables migration 0270 creates. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote. Its own
-- file for the reason every generated policy file has one: 0270 carries the DDL, and a shipped
-- generated file is never re-opened.
--
-- SEVEN TABLES, THREE POSTURES, AND THE QUESTION THAT SORTS THEM IS "WHO MAY WRITE":
--
--   DETECTED BY THE SYSTEM, no write policy at all
--     `research_changes`           the detector's output; a change a session could insert is a
--                                   competitor price move somebody could invent
--     `research_change_digests`    a summary read as a trend, which is the worst thing to be able
--                                   to hand-edit
--
--   DECIDED BY A PERSON, `research.confirm`, INSERT ONLY
--     `research_review_actions`    append-only at the trigger as well as at the policy; a
--                                   reversal is a new row
--     `research_notes`             an edit is a new note; the old one is superseded, never rewritten
--     `research_product_tags`      applied or removed, never amended — and the only table here
--                                   with a DELETE policy, because removing a tag applied in error
--                                   is a correction and no decision is recorded on the row
--
--   CONFIGURED BY A PERSON, `research.write`
--     `research_change_rules`      a threshold is a parsing decision about somebody else's page
--     `research_tags`              a controlled vocabulary, exactly as the material lexicon is
--
-- THE SPLIT IS THE PHASE 04 ONE, RESTATED AT THE COLUMN: a researcher OPERATES the pipeline and
-- may tune how loudly a source is read; a merchandiser JUDGES its output and is the only one who
-- may record a verdict. Neither may write what the detector found.
--
-- ISOLATION INVARIANT I2 IS UNCHANGED AND UNCHANGEABLE: not one `anon` leg appears below, on any
-- of the seven, and `scripts/research/check-research-isolation.mjs` fails the build the moment
-- one does.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- research_changes — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. Detected, never authored. No write policy of any kind: the detector writes
-- these through the service role, and a change row a session could insert is a competitor price
-- move somebody could invent. No anon policy may ever exist on any research_* table (isolation
-- invariant I2). The decision columns are stamped by the same service-role path that writes the
-- append-only action row, so a person decides through an action and never by an UPDATE.
-- read: research.read (owner, admin, merchandiser, researcher, viewer)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_changes_select_staff on research_changes for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

-- No write policy for authenticated: see the deviation note above.

-- ----------------------------------------------------------------------------------------------
-- research_change_rules — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. Configuration, like a URL pattern or a material token: research.write,
-- because a threshold is a parsing decision about how loudly a source is read, not a verdict about
-- a product. Delete is destructive.execute because removing a per-source override silently returns
-- that source to the global default on the next detection pass. No anon policy may ever exist on
-- any research_* table (isolation invariant I2).
-- read: research.read (owner, admin, merchandiser, researcher, viewer)   write: research.write (owner, admin, researcher)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_change_rules_select_staff on research_change_rules for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

create policy research_change_rules_insert_staff on research_change_rules for insert
  to authenticated with check (public.has_role('owner','admin','researcher'));

create policy research_change_rules_update_staff on research_change_rules for update
  to authenticated using  (public.has_role('owner','admin','researcher'))
                with check (public.has_role('owner','admin','researcher'));

create policy research_change_rules_delete_staff on research_change_rules for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- research_review_actions — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. The record of who decided what and why, under research.confirm because every
-- one of the nine FEAT §25 actions is a disposition. No anon policy may ever exist on any
-- research_* table (isolation invariant I2), and no delete policy exists on this one at all: a
-- decision somebody could erase is not an audit trail.
-- read: research.read (owner, admin, merchandiser, researcher, viewer)   write: research.confirm (owner, admin, merchandiser)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_review_actions_select_staff on research_review_actions for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

create policy research_review_actions_insert_staff on research_review_actions for insert
  to authenticated with check (public.has_role('owner','admin','merchandiser'));

-- NO UPDATE POLICY. Append-only, enforced by tg_research_review_actions_append_only(), which
-- refuses every UPDATE except setting undone_by_action_id once from null and refuses DELETE
-- outright. An update policy would describe a path the database will not take, and a generated
-- file is read as a statement of what is possible. The reversal itself is written by the server
-- action through the service role, in the same call that inserts the reversing action.

-- ----------------------------------------------------------------------------------------------
-- research_notes — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. Notes are never deleted, only superseded. research.confirm rather than
-- research.write because a note on a research row is part of the judging conversation, alongside
-- the action it usually accompanies. No anon policy may ever exist on any research_* table (I2).
-- read: research.read (owner, admin, merchandiser, researcher, viewer)   write: research.confirm (owner, admin, merchandiser)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_notes_select_staff on research_notes for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

create policy research_notes_insert_staff on research_notes for insert
  to authenticated with check (public.has_role('owner','admin','merchandiser'));

-- NO UPDATE POLICY. Append-only, enforced by tg_research_notes_append_only(). An edit is a NEW
-- note with superseded_by set on the old one — written by the server action through the service
-- role — because what somebody thought before they changed their mind is the useful half of a note
-- thread.

-- ----------------------------------------------------------------------------------------------
-- research_tags — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. A controlled vocabulary, configuration in exactly the sense
-- research_material_lexicon is. Delete is destructive.execute because the cascade takes the tag
-- off every row it was ever applied to, and a tag that was on forty rows yesterday and nothing
-- today is unrecoverable. No anon policy may ever exist on any research_* table (I2).
-- read: research.read (owner, admin, merchandiser, researcher, viewer)   write: research.write (owner, admin, researcher)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_tags_select_staff on research_tags for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

create policy research_tags_insert_staff on research_tags for insert
  to authenticated with check (public.has_role('owner','admin','researcher'));

create policy research_tags_update_staff on research_tags for update
  to authenticated using  (public.has_role('owner','admin','researcher'))
                with check (public.has_role('owner','admin','researcher'));

create policy research_tags_delete_staff on research_tags for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- research_product_tags — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. Shape C rather than B despite being a join table: shape B derives anon
-- visibility from its parents, and no research_* table has an anon leg to derive from (I2).
-- Applying a tag is a judgement about what a row IS, so research.confirm — and unlike every other
-- table in this phase it takes a DELETE policy, because removing a tag applied in error is the
-- correction, not a rewriting of history: no decision is recorded on this row, the action log
-- holds it.
-- read: research.read (owner, admin, merchandiser, researcher, viewer)   write: research.confirm (owner, admin, merchandiser)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_product_tags_select_staff on research_product_tags for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

create policy research_product_tags_insert_staff on research_product_tags for insert
  to authenticated with check (public.has_role('owner','admin','merchandiser'));

-- NO UPDATE POLICY. A tag is applied or removed, never amended: the composite primary key IS the
-- row, so an UPDATE could only move a tag from one product to another, which is two decisions
-- disguised as one.

create policy research_product_tags_delete_staff on research_product_tags for delete
  to authenticated using (public.has_role('owner','admin','merchandiser'));

-- ----------------------------------------------------------------------------------------------
-- research_change_digests — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. Generated by the digest job under the service role, one row per day, keyed
-- by date so a retried cron slice updates rather than duplicates. No write policy: a hand-edited
-- summary read as a trend is worse than no summary. No anon policy may ever exist on any
-- research_* table (isolation invariant I2).
-- read: research.read (owner, admin, merchandiser, researcher, viewer)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_change_digests_select_staff on research_change_digests for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

-- No write policy for authenticated: see the deviation note above.
