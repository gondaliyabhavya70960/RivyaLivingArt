-- 0050 — PHASE 08: the CMS spine.
--
-- Seven tables, five triggers and four SECURITY DEFINER functions that together let an editor add,
-- reorder, hide, schedule, publish and unpublish any section of any page without a deploy.
--
-- TABLE ORDER IS NOT THE PHASE DOCUMENT'S. `pages.seo_entry_id` references `seo_entries`, so
-- `seo_entries` is created first; transcribing the document's order gives a migration that fails on
-- its first foreign key. `page_sections` follows `pages`, and the four standalone content tables
-- come last in the order the seed will fill them.
--
-- NO NEW ENUMS. `pages.kind`, `navigation_items.menu`, `global_content.group_key`,
-- `seo_entries.scope` and `content_revisions.action` are `text` with named check constraints, not
-- enums, because DATA_MODEL §12 shows four later phases adding values to them (Phase 39 extends
-- `seo_entries.scope`, Phase 18.2 adds `global_content` groups). `alter type ... add value` cannot
-- run inside a transaction block on PostgreSQL and cannot be reverted; a check constraint is one
-- `alter table` either way. The five enums this file DOES use — `content_status`,
-- `owner_verification`, `fact_classification` — already exist from `0002`.
--
-- WHY `group_key` AND NOT `group`. `group` is a reserved word in SQL. It is quotable, but every
-- query, every PostgREST filter and every generated type would carry the quotes forever.
--
-- A5's standing rule: pin the search path so `citext` resolves whatever the caller's setting is.
set search_path = public, extensions;

-- ============================================================================================
-- seo_entries — first, because pages references it
-- ============================================================================================

create table seo_entries (
  id                 uuid primary key default gen_random_uuid(),
  scope              text not null,
  -- Exactly one of these three shapes is populated, enforced below. A GLOBAL row is the site-wide
  -- default and there may be only one.
  path               text,
  entity_type        text,
  entity_id          uuid,
  title              text,
  description        text,
  social_title       text,
  social_description text,
  og_media_id        uuid references media_assets(id) on delete set null,
  canonical_url      text,
  robots             text,
  status             content_status not null default 'DRAFT',
  owner_verification owner_verification not null default 'NOT_REQUIRED',
  fact_classification fact_classification not null default 'SEO_COPY',
  seed_key           text,
  content_seed_version text,
  seed_content_hash  text,
  seed_last_applied_at timestamptz,
  owner_edited       boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  updated_by         uuid references auth.users(id),
  published_at       timestamptz,
  published_by       uuid references auth.users(id),

  constraint seo_entries_scope_allowed check (scope in ('GLOBAL', 'PATH', 'ENTITY')),
  -- At most one target. `num_nonnulls` rather than a chain of `is null` tests: it says the rule
  -- once and reads the same as the sentence it enforces.
  constraint seo_entries_single_target check (num_nonnulls(path, entity_id) <= 1),
  constraint seo_entries_scope_coherent check (
    (scope = 'GLOBAL'  and path is null and entity_type is null and entity_id is null) or
    (scope = 'PATH'    and path is not null and entity_type is null and entity_id is null) or
    (scope = 'ENTITY'  and path is null and entity_type is not null and entity_id is not null)
  ),
  constraint seo_entries_path_shape check (path is null or path ~ '^/[a-z0-9/-]*$'),
  constraint seo_entries_robots_allowed check (
    robots is null or robots in ('index,follow', 'noindex,follow', 'index,nofollow', 'noindex,nofollow')
  ),
  -- Named to match the five Phase 03 constraints of the same shape; check-schema.mjs asserts by
  -- that name suffix. A check constraint rather than a trigger because a check has no INSERT hole.
  constraint seo_entries_verified_before_publish check (
    status <> 'PUBLISHED' or owner_verification <> 'OWNER_VERIFICATION_REQUIRED'
  )
);

-- Three partial unique indexes rather than one composite: each scope has a different notion of
-- "the same entry", and a composite over nullable columns would treat two GLOBAL rows as distinct.
create unique index seo_entries_global_singleton_idx on seo_entries ((true)) where scope = 'GLOBAL';
create unique index seo_entries_path_idx on seo_entries (path) where scope = 'PATH';
create unique index seo_entries_entity_idx on seo_entries (entity_type, entity_id) where scope = 'ENTITY';

comment on table seo_entries is
  'SEO metadata at three scopes: one GLOBAL default, one per PATH, one per ENTITY. Phase 39 extends the scope vocabulary.';
comment on constraint seo_entries_single_target on seo_entries is
  'A row targets a path or an entity, never both. GLOBAL targets neither.';

-- ============================================================================================
-- pages
-- ============================================================================================

create table pages (
  id            uuid primary key default gen_random_uuid(),
  slug          citext not null unique,
  -- NULLABLE, and that nullability is a security control rather than a convenience. A SYSTEM page
  -- (the reserved `slug = 'global'` row the global-content editor resolves) has no public address,
  -- and `lib/cms/resolve.ts` matches on `path`, so `null` makes it structurally unreachable from a
  -- public request: null equals nothing, including itself. The alternative — a real path plus an
  -- application-level filter — is a promise a future refactor can quietly break.
  path          text,
  kind          text not null default 'PAGE',
  title         text not null,
  status        content_status not null default 'DRAFT',
  publish_at    timestamptz,
  unpublish_at  timestamptz,
  seo_entry_id  uuid references seo_entries(id) on delete set null,
  is_system     boolean not null default false,
  seed_key      text,
  content_seed_version text,
  seed_content_hash text,
  seed_last_applied_at timestamptz,
  owner_edited  boolean not null default false,
  owner_verification owner_verification not null default 'NOT_REQUIRED',
  fact_classification fact_classification not null default 'EDITORIAL_COPY',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id),
  published_at  timestamptz,
  published_by  uuid references auth.users(id),

  constraint pages_kind_allowed check (kind in ('PAGE', 'CATEGORY', 'SYSTEM')),
  -- The phase document's rule: everything except a SYSTEM page must be addressable.
  constraint pages_path_present check (kind = 'SYSTEM' or path is not null),
  constraint pages_system_is_system check (kind <> 'SYSTEM' or is_system),
  constraint pages_path_shape check (path is null or path ~ '^/[a-z0-9/-]*$'),
  -- `[pageId]` resolves a uuid by id and anything else by slug. A uuid-shaped slug would be looked
  -- up as an id, find nothing, and 404 a page that exists — unreachable in Studio, with no error
  -- naming the cause.
  constraint pages_slug_not_uuid_shaped check (
    slug !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ),
  constraint pages_schedule_ordered check (
    publish_at is null or unpublish_at is null or unpublish_at > publish_at
  ),
  constraint pages_verified_before_publish check (
    status <> 'PUBLISHED' or owner_verification <> 'OWNER_VERIFICATION_REQUIRED'
  )
);

