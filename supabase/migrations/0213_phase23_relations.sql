-- ============================================================================================
-- 0213 — Phase 23: the relationship model
--
-- PHASE 03 CREATED AN EDGE AND NEVER SAID WHAT AN EDGE MEANS. `product_relations` has carried
-- `relation_type text` with no constraint since the first migration, and the only vocabulary
-- anywhere was a four-item lower-case list in `lib/supabase/repositories/product-edges.ts` whose
-- own comment says the decision was deferred to this phase. This file takes it: nine relation
-- names, fixed in a CHECK on both relation tables, and a `target_type` list closed to the six
-- things a relation may point at.
--
-- WHY A SECOND TABLE RATHER THAN GENERALISING THE FIRST. `product_relations.source_product_id`
-- has a foreign key to `products` and two shipped phases index it. Renaming that column to
-- generalise the source side would rewrite Phase 15's public renderer and Phase 03's indexes for a
-- table that already works. `content_relations` is therefore its sibling, not its replacement: a
-- project, an article or a collection on the source side, the same vocabulary, the same shape.
--
-- `entity_relations` (Phase 16) IS NOT TOUCHED and is not consolidated here. That is open question
-- 1 in DATA_MODEL §14 and it stays open: three tables is one too many, and resolving it means
-- migrating live Studio surfaces in Phases 16, 17 and 18 that have nothing to do with search.
--
-- ORIGIN IS THE COLUMN THIS PHASE EXISTS FOR. FEAT §11 permits automatic relations only where a
-- reliable rule exists, and the rules in `lib/relations/rules.ts` NEVER WRITE. An edge is either
-- `EDITOR` — somebody made it — or `RULE_ACCEPTED` with the `rule_key` of the suggestion an editor
-- pressed Accept on. There is no third origin, so "where did this relation come from" always has
-- an answer, and a rule that quietly started persisting would show up as a row nobody accepted.
--
-- DISMISSAL IS PERMANENT AND THAT IS THE POINT. A suggestion an editor rejected returning next
-- week is the behaviour that makes people stop reading suggestion panels. `relation_suppressions`
-- records the exact (source, target, rule) triple, and the rules read it before they propose.
--
-- `product_attribute_terms` SHIPS WITH ZERO ROWS. A wood species is vocabulary, but saying Rivya
-- works in that species is a capability claim, and D10 does not let this repository make one. The
-- table carries the full publication and verification set so that a term the owner creates cannot
-- reach a visitor until the owner has verified it.
-- ============================================================================================

set search_path = public, extensions;

-- --- 1. Two enums --------------------------------------------------------------------------------

create type relation_origin as enum ('EDITOR', 'RULE_ACCEPTED');

comment on type relation_origin is
  'How an edge came to exist. EDITOR: a person created it by hand. RULE_ACCEPTED: a person pressed Accept on a suggestion, and rule_key names which rule proposed it. There is no value meaning "a rule wrote this" — no rule writes.';

create type attribute_taxonomy as enum ('DESIGN_FAMILY', 'RESIN_STYLE', 'WOOD_SPECIES');

comment on type attribute_taxonomy is
  'The three FEAT §10 attribute vocabularies. One enum and one table rather than three near-identical tables, because the three differ in nothing but their name.';

-- --- 2. The relation vocabulary, as a reusable predicate -------------------------------------------
--
-- A function rather than the literal list written twice: two copies of a nine-item list is one
-- copy that will be edited and one that will not.

create function public.is_relation_type(value text)
  returns boolean
  language sql
  immutable
  parallel safe
  set search_path = public
as $$
  select value in (
    'RELATED_PRODUCT', 'PORTFOLIO_PROJECT', 'JOURNAL_ARTICLE',
    'DESIGN_FAMILY', 'RESIN_STYLE', 'WOOD_SPECIES',
    'CUSTOMIZATION_FORM', 'MATERIAL_STORY', 'DESIGN_DIRECTION'
  );
$$;

comment on function public.is_relation_type(text) is
  'The nine relation names Phase 23 fixes, as a predicate both relation tables CHECK against. Category, collection, material and media relations keep their own dedicated tables from Phase 03 and are deliberately absent: a second way to express them would be a second answer to "is this piece in that collection".';

