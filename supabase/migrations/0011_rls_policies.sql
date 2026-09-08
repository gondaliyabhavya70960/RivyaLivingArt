-- 0011_rls_policies.sql — Phase 04
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Every staff-select role list below is the set of roles holding that table's *.read permission.
-- That equality is the rule this phase exists to make unbreakable: scripts/auth/check-rls.ts reads
-- pg_policies back out of the migrated database and fails when a policy's list has drifted from
-- the matrix, when a public table is missing from table-permissions.ts, or when a table matches
-- none of Shape A, Shape B or a declared deviation.
--
-- Until this migration runs, every table has RLS enabled with NO policy — which denies everything
-- to anon and authenticated. This file is where access is granted deliberately, for the first time.
--
-- Note what is NOT here: `force row level security`. Adding it would also subject the seed runner
-- and every RLS-SERVICE writer to these policies, which DATA_MODEL deliberately does not intend.
-- The service role bypasses RLS by role attribute, and that is the designed escape hatch.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- categories — shape A
-- ----------------------------------------------------------------------------------------------
-- read: catalog.read (owner, admin, editor, merchandiser, researcher, viewer)   write: catalog.write (owner, admin, merchandiser)

create policy categories_select_public on categories for select
  to anon, authenticated using (status = 'PUBLISHED');

create policy categories_select_staff on categories for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy categories_insert_staff on categories for insert
  to authenticated with check (public.has_role('owner','admin','merchandiser'));

create policy categories_update_staff on categories for update
  to authenticated using  (public.has_role('owner','admin','merchandiser'))
                with check (public.has_role('owner','admin','merchandiser'));

create policy categories_delete_staff on categories for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- collections — shape A
-- ----------------------------------------------------------------------------------------------
-- read: catalog.read (owner, admin, editor, merchandiser, researcher, viewer)   write: catalog.write (owner, admin, merchandiser)

create policy collections_select_public on collections for select
  to anon, authenticated using (status = 'PUBLISHED');

create policy collections_select_staff on collections for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy collections_insert_staff on collections for insert
  to authenticated with check (public.has_role('owner','admin','merchandiser'));

create policy collections_update_staff on collections for update
  to authenticated using  (public.has_role('owner','admin','merchandiser'))
                with check (public.has_role('owner','admin','merchandiser'));

create policy collections_delete_staff on collections for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- materials — shape A
-- ----------------------------------------------------------------------------------------------
-- read: catalog.read (owner, admin, editor, merchandiser, researcher, viewer)   write: catalog.write (owner, admin, merchandiser)

create policy materials_select_public on materials for select
  to anon, authenticated using (status = 'PUBLISHED');

create policy materials_select_staff on materials for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy materials_insert_staff on materials for insert
  to authenticated with check (public.has_role('owner','admin','merchandiser'));

create policy materials_update_staff on materials for update
  to authenticated using  (public.has_role('owner','admin','merchandiser'))
                with check (public.has_role('owner','admin','merchandiser'));

create policy materials_delete_staff on materials for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- products — shape A
-- ----------------------------------------------------------------------------------------------
-- read: catalog.read (owner, admin, editor, merchandiser, researcher, viewer)   write: catalog.write (owner, admin, merchandiser)

create policy products_select_public on products for select
  to anon, authenticated using (status = 'PUBLISHED');

create policy products_select_staff on products for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy products_insert_staff on products for insert
  to authenticated with check (public.has_role('owner','admin','merchandiser'));

create policy products_update_staff on products for update
  to authenticated using  (public.has_role('owner','admin','merchandiser'))
                with check (public.has_role('owner','admin','merchandiser'));

create policy products_delete_staff on products for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- media_assets — shape A
-- ----------------------------------------------------------------------------------------------
-- read: media.read (owner, admin, editor, merchandiser, researcher, viewer)   write: media.write (owner, admin, editor, merchandiser)

create policy media_assets_select_public on media_assets for select
  to anon, authenticated using (status = 'PUBLISHED');

create policy media_assets_select_staff on media_assets for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy media_assets_insert_staff on media_assets for insert
  to authenticated with check (public.has_role('owner','admin','editor','merchandiser'));

create policy media_assets_update_staff on media_assets for update
  to authenticated using  (public.has_role('owner','admin','editor','merchandiser'))
                with check (public.has_role('owner','admin','editor','merchandiser'));

create policy media_assets_delete_staff on media_assets for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- product_collections — shape B
-- ----------------------------------------------------------------------------------------------
-- read: catalog.read (owner, admin, editor, merchandiser, researcher, viewer)   write: catalog.write (owner, admin, merchandiser)

