-- 0006_catalog.sql — Phase 03
--
-- products and its four edge tables.
--
-- products ships with ZERO ROWS and always will under seed policy (requirement §32,
-- DATA_MODEL.md §1.3). A product exists because an owner typed it or because an approved import
-- created it; neither path reads a research table. Nothing in this repository may insert one.
--
-- ---------------------------------------------------------------------------------------------
-- The price_state deferral, recorded so a later reader finds a decision and not a gap
-- ---------------------------------------------------------------------------------------------
-- `FIXED` is deliberately absent from price_state, and price_minor is deliberately absent from
-- this table. Requirement §23 FAQ 09 and §30 both promise a fixed-price presentation, so a firm
-- price must eventually be representable — but it is not representable here, and does not need
-- to be:
--
--   * products ships empty, so no row can want the state;
--   * there is no owner entry surface until Phase 14;
--   * DATA_MODEL.md places price_minor, availability_state and edition_state together in Phase 14
--     migrations 0120-0122.
--
-- Deferring keeps one migration responsible for the whole price model instead of splitting it
-- across eleven phases. Phase 14 drops products_price_state_coherent and recreates it with three
-- branches; note that it must also TIGHTEN the two branches below with `price_minor is null`,
-- which is why the target form is written out in the phase document rather than left to be
-- rederived. Phase 03 verification asserts `FIXED` does not exist; Phase 14 inverts that
-- assertion.

-- Extension objects (citext, unaccent, gin_trgm_ops) are resolved through this search_path.
-- Supabase installs extensions into the `extensions` schema; a plain cluster installs them into
-- `public`. Naming both means these migrations apply unmodified to either, which they did NOT
-- before: with unaccent in `extensions`, 0003 failed at CREATE time with
--   ERROR: text search dictionary "unaccent" does not exist
-- and 0004-0006 would have failed the same way on the `citext` type. See docs/ops/ENVIRONMENT.md.
set search_path = public, extensions;

create table products (
  id                    uuid primary key default gen_random_uuid(),
  slug                  citext not null unique,
  sku                   citext unique,
  title                 text,
  subtitle              text,
  summary               text,
  description           text,

  -- `on delete restrict`: a category with products in it cannot be deleted out from under them.
  category_id           uuid references categories(id) on delete restrict,

  price_state           price_state not null,
  price_from_minor      bigint,
  currency              char(3),

  -- Drives /large-format. A boolean rather than a category, because a large-format piece keeps
  -- its own category as well.
  is_large_format       boolean not null default false,

  -- Owner-entered only. Phase 15 adds the shape constraint; nothing writes this in Phase 03,
  -- which is the point — a defaulted dimension is a fabricated measurement (D10).
  dimensions            jsonb,

  hero_media_id         uuid references media_assets(id) on delete set null,
  model_media_id        uuid references media_assets(id) on delete set null,

  seo_title             text,
  seo_description       text,

  -- The publication checklist: a transparent list of booleans, never an opaque score.
  publication_readiness jsonb not null default '{}',

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  updated_by            uuid references auth.users(id),

  status                content_status not null default 'DRAFT',
  owner_verification    owner_verification not null default 'NOT_REQUIRED',
  fact_classification   fact_classification,
  published_at          timestamptz,
  published_by          uuid references auth.users(id),

  -- Tier C in full, so "Tier C" means one set everywhere and can be asserted as one set.
  -- On this table seed_key is always null: no seed module writes a product, ever.
  seed_key              text unique,
  content_seed_version  text,
  seed_content_hash     text,
  seed_last_applied_at  timestamptz,
  owner_edited          boolean not null default false,

  -- A quote-only product must never be representable as zero (requirement §21). The failure this
  -- prevents is a "₹0" rendering on a piece whose price is a conversation.
  constraint products_price_state_coherent check (
       (price_state = 'STARTING_FROM'
          and price_from_minor is not null and price_from_minor > 0
          and currency is not null)
    or (price_state in ('REQUEST_QUOTE', 'PRICE_ON_REQUEST')
          and price_from_minor is null
          and currency is null)
  ),

  -- ISO-4217 shape. Not a list of real codes: that changes without warning and belongs in the
  -- application, where it can be updated without a migration.
  constraint products_currency_shape check (
    currency is null or currency ~ '^[A-Z]{3}$'
  ),

  constraint products_verified_before_publish check (
    status <> 'PUBLISHED' or owner_verification <> 'OWNER_VERIFICATION_REQUIRED'
  )
);

create trigger products_set_updated_at
  before update on products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Edge tables
-- ---------------------------------------------------------------------------------------------
-- All four carry created_at and created_by only (DATA_MODEL.md §6): they are edges, not content,
-- and giving them a content_status would imply a publication workflow that does not exist. Their
-- visibility follows the parent product's.

create table product_collections (
  product_id     uuid not null references products(id) on delete cascade,
  collection_id  uuid not null references collections(id) on delete cascade,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  created_by     uuid references auth.users(id),
  primary key (product_id, collection_id)
);

create table product_materials (
  product_id   uuid not null references products(id) on delete cascade,
  material_id  uuid not null references materials(id) on delete cascade,
  note         text,
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id),
  primary key (product_id, material_id)
);

-- `role` takes the seven-value vocabulary DATA_MODEL.md §2.1 fixes for product_media.role and
-- portfolio_project_media.role. The Phase 03 document lists six, omitting `process`; §2.1 names
-- this column explicitly, so its list governs. Recorded as correction C10 in DATA_MODEL.md §1.8.
-- A check constraint rather than an enum precisely so this can be replaced in place if it is
-- wrong (DATA_MODEL.md §2.1).
--
-- Phase 14 adds reject_concept_product_media(): no row here may point at an asset with
-- is_concept = true. It is a trigger rather than a constraint because it reads another table.
create table product_media (
  product_id      uuid not null references products(id) on delete cascade,
  media_asset_id  uuid not null references media_assets(id) on delete cascade,
  role            text,
  sort_order      int,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id),
  primary key (product_id, media_asset_id),
  constraint product_media_role_allowed check (
    role is null or role in ('hero', 'gallery', 'detail', 'lifestyle', 'process', 'video', 'model')
  )
);

-- The product-sourced half of the relationship engine. Phase 23 builds the engine on top of this
-- table; it never auto-creates an edge without a stated, named rule, and an editor can always
-- override. `target_id` is deliberately un-foreign-keyed: the target may be a product, a
-- collection, a category or a journal article, and a polymorphic edge cannot name one parent.
-- Phase 23 adds `origin`, `rule_key`, `note` and `paired_relation_id`.
create table product_relations (
  id                 uuid primary key default gen_random_uuid(),
  source_product_id  uuid not null references products(id) on delete cascade,
  target_type        text not null,
  target_id          uuid not null,
  relation_type      text not null,
  sort_order         int not null default 0,
  created_at         timestamptz not null default now(),
  created_by         uuid references auth.users(id),
  constraint product_relations_unique_edge
    unique (source_product_id, target_type, target_id, relation_type)
);

alter table products            enable row level security;
alter table product_collections enable row level security;
alter table product_materials   enable row level security;
alter table product_media       enable row level security;
alter table product_relations   enable row level security;
