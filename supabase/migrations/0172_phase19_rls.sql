-- 0172_phase19_rls.sql — Phase 19
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for the four customization-form tables migration 0170 creates and `feature_flags`
-- from 0171. GENERATED from lib/auth/table-permissions.ts and rewritten whole, so it may hold
-- nothing a human wrote.
--
-- THE THREE FORM TABLES USE CATALOGUE PERMISSIONS, NOT CONTENT ONES. A form definition is edited
-- at /studio/catalog/customization-forms, is bound to products and categories, and is the same
-- person's work as naming a product — so `catalog.read` / `catalog.write`, which admits the
-- merchandiser and not the editor. Using `content.write` would have inverted that for the one
-- surface whose entire job is asking questions about a product.
--
-- STEPS AND FIELDS CARRY A PARENT TEST. A step is a question; the questions of an unpublished
-- PRESERVATION template are a legible plan of a service not yet offered, readable by anon straight
-- through PostgREST even while the form row itself stays hidden. `product_customization_forms`
-- goes further and tests BOTH ends: without the product and category halves, that table is a list
-- of every unreleased product id the studio has bound a brief to.
--
-- `feature_flags` IS SHAPE C AND ITS READ IS `studio.access`, held by all six roles. That is
-- deliberate: the register of what is switched on is how anyone in the Studio accounts for a
-- surface that is missing, and STUDIO_GUIDE §2.3 explicitly rejected hiding it behind the write
-- permission. Nothing public reads it, and publishing it would hand a visitor the list of features
-- being prepared with the date each one was switched.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- customization_forms — shape A
-- ----------------------------------------------------------------------------------------------
-- read: catalog.read (owner, admin, editor, merchandiser, researcher, viewer)   write: catalog.write (owner, admin, merchandiser)

create policy customization_forms_select_public on customization_forms for select
  to anon, authenticated using (status = 'PUBLISHED');

create policy customization_forms_select_staff on customization_forms for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy customization_forms_insert_staff on customization_forms for insert
  to authenticated with check (public.has_role('owner','admin','merchandiser'));

create policy customization_forms_update_staff on customization_forms for update
  to authenticated using  (public.has_role('owner','admin','merchandiser'))
                with check (public.has_role('owner','admin','merchandiser'));

create policy customization_forms_delete_staff on customization_forms for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- customization_form_steps — shape A
-- ----------------------------------------------------------------------------------------------
-- read: catalog.read (owner, admin, editor, merchandiser, researcher, viewer)   write: catalog.write (owner, admin, merchandiser)

create policy customization_form_steps_select_public on customization_form_steps for select
  to anon, authenticated using (exists (select 1 from customization_forms f
                   where f.id = customization_form_steps.form_id and f.status = 'PUBLISHED'));

create policy customization_form_steps_select_staff on customization_form_steps for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy customization_form_steps_insert_staff on customization_form_steps for insert
  to authenticated with check (public.has_role('owner','admin','merchandiser'));

create policy customization_form_steps_update_staff on customization_form_steps for update
  to authenticated using  (public.has_role('owner','admin','merchandiser'))
                with check (public.has_role('owner','admin','merchandiser'));

create policy customization_form_steps_delete_staff on customization_form_steps for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- customization_form_fields — shape A
-- ----------------------------------------------------------------------------------------------
-- read: catalog.read (owner, admin, editor, merchandiser, researcher, viewer)   write: catalog.write (owner, admin, merchandiser)

create policy customization_form_fields_select_public on customization_form_fields for select
  to anon, authenticated using (exists (select 1 from customization_forms f
                   where f.id = customization_form_fields.form_id and f.status = 'PUBLISHED'));

create policy customization_form_fields_select_staff on customization_form_fields for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy customization_form_fields_insert_staff on customization_form_fields for insert
  to authenticated with check (public.has_role('owner','admin','merchandiser'));

create policy customization_form_fields_update_staff on customization_form_fields for update
  to authenticated using  (public.has_role('owner','admin','merchandiser'))
                with check (public.has_role('owner','admin','merchandiser'));

create policy customization_form_fields_delete_staff on customization_form_fields for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- product_customization_forms — shape B
-- ----------------------------------------------------------------------------------------------
-- read: catalog.read (owner, admin, editor, merchandiser, researcher, viewer)   write: catalog.write (owner, admin, merchandiser)

create policy product_customization_forms_select_public on product_customization_forms for select
  to anon, authenticated using (
    exists (select 1 from customization_forms f
      where f.id = product_customization_forms.form_id and f.status = 'PUBLISHED')
    and (
      product_customization_forms.product_id is null
      or exists (select 1 from products p
          where p.id = product_customization_forms.product_id and p.status = 'PUBLISHED')
    )
    and (
      product_customization_forms.category_id is null
      or exists (select 1 from categories c
          where c.id = product_customization_forms.category_id and c.status = 'PUBLISHED')
    ));

create policy product_customization_forms_select_staff on product_customization_forms for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy product_customization_forms_insert_staff on product_customization_forms for insert
  to authenticated with check (public.has_role('owner','admin','merchandiser'));

create policy product_customization_forms_update_staff on product_customization_forms for update
  to authenticated using  (public.has_role('owner','admin','merchandiser'))
                with check (public.has_role('owner','admin','merchandiser'));

create policy product_customization_forms_delete_staff on product_customization_forms for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- feature_flags — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. No anon policy, and no public read of any kind. A flag is evaluated
-- SERVER-SIDE and the browser is never told a flag exists — it is told markup that is present or
-- absent. Publishing this table would hand every visitor the list of features being prepared,
-- their key names, and the moment each one was switched: an unreleased-roadmap feed with a
-- timestamp. Nothing public needs it, because nothing public reads it.
-- read: studio.access (owner, admin, editor, merchandiser, researcher, viewer)   write: system.flags.write (owner, admin)

-- No anon policy. Shape C tables are never publicly readable.

create policy feature_flags_select_staff on feature_flags for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy feature_flags_insert_staff on feature_flags for insert
  to authenticated with check (public.has_role('owner','admin'));

create policy feature_flags_update_staff on feature_flags for update
  to authenticated using  (public.has_role('owner','admin'))
                with check (public.has_role('owner','admin'));
