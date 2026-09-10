-- ============================================================================================
-- 0210 — Phase 23: the search index, in two tables that can never become one
--
-- ONE FLATTENED DOCUMENT PER INDEXED ENTITY. `search_documents` is a projection, not content: no
-- editor types a row here, no seed writes one, and every row is derived from a source table by
-- `refresh_search_document()` (0211). That is why it carries none of the Tier B publication
-- columns — a document has no publication workflow of its own, it MIRRORS the one its source has —
-- and none of the Tier C seed columns, because a seeder addressing a projection by key would be
-- writing search results for content that does not exist.
--
-- THE ALLOWLIST IS A CHECK CONSTRAINT, NOT A CONVENTION. `entity_type` names the exact eight
-- permitted values. A research row cannot be inserted here by a bug, by a migration, or by a later
-- phase that "just needs one more type" — the row is refused by the database. This is invariant I1
-- of the research subsystem arriving two phases before the subsystem does, on the principle that a
-- boundary is far cheaper to build than to retrofit.
--
-- AND A SECOND TABLE, CREATED EMPTY. `research_search_documents` exists here, unpopulated and
-- unreadable by `anon`, so the separation is visible in the schema from the day the schema has a
-- search index at all. Phases 25, 26 and 28 fill it. Nothing joins the two; nothing ever will.
--
-- WHY `status` IS `text` AND NOT `content_status`. Seven of the eight indexed entities carry
-- `content_status`. `inquiries` does not — §1.4 exempts it, and it carries `pipeline_status
-- inquiry_status` instead — so there is no legal `content_status` value an inquiry document could
-- hold, and the refresh function would have to invent a mapping. It does not. `status` stores the
-- source row's own status token VERBATIM, and a CHECK over the union of both enums' labels makes a
-- junk value impossible anyway. The anon predicate is unaffected: only the five public content
-- types are ever written with `visibility = 'PUBLIC'`, and a CHECK below makes that structural
-- rather than conventional.
--
-- RANKING IS A STORED GENERATED COLUMN, so it cannot drift from the row it describes. Title weighs
-- A, subtitle B, body C. `simple` rather than `english`: the corpus is product names, material
-- names and Indian place names, where a stemmer helps less than it hurts — `resin` and `resins`
-- already share a prefix, and stemming `Varmala` is nobody's idea of an improvement.
--
-- `search_queries` IS NOT ANALYTICS. It records what was typed and how many rows came back, so the
-- owner can see what a visitor looked for and did not find. It records NO IP, NO user agent and NO
-- actor for a public search. It is pruned at 90 days. Anything more would be a profile of a
-- visitor who has no account and was never asked (D1).
-- ============================================================================================

set search_path = public, extensions;

-- --- 1. An immutable unaccent, because a generated column demands one --------------------------

-- `extensions.unaccent(text)` is STABLE, not IMMUTABLE — it reads the dictionary, which could in
-- principle be changed — so PostgreSQL refuses it inside a generated column. The two-argument form
-- takes the dictionary as an explicit argument and is therefore safe to label immutable, which is
-- the standard remedy and the one the PostgreSQL documentation itself describes. Naming the
-- dictionary explicitly is not a detail: it is the whole reason this wrapper may claim immutability.
create function public.rv_unaccent(input text)
  returns text
  language sql
  immutable
  parallel safe
  strict
  set search_path = extensions, public
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, input);
$$;

comment on function public.rv_unaccent(text) is
  'An IMMUTABLE unaccent, for use in generated columns and expression indexes. Wraps the two-argument extensions.unaccent, which takes its dictionary explicitly and is therefore genuinely immutable; the one-argument form is only STABLE and PostgreSQL will not accept it where this is used.';

-- REVOKED FROM PUBLIC AND THEN GRANTED BACK BY NAME, which is 0143's rule rather than an
-- exception to it. `search_documents_query` is SECURITY INVOKER, so it executes as the caller —
-- and a caller who cannot execute this helper gets `permission denied for function rv_unaccent`
-- on every search. That is exactly the shape 0143 describes for `is_valid_dimensions`: a pure
-- function over its own argument, reading no table, whose privilege the writing (here, reading)
-- user genuinely needs. Found by running the site rather than by reading the migration.
revoke execute on function public.rv_unaccent(text) from public;
grant execute on function public.rv_unaccent(text) to anon, authenticated, service_role;

