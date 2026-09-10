-- ============================================================================================
-- 0211 — Phase 23: index maintenance is a trigger, not a job
--
-- A NIGHTLY REINDEX WOULD MEAN THE INDEX IS WRONG ALL DAY. An editor publishes a product and it is
-- findable now, or the search box is lying about the catalogue. So one `after insert or update or
-- delete` trigger per source table calls `refresh_search_document(entity_type, entity_id)`, which
-- rebuilds exactly one row. `scripts/search/reindex.ts` rebuilds the whole index and is the only
-- supported REPAIR path; it is not part of normal operation.
--
-- `security definer`, AND THAT IS THE ONLY WAY THIS WORKS. `search_documents` has no INSERT or
-- UPDATE policy for any session role — a projection nobody may write by hand is a projection that
-- cannot be forged — so the refresh must run as the owner. It is `set search_path` pinned and takes
-- only an entity type and an id; every value it writes it reads from the source table itself.
--
-- A DELETE ON THE SOURCE REMOVES THE DOCUMENT, and so does a row that ceases to qualify: a
-- collection that falls back to DRAFT_COLLECTION_CONCEPT is deleted from the index rather than
-- left behind with a stale status, because a document that exists is a document some query can
-- reach and the cheapest way to be sure is for it not to exist.
--
-- WHAT AN INQUIRY DOCUMENT CONTAINS, AND THE LIST IS EXHAUSTIVE: the reference code, the enquiry
-- kind, the related product's title and the pipeline status. NOT the name, NOT the phone number,
-- NOT the email address, NOT the city, NOT the message body, NOT an uploaded filename, NOT the
-- answers. `tests/unit/search-scope.test.ts` inserts an enquiry carrying all of them and asserts
-- none reaches the row. The reason is blunt: a Studio search result is the thing most likely to
-- end up in a screenshot.
--
-- A PRODUCT'S KEYWORDS ARE ITS SKU, ITS MATERIALS AND ITS COLLECTIONS, denormalised at refresh
-- time. That is why `product_materials` and `product_collections` have triggers of their own: a
-- material attached after the product was last saved would otherwise never reach the index.
-- ============================================================================================

set search_path = public, extensions;

-- --- 1. The one writer ---------------------------------------------------------------------------

