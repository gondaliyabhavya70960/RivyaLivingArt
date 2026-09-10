-- ============================================================================================
-- 0200 — Phase 22: merchandising slots and entries
--
-- THE OWNER TAKES THE CONTROLS. Which products appear in Selected Works and in what order, which
-- collections are featured, how the store's categories are ordered, which pieces are pinned inside
-- a category, and when each arrangement starts and stops — all of it becomes a Studio decision
-- with a schedule, and none of it is written in code (SEED §10-04, §32). This file gives that
-- decision two tables and nothing else: a SLOT is a named, typed, scheduled, ordered list of
-- entity references bound to exactly one public surface and exactly one Studio screen; an ENTRY
-- is one reference with its own window.
--
-- WHAT A SLOT IS NOT. It is not content. It carries no copy a visitor reads — the heading above a
-- curated band is the block's own `heading`, and the store row's heading is a `global_content`
-- string — and it cannot be created or removed by an editor, because a slot nothing reads is a
-- dead end and a surface reading a slot nobody can edit is a hard-coded list wearing a costume.
-- The eleven rows below are therefore inserted HERE, as structure, under the same marker the
-- roles table uses: `lib/cms/merchandising.ts` carries the same register, and a test asserts the
-- two agree. Migration numbers `0200`–`0201` are the phase document's own.
--
-- ELEVEN SLOTS, NOT SIX. STUDIO_GUIDE §8 was written with a reusable `FEATURED_COLLECTIONS` slot
-- and a single `CATEGORY_PINNED`; the phase document supersedes both. There is no surface-less
-- slot — a slot with no surface is a list nobody renders — and the per-category slots need a
-- deterministic key, `CATEGORY_PINNED_<SLUG>` with the D3 slug upper-cased and `-` replaced by
-- `_`, so that a category added later gets its slot by the same rule. That rule runs as a
-- trigger on `categories` rather than in "the same server action that creates the category":
-- no such action exists (categories are seeded), and a trigger covers every path a row could
-- arrive by, including the seed runner.
--
-- THE LADDER LIVES IN ONE PLACE AND IT IS NOT HERE. `lib/cms/merchandising.ts` resolves a slot in
-- five ordered steps — live entries, re-checked targets, the curated list if it reaches
-- `min_items`, a named recency rule if `auto_fill`, else the fallback mode — and returns
-- provenance. This file only makes the states that ladder reads impossible to misrepresent:
--
--   1. An ENTRY MUST NAME AN ENTITY OF A TYPE ITS SLOT ALLOWS, and the entity must exist. Whether
--      it is PUBLISHED is the resolver's business (a draft entry pointing at a draft product is a
--      legitimate thing to prepare); whether it exists at all is not.
--   2. A COLLECTION CONCEPT CANNOT BE ENTERED. The Phase 16 gate refuses to publish a collection
--      whose `concept_state` is not OWNER_CONFIRMED; an entry pointing at one would be a promise
--      the resolver could never keep, and refusing it at the row means a crafted server-action
--      POST is refused as well as the picker's list.
--   3. `auto_fill` NEEDS A NAMED RULE. FEAT §28 forbids manufacturing analytics; the only rule the
--      resolver implements is recency, and the CHECK below makes "filled automatically" impossible
--      to switch on without a human-readable sentence saying by what.
--   4. A WINDOW IS HALF-OPEN AND ORDERED, the same shape as `page_sections` (0050): a window that
--      ends before it starts is refused at the row.
--
-- THE SWEEP. `merch_run_schedule()` is the merchandising pass the Phase 08 cron gains. Windows are
-- honoured by the RESOLVER on every read — an entry outside its window is not returned, whatever
-- the sweep has done — so the sweep does not put anything on or take anything off the site. It
-- makes the rows tell the truth afterwards (an entry whose window closed becomes ARCHIVED, as a
-- scheduled section does), records each transition in `activity_events`, and returns the D3 paths
-- whose caches the cron must revalidate — which is the only way a static page learns that a
-- window opened. Row-locked with SKIP LOCKED for the same reason `cms_run_content_schedule` is.
-- ============================================================================================

