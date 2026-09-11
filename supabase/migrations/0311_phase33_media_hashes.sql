-- ============================================================================================
-- 0311 — Phase 33: `media_asset_hashes` — a FIRST-PARTY table, in its own migration on purpose
--
-- This is not part of the research schema, and a reviewer should be able to see that from the
-- file list. It hashes RIVYA'S OWN library so that:
--
--   * a manifest asset cannot be re-uploaded as if it were new photography — the upload guard
--     refuses a file whose pHash is within 6 bits of an asset already here, or whose SHA-256
--     matches one exactly, and names the existing asset id in the refusal;
--   * a competitor's photograph can never quietly become Rivya media — the same guard compares
--     the upload against `research_image_hashes` (empty under amendment A33, but the read is
--     wired) in application code, over two ordinary reads, with no join and no foreign key.
--
-- I1 IS WHY THIS TABLE EXISTS SEPARATELY. A `research_*` table may not reference `media_assets`,
-- and `check-research-isolation.mjs` fails the build on a third boundary-crossing constraint. So
-- Rivya-side hashes live here, owned by `lib/media/`, referencing `media_assets` as any
-- first-party table may; research-side hashes reference research tables; neither names the other.
--
-- VIDEO ROWS CARRY NULL HASHES. A perceptual hash over an 8×8 / 32×32 gray reduction is defined
-- for a still image and for nothing else; one frame of a video called "the hash of the video"
-- would be a fabricated measurement. A video row carries `kind = 'VIDEO'`, its SHA-256 and null
-- pHash/dHash, and the guard catches a re-uploaded video only by exact bytes.
--
-- CHECKSUM IS INDEXED, NOT UNIQUE — the same reason as 0310: the one case the guard is built for
-- is a Rivya asset that happens to be byte-identical to a research image, and both rows must be
-- allowed to exist on their own sides.
-- ============================================================================================

set search_path = public, extensions;

create table media_asset_hashes (
  id              uuid primary key default gen_random_uuid(),
  media_asset_id  uuid not null unique references media_assets (id) on delete cascade,
  kind            text not null,
  checksum        text not null,
  phash           bit(64),
  dhash           bit(64),
  computed_at     timestamptz not null default now(),

  constraint media_asset_hashes_kind_allowlist check (kind in ('IMAGE', 'VIDEO')),
  constraint media_asset_hashes_checksum_shape check (checksum ~ '^[0-9a-f]{64}$'),
  -- An image has a perceptual hash; a video does not. Both directions.
  constraint media_asset_hashes_image_has_phash check ((kind = 'IMAGE') = (phash is not null)),
  constraint media_asset_hashes_hashes_together check ((phash is null) = (dhash is null))
);

create index media_asset_hashes_checksum_idx on media_asset_hashes (checksum);
create index media_asset_hashes_prefix_idx
  on media_asset_hashes (substring(phash from 1 for 16)) where phash is not null;

comment on table media_asset_hashes is
  'Phase 33. The SHA-256 and, for an image, the 64-bit pHash and dHash of one Rivya media asset. '
  'First-party: owned by lib/media, referencing media_assets, never joined to any research table. '
  'Read under media.read; written by the service role only (the upload path and npm run '
  'media:hash). A hash is not published content, so there is no anon policy.';

alter table media_asset_hashes enable row level security;
