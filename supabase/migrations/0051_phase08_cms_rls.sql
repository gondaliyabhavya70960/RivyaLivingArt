-- 0051_phase08_cms_rls.sql — Phase 08
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for the seven tables migration 0050 creates. Its own file for the same reason 0021,
-- 0031 and 0041 were: a generated policy file is never re-opened once shipped.
--
-- THREE TABLES CARRY A CUSTOM PUBLIC CLAUSE, and each one is load-bearing rather than a
-- refinement. `pages` and `page_sections` add the SCHEDULE WINDOW: without it a row scheduled
-- for next week is readable the instant its status changes, and scheduling is decorative.
-- `pages` also requires `path is not null`, which is what keeps the reserved slug='global'
-- SYSTEM row off the public site — it has no address, and an application-level filter is a
-- promise a refactor can break, while a null in the predicate cannot be. `global_content` adds
-- `is_enabled`, the switch that turns a CTA off without unpublishing it.
--
-- page_sections tests its PAGE's window as well as its own. A published section on an
-- unpublished page must not be readable, or a page scheduled for next week leaks section by
-- section to anyone querying the table directly — which is precisely what an anon key can do.
--
-- content_revisions is shape C with no write policy of any kind. See its declared deviation.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- pages — shape A
-- ----------------------------------------------------------------------------------------------
-- read: content.read (owner, admin, editor, merchandiser, researcher, viewer)   write: content.write (owner, admin, editor)

create policy pages_select_public on pages for select
  to anon, authenticated using (status = 'PUBLISHED' and path is not null
      and (publish_at is null or publish_at <= now())
      and (unpublish_at is null or unpublish_at > now()));

create policy pages_select_staff on pages for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy pages_insert_staff on pages for insert
  to authenticated with check (public.has_role('owner','admin','editor'));

create policy pages_update_staff on pages for update
  to authenticated using  (public.has_role('owner','admin','editor'))
                with check (public.has_role('owner','admin','editor'));

create policy pages_delete_staff on pages for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- page_sections — shape A
-- ----------------------------------------------------------------------------------------------
-- read: content.read (owner, admin, editor, merchandiser, researcher, viewer)   write: content.write (owner, admin, editor)

create policy page_sections_select_public on page_sections for select
  to anon, authenticated using (status = 'PUBLISHED' and is_visible
      and (publish_at is null or publish_at <= now())
      and (unpublish_at is null or unpublish_at > now())
      and exists (select 1 from pages p
                  where p.id = page_sections.page_id
                    and p.status = 'PUBLISHED' and p.path is not null
                    and (p.publish_at is null or p.publish_at <= now())
                    and (p.unpublish_at is null or p.unpublish_at > now())));

create policy page_sections_select_staff on page_sections for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy page_sections_insert_staff on page_sections for insert
  to authenticated with check (public.has_role('owner','admin','editor'));

create policy page_sections_update_staff on page_sections for update
  to authenticated using  (public.has_role('owner','admin','editor'))
                with check (public.has_role('owner','admin','editor'));

create policy page_sections_delete_staff on page_sections for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- navigation_items — shape A
-- ----------------------------------------------------------------------------------------------
-- read: content.read (owner, admin, editor, merchandiser, researcher, viewer)   write: content.write (owner, admin, editor)

create policy navigation_items_select_public on navigation_items for select
  to anon, authenticated using (status = 'PUBLISHED');

create policy navigation_items_select_staff on navigation_items for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy navigation_items_insert_staff on navigation_items for insert
  to authenticated with check (public.has_role('owner','admin','editor'));

create policy navigation_items_update_staff on navigation_items for update
  to authenticated using  (public.has_role('owner','admin','editor'))
                with check (public.has_role('owner','admin','editor'));

create policy navigation_items_delete_staff on navigation_items for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- global_content — shape A
-- ----------------------------------------------------------------------------------------------
-- read: content.read (owner, admin, editor, merchandiser, researcher, viewer)   write: content.write (owner, admin, editor)

create policy global_content_select_public on global_content for select
  to anon, authenticated using (status = 'PUBLISHED' and is_enabled);

create policy global_content_select_staff on global_content for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy global_content_insert_staff on global_content for insert
  to authenticated with check (public.has_role('owner','admin','editor'));

create policy global_content_update_staff on global_content for update
  to authenticated using  (public.has_role('owner','admin','editor'))
                with check (public.has_role('owner','admin','editor'));

create policy global_content_delete_staff on global_content for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- seo_entries — shape A
-- ----------------------------------------------------------------------------------------------
-- read: content.read (owner, admin, editor, merchandiser, researcher, viewer)   write: content.write (owner, admin, editor)

create policy seo_entries_select_public on seo_entries for select
  to anon, authenticated using (status = 'PUBLISHED');

create policy seo_entries_select_staff on seo_entries for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy seo_entries_insert_staff on seo_entries for insert
  to authenticated with check (public.has_role('owner','admin','editor'));

create policy seo_entries_update_staff on seo_entries for update
  to authenticated using  (public.has_role('owner','admin','editor'))
                with check (public.has_role('owner','admin','editor'));

create policy seo_entries_delete_staff on seo_entries for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- faqs — shape A
-- ----------------------------------------------------------------------------------------------
-- read: content.read (owner, admin, editor, merchandiser, researcher, viewer)   write: content.write (owner, admin, editor)

create policy faqs_select_public on faqs for select
  to anon, authenticated using (status = 'PUBLISHED');

create policy faqs_select_staff on faqs for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy faqs_insert_staff on faqs for insert
  to authenticated with check (public.has_role('owner','admin','editor'));

create policy faqs_update_staff on faqs for update
  to authenticated using  (public.has_role('owner','admin','editor'))
                with check (public.has_role('owner','admin','editor'));

create policy faqs_delete_staff on faqs for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- content_revisions — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. No write policy for any session role, and no UPDATE or DELETE policy at all.
-- Rows are written solely by write_revision(), a SECURITY DEFINER trigger, so the history cannot
-- be edited by the people it records. A revision an editor can rewrite is not an audit trail, and
-- verification step 6 asserts exactly this by attempting an UPDATE as staff.
-- read: content.read (owner, admin, editor, merchandiser, researcher, viewer)

-- No anon policy. Shape C tables are never publicly readable.

create policy content_revisions_select_staff on content_revisions for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

-- No write policy for authenticated: see the deviation note above.