set search_path = public, extensions;

-- --- 1. The fallback modes --------------------------------------------------------------------

-- A new type, created and used in one file. Only ADDING a value to an existing enum needs its
-- own transaction (0140 explains); a type created here is usable here.
create type merch_fallback as enum ('EDITORIAL_BLOCK', 'HIDE_SECTION', 'SHOW_EMPTY_STATE');

comment on type merch_fallback is
  'What a surface does when its slot resolves to fewer than min_items and auto_fill is off. EDITORIAL_BLOCK renders media and copy tiles with no price and no product link; HIDE_SECTION renders nothing at all; SHOW_EMPTY_STATE renders the seeded SEED §27 sentence. There is no fourth mode and no placeholder card.';

-- --- 2. Slots -----------------------------------------------------------------------------------

create table merchandising_slots (
  id                    uuid primary key default gen_random_uuid(),
  -- THE KEY IS THE ADDRESS. Code reads `resolveSlot('HOMEPAGE_SELECTED_WORKS')`; the uuid exists
  -- for the entries' foreign key and nothing else. citext so a hand-typed lower-case key finds
  -- the row rather than creating a second one beside it.
  key                   citext not null unique,
  name                  text not null,
  description           text,
  -- The D3 path the slot appears on. Every slot has exactly one; there is no reusable slot.
  surface               text not null,
  -- The single D4 screen permitted to write the slot. Enforced by the Studio, recorded here so a
  -- reader of the table — or a test — can see that no slot is owned twice.
  owning_studio_route   text not null,
  allowed_entity_types  relation_entity[] not null,
  min_items             int not null default 3,
  max_items             int not null default 12,
  auto_fill             boolean not null default false,
  auto_fill_rule        text,
  fallback_mode         merch_fallback not null,
  -- The section an EDITORIAL_BLOCK fallback draws its tiles from. Null means "the material-story
  -- section on the same page" (SEED §10-05), resolved at read time; the seed cannot name a
  -- section id that does not exist until the content runner has run.
  fallback_section_id   uuid references page_sections (id) on delete set null,
  -- PUBLISHED is readable by the public resolver; anything else resolves to the fallback. A slot
  -- ships PUBLISHED because a slot is a fixture of its surface, not a piece of copy awaiting review.
  status                content_status not null default 'PUBLISHED',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  updated_by            uuid references auth.users (id),

  constraint merchandising_slots_key_shape
    check (key::text ~ '^[A-Z][A-Z0-9_]*$'),
  constraint merchandising_slots_surface_shape
    check (surface ~ '^/[a-z0-9/-]*$'),
  constraint merchandising_slots_route_shape
    check (owning_studio_route ~ '^/studio/merchandising/(homepage|store|featured)$'),
  constraint merchandising_slots_types_present
    check (cardinality(allowed_entity_types) >= 1),
  constraint merchandising_slots_items_ordered
    check (min_items >= 1 and max_items >= min_items and max_items <= 48),
  constraint merchandising_slots_rule_named
    check (auto_fill = false or (auto_fill_rule is not null and length(btrim(auto_fill_rule)) > 0))
);

comment on table merchandising_slots is
  'A named, typed, scheduled, ordered list of entity references bound to one public surface and one Studio screen. Structure, not content: the rows are created by migration and by the categories trigger, never by an editor. Resolved by lib/cms/merchandising.ts in five ordered steps with provenance.';
comment on column merchandising_slots.owning_studio_route is
  'The only /studio/merchandising/* screen that may write this slot. No slot is edited from two places.';
comment on column merchandising_slots.auto_fill_rule is
  'Required whenever auto_fill is true: the human-readable rule the resolver applies. Only recency exists; nothing behavioural, popular or inferred is implemented (FEAT §28).';

