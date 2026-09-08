-- 0003_shared_functions.sql — Phase 03
--
-- Two functions used by later migrations. Both pin `search_path`: a function that resolves
-- unqualified names against the caller's path can be made to call a different `now()` or a
-- different `regexp_replace` by anyone able to create a schema, and pinning it costs nothing.
--
-- Neither function is ever edited in place. Migrations are forward-only and CI re-applies the
-- whole set to an empty database, so changing the body of one of these would silently change
-- what every earlier migration meant. A behaviour change gets a new function name.

-- Maintains Tier-A `updated_at`. Attached by each table's own migration, never here, so a
-- table's triggers are visible in the migration that creates it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Tier-A trigger: stamps updated_at on every UPDATE. Attached per table by that table''s migration.';

-- Deterministic slug derivation, used by the Studio when an editor has not typed a slug and by
-- tests that assert two visually distinct names cannot collapse to one slug.
--
-- IMMUTABLE is load-bearing rather than decorative: it is what allows this to appear in an
-- expression index later. It requires the two-argument form of unaccent() with an explicit
-- dictionary, because the one-argument form resolves the dictionary through the search path at
-- call time and is therefore only STABLE.
create or replace function public.rivya_slugify(input text)
returns text
language sql
immutable
strict
set search_path = pg_catalog, public
as $$
  select nullif(
    -- 4. collapse runs of hyphens and trim them from both ends
    btrim(
      regexp_replace(
        -- 3. anything that is not a-z, 0-9 becomes a hyphen
        regexp_replace(
          -- 2. lower-case
          lower(
            -- 1. fold accents, so "Résine" and "Resine" reach the same slug
            unaccent('unaccent'::regdictionary, input)
          ),
          '[^a-z0-9]+', '-', 'g'
        ),
        '-{2,}', '-', 'g'
      ),
      '-'
    ),
    ''
  );
$$;

comment on function public.rivya_slugify(text) is
  'Accent-folding, lower-casing slug derivation. IMMUTABLE so it may be used in an expression index.';
