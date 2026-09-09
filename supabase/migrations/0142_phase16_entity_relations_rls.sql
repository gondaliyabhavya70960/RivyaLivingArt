-- 0142_phase16_entity_relations_rls.sql — Phase 16
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for `entity_relations`, which migration 0141 creates. Separate from that file for the
-- reason every policy file is separate: this one is GENERATED from lib/auth/table-permissions.ts and
-- is rewritten whole, so it may hold nothing a human wrote.
--
-- `collections` IS NOT HERE. It has carried Phase 04 policies since 0011 and gains no new ones —
-- the columns Phase 16 adds are read and written under the same catalog.read / catalog.write it
-- already had. A policy file is never re-opened once shipped, so the absence is correct rather than
-- an omission.
--
-- entity_relations is SHAPE C: staff-only, no anon policy at all. Its sibling product_relations is
-- shape B with a parent clause testing its source product's status, which works because that
-- table's source is always a product. This one's source is polymorphic — a `source_type` chosen at
-- runtime — and RLS cannot join a table named in a column, so there is no parent clause to write.
-- An unconditional anon read was the alternative, and it would publish an editor's `note` about
-- work that may not be published, plus the existence of edges pointing at drafts.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- entity_relations — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. No anon policy: a polymorphic source cannot be tested by a parent clause,
-- and the row carries an editorial `note` plus the existence of edges to unpublished work. The
-- phase document requires that this table never be publicly readable by itself; the public reads
-- related content through a repository that resolves each target under the target table's own
-- policies, so an unpublished target yields nothing.
-- read: catalog.read (owner, admin, editor, merchandiser, researcher, viewer)   write: catalog.write (owner, admin, merchandiser)

-- No anon policy. Shape C tables are never publicly readable.

create policy entity_relations_select_staff on entity_relations for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy entity_relations_insert_staff on entity_relations for insert
  to authenticated with check (public.has_role('owner','admin','merchandiser'));

create policy entity_relations_update_staff on entity_relations for update
  to authenticated using  (public.has_role('owner','admin','merchandiser'))
                with check (public.has_role('owner','admin','merchandiser'));

create policy entity_relations_delete_staff on entity_relations for delete
  to authenticated using (public.has_role('owner','admin'));