create index merchandising_slots_surface_idx on merchandising_slots (surface);

create trigger merchandising_slots_set_updated_at
  before update on public.merchandising_slots
  for each row execute function public.set_updated_at();

-- --- 3. Entries ---------------------------------------------------------------------------------

create table merchandising_entries (
  id            uuid primary key default gen_random_uuid(),
  slot_id       uuid not null references merchandising_slots (id) on delete cascade,
  entity_type   relation_entity not null,
  entity_id     uuid not null,
  position      int not null,
  is_pinned     boolean not null default false,
  publish_at    timestamptz,
  unpublish_at  timestamptz,
  -- Bookkeeping for the sweep, and NOT read by the resolver: which side of its window the sweep
  -- last saw this entry on, so a transition is recorded and revalidated once rather than on every
  -- tick. The resolver reads status and the window directly.
  window_state  text not null default 'PENDING',
  status        content_status not null default 'DRAFT',
  note          text,
  published_at  timestamptz,
  published_by  uuid references auth.users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users (id),

  constraint merchandising_entries_unique_target unique (slot_id, entity_type, entity_id),
  constraint merchandising_entries_window_ordered
    check (unpublish_at is null or publish_at is null or unpublish_at > publish_at),
  constraint merchandising_entries_position_nonnegative check (position >= 0),
  constraint merchandising_entries_window_state
    check (window_state in ('PENDING', 'OPEN', 'CLOSED'))
);

comment on table merchandising_entries is
  'One entity reference inside a slot, with its own half-open window [publish_at, unpublish_at). Live to the public only while PUBLISHED and inside the window; the resolver re-checks the target on every read, so an entry naming an unpublished entity renders nothing rather than a broken card.';
comment on column merchandising_entries.is_pinned is
  'Editorial emphasis within the slot — a pinned entry sorts ahead of unpinned ones at the same position. Not a stock, sale or availability claim.';

create index merchandising_entries_slot_position_idx on merchandising_entries (slot_id, position);
create index merchandising_entries_publish_at_idx on merchandising_entries (publish_at)
  where publish_at is not null;
create index merchandising_entries_unpublish_at_idx on merchandising_entries (unpublish_at)
  where unpublish_at is not null;
create index merchandising_entries_target_idx on merchandising_entries (entity_type, entity_id);

create trigger merchandising_entries_set_updated_at
  before update on public.merchandising_entries
  for each row execute function public.set_updated_at();

-- --- 4. An entry names something its slot allows, and something that exists --------------------

create or replace function public.guard_merchandising_entry()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  v_allowed relation_entity[];
  v_key     text;
  v_exists  boolean := false;
  v_concept collection_concept_state;
begin
  select allowed_entity_types, key::text into v_allowed, v_key
    from merchandising_slots where id = new.slot_id;
  if v_allowed is null then
    raise exception 'merchandising entry names slot % which does not exist', new.slot_id
      using errcode = 'RV060';
  end if;
  if not (new.entity_type = any (v_allowed)) then
    raise exception 'slot % does not admit % entries', v_key, new.entity_type
      using errcode = 'RV061';
  end if;

  case new.entity_type
    when 'PRODUCT' then
      select true into v_exists from products where id = new.entity_id;
    when 'COLLECTION' then
      select true, concept_state into v_exists, v_concept
        from collections where id = new.entity_id;
      -- The Phase 16 gate, re-checked here: a concept cannot be published, so it cannot be
      -- featured. Refused at the row so a crafted POST fails exactly as the picker's list does.
      if v_exists and v_concept <> 'OWNER_CONFIRMED' then
        raise exception 'collection % is a concept (concept_state = %) and cannot be entered in slot %',
          new.entity_id, v_concept, v_key using errcode = 'RV062';
      end if;
    when 'CATEGORY' then
      select true into v_exists from categories where id = new.entity_id;
    when 'JOURNAL_ARTICLE' then
      select true into v_exists from journal_articles where id = new.entity_id;
    when 'PORTFOLIO_PROJECT' then
      select true into v_exists from portfolio_projects where id = new.entity_id;
    when 'MATERIAL' then
      select true into v_exists from materials where id = new.entity_id;
  end case;

  if not coalesce(v_exists, false) then
    raise exception 'merchandising entry names % % which does not exist', new.entity_type, new.entity_id
      using errcode = 'RV063';
  end if;

  -- Stamp the publication moment the first time the entry is released. Never cleared: an entry
  -- taken down and put back keeps its first release, which is what "published" means elsewhere.
  if new.status = 'PUBLISHED' and (tg_op = 'INSERT' or old.status is distinct from 'PUBLISHED')
     and new.published_at is null then
    new.published_at := now();
  end if;

  return new;