create policy product_collections_select_public on product_collections for select
  to anon, authenticated using (
    exists (select 1 from products p
             where p.id = product_collections.product_id and p.status = 'PUBLISHED')
    and exists (select 1 from collections c
             where c.id = product_collections.collection_id and c.status = 'PUBLISHED'));

create policy product_collections_select_staff on product_collections for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy product_collections_insert_staff on product_collections for insert
  to authenticated with check (public.has_role('owner','admin','merchandiser'));

create policy product_collections_update_staff on product_collections for update
  to authenticated using  (public.has_role('owner','admin','merchandiser'))
                with check (public.has_role('owner','admin','merchandiser'));

create policy product_collections_delete_staff on product_collections for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- product_materials — shape B
-- ----------------------------------------------------------------------------------------------
-- read: catalog.read (owner, admin, editor, merchandiser, researcher, viewer)   write: catalog.write (owner, admin, merchandiser)

create policy product_materials_select_public on product_materials for select
  to anon, authenticated using (
    exists (select 1 from products p
             where p.id = product_materials.product_id and p.status = 'PUBLISHED')
    and exists (select 1 from materials m
             where m.id = product_materials.material_id and m.status = 'PUBLISHED'));

create policy product_materials_select_staff on product_materials for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy product_materials_insert_staff on product_materials for insert
  to authenticated with check (public.has_role('owner','admin','merchandiser'));

create policy product_materials_update_staff on product_materials for update
  to authenticated using  (public.has_role('owner','admin','merchandiser'))
                with check (public.has_role('owner','admin','merchandiser'));

create policy product_materials_delete_staff on product_materials for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- product_media — shape B
-- ----------------------------------------------------------------------------------------------
-- read: catalog.read (owner, admin, editor, merchandiser, researcher, viewer)   write: catalog.write (owner, admin, merchandiser)

create policy product_media_select_public on product_media for select
  to anon, authenticated using (
    exists (select 1 from products p
             where p.id = product_media.product_id and p.status = 'PUBLISHED'));

create policy product_media_select_staff on product_media for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy product_media_insert_staff on product_media for insert
  to authenticated with check (public.has_role('owner','admin','merchandiser'));

create policy product_media_update_staff on product_media for update
  to authenticated using  (public.has_role('owner','admin','merchandiser'))
                with check (public.has_role('owner','admin','merchandiser'));

create policy product_media_delete_staff on product_media for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- product_relations — shape B
-- ----------------------------------------------------------------------------------------------
-- read: catalog.read (owner, admin, editor, merchandiser, researcher, viewer)   write: catalog.write (owner, admin, merchandiser)

create policy product_relations_select_public on product_relations for select
  to anon, authenticated using (
    exists (select 1 from products p
             where p.id = product_relations.source_product_id and p.status = 'PUBLISHED'));

create policy product_relations_select_staff on product_relations for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy product_relations_insert_staff on product_relations for insert
  to authenticated with check (public.has_role('owner','admin','merchandiser'));

create policy product_relations_update_staff on product_relations for update
  to authenticated using  (public.has_role('owner','admin','merchandiser'))
                with check (public.has_role('owner','admin','merchandiser'));

create policy product_relations_delete_staff on product_relations for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- staff_profiles — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. No anon policy: staff identity is never public. Carries an extra self-select
-- leg that is by construction not derivable from any *.read permission, so it is declared rather
-- than generated. This is the table current_staff_role() reads, so its policies must not recurse.
-- read: system.users.manage (owner, admin)   write: system.users.manage (owner, admin)

-- No anon policy. Shape C tables are never publicly readable.

create policy staff_profiles_select_staff on staff_profiles for select
  to authenticated using (public.has_role('owner','admin'));

-- A staff member must be able to read their own row — the Studio shell shows their name and role.
-- Written as a bare uid comparison rather than through has_role() so it cannot recurse into the
-- very table the role lookup reads.
create policy staff_profiles_select_self on staff_profiles for select
  to authenticated using (user_id = auth.uid());

create policy staff_profiles_insert_staff on staff_profiles for insert
  to authenticated with check (public.has_role('owner','admin'));

create policy staff_profiles_update_staff on staff_profiles for update
  to authenticated using  (public.has_role('owner','admin'))
                with check (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- content_seed_runs — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. Run record, not content. No anon policy and no authenticated write policy:
-- the seed runner connects over DATABASE_URL and bypasses RLS entirely, so granting a session
-- write access here would add reach without adding capability. DATA_MODEL classifies it
-- RLS-SERVICE.
-- read: operations.logs.read (owner, admin)

-- No anon policy. Shape C tables are never publicly readable.

create policy content_seed_runs_select_staff on content_seed_runs for select
  to authenticated using (public.has_role('owner','admin'));

-- No write policy for authenticated: see the deviation note above.
