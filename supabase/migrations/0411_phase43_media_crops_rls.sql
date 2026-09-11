-- 0411_phase43_media_crops_rls.sql — Phase 43
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for the one table migration 0410 creates. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote.
--
--   `media_crops`  Shape B under `media_assets`. A crop has no status of its own — it is a note
--                  about how to deliver a picture — so it is public exactly when the picture is,
--                  and the anon leg is load-bearing rather than incidental: the public renderer
--                  resolves the crop before it builds the delivery URL, so without it every
--                  visitor would silently get the uncropped master while the Studio, reading under
--                  a staff session, showed the crop working. Write and DELETE are both
--                  `media.write`: removing a crop destroys no history and loses nothing but a
--                  preference, so it is not a destructive act.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- media_crops — shape B
-- ----------------------------------------------------------------------------------------------
-- read: media.read (owner, admin, editor, merchandiser, researcher, viewer)   write: media.write (owner, admin, editor, merchandiser)

create policy media_crops_select_public on media_crops for select
  to anon, authenticated using (
    exists (select 1 from media_assets a
             where a.id = media_crops.media_asset_id and a.status = 'PUBLISHED'));

create policy media_crops_select_staff on media_crops for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy media_crops_insert_staff on media_crops for insert
  to authenticated with check (public.has_role('owner','admin','editor','merchandiser'));

create policy media_crops_update_staff on media_crops for update
  to authenticated using  (public.has_role('owner','admin','editor','merchandiser'))
                with check (public.has_role('owner','admin','editor','merchandiser'));

create policy media_crops_delete_staff on media_crops for delete
  to authenticated using (public.has_role('owner','admin','editor','merchandiser'));
