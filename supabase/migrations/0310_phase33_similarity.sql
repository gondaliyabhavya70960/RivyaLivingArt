-- ============================================================================================
-- 0310 — Phase 33: Visual Similarity — the research-side tables
--
-- "HAVE WE SEEN THIS PICTURE BEFORE?" — answered with 64-bit perceptual hashes and a Hamming
-- distance, never with a claim about the object. Two identical photographs prove a shared image,
-- not a shared product, and nothing in this schema has a column for the second claim.
--
-- THE OWNER'S DECISION, WHICH SHAPES WHAT THESE TABLES HOLD. The phase document proposed
-- amending PHASE-23-30's no-download rule so that competitor image bytes could be fetched once,
-- hashed and discarded. The owner decided otherwise (CANONICAL-DECISIONS A33): competitor images
-- are REFERENCED BY URL AND NEVER FETCHED. So:
--
--   * `research_image_hashes`, the runs, the pairs and the suppressions are created here exactly
--     as DATA_MODEL §12 allocates them, so the schema stays level with the document and a later
--     decision needs no migration — and they hold NO ROWS, because nothing in the repository
--     fetches a competitor's bytes. `research_image_hashing` ships false with a description that
--     says why; `research_sources.image_hashing_enabled` exists and is false everywhere.
--   * The machinery is turned INWARD instead. Migration 0311 creates `media_asset_hashes`, a
--     FIRST-PARTY table, and the upload path hashes Rivya's own uploads against Rivya's own
--     library. That half is live.
--
-- ISOLATION IS UNCHANGED. Every table here references research tables only (I1: the FK allowlist
-- keeps its two entries — there is never a third). No anon policy (I2). `media_asset_hashes` is
-- deliberately in its own migration so a reviewer can see it is not part of this schema, and
-- neither table names the other in any constraint, view or query: the cross-corpus comparison
-- the upload guard performs happens in TypeScript over two ordinary reads.
--
-- CHECKSUM IS INDEXED AND NOT UNIQUE, ON PURPOSE. Two sources listing the same file must produce
-- two rows and one NEAR_DUPLICATE pair at distance 0; collapsing them would delete exactly the
-- fact this phase exists to surface.
-- ============================================================================================

set search_path = public, extensions;

-- --- 1. The band, as an enum: four names, none of which contains the word "same" ------------------

create type similarity_band as enum ('NEAR_DUPLICATE', 'PROBABLE_VARIANT', 'WEAK', 'FORM_SIMILAR');

comment on type similarity_band is
  'Phase 33. What a pair distance may claim. NEAR_DUPLICATE: the same image file or a re-encode, '
  'resize or mild crop of it. PROBABLE_VARIANT: very likely the same shoot or listing family. '
  'WEAK: similar composition or palette and nothing about the object. FORM_SIMILAR: embedding '
  'cosine, low precision, flag-gated. None of them means the same product.';

-- --- 2. The per-source opt-in, mirroring the Phase 25 gate on is_enabled -------------------------

alter table research_sources
  add column image_hashing_enabled boolean not null default false,
  add constraint research_sources_image_hashing_needs_approval
    check (image_hashing_enabled = false or policy_status = 'APPROVED');

comment on column research_sources.image_hashing_enabled is
  'Phase 33. Whether this source may have its image URLs fetched for hashing. Requires an APPROVED '
  'policy review, exactly as is_enabled does, and research.write AND system.settings.write to set. '
  'Under amendment A33 nothing in the repository fetches competitor bytes, so this is false '
  'everywhere and a run reports SOURCE_OPT_OUT for every source; it exists so the schema is level '
  'with the phase document should the owner ever accept the fetch-to-hash amendment.';

-- --- 3. Research-side hashes: one row per (product, image URL), never per file -------------------

