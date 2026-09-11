-- ============================================================================================
-- 0370 — Phase 39: SEO — keyword themes, redirects, and four columns on seo_entries
--
-- THREE THINGS, EACH WITH ONE RULE IT EXISTS TO ENFORCE.
--
-- `seo_keyword_themes` records the SEED §42 themes as RESEARCH TARGETS. There is deliberately no
-- numeric column on it: no volume, no difficulty, no CPC, no rank, no opportunity score. §42 says
-- the strategy "must be refined through research before claiming ranking opportunity", and the
-- honest way to make that binding is to leave nowhere to store a guess. `research_status` is the
-- whole record of progress; `evidence_url` is where the owner points at whatever tool they used.
--
-- `seo_redirects` is what keeps a slug change from producing a dead link. It is consulted ONLY on
-- the path that would otherwise 404 (`lib/seo/redirects.ts`), so the happy path pays nothing and
-- the table needs no proxy. `unique (from_path)` and `from_path <> to_path` are the two rules the
-- database can state; loop and chain detection is a write-time judgement over the whole table and
-- lives in `lib/seo/redirect-rules.ts`, checked by the Server Action before every insert.
--
-- `seo_entries` gains four columns. `noindex` / `nofollow` replace the free-text `robots` string
-- as the editable directive (the string stays for the rows that already carry it and for the
-- legacy reading in `lib/seo/metadata.ts`); `structured_data_type` names the one JSON-LD type a
-- page may emit, from the Phase 39 allowlist; `derived` marks a row the Studio generated from the
-- page's own content, so an owner's words and a default can be told apart on every screen.
--
-- NO POLICY HERE. 0371 is generated from lib/auth/table-permissions.ts and holds every policy on
-- the two new tables; the seo_entries policies stay in 0051 (a generated file is never re-opened).
-- ============================================================================================

set search_path = public, extensions;

-- --------------------------------------------------------------------------------------------
-- seo_entries — four columns
-- --------------------------------------------------------------------------------------------

alter table seo_entries
  add column structured_data_type text,
  add column noindex              boolean not null default false,
  add column nofollow             boolean not null default false,
  add column derived              boolean not null default false;

-- The Phase 39 allowlist, and nothing outside it. A type that is not in this list cannot be
-- named on a row, so no editor can ask a page to emit `LocalBusiness` by typing it.
alter table seo_entries add constraint seo_entries_structured_data_type_allowed check (
  structured_data_type is null or structured_data_type in (
    'Organization', 'WebSite', 'BreadcrumbList', 'Product', 'CollectionPage', 'Article',
    'FAQPage', 'ContactPoint'
  )
);

-- --------------------------------------------------------------------------------------------
-- seo_keyword_themes
-- --------------------------------------------------------------------------------------------

create table seo_keyword_themes (
  id                   uuid primary key default gen_random_uuid(),
  theme                text not null,
  -- The theme as the unique key: case- and whitespace-insensitive, so "River Table" and
  -- "river table" are one theme. Generated, so it cannot disagree with `theme`.
  normalized_theme     citext not null generated always as (lower(btrim(theme))) stored,
  mapped_path          text,
  research_status      text not null default 'UNRESEARCHED',
  notes                text,
  evidence_url         text,
  researched_by        uuid references auth.users (id) on delete set null,
  researched_at        timestamptz,

  -- D5 common set: Tier A, B and C. A theme is seeded (§42), can be edited by the owner, and
  -- two of them carry a verification because they assert a service geography.
  status               content_status not null default 'DRAFT',
  owner_verification   owner_verification not null default 'NOT_REQUIRED',
  fact_classification  fact_classification not null default 'SEO_COPY',
  seed_key             text,
  content_seed_version text,
  seed_content_hash    text,
  seed_last_applied_at timestamptz,
  owner_edited         boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  updated_by           uuid references auth.users (id),
  published_at         timestamptz,
  published_by         uuid references auth.users (id),

  constraint seo_keyword_themes_theme_not_blank check (btrim(theme) <> ''),
  constraint seo_keyword_themes_normalized_unique unique (normalized_theme),
  constraint seo_keyword_themes_status_allowed check (
    research_status in ('UNRESEARCHED', 'RESEARCHED', 'TARGETED', 'REJECTED')
  ),
  -- The same path shape seo_entries enforces: a site-relative, lowercase path.
  constraint seo_keyword_themes_path_shape check (
    mapped_path is null or mapped_path ~ '^/[a-z0-9/-]*$'
  ),
  constraint seo_keyword_themes_evidence_shape check (
    evidence_url is null or evidence_url ~ '^https?://'
  ),
  -- A status past UNRESEARCHED records who reached it and when; UNRESEARCHED records nobody.
  constraint seo_keyword_themes_researched_coherent check (
    (research_status = 'UNRESEARCHED') = (researched_at is null)
  ),
  constraint seo_keyword_themes_verified_before_publish check (
    status <> 'PUBLISHED' or owner_verification <> 'OWNER_VERIFICATION_REQUIRED'
  )
);

