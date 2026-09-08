-- 0008_indexes.sql — Phase 03
--
-- Performance indexes only.
--
-- Unique constraints are NOT here: `slug citext unique`, the media identity key and the
-- product_relations edge key are data rules and live in the migration that creates the table, so
-- a reader of that table sees its whole contract in one place. This file holds the indexes that
-- are a performance choice and could be dropped without changing what the data means.
--
-- PostgreSQL indexes a table's primary key and unique constraints automatically. It does NOT
-- index foreign key columns, which is why the FK indexes below exist: without them, deleting one
-- media asset sequentially scans every table that references it, and each `on delete cascade`
-- does the same.
--
-- Two indexes DATA_MODEL.md §6 specifies cannot be created in full here, because they name Phase
-- 14 columns. Both are created in their Phase 03 form and must be DROPPED AND RECREATED by Phase
-- 14 rather than merely added to — recorded here so that phase finds an instruction, not a gap:
--
--   products_listing_idx  final: (category_id, status, sort_order nulls last, published_at desc)
--                         here:  (category_id, status, published_at desc)   -- no sort_order yet
--   products_facets_idx   final: (status, is_large_format, price_state, availability_state,
--                                 edition_state)
--                         here:  (status, is_large_format, price_state)     -- no state cols yet

-- categories ------------------------------------------------------------------------------------
-- The Studio's tree view: children of a parent, in order.
create index categories_parent_sort_idx on categories (parent_id, sort_order);
-- The public mega menu: published categories, in order.
create index categories_status_sort_idx on categories (status, sort_order);
-- The seed runner's lookup, once per seed_key per run.
create index categories_seed_key_idx on categories (seed_key);
create index categories_hero_media_idx on categories (hero_media_id);

-- collections -----------------------------------------------------------------------------------
create index collections_status_sort_idx on collections (status, sort_order);
create index collections_seed_key_idx on collections (seed_key);
create index collections_hero_media_idx on collections (hero_media_id);

-- materials -------------------------------------------------------------------------------------
create index materials_family_idx on materials (family);
create index materials_seed_key_idx on materials (seed_key);

-- media_assets ----------------------------------------------------------------------------------
create index media_assets_kind_status_idx on media_assets (kind, status);
create index media_assets_folder_idx on media_assets (folder);
-- Partial: concept assets are the ones Phase 14's reject_concept_product_media() must find, and
-- they are a minority of rows, so the index stays small.
create index media_assets_is_concept_idx on media_assets (is_concept) where is_concept;
-- Trigram: an editor searching the media library for "walnt" still finds "walnut".
create index media_assets_filename_trgm_idx on media_assets using gin (filename gin_trgm_ops);
create index media_assets_uploaded_by_idx on media_assets (uploaded_by);

-- products --------------------------------------------------------------------------------------
-- The category listing page, ordered as it is rendered. Phase 14 replaces this with the
-- four-column form once sort_order exists.
create index products_listing_idx on products (category_id, status, published_at desc);
-- The catalogue facet bar. Phase 14 replaces this with the five-column form.
create index products_facets_idx on products (status, is_large_format, price_state);
-- Partial: the public site only ever reads published rows, so the index holds only those.
create index products_published_idx on products (status) where status = 'PUBLISHED';
-- Trigram search over the Studio's product list. `slug` is citext, and gin_trgm_ops has no
-- operator class for citext, so the index is on the expression `slug::text`. A query must use the
-- same expression to hit it — lib/supabase/repositories/products.ts is the only caller.
create index products_title_trgm_idx on products using gin (title gin_trgm_ops);
create index products_slug_trgm_idx on products using gin ((slug::text) gin_trgm_ops);
create index products_hero_media_idx on products (hero_media_id);
create index products_model_media_idx on products (model_media_id);

-- edge tables -----------------------------------------------------------------------------------
-- Each composite primary key already indexes its FIRST column, so only the second needs one.
-- (product_id, collection_id) covers lookups by product; this covers "what is in this collection".
create index product_collections_collection_idx on product_collections (collection_id, sort_order);
-- The material facet Phase 14 builds.
create index product_materials_material_idx on product_materials (material_id, product_id);
create index product_media_asset_idx on product_media (media_asset_id);
create index product_relations_source_idx
  on product_relations (source_product_id, relation_type, sort_order);
-- Answers "what points AT this thing", which the unique edge key cannot: it is ordered
-- source-first, so a scan by target would have to read the whole index.
create index product_relations_target_idx on product_relations (target_type, target_id);

-- content_seed_runs -----------------------------------------------------------------------------
-- The Studio's seed history, newest first.
create index content_seed_runs_started_idx on content_seed_runs (started_at desc);
