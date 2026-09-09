-- ============================================================================================
-- 0130 — the specification table, and two constraints that keep a fact a fact
--
-- The product page's specification block is the strictest surface on this site, and the phase
-- document is unusually blunt about why: a null value must produce NO ROW. Not an em dash, not
-- "N/A", not "Contact us for details" — because each of those tells a visitor that a value exists
-- and is merely being withheld. The renderer has no placeholder branch at all, which only works if
-- the rows underneath it are guaranteed to be facts somebody typed.
--
-- 1. `product_specs` IS OWNER-ENTERED, ALWAYS. Zero rows are seeded, ever, and no phase after this
--    one may seed any: a seeded specification is a fabricated business fact (D10) wearing the
--    clothes of a measurement. The seed guard in 0070 already refuses a seed_key on a table that
--    has none, and this table deliberately has none — there is no `seed_key`, no
--    `content_seed_version`, no `seed_content_hash`. A seeder cannot address a row here.
--
--    TIERS A AND B, NOT C, and the missing C is the point above made structural. The phase document
--    lists the D5 common set without `published_at` / `published_by`; they are carried anyway,
--    because a spec row genuinely is published or not — `status` says so — and every other
--    content-bearing table records when that happened and who did it. Diverging here would make
--    `product_specs` the one published row on the site whose publication is unattributed.
--
-- 2. NON-BLANK AFTER TRIM, not merely `not null`. `label = '   '` passes a not-null check and then
--    renders as a blank line in a table of facts, which reads as a missing value rather than a
--    typo. The check is on `btrim`, so whitespace cannot smuggle an empty row past it.
--
-- 3. `unique (product_id, label)` because a specification block that lists "Seat height" twice with
--    two different numbers is worse than one that omits it. Which of the two is true is not a
--    question a visitor can answer, and it is not one the renderer should have to.
--
-- 4. `products.dimensions` GAINS A SHAPE. It has been a free `jsonb` since 0006 and Phase 15 is the
--    first phase to render it, so this is the moment its shape stops being a convention held in
--    TypeScript and becomes a rule the database enforces. The key set mirrors
--    `lib/catalog/dimensions.ts` exactly, values must be positive numbers, and anything else is
--    refused — `{"length_inches": 90}` cannot be stored, so a renderer can never meet a unit it
--    does not know how to label. This is the no-inference rule made structural: there is exactly
--    one unit per key, stated in the key, and nothing converts.
--
-- 5. `product_relations_source_idx` IS NOT CREATED HERE. The phase document lists it, and 0008
--    already built it on exactly `(source_product_id, relation_type, sort_order)` — source product,
--    then relation type, then the editor's order, so curation is served by the index rather than
--    re-sorted per request. The phase document is describing what the schema has rather than asking
--    for a change, which is the same situation Phase 14 met with `product_materials_material_idx`
--    and resolved the same way: verify, then say so, rather than issue a create that fails.
--
-- RLS lives in 0131, which is GENERATED from `lib/auth/table-permissions.ts` and must not be
-- hand-edited — see the header of that file.
-- ============================================================================================

create table product_specs (
  id                   uuid primary key default gen_random_uuid(),
  product_id           uuid not null references products (id) on delete cascade,
  sort_order           integer not null default 0,
  label                text not null,
  value                text not null,
  unit                 text,
  group_label          text,

  -- D5 tier A + B. `fact_classification` defaults to PRODUCT_FACT because that is what every row
  -- here is by construction: a measurement of a real object, typed by the person who made it.
  status               content_status not null default 'DRAFT',
  owner_verification   owner_verification not null default 'NOT_REQUIRED',
  fact_classification  fact_classification not null default 'PRODUCT_FACT',
  published_at         timestamptz,
  published_by         uuid references auth.users (id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  updated_by           uuid references auth.users (id),

  constraint product_specs_label_present check (btrim(label) <> ''),
  constraint product_specs_value_present check (btrim(value) <> ''),
  constraint product_specs_unit_present check (unit is null or btrim(unit) <> ''),
  constraint product_specs_group_present check (group_label is null or btrim(group_label) <> ''),
  constraint product_specs_unique_label unique (product_id, label),

  -- D10, the same gate every content table carries: an unverified claim cannot be published.
  constraint product_specs_verified_before_publish check (
    status <> 'PUBLISHED' or owner_verification <> 'OWNER_VERIFICATION_REQUIRED'
  )
);

comment on table product_specs is
  'Owner-entered specification rows for one product. Never seeded: a seeded specification is a fabricated measurement. A null value produces no row rather than a placeholder (Phase 15).';
comment on column product_specs.unit is
  'The unit as the owner entered it. Nothing converts it — a millimetre value is displayed in millimetres.';
comment on column product_specs.group_label is
  'Optional heading this row sits under, so a long block can be grouped without inventing a taxonomy.';

create index product_specs_product_idx on product_specs (product_id, sort_order);

alter table product_specs enable row level security;

create trigger product_specs_set_updated_at
  before update on product_specs
  for each row execute function public.set_updated_at();

-- --- 4. products.dimensions gains a shape ----------------------------------------------------
-- THROUGH A FUNCTION, because a check constraint may not contain a subquery and testing "every
-- value in this object is a positive number" needs to walk the object. An IMMUTABLE function may be
-- called from a check, and it can hold the subquery the constraint cannot.
--
-- The value test is a single CASE rather than two conditions, so the numeric cast is only ever
-- reached for a key whose value is already known to be a number. Two separate `not exists` clauses
-- would rely on AND short-circuiting, which SQL does not promise.
create or replace function public.is_valid_dimensions(value jsonb) returns boolean
  language sql
  immutable
  set search_path = pg_catalog, public
  as $$
  select value is null
      or (
        jsonb_typeof(value) = 'object'
        and value - array['length_mm', 'width_mm', 'height_mm', 'depth_mm',
                          'diameter_mm', 'weight_g', 'seats'] = '{}'::jsonb
        and not exists (
          select 1
            from jsonb_each(value) as d(key, val)
           where case
                   when jsonb_typeof(d.val) = 'number' then (d.val)::numeric <= 0
                   else true
                 end
        )
      )
$$;

comment on function public.is_valid_dimensions(jsonb) is
  'True when a products.dimensions blob is null, or an object whose keys are a subset of the seven declared measurements and whose every value is a positive number. Phase 15.';

alter table products add constraint products_dimensions_shape
  check (public.is_valid_dimensions(dimensions));

comment on constraint products_dimensions_shape on products is
  'dimensions is an object whose keys are a subset of the seven declared measurements, each a positive number. The unit is part of the key, so nothing has to infer or convert one.';
