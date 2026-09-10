-- 0201_phase22_merchandising_rls.sql — Phase 22
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for `merchandising_slots` and `merchandising_entries`, which migration 0200 creates.
-- GENERATED from lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human
-- wrote.
--
-- THE PUBLIC RESOLVER READS WITH THE ANON KEY, so both tables are shape A rather than staff-only:
-- a slot is readable while PUBLISHED, and an entry only while PUBLISHED, inside its half-open
-- window, AND inside a PUBLISHED slot. The window is part of the clause for the reason it is on
-- `page_sections`: a plan readable the moment it is saved makes scheduling decorative.
--
-- WRITES ARE `merchandising.write` (owner, admin, merchandiser) ON BOTH, and removing an entry is
-- the same permission — curation, not destruction. Removing a SLOT is `destructive.execute`:
-- nothing in the Studio does it, because a slot nothing reads is a dead end.
--
-- WHAT THE POLICY DOES NOT DECIDE. Whether an entry names a type its slot admits, whether the entity
-- exists, and whether a collection is still a concept are all `guard_merchandising_entry()` on the
-- row (0200). None is an access question, so none is here.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- merchandising_slots — shape A
-- ----------------------------------------------------------------------------------------------
-- read: catalog.read (owner, admin, editor, merchandiser, researcher, viewer)   write: merchandising.write (owner, admin, merchandiser)

create policy merchandising_slots_select_public on merchandising_slots for select
  to anon, authenticated using (status = 'PUBLISHED');

create policy merchandising_slots_select_staff on merchandising_slots for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy merchandising_slots_insert_staff on merchandising_slots for insert
  to authenticated with check (public.has_role('owner','admin','merchandiser'));

create policy merchandising_slots_update_staff on merchandising_slots for update
  to authenticated using  (public.has_role('owner','admin','merchandiser'))
                with check (public.has_role('owner','admin','merchandiser'));

create policy merchandising_slots_delete_staff on merchandising_slots for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- merchandising_entries — shape A
-- ----------------------------------------------------------------------------------------------
-- read: catalog.read (owner, admin, editor, merchandiser, researcher, viewer)   write: merchandising.write (owner, admin, merchandiser)

create policy merchandising_entries_select_public on merchandising_entries for select
  to anon, authenticated using (status = 'PUBLISHED'
      and (publish_at is null or publish_at <= now())
      and (unpublish_at is null or unpublish_at > now())
      and exists (select 1 from merchandising_slots s
                   where s.id = merchandising_entries.slot_id and s.status = 'PUBLISHED'));

create policy merchandising_entries_select_staff on merchandising_entries for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy merchandising_entries_insert_staff on merchandising_entries for insert
  to authenticated with check (public.has_role('owner','admin','merchandiser'));

create policy merchandising_entries_update_staff on merchandising_entries for update
  to authenticated using  (public.has_role('owner','admin','merchandiser'))
                with check (public.has_role('owner','admin','merchandiser'));

create policy merchandising_entries_delete_staff on merchandising_entries for delete
  to authenticated using (public.has_role('owner','admin','merchandiser'));