create table research_image_hashes (
  id                   uuid primary key default gen_random_uuid(),
  research_product_id  uuid not null references research_products (id) on delete cascade,
  source_id            uuid not null references research_sources (id) on delete cascade,
  source_image_url     text not null,
  -- SHA-256 of the normalised URL: the idempotency key. A URL already hashed for a product is
  -- never re-fetched; --rehash is the only way to make a second request for it.
  source_image_key     text not null,
  position             integer not null default 0,
  -- SHA-256 of the fetched bytes. Indexed, NOT unique (see the header).
  checksum             text not null,
  phash                bit(64) not null,
  dhash                bit(64) not null,
  fetch_id             uuid references research_fetches (id) on delete set null,
  computed_at          timestamptz not null default now(),

  constraint research_image_hashes_url_not_blank check (btrim(source_image_url) <> ''),
  constraint research_image_hashes_key_shape check (source_image_key ~ '^[0-9a-f]{64}$'),
  constraint research_image_hashes_checksum_shape check (checksum ~ '^[0-9a-f]{64}$'),
  constraint research_image_hashes_position_nonneg check (position >= 0),
  constraint research_image_hashes_one_per_url unique (research_product_id, source_image_key)
);

create index research_image_hashes_checksum_idx on research_image_hashes (checksum);
create index research_image_hashes_prefix_idx
  on research_image_hashes (substring(phash from 1 for 16));
create index research_image_hashes_source_idx on research_image_hashes (source_id);

comment on table research_image_hashes is
  'Phase 33. The 64-bit pHash and dHash and the SHA-256 of one competitor image, keyed to the '
  'research product and the normalised URL. The bytes are never kept in any form: no file, no '
  'storage object, no thumbnail, no width, no height. Under amendment A33 nothing fetches them, so '
  'this table holds no rows. Service-role writes only; no anon policy (I2).';

-- --- 4. Runs: a scope, a method, and honest counts -----------------------------------------------

create table research_similarity_runs (
  id                uuid primary key default gen_random_uuid(),
  scope_type        text not null,
  scope_id          uuid,
  method            text not null,
  model_name        text,
  status            text not null default 'RUNNING',
  images_fetched    integer not null default 0,
  images_hashed     integer not null default 0,
  -- source slug → skip reason (FLAG_OFF, SOURCE_OPT_OUT, KILL_SWITCH, NOT_BUILT, ...)
  sources_skipped   jsonb not null default '{}'::jsonb,
  pairs_considered  bigint not null default 0,
  pairs_stored      integer not null default 0,
  pairs_exact       integer not null default 0,
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  error_code        text,
  created_by        uuid references auth.users (id) on delete set null,

  constraint research_similarity_runs_scope_allowlist
    check (scope_type in ('CORPUS', 'SOURCE', 'SET', 'PRODUCT', 'MEDIA_ASSET')),
  constraint research_similarity_runs_method_allowlist
    check (method in ('PHASH', 'EMBEDDING')),
  constraint research_similarity_runs_status_allowlist
    check (status in ('RUNNING', 'SUCCEEDED', 'FAILED')),
  constraint research_similarity_runs_finished_is_dated
    check ((status = 'RUNNING') = (finished_at is null)),
  constraint research_similarity_runs_error_only_when_failed
    check (status = 'FAILED' or error_code is null),
  constraint research_similarity_runs_skipped_is_object
    check (jsonb_typeof(sources_skipped) = 'object'),
  constraint research_similarity_runs_counts_nonneg
    check (images_fetched >= 0 and images_hashed >= 0 and pairs_considered >= 0
           and pairs_stored >= 0 and pairs_exact >= 0),
  constraint research_similarity_runs_exact_within_stored
    check (pairs_exact <= pairs_stored or scope_type = 'MEDIA_ASSET'),
  -- A Rivya-versus-research (or Rivya-versus-Rivya) comparison returns its verdict to the caller
  -- and stores no pair row: the pairs table references research hashes on both sides by design,
  -- and there is nowhere in the schema for a cross-corpus pair to live. That is deliberate.
  constraint research_similarity_runs_media_scope_stores_no_pairs
    check (scope_type <> 'MEDIA_ASSET' or pairs_stored = 0),
  constraint research_similarity_runs_embedding_names_model
    check (method <> 'EMBEDDING' or model_name is not null)
);

create index research_similarity_runs_started_idx on research_similarity_runs (started_at desc);

