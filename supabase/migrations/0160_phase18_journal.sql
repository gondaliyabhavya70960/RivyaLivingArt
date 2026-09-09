-- ============================================================================================
-- 0160 — the journal: nine categories, ten drafts, and no body written for the owner
--
-- WHAT THIS PHASE SHIPS IS AN EDITORIAL SURFACE, NOT EDITORIAL. SEED §20 supplies ten article
-- IDEAS — a title and an angle each — and says in as many words: seed as DRAFT, do NOT publish
-- automatically. Several of those titles ask questions only Rivya can answer ("What to prepare
-- before requesting a custom commission"), and three carry explicit cautions about claiming
-- standards, capabilities or preservation performance. So the seed writes the brief and the
-- machinery, and the writing stays the owner's. Nothing here creates a published article.
--
-- `reading_minutes` IS COMPUTED BY A TRIGGER, WHICH IS WHAT "NEVER TYPED" HAS TO MEAN. The phase
-- document says the value is derived at 200 words per minute; leaving that to the application would
-- make it derived only on the paths that remembered. `set_article_reading_minutes()` overwrites the
-- column on every write from the linked page's own sections, so a hand-typed value does not
-- survive the statement that typed it. An article with no page and no sections gets NULL — there is
-- nothing to read, and "1 min" would be a claim about a body that does not exist.
--
-- PUBLISHING AN ARTICLE REQUIRES A BODY. The phase's risk table names "a seeded draft is published
-- with an empty body" and assigns the guard to `lib/cms/publishing.ts`. It is here as well, and the
-- database is the copy that cannot be bypassed: `enforce_article_has_body()` refuses PUBLISHED
-- unless the article has a linked page carrying at least one visible section. What it does NOT try
-- to judge is whether the prose inside those sections is any good, or whether a heading with three
-- words in it counts — that is an editor's call, and a trigger pretending to make it would refuse
-- work for reasons nobody could predict.
--
-- THE OWNER-VERIFICATION GATE IS A CHECK CONSTRAINT, NOT A TRIGGER. The phase document says
-- "a trigger refuses PUBLISHED while owner_verification = 'OWNER_VERIFICATION_REQUIRED'", but every
-- other content table in this schema — thirteen of them — carries exactly that rule as
-- `<table>_verified_before_publish`. A trigger here would be the same rule written a fourteenth
-- way, invisible to anyone grepping the constraint name, and weaker: a CHECK is verified on every
-- row including those an admin writes through a SECURITY DEFINER function.
--
-- CATEGORIES SEED PUBLISHED; ARTICLES SEED DRAFT. A category is taxonomy, not editorial: it says
-- "the studio writes about materials", which is true the moment the studio has a journal, and
-- `/journal/category/materials` cannot render at all if the category is invisible to `anon`. An
-- ARTICLE is the thing SEED §20 forbids publishing on the owner's behalf. The two defaults differ
-- for that reason and not by oversight.
-- ============================================================================================

set search_path = public, extensions;

-- --- 1. the page kind ---------------------------------------------------------------------------
alter table pages drop constraint pages_kind_allowed;
alter table pages add constraint pages_kind_allowed
  check (kind in ('PAGE', 'CATEGORY', 'SYSTEM', 'COLLECTION', 'PROJECT', 'ARTICLE'));

-- --- 2. journal_categories ----------------------------------------------------------------------
create table journal_categories (
  id            uuid primary key default gen_random_uuid(),
  slug          citext not null unique,
  name          text not null,
  description   text,
  -- The sentence at the top of `/journal/category/<slug>`. Distinct from `description`, which is
  -- what a listing says ABOUT the category; this is what the category page says as itself.
  intro_heading text,
  position      int not null default 0,

  status        content_status not null default 'DRAFT',
  owner_verification  owner_verification not null default 'NOT_REQUIRED',
  fact_classification fact_classification not null default 'EDITORIAL_COPY',

  seed_key             text,
  content_seed_version text,
  seed_content_hash    text,
  seed_last_applied_at timestamptz,
  owner_edited         boolean not null default false,

  published_at  timestamptz,
  published_by  uuid references auth.users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users (id),

  constraint journal_categories_verified_before_publish
    check (status <> 'PUBLISHED' or owner_verification <> 'OWNER_VERIFICATION_REQUIRED'),
  constraint journal_categories_name_present check (btrim(name) <> '')
);

comment on table journal_categories is
  'The nine SEED §19 journal categories. Taxonomy rather than editorial, so these seed PUBLISHED — a category page cannot render at all if anon cannot see the category.';
comment on column journal_categories.slug is
  'IMMUTABLE ONCE SEEDED. Renaming a category edits `name`; changing a slug changes a public URL and needs a redirect row, which is Phase 39 work.';

create unique index journal_categories_seed_key_idx on journal_categories (seed_key)
  where seed_key is not null;
create index journal_categories_position_idx on journal_categories (position, slug);

alter table journal_categories enable row level security;

-- --- 3. journal_articles ------------------------------------------------------------------------
create table journal_articles (
  id            uuid primary key default gen_random_uuid(),
  slug          citext not null unique,
  -- The body is an ordinary CMS page, exactly as a collection's exhibition and a project's story
  -- are. Third user of the entity-page pattern, which is what makes it a pattern.
  page_id       uuid unique references pages (id) on delete set null,
  title         text not null,
  -- The line under the title on the article itself.
  standfirst    text,
  -- The line a CARD shows. A different sentence from the standfirst, because a card is read in a
  -- grid beside other cards and the article page is read alone.
  excerpt       text,
  /*
   * THE BRIEF, NOT THE ARTICLE. SEED §20 gives each idea an angle — "room proportion, circulation,
   * seating and visual scale" — and that is what this column holds: what the piece is meant to be
   * about, for whoever writes it. It is never rendered publicly. Keeping it out of `excerpt` is the
   * point: an angle read as a summary would put the studio's editorial notes on the website.
   */
  angle_note    text,

  primary_category_id uuid references journal_categories (id) on delete set null,

  -- Desktop and mobile are SEPARATE slots (D6), never one asset cropped by CSS.
  cover_media_id        uuid references media_assets (id) on delete set null,
  cover_mobile_media_id uuid references media_assets (id) on delete set null,

  /*
   * THE ORGANISATION, UNTIL SOMEBODY VERIFIES A PERSON. A named human byline is a claim about who
   * works here, which is a business fact; the default is the studio's own name, and the Studio sets
   * `owner_verification` when an editor types a person instead. Phase 18 does not model authors as
   * rows, deliberately: an `authors` table with one row in it is a schema pretending to a team.
   */
  byline        text not null default 'Rivya Living Art',
  /** Derived by `set_article_reading_minutes()`. A value written by hand does not survive. */
  reading_minutes int,

  seo_entry_id  uuid references seo_entries (id) on delete set null,

  status        content_status not null default 'DRAFT',
  owner_verification  owner_verification not null default 'NOT_REQUIRED',
  fact_classification fact_classification not null default 'EDITORIAL_COPY',

  seed_key             text,
  content_seed_version text,
  seed_content_hash    text,
  seed_last_applied_at timestamptz,
  owner_edited         boolean not null default false,

  published_at  timestamptz,
  published_by  uuid references auth.users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users (id),

  constraint journal_articles_verified_before_publish
    check (status <> 'PUBLISHED' or owner_verification <> 'OWNER_VERIFICATION_REQUIRED'),
  constraint journal_articles_title_present check (btrim(title) <> ''),
  constraint journal_articles_byline_present check (btrim(byline) <> ''),
  -- A published article has a date. Nothing else in this schema needs the pair to agree, but a
  -- feed, a sitemap and an `Article` JSON-LD all read `published_at` and each would otherwise have
  -- to invent a fallback.
  constraint journal_articles_published_dated
    check (status <> 'PUBLISHED' or published_at is not null)
);

comment on table journal_articles is
  'SEED §20 article ideas and, later, articles. Seeded as DRAFT with a title and an angle and nothing else: writing bodies for the owner would be inventing editorial nobody commissioned.';
comment on column journal_articles.angle_note is
  'What the piece is meant to be about, for whoever writes it. Never rendered publicly.';
comment on column journal_articles.reading_minutes is
  'Derived from the linked page at 200 words per minute by set_article_reading_minutes(). A typed value is overwritten on the same statement.';

create unique index journal_articles_seed_key_idx on journal_articles (seed_key)
  where seed_key is not null;
create index journal_articles_status_idx on journal_articles (status, published_at desc);
create index journal_articles_category_idx
  on journal_articles (primary_category_id, published_at desc);
-- Trigram on the title, for the Phase 23 search suggest. `pg_trgm` is already installed (0001).
create index journal_articles_title_trgm_idx on journal_articles using gin (title gin_trgm_ops);

alter table journal_articles enable row level security;

-- --- 4. journal_article_categories ---------------------------------------------------------------
-- Secondary categories. The PRIMARY one lives on the article, because exactly one category orders
-- the fallback related rule and a "primary" chosen from a join table is a tie waiting to happen.
create table journal_article_categories (
  article_id  uuid not null references journal_articles (id) on delete cascade,
  category_id uuid not null references journal_categories (id) on delete cascade,
  position    int not null default 0,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id),

  primary key (article_id, category_id)
);

