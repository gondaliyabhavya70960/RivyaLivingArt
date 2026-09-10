-- 0214_phase23_relations_rls.sql — Phase 23
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for `content_relations`, `relation_suppressions` and `product_attribute_terms`,
-- which migration 0213 creates. GENERATED from lib/auth/table-permissions.ts and rewritten whole,
-- so it may hold nothing a human wrote.
--
-- A SECOND GENERATED FILE FOR ONE PHASE, because a generated file is rewritten whole and therefore
-- cannot also carry the DDL that creates its tables. 0212 covers the search index; this covers the
-- relation tables 0213 adds. Phase 19 did the same with 0172 and 0183.
--
-- `content_relations` IS SHAPE B ON A POLYMORPHIC PARENT, so its public clause is three
-- exists-tests — one per source type — rather than one. An edge is visible exactly when the row it
-- hangs off is published; the TARGET is not tested here, because an edge to an unpublished product
-- must resolve to nothing rather than to a broken link and that filter belongs in the repository,
-- where it also serves the Studio preview this policy does not apply to.
--
-- `relation_suppressions` IS STAFF-ONLY. It records what an editor decided NOT to connect, which
-- is a view of the editing process rather than of the catalogue.
--
-- `product_attribute_terms` IS ORDINARY SHAPE-A CONTENT and ships with zero rows. What stops a
-- term reaching a visitor is not this policy but the D10 gate on the row: it defaults to
-- OWNER_VERIFICATION_REQUIRED and cannot be PUBLISHED until somebody with `content.verify` says
-- the workshop really works in it.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- content_relations — shape B
-- ----------------------------------------------------------------------------------------------
-- read: catalog.read (owner, admin, editor, merchandiser, researcher, viewer)   write: catalog.write (owner, admin, merchandiser)

create policy content_relations_select_public on content_relations for select
  to anon, authenticated using (
    (source_type = 'portfolio_project'
              and exists (select 1 from portfolio_projects pp
                           where pp.id = content_relations.source_id and pp.status = 'PUBLISHED'))
          or (source_type = 'journal_article'
              and exists (select 1 from journal_articles ja
                           where ja.id = content_relations.source_id and ja.status = 'PUBLISHED'))
          or (source_type = 'collection'
              and exists (select 1 from collections c
                           where c.id = content_relations.source_id and c.status = 'PUBLISHED')));

create policy content_relations_select_staff on content_relations for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy content_relations_insert_staff on content_relations for insert
  to authenticated with check (public.has_role('owner','admin','merchandiser'));

create policy content_relations_update_staff on content_relations for update
  to authenticated using  (public.has_role('owner','admin','merchandiser'))
                with check (public.has_role('owner','admin','merchandiser'));

create policy content_relations_delete_staff on content_relations for delete
  to authenticated using (public.has_role('owner','admin','merchandiser'));

-- ----------------------------------------------------------------------------------------------
-- relation_suppressions — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. An editorial judgement about what NOT to connect. Never publicly readable:
-- it would tell a visitor which relationships were considered and refused, which is a view of the
-- editing process rather than of the catalogue.
-- read: catalog.read (owner, admin, editor, merchandiser, researcher, viewer)   write: catalog.write (owner, admin, merchandiser)

-- No anon policy. Shape C tables are never publicly readable.

create policy relation_suppressions_select_staff on relation_suppressions for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy relation_suppressions_insert_staff on relation_suppressions for insert
  to authenticated with check (public.has_role('owner','admin','merchandiser'));

create policy relation_suppressions_update_staff on relation_suppressions for update
  to authenticated using  (public.has_role('owner','admin','merchandiser'))
                with check (public.has_role('owner','admin','merchandiser'));

create policy relation_suppressions_delete_staff on relation_suppressions for delete
  to authenticated using (public.has_role('owner','admin','merchandiser'));

-- ----------------------------------------------------------------------------------------------
-- product_attribute_terms — shape A
-- ----------------------------------------------------------------------------------------------
-- read: catalog.read (owner, admin, editor, merchandiser, researcher, viewer)   write: catalog.write (owner, admin, merchandiser)

create policy product_attribute_terms_select_public on product_attribute_terms for select
  to anon, authenticated using (status = 'PUBLISHED');

create policy product_attribute_terms_select_staff on product_attribute_terms for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy product_attribute_terms_insert_staff on product_attribute_terms for insert
  to authenticated with check (public.has_role('owner','admin','merchandiser'));

create policy product_attribute_terms_update_staff on product_attribute_terms for update
  to authenticated using  (public.has_role('owner','admin','merchandiser'))
                with check (public.has_role('owner','admin','merchandiser'));

create policy product_attribute_terms_delete_staff on product_attribute_terms for delete
  to authenticated using (public.has_role('owner','admin'));
