-- 0301_phase32_opportunity_rls.sql — Phase 32
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for the three tables migration 0300 creates. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote.
--
--   `research_scoring_models`         research.score.manage — owner and admin only. The weights
--                                      decide which competitor rows sort first, and the phase
--                                      document's named risk is weights quietly tuned until a
--                                      favoured row ranks first. Readable by research.read.
--
--   `research_opportunity_scores`     NO SESSION WRITE POLICY AT ALL. A score a session could
--   `research_opportunity_components` insert is a rank somebody typed. The CLI, the cron and the
--                                      Studio recompute action write through the service role.
--
-- ISOLATION INVARIANT I2 IS UNCHANGED: not one `anon` leg appears below.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- research_scoring_models — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. Versioned scoring models. research.score.manage (owner, admin) because the
-- weights decide which competitor rows sort first. No anon policy may ever exist on any research_*
-- table (I2).
-- read: research.read (owner, admin, merchandiser, researcher, viewer)   write: research.score.manage (owner, admin)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_scoring_models_select_staff on research_scoring_models for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

create policy research_scoring_models_insert_staff on research_scoring_models for insert
  to authenticated with check (public.has_role('owner','admin'));

create policy research_scoring_models_update_staff on research_scoring_models for update
  to authenticated using  (public.has_role('owner','admin'))
                with check (public.has_role('owner','admin'));

create policy research_scoring_models_delete_staff on research_scoring_models for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- research_opportunity_scores — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. One score per (product, model, moment). Service-role writes only: a score a
-- session could insert is a rank somebody typed. No anon policy (I2).
-- read: research.read (owner, admin, merchandiser, researcher, viewer)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_opportunity_scores_select_staff on research_opportunity_scores for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

-- No write policy for authenticated: see the deviation note above.

-- ----------------------------------------------------------------------------------------------
-- research_opportunity_components — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. The arithmetic behind a score, one row per signal. Service-role writes only,
-- with its score. No anon policy (I2).
-- read: research.read (owner, admin, merchandiser, researcher, viewer)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_opportunity_components_select_staff on research_opportunity_components for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

-- No write policy for authenticated: see the deviation note above.
