-- ============================================================================================
-- 0194 — Phase 21: viewer settings, the model ceilings, and variant labels
--
-- THE NUMBER IS NOT THE PHASE DOCUMENT'S. PHASE-16-22 assigns Phase 21 `0190`; Phase 20 spent
-- `0190`–`0193` after its own block was taken (amendment A20). Phase 21 therefore takes `0194`
-- (this file) and `0195` (its generated policies), recorded as amendment A21 and re-registered in
-- DATA_MODEL §12.
--
-- THIS PHASE SHIPS WITH ZERO MODELS, and nothing here changes that. The manifest holds no GLB, none
-- will be generated (D10: a model has a form and dimensions, which is a product specification), and
-- every constraint below describes what a model the owner supplies must satisfy BEFORE a public
-- page may show it. The columns it extends were declared by Phase 06 (`0030`) for exactly this use.
--
-- FOUR RULES ARE CONSTRAINTS RATHER THAN APPLICATION CHECKS, because the application is not the
-- only writer and the inspector is not the only path:
--
--   1. SIZE and TRIANGLES have ceilings (15 MB, 250,000). The inspector rejects earlier and warns
--      sooner (8 MB, 150,000), but a row written past the inspector — a repair, a script, a later
--      surface — cannot carry a model the viewer would choke on.
--   2. A POSTER IS MANDATORY FOR ASSOCIATION, not for existence. The poster is what the page renders
--      until the visitor asks for the viewer, and it is the LCP element by contract (PERFORMANCE.md
--      §4.3). A model may be uploaded and inspected without one; it may not be attached to a
--      product or a project without one, because that attachment is what puts it on a page.
--   3. ASSOCIATION COLUMNS ARE FOR MODELS. `associated_product_id` and `associated_project_id` were
--      declared in Phase 06 as 3D metadata; nothing else has ever written them (0 rows on both
--      databases at the time of writing), and this makes that a rule rather than a habit.
--   4. `viewer_settings` HAS A SHAPE. Per-model camera, exposure, preset and distance defaults are
--      stored as JSON so the viewer can grow a setting without a migration — and validated here so
--      that a typo'd key or a string where a number belongs is refused at the row, not discovered
--      when a canvas fails to mount. The same shape is parsed by `lib/media/model.ts`.
--
-- `associated_project_id` GAINS ITS FOREIGN KEY. Phase 06 declared the column before the table it
-- points at existed and said so; Phase 17 created `portfolio_projects` and left the key for the
-- phase that would first write the column. This is that phase.
--
-- VARIANT LABELS ARE WORDS FOR MESH NAMES, AND ONE OF THEM IS A PRODUCT FACT. A GLB that carries
-- `KHR_materials_variants` exposes keys like `walnut_01`; `model_variant_labels` gives each a label
-- the visitor can read. A bare label is editorial copy. A label that also names a `materials` row
-- asserts that the material is present in a real object — which is D10 territory — so the CHECK
-- below forces such a row to at least OWNER_VERIFICATION_REQUIRED, the Phase 08 authority trigger
-- keeps VERIFIED for the owner and admin, and `lib/media/model.ts` returns the material to the
-- public viewer only at VERIFIED. An unverified association still shows its label; it simply
-- carries no material name.
-- ============================================================================================

set search_path = public, extensions;

-- --- 1. viewer_settings shape --------------------------------------------------------------

