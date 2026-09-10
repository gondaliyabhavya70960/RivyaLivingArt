-- ============================================================================================
-- 0240 — Phase 26: a source becomes a Studio task rather than an engineering task
--
-- FEAT §26 NAMES TWENTY-THREE FIELDS AND THIS MIGRATION IS WHERE TWENTY-ONE OF THEM LIVE. The
-- other two — Last Run and Health — are not stored at all; they are columns of a VIEW, for the
-- reason stated below.
--
-- THE RULE THIS FILE EXISTS TO KEEP: every behavioural difference between two sources is a COLUMN
-- OR A CHILD ROW, never a branch in `lib/scraper/core/**`. FEAT §26's whole point is that adding a
-- competitor does not mean editing the engine. A `if (source.slug === 'x')` anywhere under
-- lib/scraper is the failure this schema is shaped to make unnecessary — which is why the URL
-- patterns, the category mapping and the schedules are three child TABLES with their own
-- constraints and their own audit trail rather than three keys in a jsonb blob nobody can review.
--
-- ONLY THREE THINGS STAY jsonb, AND EACH HAS A ZOD SCHEMA AND A RENDERED FORM: `price_extraction`,
-- `sku_extraction`, `attribute_extraction`. They are selector configuration whose shape belongs to
-- the Phase 27 adapter that reads it, and a table per adapter-specific option list would be a
-- schema migration every time an adapter learns a new selector.
--
-- THE FIRST OF EXACTLY TWO RESEARCH → PUBLIC FOREIGN KEYS IS CREATED HERE, deliberately and by
-- name: `research_source_category_map_category_fk`. See the long note above that table. The second
-- and last arrives in Phase 28. `scripts/research/check-research-isolation.mjs` allowlists them
-- individually, so a third — the one nobody argued about — fails the build.
--
-- THE ENUMS ARE IN THIS FILE RATHER THAN IN ONE OF THEIR OWN, WHICH DEPARTS FROM 0230. That split
-- exists because PostgreSQL refuses to USE an enum value in the same transaction that ADDS it with
-- `alter type ... add value`; it says nothing about `create type`, and a type created and used in
-- one file applies cleanly. 0230 split four types away from eight tables and was right to, because
-- those types were the phase's vocabulary. These four are four columns' worth of allowlist on one
-- table that this same file alters, and a second file to hold them would be a file whose only
-- content is four lines nobody will ever read on their own.
-- ============================================================================================

set search_path = public, extensions;

-- --- 1. Four allowlists, as types ----------------------------------------------------------------

-- FEAT §26 field 5. What KIND of business publishes this catalogue, which is the first thing that
-- decides whether a price on it is comparable to Rivya's at all.
create type research_source_type as enum (
  'BRAND', 'RETAILER', 'MARKETPLACE', 'GALLERY', 'ARTISAN', 'DIRECTORY'
);

-- FEAT §26 field 6. STAFF-ONLY FOREVER, and the comment says so at the type because this is the
-- column most likely to be mistaken for something publishable. It is Rivya's private view of where
-- another business sits relative to it, and there is no surface on which it may ever be rendered
-- to a visitor.
create type research_analytics_league as enum ('PEER', 'ASPIRATIONAL', 'ADJACENT', 'MASS');

comment on type research_analytics_league is
  'Rivya''s private grouping of a comparator, used by Phase 31 analytics. Never a public label, never rendered outside Studio, never exported to a visitor-facing surface.';

-- FEAT §26 field 8. Which discovery strategy the run uses.
--
-- `SEED_URLS` IS THE DEFAULT AND IT IS THE ONLY ONE PHASE 25's ENGINE IMPLEMENTS. The other three
-- are named here because the column is an allowlist and an allowlist with the future values missing
-- is one that has to be altered later; `lib/scraper/workflows/discover.ts` gains them as it learns
-- them. A source configured to a mode the engine cannot run yet queues nothing and says so, which
-- is the same honest failure a job with no seed URLs already produces.
create type research_collection_mode as enum ('SITEMAP', 'CATEGORY_CRAWL', 'SEED_URLS', 'FEED');

-- FEAT §26 field 12, and the name of the type is doing work. NOT ONE OF THESE THREE VALUES
-- DOWNLOADS AN IMAGE. The most permissive, `URL_AND_DIMENSIONS`, stores a URL string and two
-- integers the page itself declared. Competitor imagery is never re-hosted, never uploaded to
-- Cloudinary, never written to `media_assets` and never served from a Rivya origin.
create type research_image_extraction_mode as enum ('NONE', 'URL_ONLY', 'URL_AND_DIMENSIONS');