-- A partial unique INDEX, not a constraint: PostgreSQL cannot express a partial unique constraint.
create unique index pages_path_idx on pages (path) where path is not null;
create index pages_status_idx on pages (status);

comment on table pages is
  'A page is an ordered list of typed blocks. kind = SYSTEM carries a null path and is never servable.';
comment on column pages.path is
  'Null only for kind = SYSTEM. Null is the guard that keeps a system page off the public site, not a filter the resolver applies.';

-- ============================================================================================
-- page_sections
-- ============================================================================================

create table page_sections (
  id            uuid primary key default gen_random_uuid(),
  page_id       uuid not null references pages(id) on delete cascade,
  block_type    text not null,
  position      int not null,
  is_visible    boolean not null default true,
  theme         text,
  layout_variant text,

  -- SEED §5's shared copy fields.
  eyebrow             text,
  heading             text,
  heading_highlight   text,
  body                text,
  supporting          text,
  cta_label           text,
  cta_url             text,
  cta_secondary_label text,
  cta_secondary_url   text,

  media_desktop_id  uuid references media_assets(id) on delete restrict,
  media_mobile_id   uuid references media_assets(id) on delete restrict,
  media_alt_override text,
  -- THE PHASE 07 CONTRACT. The `content/media-slots.ts` registry key for the desktop/mobile pair,
  -- verbatim. The database cannot derive it: `/` alone declares `home.hero.video`,
  -- `home.hero.poster` and `home.intro`, and deriving it from `path + block_type` breaks the moment
  -- one page carries two blocks of a type. Without this column `sync_media_usages` has no correct
  -- `slot_key` to write, and the Studio Gaps tab reports every slot unbound with no error anywhere.
  media_slot_key    text,

  payload       jsonb not null default '{}'::jsonb,

  fact_classification  fact_classification not null default 'EDITORIAL_COPY',
  field_classifications jsonb not null default '{}'::jsonb,
  owner_verification   owner_verification not null default 'NOT_REQUIRED',

  status        content_status not null default 'DRAFT',
  publish_at    timestamptz,
  unpublish_at  timestamptz,

  -- The answer to "a scheduled publish refused for unapproved media must neither vanish nor retry
  -- every five minutes forever". PENDING is eligible, CLAIMED is in flight, BLOCKED has failed
  -- enough times that a human must look. `set_schedule_state_on_edit` resets it on any human edit.
  schedule_state          text not null default 'PENDING',
  schedule_attempts       int not null default 0,
  schedule_error          text,
  schedule_last_attempt_at timestamptz,

  seed_key      text,
  content_seed_version text,
  seed_content_hash text,
  seed_last_applied_at timestamptz,
  owner_edited  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id),
  published_at  timestamptz,
  published_by  uuid references auth.users(id),

  constraint page_sections_position_non_negative check (position >= 0),
  -- DEFERRABLE is what makes a one-statement reorder legal: `cms_reorder_sections` rewrites every
  -- position in one UPDATE and the uniqueness is checked once, at commit, rather than row by row
  -- through a transiently duplicated state.
  constraint page_sections_unique_position unique (page_id, position) deferrable initially deferred,
  -- `not null default '{}'` alone accepts `'null'::jsonb`, which is a JSON null, not an object,
  -- and would make `payload->'media'` silently absent rather than an error.
  constraint page_sections_payload_is_object check (jsonb_typeof(payload) = 'object'),
  constraint page_sections_field_classifications_is_object check (
    jsonb_typeof(field_classifications) = 'object'
  ),
  constraint page_sections_theme_allowed check (theme is null or theme in ('DEEP', 'INK', 'BONE')),
  constraint page_sections_schedule_ordered check (
    publish_at is null or unpublish_at is null or unpublish_at > publish_at
  ),
  constraint page_sections_schedule_state_allowed check (
    schedule_state in ('PENDING', 'CLAIMED', 'BLOCKED')
  ),
  constraint page_sections_verified_before_publish check (
    status <> 'PUBLISHED' or owner_verification <> 'OWNER_VERIFICATION_REQUIRED'
  )
);

create index page_sections_page_idx on page_sections (page_id, position);
create index page_sections_status_idx on page_sections (status);
create index page_sections_media_desktop_idx on page_sections (media_desktop_id);
create index page_sections_media_mobile_idx on page_sections (media_mobile_id);
-- The cron's due query. Partial, because only PENDING rows are ever eligible.
create index page_sections_schedule_due_idx on page_sections (publish_at, unpublish_at)
  where schedule_state = 'PENDING';

comment on table page_sections is
  'One typed block on a page. Shared SEED section-5 fields are columns; block-specific data is Zod-validated payload jsonb.';
comment on constraint page_sections_unique_position on page_sections is
  'DEFERRABLE INITIALLY DEFERRED so a whole-page reorder is one statement. It can never be an ON CONFLICT arbiter — Postgres refuses a deferrable constraint there.';
comment on column page_sections.media_slot_key is
  'The content/media-slots.ts registry key, verbatim. sync_media_usages writes it into media_usages.slot_key; lib/media/gaps.ts joins on it.';

-- ============================================================================================
-- content_revisions — append-only
-- ============================================================================================