create index seo_keyword_themes_mapped_path_idx on seo_keyword_themes (mapped_path);
create index seo_keyword_themes_research_status_idx on seo_keyword_themes (research_status);
create index seo_keyword_themes_seed_key_idx on seo_keyword_themes (seed_key);

alter table seo_keyword_themes enable row level security;

-- The Phase 08 transition and verification triggers, because a theme is a content row with a
-- status and a verification like any other: an editor cannot mark one VERIFIED, and the seed
-- writes straight to its seeded state as the service role.
create trigger seo_keyword_themes_enforce_status_transition
  before insert or update on seo_keyword_themes
  for each row execute function public.enforce_status_transition();

create trigger seo_keyword_themes_enforce_verification_authority
  before insert or update on seo_keyword_themes
  for each row execute function public.enforce_verification_authority();

-- --------------------------------------------------------------------------------------------
-- seo_redirects
-- --------------------------------------------------------------------------------------------

create table seo_redirects (
  id                   uuid primary key default gen_random_uuid(),
  from_path            text not null,
  to_path              text not null,
  status_code          integer not null default 308,
  reason               text,
  hit_count            integer not null default 0,
  last_hit_at          timestamptz,
  created_by           uuid references auth.users (id) on delete set null,

  -- Tier A and B. `status` is what the anon leg keys on: only a PUBLISHED redirect is followed.
  -- A redirect is operational rather than editorial, so it is created PUBLISHED by the Studio
  -- action and paused by moving it to DRAFT; the D10 gate applies all the same.
  status               content_status not null default 'PUBLISHED',
  owner_verification   owner_verification not null default 'NOT_REQUIRED',
  fact_classification  fact_classification not null default 'SEO_COPY',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  updated_by           uuid references auth.users (id),
  published_at         timestamptz,
  published_by         uuid references auth.users (id),

  constraint seo_redirects_from_unique unique (from_path),
  constraint seo_redirects_not_self check (from_path <> to_path),
  constraint seo_redirects_status_code_allowed check (status_code in (301, 308)),
  constraint seo_redirects_from_shape check (from_path ~ '^/[a-z0-9/-]*$'),
  constraint seo_redirects_to_shape check (to_path ~ '^/[a-z0-9/-]*$'),
  constraint seo_redirects_hit_count_nonnegative check (hit_count >= 0),
  constraint seo_redirects_verified_before_publish check (
    status <> 'PUBLISHED' or owner_verification <> 'OWNER_VERIFICATION_REQUIRED'
  )
);

-- The 404 path looks a redirect up by its source; the Studio lists by target to warn of chains.
create index seo_redirects_to_path_idx on seo_redirects (to_path);
create index seo_redirects_published_idx on seo_redirects (from_path) where status = 'PUBLISHED';

alter table seo_redirects enable row level security;
