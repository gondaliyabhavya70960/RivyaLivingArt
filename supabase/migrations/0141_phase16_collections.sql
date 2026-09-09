-- ============================================================================================
-- 0141 — a collection becomes an exhibition
--
-- Phase 03 created `collections` as a stub: a slug, a name, a statement nobody has written and a
-- concept state with one value. This gives it the columns FEAT §8 needs, the edge table FEAT §10
-- describes, and the guards that make FEAT §9's central instruction — "Do not fabricate them as
-- real published collections" — a property of the database rather than a note in a document.
--
-- FIVE COLUMNS THE PHASE DOCUMENT ASKS FOR ARE NOT HERE, and their absence is deliberate. It lists
-- `seed_key`, `content_seed_version`, `seed_content_hash`, `seed_last_applied_at` and
-- `owner_edited` as Phase 16 additions. All five shipped in `0004_taxonomy.sql`, and
-- `collections_seed_key_idx` / `collections_seed_version_idx` shipped in `0070`. Adding them again
-- fails the migration. Verified with `\d collections` rather than read off the phase table.
--
-- THE PAGE LINK IS A NEW PATTERN, NOT A COPY. Searching for how CATEGORY entity pages tie to
-- `categories` finds nothing, and nothing was missed: `categories` has no `page_id` and no
-- migration creates one. A category page is joined to its category by naming convention only
-- (`content/seed/collections.ts` seeds `page:collection.<slug>` at `/collection/<slug>`). Phase 16
-- is the first phase to make the link a column.
--
--   * `pages.slug` is `citext not null unique`, and the seven seeded category pages already own
--     `collection-<slug>`. A collection called `furniture` would collide on that index even though
--     `/collection/furniture` and `/collections/furniture` are different paths. The exhibition page
--     for a collection therefore uses the prefix `collections-<slug>` — plural, matching its route.
--   * `pages_kind_allowed` is a CHECK on a text column, not an enum (`0050` says "NO NEW ENUMS"),
--     so extending it is a drop and a re-add rather than an `alter type`.
--   * `pages_path_present` requires a path on every non-SYSTEM page, so a COLLECTION page always
--     has one. That is not a formality: `pages_select_public` tests `status = 'PUBLISHED'` AND
--     `path is not null` AND the schedule window, so a page with a null path is invisible to the
--     public even when published.
--
-- WHICH WAY THE STATUS SYNC RUNS, AND WHY IT CANNOT RUN THE OTHER WAY.
--
-- The obvious trigger — mirror `collections.status` onto `pages.status` — is impossible twice over,
-- and both were measured rather than assumed:
--
--   1. `pages_enforce_status_transition` has no `DRAFT -> PUBLISHED` edge (`0052`), and its
--      edge-legality branch runs for EVERY actor. Only the per-actor permission branch is skipped
--      when `current_staff_role()` is null, so not even the service role may take an illegal edge.
--      `collections` carries no transition trigger, so a collection legitimately jumps straight to
--      PUBLISHED — an edge the page may not take.
--   2. Worse, the roles do not overlap where it matters. `catalog.write` is owner/admin/merchandiser;
--      every page transition permission is owner/admin/editor. THE ROLE THAT OWNS COLLECTIONS IS
--      PRECISELY THE ROLE THAT MAY NOT MOVE A PAGE. `security definer` does not rescue it, because
--      `current_staff_role()` reads `auth.uid()` and a definer context does not change who you are.
--
-- So the sync runs PAGE -> COLLECTION. The exhibition page is published through the ordinary CMS
-- workflow that Phase 08 already built — review, approval, revisions, scheduling — and the
-- collection follows it. That direction is legal (nothing guards `collections.status`) and it
-- avoids the failure the phase's own risk table names: "Collections quietly become a second block
-- system". There is one publication workflow on this site, and it belongs to `pages`.
--
-- The gate still fires, and fires usefully: publishing the exhibition page of a concept nobody has
-- confirmed raises `collection <slug> cannot be published while concept_state = ...`, naming the
-- collection rather than the page.
--
-- EVERY FUNCTION HERE REVOKES EXECUTE. PostgreSQL grants EXECUTE on a new function to PUBLIC, and
-- Supabase exposes anything callable as a PostgREST RPC — `0022_function_grants.sql` says so at
-- length. `0122` and `0130` omitted the revoke and their functions are anon-executable today; they
-- are the lapse, not the convention, and `0143` corrects them.
-- ============================================================================================