comment on type research_image_extraction_mode is
  'How much of an image reference is kept. NONE stores nothing; URL_ONLY stores the string; URL_AND_DIMENSIONS additionally stores width and height as the page declared them. No value downloads, caches, re-hosts or transforms a competitor image — that is not a mode this system has.';

-- --- 2. The source, completed ---------------------------------------------------------------------

-- `source_type` WAS TEXT AND BECOMES AN ENUM. Phase 25 left it text because the vocabulary was
-- FEAT §26's to fix and this is that phase. There are no rows anywhere — this repository ships
-- zero sources and seeds none — so the conversion cannot lose data; the `using` clause is written
-- out anyway, because a migration that would corrupt a populated table if it ever met one is a
-- migration that eventually does.
alter table research_sources
  alter column source_type type research_source_type
  using (nullif(btrim(source_type), '')::research_source_type);

alter table research_sources
  -- FEAT §26 field 6. Nullable, and no default, BECAUSE A LEAGUE IS A JUDGEMENT. Defaulting every
  -- new source to `ADJACENT` would put a classification nobody made on every row, and Phase 31
  -- would then group by it. The Zod schema requires one when a source is saved through Studio; a
  -- row that has never been through that form honestly reports that nobody has classified it.
  add column analytics_league research_analytics_league,

  -- FEAT §26 field 8.
  add column collection_mode research_collection_mode not null default 'SEED_URLS',

  -- FEAT §26 field 12. THE DEFAULT IS THE MOST CONSERVATIVE VALUE, which is the rule every
  -- politeness default in this subsystem follows: a source nobody has configured does the least.
  add column image_extraction_mode research_image_extraction_mode not null default 'NONE',

  -- FEAT §26 fields 13, 14, 15. Shape validated by Zod in lib/scraper/core/source-schema.ts; the
  -- database asserts only that each is the right kind of JSON, because a CHECK deep enough to
  -- describe a selector list would be a second schema that drifts from the first.
  add column price_extraction     jsonb not null default '{}'::jsonb,
  add column sku_extraction       jsonb not null default '{}'::jsonb,
  add column attribute_extraction jsonb not null default '[]'::jsonb,

  -- FEAT §26 field 23. Staff-only, and there is no surface outside Studio that reads it.
  add column notes text,

  -- WHERE THE SOURCE IS IN ITS PREPARATION, WHICH IS NOT THE SAME QUESTION AS `policy_status`.
  -- A researcher prepares a source and marks it READY_FOR_REVIEW; an owner then reviews it and
  -- sets `policy_status`. Folding the two into one column would mean a researcher could move a
  -- source towards approval by editing the column that records approval.
  add column readiness text not null default 'DRAFT';

alter table research_sources
  add constraint research_sources_readiness_allowlist
    check (readiness in ('DRAFT', 'READY_FOR_REVIEW', 'REVIEWED')),
  add constraint research_sources_price_extraction_is_object
    check (jsonb_typeof(price_extraction) = 'object'),
  add constraint research_sources_sku_extraction_is_object
    check (jsonb_typeof(sku_extraction) = 'object'),
  -- AN ORDERED LIST, so an array rather than an object: `attribute_extraction` is read in order and
  -- the first rule that produces a value wins, which an object cannot express.
  add constraint research_sources_attribute_extraction_is_array
    check (jsonb_typeof(attribute_extraction) = 'array');

comment on column research_sources.readiness is
  'The researcher''s side of the policy workflow: DRAFT while it is being configured, READY_FOR_REVIEW when it is handed to an owner, REVIEWED once an owner has decided. Deliberately separate from policy_status, which only an owner or admin may write — one column may not be both the request and the answer.';
comment on column research_sources.collection_mode is
  'Which discovery strategy a run uses. SEED_URLS is the only mode lib/scraper/workflows implements today; the other three are in the allowlist so that adding them is code rather than a migration.';
comment on column research_sources.attribute_extraction is
  'An ORDERED array of { key, selector, kind } rules, read first-match-wins by the Phase 27 adapter. Shape enforced by Zod in lib/scraper/core/source-schema.ts; the database checks only that it is an array.';

