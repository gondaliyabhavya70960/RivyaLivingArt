-- 0371_phase39_seo_rls.sql — Phase 39
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for the two tables migration 0370 creates. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote.
--
--   `seo_keyword_themes`  content.read select (every staff role); seo.write insert, update and
--                         delete (owner, admin, editor). No anon leg: no keyword is ever rendered.
--   `seo_redirects`       anon and authenticated select of PUBLISHED rows — the 404 path resolves
--                         a redirect for a visitor with no session; seo.write insert, update and
--                         delete.
--
-- `seo_entries` keeps its 0051 policies (content.write, the same three roles as seo.write); the
-- Server Actions check seo.write. See the entry in lib/auth/table-permissions.ts.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- seo_keyword_themes — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. Research targets, never rendered: no keyword string reaches a public page
-- and there is no keywords meta tag, so there is nothing for anon to read. Staff read is
-- content.read; every write is seo.write.
-- read: content.read (owner, admin, editor, merchandiser, researcher, viewer)   write: seo.write (owner, admin, editor)

-- No anon policy. Shape C tables are never publicly readable.

create policy seo_keyword_themes_select_staff on seo_keyword_themes for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy seo_keyword_themes_insert_staff on seo_keyword_themes for insert
  to authenticated with check (public.has_role('owner','admin','editor'));

create policy seo_keyword_themes_update_staff on seo_keyword_themes for update
  to authenticated using  (public.has_role('owner','admin','editor'))
                with check (public.has_role('owner','admin','editor'));

create policy seo_keyword_themes_delete_staff on seo_keyword_themes for delete
  to authenticated using (public.has_role('owner','admin','editor'));

-- ----------------------------------------------------------------------------------------------
-- seo_redirects — shape A
-- ----------------------------------------------------------------------------------------------
-- read: content.read (owner, admin, editor, merchandiser, researcher, viewer)   write: seo.write (owner, admin, editor)

create policy seo_redirects_select_public on seo_redirects for select
  to anon, authenticated using (status = 'PUBLISHED');

create policy seo_redirects_select_staff on seo_redirects for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy seo_redirects_insert_staff on seo_redirects for insert
  to authenticated with check (public.has_role('owner','admin','editor'));

create policy seo_redirects_update_staff on seo_redirects for update
  to authenticated using  (public.has_role('owner','admin','editor'))
                with check (public.has_role('owner','admin','editor'));

create policy seo_redirects_delete_staff on seo_redirects for delete
  to authenticated using (public.has_role('owner','admin','editor'));
