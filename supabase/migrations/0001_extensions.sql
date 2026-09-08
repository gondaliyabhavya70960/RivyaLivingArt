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
-- WHERE THEY ARE INSTALLED, AND WHY IT IS SPELLED OUT
--
-- `with schema extensions` on every one, rather than letting the search path decide.
--
-- An earlier version of this file omitted it, on the belief that Supabase had already installed
-- all four into `extensions` so `if not exists` would be a harmless no-op. Checking the real
-- project before applying showed otherwise: **only `pgcrypto` was installed.** The other three did
-- not exist at all, and `create extension` with no schema installs into the first entry of the
-- search path — `public`.
--
-- That would have produced a MIXED layout on the live project: `pgcrypto` in `extensions`, and
-- `citext`, `pg_trgm` and `unaccent` in `public`. Worse than either consistent choice. It also
-- trips Supabase's own security advisor, which flags extensions in `public` because that schema is
-- exposed through PostgREST.
--
-- Naming the schema works in both places. Hosted, Supabase creates `extensions`; locally,
-- `supabase/local/00-auth-shim.sql` creates it, and the `create schema if not exists` below makes
-- this migration self-sufficient for any other plain cluster. On hosted that line is a no-op, so
-- it takes no ownership of a schema Supabase manages.
--
-- The search_path below still names both schemas, because every LATER migration resolves extension
-- objects (the `citext` type, `gin_trgm_ops`, the `unaccent` dictionary) through it. Removing it
-- reproduces the failure this project already hit once:
--   ERROR: text search dictionary "unaccent" does not exist
-- See docs/ops/ENVIRONMENT.md.

create schema if not exists extensions;

set search_path = public, extensions;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext   with schema extensions;
create extension if not exists pg_trgm  with schema extensions;
create extension if not exists unaccent with schema extensions;
