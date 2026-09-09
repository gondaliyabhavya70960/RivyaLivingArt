-- 0151_phase17_portfolio_rls.sql — Phase 17
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for `portfolio_projects`, `portfolio_project_media` and `testimonials`, which
-- migration 0150 creates. Separate from that file for the reason every policy file is separate:
-- this one is GENERATED from lib/auth/table-permissions.ts and is rewritten whole, so it may hold
-- nothing a human wrote.
--
-- ALL THREE ARE SHAPE A, AND THE PUBLIC CLAUSE IS DELIBERATELY THIN. `status = 'PUBLISHED'` is the
-- whole test on a project and on a testimonial, because the two rules that actually matter — the
-- owner has verified this happened, and anyone the row names has consented to be named — are
-- enforced by `enforce_project_evidence_gate()` and `enforce_testimonial_evidence_gate()` at the
-- moment of publication. A row cannot REACH published without satisfying them, so re-testing
-- `owner_verification` here would be a second copy of a rule that could drift from the trigger.
--
-- `portfolio_project_media` DOES carry a parent test, matching `product_specs`: the photographs
-- of an unpublished project must not be readable, or the existence and the contents of unannounced
-- work leak through the join even while the project row itself stays hidden.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- portfolio_projects — shape A
-- ----------------------------------------------------------------------------------------------
-- read: content.read (owner, admin, editor, merchandiser, researcher, viewer)   write: content.write (owner, admin, editor)

create policy portfolio_projects_select_public on portfolio_projects for select
  to anon, authenticated using (status = 'PUBLISHED');

create policy portfolio_projects_select_staff on portfolio_projects for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy portfolio_projects_insert_staff on portfolio_projects for insert
  to authenticated with check (public.has_role('owner','admin','editor'));

create policy portfolio_projects_update_staff on portfolio_projects for update
  to authenticated using  (public.has_role('owner','admin','editor'))
                with check (public.has_role('owner','admin','editor'));

create policy portfolio_projects_delete_staff on portfolio_projects for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- portfolio_project_media — shape A
-- ----------------------------------------------------------------------------------------------
-- read: content.read (owner, admin, editor, merchandiser, researcher, viewer)   write: content.write (owner, admin, editor)

create policy portfolio_project_media_select_public on portfolio_project_media for select
  to anon, authenticated using (exists (select 1 from portfolio_projects p
                   where p.id = portfolio_project_media.project_id and p.status = 'PUBLISHED'));

create policy portfolio_project_media_select_staff on portfolio_project_media for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy portfolio_project_media_insert_staff on portfolio_project_media for insert
  to authenticated with check (public.has_role('owner','admin','editor'));

create policy portfolio_project_media_update_staff on portfolio_project_media for update
  to authenticated using  (public.has_role('owner','admin','editor'))
                with check (public.has_role('owner','admin','editor'));

create policy portfolio_project_media_delete_staff on portfolio_project_media for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- testimonials — shape A
-- ----------------------------------------------------------------------------------------------
-- read: content.read (owner, admin, editor, merchandiser, researcher, viewer)   write: content.write (owner, admin, editor)

create policy testimonials_select_public on testimonials for select
  to anon, authenticated using (status = 'PUBLISHED');

create policy testimonials_select_staff on testimonials for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy testimonials_insert_staff on testimonials for insert
  to authenticated with check (public.has_role('owner','admin','editor'));

create policy testimonials_update_staff on testimonials for update
  to authenticated using  (public.has_role('owner','admin','editor'))
                with check (public.has_role('owner','admin','editor'));

create policy testimonials_delete_staff on testimonials for delete
  to authenticated using (public.has_role('owner','admin'));