comment on table journal_article_categories is
  'Secondary categories for an article. The primary one is journal_articles.primary_category_id.';

create index journal_article_categories_category_idx
  on journal_article_categories (category_id, position);

alter table journal_article_categories enable row level security;

-- --- 5. reading time, derived ---------------------------------------------------------------------
/*
 * 200 WORDS PER MINUTE, OVER THE LINKED PAGE'S VISIBLE SECTIONS.
 *
 * IT READS `heading`, `body` and `supporting` AND NOT THE PAYLOAD. Those three are where a section's
 * prose lives today; `payload` is block configuration — media ids, limits, layout flags — and
 * counting it would inflate the estimate with words no reader reads. When `rich-text` is built and
 * carries prose in its payload, this function gains that one block type and nothing else changes.
 *
 * NULL WHEN THERE IS NOTHING TO READ, rather than 1. "1 min read" on an article with no body is a
 * small lie of exactly the kind this repository spends its constraints avoiding.
 */
create or replace function public.set_article_reading_minutes() returns trigger
  language plpgsql
  set search_path = pg_catalog, public
  as $$
declare
  words int;
begin
  if new.page_id is null then
    new.reading_minutes := null;
    return new;
  end if;

  select sum(
           coalesce(array_length(
             regexp_split_to_array(
               btrim(concat_ws(' ', s.heading, s.body, s.supporting)), '\s+'), 1), 0))
    into words
    from page_sections s
   where s.page_id = new.page_id
     and s.is_visible;

  new.reading_minutes := case
    when coalesce(words, 0) = 0 then null
    else greatest(1, ceil(words / 200.0))::int
  end;
  return new;