-- `array_to_string(anyarray, text)` is STABLE, not immutable — it is generic over every array type,
-- and a type whose output function is stable would make it stable too. That is enough for
-- PostgreSQL to refuse the whole generated expression below, which is how this wrapper came to
-- exist. Narrowed to `text[]`, whose output function is the identity, the operation genuinely is
-- immutable: the same array always produces the same string. The narrowing is the argument.
create function public.rv_keyword_text(input text[])
  returns text
  language sql
  immutable
  parallel safe
  set search_path = public
as $$
  select array_to_string(coalesce(input, '{}'::text[]), ' ');
$$;

comment on function public.rv_keyword_text(text[]) is
  'An IMMUTABLE array_to_string, narrowed to text[] so the claim is true. Exists because the generic array_to_string is STABLE and PostgreSQL therefore refuses it inside the search_vector generated column.';

-- NOT granted back. This one is only ever evaluated inside the generated column, and the only
-- writer of that column is `refresh_search_document()`, which is SECURITY DEFINER and runs as the
-- owner. No session evaluates it, so no session needs it.
revoke execute on function public.rv_keyword_text(text[]) from public, anon, authenticated;

-- --- 2. Two visibilities -----------------------------------------------------------------------

create type search_visibility as enum ('PUBLIC', 'STAFF');

comment on type search_visibility is
  'PUBLIC documents are the five FEAT §18 public entity types and are readable by anon while PUBLISHED. STAFF documents are Studio-only and have no anon policy. There is no third value: a document is either something a visitor may find or something only a signed-in member of staff may.';

-- --- 3. The public/staff index ------------------------------------------------------------------

create table search_documents (
  id             uuid primary key default gen_random_uuid(),

  -- THE ALLOWLIST. Eight values, named here, and no ninth without a migration that a reviewer
  -- reads. `research_product` is not among them and adding it is the failure this line prevents.
  entity_type    text not null,
  entity_id      uuid not null,

  visibility     search_visibility not null,

  -- The source row's own status token, verbatim. See the header for why this is text.
  status         text not null,

  -- Where a result links. Null for the two entity types that have no address of their own
  -- (`media_asset`, `inquiry` link into Studio and get their path from the renderer instead).
  url_path       text,

  title          text not null,
  subtitle       text,
  body           text,

  -- Denormalised names a query should match but which are not prose: material names, collection
  -- names, an SKU. Weighted with the body.
  keywords       text[] not null default '{}',

  -- The result card's picture, if the source row has one BOUND. Never a fallback and never a
  -- generated asset: a card with no real media renders as text (D6).
  image_media_id uuid references media_assets (id) on delete set null,

  category_slug  citext,

  search_vector  tsvector generated always as (
    setweight(to_tsvector('simple', public.rv_unaccent(coalesce(title, ''))), 'A') ||
    setweight(to_tsvector('simple', public.rv_unaccent(coalesce(subtitle, ''))), 'B') ||
    setweight(to_tsvector('simple', public.rv_unaccent(coalesce(body, ''))), 'C') ||
    setweight(to_tsvector('simple', public.rv_unaccent(public.rv_keyword_text(keywords))), 'C')
  ) stored,

  indexed_at     timestamptz not null default now(),

  constraint search_documents_unique_entity unique (entity_type, entity_id),

  constraint search_documents_entity_type_allowlist
    check (entity_type in (
      'product', 'category', 'collection', 'portfolio_project', 'journal_article',
      'material', 'media_asset', 'inquiry'
    )),

  -- The union of `content_status` and `inquiry_status` labels. Both enums carry ARCHIVED, so the
  -- list is twelve rather than thirteen.
  constraint search_documents_status_allowlist
    check (status in (
      'DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED',
      'NEW', 'READ', 'IN_CONVERSATION', 'QUOTED', 'WON', 'LOST', 'SPAM'
    )),

  -- THE THREE STUDIO-ONLY TYPES CAN NEVER BE PUBLIC. Written as a constraint rather than trusted
  -- to the refresh function, because the refresh function is code and this is the guarantee the
  -- anon SELECT policy is built on top of.
  constraint search_documents_staff_types_are_staff
    check (entity_type not in ('material', 'media_asset', 'inquiry') or visibility = 'STAFF'),

  constraint search_documents_title_present
    check (length(btrim(title)) > 0)
);

comment on table search_documents is
  'A flattened, denormalised document per indexed entity, maintained entirely by refresh_search_document() triggers (0211). A projection, not content: nothing is typed here and nothing is seeded here. entity_type is allowlisted to eight values so no research row can be inserted by any path.';
