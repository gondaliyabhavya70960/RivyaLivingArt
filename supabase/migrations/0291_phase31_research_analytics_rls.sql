-- 0291_phase31_research_analytics_rls.sql — Phase 31
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for the four tables migration 0290 creates. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote.
--
-- FOUR TABLES IN TWO POSTURES, AND THE POSTURE ANSWERS ONE QUESTION: WHO MAY WRITE.
--
--   `research_comparison_sets`      research.write — a PERSON'S WORKSPACE. A named selection of
--   `research_comparison_members`   sources and rows a researcher builds and recomputes. Choosing
--                                    rows to look at judges none of them, so this is the operating
--                                    half of the Phase 04 split and not `research.confirm`.
--
--   `research_analytics_snapshots`  NO SESSION WRITE POLICY AT ALL. A snapshot a session could
--   `research_metric_coverage`      insert is a market figure nobody computed, sitting in the
--                                    dashboard beside the ones that were. The CLI, the cron and the
--                                    Studio recompute action write through the service role.
--
-- ISOLATION INVARIANT I2 IS UNCHANGED: not one `anon` leg appears below, on any of the four.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- research_comparison_sets — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. A named comparison set a researcher owns. research.write because choosing
-- rows to look at judges none of them; delete is the same permission because a set is a saved
-- question, not evidence. No anon policy may ever exist on any research_* table (isolation
-- invariant I2).
-- read: research.read (owner, admin, merchandiser, researcher, viewer)   write: research.write (owner, admin, researcher)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_comparison_sets_select_staff on research_comparison_sets for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

create policy research_comparison_sets_insert_staff on research_comparison_sets for insert
  to authenticated with check (public.has_role('owner','admin','researcher'));

create policy research_comparison_sets_update_staff on research_comparison_sets for update
  to authenticated using  (public.has_role('owner','admin','researcher'))
                with check (public.has_role('owner','admin','researcher'));

create policy research_comparison_sets_delete_staff on research_comparison_sets for delete
  to authenticated using (public.has_role('owner','admin','researcher'));

-- ----------------------------------------------------------------------------------------------
-- research_comparison_members — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. One member of a comparison set — a whole source or one research product.
-- Same posture as its set. No anon policy may ever exist on any research_* table (isolation
-- invariant I2).
-- read: research.read (owner, admin, merchandiser, researcher, viewer)   write: research.write (owner, admin, researcher)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_comparison_members_select_staff on research_comparison_members for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

create policy research_comparison_members_insert_staff on research_comparison_members for insert
  to authenticated with check (public.has_role('owner','admin','researcher'));

create policy research_comparison_members_update_staff on research_comparison_members for update
  to authenticated using  (public.has_role('owner','admin','researcher'))
                with check (public.has_role('owner','admin','researcher'));

create policy research_comparison_members_delete_staff on research_comparison_members for delete
  to authenticated using (public.has_role('owner','admin','researcher'));

-- ----------------------------------------------------------------------------------------------
-- research_analytics_snapshots — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. A computed result with its denominator. No session write: a snapshot a
-- session could insert is a market figure nobody computed, indistinguishable from one that was.
-- Written by the service role only — CLI, cron, and the Studio recompute action, which records who
-- asked.
-- read: research.read (owner, admin, merchandiser, researcher, viewer)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_analytics_snapshots_select_staff on research_analytics_snapshots for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

-- No write policy for authenticated: see the deviation note above.

-- ----------------------------------------------------------------------------------------------
-- research_metric_coverage — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. n, denominator and per-reason exclusions for one metric of one snapshot.
-- Service-role writes only, with its snapshot. No anon policy (isolation invariant I2).
-- read: research.read (owner, admin, merchandiser, researcher, viewer)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_metric_coverage_select_staff on research_metric_coverage for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

-- No write policy for authenticated: see the deviation note above.
