-- 0005_media_registry.sql — Phase 03
--
-- The minimal media_assets registry. Cloudinary is the origin of the bytes; this row is the
-- meaning. DATA_MODEL.md marks the table "Phase 03 (0005), completed Phase 06 (0030)", so this
-- migration creates identity, the three mandatory D6 governance columns and the technical facts
-- a slot needs to reserve space — and stops there.
--
-- Deferred to Phase 06 (`0030`), each for a stated reason rather than by omission:
--
--   source media_source     DATA_MODEL.md §2 fixes the media_source enum's creation at Phase 06,
--                           where the D6 priority ladder it encodes is implemented. The column is
--                           `not null`; adding it once, with its enum, beats creating a `text`
--                           column here and converting it there.
--   higgsfield_* provenance DATA_MODEL.md §7 labels the whole provenance group "columns added by
--                           Phase 06 (0030), populated by Phase 07 (0040)".
--   tags, subject_tags      The carriers for the manifest's family/page/section scopes. They are
--                           declared with the GIN indexes that make them answerable, in the phase
--                           that imports the data those indexes serve.
--   title, caption, mime_type, bytes, poster_public_id, checksum
--                           Cloudinary delivery metadata, written by the migration script.
--   3D columns (Phase 21), is_decorative (Phase 41)
--
-- The table ships with zero rows, so none of the above is reachable before Phase 06 in any case.
-- The 250 Higgsfield assets are imported by Phase 07, never by a migration.

create table media_assets (
  id                    uuid primary key default gen_random_uuid(),

  -- Identity. `rivya_asset_id` is authoritative, not the filename (D6).
  provider              text not null default 'cloudinary',
  -- NOT NULL, where DATA_MODEL.md §7 leaves it nullable. The stated identity key is
  -- (provider, resource_type, public_id), and a nullable column cannot carry a unique key:
  -- two NULLs never conflict, so the same public_id could be inserted twice. Recorded as
  -- correction C9 in DATA_MODEL.md §1.8.
  resource_type         text not null,
  public_id             text not null,
  folder                text not null,
  filename              text,
  rivya_asset_id        citext unique,
  kind                  media_kind not null,

  -- D6 makes these three mandatory on every row. They are the whole reason this table exists
  -- rather than the application reading Cloudinary directly.
  alt_text              text not null,
  is_ai_generated       boolean not null,
  is_concept            boolean not null,

  -- Technical facts a layout needs before the image loads, so a slot can reserve its space.
  width                 int,
  height                int,
  aspect_ratio          text,
  duration_s            numeric,

  uploaded_by           uuid references auth.users(id),

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  updated_by            uuid references auth.users(id),

  status                content_status not null default 'DRAFT',
  owner_verification    owner_verification not null default 'NOT_REQUIRED',
  fact_classification   fact_classification,
  published_at          timestamptz,
  published_by          uuid references auth.users(id),

  -- Cloudinary's own vocabulary, kept verbatim (DATA_MODEL.md §2.1).
  constraint media_assets_resource_type_allowed check (
    resource_type in ('image', 'video', 'raw')
  ),

  -- Cloudinary namespaces public IDs by resource type: image/upload/<id> and video/upload/<id>
  -- are different objects. The key describes that model rather than a property of one manifest
  -- build, so a poster/clip pair uploaded under one name stays insertable without a migration.
  constraint media_assets_provider_identity unique (provider, resource_type, public_id),

  -- A present-but-blank alt text is the failure this catches; `not null` alone does not.
  -- Phase 41 relaxes this to `is_decorative or (...)` when it adds that column.
  constraint media_assets_alt_text_present check (length(btrim(alt_text)) > 0),

  -- A video with no duration cannot have its player sized or its poster timed.
  constraint media_assets_video_has_duration check (
    kind <> 'VIDEO' or duration_s is not null
  ),

  constraint media_assets_verified_before_publish check (
    status <> 'PUBLISHED' or owner_verification <> 'OWNER_VERIFICATION_REQUIRED'
  )
);

create trigger media_assets_set_updated_at
  before update on media_assets
  for each row execute function public.set_updated_at();

alter table media_assets enable row level security;

-- ---------------------------------------------------------------------------------------------
-- The foreign keys 0004 could not declare
-- ---------------------------------------------------------------------------------------------
-- categories and collections each carry hero_media_id, but they are created in 0004 and this is
-- the migration that creates their target. Migrations are forward-only, so the constraint is
-- added here rather than by editing 0004. Both tables are empty, so the constraint validates
-- against nothing and cannot fail.
alter table categories
  add constraint categories_hero_media_id_fkey
  foreign key (hero_media_id) references media_assets(id) on delete set null;

alter table collections
  add constraint collections_hero_media_id_fkey
  foreign key (hero_media_id) references media_assets(id) on delete set null;