create table content_revisions (
  id             uuid primary key default gen_random_uuid(),
  entity_type    text not null,
  entity_id      uuid not null,
  revision_no    int not null,
  action         text not null,
  snapshot       jsonb not null,
  change_summary text,
  created_at     timestamptz not null default now(),
  created_by     uuid references auth.users(id),

  constraint content_revisions_entity_type_allowed check (
    entity_type in ('page', 'page_section', 'navigation_item', 'global_content', 'faq')
  ),
  constraint content_revisions_action_allowed check (
    action in ('CREATE', 'UPDATE', 'STATUS_CHANGE', 'RESTORE', 'DELETE')
  ),
  constraint content_revisions_snapshot_is_object check (jsonb_typeof(snapshot) = 'object'),
  constraint content_revisions_revision_no_positive check (revision_no > 0),
  constraint content_revisions_unique_no unique (entity_type, entity_id, revision_no)
);

create index content_revisions_entity_idx on content_revisions (entity_type, entity_id, revision_no desc);

comment on table content_revisions is
  'Immutable snapshot per mutation. Written only by write_revision(); no UPDATE or DELETE policy exists for any session role.';

-- ============================================================================================
-- navigation_items
-- ============================================================================================

create table navigation_items (
  id          uuid primary key default gen_random_uuid(),
  menu        text not null,
  parent_id   uuid references navigation_items(id) on delete cascade,
  label       text not null,
  href        text not null,
  position    int not null,
  is_visible  boolean not null default true,
  target      text not null default '_self',
  status      content_status not null default 'DRAFT',
  owner_verification owner_verification not null default 'NOT_REQUIRED',
  fact_classification fact_classification not null default 'BRAND_COPY',
  seed_key    text,
  content_seed_version text,
  seed_content_hash text,
  seed_last_applied_at timestamptz,
  owner_edited boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id),
  published_at timestamptz,
  published_by uuid references auth.users(id),

  constraint navigation_items_menu_allowed check (menu in ('HEADER', 'FOOTER', 'MOBILE', 'CATEGORY')),
  constraint navigation_items_target_allowed check (target in ('_self', '_blank')),
  constraint navigation_items_position_non_negative check (position >= 0),
  constraint navigation_items_not_own_parent check (parent_id is null or parent_id <> id),
  constraint navigation_items_verified_before_publish check (
    status <> 'PUBLISHED' or owner_verification <> 'OWNER_VERIFICATION_REQUIRED'
  )
);

create index navigation_items_menu_idx on navigation_items (menu, position);

comment on table navigation_items is
  'Header, footer, mobile and category menus. One level of nesting via parent_id.';

-- ============================================================================================
-- global_content
-- ============================================================================================

create table global_content (
  id          uuid primary key default gen_random_uuid(),
  -- `group` is a reserved word; quoting it forever is worse than naming it once.
  group_key   text not null,
  key         text not null,
  label       text,
  value       text not null,
  description text,
  is_enabled  boolean not null default true,
  fact_classification fact_classification not null default 'BRAND_COPY',
  owner_verification owner_verification not null default 'NOT_REQUIRED',
  status      content_status not null default 'DRAFT',
  seed_key    text,
  content_seed_version text,
  seed_content_hash text,
  seed_last_applied_at timestamptz,
  owner_edited boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id),
  published_at timestamptz,
  published_by uuid references auth.users(id),

  constraint global_content_group_allowed check (group_key in (
    'CTA', 'COMMERCE_LABEL', 'ACTION_LABEL', 'EMPTY_STATE', 'FORM_COPY', 'ANNOUNCEMENT',
    'WHATSAPP_TEMPLATE', 'STUDIO_HELP', 'SEO_DEFAULT', 'SOCIAL', 'NEWSLETTER'
  )),
  constraint global_content_unique_key unique (group_key, key),
  constraint global_content_verified_before_publish check (
    status <> 'PUBLISHED' or owner_verification <> 'OWNER_VERIFICATION_REQUIRED'
  )
);

create index global_content_group_idx on global_content (group_key, key);

comment on table global_content is
  'Key/value copy shared across pages: the CTA library, labels, empty states, form copy, Studio helper text. Phase 09 seeds components/studio/strings.ts into the STUDIO_HELP group.';

-- ============================================================================================
-- faqs
-- ============================================================================================

create table faqs (
  id          uuid primary key default gen_random_uuid(),
  question    text not null,
  answer      text not null,
  category    text,
  position    int not null default 0,
  status      content_status not null default 'DRAFT',
  owner_verification owner_verification not null default 'NOT_REQUIRED',
  fact_classification fact_classification not null default 'EDITORIAL_COPY',
  seed_key    text,
  content_seed_version text,
  seed_content_hash text,
  seed_last_applied_at timestamptz,
  owner_edited boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id),
  published_at timestamptz,
  published_by uuid references auth.users(id),

  constraint faqs_position_non_negative check (position >= 0),
  constraint faqs_verified_before_publish check (
    status <> 'PUBLISHED' or owner_verification <> 'OWNER_VERIFICATION_REQUIRED'
  )
);

create index faqs_category_idx on faqs (category, position);

comment on table faqs is
  'Questions rendered by the faq-list block, filtered by category. Many carry OWNER_VERIFICATION_REQUIRED: an answer about lead times or materials is a business fact.';

-- ============================================================================================
-- RLS on, no policy — 0051 grants, exactly as every phase before this one
-- ============================================================================================

alter table seo_entries       enable row level security;
alter table pages             enable row level security;
alter table page_sections     enable row level security;
alter table content_revisions enable row level security;
alter table navigation_items  enable row level security;
alter table global_content    enable row level security;
alter table faqs              enable row level security;

-- ============================================================================================
-- Triggers
-- ============================================================================================

-- set_updated_at() comes from 0003.
create trigger seo_entries_set_updated_at       before update on seo_entries       for each row execute function set_updated_at();
create trigger pages_set_updated_at             before update on pages             for each row execute function set_updated_at();
create trigger page_sections_set_updated_at     before update on page_sections     for each row execute function set_updated_at();
create trigger navigation_items_set_updated_at  before update on navigation_items  for each row execute function set_updated_at();
create trigger global_content_set_updated_at    before update on global_content    for each row execute function set_updated_at();
create trigger faqs_set_updated_at              before update on faqs              for each row execute function set_updated_at();