-- --- 3. Three politeness ceilings, tightened to FEAT §26's numbers ---------------------------------
--
-- PHASE 25 SET THESE WIDER BECAUSE IT HAD NO FIELD TABLE TO SET THEM FROM. FEAT §26 fields 16–18
-- give the numbers: at most sixty requests a minute, at least a second between two of them, at most
-- four at a time. Tightening a bound on a table with zero rows costs nothing and makes the Studio
-- form and the database agree about what is refusable, which is the property that matters — a form
-- stricter than its table is a form somebody bypasses with a server action.
alter table research_sources drop constraint research_sources_rate_limit_sane;
alter table research_sources add constraint research_sources_rate_limit_sane
  check (rate_limit_rpm between 1 and 60);

alter table research_sources drop constraint research_sources_delay_sane;
alter table research_sources add constraint research_sources_delay_sane
  check (request_delay_ms between 1000 and 600000);

-- FEAT §26 field 2 says https, and it means it for every source that is a real website: a
-- competitor's catalogue is read over TLS or it is not read.
--
-- THE LOOPBACK EXCEPTION IS NAMED RATHER THAN IMPLIED, and it exists for one reason. The claims
-- that matter most in this subsystem are claims about requests that must NOT happen — a
-- `Disallow`ed path never requested, a kill switch that produces zero traffic, a delay that was
-- actually waited. The only way to check those is a real HTTP server this repository starts and
-- reads the request log of, and such a server cannot present a certificate. Forcing https here
-- would not make the system safer; it would delete the tests that prove it is.
--
-- The constraint keeps its Phase 25 name so that the error a caller sees still names the column.
alter table research_sources drop constraint research_sources_base_url_is_http;
alter table research_sources add constraint research_sources_base_url_is_http
  check (
    base_url ~ '^https://'
    or base_url ~ '^http://(127\.0\.0\.1|localhost|\[::1\])(:[0-9]+)?(/|$)'
  );

comment on constraint research_sources_base_url_is_http on research_sources is
  'https for every real source (FEAT §26 field 2). http is admitted for loopback only, because the tests that prove a request was NOT made need a fixture server this repository controls, and such a server has no certificate.';

-- --- 4. What a URL of this source looks like ------------------------------------------------------

create table research_source_url_patterns (
  id         uuid primary key default gen_random_uuid(),
  source_id  uuid not null references research_sources (id) on delete cascade,

  -- PRODUCT, CATEGORY, EXCLUDE, PAGINATION. Written as a CHECK rather than an enum: this is a
  -- child table's local vocabulary, not the subsystem's, and an enum would put four values in the
  -- global type namespace to be used in exactly one column.
  kind       text not null,
  pattern    text not null,

  -- GLOB IS THE DEFAULT AND REGEX IS OPT-IN. A glob cannot backtrack catastrophically; a regex
  -- can, against a URL a third party chose. `lib/scraper/core/url-patterns.ts` compiles every
  -- regex on save, caps it at 200 characters and matches under a per-URL budget, and the default
  -- being `false` is what keeps the dangerous case rare and deliberate.
  is_regex   boolean not null default false,

  -- Higher runs first. EXCLUDE beats everything regardless, which is a rule in the matcher rather
  -- than in this column: a priority number that could be set to let a PRODUCT rule beat an EXCLUDE
  -- would be a way to configure a refusal away.
  priority   int not null default 0,
  notes      text,

  status     content_status not null default 'DRAFT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),

  constraint research_source_url_patterns_kind_allowlist
    check (kind in ('PRODUCT', 'CATEGORY', 'EXCLUDE', 'PAGINATION')),
  -- TWO HUNDRED CHARACTERS, AT THE ROW. The matcher enforces it too, and both are meant: a
  -- pathological regex is a denial of service against Rivya's own cron function, and a length cap
  -- is the one bound that holds whatever the expression says.
  constraint research_source_url_patterns_length_capped
    check (char_length(pattern) between 1 and 200),
  constraint research_source_url_patterns_priority_sane
    check (priority between 0 and 1000),
  constraint research_source_url_patterns_unique
    unique (source_id, kind, pattern)
);

comment on table research_source_url_patterns is
  'What a product URL, a category URL, a paginated URL and a URL never to be fetched look like at one source. A child table rather than a jsonb array because each row carries a constraint, an audit trail and a reason — and because a reviewer can read a table.';

create index research_source_url_patterns_by_source_idx
  on research_source_url_patterns (source_id, priority desc);

