-- 0321_phase34_direction_rls.sql — Phase 34
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for the three tables migration 0320 creates. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote.
--
--   `research_direction_briefs`           research.direction.write — owner, admin, merchandiser,
--                                          researcher. A person's document. Moving it INTO
--                                          APPROVED is gated again, on research.direction.approve,
--                                          by guard_direction_brief_approval() in 0320. No delete
--                                          leg: a brief is ARCHIVED, never removed.
--
--   `research_direction_brief_evidence`  research.direction.write attaches and detaches; every
--                                          row carries a non-empty rationale by CHECK.
--
--   `research_direction_brief_revisions` NO SESSION WRITE OF ANY KIND. The trigger writes them
--                                          as SECURITY DEFINER; restore goes through
--                                          research_restore_brief_revision(), which re-checks the
--                                          write permission inside.
--
-- PUBLISHED IS UNREACHABLE: the CHECK on research_direction_briefs.status admits four values and
-- not that one, so no policy here could ever admit a public read. ISOLATION INVARIANT I2 IS
-- UNCHANGED: not one `anon` leg appears below.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- research_direction_briefs — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. A human-written internal brief. research.direction.write inserts and edits;
-- APPROVED is additionally gated by trigger on research.direction.approve. Never deleted
-- (ARCHIVED), never PUBLISHED, no anon policy (I2).
-- read: research.read (owner, admin, merchandiser, researcher, viewer)   write: research.direction.write (owner, admin, merchandiser, researcher)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_direction_briefs_select_staff on research_direction_briefs for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

create policy research_direction_briefs_insert_staff on research_direction_briefs for insert
  to authenticated with check (public.has_role('owner','admin','merchandiser','researcher'));

create policy research_direction_briefs_update_staff on research_direction_briefs for update
  to authenticated using  (public.has_role('owner','admin','merchandiser','researcher'))
                with check (public.has_role('owner','admin','merchandiser','researcher'));

-- ----------------------------------------------------------------------------------------------
-- research_direction_brief_evidence — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. Typed evidence with a captured value and a non-empty rationale. Attached and
-- detached under research.direction.write. No anon policy (I2).
-- read: research.read (owner, admin, merchandiser, researcher, viewer)   write: research.direction.write (owner, admin, merchandiser, researcher)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_direction_brief_evidence_select_staff on research_direction_brief_evidence for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

create policy research_direction_brief_evidence_insert_staff on research_direction_brief_evidence for insert
  to authenticated with check (public.has_role('owner','admin','merchandiser','researcher'));

create policy research_direction_brief_evidence_update_staff on research_direction_brief_evidence for update
  to authenticated using  (public.has_role('owner','admin','merchandiser','researcher'))
                with check (public.has_role('owner','admin','merchandiser','researcher'));

create policy research_direction_brief_evidence_delete_staff on research_direction_brief_evidence for delete
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher'));

-- ----------------------------------------------------------------------------------------------
-- research_direction_brief_revisions — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. An immutable snapshot per save, written by write_direction_brief_revision()
-- (SECURITY DEFINER) and restored through research_restore_brief_revision(). No session write,
-- update or delete leg: history the people it records could edit is not an audit trail. No anon
-- policy (I2).
-- read: research.read (owner, admin, merchandiser, researcher, viewer)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_direction_brief_revisions_select_staff on research_direction_brief_revisions for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

-- No write policy for authenticated: see the deviation note above.
