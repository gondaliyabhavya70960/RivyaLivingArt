-- 0021_rls_policies_phase05.sql — Phase 05
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for the two tables migration 0020 creates. Separate from 0011 because 0011 has shipped:
-- see GENERATED in scripts/auth/gen-role-sql.ts for why a policy file is never re-opened.
--
-- studio_preferences carries an OWNER SCOPE, which is new here. Both its permissions are held by
-- all six roles, so the role list alone grants nothing useful — `user_id = auth.uid()` is what
-- makes it safe, and it is ANDed into the select, insert and update policies alike. An extra
-- SELECT leg would not have done: the danger is one staff member OVERWRITING another's row.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- activity_events — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. Append-only activity feed. No anon policy — an internal record of who
-- changed what is never public — and no authenticated write policy: only the service role inserts,
-- through lib/logging/activity.ts. Update and delete are revoked outright, so a session cannot
-- rewrite the feed even if a policy is added later by mistake.
-- read: activity.read (owner, admin, editor, merchandiser, researcher, viewer)

-- No anon policy. Shape C tables are never publicly readable.

create policy activity_events_select_staff on activity_events for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

-- No write policy for authenticated: see the deviation note above.

-- ----------------------------------------------------------------------------------------------
-- studio_preferences — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. Per-user Studio chrome state, not content. No anon policy. Every role may
-- read and write it, but ONLY their own row — see ownerScope, which is what makes "every role"
-- safe here.
-- read: studio.access (owner, admin, editor, merchandiser, researcher, viewer)   write: studio.access (owner, admin, editor, merchandiser, researcher, viewer)

-- No anon policy. Shape C tables are never publicly readable.

-- OWNER SCOPE. Both permissions above are held by all six roles, so without this narrowing any
-- staff member could read and overwrite everyone else's sidebar state and pinned routes. The scope
-- is what carries the security, not the permission. Wrapped in a sub-select so the planner
-- evaluates auth.uid() once per statement rather than once per row.
create policy studio_preferences_select_staff on studio_preferences for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer') and user_id = (select auth.uid()));

create policy studio_preferences_insert_staff on studio_preferences for insert
  to authenticated with check (public.has_role('owner','admin','editor','merchandiser','researcher','viewer') and user_id = (select auth.uid()));

create policy studio_preferences_update_staff on studio_preferences for update
  to authenticated using  (public.has_role('owner','admin','editor','merchandiser','researcher','viewer') and user_id = (select auth.uid()))
                with check (public.has_role('owner','admin','editor','merchandiser','researcher','viewer') and user_id = (select auth.uid()));
