-- 0195_phase21_model_rls.sql — Phase 21
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for `model_variant_labels`, which migration 0194 creates. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote.
--
-- SHAPE B ON A MEDIA PARENT. A label has no status of its own: it is public exactly when the model
-- it names is PUBLISHED, and never on its own — a switch here would be a second switch that could
-- disagree with the first. Writes mirror `media_assets`: `media.write` to add or edit a label,
-- `media.delete` to remove one.
--
-- WHAT THE POLICY DOES NOT DECIDE. Whether a label may carry a `material_id` is a CHECK on the
-- row (a material forces at least OWNER_VERIFICATION_REQUIRED), and who may mark it VERIFIED is
-- the Phase 08 authority trigger (owner and admin). Neither is an access question, so neither is
-- here; `lib/media/model.ts` then returns the material name to the public viewer only at VERIFIED.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- model_variant_labels — shape B
-- ----------------------------------------------------------------------------------------------
-- read: media.read (owner, admin, editor, merchandiser, researcher, viewer)   write: media.write (owner, admin, editor, merchandiser)

create policy model_variant_labels_select_public on model_variant_labels for select
  to anon, authenticated using (
    exists (select 1 from media_assets m
             where m.id = model_variant_labels.media_asset_id and m.status = 'PUBLISHED'));

create policy model_variant_labels_select_staff on model_variant_labels for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy model_variant_labels_insert_staff on model_variant_labels for insert
  to authenticated with check (public.has_role('owner','admin','editor','merchandiser'));

create policy model_variant_labels_update_staff on model_variant_labels for update
  to authenticated using  (public.has_role('owner','admin','editor','merchandiser'))
                with check (public.has_role('owner','admin','editor','merchandiser'));

create policy model_variant_labels_delete_staff on model_variant_labels for delete
  to authenticated using (public.has_role('owner','admin'));
