-- 0001_extensions.sql — Phase 03
--
-- Extensions the schema depends on. Each is requested by a specific later decision, so the
-- reason is recorded next to it rather than left for a reader to infer:
--
--   pgcrypto  gen_random_uuid(), the default for every surrogate primary key (D5).
--   citext    slugs are case-insensitive and unique (D5 rule 6). Without this, `Furniture`
--             and `furniture` would be two categories.
--   pg_trgm   trigram GIN indexes on title/slug/filename, so an editor searching the Studio
--             for "walnt" still finds "walnut" (DATA_MODEL §6, §7).
--   unaccent  rivya_slugify() folds accented characters before slugging, so "Résine" and
--             "Resine" cannot produce two different slugs for one material.
--
-- Supabase installs extensions into the `extensions` schema on hosted projects and puts that
-- schema on the search path. Creating them without an explicit schema therefore works on both
-- a hosted project and a plain PostgreSQL cluster, which is what the local verification uses.

-- Extension objects (citext, unaccent, gin_trgm_ops) are resolved through this search_path.
-- Supabase installs extensions into the `extensions` schema; a plain cluster installs them into
-- `public`. Naming both means these migrations apply unmodified to either, which they did NOT
-- before: with unaccent in `extensions`, 0003 failed at CREATE time with
--   ERROR: text search dictionary "unaccent" does not exist
-- and 0004-0006 would have failed the same way on the `citext` type. See docs/ops/ENVIRONMENT.md.
set search_path = public, extensions;

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists pg_trgm;
create extension if not exists unaccent;
