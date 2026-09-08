-- 0030_phase06_media.sql — Phase 06
--
-- Extends the Phase 03 media registry into the full Media Manager entity, and adds the reverse
-- index (`media_usages`) that makes "which slot uses this asset" answerable.
--
-- WHAT THE PHASE DOCUMENT PRESCRIBES THAT THIS FILE DOES NOT DO, AND WHY
--
-- PHASE-05-09.md's Database table lists five steps. Three were checked against the real schema
-- before writing this and turned out to be already satisfied or impossible — following them
-- literally produces a migration that fails on its first statement:
--
--   "rename provider_public_id to public_id"   0005 already named the column `public_id`.
--   "rename storage_folder to folder"          0005 already named it `folder`.
--                                              Both renames error with "column does not exist".
--   "extend media_kind"                        0002 already created all five canonical values.
--   "retype source to media_source"            THERE IS NO `source` COLUMN. 0005 never created
--                                              one, so `alter column source type` errors too.
--                                              It is ADDED below, not retyped.
--
-- The phase document is corrected in place; this note stays because the next reader will find the
-- discrepancy in the same order and should not have to re-derive it.
--
-- `source` IS `not null` WITH NO DEFAULT. The table is empty (0005 creates it empty and nothing
-- has seeded it), so the constraint applies cleanly, and every future insert must state where the
-- asset came from. A default would be worse than an omission: a forgotten `source` would silently
-- become a provenance claim nobody made, which is precisely what D6's priority ladder and D10's
-- no-fabrication rule exist to prevent.

set search_path = public, extensions;

-- ------------------------------------------------------------------------------------------------
-- media_source — the D6 asset-priority ladder, as a type
-- ------------------------------------------------------------------------------------------------
-- Ordered as D6 orders it: real Rivya media → approved user asset → existing Higgsfield asset →
-- existing render → technical fallback. The order is documentation, not behaviour; nothing sorts
-- on it, because enum ordering is a schema property and a preference change should not be a
-- migration.
create type media_source as enum (
  'REAL',
  'USER_UPLOAD',
  'HIGGSFIELD',
  'RENDER',
  'FALLBACK'
);

-- ------------------------------------------------------------------------------------------------
-- media_assets — the Phase 06 column set
-- ------------------------------------------------------------------------------------------------
alter table media_assets
  add column source            media_source not null,

  -- Descriptive. `alt_text` is NOT here: 0005 already made it `not null` and non-empty, which is
  -- the D6 requirement and the SEED §43 rule. `title` and `caption` are optional because an asset
  -- can be catalogued before anyone has written about it; alt text cannot.
  add column title             text,
  add column caption           text,
  add column tags              text[] not null default '{}',
  add column subject_tags      text[] not null default '{}',

  -- Technical. Filled by MediaProvider.probe() from the provider, never from the browser: a client
  -- that uploaded 40 MB can claim 2 MB, and the row would then assert something false about an
  -- asset an owner is making a decision about.
  add column mime_type         text,
  add column bytes             bigint,
  add column checksum          text,
  add column poster_public_id  text,

  -- 3D (FEAT §13). Stored in Phase 06, consumed by the viewer in Phase 21.
  add column model_format      text,
  add column file_size_bytes   bigint,
  add column poly_count        integer,
  add column texture_count     integer,
  add column model_thumbnail_id uuid references media_assets(id) on delete set null,
  add column model_poster_id    uuid references media_assets(id) on delete set null,
  add column associated_product_id uuid references products(id) on delete set null,
  -- portfolio_projects does not exist until Phase 17, so this is an unconstrained uuid for now.
  -- Adding the foreign key later is an `alter table ... add constraint`, which is forward-only;
  -- inventing the table here to satisfy a reference would be Phase 17's work done badly.
  add column associated_project_id uuid,

  -- Higgsfield provenance. Empty until Phase 07 imports the 250 manifest assets.
  add column higgsfield_generation_id text,
  add column higgsfield_model          text,
  add column higgsfield_prompt         text,
  add column manifest_version          text,
  add column migrated_at               timestamptz;