comment on column search_documents.status is
  'The SOURCE ROW''S OWN status token, verbatim — content_status for the seven content types, inquiry_status for an inquiry. Deliberately text: inquiries carry no content_status (§1.4), so a typed column would force refresh_search_document() to invent a mapping.';
comment on column search_documents.keywords is
  'Denormalised names a query should match but which are not prose — material names, collection names, an SKU. Weighted C with the body. Never personal data.';

create index search_documents_vector_idx on search_documents using gin (search_vector);
create index search_documents_title_trgm_idx on search_documents using gin (title gin_trgm_ops);
create index search_documents_scope_idx on search_documents (visibility, status, entity_type);
create index search_documents_category_idx on search_documents (category_slug) where category_slug is not null;

-- --- 4. The research index, created empty --------------------------------------------------------

create table research_search_documents (
  id             uuid primary key default gen_random_uuid(),

  -- Three values, and none of them is a public entity type. The two allowlists have an empty
  -- intersection, which is the isolation invariant expressed as a pair of CHECK constraints.
  entity_type    text not null,
  entity_id      uuid not null,

  -- Always STAFF. A column rather than a constant so the two tables have one shape and one
  -- refresh contract; a CHECK makes the value the only value.
  visibility     search_visibility not null default 'STAFF',

  -- One of the seven FEAT §23 stage values. Text rather than `research_stage`, because that enum
  -- does not exist until Phase 25 (0230) and this table is created two phases early on purpose.
  status         text not null,

  url_path       text,
  title          text not null,
  subtitle       text,
  body           text,
  keywords       text[] not null default '{}',

  -- NO `image_media_id`. A research row never has a Rivya media asset, and a column inviting one
  -- would be the first step towards re-hosting a competitor's photograph. Competitor imagery is
  -- referenced by URL and rendered only through the Phase 27 proxy, never stored here.
  source_url     text,

  search_vector  tsvector generated always as (
    setweight(to_tsvector('simple', public.rv_unaccent(coalesce(title, ''))), 'A') ||
    setweight(to_tsvector('simple', public.rv_unaccent(coalesce(subtitle, ''))), 'B') ||
    setweight(to_tsvector('simple', public.rv_unaccent(coalesce(body, ''))), 'C') ||
    setweight(to_tsvector('simple', public.rv_unaccent(public.rv_keyword_text(keywords))), 'C')
  ) stored,

  indexed_at     timestamptz not null default now(),

  constraint research_search_documents_unique_entity unique (entity_type, entity_id),

  constraint research_search_documents_entity_type_allowlist
    check (entity_type in ('research_product', 'research_source', 'research_run')),

  constraint research_search_documents_always_staff
    check (visibility = 'STAFF'),

  constraint research_search_documents_status_allowlist
    check (status in (
      'RAW', 'NORMALIZED', 'VALIDATED', 'MATCHED', 'REVIEW', 'SHORTLISTED', 'CONFIRMED'
    )),

  constraint research_search_documents_title_present
    check (length(btrim(title)) > 0)
);

comment on table research_search_documents is
  'The research corpus'' search index. Created EMPTY in Phase 23 and populated by Phases 25, 26 and 28. A separate table rather than a visibility flag on search_documents, because a flag is a value somebody can set wrongly and a table is a boundary. No anon policy exists on it and none may ever be created (research isolation invariant I2).';

create index research_search_documents_vector_idx on research_search_documents using gin (search_vector);
create index research_search_documents_title_trgm_idx on research_search_documents using gin (title gin_trgm_ops);
create index research_search_documents_scope_idx on research_search_documents (status, entity_type);

-- --- 5. What was searched for and not found -------------------------------------------------------

create table search_queries (
  id               uuid primary key default gen_random_uuid(),

  -- Exactly what was typed, so the owner reads the visitor's words rather than a tokenised guess.
  query_text       text not null,
  -- Lower-cased, unaccented, whitespace-collapsed. What "the same search" means when counting.
  normalized_query text not null,

  scope            text not null,
  result_count     int not null,

  -- Set for a STUDIO search and NULL for a PUBLIC one. Not "null because we could not tell" —
  -- null because a public search has no actor and recording one would require inventing an
  -- identity for somebody who deliberately has none (D1).
  staff_user_id    uuid references auth.users (id) on delete set null,

  occurred_at      timestamptz not null default now(),

  constraint search_queries_scope_allowlist check (scope in ('PUBLIC', 'STUDIO')),
  constraint search_queries_public_has_no_actor
    check (scope = 'STUDIO' or staff_user_id is null),
  constraint search_queries_count_sane check (result_count >= 0),
  constraint search_queries_text_present check (length(btrim(query_text)) > 0)
);

