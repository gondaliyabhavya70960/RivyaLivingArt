-- ============================================================================================
-- 0320 — Phase 34: Product Direction Tool
--
-- RESEARCH BECOMES A WRITTEN INTERNAL BRIEF. A direction brief is a Rivya document, authored by a
-- person, that says what kind of piece the studio might develop and why — scale intent, form
-- language, material direction, finish direction, the questions still open — with the evidence
-- stapled to it. The tool assembles the evidence and writes not one sentence of prose.
--
-- IT HAS NO PATH TO THE CATALOGUE, AND THE SCHEMA IS WHERE THAT STARTS:
--
--   * `status` is `content_status` restricted by CHECK to DRAFT · REVIEW · APPROVED · ARCHIVED.
--     PUBLISHED is rejected at the row. There is no public route that could render a brief and no
--     state that could produce one.
--   * There is NO price, dimension, material, lead-time, tolerance or capability column. The
--     "intended" sections are prose; a Rivya dimension does not exist until a maker makes one.
--   * `target_category_slug` is a CHECKED TEXT SLUG, NOT A FOREIGN KEY. `categories.id` is already
--     the target of the second and last allowlisted research→public reference (Phase 28), and
--     `check-research-isolation.mjs` fails the build on a third. D3 fixes the seven slugs, so the
--     CHECK is as durable as a key and costs no coupling (open question 13 → amendment A34).
--
-- EVIDENCE IS CAPTURED BY VALUE WHERE IT IS VOLATILE. A score attached today stores the score,
-- confidence and model version as they were, in `captured`, beside the id — so a brief read a year
-- later shows what its author saw, and the rail can show drift against the current value.
--
-- EVERY EVIDENCE ROW CARRIES A NON-EMPTY RATIONALE, by CHECK. Evidence attached without a stated
-- reason is how a brief turns into a scrapbook.
--
-- REVISIONS ARE WRITTEN BY A TRIGGER, SECURITY DEFINER, exactly as Phase 08's `write_revision()`
-- is and for the same reason: the revisions table has no session write policy, so an
-- invoker-rights trigger would insert nothing and succeed. Restore is a SECURITY DEFINER function
-- that re-checks the permission it needs.
--
-- ISOLATION: no foreign key to any public table (I1 allowlist stays at two); no anon policy (I2).
-- ============================================================================================

set search_path = public, extensions;

-- --- 1. The brief: nine prose sections, a checked category slug, a lifecycle without PUBLISHED --

create table research_direction_briefs (
  id                    uuid primary key default gen_random_uuid(),
  slug                  citext not null unique,
  title                 text not null,

  -- The nine sections. Free prose written by a human; never pre-filled, never suggested.
  intent                text,
  scale_intent          text,
  form_language         text,
  material_direction    text,
  finish_direction      text,
  constraints           text,
  open_questions        text,
  not_doing             text,

  target_category_slug  text,
  status                content_status not null default 'DRAFT',
  owner_verification    owner_verification not null default 'NOT_REQUIRED',
  fact_classification   fact_classification not null default 'EDITORIAL_COPY',
  approved_at           timestamptz,
  approved_by           uuid references auth.users (id) on delete set null,

  created_at            timestamptz not null default now(),
  created_by            uuid references auth.users (id) on delete set null,
  updated_at            timestamptz not null default now(),
  updated_by            uuid references auth.users (id) on delete set null,

  constraint research_direction_briefs_title_not_blank check (btrim(title) <> ''),
  constraint research_direction_briefs_slug_shape check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- PUBLISHED is unreachable. A direction brief is internal by construction.
  constraint research_direction_briefs_status_allowlist
    check (status in ('DRAFT', 'REVIEW', 'APPROVED', 'ARCHIVED')),
  -- The seven D3 categories, as slugs. A checked slug, not a key (see the header).
  constraint research_direction_briefs_category_allowlist
    check (target_category_slug is null or target_category_slug in
      ('furniture', 'collectible-design', '3d-resin', 'wall-statement-art',
       'preservation', 'decor', 'gifts')),
  -- APPROVED means a named person agreed, at a time. Both or neither.
  constraint research_direction_briefs_approval_is_dated
    check ((status = 'APPROVED') = (approved_at is not null)),
  constraint research_direction_briefs_approval_is_signed
    check (approved_at is null or approved_by is not null)
);

