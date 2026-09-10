-- 0241_phase26_source_config_rls.sql — Phase 26
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for the three source-configuration child tables, which migration 0240 creates.
-- GENERATED from lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human
-- wrote. Its own file for the reason every generated policy file has one: 0240 carries the DDL and
-- a shipped generated file is never re-opened.
--
-- ISOLATION INVARIANT I2 AGAIN, AND IT IS WORTH RESTATING HERE RATHER THAN ASSUMED FROM 0233. One
-- of these three tables holds the first foreign key from the research schema into a public one —
-- `research_source_category_map.category_id` — and the temptation a reader should not have to
-- resist is that a table pointing at `categories` might reasonably be readable wherever
-- `categories` is. It is not. The pointer is Rivya's private reading of a competitor's taxonomy;
-- the direction of the reference says nothing about who may see it.
--
-- ALL THREE ARE `research.write`, NOT `research.confirm`. They are configuration, and
-- configuration is what a researcher operates. The confirm/write split the phase document draws is
-- about columns that carry a DISPOSITION, and no column in these three tables does.
--
-- DELETE IS `destructive.execute` ON ALL THREE, which is stricter than it first looks for the URL
-- patterns: deleting an EXCLUDE row does not remove information, it WIDENS what Rivya will fetch.
-- That is the same class of act as unpublishing live content, and it takes the same permission.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- research_source_url_patterns — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. What a product, category, paginated or never-to-be-fetched URL looks like at
-- one source. No anon policy may ever exist on any research_* table (isolation invariant I2).
-- Delete is destructive.execute because removing an EXCLUDE pattern widens what Rivya will fetch.
-- read: research.read (owner, admin, merchandiser, researcher, viewer)   write: research.write (owner, admin, researcher)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_source_url_patterns_select_staff on research_source_url_patterns for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

create policy research_source_url_patterns_insert_staff on research_source_url_patterns for insert
  to authenticated with check (public.has_role('owner','admin','researcher'));

create policy research_source_url_patterns_update_staff on research_source_url_patterns for update
  to authenticated using  (public.has_role('owner','admin','researcher'))
                with check (public.has_role('owner','admin','researcher'));

create policy research_source_url_patterns_delete_staff on research_source_url_patterns for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- research_source_category_map — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. A staff-authored mapping from a source's own category label to a Rivya
-- category, or an explicit IGNORE. It carries the FIRST of exactly two research → public foreign
-- keys (amendment A26) and still has no anon policy: the pointer is staff configuration, not a
-- reason to publish anything.
-- read: research.read (owner, admin, merchandiser, researcher, viewer)   write: research.write (owner, admin, researcher)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_source_category_map_select_staff on research_source_category_map for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

create policy research_source_category_map_insert_staff on research_source_category_map for insert
  to authenticated with check (public.has_role('owner','admin','researcher'));

create policy research_source_category_map_update_staff on research_source_category_map for update
  to authenticated using  (public.has_role('owner','admin','researcher'))
                with check (public.has_role('owner','admin','researcher'));

create policy research_source_category_map_delete_staff on research_source_category_map for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- research_source_schedules — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. When a job type runs against a source. Staff-only, written by
-- research.write, and bounded at the row by a six-hour minimum interval the form cannot be
-- bypassed to beat.
-- read: research.read (owner, admin, merchandiser, researcher, viewer)   write: research.write (owner, admin, researcher)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_source_schedules_select_staff on research_source_schedules for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

create policy research_source_schedules_insert_staff on research_source_schedules for insert
  to authenticated with check (public.has_role('owner','admin','researcher'));

create policy research_source_schedules_update_staff on research_source_schedules for update
  to authenticated using  (public.has_role('owner','admin','researcher'))
                with check (public.has_role('owner','admin','researcher'));

create policy research_source_schedules_delete_staff on research_source_schedules for delete
  to authenticated using (public.has_role('owner','admin'));
