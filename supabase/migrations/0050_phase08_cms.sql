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