-- A number from a JSON value, or null when the value is not a number. Written as a function so
-- the validators below never cast a string: `and` does not short-circuit in SQL, and a CHECK
-- that raises on a bad value reports a cast error rather than a refused row.
create or replace function public.model_setting_number(value jsonb) returns numeric
  language sql
  immutable
  set search_path = pg_catalog, public
  as $$
  select case when jsonb_typeof(value) = 'number' then (value #>> '{}')::numeric end
$$;

comment on function public.model_setting_number(jsonb) is
  'The numeric value of a JSON number, or null for any other JSON type. Phase 21 viewer_settings validation; never casts a non-number.';

revoke execute on function public.model_setting_number(jsonb) from public, anon;

-- A camera vector: exactly three JSON numbers.
create or replace function public.model_setting_vec3(value jsonb) returns boolean
  language sql
  immutable
  set search_path = pg_catalog, public
  as $$
  select case
    when jsonb_typeof(value) = 'array' then
      jsonb_array_length(value) = 3
      and (select bool_and(jsonb_typeof(element) = 'number')
             from jsonb_array_elements(value) as element)
    else false
  end
$$;

comment on function public.model_setting_vec3(jsonb) is
  'True when a JSON value is an array of exactly three numbers. Phase 21 viewer_settings.camera validation.';

revoke execute on function public.model_setting_vec3(jsonb) from public, anon;

create or replace function public.is_valid_model_camera(value jsonb) returns boolean
  language sql
  immutable
  set search_path = pg_catalog, public
  as $$
  select jsonb_typeof(value) = 'object'
     and value - array['position', 'target', 'fov'] = '{}'::jsonb
     and (not (value ? 'position') or public.model_setting_vec3(value -> 'position'))
     and (not (value ? 'target') or public.model_setting_vec3(value -> 'target'))
     and (not (value ? 'fov')
          or coalesce(public.model_setting_number(value -> 'fov') between 10 and 120, false))
$$;

comment on function public.is_valid_model_camera(jsonb) is
  'True when a viewer_settings.camera object carries only position, target (three numbers each) and fov (10–120). Phase 21.';

revoke execute on function public.is_valid_model_camera(jsonb) from public, anon;

-- The whole blob. Seven keys and nothing else; every present key has the type and range the
-- viewer expects. The preset names are the four lighting and three environment presets of
-- `components/three/presets.ts`, repeated here because the row must refuse a name the viewer
-- cannot resolve — falling back silently would make Studio's live preview lie.
create or replace function public.is_valid_viewer_settings(value jsonb) returns boolean
  language sql
  immutable
  set search_path = pg_catalog, public
  as $$
  select value is not null
     and jsonb_typeof(value) = 'object'
     and value - array['camera', 'exposure', 'lightingPreset', 'environmentPreset',
                       'autoRotate', 'minDistance', 'maxDistance'] = '{}'::jsonb
     and (not (value ? 'camera') or public.is_valid_model_camera(value -> 'camera'))
     and (not (value ? 'exposure')
          or coalesce(public.model_setting_number(value -> 'exposure') between 0.1 and 4, false))
     and (not (value ? 'autoRotate') or jsonb_typeof(value -> 'autoRotate') = 'boolean')
     and (not (value ? 'minDistance')
          or coalesce(public.model_setting_number(value -> 'minDistance') > 0, false))
     and (not (value ? 'maxDistance')
          or coalesce(public.model_setting_number(value -> 'maxDistance') > 0, false))
     and (not (value ? 'minDistance' and value ? 'maxDistance')
          or coalesce(public.model_setting_number(value -> 'minDistance')
                      < public.model_setting_number(value -> 'maxDistance'), false))
     and (not (value ? 'lightingPreset')
          or value ->> 'lightingPreset' in
             ('studio-soft', 'gallery-directional', 'daylight-window', 'low-key'))
     and (not (value ? 'environmentPreset')
          or value ->> 'environmentPreset' in ('neutral-room', 'dark-gallery', 'warm-interior'))
$$;

comment on function public.is_valid_viewer_settings(jsonb) is
  'True when a media_assets.viewer_settings blob is an object whose keys are a subset of camera, exposure, lightingPreset, environmentPreset, autoRotate, minDistance and maxDistance, each with the type and range the Phase 21 viewer accepts. Mirrored by lib/media/model.ts.';

revoke execute on function public.is_valid_viewer_settings(jsonb) from public, anon;

-- --- 2. media_assets: the column, the key, the ceilings ------------------------------------

alter table media_assets
  add column viewer_settings jsonb not null default '{}'::jsonb;

comment on column media_assets.viewer_settings is
  'Per-model viewer defaults (camera, exposure, lightingPreset, environmentPreset, autoRotate, minDistance, maxDistance). Validated by is_valid_viewer_settings(); read by lib/media/model.ts. Empty object for anything that is not a model. Phase 21.';

alter table media_assets
  add constraint media_assets_associated_project_fk
    foreign key (associated_project_id) references portfolio_projects(id) on delete set null;

comment on column media_assets.associated_project_id is
  'The portfolio project a MODEL_3D asset belongs to, or null. Declared in 0030 ahead of its table; the foreign key arrived with Phase 21 (0194). Set through set_model_association(), which also requires a poster.';

alter table media_assets
  add constraint media_assets_viewer_settings_shape
    check (public.is_valid_viewer_settings(viewer_settings)),
  -- FEAT §14 / PERFORMANCE.md §4.3: reject above 15 MB. The inspector warns from 8 MB.
  add constraint media_assets_model_size_ceiling
    check (kind <> 'MODEL_3D' or file_size_bytes is null or file_size_bytes <= 15 * 1024 * 1024),
  -- Reject above 250,000 triangles. The inspector warns from 150,000.
  add constraint media_assets_model_triangle_ceiling
    check (kind <> 'MODEL_3D' or poly_count is null or poly_count <= 250000),
  -- The poster gates ASSOCIATION, not existence. A model may be uploaded, inspected and edited
  -- with no poster; it may not be put on a page without one.
  add constraint media_assets_model_poster_before_association
    check (kind <> 'MODEL_3D'
           or (associated_product_id is null and associated_project_id is null)
           or model_poster_id is not null),
  -- The association columns are 3D metadata (FEAT §13) and describe nothing else.
  add constraint media_assets_association_is_model
    check (kind = 'MODEL_3D'
           or (associated_product_id is null and associated_project_id is null));

-- A poster or thumbnail must be an IMAGE, and not the model itself. A CHECK cannot look at another
-- row, so this is a trigger; SECURITY DEFINER because the poster may still be a DRAFT the editor's
-- own policy would hide from the lookup, and a hidden row must read as "not an image" for nobody.
create or replace function public.guard_model_still_references()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_kind media_kind;
  v_resource text;
begin
  if new.model_poster_id is not null then
    if new.model_poster_id = new.id then
      raise exception 'a model cannot be its own poster'
        using errcode = '23514', constraint = 'media_assets_model_poster_is_image';
    end if;
    select kind, resource_type into v_kind, v_resource
      from media_assets where id = new.model_poster_id;
    if v_kind is distinct from 'IMAGE' or v_resource is distinct from 'image' then
      raise exception 'model_poster_id % is not an IMAGE asset', new.model_poster_id
        using errcode = '23514', constraint = 'media_assets_model_poster_is_image';
    end if;
  end if;

  if new.model_thumbnail_id is not null then
    if new.model_thumbnail_id = new.id then
      raise exception 'a model cannot be its own thumbnail'
        using errcode = '23514', constraint = 'media_assets_model_thumbnail_is_image';
    end if;
    select kind, resource_type into v_kind, v_resource
      from media_assets where id = new.model_thumbnail_id;
    if v_kind is distinct from 'IMAGE' or v_resource is distinct from 'image' then
      raise exception 'model_thumbnail_id % is not an IMAGE asset', new.model_thumbnail_id
        using errcode = '23514', constraint = 'media_assets_model_thumbnail_is_image';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.guard_model_still_references() is
  'BEFORE trigger on media_assets: model_poster_id and model_thumbnail_id must name an IMAGE asset other than the row itself. Phase 21.';

revoke execute on function public.guard_model_still_references() from public, anon, authenticated;

create trigger media_assets_guard_model_stills
  before insert or update of model_poster_id, model_thumbnail_id on media_assets
  for each row execute function public.guard_model_still_references();

-- The product side of an association must point at a model. `products.model_media_id` has been a
-- foreign key to media_assets since 0006; this narrows it to the one kind a viewer can load.
create or replace function public.guard_product_model_reference()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_kind media_kind;
begin
  if new.model_media_id is null then
    return new;
  end if;
  select kind into v_kind from media_assets where id = new.model_media_id;
  if v_kind is distinct from 'MODEL_3D' then
    raise exception 'model_media_id % is not a MODEL_3D asset', new.model_media_id
      using errcode = '23514', constraint = 'products_model_media_is_model';
  end if;
  return new;
end;
$$;

comment on function public.guard_product_model_reference() is
  'BEFORE trigger on products: model_media_id must name a MODEL_3D asset. Phase 21.';

revoke execute on function public.guard_product_model_reference() from public, anon, authenticated;

create trigger products_guard_model_reference
  before insert or update of model_media_id on products
  for each row execute function public.guard_product_model_reference();

-- --- 3. model_variant_labels ---------------------------------------------------------------

create table model_variant_labels (
  id                   uuid primary key default gen_random_uuid(),
  media_asset_id       uuid not null references media_assets(id) on delete cascade,
  -- The key the GLB's KHR_materials_variants extension declares. Never shown; matched.
  variant_key          text not null,
  -- The words the visitor reads in the switcher.
  label                text not null,
  -- Optional, and the reason this table carries D10 columns: naming a material is a product fact.
  material_id          uuid references materials(id) on delete set null,
  position             int not null default 0,

  fact_classification  fact_classification not null default 'EDITORIAL_COPY',
  owner_verification   owner_verification not null default 'NOT_REQUIRED',

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  updated_by           uuid references auth.users(id) on delete set null,

  constraint model_variant_labels_variant_unique unique (media_asset_id, variant_key),
  constraint model_variant_labels_variant_key_shape
    check (length(btrim(variant_key)) between 1 and 120),
  constraint model_variant_labels_label_shape
    check (length(btrim(label)) between 1 and 120),
  constraint model_variant_labels_position_nonnegative check (position >= 0),
  -- A label that names a material claims the material is in a real object. That claim needs the
  -- owner: attaching a material lifts the row to at least OWNER_VERIFICATION_REQUIRED, and the
  -- public read path returns the material only at VERIFIED.
  constraint model_variant_labels_material_needs_verification
    check (material_id is null or owner_verification <> 'NOT_REQUIRED')
);

comment on table model_variant_labels is
  'Human labels for the KHR_materials_variants keys a MODEL_3D asset exposes, so the viewer''s switcher shows words rather than mesh names. A label may reference a materials row; doing so is a product fact and forces owner verification. Phase 21 (0194).';
comment on column model_variant_labels.variant_key is
  'The variant name declared inside the GLB. Matched by the viewer, never displayed.';
comment on column model_variant_labels.material_id is
  'An existing materials row the variant depicts, or null. Never invents a specification; reaches the public viewer only when owner_verification = VERIFIED.';

create index model_variant_labels_asset_position_idx
  on model_variant_labels (media_asset_id, position);
create index model_variant_labels_material_idx
  on model_variant_labels (material_id) where material_id is not null;

alter table model_variant_labels enable row level security;

create trigger model_variant_labels_set_updated_at
  before update on model_variant_labels
  for each row execute function public.set_updated_at();

-- The Phase 08 authority trigger, unchanged: VERIFIED is the owner's and admin's to set.
create trigger model_variant_labels_enforce_verification_authority
  before insert or update on model_variant_labels
  for each row execute function public.enforce_verification_authority();

-- A label belongs to a MODEL. SECURITY DEFINER for the same reason as the poster guard: the parent
-- may be a DRAFT the writer's own SELECT policy would hide, and "hidden" must not read as "not a
-- model" — it must read as the truth.
create or replace function public.guard_variant_label_parent()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_kind media_kind;
begin
  select kind into v_kind from media_assets where id = new.media_asset_id;
  if v_kind is distinct from 'MODEL_3D' then
    raise exception 'media_asset_id % is not a MODEL_3D asset', new.media_asset_id
      using errcode = '23514', constraint = 'model_variant_labels_parent_is_model';
  end if;
  return new;
end;
$$;

comment on function public.guard_variant_label_parent() is
  'BEFORE trigger on model_variant_labels: the parent asset must be MODEL_3D. Phase 21.';

revoke execute on function public.guard_variant_label_parent() from public, anon, authenticated;

create trigger model_variant_labels_guard_parent
  before insert or update of media_asset_id on model_variant_labels
  for each row execute function public.guard_variant_label_parent();

-- --- 4. set_model_association() ------------------------------------------------------------
--
-- ONE TRANSACTION FOR TWO TABLES. Associating a model with a product writes the asset side
-- (`associated_product_id`) and the product side (`products.model_media_id`), and a product page
-- reads the second. Two PostgREST writes are two transactions: an interruption between them leaves
-- a product pointing at a model that says it belongs to nothing, or the reverse. The same pattern
-- as `cms_duplicate_customization_form()` (0184): SECURITY INVOKER, so every row policy still
-- applies — `media.write` for the asset, `catalog.write` for the product — and a caller lacking
-- either gets nothing, atomically.
--
-- THE POSTER CONSTRAINT FIRES INSIDE THIS TRANSACTION, on the asset update, before the product is
-- touched. That is the whole enforcement of "no poster, no page".
create or replace function public.set_model_association(
  p_asset_id uuid,
  p_product_id uuid,
  p_project_id uuid
) returns void
  language plpgsql
  security invoker
  set search_path = pg_catalog, public
  as $$
begin
  if p_product_id is not null and p_project_id is not null then
    raise exception 'a model is associated with a product or a project, never both'
      using errcode = '23514', constraint = 'model_association_single_target';
  end if;

  -- Any other product currently showing this model lets go of it: one model, one page.
  update products
     set model_media_id = null, updated_by = auth.uid()
   where model_media_id = p_asset_id
     and (p_product_id is null or id <> p_product_id);

  if exists (select 1 from products
              where model_media_id = p_asset_id
                and (p_product_id is null or id <> p_product_id)) then
    raise exception 'a product still references model % and is not writable by this session', p_asset_id
      using errcode = '42501';
  end if;

  update media_assets
     set associated_product_id = p_product_id,
         associated_project_id = p_project_id,
         updated_by = auth.uid()
   where id = p_asset_id
     and kind = 'MODEL_3D';

  if not found then
    raise exception 'model % is not a MODEL_3D asset writable by this session', p_asset_id
      using errcode = 'P0002';
  end if;

  if p_product_id is not null then
    update products
       set model_media_id = p_asset_id, updated_by = auth.uid()
     where id = p_product_id;

    if not found then
      raise exception 'product % is not writable by this session', p_product_id
        using errcode = 'P0002';
    end if;
  end if;
end;
$$;

comment on function public.set_model_association(uuid, uuid, uuid) is
  'Associates a MODEL_3D asset with one product, one project, or nothing, writing both the asset side and products.model_media_id in one transaction. SECURITY INVOKER: every row policy applies. The poster-before-association constraint fires here. Phase 21.';

-- `anon` has no business associating a model; `authenticated` reaches it through the Studio, and
-- RLS inside decides what that session may actually touch.
revoke execute on function public.set_model_association(uuid, uuid, uuid) from public, anon;
grant execute on function public.set_model_association(uuid, uuid, uuid) to authenticated, service_role;