create index research_direction_briefs_status_idx
  on research_direction_briefs (status, updated_at desc);
create index research_direction_briefs_category_idx
  on research_direction_briefs (target_category_slug);

create trigger research_direction_briefs_set_updated_at
  before update on research_direction_briefs
  for each row execute function public.set_updated_at();

/*
 * APPROVAL IS A SEPARATE PERMISSION, HELD AT THE ROW. The generated policies (0321) admit
 * research.direction.write to update a brief; moving it INTO APPROVED additionally requires
 * research.direction.approve (owner, admin, merchandiser). The generator writes one predicate per
 * leg, so the narrower rule lives in a trigger rather than a hand-edited policy: it fires only
 * when the status becomes APPROVED, and the service role passes because has_role() is false for
 * it only when there is a session — the CLI never approves anything.
 */
create or replace function public.guard_direction_brief_approval() returns trigger
  language plpgsql
  set search_path = pg_catalog, public
  as $$
begin
  if new.status = 'APPROVED' and (tg_op = 'INSERT' or old.status is distinct from 'APPROVED') then
    if auth.uid() is not null and not public.has_role('owner', 'admin', 'merchandiser') then
      raise exception 'research.direction.approve is required to approve a direction brief'
        using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

revoke execute on function public.guard_direction_brief_approval() from public, anon, authenticated;

create trigger research_direction_briefs_guard_approval
  before insert or update on research_direction_briefs
  for each row execute function public.guard_direction_brief_approval();

comment on table research_direction_briefs is
  'Phase 34. A human-written internal design direction: nine prose sections, a checked category '
  'slug, and a lifecycle of DRAFT, REVIEW, APPROVED, ARCHIVED — PUBLISHED is refused at the row. '
  'No price, dimension, material or lead-time column exists and none may be added: a brief is what '
  'a maker reads before sketching, never a specification. No path to products.';

-- --- 2. Evidence: typed, captured by value, with a reason ---------------------------------------

create table research_direction_brief_evidence (
  id             uuid primary key default gen_random_uuid(),
  brief_id       uuid not null references research_direction_briefs (id) on delete cascade,
  evidence_type  text not null,
  -- The id of the attached row. NO FOREIGN KEY: the seven types live in seven tables, one of which
  -- (media_assets) is public — a key here would be the third crossing I1 forbids. Captured values
  -- keep the row readable if the target is later deleted.
  evidence_id    uuid not null,
  captured       jsonb not null default '{}'::jsonb,
  rationale      text not null,
  position       integer not null default 0,
  created_at     timestamptz not null default now(),
  created_by     uuid not null references auth.users (id) on delete restrict,

  constraint research_direction_brief_evidence_type_allowlist
    check (evidence_type in ('COMPARISON_SET', 'ANALYTICS_SNAPSHOT', 'OPPORTUNITY_SCORE',
                             'SIMILARITY_PAIR', 'RESEARCH_PRODUCT', 'RESEARCH_NOTE', 'MEDIA_ASSET')),
  constraint research_direction_brief_evidence_rationale_not_blank
    check (length(btrim(rationale)) > 0),
  constraint research_direction_brief_evidence_captured_is_object
    check (jsonb_typeof(captured) = 'object'),
  -- Volatile evidence is captured by value. A score or a snapshot attached with nothing captured
  -- would be a link that rots the day the number changes.
  constraint research_direction_brief_evidence_volatile_is_captured
    check (evidence_type not in ('OPPORTUNITY_SCORE', 'ANALYTICS_SNAPSHOT')
           or captured <> '{}'::jsonb),
  constraint research_direction_brief_evidence_position_nonneg check (position >= 0),
  constraint research_direction_brief_evidence_unique unique (brief_id, evidence_type, evidence_id)
);

create index research_direction_brief_evidence_brief_idx
  on research_direction_brief_evidence (brief_id, position);

comment on table research_direction_brief_evidence is
  'Phase 34. One attached item per row, typed, with the value captured at attachment time for the '
  'volatile kinds and a non-empty rationale written by the person attaching it. No foreign key to '
  'the target: a link that outlives its target is the point of capturing the value.';

-- --- 3. Revisions: a full body snapshot per save, written by trigger ----------------------------

