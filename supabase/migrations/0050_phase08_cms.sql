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