create function public.is_relation_target(value text)
  returns boolean
  language sql
  immutable
  parallel safe
  set search_path = public
as $$
  select value in (
    'product', 'collection', 'portfolio', 'journal', 'material', 'attribute_term'
  );
$$;

comment on function public.is_relation_target(text) is
  'What a relation may point at. Lower-case because `product_relations.target_type` has held lower-case values since Phase 15 and the public renderer filters on them; upper-casing now would silently orphan every hand-curated edge. `attribute_term` is new in Phase 23 and points at product_attribute_terms.';

revoke execute on function public.is_relation_type(text) from public, anon;
revoke execute on function public.is_relation_target(text) from public, anon;

-- --- 3. `product_relations` grows four columns and two constraints ----------------------------------
--
-- The table is EMPTY in every environment at the time this runs, so the CHECKs below are added
-- without a NOT VALID dance. If that ever stops being true the constraint fails loudly at migrate
-- time, which is the correct outcome: an edge whose type is not in the vocabulary is an edge no
-- renderer knows how to draw.

alter table product_relations
  add column origin             relation_origin not null default 'EDITOR',
  add column rule_key           text,
  add column note               text,
  add column paired_relation_id uuid references product_relations (id) on delete set null;

alter table product_relations
  add constraint product_relations_type_vocabulary
    check (public.is_relation_type(relation_type)),
  add constraint product_relations_target_vocabulary
    check (public.is_relation_target(target_type)),
  -- A rule key without a rule origin is a claim nobody can check; a rule origin without a key
  -- loses which rule proposed it, which is the whole audit value of the column.
  add constraint product_relations_rule_key_matches_origin
    check ((origin = 'RULE_ACCEPTED') = (rule_key is not null)),
  add constraint product_relations_note_present
    check (note is null or btrim(note) <> ''),
  add constraint product_relations_no_self
    check (not (target_type = 'product' and target_id = source_product_id));

comment on column product_relations.origin is
  'EDITOR or RULE_ACCEPTED. A rule never writes here; RULE_ACCEPTED means a person pressed Accept on the suggestion named by rule_key.';
comment on column product_relations.paired_relation_id is
  'The inverse edge, for the three reciprocal types. Created in the same transaction and deleted with it, so the two directions cannot drift apart.';

-- `product_relations_unique_edge` already exists from Phase 03 on exactly the four columns the
-- phase document asks for, so there is nothing to add. Named here so a reader looking for it
-- stops looking.

create index product_relations_origin_idx on product_relations (origin, rule_key)
  where origin = 'RULE_ACCEPTED';

-- --- 4. `content_relations` — the same edge, with a non-product source ------------------------------

create table content_relations (
  id                 uuid primary key default gen_random_uuid(),

  source_type        text not null,
  source_id          uuid not null,
  target_type        text not null,
  target_id          uuid not null,
  relation_type      text not null,

  sort_order         int not null default 0,
  origin             relation_origin not null default 'EDITOR',
  rule_key           text,
  note               text,
  paired_relation_id uuid references content_relations (id) on delete set null,

  -- An EDGE, so the Phase 03 join-table shape: who made the connection and when. No `status`,
  -- because an edge that is DRAFT is a state nobody can act on — either an editor made the
  -- connection or they did not — and no seed columns, because nothing seeds a relationship.
  created_at         timestamptz not null default now(),
  created_by         uuid references auth.users (id),

  constraint content_relations_unique_edge
    unique (source_type, source_id, target_type, target_id, relation_type),

  constraint content_relations_source_vocabulary
    check (source_type in ('portfolio_project', 'journal_article', 'collection')),
  constraint content_relations_target_vocabulary
    check (public.is_relation_target(target_type)),
  constraint content_relations_type_vocabulary
    check (public.is_relation_type(relation_type)),
  constraint content_relations_rule_key_matches_origin
    check ((origin = 'RULE_ACCEPTED') = (rule_key is not null)),
  constraint content_relations_note_present
    check (note is null or btrim(note) <> ''),
  constraint content_relations_no_self
    check (not (source_id = target_id))
);