create table research_direction_brief_revisions (
  id          uuid primary key default gen_random_uuid(),
  brief_id    uuid not null references research_direction_briefs (id) on delete cascade,
  revision    integer not null,
  action      text not null,
  body        jsonb not null,
  note        text,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id) on delete set null,

  constraint research_direction_brief_revisions_positive check (revision > 0),
  constraint research_direction_brief_revisions_action_allowlist
    check (action in ('CREATE', 'UPDATE', 'STATUS_CHANGE', 'RESTORE')),
  constraint research_direction_brief_revisions_body_is_object check (jsonb_typeof(body) = 'object'),
  constraint research_direction_brief_revisions_unique unique (brief_id, revision)
);

create index research_direction_brief_revisions_brief_idx
  on research_direction_brief_revisions (brief_id, revision desc);

comment on table research_direction_brief_revisions is
  'Phase 34. An immutable snapshot of the brief per mutation, numbered per brief, written only by '
  'write_direction_brief_revision(). No session may update or delete one.';

/*
 * The trigger, after Phase 08's write_revision(): SECURITY DEFINER because the revisions table has
 * no session write policy; the revision number is allocated under a transaction-scoped advisory
 * lock keyed on the brief so two concurrent saves cannot read the same max; `updated_at` is left
 * out of the snapshot so two otherwise identical revisions do not differ by a timestamp.
 */
create or replace function public.write_direction_brief_revision() returns trigger
  language plpgsql
  security definer
  set search_path = public, extensions
  as $$
declare
  v_action text;
  v_next   integer;
begin
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

  perform pg_advisory_xact_lock(hashtextextended('research_direction_brief:' || new.id::text, 0));

  select coalesce(max(revision), 0) + 1
    into v_next
    from research_direction_brief_revisions
   where brief_id = new.id;

  -- check-migrations: allow-insert (a trigger body, not a seeded row — this is the audit trail)
  insert into research_direction_brief_revisions (brief_id, revision, action, body, created_by)
  values (new.id, v_next, v_action, to_jsonb(new) - 'updated_at', new.updated_by);

  return new;
end $$;

revoke execute on function public.write_direction_brief_revision() from public, anon, authenticated;

create trigger research_direction_briefs_write_revision
  after insert or update on research_direction_briefs
  for each row execute function public.write_direction_brief_revision();

/*
 * Restore: put a revision's nine sections, title and category back on the brief. The lifecycle
 * is NOT restored — a status is a decision made at a time, and restoring an APPROVED snapshot
 * over a DRAFT would forge an approval. The function re-checks research.direction.write so a
 * session that may not edit the brief may not restore it either; it is SECURITY DEFINER only so
 * the revision write inside it lands.
 */
create or replace function public.research_restore_brief_revision(
  p_brief_id uuid,
  p_revision integer,
  p_actor    uuid
) returns void
  language plpgsql
  security definer
  set search_path = public, extensions
  as $$
declare
  v_body jsonb;
begin
  if not public.has_role('owner', 'admin', 'merchandiser', 'researcher') then
    raise exception 'research.direction.write is required to restore a brief revision'
      using errcode = '42501';
  end if;

  select body into v_body
    from research_direction_brief_revisions
   where brief_id = p_brief_id and revision = p_revision;
  if v_body is null then
    raise exception 'no revision % for brief %', p_revision, p_brief_id;
  end if;

  perform set_config('rivya.revision_action', 'RESTORE', true);

  update research_direction_briefs
     set title                = coalesce(v_body ->> 'title', title),
         intent               = v_body ->> 'intent',
         scale_intent         = v_body ->> 'scale_intent',
         form_language        = v_body ->> 'form_language',
         material_direction   = v_body ->> 'material_direction',
         finish_direction     = v_body ->> 'finish_direction',
         constraints          = v_body ->> 'constraints',
         open_questions       = v_body ->> 'open_questions',
         not_doing            = v_body ->> 'not_doing',
         target_category_slug = v_body ->> 'target_category_slug',
         updated_by           = p_actor
   where id = p_brief_id;

  perform set_config('rivya.revision_action', '', true);
end $$;

revoke execute on function public.research_restore_brief_revision(uuid, integer, uuid) from public, anon;
grant execute on function public.research_restore_brief_revision(uuid, integer, uuid) to authenticated, service_role;

-- --- 4. Row security on, policies in 0321 --------------------------------------------------------

alter table research_direction_briefs          enable row level security;
alter table research_direction_brief_evidence  enable row level security;
alter table research_direction_brief_revisions enable row level security;