end $$;

revoke execute on function public.guard_merchandising_entry() from public, anon, authenticated;

create trigger merchandising_entries_guard
  before insert or update on public.merchandising_entries
  for each row execute function public.guard_merchandising_entry();

-- --- 5. A category brings its pinned slot with it ------------------------------------------------

-- `CATEGORY_PINNED_<SLUG>`: the D3 slug upper-cased, `-` replaced by `_`. Mechanical, so a
-- category added in Studio, by the seed runner or by hand gets the same key the phase document
-- names for the seven that exist today. A renamed slug carries its slot with it.
create or replace function public.merchandising_category_slot_key(p_slug text)
returns text
language sql
immutable
set search_path = pg_catalog, public
as $$
  select 'CATEGORY_PINNED_' || upper(replace(p_slug, '-', '_'))
$$;

revoke execute on function public.merchandising_category_slot_key(text) from public, anon;

create or replace function public.sync_category_pinned_slot()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if tg_op = 'UPDATE' and old.slug is not distinct from new.slug then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    update merchandising_slots
       set key = public.merchandising_category_slot_key(new.slug::text),
           surface = '/collection/' || lower(new.slug::text),
           name = new.name || ' — pinned'
     where key = public.merchandising_category_slot_key(old.slug::text);
    if found then
      return new;
    end if;
  end if;

  -- check-migrations: allow-insert (structure: the category's pinned slot, by the mechanical key rule; carries no copy)
  insert into merchandising_slots
    (key, name, description, surface, owning_studio_route, allowed_entity_types,
     min_items, max_items, fallback_mode)
  values
    (public.merchandising_category_slot_key(new.slug::text),
     new.name || ' — pinned',
     'Pieces pinned to the top of this category''s listing. Governs the pinned region only; the category''s own grid is untouched.',
     '/collection/' || lower(new.slug::text),
     '/studio/merchandising/store',
     array['PRODUCT']::relation_entity[],
     1, 12, 'SHOW_EMPTY_STATE')
  on conflict (key) do nothing;

  return new;
end $$;

revoke execute on function public.sync_category_pinned_slot() from public, anon, authenticated;

create trigger categories_sync_pinned_slot
  after insert or update of slug on public.categories
  for each row execute function public.sync_category_pinned_slot();

-- --- 6. Moving an entry one place, atomically ----------------------------------------------------

-- SECURITY INVOKER: RLS decides who may reorder (merchandising.write), and the two position
-- writes commit together or not at all. The Server Action asks for "one place up" or "one place
-- down" rather than posting a whole arrangement, which is what lets two people edit one slot
-- without the second save silently undoing the first.
create or replace function public.merch_move_entry(p_entry_id uuid, p_direction text)
returns void
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_slot      uuid;
  v_position  int;
  v_other_id  uuid;
  v_other_pos int;
begin
  if p_direction not in ('up', 'down') then
    raise exception 'direction must be up or down' using errcode = 'RV064';
  end if;

  select slot_id, position into v_slot, v_position
    from merchandising_entries where id = p_entry_id for update;
  if v_slot is null then
    raise exception 'merchandising entry % not found' , p_entry_id using errcode = 'RV065';
  end if;

  if p_direction = 'up' then
    select id, position into v_other_id, v_other_pos
      from merchandising_entries
     where slot_id = v_slot and (position < v_position or (position = v_position and id < p_entry_id))
     order by position desc, id desc limit 1 for update;
  else
    select id, position into v_other_id, v_other_pos
      from merchandising_entries
     where slot_id = v_slot and (position > v_position or (position = v_position and id > p_entry_id))
     order by position asc, id asc limit 1 for update;
  end if;

  -- At the boundary a move is a no-op rather than an error: a form submitted twice asks for the
  -- arrangement it already has.
  if v_other_id is null then
    return;
  end if;

  -- Two rows with one position after a swap of equal positions would leave the order to the id
  -- tiebreak; give the mover the other's position and the other the mover's, and where they were
  -- equal, spread them by one so the intent is visible in the column.
  if v_other_pos = v_position then
    if p_direction = 'up' then
      v_other_pos := v_position + 1;
    else
      v_other_pos := v_position - 1;
      if v_other_pos < 0 then
        v_other_pos := 0;
        v_position := 1;
      end if;
    end if;
    update merchandising_entries set position = v_other_pos where id = v_other_id;
    update merchandising_entries set position = v_position where id = p_entry_id;
    return;
  end if;

  update merchandising_entries set position = v_position where id = v_other_id;
  update merchandising_entries set position = v_other_pos where id = p_entry_id;
end $$;

revoke execute on function public.merch_move_entry(uuid, text) from public, anon;
grant execute on function public.merch_move_entry(uuid, text) to authenticated, service_role;

comment on function public.merch_move_entry(uuid, text) is
  'Move one merchandising entry one place up or down within its slot, atomically. SECURITY INVOKER: RLS decides who may.';

-- --- 7. The sweep -------------------------------------------------------------------------------

create or replace function public.merch_run_schedule(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row     record;
  v_state   text;
  v_opened  jsonb := '[]'::jsonb;
  v_closed  jsonb := '[]'::jsonb;
  v_paths   text[] := array[]::text[];
begin
  for v_row in
    select e.id, e.slot_id, e.entity_type, e.entity_id, e.publish_at, e.unpublish_at,
           e.window_state, s.key::text as slot_key, s.surface
      from merchandising_entries e
      join merchandising_slots s on s.id = e.slot_id
     where e.status = 'PUBLISHED'
       and (e.publish_at is not null or e.unpublish_at is not null)
     order by coalesce(e.unpublish_at, e.publish_at)
     for update of e skip locked
  loop
    v_state := case
      when v_row.unpublish_at is not null and v_row.unpublish_at <= p_now then 'CLOSED'
      when v_row.publish_at is null or v_row.publish_at <= p_now then 'OPEN'
      else 'PENDING'
    end;

    if v_state = v_row.window_state then
      continue;
    end if;

    update merchandising_entries
       set window_state = v_state,
           -- The public site already stopped returning it at unpublish_at — the resolver's window
           -- is the guarantee. This makes the row's status tell the truth afterwards.
           status = case when v_state = 'CLOSED' then 'ARCHIVED' else status end
     where id = v_row.id;

    -- check-migrations: allow-insert (a log row written at run time by the sweep, not content)
    insert into activity_events (actor_id, actor_role, action, entity_type, entity_id,
                                 entity_label, summary, metadata)
    values (null, null,
            'merchandising.window.' || lower(v_state),
            'merchandising_entries', v_row.id, v_row.slot_key,
            case v_state
              when 'OPEN' then 'Window opened on ' || v_row.surface
              when 'CLOSED' then 'Window closed on ' || v_row.surface
              else 'Window pending on ' || v_row.surface
            end,
            jsonb_build_object('slot_key', v_row.slot_key, 'surface', v_row.surface,
                               'entity_type', v_row.entity_type, 'entity_id', v_row.entity_id,
                               'ran_at', p_now));

    if v_state = 'OPEN' then
      v_opened := v_opened || jsonb_build_array(jsonb_build_object('entry_id', v_row.id, 'slot_key', v_row.slot_key));
      v_paths := v_paths || v_row.surface;
    elsif v_state = 'CLOSED' then
      v_closed := v_closed || jsonb_build_array(jsonb_build_object('entry_id', v_row.id, 'slot_key', v_row.slot_key));
      v_paths := v_paths || v_row.surface;
    end if;
  end loop;

  return jsonb_build_object(
    'ran_at', p_now,
    'opened', v_opened,
    'closed', v_closed,
    'paths', to_jsonb(array(select distinct unnest(v_paths) order by 1))
  );
end $$;

revoke execute on function public.merch_run_schedule(timestamptz) from public, anon, authenticated;
grant execute on function public.merch_run_schedule(timestamptz) to service_role;

comment on function public.merch_run_schedule(timestamptz) is
  'The merchandising pass of the content-schedule cron. Records each window transition in activity_events, archives an entry whose window closed, and returns the D3 paths to revalidate. Never puts anything on or off the site by itself: the resolver honours windows on every read.';

-- --- 8. The eleven slots ----------------------------------------------------------------------------

-- A slot is the address a surface reads and a screen writes; it carries no copy and cannot be
-- created or removed by an editor — see the file header.
-- check-migrations: allow-insert (structure: the four global slot addresses, no copy, no entity)
insert into merchandising_slots
  (key, name, description, surface, owning_studio_route, allowed_entity_types, min_items, max_items, fallback_mode)
values
  ('HOMEPAGE_SELECTED_WORKS', 'Homepage — Selected Works',
   'The pieces the homepage''s Selected Works band shows, in order. Below three, the band renders its editorial fallback: media and copy tiles with no price and no product link (SEED §10-04).',
   '/', '/studio/merchandising/homepage', array['PRODUCT']::relation_entity[], 3, 12, 'EDITORIAL_BLOCK'),
  ('HOMEPAGE_FEATURED_COLLECTIONS', 'Homepage — featured collections',
   'Published collections and categories featured on the homepage. Below three, the band is hidden rather than shown short (SEED §10-03).',
   '/', '/studio/merchandising/featured', array['COLLECTION','CATEGORY']::relation_entity[], 3, 12, 'HIDE_SECTION'),
  ('HOMEPAGE_JOURNAL_STRIP', 'Homepage — journal strip',
   'The articles the homepage''s journal band shows. Below three, the band is hidden (SEED §10-12).',
   '/', '/studio/merchandising/homepage', array['JOURNAL_ARTICLE']::relation_entity[], 3, 12, 'HIDE_SECTION'),
  ('STORE_FEATURED_ROW', 'Store — featured row',
   'Pieces and collections featured above the catalogue on /collection. Below three, the row is hidden.',
   '/collection', '/studio/merchandising/featured', array['PRODUCT','COLLECTION']::relation_entity[], 3, 12, 'HIDE_SECTION');

-- The seven per-category slots come from the trigger above, applied to the categories that
-- exist, so the migration and a later category use one rule. Refreshing the slug is the
-- trigger's insert path; the rows are otherwise untouched.
-- check-migrations: allow-insert (structure: the trigger's own key rule, run once over the categories already present)
insert into merchandising_slots
  (key, name, description, surface, owning_studio_route, allowed_entity_types, min_items, max_items, fallback_mode)
select public.merchandising_category_slot_key(c.slug::text),
       c.name || ' — pinned',
       'Pieces pinned to the top of this category''s listing. Governs the pinned region only; the category''s own grid is untouched.',
       '/collection/' || lower(c.slug::text),
       '/studio/merchandising/store',
       array['PRODUCT']::relation_entity[],
       1, 12, 'SHOW_EMPTY_STATE'
  from categories c
 where c.parent_id is null
on conflict (key) do nothing;

alter table merchandising_slots enable row level security;
alter table merchandising_entries enable row level security;
