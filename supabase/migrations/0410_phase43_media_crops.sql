-- PHASE 43 — media_crops: one master, several D6 ratios, no second generation.
--
-- WHY A TABLE RATHER THAN A TRANSFORMATION STRING. Cloudinary can crop on delivery with `c_fill`
-- and a gravity, and for most images that is enough. It is not enough for the images this library
-- actually holds: 250 AI-generated stills composed for the edges they were generated at, where an
-- automatic centre crop to 9:16 routinely cuts the subject in half. A person looks at the picture,
-- chooses the box, and the choice is stored — because the judgement is theirs and it should survive
-- the next deploy.
--
-- ONE ROW PER (ASSET, RATIO), which is the whole design. D6 keeps desktop and mobile as SEPARATE
-- slots with different ratios, so one 4800px master legitimately serves several shapes; a second
-- row for the same pair would mean two answers to one question and the unique constraint refuses it.
--
-- A BOX OR A GRAVITY, NEVER NEITHER. An explicit box is an editor's decision in pixels. A gravity is
-- "crop to this ratio, keeping this part" and is the right answer when the subject moves between
-- derived sizes. A row carrying neither describes nothing, and `media_crops_box_or_gravity` refuses
-- it rather than letting the resolver silently fall back to a centre crop the editor never chose.
--
-- THE RATIO LIST IS D6'S EIGHT AND IS CHECKED, not validated in application code. A ninth ratio is a
-- design decision that needs a migration, which is exactly the friction it should have.
--
-- RLS is Shape B (0411, generated): a crop is public when its parent asset is, and writing one needs
-- `media.write`. A crop is not content — it has no status of its own and nothing to publish — so it
-- carries Tier A and nothing else, the same exemption `media_usages` takes (DATA_MODEL §1.4).

set search_path = public, extensions;

create table media_crops (
  id              uuid primary key default gen_random_uuid(),
  media_asset_id  uuid not null references media_assets (id) on delete cascade,
  aspect_ratio    text not null,

  -- The explicit box, in SOURCE pixels. All four together or all four null; a partial box is a bug
  -- that would otherwise be stored and resolved into a crop nobody chose.
  x               integer,
  y               integer,
  width           integer,
  height          integer,

  -- Cloudinary's gravity vocabulary, restricted to the values that mean something for this library.
  -- `auto` is included deliberately: for a material macro, "keep the interesting part" is a better
  -- answer than a box, and it is still an editor CHOOSING that rather than a default.
  gravity         text,

  -- Why this crop. Free text, for the next person: "keeps the joint visible at 9:16".
  note            text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id) on delete set null,

  constraint media_crops_one_per_ratio unique (media_asset_id, aspect_ratio),

  constraint media_crops_ratio_allowlist check (
    aspect_ratio in ('21:9', '16:9', '4:3', '3:2', '1:1', '4:5', '3:4', '9:16')
  ),

  constraint media_crops_gravity_allowlist check (
    gravity is null or gravity in (
      'auto', 'center', 'north', 'south', 'east', 'west',
      'north_east', 'north_west', 'south_east', 'south_west'
    )
  ),

  -- All four box columns together, or none of them.
  constraint media_crops_box_complete check (
    (x is null and y is null and width is null and height is null)
    or (x is not null and y is not null and width is not null and height is not null)
  ),

  -- A box that starts off the image or has no area is not a crop.
  constraint media_crops_box_positive check (
    width is null or (width > 0 and height > 0 and x >= 0 and y >= 0)
  ),

  -- The row must say SOMETHING. Without this the resolver would have to invent a default.
  constraint media_crops_box_or_gravity check (width is not null or gravity is not null)
);

create index media_crops_asset_idx on media_crops (media_asset_id);

comment on table media_crops is
  'Phase 43. One editor-chosen crop per (asset, aspect ratio), applied as c_crop BEFORE the delivery '
  'preset so one master serves several D6 ratios without a second generation. Either an explicit box '
  'in source pixels or a Cloudinary gravity, never neither. Public when the parent asset is; writing '
  'needs media.write.';

comment on column media_crops.x is
  'Left edge of the box in SOURCE pixels, not in delivered pixels. The source dimensions are what an '
  'editor sees in the crop editor and what Cloudinary measures c_crop against; a box in delivered '
  'pixels would mean a different crop at every width on the ladder.';

comment on column media_crops.gravity is
  'Cloudinary gravity, when the answer is "keep this part" rather than "these exact pixels". Chosen '
  'by a person, never defaulted — a row with no box and no gravity is refused.';

comment on column media_crops.note is
  'Why this crop exists, for whoever changes it next. Never rendered to a visitor.';

alter table media_crops enable row level security;