-- A 3D asset without a format cannot be loaded by any viewer, so the row would be undisplayable
-- rather than merely incomplete.
alter table media_assets
  add constraint media_assets_model_format_present
    check (kind <> 'MODEL_3D' or model_format is not null),
  add constraint media_assets_model_format_allowed
    check (model_format is null or model_format in ('GLB', 'GLTF')),
  add constraint media_assets_bytes_positive
    check (bytes is null or bytes > 0);

-- Partial, because the column is null for every asset that did not come from Higgsfield and a
-- plain unique index would allow only one such row in the entire table.
create unique index media_assets_higgsfield_generation_idx
  on media_assets (higgsfield_generation_id)
  where higgsfield_generation_id is not null;

create index media_assets_source_idx on media_assets (source, kind);
create index media_assets_tags_idx on media_assets using gin (tags);
create index media_assets_subject_tags_idx on media_assets using gin (subject_tags);

comment on column media_assets.source is
  'Where the asset came from, per the D6 priority ladder. NOT NULL with no default: a forgotten value would become a provenance claim nobody made.';
comment on column media_assets.associated_project_id is
  'Unconstrained uuid until Phase 17 creates portfolio_projects; the foreign key is added then.';

-- ------------------------------------------------------------------------------------------------
-- media_usages — the reverse index
-- ------------------------------------------------------------------------------------------------
-- WHAT THIS IS FOR. Without it, "which assets are unused" and "which slot is missing media" are
-- answerable only by scanning every block payload in the CMS — which is why FEAT §17's Missing
-- Media card and Phase 07's gap detection are computable rather than guessed.
--
-- ONE ROW PER SLOT PER ROLE, AND NO `position` COLUMN. A repeating slot mints one `slot_key` per
-- item in the indexed form `gallery[0]`, `cards[3].media`. Ordering lives in the block's payload,
-- which is the only thing that may reorder items; this table is a reverse INDEX, so its correct
-- grain is the slot, not the sequence. The Phase 08 trigger rewrites the whole set for a context
-- on each save, so a reorder can neither strand a row nor collide on the unique key.
create table media_usages (
  id            uuid primary key default gen_random_uuid(),
  media_id      uuid not null references media_assets(id) on delete restrict,
  context_type  text not null,
  context_id    uuid not null,
  slot_key      text not null,
  role          text not null,
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id),

  constraint media_usages_context_type_allowed check (
    context_type in ('PAGE_SECTION','PRODUCT','CATEGORY','COLLECTION','PORTFOLIO','JOURNAL','GLOBAL','SEO')
  ),
  constraint media_usages_role_allowed check (
    role in ('DESKTOP','MOBILE','POSTER','THUMBNAIL','GALLERY','OG')
  ),
  constraint media_usages_slot_key_present check (length(btrim(slot_key)) > 0),
  constraint media_usages_unique_slot unique (context_type, context_id, slot_key, role)
);

-- `on delete restrict` above is the delete guard, and it is a foreign key rather than a trigger on
-- purpose: a trigger can be disabled with one statement by anyone who can write a migration, and
-- the guarantee here — an asset bound to a live slot cannot vanish out from under the page that
-- renders it — is worth the stricter mechanism. Unbinding first is the correct order anyway.
create index media_usages_media_idx on media_usages (media_id);
create index media_usages_context_idx on media_usages (context_type, context_id);
create index media_usages_slot_idx on media_usages (slot_key);

alter table media_usages enable row level security;

comment on table media_usages is
  'Reverse index: which slot, on which entity, uses which asset. One row per slot per role; slot_key carries the index for repeating slots. Ordering lives in the block payload, never here.';
comment on constraint media_usages_unique_slot on media_usages is
  'One asset per slot per role. The Phase 08 trigger deletes and rewrites a context''s full set on each save, so a reorder cannot collide here.';
