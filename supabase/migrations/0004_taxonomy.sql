-- 0004_taxonomy.sql — Phase 03
--
-- categories, collections, materials: the three tables the taxonomy seed writes to.
--
-- Every table here carries the three common column tiers from DATA_MODEL.md §1.2, written out
-- in full rather than applied by a helper function. A helper would be shorter, but migrations
-- are forward-only and CI re-applies them all to an empty database — so a later edit to a
-- shared helper would retroactively change what this migration created. Written out, each
-- table's shape is fixed by the migration that created it. tests/unit/db/common-columns asserts
-- the three tiers are actually identical across tables, which is the guarantee the helper would
-- have provided.
--
--   Tier A (audit)   created_at, updated_at, updated_by
--   Tier B (content) status, owner_verification, fact_classification, published_at, published_by
--   Tier C (seed)    seed_key, content_seed_version, seed_content_hash, seed_last_applied_at,
--                    owner_edited
--
-- Tier C uses `content_seed_version`, not the `seed_version` the phase document spells, per
-- DATA_MODEL.md §1.8 correction C2. Only content_seed_runs.seed_version keeps the short name,
-- because it records a run rather than a row.
--
-- `owner_edited` is created here but nothing sets it in Phase 03. Its trigger, set_owner_edited(),
-- belongs to Phase 08 (DATA_MODEL.md §8.8). The Phase 03 seed runner does not depend on it: it
-- distinguishes an owner edit by comparing a content hash (§1.6 rules 4-5), which works from the
-- first seed onward and needs no trigger. The column exists now so Phase 08 adds a trigger to a
-- column that is already there, not a column and a trigger at once.
--
-- hero_media_id is declared here WITHOUT its foreign key. media_assets is created in 0005, and
-- migrations are forward-only, so 0005 adds the constraint once its target exists. The column is
-- not usable before then in any case: both tables ship empty.

-- ---------------------------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------------------------
-- The seven D3 categories, in priority order. Seeded by content/seed/taxonomy.ts with slug, name
-- and order only; descriptions are EDITORIAL_COPY added by an owner or by the Phase 09 seed.
-- Extension objects (citext, unaccent, gin_trgm_ops) are resolved through this search_path.
-- Supabase installs extensions into the `extensions` schema; a plain cluster installs them into
-- `public`. Naming both means these migrations apply unmodified to either, which they did NOT
-- before: with unaccent in `extensions`, 0003 failed at CREATE time with
--   ERROR: text search dictionary "unaccent" does not exist
-- and 0004-0006 would have failed the same way on the `citext` type. See docs/ops/ENVIRONMENT.md.
set search_path = public, extensions;

create table categories (
  id                    uuid primary key default gen_random_uuid(),
  slug                  citext not null unique,
  parent_id             uuid references categories(id) on delete set null,
  name                  text not null,
  subtitle              text,
  description           text,
  -- Also the merchandising order Phase 22 reuses. There is deliberately no second order column.
  sort_order            int not null default 0,
  -- A primary category appears in the mega menu; a sub-category does not.
  is_primary            boolean not null default true,
  hero_media_id         uuid,
  seo_title             text,
  seo_description       text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  updated_by            uuid references auth.users(id),

  status                content_status not null default 'DRAFT',
  owner_verification    owner_verification not null default 'NOT_REQUIRED',
  fact_classification   fact_classification,
  published_at          timestamptz,
  published_by          uuid references auth.users(id),

  seed_key              text unique,
  content_seed_version  text,
  seed_content_hash     text,
  seed_last_applied_at  timestamptz,
  owner_edited          boolean not null default false,

  -- A category cannot be its own parent. Deeper cycles are not reachable through the Studio,
  -- which only offers primary categories as parents, and a recursive check would cost a query
  -- on every write to buy protection against a shape no surface can produce.
  constraint categories_parent_not_self check (parent_id is null or parent_id <> id),
  -- D10, enforced in the database rather than in review: an unverified claim cannot be published.
  constraint categories_verified_before_publish check (
    status <> 'PUBLISHED' or owner_verification <> 'OWNER_VERIFICATION_REQUIRED'
  )
);

create trigger categories_set_updated_at
  before update on categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- collections
-- ---------------------------------------------------------------------------------------------
-- Exhibitions, not filtered grids. The ten concept names may be seeded ONLY as
-- DRAFT_COLLECTION_CONCEPT (requirement §9); the enum currently holds no other value, so the
-- database enforces that on its own until Phase 16 adds OWNER_CONFIRMED and the publish gate.
create table collections (
  id                    uuid primary key default gen_random_uuid(),
  slug                  citext not null unique,
  name                  text not null,
  statement             text,
  concept_state         collection_concept_state not null default 'DRAFT_COLLECTION_CONCEPT',
  hero_media_id         uuid,
  sort_order            int not null default 0,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  updated_by            uuid references auth.users(id),

  status                content_status not null default 'DRAFT',
  owner_verification    owner_verification not null default 'NOT_REQUIRED',
  fact_classification   fact_classification,
  published_at          timestamptz,
  published_by          uuid references auth.users(id),

  seed_key              text unique,
  content_seed_version  text,
  seed_content_hash     text,
  seed_last_applied_at  timestamptz,
  owner_edited          boolean not null default false,

  constraint collections_verified_before_publish check (
    status <> 'PUBLISHED' or owner_verification <> 'OWNER_VERIFICATION_REQUIRED'
  )
);

create trigger collections_set_updated_at
  before update on collections
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- materials
-- ---------------------------------------------------------------------------------------------
-- `family` is a check-constrained text column rather than an enum (DATA_MODEL.md §2.1): the
-- vocabulary is narrow and local, and a check constraint can be replaced in place where an enum
-- value needs its own migration transaction.
--
-- `description` is EDITORIAL_COPY. D10 forbids a durability, certification or performance claim
-- in it; that is a content rule the seed and review enforce, not something a column type can.
create table materials (
  id                    uuid primary key default gen_random_uuid(),
  slug                  citext not null unique,
  name                  text not null,
  family                text not null,
  description           text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  updated_by            uuid references auth.users(id),

  status                content_status not null default 'DRAFT',
  owner_verification    owner_verification not null default 'NOT_REQUIRED',
  fact_classification   fact_classification,
  published_at          timestamptz,
  published_by          uuid references auth.users(id),

  seed_key              text unique,
  content_seed_version  text,
  seed_content_hash     text,
  seed_last_applied_at  timestamptz,
  owner_edited          boolean not null default false,

  constraint materials_family_allowed check (
    family in ('resin', 'timber', 'metal', 'stone', 'finish')
  ),
  constraint materials_verified_before_publish check (
    status <> 'PUBLISHED' or owner_verification <> 'OWNER_VERIFICATION_REQUIRED'
  )
);

create trigger materials_set_updated_at
  before update on materials
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------------------------
-- Enabled with NO policy. RLS with no policy denies everything to anon and authenticated, which
-- is the intended state until Phase 04 grants access deliberately. The service role bypasses RLS,
-- which is how the seed runner and the migration tooling still reach these tables.
alter table categories  enable row level security;
alter table collections enable row level security;
alter table materials   enable row level security;
