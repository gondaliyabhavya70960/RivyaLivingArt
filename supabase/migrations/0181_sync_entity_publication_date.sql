-- ============================================================================================
-- 0181 — publishing an entity's page must also date the entity
--
-- FOUND BY THE FIRST ATTEMPT TO PUBLISH AN ARTICLE, and it had never been attempted: Phase 18
-- seeds all ten articles DRAFT because SEED §20 forbids publishing on the owner's behalf, so the
-- path was shipped without ever being walked. The first walk fails.
--
-- `sync_entity_page_status()` propagates a page's status to the COLLECTION, PROJECT or ARTICLE that
-- page belongs to. It copies `status` and nothing else. `journal_articles` carries
-- `journal_articles_published_dated` — status <> PUBLISHED or published_at is not null — so the
-- propagated UPDATE sets the status, leaves the date null, and the row violates its own constraint.
-- The whole transaction fails with `new row for relation "journal_articles" violates check
-- constraint "journal_articles_published_dated"`, which names the article and says nothing about
-- the page the editor was actually working on.
--
-- SO THE DATE TRAVELS WITH THE STATUS. `coalesce(published_at, now())` rather than `now()`: the
-- first publication is the one worth recording, and a page unpublished for a correction and
-- republished the same afternoon has not been published twice. `published_by` is taken from the
-- page, because the person who published the page is the person who published the article.
--
-- IT IS APPLIED TO ALL THREE ENTITY KINDS, not only the one with the constraint. Collections and
-- portfolio projects have no CHECK to fail, which is exactly why they would have gone on quietly
-- accumulating published rows with a null publication date — invisible until something sorted by
-- it, or until somebody asked when a project went live and the database had never been told.
-- ============================================================================================

set search_path = public, extensions;

create or replace function public.sync_entity_page_status() returns trigger
  language plpgsql
  security definer
  set search_path = pg_catalog, public
  as $$
begin
  if new.kind = 'COLLECTION' and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    -- The publish gate on `collections` fires from inside this update, so publishing the exhibition
    -- page of an unconfirmed concept fails and names the COLLECTION. That is the intended reading:
    -- what is not ready is the concept, not the page.
    update collections
       set status = new.status,
           published_at = case when new.status = 'PUBLISHED'
                               then coalesce(published_at, new.published_at, now())
                               else published_at end,
           published_by = case when new.status = 'PUBLISHED'
                               then coalesce(published_by, new.published_by)
                               else published_by end
     where page_id = new.id
       and status is distinct from new.status;
  end if;

  if new.kind = 'PROJECT' and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    update portfolio_projects
       set status = new.status,
           published_at = case when new.status = 'PUBLISHED'
                               then coalesce(published_at, new.published_at, now())
                               else published_at end,
           published_by = case when new.status = 'PUBLISHED'
                               then coalesce(published_by, new.published_by)
                               else published_by end
     where page_id = new.id
       and status is distinct from new.status;
  end if;

  if new.kind = 'ARTICLE' and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    -- `enforce_article_has_body` fires from inside this update. Publishing the page of an article
    -- whose body has no visible sections therefore fails naming the ARTICLE — which is right: the
    -- page is fine, the piece is not written.
    update journal_articles
       set status = new.status,
           published_at = case when new.status = 'PUBLISHED'
                               then coalesce(published_at, new.published_at, now())
                               else published_at end,
           published_by = case when new.status = 'PUBLISHED'
                               then coalesce(published_by, new.published_by)
                               else published_by end
     where page_id = new.id
       and status is distinct from new.status;
  end if;

  return new;
end $$;

comment on function public.sync_entity_page_status() is
  'Propagates a page''s status to the collection, project or article it belongs to, and dates the publication with it. Without the date, journal_articles fails its own published_dated CHECK and the other two accumulate published rows nobody can date.';
