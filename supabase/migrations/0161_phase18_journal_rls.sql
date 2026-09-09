-- 0161_phase18_journal_rls.sql — Phase 18
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for `journal_categories`, `journal_articles` and
-- `journal_article_categories`, which migration 0160 creates. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote.
--
-- `journal_articles` IS THE ONLY TABLE ON THE SITE WHOSE PUBLIC READ IS GATED BY A DATE.
-- `status = 'PUBLISHED' and published_at <= now()`. Scheduling matters for editorial in a way it
-- does not for a product or a project: a piece is written, approved and set to appear on a given
-- morning, and a row that is PUBLISHED with a future date must not be readable before it. The
-- Phase 08 scheduler flips status on a cron; a cron that runs early — or a publish performed by
-- hand ahead of the date — would otherwise put the article on the site immediately. The clause is
-- the guard that does not depend on a job running at the right minute.
--
-- `journal_article_categories` CARRIES A PARENT TEST, matching `portfolio_project_media` and
-- `product_specs`. Which categories an unpublished article belongs to is a fact about
-- unpublished editorial — a reader could enumerate the studio's unannounced pieces by category
-- from the join alone, without ever reading the article row.
--
-- `journal_categories` HAS THE ORDINARY THIN CLAUSE. A category asserts nothing about the
-- business beyond "the studio writes about this", and the nine seeded ones ship PUBLISHED
-- precisely so their pages can render.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- journal_categories — shape A
-- ----------------------------------------------------------------------------------------------
-- read: content.read (owner, admin, editor, merchandiser, researcher, viewer)   write: content.write (owner, admin, editor)

create policy journal_categories_select_public on journal_categories for select
  to anon, authenticated using (status = 'PUBLISHED');

create policy journal_categories_select_staff on journal_categories for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy journal_categories_insert_staff on journal_categories for insert
  to authenticated with check (public.has_role('owner','admin','editor'));

create policy journal_categories_update_staff on journal_categories for update
  to authenticated using  (public.has_role('owner','admin','editor'))
                with check (public.has_role('owner','admin','editor'));

create policy journal_categories_delete_staff on journal_categories for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- journal_articles — shape A
-- ----------------------------------------------------------------------------------------------
-- read: content.read (owner, admin, editor, merchandiser, researcher, viewer)   write: content.write (owner, admin, editor)

create policy journal_articles_select_public on journal_articles for select
  to anon, authenticated using (status = 'PUBLISHED' and published_at <= now());

create policy journal_articles_select_staff on journal_articles for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy journal_articles_insert_staff on journal_articles for insert
  to authenticated with check (public.has_role('owner','admin','editor'));

create policy journal_articles_update_staff on journal_articles for update
  to authenticated using  (public.has_role('owner','admin','editor'))
                with check (public.has_role('owner','admin','editor'));

create policy journal_articles_delete_staff on journal_articles for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- journal_article_categories — shape A
-- ----------------------------------------------------------------------------------------------
-- read: content.read (owner, admin, editor, merchandiser, researcher, viewer)   write: content.write (owner, admin, editor)

create policy journal_article_categories_select_public on journal_article_categories for select
  to anon, authenticated using (exists (select 1 from journal_articles a
                   where a.id = journal_article_categories.article_id
                     and a.status = 'PUBLISHED' and a.published_at <= now()));

create policy journal_article_categories_select_staff on journal_article_categories for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

create policy journal_article_categories_insert_staff on journal_article_categories for insert
  to authenticated with check (public.has_role('owner','admin','editor'));

create policy journal_article_categories_update_staff on journal_article_categories for update
  to authenticated using  (public.has_role('owner','admin','editor'))
                with check (public.has_role('owner','admin','editor'));

create policy journal_article_categories_delete_staff on journal_article_categories for delete
  to authenticated using (public.has_role('owner','admin'));