create function public.refresh_search_document(p_entity_type text, p_entity_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, extensions
as $$
declare
  v_visibility  search_visibility;
  v_status      text;
  v_url         text;
  v_title       text;
  v_subtitle    text;
  v_body        text;
  v_keywords    text[];
  v_image       uuid;
  v_category    citext;
  v_found       boolean := false;
begin
  if p_entity_type not in (
    'product', 'category', 'collection', 'portfolio_project', 'journal_article',
    'material', 'media_asset', 'inquiry'
  ) then
    -- Not an error message naming what IS allowed: this function is reachable only from the
    -- triggers below, so a bad type here is a programming mistake and the constraint on the table
    -- would refuse the write anyway.
    raise exception 'refresh_search_document: % is not an indexable entity type', p_entity_type;
  end if;

  if p_entity_type = 'product' then
    select true,
           'PUBLIC'::search_visibility,
           p.status::text,
           '/product/' || p.slug::text,
           p.title,
           coalesce(p.subtitle, c.name),
           coalesce(p.summary, p.description),
           -- SKU is indexed for BOTH scopes and rendered for neither: a visitor who knows the code
           -- from a quotation should find the piece, and nobody needs to read it back on a card.
           array_remove(
             array[p.sku::text, c.name]
             || coalesce((select array_agg(m.name order by m.name)
                            from product_materials pm join materials m on m.id = pm.material_id
                           where pm.product_id = p.id), '{}')
             || coalesce((select array_agg(col.name order by col.name)
                            from product_collections pc join collections col on col.id = pc.collection_id
                           where pc.product_id = p.id), '{}'),
             null),
           p.hero_media_id,
           c.slug
      into v_found, v_visibility, v_status, v_url, v_title, v_subtitle, v_body, v_keywords, v_image, v_category
      from products p
      left join categories c on c.id = p.category_id
     where p.id = p_entity_id;

  elsif p_entity_type = 'category' then
    select true, 'PUBLIC'::search_visibility, c.status::text,
           '/collection/' || c.slug::text, c.name, c.subtitle, c.description,
           '{}'::text[], c.hero_media_id, c.slug
      into v_found, v_visibility, v_status, v_url, v_title, v_subtitle, v_body, v_keywords, v_image, v_category
      from categories c where c.id = p_entity_id;

  elsif p_entity_type = 'collection' then
    -- FEAT §9: a collection still in concept is an idea, not a body of work. It is not indexed at
    -- all rather than indexed and filtered, so no query path can reach it by accident.
    select true, 'PUBLIC'::search_visibility, col.status::text,
           '/collections/' || col.slug::text, col.name, col.subtitle,
           coalesce(col.statement_long, col.statement),
           '{}'::text[], col.hero_media_id, null::citext
      into v_found, v_visibility, v_status, v_url, v_title, v_subtitle, v_body, v_keywords, v_image, v_category
      from collections col
     where col.id = p_entity_id
       and col.concept_state <> 'DRAFT_COLLECTION_CONCEPT';

  elsif p_entity_type = 'portfolio_project' then
    -- NO `location_label`. The phase document asks for a "location-free body" and this is where
    -- that is decided: a project's town is a fact about a customer's house.
    select true, 'PUBLIC'::search_visibility, pp.status::text,
           '/portfolio/' || pp.slug::text, pp.title, pp.subtitle, pp.summary,
           array_remove(array[pp.project_type], null), pp.hero_media_id, null::citext
      into v_found, v_visibility, v_status, v_url, v_title, v_subtitle, v_body, v_keywords, v_image, v_category
      from portfolio_projects pp where pp.id = p_entity_id;

  elsif p_entity_type = 'journal_article' then
    -- The article's prose lives in `page_sections`, not on this row (Phase 18), so what is indexed
    -- is the standfirst and the excerpt — the two fields that ARE on the article — plus the
    -- category name as a keyword. Indexing the rendered body is a Phase 39 question about how
    -- section content is flattened, and inventing an answer here would put half a body in the
    -- index and call it the whole one.
    select true, 'PUBLIC'::search_visibility, ja.status::text,
           '/journal/' || ja.slug::text, ja.title, ja.standfirst, ja.excerpt,
           array_remove(array[jc.name, ja.byline], null), ja.cover_media_id, null::citext
      into v_found, v_visibility, v_status, v_url, v_title, v_subtitle, v_body, v_keywords, v_image, v_category
      from journal_articles ja
      left join journal_categories jc on jc.id = ja.primary_category_id
     where ja.id = p_entity_id;

  elsif p_entity_type = 'material' then
    select true, 'STAFF'::search_visibility, m.status::text,
           null, m.name, m.family, m.description, '{}'::text[], null::uuid, null::citext
      into v_found, v_visibility, v_status, v_url, v_title, v_subtitle, v_body, v_keywords, v_image, v_category
      from materials m where m.id = p_entity_id;

  elsif p_entity_type = 'media_asset' then
    select true, 'STAFF'::search_visibility, ma.status::text,
           null,
           -- FOUR CANDIDATES, ENDING AT `public_id`, WHICH IS NOT NULL. An asset may legitimately
           -- have no title, no Rivya id and no filename — the Phase 04 RLS fixture inserts exactly
           -- such a row, which is how this was found: the index's NOT NULL title turned an
           -- unrelated fixture insert into a constraint violation. `public_id` is the asset's
           -- address and is what a member of staff searching for it would type.
           coalesce(nullif(btrim(ma.title), ''), ma.rivya_asset_id::text, nullif(btrim(ma.filename), ''), ma.public_id),
           ma.rivya_asset_id::text, ma.alt_text,
           array_remove(array[ma.folder, ma.filename] || coalesce(ma.tags, '{}'), null),
           ma.id, null::citext
      into v_found, v_visibility, v_status, v_url, v_title, v_subtitle, v_body, v_keywords, v_image, v_category
      from media_assets ma where ma.id = p_entity_id;

  elsif p_entity_type = 'inquiry' then
    -- FOUR FIELDS. See the header. Nothing here reads name, phone, email, city, message or answers.
    select true, 'STAFF'::search_visibility, i.pipeline_status::text,
           null, i.reference_code, i.kind::text,
           pr.title, array_remove(array[i.kind::text, i.pipeline_status::text], null),
           null::uuid, null::citext
      into v_found, v_visibility, v_status, v_url, v_title, v_subtitle, v_body, v_keywords, v_image, v_category
      from inquiries i
      left join products pr on pr.id = i.product_id
     where i.id = p_entity_id;
  end if;

  -- NO ROW, OR NO TITLE, MEANS NO DOCUMENT.
  --
  -- The second half is not defensiveness. `search_documents.title` is NOT NULL because a result
  -- with no name is a link with nothing to click, and a row whose every title candidate is blank
  -- would otherwise turn an ordinary insert on the SOURCE table into a constraint violation
  -- attributed to the index — a trigger failing a write that has nothing to do with search. Not
  -- indexing it is the honest outcome: the record exists, it is simply not findable by name until
  -- somebody gives it one.
  if not coalesce(v_found, false) or v_title is null or btrim(v_title) = '' then
    delete from search_documents
     where entity_type = p_entity_type and entity_id = p_entity_id;
    return;
  end if;

  -- This is a FUNCTION BODY, not a migration-time write: the statement runs when a trigger fires,
  -- and what it writes is a projection of a row that already exists.
  -- check-migrations: allow-insert (function body; writes a projection when a trigger fires)
  insert into search_documents as sd (
    entity_type, entity_id, visibility, status, url_path,
    title, subtitle, body, keywords, image_media_id, category_slug, indexed_at
  )
  values (
    p_entity_type, p_entity_id, v_visibility, v_status, v_url,
    v_title, v_subtitle, v_body, coalesce(v_keywords, '{}'), v_image, v_category, now()
  )
  on conflict (entity_type, entity_id) do update
    set visibility     = excluded.visibility,
        status         = excluded.status,
        url_path       = excluded.url_path,
        title          = excluded.title,
        subtitle       = excluded.subtitle,
        body           = excluded.body,
        keywords       = excluded.keywords,
        image_media_id = excluded.image_media_id,
        category_slug  = excluded.category_slug,
        indexed_at     = now();
end;
$$;

comment on function public.refresh_search_document(text, uuid) is
  'Rebuild exactly one search_documents row from its source table, or delete it when the source row is gone or no longer qualifies. The ONLY writer of search_documents: the table has no session-role write policy, so this runs security definer. An inquiry document carries the reference code, kind, related product title and pipeline status and nothing else — never a name, phone number, email address, city or message body.';

revoke execute on function public.refresh_search_document(text, uuid) from public, anon, authenticated;

-- THE SERVICE ROLE KEEPS IT, and the grant is explicit rather than inherited. `revoke ... from
-- public` removes what every role held through PUBLIC, `service_role` included, so without this
-- line `scripts/search/reindex.ts` — the only supported repair path — could not run. Nobody with a
-- browser session can call it either way: the triggers invoke it as the function owner.
grant execute on function public.refresh_search_document(text, uuid) to service_role;

-- --- 2. One trigger function per source table ------------------------------------------------------
--
-- Eight nearly identical functions rather than one generic one, because a generic function would
-- have to derive the entity type from TG_TABLE_NAME — a string comparison that fails silently if a
-- table is ever renamed, at the exact moment nobody is looking at the index.

create function public.search_index_products() returns trigger
  language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.refresh_search_document('product', coalesce(new.id, old.id));
  return null;
end; $$;

create function public.search_index_categories() returns trigger
  language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.refresh_search_document('category', coalesce(new.id, old.id));
  return null;
end; $$;

create function public.search_index_collections() returns trigger
  language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.refresh_search_document('collection', coalesce(new.id, old.id));
  return null;
end; $$;

create function public.search_index_portfolio_projects() returns trigger
  language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.refresh_search_document('portfolio_project', coalesce(new.id, old.id));
  return null;
end; $$;

create function public.search_index_journal_articles() returns trigger
  language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.refresh_search_document('journal_article', coalesce(new.id, old.id));
  return null;
end; $$;

create function public.search_index_materials() returns trigger
  language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.refresh_search_document('material', coalesce(new.id, old.id));
  return null;
end; $$;

create function public.search_index_media_assets() returns trigger
  language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.refresh_search_document('media_asset', coalesce(new.id, old.id));
  return null;
end; $$;

create function public.search_index_inquiries() returns trigger
  language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.refresh_search_document('inquiry', coalesce(new.id, old.id));
  return null;
end; $$;

-- The two product joins. A material attached to a product after the product was last saved changes
-- what that product should match, and nothing on `products` fires for it.
create function public.search_index_product_join() returns trigger
  language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.refresh_search_document('product', coalesce(new.product_id, old.product_id));
  return null;
end; $$;

-- A category rename changes the subtitle and the keyword of every product in it; a journal
-- category rename changes every article's keyword. Both are bounded rewrites of rows that are
-- already indexed, so they run inline rather than through a queue nothing else in the project has.
create function public.search_index_category_children() returns trigger
  language plpgsql security definer set search_path = public, extensions as $$
declare r record;
begin
  for r in select id from products where category_id = coalesce(new.id, old.id) loop
    perform public.refresh_search_document('product', r.id);
  end loop;
  return null;
end; $$;

create function public.search_index_journal_category_children() returns trigger
  language plpgsql security definer set search_path = public, extensions as $$
declare r record;
begin
  for r in select id from journal_articles where primary_category_id = coalesce(new.id, old.id) loop
    perform public.refresh_search_document('journal_article', r.id);
  end loop;
  return null;
end; $$;

revoke execute on function public.search_index_products() from public, anon, authenticated;
revoke execute on function public.search_index_categories() from public, anon, authenticated;
revoke execute on function public.search_index_collections() from public, anon, authenticated;
revoke execute on function public.search_index_portfolio_projects() from public, anon, authenticated;
revoke execute on function public.search_index_journal_articles() from public, anon, authenticated;
revoke execute on function public.search_index_materials() from public, anon, authenticated;
revoke execute on function public.search_index_media_assets() from public, anon, authenticated;
revoke execute on function public.search_index_inquiries() from public, anon, authenticated;
revoke execute on function public.search_index_product_join() from public, anon, authenticated;
revoke execute on function public.search_index_category_children() from public, anon, authenticated;
revoke execute on function public.search_index_journal_category_children() from public, anon, authenticated;

-- --- 3. The triggers ------------------------------------------------------------------------------

create trigger products_search_index
  after insert or update or delete on products
  for each row execute function public.search_index_products();

create trigger categories_search_index
  after insert or update or delete on categories
  for each row execute function public.search_index_categories();

create trigger categories_search_index_children
  after update or delete on categories
  for each row execute function public.search_index_category_children();

create trigger collections_search_index
  after insert or update or delete on collections
  for each row execute function public.search_index_collections();

create trigger portfolio_projects_search_index
  after insert or update or delete on portfolio_projects
  for each row execute function public.search_index_portfolio_projects();

create trigger journal_articles_search_index
  after insert or update or delete on journal_articles
  for each row execute function public.search_index_journal_articles();

create trigger journal_categories_search_index_children
  after update or delete on journal_categories
  for each row execute function public.search_index_journal_category_children();

create trigger materials_search_index
  after insert or update or delete on materials
  for each row execute function public.search_index_materials();

create trigger media_assets_search_index
  after insert or update or delete on media_assets
  for each row execute function public.search_index_media_assets();

create trigger inquiries_search_index
  after insert or update or delete on inquiries
  for each row execute function public.search_index_inquiries();

create trigger product_materials_search_index
  after insert or update or delete on product_materials
  for each row execute function public.search_index_product_join();

create trigger product_collections_search_index
  after insert or update or delete on product_collections
  for each row execute function public.search_index_product_join();