end $$;

comment on function public.set_article_reading_minutes() is
  'Overwrites journal_articles.reading_minutes from the linked page at 200 wpm. The column is derived by construction, not by convention.';

revoke execute on function public.set_article_reading_minutes() from public, anon, authenticated;

create trigger trg_journal_articles_reading_minutes
  before insert or update on public.journal_articles
  for each row execute function public.set_article_reading_minutes();

-- --- 6. an article is not published without a body ----------------------------------------------
create or replace function public.enforce_article_has_body() returns trigger
  language plpgsql
  set search_path = pg_catalog, public
  as $$
begin
  if new.status = 'PUBLISHED' then
    if new.page_id is null then
      raise exception 'journal article % cannot be published before its body page exists', new.slug
        using errcode = 'check_violation',
              hint = 'Create the article page in Studio and add at least one block to it.';
    end if;

    if not exists (
      select 1 from page_sections s where s.page_id = new.page_id and s.is_visible
    ) then
      raise exception 'journal article % cannot be published with an empty body', new.slug
        using errcode = 'check_violation',
              hint = 'SEED §20 seeds ideas, not articles. Write the piece before publishing it.';
    end if;
  end if;
  return new;
end $$;

comment on function public.enforce_article_has_body() is
  'Refuses PUBLISHED on an article with no linked page or no visible sections. The application refuses it too; this is the copy that cannot be bypassed.';