comment on table research_similarity_runs is
  'Phase 33. One similarity run: scope, method, and the counts that make its cost and its coverage '
  'visible — images fetched (always 0 under A33), hashed, pairs considered by the blocking rule, '
  'pairs stored, and exact (distance 0) matches counted separately. A MEDIA_ASSET scope stores no '
  'pairs. Insert requires research.similarity.run; no anon policy (I2).';

-- --- 5. Pairs: ordered, unique per run, banded by the distance they carry ------------------------

create table research_similarity_pairs (
  id             uuid primary key default gen_random_uuid(),
  run_id         uuid not null references research_similarity_runs (id) on delete cascade,
  left_hash_id   uuid not null references research_image_hashes (id) on delete cascade,
  right_hash_id  uuid not null references research_image_hashes (id) on delete cascade,
  method         text not null,
  distance       integer,
  cosine         numeric(5,4),
  band           similarity_band not null,
  created_at     timestamptz not null default now(),

  -- Mirrored pairs cannot exist: (a, b) is stored once, with the smaller id on the left.
  constraint research_similarity_pairs_ordered check (left_hash_id < right_hash_id),
  constraint research_similarity_pairs_unique unique (run_id, left_hash_id, right_hash_id),
  constraint research_similarity_pairs_method_allowlist check (method in ('PHASH', 'EMBEDDING')),
  constraint research_similarity_pairs_measure_matches_method
    check ((method = 'PHASH' and distance is not null and cosine is null)
        or (method = 'EMBEDDING' and cosine is not null and distance is null)),
  -- Pairs beyond the WEAK ceiling are discarded, not stored; the table refuses one.
  constraint research_similarity_pairs_distance_within_ceiling
    check (distance is null or (distance >= 0 and distance <= 18)),
  -- The band is a function of the distance, and the table holds the function too, so a stored
  -- pair cannot carry a band its own distance contradicts.
  constraint research_similarity_pairs_band_matches_distance
    check (distance is null or band = (case
      when distance <= 6  then 'NEAR_DUPLICATE'::similarity_band
      when distance <= 12 then 'PROBABLE_VARIANT'::similarity_band
      else 'WEAK'::similarity_band end)),
  constraint research_similarity_pairs_cosine_is_form_similar
    check (cosine is null or (cosine >= 0.86 and cosine <= 1 and band = 'FORM_SIMILAR'))
);

create index research_similarity_pairs_run_idx on research_similarity_pairs (run_id, band);
create index research_similarity_pairs_left_idx on research_similarity_pairs (left_hash_id);
create index research_similarity_pairs_right_idx on research_similarity_pairs (right_hash_id);

comment on table research_similarity_pairs is
  'Phase 33. Two research hashes, a distance and the band that distance earns. Both sides are '
  'research hashes by design: a Rivya asset never appears here. A pair says two IMAGES are alike; '
  'no column exists for "the same product". Service-role writes only; no anon policy (I2).';

-- --- 6. Suppressions: "this pair is not interesting", remembered ---------------------------------

create table research_similarity_suppressions (
  id             uuid primary key default gen_random_uuid(),
  left_hash_id   uuid not null references research_image_hashes (id) on delete cascade,
  right_hash_id  uuid not null references research_image_hashes (id) on delete cascade,
  reason         text not null,
  created_at     timestamptz not null default now(),
  created_by     uuid not null references auth.users (id) on delete restrict,

  constraint research_similarity_suppressions_ordered check (left_hash_id < right_hash_id),
  constraint research_similarity_suppressions_reason_not_blank check (btrim(reason) <> ''),
  constraint research_similarity_suppressions_unique unique (left_hash_id, right_hash_id)
);

comment on table research_similarity_suppressions is
  'Phase 33. A dismissed pair, with the reason and the person. A suppressed pair never resurfaces '
  'on a later run. Written under research.write; no anon policy (I2).';

-- --- 7. Row security on, policies in 0313 --------------------------------------------------------

alter table research_image_hashes             enable row level security;
alter table research_similarity_runs          enable row level security;
alter table research_similarity_pairs         enable row level security;
alter table research_similarity_suppressions  enable row level security;