comment on table content_relations is
  'The Phase 23 sibling of product_relations: the same edge with a portfolio project, journal article or collection on the source side. A parallel table rather than a generalisation of product_relations, because two shipped phases index that table''s source_product_id and renaming it would rewrite a working public renderer for no gain.';

create index content_relations_source_idx
  on content_relations (source_type, source_id, relation_type, sort_order);
create index content_relations_target_idx on content_relations (target_type, target_id);
create index content_relations_origin_idx on content_relations (origin, rule_key)
  where origin = 'RULE_ACCEPTED';

-- --- 5. A dismissed suggestion never returns --------------------------------------------------------

create table relation_suppressions (
  id            uuid primary key default gen_random_uuid(),

  source_type   text not null,
  source_id     uuid not null,
  target_type   text not null,
  target_id     uuid not null,
  rule_key      text not null,

  reason        text,
  suppressed_by uuid references auth.users (id),
  suppressed_at timestamptz not null default now(),

  -- The triple is the identity. Dismissing the same suggestion twice is not two facts.
  constraint relation_suppressions_unique
    unique (source_type, source_id, target_type, target_id, rule_key),
  constraint relation_suppressions_source_vocabulary
    check (source_type in ('product', 'portfolio_project', 'journal_article', 'collection')),
  constraint relation_suppressions_target_vocabulary
    check (public.is_relation_target(target_type)),
  constraint relation_suppressions_reason_present
    check (reason is null or btrim(reason) <> '')
);

comment on table relation_suppressions is
  'One row per suggestion an editor dismissed. lib/relations/rules.ts reads this before it proposes anything, so a rejected suggestion never comes back — which is the difference between a suggestions panel people read and one they learn to scroll past.';

create index relation_suppressions_lookup_idx
  on relation_suppressions (source_type, source_id, rule_key);

-- --- 6. Attribute terms — created empty ---------------------------------------------------------------

create table product_attribute_terms (
  id                 uuid primary key default gen_random_uuid(),

  taxonomy           attribute_taxonomy not null,
  slug               citext not null,
  name               text not null,
  description        text,
  sort_order         int not null default 0,

  -- CONTENT, not structure: a term can be PUBLISHED and read by a visitor, so it carries the full
  -- Tier B set and the D10 gate below. That is the entire reason this table is not a lookup list
  -- in TypeScript — "Rivya works in Indian rosewood" is a capability claim and the owner has to
  -- make it, not the repository.
  status             content_status not null default 'DRAFT',
  owner_verification owner_verification not null default 'OWNER_VERIFICATION_REQUIRED',
  fact_classification fact_classification not null default 'PRODUCT_FACT',
  published_at       timestamptz,
  published_by       uuid references auth.users (id),

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  updated_by         uuid references auth.users (id),

  constraint product_attribute_terms_unique_slug unique (taxonomy, slug),
  constraint product_attribute_terms_slug_shape check (slug::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint product_attribute_terms_name_present check (length(btrim(name)) > 0),

  -- D10, the same gate every other publishable table carries.
  constraint product_attribute_terms_verified_before_publish
    check (status <> 'PUBLISHED' or owner_verification <> 'OWNER_VERIFICATION_REQUIRED')
);

comment on table product_attribute_terms is
  'FEAT §10''s three attribute vocabularies — design family, resin style, wood species — in one table with a taxonomy enum. SHIPS WITH ZERO ROWS and no seed module writes it: a term is vocabulary, but attaching it to Rivya asserts a capability, so every term defaults to OWNER_VERIFICATION_REQUIRED and cannot be published until the owner verifies it (D10).';
comment on column product_attribute_terms.owner_verification is
  'Defaults to OWNER_VERIFICATION_REQUIRED rather than NOT_REQUIRED, which is the opposite of most tables and deliberate: the default state of a claim about what this workshop can make is "unconfirmed".';

create index product_attribute_terms_taxonomy_idx
  on product_attribute_terms (taxonomy, sort_order, name);

create trigger product_attribute_terms_set_updated_at
  before update on product_attribute_terms
  for each row execute function set_updated_at();

alter table content_relations enable row level security;
alter table relation_suppressions enable row level security;
alter table product_attribute_terms enable row level security;