comment on table search_queries is
  'What was searched for and how many rows came back. NO IP, NO user agent, NO visitor identifier, and no actor at all for a public search — the CHECK enforces that rather than trusting the writer. 90-day retention, pruned by scripts/search/prune-queries.ts from the cron route. It exists so the owner can see what visitors looked for and did not find; it is not analytics and it is not a profile.';

create index search_queries_recent_idx on search_queries (occurred_at desc);
create index search_queries_zero_result_idx on search_queries (normalized_query, occurred_at desc)
  where result_count = 0;

alter table search_documents enable row level security;
alter table research_search_documents enable row level security;
alter table search_queries enable row level security;

-- --- 6. The two query paths, in SQL rather than in the client ---------------------------------------
--
-- POSTGREST CANNOT EXPRESS EITHER OF THEM. `websearch_to_tsquery`, `ts_rank_cd` and `similarity`
-- are not filter operators, so a repository building a `.from('search_documents')` query could
-- only fetch rows and rank them in Node — which means fetching every row that matches nothing in
-- particular and sorting the catalogue in a Lambda. These are `stable` functions called over RPC.
--
-- `security invoker`, WHICH IS THE ENTIRE ACCESS STORY. The function runs as the caller, so the
-- policies on `search_documents` apply exactly as they would to a direct read: `anon` sees
-- `visibility = 'PUBLIC' and status = 'PUBLISHED'` and nothing else, whatever arguments are passed.
-- A `security definer` here would have made the argument list the security boundary, and
-- `p_scope` a parameter an attacker sets.
--
-- THE TRIGRAM PASS IS A FALLBACK, NOT A MODE. It runs only when the exact pass returns fewer than
-- four rows, at a 0.30 threshold, and every row it contributes is marked `SIMILAR` so the UI can
-- group them under their own heading. That is the whole of FEAT §19's "typo tolerance where
-- practical": a fuzzy-everything search would return Reservation for `resin` on a two-word query
-- and quietly destroy precision on the queries that were working.

create function public.search_documents_query(
  p_query    text,
  p_scope    text default 'PUBLIC',
  p_types    text[] default null,
  p_category text default null,
  p_limit    int default 10,
  p_offset   int default 0,
  p_prefix   boolean default false
)
returns table (
  id             uuid,
  entity_type    text,
  entity_id      uuid,
  visibility     search_visibility,
  status         text,
  url_path       text,
  title          text,
  subtitle       text,
  body           text,
  keywords       text[],
  image_media_id uuid,
  category_slug  citext,
  indexed_at     timestamptz,
  rank           real,
  match_mode     text
)
language plpgsql
stable
security invoker
set search_path = public, extensions
as $$
declare
  v_tsquery  tsquery;
  v_norm     text := public.rv_unaccent(btrim(coalesce(p_query, '')));
  v_tokens   text[];
  v_exact    int;
  v_limit    int := least(greatest(coalesce(p_limit, 10), 1), 100);
  v_offset   int := greatest(coalesce(p_offset, 0), 0);