revoke execute on function public.enforce_article_has_body() from public, anon, authenticated;

create trigger trg_journal_articles_has_body
  before insert or update on public.journal_articles
  for each row execute function public.enforce_article_has_body();

-- --- 7. the article's URL is derived from its slug ------------------------------------------------
create or replace function public.sync_article_page_path() returns trigger
  language plpgsql
  security definer
  set search_path = pg_catalog, public
  as $$
begin
  if new.page_id is not null
     and (tg_op = 'INSERT'
          or new.slug is distinct from old.slug
          or new.page_id is distinct from old.page_id) then
    update pages
       set path = '/journal/' || lower(new.slug::text)
     where id = new.page_id;
  end if;
  return new;
end $$;

comment on function public.sync_article_page_path() is
  'Keeps pages.path equal to /journal/<slug>. The URL and the slug are one string by construction.';

revoke execute on function public.sync_article_page_path() from public, anon, authenticated;

create trigger trg_journal_articles_page_path
  after insert or update on public.journal_articles
  for each row execute function public.sync_article_page_path();

/*
 * THE SAME CONDITION, RETROFITTED ONTO THE PROJECT TWIN.
 *
 * `sync_project_page_path` (0153) fires on INSERT or a slug change only. Linking an EXISTING page
 * to a project — `page_id` moving from null to a value with the slug untouched — therefore left the
 * page at whatever path it was created with. Phase 17's own action passes the right path at insert,
 * so nothing was broken; it was a latent hole that the article version would have inherited by
 * being written from the same template. Fixed in both.
 */
create or replace function public.sync_project_page_path() returns trigger
  language plpgsql
  security definer
  set search_path = pg_catalog, public
  as $$
begin
  if new.page_id is not null
     and (tg_op = 'INSERT'
          or new.slug is distinct from old.slug
          or new.page_id is distinct from old.page_id) then
    update pages
       set path = '/portfolio/' || lower(new.slug::text)
     where id = new.page_id;
  end if;
  return new;
end $$;

-- --- 8. the page → entity status sync gains its third entity --------------------------------------
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
       set status = new.status
     where page_id = new.id
       and status is distinct from new.status;
  end if;

  if new.kind = 'PROJECT' and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    update portfolio_projects
       set status = new.status
     where page_id = new.id
       and status is distinct from new.status;
  end if;

  if new.kind = 'ARTICLE' and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    -- `enforce_article_has_body` fires from inside this update. Publishing the page of an article
    -- whose body has no visible sections therefore fails naming the ARTICLE — which is right: the
    -- page is fine, the piece is not written.
    update journal_articles
       set status = new.status
     where page_id = new.id
       and status is distinct from new.status;
  end if;

  return new;
end $$;

-- --- 9. updated_at ---------------------------------------------------------------------------------
create trigger journal_categories_set_updated_at
  before update on public.journal_categories
  for each row execute function public.set_updated_at();

create trigger journal_articles_set_updated_at
  before update on public.journal_articles
  for each row execute function public.set_updated_at();

-- --- 10. the seed runner's owner-edited flag ------------------------------------------------------
create trigger journal_categories_set_owner_edited
  before update on public.journal_categories
  for each row execute function public.set_owner_edited();

create trigger journal_articles_set_owner_edited
  before update on public.journal_articles
  for each row execute function public.set_owner_edited();