-- --------------------------------------------------------------------------------------------
-- set_owner_edited() — one-way, deliberately
-- --------------------------------------------------------------------------------------------
--
-- `updated_by` is null for the seed runner (which connects over DATABASE_URL as the service role,
-- A4·d) and non-null for anything a person did through Studio. So a non-null `updated_by` is the
-- signal that a human touched this row, and the Phase 09 seed reads `owner_edited` to know it must
-- not overwrite them.
--
-- THERE IS NO `else` BRANCH, AND THAT IS THE WHOLE DESIGN. A branch setting the flag back to false
-- would let the seed runner clear a flag a human set — silently restoring seeded copy over an
-- owner's edit on the next seed run, which is precisely the failure the flag exists to prevent.
create or replace function public.set_owner_edited()
returns trigger
language plpgsql
security invoker
set search_path = public, extensions
as $$
begin
  if new.updated_by is not null then
    new.owner_edited := true;
  end if;
  return new;
end;
$$;

create trigger seo_entries_set_owner_edited      before insert or update on seo_entries      for each row execute function set_owner_edited();
create trigger pages_set_owner_edited            before insert or update on pages            for each row execute function set_owner_edited();
create trigger page_sections_set_owner_edited    before insert or update on page_sections    for each row execute function set_owner_edited();
create trigger navigation_items_set_owner_edited before insert or update on navigation_items for each row execute function set_owner_edited();
create trigger global_content_set_owner_edited   before insert or update on global_content   for each row execute function set_owner_edited();
create trigger faqs_set_owner_edited             before insert or update on faqs             for each row execute function set_owner_edited();

-- --------------------------------------------------------------------------------------------
-- set_schedule_state_on_edit() — a human edit un-blocks a stuck schedule
-- --------------------------------------------------------------------------------------------
--
-- The cron marks a section BLOCKED after three refusals (say, a bound asset an editor never
-- approved) and stops attempting it, so a permanently unpublishable section does not consume a
-- slot in every five-minute tick forever. Something has to un-block it, and the only meaningful
-- signal is that a person changed the row — which is exactly what they would do to fix the cause.
create or replace function public.reset_schedule_state()
returns trigger
language plpgsql
security invoker
set search_path = public, extensions
as $$
begin
  -- Only on a human edit, and only when the schedule columns or the content changed — not when the
  -- cron itself writes schedule_attempts, which would reset the counter it just incremented.
  if new.updated_by is not null
     and new.schedule_state = 'BLOCKED'
     and old.schedule_attempts = new.schedule_attempts then
    new.schedule_state := 'PENDING';
    new.schedule_attempts := 0;
    new.schedule_error := null;
  end if;
  return new;
end;
$$;

create trigger page_sections_reset_schedule_state
  before update on page_sections
  for each row execute function reset_schedule_state();

-- --------------------------------------------------------------------------------------------
-- write_revision() — the audit trail
-- --------------------------------------------------------------------------------------------
--
-- SECURITY DEFINER, and that is forced rather than chosen: `content_revisions` is shape C with no
-- write policy for any session role (0051), which is what guarantees the history cannot be edited
-- by the people it records. An invoker-rights trigger would therefore insert zero rows and succeed
-- — RLS does not raise on a non-matching INSERT, it just discards it — and the audit trail would
-- be silently empty while every mutation appeared to work.
--
-- `revision_no` IS ALLOCATED UNDER AN ADVISORY LOCK, not by a sequence. A sequence would be
-- global; these numbers are per entity, so `content_revisions` for one section reads 1, 2, 3 and
-- not 47, 112, 3809. `max(...) + 1` alone races: two concurrent updates to one row both read the
-- same max and one loses on the unique constraint. The lock is transaction-scoped and keyed on the
-- entity, so it serialises writers to ONE row without touching any other.
--
-- The unique constraint stays anyway. A lock is a convention; the constraint is the guarantee.
create or replace function public.write_revision()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_entity_type text := tg_argv[0];
  v_action      text;
  v_next        int;
  v_snapshot    jsonb;
begin
  -- The GUC lets cms_restore_revision() label its own write RESTORE rather than UPDATE, using the
  -- same idiom guard_stage_transition uses. `true` as the second argument means "missing is null",
  -- not "raise".
  v_action := nullif(current_setting('rivya.revision_action', true), '');

  if v_action is null then
    if tg_op = 'INSERT' then
      v_action := 'CREATE';
    elsif old.status is distinct from new.status then
      v_action := 'STATUS_CHANGE';
    else
      v_action := 'UPDATE';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_entity_type || ':' || new.id::text, 0));

  select coalesce(max(revision_no), 0) + 1
    into v_next
    from content_revisions
   where entity_type = v_entity_type and entity_id = new.id;

  -- `updated_at` and `seed_last_applied_at` are removed because they change on every write by
  -- definition. Leaving them in would make two otherwise identical revisions differ, so a diff
  -- between them would show a timestamp and nothing else — noise in the one place a reader is
  -- trying to see what actually changed.
  v_snapshot := to_jsonb(new) - 'updated_at' - 'seed_last_applied_at';

  -- check-migrations: allow-insert (a trigger body, not a seeded row — this is the audit trail)
  insert into content_revisions (entity_type, entity_id, revision_no, action, snapshot, created_by)
  values (v_entity_type, new.id, v_next, v_action, v_snapshot, new.updated_by);

  return new;
end;
$$;

revoke execute on function public.write_revision() from public, anon, authenticated;

comment on function public.write_revision() is
  'Appends an immutable snapshot per mutation. SECURITY DEFINER because content_revisions has no write policy for any session role — an invoker-rights trigger would insert zero rows and succeed.';

create trigger pages_write_revision            after insert or update on pages            for each row execute function write_revision('page');
create trigger page_sections_write_revision    after insert or update on page_sections    for each row execute function write_revision('page_section');
create trigger navigation_items_write_revision after insert or update on navigation_items for each row execute function write_revision('navigation_item');
create trigger global_content_write_revision   after insert or update on global_content   for each row execute function write_revision('global_content');
create trigger faqs_write_revision             after insert or update on faqs             for each row execute function write_revision('faq');