-- --- 1. the relation vocabulary --------------------------------------------------------------
-- A BRAND-NEW enum type IS usable in the transaction that creates it — only `alter type ... add
-- value` is restricted, which is why `0140` exists and this does not need to. Measured.
create type relation_entity as enum (
  'PRODUCT', 'COLLECTION', 'CATEGORY', 'PORTFOLIO_PROJECT', 'JOURNAL_ARTICLE', 'MATERIAL'
);

create type relation_kind as enum (
  'RELATED', 'FEATURES', 'REFERENCES', 'USES_MATERIAL', 'PART_OF'
);

comment on type relation_entity is
  'What an entity_relations edge may point at or from. Closed by construction: an edge to a table no renderer knows is an association nobody can display.';
comment on type relation_kind is
  'What an edge MEANS. Closed so that "customers also bought" — a claim about behaviour this business does not measure — cannot be stored (FEAT §11).';

-- --- 2. collections gains its exhibition columns ----------------------------------------------
alter table collections
  add column page_id            uuid unique references pages (id) on delete set null,
  add column subtitle           text,
  add column statement_long     text,
  add column signature_media_id uuid references media_assets (id) on delete set null,
  add column video_media_id     uuid references media_assets (id) on delete set null,
  add column seo_entry_id       uuid references seo_entries (id) on delete set null,
  add column owner_confirmed_at timestamptz,
  add column owner_confirmed_by uuid references auth.users (id);

comment on column collections.page_id is
  'The exhibition page (pages.kind = COLLECTION) this collection renders through. ON DELETE SET NULL governs the PAGE being deleted — it unlinks the collection. Deleting the collection does NOT remove its page; that is a Studio act, so the editor can see what they are discarding.';
comment on column collections.statement_long is
  'The long-form statement. Empty on every seeded concept and deliberately so: a statement describing a collection that does not yet exist asserts a business capability nobody has confirmed (D10).';
comment on column collections.owner_confirmed_at is
  'When the owner confirmed this concept is a real collection. Written by enforce_collection_concept_authority, never by a form, so the record cannot be back-dated through the Studio.';

-- --- 3. pages learns about COLLECTION ----------------------------------------------------------
-- A CHECK on text, not an enum, so this is a drop and a re-add. `pages_path_present` and
-- `pages_system_is_system` also key off `kind` and are untouched: a COLLECTION page is not SYSTEM,
-- so it must carry a path, which is exactly what `/collections/<slug>` needs.
alter table pages drop constraint pages_kind_allowed;

alter table pages add constraint pages_kind_allowed
  check (kind in ('PAGE', 'CATEGORY', 'SYSTEM', 'COLLECTION'));

comment on constraint pages_kind_allowed on pages is
  'What kind of thing a page is. COLLECTION arrives in Phase 16 for exhibition pages, which are ordinary CMS pages joined to a collection by collections.page_id.';