begin
  if v_norm = '' then return; end if;
  if p_scope not in ('PUBLIC', 'STAFF') then
    raise exception 'search_documents_query: scope must be PUBLIC or STAFF';
  end if;

  if p_prefix then
    /*
     * PREFIX MODE, FOR THE TYPE-AHEAD ONLY, AND IT EXISTS BECAUSE RUNNING THE SITE FOUND THE
     * OTHER MODE UNUSABLE THERE. A tsquery matches whole lexemes, so `re` does not match `resin`
     * — which is correct for a results page and useless for a suggestion list, where matching
     * what somebody has typed SO FAR is the entire feature. The last token therefore gets `:*`.
     *
     * `to_tsquery` RAISES ON MALFORMED INPUT, unlike `websearch_to_tsquery`, so the string is
     * built from tokens this function extracts rather than from anything the caller typed: every
     * character outside `[a-z0-9]` becomes a space, the pieces are joined with `&`, and there is
     * no path by which a quote or an operator reaches the parser.
     */
    v_tokens := array_remove(
      regexp_split_to_array(regexp_replace(lower(v_norm), '[^a-z0-9]+', ' ', 'g'), '\s+'),
      ''
    );
    if coalesce(cardinality(v_tokens), 0) = 0 then return; end if;

    v_tsquery := to_tsquery(
      'simple',
      (select string_agg(
                token || case when ordinality = cardinality(v_tokens) then ':*' else '' end,
                ' & ' order by ordinality)
         from unnest(v_tokens) with ordinality as t(token, ordinality))
    );
  else
    -- `websearch_to_tsquery` accepts anything a person can type — quotes, `or`, a stray minus —
    -- and never raises, which is why it is the parser for the results page.
    v_tsquery := websearch_to_tsquery('simple', v_norm);
  end if;

  select count(*) into v_exact
    from search_documents d
   where d.search_vector @@ v_tsquery
     and (p_scope = 'STAFF' or d.visibility = 'PUBLIC')
     and (p_types is null or d.entity_type = any (p_types))
     and (p_category is null or d.category_slug = p_category::citext);

  if v_exact > 0 then
    return query
      select d.id, d.entity_type, d.entity_id, d.visibility, d.status, d.url_path,
             d.title, d.subtitle, d.body, d.keywords, d.image_media_id, d.category_slug,
             d.indexed_at,
             ts_rank_cd(d.search_vector, v_tsquery)::real,
             'EXACT'::text
        from search_documents d
       where d.search_vector @@ v_tsquery
         and (p_scope = 'STAFF' or d.visibility = 'PUBLIC')
         and (p_types is null or d.entity_type = any (p_types))
         and (p_category is null or d.category_slug = p_category::citext)
       order by ts_rank_cd(d.search_vector, v_tsquery) desc, d.title asc, d.id asc
       limit v_limit offset v_offset;
  end if;

  -- FEWER THAN FOUR is the trigger, not zero: a query that found one thing has almost certainly
  -- not found what was meant, and a query that found forty does not need help.
  if v_exact < 4 then
    return query
      select d.id, d.entity_type, d.entity_id, d.visibility, d.status, d.url_path,
             d.title, d.subtitle, d.body, d.keywords, d.image_media_id, d.category_slug,
             d.indexed_at,
             similarity(d.title, v_norm)::real,
             'SIMILAR'::text
        from search_documents d
       where similarity(d.title, v_norm) >= 0.30
         and not (d.search_vector @@ v_tsquery)
         and (p_scope = 'STAFF' or d.visibility = 'PUBLIC')
         and (p_types is null or d.entity_type = any (p_types))
         and (p_category is null or d.category_slug = p_category::citext)
       order by similarity(d.title, v_norm) desc, d.title asc, d.id asc
       limit greatest(v_limit - greatest(v_exact - v_offset, 0), 0);
  end if;
end;
$$;

comment on function public.search_documents_query(text, text, text[], text, int, int, boolean) is
  'The public and Studio query path. SECURITY INVOKER, so RLS decides what the caller sees and p_scope only narrows further — an anon caller passing STAFF still reads nothing but PUBLIC/PUBLISHED rows. Exact websearch_to_tsquery pass first; a trigram pass at 0.30 similarity is appended only when the exact pass found fewer than four rows, and its rows are marked SIMILAR so the interface can say so. p_prefix builds a :* query from sanitised tokens instead, for the type-ahead, where matching a partial word is the whole point.';

-- A separate count rather than a window function on the query above, because the trigram fallback
-- makes "how many results are there" ambiguous inside one statement: the fallback's size depends
-- on the exact pass's size. Pagination only ever applies to the exact pass — a fallback long
-- enough to paginate is a fallback that has stopped being one.
create function public.search_documents_count(
  p_query    text,
  p_scope    text default 'PUBLIC',
  p_types    text[] default null,
  p_category text default null
)
returns int
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select count(*)::int
    from search_documents d
   where d.search_vector @@ websearch_to_tsquery('simple', public.rv_unaccent(btrim(coalesce(p_query, ''))))
     and (p_scope = 'STAFF' or d.visibility = 'PUBLIC')
     and (p_types is null or d.entity_type = any (p_types))
     and (p_category is null or d.category_slug = p_category::citext);
$$;

comment on function public.search_documents_count(text, text, text[], text) is
  'How many rows the EXACT pass matches, for pagination. The trigram fallback is deliberately not counted: it exists only when the exact pass is nearly empty, and a fallback long enough to paginate has stopped being a fallback.';

-- The public search runs with the anon key, so anon must be able to call these two — and only
-- these two. Everything else this phase creates stays revoked (0022's rule).
revoke execute on function public.search_documents_query(text, text, text[], text, int, int, boolean) from public;
revoke execute on function public.search_documents_count(text, text, text[], text) from public;
grant execute on function public.search_documents_query(text, text, text[], text, int, int, boolean)
  to anon, authenticated, service_role;
grant execute on function public.search_documents_count(text, text, text[], text)
  to anon, authenticated, service_role;