-- --------------------------------------------------------------------------------------------
-- sync_media_usages() — the Phase 07 slot_key contract, in the database
-- --------------------------------------------------------------------------------------------
--
-- `media_usages` is the reverse index: which slot, on which entity, uses which asset. Phase 06
-- built it; Phase 07 fixed what `slot_key` must contain — the `content/media-slots.ts` REGISTRY KEY
-- VERBATIM (`home.hero.video`), with repeating slots as `key[0]`, `key[1]`. `lib/media/gaps.ts`
-- joins on exactly that, and `slotKeyOf()` strips the index. Write anything else here and the
-- Studio Gaps tab reports every slot unbound, plausibly, with no error anywhere.
--
-- SECURITY DEFINER, for a sharper reason than write_revision's. `media_usages` is shape C with NO
-- DELETE POLICY FOR ANY SESSION ROLE, and a DELETE matching no policy affects zero rows and
-- SUCCEEDS. An invoker-rights trigger would therefore delete nothing on the way in and reinsert on
-- top, so every save would accumulate stale bindings until the unique constraint finally rejected
-- one — long after the wrong data was written.
--
-- THE COLUMN LIST ON THE TRIGGER IS LOAD-BEARING. Without `of media_desktop_id, ...` a status-only
-- publish tears down and rebuilds every usage row for the section, which churns the index, and —
-- because `media_assets.id` is `on delete restrict` from here — briefly drops the protection that
-- stops an asset being deleted while a live page uses it.
create or replace function public.sync_media_usages()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  delete from media_usages
   where context_type = 'PAGE_SECTION' and context_id = new.id;

  -- The desktop/mobile pair. Both take the section's own media_slot_key; the ROLE is what
  -- distinguishes them, which is legal because the unique key is
  -- (context_type, context_id, slot_key, role).
  if new.media_slot_key is not null then
    if new.media_desktop_id is not null then
      -- check-migrations: allow-insert (a trigger body maintaining a reverse index)
      insert into media_usages (media_id, context_type, context_id, slot_key, role, created_by)
      values (new.media_desktop_id, 'PAGE_SECTION', new.id, new.media_slot_key, 'DESKTOP', new.updated_by);
    end if;
    if new.media_mobile_id is not null then
      -- check-migrations: allow-insert (a trigger body maintaining a reverse index)
      insert into media_usages (media_id, context_type, context_id, slot_key, role, created_by)
      values (new.media_mobile_id, 'PAGE_SECTION', new.id, new.media_slot_key, 'MOBILE', new.updated_by);
    end if;
  end if;

  -- `payload->'media'` is a RESERVED KEY: a jsonb array of {slot, role, media_id}. Every block that
  -- carries repeating media writes it, so this one query covers galleries, card decks and process
  -- steps alike rather than needing a branch per block type.
  --
  -- The index comes from row_number() over the array's own ordinality, partitioned by (slot, role)
  -- — so a gallery of three yields gallery[0], gallery[1], gallery[2], and reordering the payload
  -- renumbers them in place rather than colliding. Delete-then-reinsert above is what makes a
  -- reorder safe: there is never a moment where the old and new numbering coexist.
  if jsonb_typeof(new.payload -> 'media') = 'array' then
    -- check-migrations: allow-insert (a trigger body maintaining a reverse index)
    insert into media_usages (media_id, context_type, context_id, slot_key, role, created_by)
    select
      (m.value ->> 'media_id')::uuid,
      'PAGE_SECTION',
      new.id,
      (m.value ->> 'slot') || '[' ||
        (row_number() over (partition by m.value ->> 'slot', m.value ->> 'role' order by m.ord) - 1)::text
        || ']',
      coalesce(m.value ->> 'role', 'GALLERY'),
      new.updated_by
    from jsonb_array_elements(new.payload -> 'media') with ordinality as m(value, ord)
    where m.value ->> 'media_id' is not null;
  end if;

  return new;
end;
$$;

revoke execute on function public.sync_media_usages() from public, anon, authenticated;

comment on function public.sync_media_usages() is
  'Maintains media_usages for a section. slot_key carries the content/media-slots.ts registry key verbatim; repeating slots take the key[n] form lib/media/gaps.ts slotKeyOf() strips.';

create trigger page_sections_sync_media_usages
  after insert or update of media_desktop_id, media_mobile_id, media_slot_key, payload
  on page_sections
  for each row execute function sync_media_usages();

-- --------------------------------------------------------------------------------------------
-- clear_media_usages_on_delete()
-- --------------------------------------------------------------------------------------------
--
-- `media_usages.context_id` is polymorphic — it points at a page section, a product or a category
-- depending on `context_type` — so no foreign key can cascade it. Without this trigger, deleting a
-- section strands its usage rows, and because `media_id` is `on delete restrict` those stranded
-- rows keep refusing to let an asset be deleted forever. Nobody finds that by looking; they find it
-- by wondering why an asset nothing uses cannot be removed.
create or replace function public.clear_media_usages_on_delete()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  delete from media_usages
   where context_type = 'PAGE_SECTION' and context_id = old.id;
  return old;
end;
$$;

revoke execute on function public.clear_media_usages_on_delete() from public, anon, authenticated;

create trigger page_sections_clear_media_usages
  after delete on page_sections
  for each row execute function clear_media_usages_on_delete();

-- ============================================================================================
-- The cms_* functions
-- ============================================================================================
--
-- ALL FOUR ARE SECURITY DEFINER WITH EXECUTE REVOKED FROM public, anon AND authenticated, GRANTED
-- TO service_role ALONE. That combination is not belt-and-braces; without it these functions are a
-- hole straight through every other control in the project.
--
-- PostgreSQL grants EXECUTE on a new function to PUBLIC by default, and PostgREST publishes every
-- function in the `public` schema as an RPC endpoint. So a `create function` with no `revoke` is
-- reachable by anyone holding the anon key — which is in the browser bundle by design. Combined
-- with SECURITY DEFINER (which these need, because they write `media_assets` and `activity_events`
-- across policies that no session role holds), that would let any visitor publish arbitrary
-- sections and cascade unreviewed concept media to anon-readable.
--
-- Granting to service_role alone is also what makes `p_actor` safe as a PARAMETER rather than a
-- forgery vector. Only server code holding the service key can call these, and authorisation has
-- already happened in lib/cms/publishing.ts by the time it does.
--
-- SQLSTATE RV0xx is a legal implementation-defined class: the standard reserves classes beginning
-- 0-4 and A-H, and R is neither. Each raise repeats `constraint=...` inside DETAIL because
-- PostgREST's JSON error body has no `constraint` field, and lib/supabase/repositories/support.ts
-- regexes over message + details to recover it.