-- --- 4. entity_relations ------------------------------------------------------------------------
-- AN EDGE, NOT CONTENT, so it carries created_at and created_by ONLY — the same shape as the four
-- Phase 03 join tables (DATA_MODEL §6). Giving an edge a `status` would mean a relation could be
-- draft, which is a state nobody can act on: either an editor made the connection or they did not.
create table entity_relations (
  id            uuid primary key default gen_random_uuid(),
  source_type   relation_entity not null,
  source_id     uuid not null,
  target_type   relation_entity not null,
  target_id     uuid not null,
  relation_type relation_kind not null,
  note          text,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users (id),

  constraint entity_relations_unique_edge
    unique (source_type, source_id, target_type, target_id, relation_type),

  -- A thing is not related to itself, and an edge saying so would render as a card linking to the
  -- page it is already on.
  constraint entity_relations_no_self
    check (not (source_type = target_type and source_id = target_id)),

  constraint entity_relations_note_present
    check (note is null or btrim(note) <> '')
);

-- `source_id` and `target_id` are DELIBERATELY UN-FOREIGN-KEYED, matching `product_relations` in
-- `0006`: the referent may be a product, a collection, a category, a project, an article or a
-- material, and a polymorphic edge cannot name six parents in one constraint. The repository is
-- what re-filters a target to something published; see lib/supabase/repositories.
comment on table entity_relations is
  'Hand-made edges between entities (FEAT §10/§11). NO EDGE IS EVER CREATED AUTOMATICALLY — Phase 23 owns suggestion, and even then a suggestion becomes an edge only when a person accepts it. created_by is how that is auditable, which is why it is written on every row.';
comment on column entity_relations.created_by is
  'The person who made this connection. A row with a null created_by came from the service role — a migration or a seed — and no seed writes here, so in practice a null is a defect worth finding.';

create index entity_relations_source_idx on entity_relations (source_type, source_id, relation_type, sort_order);
create index entity_relations_target_idx on entity_relations (target_type, target_id);

alter table entity_relations enable row level security;

-- --- 5. a concept may not be published until the owner says it is real -------------------------
create or replace function public.enforce_collection_publish_gate() returns trigger
  language plpgsql
  set search_path = pg_catalog, public
  as $$
begin
  if new.status = 'PUBLISHED' and new.concept_state <> 'OWNER_CONFIRMED' then
    raise exception
      'collection % cannot be published while concept_state = % (FEAT §9)',
      new.slug, new.concept_state
      using errcode = '23514',
            constraint = 'collection_publish_gate',
            detail = 'constraint=collection_publish_gate',
            hint = 'The ten seeded names are starting concepts, not collections Rivya has made. An owner or admin confirms one before it can be published.';
  end if;
  return new;
end $$;

comment on function public.enforce_collection_publish_gate() is
  'FEAT §9: seed only as DRAFT_COLLECTION_CONCEPT unless the owner confirms. This is what makes "unless" enforceable.';

revoke execute on function public.enforce_collection_publish_gate() from public, anon, authenticated;

create trigger collections_enforce_publish_gate
  before insert or update on collections
  for each row execute function public.enforce_collection_publish_gate();

-- --- 6. only an owner or an admin may confirm a concept ----------------------------------------
-- A CHECK CONSTRAINT CANNOT EXPRESS THIS: the rule is about the actor, and a constraint sees only
-- the row. Shaped after `enforce_verification_authority` from `0052`, including its errcode and its
-- service-role bypass — a migration or the seed runner has no session role and is not being asked
-- to prove one.
create or replace function public.enforce_collection_concept_authority() returns trigger
  language plpgsql
  set search_path = pg_catalog, public
  as $$
declare
  actor_role user_role := public.current_staff_role();
begin
  if new.concept_state = 'OWNER_CONFIRMED'
     and (tg_op = 'INSERT' or old.concept_state is distinct from 'OWNER_CONFIRMED') then

    if actor_role is not null and not public.has_role('owner', 'admin') then
      raise exception
        'role % may not confirm a collection concept', actor_role
        using errcode = '42501',
              constraint = 'collection_concept_authority',
              detail = 'constraint=collection_concept_authority',
              hint = 'Confirming a concept asserts that Rivya has actually made this collection. Only an owner or an admin may say so.';
    end if;

    -- Stamped here rather than accepted from the form, so the record of who confirmed and when
    -- cannot be written by whoever is submitting.
    new.owner_confirmed_at := now();
    new.owner_confirmed_by := auth.uid();
  end if;

  -- Withdrawing a confirmation clears the stamp, so a retired concept does not keep a confirmation
  -- that no longer holds.
  if tg_op = 'UPDATE'
     and old.concept_state = 'OWNER_CONFIRMED'
     and new.concept_state <> 'OWNER_CONFIRMED' then
    new.owner_confirmed_at := null;
    new.owner_confirmed_by := null;
  end if;

  return new;
