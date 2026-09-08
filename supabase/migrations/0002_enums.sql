-- 0002_enums.sql — Phase 03
--
-- The six enums DATA_MODEL.md §2 marks "Created 03". Values are stored exactly as the enum
-- catalogue spells them; the application never invents a seventh value at runtime.
--
-- Two enums are deliberately shorter here than their final form. Both are recorded in
-- DATA_MODEL.md §2 as extended by a later phase, and both extensions are `alter type ... add
-- value`, which is why they can be deferred without a rewrite:
--
--   price_state              Phase 14 adds FIXED, together with products.price_minor and the
--                            three-branch coherence constraint. See the deferral note in
--                            supabase/migrations/0006_catalog.sql.
--   collection_concept_state Phase 16 adds OWNER_CONFIRMED and RETIRED, together with the
--                            publish gate that requires OWNER_CONFIRMED.
--
-- media_source is NOT created here even though media_assets is. DATA_MODEL.md §2 fixes its
-- creation at Phase 06, where the D6 priority ladder it encodes is actually implemented; see
-- the deferral note in 0005_media_registry.sql.

-- Publication lifecycle. Every Tier-B (content-bearing) table carries one.
create type content_status as enum (
  'DRAFT',
  'REVIEW',
  'APPROVED',
  'PUBLISHED',
  'ARCHIVED'
);

-- D10's gate. OWNER_VERIFICATION_REQUIRED makes PUBLISHED unreachable while it stands.
create type owner_verification as enum (
  'NOT_REQUIRED',
  'OWNER_VERIFICATION_REQUIRED',
  'VERIFIED'
);

-- What kind of claim a piece of text makes. Marketing language must never be stored as a
-- PRODUCT_FACT or a VERIFIED_BUSINESS_FACT (D10).
create type fact_classification as enum (
  'BRAND_COPY',
  'EDITORIAL_COPY',
  'VERIFIED_BUSINESS_FACT',
  'PRODUCT_FACT',
  'SEO_COPY',
  'LEGAL_COPY'
);

create type media_kind as enum (
  'IMAGE',
  'VIDEO',
  'MODEL_3D',
  'DOCUMENT',
  'BRAND'
);

-- No FIXED. See the note above and 0006_catalog.sql.
create type price_state as enum (
  'STARTING_FROM',
  'REQUEST_QUOTE',
  'PRICE_ON_REQUEST'
);

-- A single value on purpose: a seeded collection concept is the only state that exists until
-- an owner confirms one (requirement §9). Phase 16 adds the states that follow.
create type collection_concept_state as enum (
  'DRAFT_COLLECTION_CONCEPT'
);