-- --------------------------------------------------------------------------------------------
-- cms_publish_section — the transition and the media cascade, in one transaction
-- --------------------------------------------------------------------------------------------
--
-- WHY THIS IS A DATABASE FUNCTION AND NOT SERVICE CODE. Publishing a section must promote its bound
-- media in the SAME transaction as the status write, or a crash between the two leaves a published
-- page whose images the anon role cannot read — copy with holes, and no error anywhere. supabase-js
-- has no transaction API: every `.from().update()` is its own statement over PostgREST. A function
-- is the only place the two writes can be atomic.
--
-- REFUSALS HAPPEN BEFORE ANY WRITE, not because a rollback would be incorrect, but because the
-- error must name what is wrong. A rolled-back cascade reports the constraint that fired last,
-- which is rarely the thing an editor needs to fix.
create or replace function public.cms_publish_section(
  p_section_id uuid,
  p_to content_status,
  p_actor uuid,
  p_change_summary text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_section     page_sections;
  v_page        pages;
  v_from        content_status;
  v_blocking    text[];
  v_unverified  text[];
  v_promoted    text[] := array[]::text[];
  v_revision    int;
  v_asset       record;
begin
  -- FOR UPDATE, so two concurrent publishes of one section serialise rather than both reading
  -- APPROVED and both cascading.
  select * into v_section from page_sections where id = p_section_id for update;
  if not found then
    raise exception 'no page_section with id %', p_section_id
      using errcode = 'RV001', detail = 'constraint=cms_section_exists';
  end if;

  select * into v_page from pages where id = v_section.page_id;
  v_from := v_section.status;

  -- 1. Is the edge legal? Asked first so an impossible move never promotes anything.
  if not public.cms_transition_allowed(v_from, p_to) then
    raise exception 'illegal status transition % -> % on page_sections', v_from, p_to
      using errcode = 'RV001', detail = 'constraint=content_status_transition';
  end if;

  -- 2. The section's own owner-verification gate. The check constraint would also catch this, but
  --    it would report a constraint name; this names the flag an editor has to clear.
  if p_to = 'PUBLISHED'
     and v_section.owner_verification = 'OWNER_VERIFICATION_REQUIRED' then
    raise exception
      'section % asserts a business claim that has not been verified (owner_verification = OWNER_VERIFICATION_REQUIRED)',
      p_section_id
      using errcode = 'RV002', detail = 'constraint=content_owner_verification_gate';
  end if;

  -- 3. The bound media, if we are going live.
  if p_to = 'PUBLISHED' then
    -- Assets an editor has NOT approved. Refused rather than skipped: media that nobody reviewed
    -- must never reach the public site as a side effect of publishing copy.
    select array_agg(ma.rivya_asset_id order by ma.rivya_asset_id)
      into v_blocking
      from media_usages mu
      join media_assets ma on ma.id = mu.media_id
     where mu.context_type = 'PAGE_SECTION'
       and mu.context_id = p_section_id
       and ma.status in ('DRAFT', 'REVIEW', 'ARCHIVED');

    if v_blocking is not null then
      raise exception
        'cannot publish: % bound asset(s) are not approved: %',
        array_length(v_blocking, 1), array_to_string(v_blocking, ', ')
        using errcode = 'RV003', detail = 'constraint=cms_media_not_approved';
    end if;

    -- Assets that are APPROVED but still carry an unverified business claim. THIS CHECK EXISTS
    -- BECAUSE OF A COLLISION BETWEEN TWO PHASES: Phase 07 imports all 250 Higgsfield assets as
    -- APPROVED *and* OWNER_VERIFICATION_REQUIRED, while `media_assets_verified_before_publish`
    -- (Phase 03, 0005) forbids PUBLISHED while that flag stands. Without this pre-check the
    -- promotion below raises a bare 23514 naming a constraint, and the person reading it has no
    -- idea which asset or why. With it, they get the asset ids and can go and verify them.
    select array_agg(ma.rivya_asset_id order by ma.rivya_asset_id)
      into v_unverified
      from media_usages mu
      join media_assets ma on ma.id = mu.media_id
     where mu.context_type = 'PAGE_SECTION'
       and mu.context_id = p_section_id
       and ma.status = 'APPROVED'
       and ma.owner_verification = 'OWNER_VERIFICATION_REQUIRED';

    if v_unverified is not null then
      raise exception
        'cannot publish: % bound asset(s) still require owner verification: %',
        array_length(v_unverified, 1), array_to_string(v_unverified, ', ')
        using errcode = 'RV006', detail = 'constraint=cms_media_unverified';
    end if;

    -- Promote. Only APPROVED cascades; PUBLISHED is left alone, and everything else was refused
    -- above, so promotion is always downstream of a human approval in the Media Manager.
    -- DEDUPED WITH `in (subquery)`, NOT `group by` OR `distinct`. One asset is commonly bound
    -- twice — desktop and mobile of the same picture — and promoting it twice would write two
    -- `media.publish.cascade` rows for one event. Neither GROUP BY nor DISTINCT may be combined
    -- with FOR UPDATE ("FOR UPDATE is not allowed with GROUP BY clause"), and the lock is not
    -- optional here: two concurrent publishes sharing an asset must serialise.
    for v_asset in
      select ma.id, ma.rivya_asset_id
        from media_assets ma
       where ma.status = 'APPROVED'
         and ma.id in (
           select mu.media_id from media_usages mu
            where mu.context_type = 'PAGE_SECTION' and mu.context_id = p_section_id
         )
       order by ma.rivya_asset_id
       for update
    loop
      update media_assets
         set status = 'PUBLISHED', updated_by = p_actor, published_at = now(), published_by = p_actor
       where id = v_asset.id;

      -- check-migrations: allow-insert (a function body writing the activity feed, not a seeded row)
      insert into activity_events (actor_id, actor_role, action, entity_type, entity_id, entity_label, summary, metadata)
      values (p_actor, public.current_staff_role(), 'media.publish.cascade', 'media_asset', v_asset.id,
              v_asset.rivya_asset_id,
              'Promoted to PUBLISHED because a section binding it was published',
              jsonb_build_object('section_id', p_section_id, 'page_id', v_section.page_id));

      v_promoted := v_promoted || v_asset.rivya_asset_id;
    end loop;
  end if;

  -- 4. The status write. `enforce_status_transition` fires here and re-checks legality and
  --    permission from inside — this function does not exempt anyone from the state machine, it
  --    only makes the refusals readable and the cascade atomic.
  update page_sections
     set status = p_to,
         updated_by = p_actor,
         published_at = case when p_to = 'PUBLISHED' then now() else published_at end,
         published_by = case when p_to = 'PUBLISHED' then p_actor else published_by end,
         schedule_state = 'PENDING',
         schedule_attempts = 0,
         schedule_error = null
   where id = p_section_id;

  -- 5. The revision. NOT written here — `write_revision` already fired on the update above, inside
  --    this same transaction. Inserting one here would make verification step 6 count two per
  --    mutation, and an audit trail that double-counts is worse than one that under-counts.
  select max(revision_no) into v_revision
    from content_revisions
   where entity_type = 'page_section' and entity_id = p_section_id;

  -- check-migrations: allow-insert (a function body writing the activity feed, not a seeded row)
  insert into activity_events (actor_id, actor_role, action, entity_type, entity_id, entity_label, summary, metadata)
  values (p_actor, public.current_staff_role(),
          case when p_to = 'PUBLISHED' then 'content.section-published'
               when v_from = 'PUBLISHED' then 'content.section-unpublished'
               else 'content.section-status-changed' end,
          'page_section', p_section_id, v_section.block_type,
          coalesce(p_change_summary, format('%s -> %s', v_from, p_to)),
          jsonb_build_object('from', v_from, 'to', p_to, 'promoted', to_jsonb(v_promoted)));

  return jsonb_build_object(
    'section_id', p_section_id,
    'from', v_from,
    'to', p_to,
    'revision_no', v_revision,
    'promoted', to_jsonb(v_promoted),
    -- The paths the caller must revalidate. Null for a SYSTEM page, which has none.
    'paths', case when v_page.path is null then '[]'::jsonb else to_jsonb(array[v_page.path]) end
  );
end;
$$;

revoke execute on function public.cms_publish_section(uuid, content_status, uuid, text) from public, anon, authenticated;
grant execute on function public.cms_publish_section(uuid, content_status, uuid, text) to service_role;

comment on function public.cms_publish_section(uuid, content_status, uuid, text) is
  'Transition + bound-media cascade in one transaction. Refuses before writing on an illegal edge, an unverified section, unapproved media (RV003) or unverified media (RV006).';

-- --------------------------------------------------------------------------------------------
-- cms_unpublish_media_asset — the other half of the asymmetry
-- --------------------------------------------------------------------------------------------
--
-- Unpublishing a SECTION demotes nothing, because an asset may be bound to several sections and
-- pulling it from under the others would break pages nobody touched. The only way an asset leaves
-- PUBLISHED is this explicit act, and it is refused while any published section still shows it.
--
-- The phase document calls this "the same guard shape as the Phase 06 delete trigger". It is not,
-- and the difference is worth stating: 0030 made that guard a FOREIGN KEY (`on delete restrict`)
-- precisely because a foreign key cannot be forgotten. This one cannot be a foreign key — it is a
-- condition on a STATUS, not on a row's existence — so it is a function, and the function is the
-- only path the Media Manager offers.
create or replace function public.cms_unpublish_media_asset(p_media_id uuid, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_asset media_assets;
  v_blockers text[];
begin
  select * into v_asset from media_assets where id = p_media_id for update;
  if not found then
    raise exception 'no media_asset with id %', p_media_id
      using errcode = 'RV001', detail = 'constraint=cms_asset_exists';
  end if;

  -- The schedule window is deliberately NOT considered. A section that is PUBLISHED but outside its
  -- window will come back into it; demoting the asset now would break that page in the future,
  -- silently, at a moment nobody is watching.
  select array_agg(distinct p.slug order by p.slug)
    into v_blockers
    from media_usages mu
    join page_sections ps on ps.id = mu.context_id
    join pages p on p.id = ps.page_id
   where mu.context_type = 'PAGE_SECTION'
     and mu.media_id = p_media_id
     and ps.status = 'PUBLISHED';

  if v_blockers is not null then
    raise exception
      'cannot unpublish %: still used by % published section(s) on: %',
      v_asset.rivya_asset_id, array_length(v_blockers, 1), array_to_string(v_blockers, ', ')
      using errcode = 'RV004', detail = 'constraint=cms_media_in_use';
  end if;

  update media_assets
     set status = 'APPROVED', updated_by = p_actor
   where id = p_media_id;

  -- check-migrations: allow-insert (a function body writing the activity feed, not a seeded row)
  insert into activity_events (actor_id, actor_role, action, entity_type, entity_id, entity_label, summary, metadata)
  values (p_actor, public.current_staff_role(), 'media.unpublish', 'media_asset', p_media_id,
          v_asset.rivya_asset_id, 'Demoted to APPROVED', '{}'::jsonb);

  return jsonb_build_object('media_id', p_media_id, 'status', 'APPROVED');
end;
$$;

revoke execute on function public.cms_unpublish_media_asset(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cms_unpublish_media_asset(uuid, uuid) to service_role;

-- --------------------------------------------------------------------------------------------
-- cms_reorder_sections — one statement, which is why the constraint is deferrable
-- --------------------------------------------------------------------------------------------
--
-- PostgREST cannot give the repository layer a transaction, so a reorder expressed as N updates
-- would leave the page in a half-reordered state if any one of them failed. Here it is one UPDATE
-- against `page_sections_unique_position`, which 0050 declared DEFERRABLE INITIALLY DEFERRED so the
-- transiently duplicated positions are only checked at commit.
create or replace function public.cms_reorder_sections(p_page_id uuid, p_ids uuid[], p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_count int;
  v_total int;
begin
  select count(*) into v_total from page_sections where page_id = p_page_id;
  select count(*) into v_count
    from page_sections where page_id = p_page_id and id = any(p_ids);

  -- Every id must belong to this page, and the list must name ALL of them. A partial list would
  -- silently leave the unnamed sections at positions that now collide with the new ordering.
  if v_count <> array_length(p_ids, 1) or v_count <> v_total then
    raise exception
      'reorder must name every section on the page exactly once (% named, % matched, % on the page)',
      array_length(p_ids, 1), v_count, v_total
      using errcode = 'RV005', detail = 'constraint=cms_reorder_complete';
  end if;

  update page_sections ps
     set position = ordered.new_position, updated_by = p_actor
    from (select unnest(p_ids) as id, generate_series(0, array_length(p_ids, 1) - 1) as new_position) ordered
   where ps.id = ordered.id and ps.page_id = p_page_id;

  return jsonb_build_object('page_id', p_page_id, 'count', v_total);
end;
$$;

revoke execute on function public.cms_reorder_sections(uuid, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.cms_reorder_sections(uuid, uuid[], uuid) to service_role;

-- --------------------------------------------------------------------------------------------
-- cms_restore_revision
-- --------------------------------------------------------------------------------------------
--
-- Restoring is an ordinary UPDATE with two twists that are easy to get wrong and invisible when
-- you do.
--
-- 1. IT WRITES THE MEDIA COLUMNS ALWAYS, EVEN WHEN THE SNAPSHOT MATCHES THE CURRENT ROW.
--    `sync_media_usages` fires `after update OF media_desktop_id, media_mobile_id, media_slot_key,
--    payload` — a column list, which is what stops a status-only publish from rebuilding every
--    usage row. The cost is that an UPDATE which does not name those columns does not re-sync, so
--    a restore that skipped them would leave `media_usages` describing the row as it was BEFORE
--    the restore. That is the phase document's own "restoring a revision loses the media binding"
--    risk arriving through its mitigation. Naming them unconditionally is what closes it.
--
-- 2. IT NEVER TOUCHES `status`, THE SCHEDULE COLUMNS, OR published_at/published_by. A revision
--    records what the CONTENT was, not whether it was live. Restoring copy from last Tuesday must
--    not also un-publish the page, and restoring onto a published page must not silently republish
--    an older status. Where the revision's own status differs, the current one wins.
--
-- The GUC is the same idiom `guard_stage_transition` uses, and it is what makes `write_revision`
-- label this write RESTORE rather than UPDATE — so the history shows what happened rather than
-- just that something did.
create or replace function public.cms_restore_revision(
  p_entity_type text,
  p_entity_id uuid,
  p_revision_no int,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_snapshot jsonb;
  v_missing  text[];
  v_new_no   int;
begin
  select snapshot into v_snapshot
    from content_revisions
   where entity_type = p_entity_type and entity_id = p_entity_id and revision_no = p_revision_no;

  if v_snapshot is null then
    raise exception 'no revision % for % %', p_revision_no, p_entity_type, p_entity_id
      using errcode = 'RV001', detail = 'constraint=cms_revision_exists';
  end if;

  if p_entity_type <> 'page_section' then
    raise exception 'restore is only implemented for page_section, not %', p_entity_type
      using errcode = 'RV001', detail = 'constraint=cms_restore_supported';
  end if;

  -- An asset named by the snapshot may have been deleted since. Restoring would fail on the
  -- foreign key with a message naming a constraint and a uuid; this names the field instead.
  select array_agg(k)
    into v_missing
    from (
      select k from unnest(array['media_desktop_id', 'media_mobile_id']) as k
       where v_snapshot ->> k is not null
         and not exists (select 1 from media_assets where id = (v_snapshot ->> k)::uuid)
    ) missing;

  if v_missing is not null then
    raise exception
      'cannot restore revision %: it names media that no longer exists (%)',
      p_revision_no, array_to_string(v_missing, ', ')
      using errcode = 'RV007', detail = 'constraint=cms_restore_media_missing';
  end if;

  perform set_config('rivya.revision_action', 'RESTORE', true);

  update page_sections
     set block_type        = coalesce(v_snapshot ->> 'block_type', block_type),
         is_visible        = coalesce((v_snapshot ->> 'is_visible')::boolean, is_visible),
         theme             = v_snapshot ->> 'theme',
         layout_variant    = v_snapshot ->> 'layout_variant',
         eyebrow           = v_snapshot ->> 'eyebrow',
         heading           = v_snapshot ->> 'heading',
         heading_highlight = v_snapshot ->> 'heading_highlight',
         body              = v_snapshot ->> 'body',
         supporting        = v_snapshot ->> 'supporting',
         cta_label         = v_snapshot ->> 'cta_label',
         cta_url           = v_snapshot ->> 'cta_url',
         cta_secondary_label = v_snapshot ->> 'cta_secondary_label',
         cta_secondary_url   = v_snapshot ->> 'cta_secondary_url',
         media_alt_override  = v_snapshot ->> 'media_alt_override',
         -- Always named, even when unchanged. See note 1 above.
         media_desktop_id  = (v_snapshot ->> 'media_desktop_id')::uuid,
         media_mobile_id   = (v_snapshot ->> 'media_mobile_id')::uuid,
         media_slot_key    = v_snapshot ->> 'media_slot_key',
         payload           = coalesce(v_snapshot -> 'payload', '{}'::jsonb),
         fact_classification = coalesce(
           (v_snapshot ->> 'fact_classification')::fact_classification, fact_classification),
         field_classifications = coalesce(v_snapshot -> 'field_classifications', '{}'::jsonb),
         updated_by        = p_actor
   where id = p_entity_id;

  if not found then
    raise exception 'no page_section with id %', p_entity_id
      using errcode = 'RV001', detail = 'constraint=cms_section_exists';
  end if;

  -- Reset the GUC so a later write in the same transaction is labelled honestly.
  perform set_config('rivya.revision_action', '', true);

  select max(revision_no) into v_new_no
    from content_revisions where entity_type = 'page_section' and entity_id = p_entity_id;

  return jsonb_build_object(
    'entity_id', p_entity_id,
    'restored_from', p_revision_no,
    'revision_no', v_new_no
  );
end;
$$;

revoke execute on function public.cms_restore_revision(text, uuid, int, uuid) from public, anon, authenticated;
grant execute on function public.cms_restore_revision(text, uuid, int, uuid) to service_role;

comment on function public.cms_restore_revision(text, uuid, int, uuid) is
  'Restores a page_section snapshot. Always writes the media columns so sync_media_usages re-fires; never touches status, schedule or published_at.';
