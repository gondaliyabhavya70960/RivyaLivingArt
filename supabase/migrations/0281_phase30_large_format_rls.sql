-- 0281_phase30_large_format_rls.sql — Phase 30
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for the two tables migration 0280 creates. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote.
--
-- TWO TABLES, AND THEY ARE AS DIFFERENT AS TWO RESEARCH TABLES GET.
--
--   `research_large_format_rules`  research.write — CONFIGURATION, exactly as the material lexicon
--                                   and the change thresholds are. A scale band says what KIND of
--                                   object a page describes; it carries no disposition meaning, and
--                                   this phase requires `research.confirm` for nothing at all.
--
--   `research_saved_views`         research.read, NARROWED TO THE OWNER. The one research table
--                                   whose rows belong to individual people. Five of the six roles
--                                   hold `research.read`, so the SCOPE carries the security here
--                                   rather than the permission — without it any of them could
--                                   rewrite everyone else's views.
--
-- THE SHARED LEG IS A SECOND SELECT POLICY, NOT A WIDENED SCOPE. Sharing widens who may READ one
-- row and must not widen who may edit it: a view somebody else can edit is a view whose results
-- change under the person who linked to it.
--
-- ISOLATION INVARIANT I2 IS UNCHANGED: not one `anon` leg appears below, on either table.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- research_large_format_rules — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. An ordered rule set, first match wins, editable in Studio so a threshold is
-- tuned without a deploy. research.write rather than research.confirm because a scale band is a
-- classification and not a verdict. Delete is destructive.execute because removing a rule silently
-- re-bands every row the next reclassification touches. No anon policy may ever exist on any
-- research_* table (isolation invariant I2).
-- read: research.read (owner, admin, merchandiser, researcher, viewer)   write: research.write (owner, admin, researcher)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_large_format_rules_select_staff on research_large_format_rules for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

create policy research_large_format_rules_insert_staff on research_large_format_rules for insert
  to authenticated with check (public.has_role('owner','admin','researcher'));

create policy research_large_format_rules_update_staff on research_large_format_rules for update
  to authenticated using  (public.has_role('owner','admin','researcher'))
                with check (public.has_role('owner','admin','researcher'));

create policy research_large_format_rules_delete_staff on research_large_format_rules for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- research_saved_views — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. The one research table whose rows belong to individual people. Readable by
-- its owner and, when shared, by anyone holding research.read; writable only by its owner. No anon
-- policy may ever exist on any research_* table (isolation invariant I2).
-- read: research.read (owner, admin, merchandiser, researcher, viewer)   write: research.read (owner, admin, merchandiser, researcher, viewer)

-- No anon policy. Shape C tables are never publicly readable.

-- OWNER SCOPE. A saved view belongs to the person who saved it. research.read is held by five of
-- the six roles, so without this narrowing any of them could rewrite or delete everyone else's
-- views — the scope is what carries the security, not the permission. Wrapped in a sub-select so
-- the planner evaluates auth.uid() once per statement rather than once per row, the same shape
-- staff_preferences uses.
create policy research_saved_views_select_staff on research_saved_views for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer') and owner_user_id = (select auth.uid()));

-- Sharing widens who may READ one row and must not widen who may edit it. A second SELECT leg says
-- exactly that; folding it into the owner scope would make every shared view editable by
-- everybody, and a view somebody else can edit is a view whose results change under the person who
-- linked to it.
create policy research_saved_views_select_shared on research_saved_views for select
  to authenticated using (is_shared = true and public.has_role('owner','admin','merchandiser','researcher','viewer'));

create policy research_saved_views_insert_staff on research_saved_views for insert
  to authenticated with check (public.has_role('owner','admin','merchandiser','researcher','viewer') and owner_user_id = (select auth.uid()));

create policy research_saved_views_update_staff on research_saved_views for update
  to authenticated using  (public.has_role('owner','admin','merchandiser','researcher','viewer') and owner_user_id = (select auth.uid()))
                with check (public.has_role('owner','admin','merchandiser','researcher','viewer') and owner_user_id = (select auth.uid()));

create policy research_saved_views_delete_staff on research_saved_views for delete
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer') and owner_user_id = (select auth.uid()));