end $$;

comment on function public.enforce_collection_concept_authority() is
  'Only owner or admin may move a collection to OWNER_CONFIRMED, and the confirmation stamp is written here rather than submitted. FEAT §9.';

revoke execute on function public.enforce_collection_concept_authority() from public, anon, authenticated;

create trigger collections_enforce_concept_authority
  before insert or update on collections
  for each row execute function public.enforce_collection_concept_authority();

-- --- 7. the exhibition page's path follows the collection's slug -------------------------------
-- SECURITY DEFINER, and not for convenience: `pages_update_staff` admits owner/admin/editor, while
-- a collection is edited by owner/admin/merchandiser. An invoker-rights trigger would have the
-- merchandiser's UPDATE FILTERED AWAY BY RLS — zero rows, no error, the path silently stale and
-- `/collections/<new-slug>` a 404 with nothing in the logs.
create or replace function public.sync_collection_page_path() returns trigger
  language plpgsql
  security definer
  set search_path = pg_catalog, public
  as $$
begin
  if new.page_id is not null and (tg_op = 'INSERT' or new.slug is distinct from old.slug) then
    -- LOWERCASED, because `collections.slug` is citext and preserves whatever case was typed while
    -- `pages_path_shape` refuses any upper-case character. A mixed-case slug passes every
    -- uniqueness test and then fails at the page constraint, naming pages_path_shape rather than
    -- the collection — a confusing error a lower() prevents.
    update pages
       set path = '/collections/' || lower(new.slug::text)
     where id = new.page_id;
  end if;
  return new;
end $$;

comment on function public.sync_collection_page_path() is
  'Keeps the exhibition page addressable at the collection slug. SECURITY DEFINER because the role that edits collections may not update pages, and an RLS-filtered UPDATE reports success while changing nothing.';

revoke execute on function public.sync_collection_page_path() from public, anon, authenticated;

create trigger collections_sync_page_path
  after insert or update of slug, page_id on collections
  for each row execute function public.sync_collection_page_path();

-- --- 8. the collection follows its page's publication ------------------------------------------
-- PAGE -> COLLECTION. See the header for why the other direction cannot exist. The page owns the
-- workflow; this makes the collection agree with it.
--
-- SECURITY DEFINER for the mirror image of the reason above: the editor who publishes a page holds
-- content.publish (owner/admin/editor), and `collections_update_staff` admits catalog.write
-- (owner/admin/merchandiser). An editor's UPDATE would be filtered to zero rows.
create or replace function public.sync_entity_page_status() returns trigger
  language plpgsql
  security definer
  set search_path = pg_catalog, public
  as $$
begin
  if new.kind = 'COLLECTION' and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    -- The publish gate on `collections` fires from inside this update, so publishing the exhibition
    -- page of an unconfirmed concept fails and names the COLLECTION. That is the intended reading:
    -- what is not ready is the concept, not the page.
    update collections
       set status = new.status
     where page_id = new.id
       and status is distinct from new.status;
  end if;
  return new;
end $$;

comment on function public.sync_entity_page_status() is
  'An entity page publishes its entity. Runs page -> entity because pages carry the status workflow and collections do not; the reverse is refused by enforce_status_transition for every actor, including the service role.';

revoke execute on function public.sync_entity_page_status() from public, anon, authenticated;

create trigger pages_sync_entity_status
  after insert or update of status on pages
  for each row execute function public.sync_entity_page_status();
