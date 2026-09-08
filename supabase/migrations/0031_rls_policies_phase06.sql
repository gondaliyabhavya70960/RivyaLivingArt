-- 0031_rls_policies_phase06.sql — Phase 06
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for media_usages, which migration 0030 creates. Separate from 0021 for the same
-- reason 0021 was separate from 0011: a generated policy file is never re-opened once shipped.
--
-- media_assets' own policies are NOT here. They were generated into 0011 in Phase 04, and that file
-- has shipped — its table set is fixed. Phase 06 widens the media_assets COLUMN set, which changes
-- no policy: every policy on that table gates on `status` and `has_role()`, neither of which is
-- affected by adding columns.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- media_usages — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. Reverse index, not content. No anon policy — and that is the interesting
-- decision here, because it might look like one is needed: a public page renders an asset, so
-- surely the binding must be public too? No. The page resolves its media from its own block
-- payload, which already carries the asset id; this table answers the opposite question — "what
-- uses this asset" — which is a Studio question. Exposing it to anon would publish the shape of
-- every unpublished page: which slots exist, how many gallery items a draft has, which entities
-- reference an asset nobody has seen.
-- read: media.read (owner, admin, editor, merchandiser, researcher, viewer)   write: media.write (owner, admin, editor, merchandiser)

-- No anon policy. Shape C tables are never publicly readable.

create policy media_usages_select_staff on media_usages for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy media_usages_insert_staff on media_usages for insert
  to authenticated with check (public.has_role('owner','admin','editor','merchandiser'));

create policy media_usages_update_staff on media_usages for update
  to authenticated using  (public.has_role('owner','admin','editor','merchandiser'))
                with check (public.has_role('owner','admin','editor','merchandiser'));
