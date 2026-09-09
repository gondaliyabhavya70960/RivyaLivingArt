-- 0131_phase15_product_specs_rls.sql — Phase 15
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for `product_specs`, which migration 0130 creates. Separate from that file for the
-- reason every policy file is separate: this one is GENERATED from lib/auth/table-permissions.ts and
-- is rewritten whole, so it may hold nothing a human wrote.
--
-- product_specs is shape A with a PARENT TEST FOLDED INTO ITS PUBLIC CLAUSE. A spec row is a
-- sentence about a product — "Seat height · 450 mm" — so a published row hanging off an unpublished
-- product would publish a measurement of a piece the site does not admit exists. The row's own
-- status is therefore not the whole condition, and `publicClause` says so explicitly rather than
-- leaving the parent test to the application that happens to join the two.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- product_specs — shape A
-- ----------------------------------------------------------------------------------------------
-- read: catalog.read (owner, admin, editor, merchandiser, researcher, viewer)   write: catalog.write (owner, admin, merchandiser)

create policy product_specs_select_public on product_specs for select
  to anon, authenticated using (status = 'PUBLISHED'
      and exists (select 1 from products p
                   where p.id = product_specs.product_id and p.status = 'PUBLISHED'));

create policy product_specs_select_staff on product_specs for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy product_specs_insert_staff on product_specs for insert
  to authenticated with check (public.has_role('owner','admin','merchandiser'));

create policy product_specs_update_staff on product_specs for update
  to authenticated using  (public.has_role('owner','admin','merchandiser'))
                with check (public.has_role('owner','admin','merchandiser'));

create policy product_specs_delete_staff on product_specs for delete
  to authenticated using (public.has_role('owner','admin'));