-- --- 5. Their categories, mapped to Rivya's seven --------------------------------------------------
--
-- THE FIRST OF EXACTLY TWO FOREIGN KEYS FROM A `research_*` TABLE TO A PUBLIC ONE, AND THE ONLY
-- ONE ADDED IN THIS PHASE.
--
-- D5 says scraped data never joins directly to public product tables. This column is not scraped
-- data: it is a POINTER A MEMBER OF STAFF TYPED, from a label somebody else's website used to one
-- of Rivya's seven categories. It points at taxonomy, not at `products`, and it is `on delete set
-- null`, so deleting a Rivya category unmaps every source label that referenced it rather than
-- deleting a research row or blocking the delete.
--
-- The exception is recorded as amendment **A26** in docs/architecture/CANONICAL-DECISIONS.md, in
-- D5's own terms: a scraped VALUE never joins to a public table; a staff-authored taxonomy pointer
-- with `on delete set null` may. The constraint is NAMED so the isolation guard can allowlist it
-- individually and fail on any other crossing — including a second one added to this very table.
create table research_source_category_map (
  id           uuid primary key default gen_random_uuid(),
  source_id    uuid not null references research_sources (id) on delete cascade,

  -- What the other site calls it. Stored exactly as observed, because it is evidence.
  source_label text not null,
  -- The path it was observed at, when there was one. Two labels called "Tables" under different
  -- parents are two mappings, and the path is how a person tells them apart.
  source_path  text,

  category_id  uuid,

  -- IGNORE IS A DECISION AND IS RECORDED AS ONE. A source category that maps to nothing Rivya
  -- sells is not an unmapped category to be chased on the dashboard; it is a category somebody
  -- looked at and dismissed.
  is_ignored   boolean not null default false,

  /*
   * THE THREE STATES A MAPPING ROW CAN BE IN, DERIVED RATHER THAN ASSERTED.
   *
   * The obvious constraint here — `check (category_id is not null or is_ignored)`, so that "we
   * have not decided yet" is the ABSENCE of a row rather than a row meaning nothing — was written
   * first and is wrong, and the way it is wrong is worth recording because it looks right.
   *
   * `category_id` is `on delete set null`. Deleting a Rivya category therefore rewrites every
   * mapping that pointed at it — and under that CHECK the rewrite is refused, so the constraint
   * turns `on delete set null` back into `on delete restrict` and a merchandiser cannot remove a
   * category because a researcher once mapped a label to it. A test wrote the delete and found it.
   *
   * The honest reading is that there is a THIRD state and it is not a mistake: a row whose category
   * has been removed records a label somebody genuinely observed and a decision that no longer has
   * anything to point at. Deleting the row would throw away the observation; forbidding the state
   * would forbid the category delete. So the state is named, stored and counted — UNRESOLVED
   * appears in the dashboard's unmapped figure exactly as a never-mapped label does, which is where
   * somebody will see it and decide again.
   *
   * The Zod schema still refuses to CREATE one, because a person filling in this form has both
   * options in front of them. The database refuses only what is never true: a row cannot be both
   * mapped and dismissed.
   */
  mapping_state text not null generated always as (
    case
      when is_ignored then 'IGNORED'
      when category_id is not null then 'MAPPED'
      else 'UNRESOLVED'
    end
  ) stored,

  status       content_status not null default 'DRAFT',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users (id),

  constraint research_source_category_map_category_fk
    foreign key (category_id) references categories (id) on delete set null,
  -- The one thing that is never true: a row saying both "this is our furniture" and "this is not
  -- something Rivya sells".
  constraint research_source_category_map_not_both
    check (not (is_ignored and category_id is not null)),
  constraint research_source_category_map_unique
    unique (source_id, source_label)
);

comment on table research_source_category_map is
  'A staff-authored mapping from one source''s own category label to a Rivya category, or an explicit IGNORE. The category_id foreign key is the FIRST of exactly two references from the research schema to a public table (amendment A26); the second and last is research_products.matched_category_id in Phase 28. A third is a defect.';
comment on column research_source_category_map.category_id is
  'Rivya taxonomy, pointed at by a person. Never written by the pipeline, never derived from a scraped value, and on delete set null so removing a category unmaps rather than deletes.';
comment on column research_source_category_map.mapping_state is
  'MAPPED, IGNORED or UNRESOLVED, derived from the two columns above. UNRESOLVED is the state a row falls into when the Rivya category it pointed at is deleted: the observed label is kept, the decision is shown as needing to be made again, and the dashboard counts it beside the labels nobody has mapped yet.';

create index research_source_category_map_by_source_idx
  on research_source_category_map (source_id);
create index research_source_category_map_by_category_idx
  on research_source_category_map (category_id) where category_id is not null;
-- The dashboard's "categories nobody has mapped" figure is a count over this.
create index research_source_category_map_unresolved_idx
  on research_source_category_map (source_id) where mapping_state = 'UNRESOLVED';

-- --- 6. Six hours, expressed in SQL ----------------------------------------------------------------
--
-- WHY THE MINIMUM INTERVAL IS A DATABASE RULE AT ALL. It is a politeness setting: it bounds how
-- often Rivya may ask a third party for anything. A rule enforced only in a form is a rule that a
-- server action, a script, a fixture or a hand-written UPDATE steps around, and every one of those
-- is a normal thing for this repository to contain.
--
-- THE PARSER IS DELIBERATELY CONSERVATIVE. It reads the minute and hour fields, which is what
-- bounds the gap; restricting day-of-month or day-of-week only ever makes a schedule LESS frequent,
-- so ignoring them can never let something through that fires too often. An expression it cannot
-- parse returns 0 and is refused — an unreadable schedule is not a schedule, and the operator is
-- told at the write rather than discovering months later that a job never fired.
--
-- `parseCronField` in lib/scraper/workflows/schedule.ts is the same grammar in TypeScript, and
-- tests/unit/source-schedules.test.ts holds the two to the same answers.

create function public.research_cron_field_values(p_field text, p_min int, p_max int)
  returns int[]
  language plpgsql
  immutable
  set search_path = public, extensions
as $fn$
declare
  v_part   text;
  v_range  text;
  v_step   text;
  v_start  int;
  v_end    int;
  v_bits   int;
  v_values int[] := '{}';
  v_i      int;
begin
  if p_field is null or btrim(p_field) = '' then return null; end if;

  foreach v_part in array string_to_array(btrim(p_field), ',') loop
    if v_part is null or btrim(v_part) = '' then return null; end if;

    v_range := split_part(v_part, '/', 1);
    v_step  := nullif(split_part(v_part, '/', 2), '');

    if v_step is null then
      v_bits := 1;
    elsif v_step ~ '^[0-9]+$' then
      v_bits := v_step::int;
    else
      return null;
    end if;
    if v_bits < 1 then return null; end if;

    if v_range = '*' then
      v_start := p_min;
      v_end   := p_max;
    elsif v_range ~ '^[0-9]+-[0-9]+$' then
      v_start := split_part(v_range, '-', 1)::int;
      v_end   := split_part(v_range, '-', 2)::int;
    elsif v_range ~ '^[0-9]+$' then
      v_start := v_range::int;
      v_end   := v_start;
    else
      return null;
    end if;

    if v_start < p_min or v_end > p_max or v_start > v_end then return null; end if;

    v_i := v_start;
    while v_i <= v_end loop
      v_values := v_values || v_i;
      v_i := v_i + v_bits;
    end loop;
  end loop;

  if array_length(v_values, 1) is null then return null; end if;
  return array(select distinct unnest(v_values) order by 1);
end;
$fn$;

comment on function public.research_cron_field_values(text, int, int) is
  'One cron field expanded to its values, or null when it cannot be read. The SQL half of parseCronField in lib/scraper/workflows/schedule.ts; tests hold the two to the same answers.';

create function public.research_min_circular_gap(p_values int[], p_wrap int)
  returns int
  language plpgsql
  immutable
  set search_path = public, extensions
as $fn$
declare
  v_sorted int[];
  v_n      int;
  v_i      int;
  v_gap    int;
  v_min    int;
begin
  if p_values is null then return null; end if;
  v_sorted := array(select distinct unnest(p_values) order by 1);
  v_n := array_length(v_sorted, 1);
  if v_n is null or v_n = 0 then return null; end if;
  -- One value fires once per wrap: hours {2} is a daily schedule, not a two-hourly one.
  if v_n = 1 then return p_wrap; end if;

  v_min := p_wrap;
  for v_i in 1 .. v_n loop
    if v_i = v_n then
      -- THE WRAP IS NOT AN EDGE CASE, IT IS THE COMMON ONE. Hours {0, 18} is a six-hour gap across
      -- midnight and an eighteen-hour one inside the day; the six is the number that decides
      -- whether this schedule is polite.
      v_gap := p_wrap - v_sorted[v_n] + v_sorted[1];
    else
      v_gap := v_sorted[v_i + 1] - v_sorted[v_i];
    end if;
    if v_gap < v_min then v_min := v_gap; end if;
  end loop;

  return v_min;
end;
$fn$;

create function public.research_cron_min_interval_minutes(p_expression text)
  returns int
  language plpgsql
  immutable
  set search_path = public, extensions
as $fn$
declare
  v_fields  text[];
  v_minutes int[];
  v_hours   int[];
begin
  if p_expression is null then return null; end if;

  v_fields := regexp_split_to_array(btrim(p_expression), '\s+');
  -- ZERO, NOT NULL, FOR AN EXPRESSION THAT CANNOT BE READ. A null would make the CHECK
  -- `null >= 360` — which is null, which PostgreSQL treats as satisfied — so an unparseable
  -- expression would sail through the very constraint written to catch it.
  if array_length(v_fields, 1) is distinct from 5 then return 0; end if;

  v_minutes := public.research_cron_field_values(v_fields[1], 0, 59);
  v_hours   := public.research_cron_field_values(v_fields[2], 0, 23);
  if v_minutes is null or v_hours is null then return 0; end if;

  -- More than one minute selected means two fires inside one hour, whatever the hour field says.
  if array_length(v_minutes, 1) > 1 then
    return public.research_min_circular_gap(v_minutes, 60);
  end if;

  if array_length(v_hours, 1) > 1 then
    return public.research_min_circular_gap(v_hours, 24) * 60;
  end if;

  -- One minute, one hour: at most once a day, and any day restriction only widens it.
  return 1440;
end;
$fn$;

comment on function public.research_cron_min_interval_minutes(text) is
  'The smallest gap in minutes between two fires of a five-field cron expression, or 0 when it cannot be parsed. Reads the minute and hour fields only: restricting day-of-month or day-of-week can only make a schedule less frequent, so ignoring them never admits something too fast.';

-- THESE THREE ARE CONSTRAINT FUNCTIONS, AND THE GRANT REFLECTS WHAT THAT MEANS. A CHECK expression
-- is evaluated as the WRITING user, so revoking EXECUTE from `authenticated` would not harden
-- anything — it would make `research_source_schedules` unwritable by staff, with an error naming a
-- function no researcher has heard of. `anon` writes nothing here and is revoked; `public` is
-- revoked because PostgreSQL's default grant is what turns a new function into a PostgREST RPC
-- endpoint. See 0022, 0143 and tests/unit/rls/function-grants.test.ts.
revoke execute on function public.research_cron_field_values(text, int, int) from public, anon;
revoke execute on function public.research_min_circular_gap(int[], int)       from public, anon;
revoke execute on function public.research_cron_min_interval_minutes(text)    from public, anon;
grant execute on function public.research_cron_field_values(text, int, int) to authenticated, service_role;
grant execute on function public.research_min_circular_gap(int[], int)      to authenticated, service_role;
grant execute on function public.research_cron_min_interval_minutes(text)   to authenticated, service_role;

-- --- 7. When it runs ------------------------------------------------------------------------------

create table research_source_schedules (
  id              uuid primary key default gen_random_uuid(),
  source_id       uuid not null references research_sources (id) on delete cascade,

  job_type        research_job_type not null,
  cron_expression text not null,
  timezone        text not null default 'UTC',
  is_enabled      boolean not null default false,
  next_run_at     timestamptz,

  status          content_status not null default 'DRAFT',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id),

  constraint research_source_schedules_unique unique (source_id, job_type, cron_expression),
  -- SIX HOURS, AT THE ROW. See the function below for why the rule is computed in SQL rather than
  -- asserted in a form.
  constraint research_source_schedules_min_interval
    check (public.research_cron_min_interval_minutes(cron_expression) >= 360),
  -- UTC ONLY, FOR NOW, AND SAID OUT LOUD. `nextCronRun` in lib/scraper/workflows/schedule.ts
  -- evaluates every field in UTC; a stored 'Asia/Kolkata' would be a column the scheduler ignores,
  -- which is worse than a column that refuses the value. The column exists because FEAT §26 field
  -- 19 names it and because the day a zone-aware scheduler lands, the data is already shaped for it.
  constraint research_source_schedules_timezone_supported
    check (timezone = 'UTC')
);

comment on table research_source_schedules is
  'When a job type runs against a source. Minimum interval six hours, enforced by a CHECK that parses the expression in SQL — a politeness setting a form could be bypassed to set is not a politeness setting.';
comment on column research_source_schedules.timezone is
  'UTC only today. The scheduler evaluates cron fields in UTC, so any other value would be a column it silently ignores; the CHECK refuses one rather than storing a lie.';

create index research_source_schedules_due_idx
  on research_source_schedules (next_run_at) where is_enabled;
create index research_source_schedules_by_source_idx
  on research_source_schedules (source_id);

-- --- 8. Health, computed on read ------------------------------------------------------------------
--
-- FEAT §26 FIELDS 20 AND 21 ARE NOT COLUMNS. A cached health column is a column that is wrong
-- between the event and the job that would update it, and the moments it is most likely to be
-- wrong are exactly the moments somebody looks at it — during an incident. A view cannot go stale,
-- and the rule is legible in SQL rather than buried in a worker nobody opens.
--
-- `security_invoker = true` IS THE LOAD-BEARING WORD IN THIS STATEMENT. Without it a view runs with
-- its OWNER's privileges, so RLS on the tables underneath is bypassed and a view over nine
-- staff-only research tables becomes readable by anyone PostgREST will speak to. With it, the
-- policies in 0233 apply exactly as they would to a direct read.
create view research_source_health_v with (security_invoker = true) as
with runs as (
  select r.source_id,
         max(r.finished_at) filter (where r.status = 'SUCCEEDED')                  as last_success_at,
         max(coalesce(r.finished_at, r.started_at, r.queued_at))                   as last_run_at,
         count(*) filter (where r.queued_at > now() - interval '7 days')           as runs_7d,
         count(*) filter (where r.queued_at > now() - interval '7 days'
                            and r.status = 'SUCCEEDED')                            as ok_7d
    from research_runs r
   group by r.source_id
),
last_two as (
  select source_id,
         array_agg(status order by ordinality) as recent
    from (
      select r.source_id, r.status,
             row_number() over (partition by r.source_id
                                order by coalesce(r.finished_at, r.started_at, r.queued_at) desc)
               as ordinality
        from research_runs r
       where r.status in ('SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED')
    ) ranked
   where ordinality <= 2
   group by source_id
),
queue as (
  select w.source_id, count(*) as depth
    from research_work_items w
   where w.state in ('PENDING', 'LEASED')
   group by w.source_id
),
cadence as (
  -- THE MOST FREQUENT ENABLED SCHEDULE, not the least. A source asked to refresh every six hours
  -- and to discover every day is stale when six hours' work has not happened, not when a day's
  -- has: staleness is measured against the promise that comes due soonest.
  select s.source_id,
         min(public.research_cron_min_interval_minutes(s.cron_expression)) as interval_minutes
    from research_source_schedules s
   where s.is_enabled
   group by s.source_id
)
select
  src.id                                                                as source_id,
  runs.last_run_at,
  (last_two.recent)[1]::text                                            as last_run_status,
  case when coalesce(runs.runs_7d, 0) = 0 then null
       else round(runs.ok_7d::numeric / runs.runs_7d::numeric, 3) end   as success_rate_7d,
  coalesce(queue.depth, 0)::int                                         as queue_depth,
  cadence.interval_minutes,
  runs.last_success_at,
  case
    -- ORDER IS THE RULE. Each branch answers a question the ones below it cannot: a disabled
    -- source is not failing, it is off; a source whose circuit is open is failing whatever its
    -- success rate says; a stale source may have a perfect record and simply not have run.
    when not src.is_enabled then 'DISABLED'
    when src.circuit_open_until is not null and src.circuit_open_until > now() then 'FAILING'
    when coalesce(array_length(last_two.recent, 1), 0) >= 2
         and (last_two.recent)[1] = 'FAILED' and (last_two.recent)[2] = 'FAILED' then 'FAILING'
    when (last_two.recent)[1] = 'PARTIAL' then 'DEGRADED'
    when coalesce(runs.runs_7d, 0) > 0
         and runs.ok_7d::numeric / runs.runs_7d::numeric < 0.8 then 'DEGRADED'
    -- STALE NEEDS A PROMISE TO BE LATE AGAINST. A source with no enabled schedule cannot be stale;
    -- nobody said when it should run. `created_at` stands in for a source that has never
    -- succeeded, so a source configured three days ago with a twelve-hour schedule and no
    -- successful run reads STALE rather than HEALTHY.
    when cadence.interval_minutes is not null
         and coalesce(runs.last_success_at, src.created_at)
             < now() - make_interval(mins => cadence.interval_minutes * 2) then 'STALE'
    else 'HEALTHY'
  end                                                                   as health
from research_sources src
left join runs     on runs.source_id     = src.id
left join last_two on last_two.source_id = src.id
left join queue    on queue.source_id    = src.id
left join cadence  on cadence.source_id  = src.id;

comment on view research_source_health_v is
  'FEAT §26 fields 20 and 21, DERIVED. DISABLED · FAILING · DEGRADED · STALE · HEALTHY, in that precedence. security_invoker so the Phase 25 policies on the tables underneath still decide who may read it; without that word a staff-only subsystem would be readable by anyone PostgREST will speak to.';

-- A VIEW IS NOT A TABLE AND HAS NO POLICIES, so its GRANTS are the whole of its access control.
-- `anon` is revoked explicitly rather than left to the default, because the default on Supabase is
-- to expose a new view through PostgREST — isolation invariant I2 in the one place `pg_policies`
-- cannot see it.
revoke all on research_source_health_v from public, anon;
grant select on research_source_health_v to authenticated, service_role;

-- --- 9. The search document, corrected for the enum ------------------------------------------------
--
-- 0234 BUILT `array[s.slug::text, s.region, s.source_type]`, WHICH WAS CORRECT WHEN `source_type`
-- WAS TEXT AND IS A TYPE ERROR NOW THAT IT IS NOT. PostgreSQL will not build an array from `text`
-- and `research_source_type`, so section 2's conversion would have broken every insert and update
-- on `research_sources` — including the ones this phase's own Studio form makes — the moment the
-- trigger fired. Replaced whole, with the cast, and widened while it is open: a source's collection
-- mode is worth finding it by.
--
-- The other two branches are unchanged from 0234 and are reproduced verbatim, because
-- `create or replace function` has no way to edit one branch.
create or replace function public.refresh_research_search_document(p_entity_type text, p_entity_id uuid)
  returns void
  language plpgsql
  volatile
  security definer
  set search_path = public, extensions
as $fn$
declare
  v_title    text;
  v_subtitle text;
  v_body     text;
  v_status   text;
  v_url      text;
  v_source   text;
  v_keywords text[] := '{}';
  v_found    boolean := false;
begin
  if p_entity_type = 'research_source' then
    select true,
           s.name,
           s.base_url,
           concat_ws(' ', s.region, s.source_type::text, s.adapter_key, s.collection_mode::text),
           s.policy_status::text,
           '/studio/research/sources/' || s.id::text,
           s.base_url,
           array_remove(
             array[s.slug::text, s.region, s.source_type::text, s.collection_mode::text],
             null)
      into v_found, v_title, v_subtitle, v_body, v_status, v_url, v_source, v_keywords
      from research_sources s
     where s.id = p_entity_id;

  elsif p_entity_type = 'research_run' then
    select true,
           concat_ws(' — ', s.name, left(r.id::text, 8)),
           r.trigger::text,
           coalesce(r.error_summary, ''),
           r.status::text,
           '/studio/research/runs/' || r.id::text,
           null,
           array_remove(array[s.slug::text, r.status::text, r.trigger::text], null)
      into v_found, v_title, v_subtitle, v_body, v_status, v_url, v_source, v_keywords
      from research_runs r
      join research_sources s on s.id = r.source_id
     where r.id = p_entity_id;

  elsif p_entity_type = 'research_product' then
    select true,
           coalesce(nullif(btrim(p.source_external_id), ''), p.source_url),
           s.name,
           '',
           p.stage::text,
           '/studio/research/explorer?product=' || p.id::text,
           p.source_url,
           array_remove(array[s.slug::text, p.disposition::text], null)
      into v_found, v_title, v_subtitle, v_body, v_status, v_url, v_source, v_keywords
      from research_products p
      join research_sources s on s.id = p.source_id
     where p.id = p_entity_id;

  else
    return;
  end if;

  if not coalesce(v_found, false) or v_title is null or btrim(v_title) = '' then
    delete from research_search_documents
     where entity_type = p_entity_type and entity_id = p_entity_id;
    return;
  end if;

  -- check-migrations: allow-insert (an index row derived from a source row inside a trigger function, not seeded content)
  insert into research_search_documents
    (entity_type, entity_id, visibility, status, url_path, title, subtitle, body, keywords,
     source_url, indexed_at)
  values
    (p_entity_type, p_entity_id, 'STAFF', v_status, v_url, v_title, v_subtitle, v_body,
     coalesce(v_keywords, '{}'::text[]), v_source, now())
  on conflict (entity_type, entity_id) do update
    set status     = excluded.status,
        url_path   = excluded.url_path,
        title      = excluded.title,
        subtitle   = excluded.subtitle,
        body       = excluded.body,
        keywords   = excluded.keywords,
        source_url = excluded.source_url,
        indexed_at = now();
end;
$fn$;

revoke execute on function public.refresh_research_search_document(text, uuid) from public, anon, authenticated;
grant execute on function public.refresh_research_search_document(text, uuid) to service_role;

-- --- 10. RLS on, policies in 0241 -------------------------------------------------------------------

alter table research_source_url_patterns   enable row level security;
alter table research_source_category_map   enable row level security;
alter table research_source_schedules      enable row level security;
