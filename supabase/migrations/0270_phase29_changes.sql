-- ============================================================================================
-- 0270 — Phase 29: Change Detection + Review
--
-- WHAT THIS PHASE IS FOR, IN ONE SENTENCE: the research subsystem becomes useful OVER TIME rather
-- than at a point in time. A competitor's page is fetched again, a field has moved, and somebody
-- has to decide what that means.
--
-- THE RULE THAT SHAPES EVERY TABLE BELOW IS FEAT §25's LAST LINE: **changes are never
-- automatically imported into Rivya products.** They are never automatically imported into
-- anything. Nothing here writes to `products`, `product_media`, `product_specs`,
-- `product_materials` or `media_assets`, no trigger reaches across, and
-- `scripts/research/check-no-autoimport.mjs` fails the build if a future phase adds a path.
--
-- THREE SHAPES OF TABLE, AND THE DIFFERENCE IS WHO MAY WRITE:
--
--   DETECTED BY THE SYSTEM — `research_changes`, `research_change_digests`. The pipeline writes
--   them under the service role and no session may insert one. A change somebody typed is not a
--   change a page made, and the whole value of the queue is that every row in it is evidence.
--
--   DECIDED BY A PERSON — `research_review_actions`, `research_notes`, `research_product_tags`.
--   `research.confirm`, the Phase 04 split's judging half: a researcher operates the pipeline, a
--   merchandiser judges its output. All three are APPEND-ONLY. A reversal is a new row.
--
--   CONFIGURED BY A PERSON — `research_change_rules`, `research_tags`. `research.write`, the
--   operating half, exactly as the material lexicon in `0260`.
--
-- STAGE IS NOT TOUCHED HERE AND NO TRIGGER MOVES ONE. Detection attaches a change to a row and
-- leaves the row where it was; only a person moves a row between REVIEW, SHORTLISTED and
-- CONFIRMED, through `lib/scraper/core/stage.ts`, which is still the only writer of `stage`.
-- ============================================================================================

set search_path = public, extensions;

-- --- 1. What changed, between which two versions -------------------------------------------------
--
-- DIFFS ARE VERSION-TO-VERSION, NEVER AGAINST THE MUTABLE CURRENT ROW. `research_products` is
-- overwritten by every normalisation pass, so a diff computed against it could never be reproduced
-- — by the time somebody opened the drawer to ask "what did it say before", the before was gone.
-- Both version ids and both snapshot keys are stored, so the drawer can link to the two gzipped
-- pages the comparison was actually made from.

create table research_changes (
  id                  uuid primary key default gen_random_uuid(),
  research_product_id uuid not null references research_products (id) on delete cascade,

  -- Denormalised from the product so the queue can filter by source without a join on every row.
  -- It is the source that OWNS the product; a product cannot move between sources.
  source_id           uuid not null references research_sources (id) on delete cascade,

  field               text not null,
  change_kind         text not null,
  materiality         text not null,

  /*
   * `before` AND `after` ARE jsonb, NOT text, AND THAT IS NOT DECORATION. Half the fields this
   * phase diffs are not scalars: `dimensions_mm` is an object, `material_tokens` and `image_urls`
   * are arrays, `price` is a state plus two amounts plus a currency. Storing a rendered string
   * would make the drawer's before/after a formatting decision taken at detection time, and would
   * make "which axis moved" unanswerable without re-parsing prose the detector had already parsed.
   *
   * Null on one side is how ADDED and REMOVED are represented: a field that was absent and is now
   * present has a null `before`, and the constraint below refuses the combination that would mean
   * nothing changed at all.
   */
  before              jsonb,
  after               jsonb,

  version_before_id   uuid references research_product_versions (id) on delete set null,
  version_after_id    uuid not null references research_product_versions (id) on delete cascade,
  run_id              uuid references research_runs (id) on delete set null,

  -- The two gzipped pages in the private snapshot bucket. Null once pruned at 180 days (`0234`),
  -- which is why the versions themselves carry the drafts rather than being re-derived on demand.
  snapshot_before_key text,
  snapshot_after_key  text,

  detected_at         timestamptz not null default now(),

  /*
   * THE DECISION, ON THE CHANGE ROW, DENORMALISED FROM THE APPEND-ONLY ACTION LOG.
   *
   * `research_review_actions` is the record of WHO DID WHAT AND WHY and it is never edited. These
   * three columns are the queue's answer to "is this one still mine to look at", and they exist
   * because the alternative is a lateral join against an append-only log — including its
   * reversals — on every row of a screen somebody pages through a hundred rows at a time.
   *
   * They are a CACHE OF THE LOG, not a second source of truth: `lib/scraper/workflows/
   * review-actions.ts` writes the action row first and then stamps these, in that order, so a
   * crash between the two leaves an audited decision that the queue shows as undecided — which is
   * the safe direction. The reverse order would hide a decision nobody can account for.
   */
  decided_action      text,
  decided_by          uuid references auth.users (id),
  decided_at          timestamptz,

  constraint research_changes_kind_allowlist
    check (change_kind in ('ADDED', 'REMOVED', 'MODIFIED')),
  constraint research_changes_materiality_allowlist
    check (materiality in ('MATERIAL', 'MINOR', 'NOISE')),
  constraint research_changes_action_allowlist
    check (decided_action is null
           or decided_action in ('REVIEW', 'IGNORE', 'SHORTLIST', 'REJECT', 'MARK_DUPLICATE',
                                 'CONFIRM')),

  /*
   * A CHANGE CHANGES SOMETHING. Both sides null would be a row asserting that a field moved from
   * nothing to nothing.
   *
   * Written as `not (before is null and after is null)` rather than `before is distinct from
   * after`: the detector already refuses to emit an equal pair, and a database-level inequality
   * test on jsonb would make `{"a":1,"b":2}` and `{"b":2,"a":1}` a change — jsonb normalises key
   * order on storage, so they would in fact compare equal, but relying on that here would tie a
   * constraint to a storage detail rather than to the rule.
   */
  constraint research_changes_changes_something
    check (not (before is null and after is null)),
  -- ADDED means there was nothing before; REMOVED means there is nothing now. Stated at the row
  -- because the queue groups by kind, and a mislabelled kind is a filter that lies.
  constraint research_changes_kind_matches_sides
    check ((change_kind = 'ADDED'    and before is null and after is not null)
        or (change_kind = 'REMOVED'  and before is not null and after is null)
        or (change_kind = 'MODIFIED' and before is not null and after is not null)),
  -- A DECISION NAMES SOMEBODY AND WHEN, the same shape as `0231`'s policy approval and `0260`'s
  -- dismissal. A verdict with nobody's name against it is the record that is useless in the
  -- conversation it exists for.
  constraint research_changes_decision_is_attributed
    check ((decided_action is null and decided_by is null and decided_at is null)
        or (decided_action is not null and decided_by is not null and decided_at is not null)),

  /*
   * ONE ROW PER (PRODUCT, FIELD, NEW VERSION), which is what makes detection RE-RUNNABLE.
   *
   * Re-running the detector over a version pair must not double the queue. With this key the
   * second pass is an upsert onto the row the first pass wrote — and a re-classification after
   * somebody lowers a source's threshold updates `materiality` in place rather than raising a
   * second change for the same movement.
   */
  constraint research_changes_unique_per_version
    unique (research_product_id, field, version_after_id)
);

comment on table research_changes is
  'One row per field that moved between two versions of a research product. Written by lib/scraper/workflows/detect-changes.ts under the service role and never by a session: a change somebody typed is not a change a page made. Diffs are version-to-version so they stay reproducible, and both snapshot keys are stored so the drawer can link to the evidence.';
comment on column research_changes.materiality is
  'MATERIAL, MINOR or NOISE, from research_change_rules via lib/scraper/analytics/materiality.ts. NOISE is recorded, hidden by default and never counted — a queue that reports formatting churn as change is a queue people stop reading.';
comment on column research_changes.decided_action is
  'A cache of the latest un-reversed research_review_actions row for this change, so the queue does not lateral-join an append-only log on every row. The action log is the record; this is the index.';

-- The queue's own order: material and undecided first, newest first.
create index research_changes_queue_idx
  on research_changes (materiality, decided_action, detected_at desc);
create index research_changes_by_product_idx
  on research_changes (research_product_id, detected_at desc);
-- The dashboard counts by source and field, and the digest asks for the oldest undecided row.
create index research_changes_by_source_idx
  on research_changes (source_id, field, detected_at desc)
  where materiality <> 'NOISE';
create index research_changes_undecided_idx
  on research_changes (detected_at)
  where decided_action is null and materiality <> 'NOISE';

-- --- 2. The thresholds, per source, editable without a deploy -------------------------------------
--
-- A SOURCE WITH NOISY PRICES MUST BE TUNABLE BY THE PERSON READING THE QUEUE. Hard-coded
-- thresholds mean the only way to stop a source flooding the queue is a deploy, and the practical
-- outcome of that is that nobody reads the queue.

create table research_change_rules (
  id                 uuid primary key default gen_random_uuid(),

  -- NULL IS THE GLOBAL DEFAULT ROW. Not a sentinel uuid, not a separate table: null means "no
  -- source named", which is what a default is. See the unique constraint below for the trap.
  source_id          uuid references research_sources (id) on delete cascade,
  field              text not null,

  material_threshold numeric(6,4),
  minor_threshold    numeric(6,4),
  is_enabled         boolean not null default true,

  -- THE FULL D5 COMMON SET, `status` INCLUDED, because this is staff-editable research
  -- configuration and every other table of that kind carries it: `research_source_url_patterns`,
  -- `research_source_category_map`, `research_source_schedules` and `research_material_lexicon`.
  -- The eleven seeded defaults below arrive PUBLISHED — a default nobody has approved is a
  -- detector that classifies nothing — and a per-source override a researcher is still drafting
  -- sits at DRAFT until they publish it.
  status             content_status not null default 'DRAFT',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  updated_by         uuid references auth.users (id),

  constraint research_change_rules_field_allowlist
    check (field in ('price', 'title', 'availability', 'dimensions_mm', 'variant_count',
                     'material_tokens', 'image_urls', 'lead_time_days', 'description',
                     'customization', 'sku')),
  /*
   * A THRESHOLD IS A PROPORTION OR A SIMILARITY, AND BOTH LIVE IN [0, 1].
   *
   * Null is legitimate and common: `variant_count` and `sku` have no threshold at all — any change
   * is MATERIAL — so a row that carried a number for them would be a number nothing reads.
   */
  constraint research_change_rules_thresholds_in_range
    check ((material_threshold is null or (material_threshold >= 0 and material_threshold <= 1))
       and (minor_threshold is null or (minor_threshold >= 0 and minor_threshold <= 1))),

  /*
   * `nulls not distinct` IS LOAD-BEARING AND IS THE WHOLE REASON THIS COMMENT EXISTS.
   *
   * PostgreSQL's default is `nulls distinct`: two rows with the same `field` and a null
   * `source_id` do NOT violate an ordinary unique constraint, because null is not equal to null.
   * A plain `unique (source_id, field)` would therefore permit any number of global default rows
   * for `price` — and the resolver would pick whichever came back first, so the threshold in
   * effect would depend on row order. That is a bug that cannot be reproduced on demand.
   *
   * Available since PostgreSQL 15; local is 16 and hosted is 17.
   */
  constraint research_change_rules_unique_scope
    unique nulls not distinct (source_id, field)
);

comment on table research_change_rules is
  'Materiality thresholds per field, with a null source_id meaning the global default. Editable in Studio so a source with noisy prices is tuned without a deploy. unique nulls not distinct is load-bearing: the default would otherwise be duplicable and the effective threshold would depend on row order.';

create index research_change_rules_by_source_idx on research_change_rules (source_id);

-- --- 3. What a person did about it ----------------------------------------------------------------
--
-- APPEND-ONLY, AND THE TRIGGER BELOW MEANS IT RATHER THAN ASKING NICELY. A reversal is a NEW ROW
-- pointing at the one it undoes. An action log that can be edited answers "what does the log say"
-- and not "what happened", and the second is the only question anybody asks it.

create table research_review_actions (
  id                  uuid primary key default gen_random_uuid(),
  research_product_id uuid not null references research_products (id) on delete cascade,

  -- Null for an action taken on the ROW rather than on a specific change — shortlisting from the
  -- explorer, adding a note. The queue's actions carry one; the explorer's mostly do not.
  change_id           uuid references research_changes (id) on delete set null,

  action              text not null,
  reason              text,

  /*
   * ACTOR AND ROLE, BOTH STORED, AND THE ROLE IS NOT DERIVABLE LATER. A person's role changes; the
   * question this log answers is "who was permitted to do this AT THE TIME", and reading today's
   * staff_profiles row to answer it gives the wrong answer for every action taken before a
   * promotion. The same reasoning as `audit_logs`.
   */
  actor_user_id       uuid references auth.users (id),
  actor_role          text not null,

  occurred_at         timestamptz not null default now(),

  -- Set on the row being UNDONE, pointing at the row that undid it. Both rows survive.
  undone_by_action_id uuid references research_review_actions (id) on delete set null,

  constraint research_review_actions_action_allowlist
    check (action in ('REVIEW', 'IGNORE', 'SHORTLIST', 'REJECT', 'MARK_DUPLICATE', 'CONFIRM',
                      'NOTE', 'TAG', 'COMPARE')),
  /*
   * REJECT AND IGNORE DEMAND A REASON; THE OTHER SEVEN DO NOT.
   *
   * These are the two actions that take a row OUT of the queue without anybody having to look at
   * it again, and a queue emptied for unrecorded reasons is a queue whose emptiness means nothing.
   * MARK_DUPLICATE carries its reason in the surviving row's id, which is a better answer than
   * prose.
   */
  constraint research_review_actions_reason_when_closing
    check (action not in ('REJECT', 'IGNORE') or (reason is not null and btrim(reason) <> '')),
  -- An action cannot undo itself, which would make the reversal chain a cycle of one.
  constraint research_review_actions_no_self_undo
    check (undone_by_action_id is null or undone_by_action_id <> id)
);

comment on table research_review_actions is
  'Append-only record of the nine FEAT §25 actions. A reversal is a new row with undone_by_action_id set on the row it undoes; nothing is ever edited or deleted. actor_role is stored rather than derived because a person''s role changes and the question is who was permitted at the time.';

create index research_review_actions_by_product_idx
  on research_review_actions (research_product_id, occurred_at desc);
create index research_review_actions_by_change_idx
  on research_review_actions (change_id) where change_id is not null;

/*
 * THE APPEND-ONLY RULE, ENFORCED IN THE DATABASE RATHER THAN IN THE REPOSITORY.
 *
 * One exception, and it is the mechanism the rule is built on: `undone_by_action_id` may be set
 * ONCE, from null, on a row that is otherwise untouched. That is how a reversal points back at
 * what it reversed without either row being rewritten. Every other column is frozen and DELETE is
 * refused outright, service role included — `0261`'s posture for `research_pipeline_events`,
 * applied to the log a person's decisions live in.
 */
create or replace function public.tg_research_review_actions_append_only()
  returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op = 'DELETE' then
    /*
     * ONE DELETE IS PERMITTED AND IT IS THE CASCADE, AND THE TEST FOR IT IS NOT A TRICK.
     *
     * The rule this trigger enforces is "a decision ABOUT A ROW may not be erased while that row
     * exists". When the research product itself is deleted — a source removed, a `db:reset` — its
     * decisions go with it, because a judgement about a row nobody can see is not history anybody
     * can read.
     *
     * PostgreSQL deletes the PARENT before the cascaded children, and each child's BEFORE DELETE
     * trigger runs in a snapshot where the parent is already gone. So "can I still see my product"
     * distinguishes the two cases exactly: a direct DELETE finds it and is refused; a cascade does
     * not and is allowed. Verified against this database rather than assumed — it is the kind of
     * ordering guarantee that would be silently wrong if it changed.
     *
     * WITHOUT THIS, `research_sources` BECOMES UNDELETABLE. That was found by the Phase 29 RLS
     * suite failing to clean up after itself, which is the cheapest possible place to find it: the
     * alternative was an operator discovering months later that a source they added by mistake
     * cannot be removed, with the error naming an audit table they have never heard of.
     */
    if not exists (select 1 from public.research_products where id = old.research_product_id) then
      return old;
    end if;
    raise exception 'research_review_actions is append-only: a reversal is a new row, not a delete'
      using errcode = 'restrict_violation';
  end if;

  if old.undone_by_action_id is not null and new.undone_by_action_id is distinct from old.undone_by_action_id then
    raise exception 'This action was already reversed by %; a second reversal is a new action row',
      old.undone_by_action_id
      using errcode = 'restrict_violation';
  end if;

  if new.id is distinct from old.id
     or new.research_product_id is distinct from old.research_product_id
     or new.change_id is distinct from old.change_id
     or new.action is distinct from old.action
     or new.reason is distinct from old.reason
     or new.actor_user_id is distinct from old.actor_user_id
     or new.actor_role is distinct from old.actor_role
     or new.occurred_at is distinct from old.occurred_at then
    raise exception 'research_review_actions is append-only: only undone_by_action_id may be set'
      using errcode = 'restrict_violation';
  end if;

  return new;
end;
$$;

comment on function public.tg_research_review_actions_append_only() is
  'Refuses every UPDATE except setting undone_by_action_id once from null, and refuses DELETE outright. The repository could enforce this and a hand-written UPDATE would walk around it.';

create trigger research_review_actions_append_only
  before update or delete on research_review_actions
  for each row execute function public.tg_research_review_actions_append_only();

-- --- 4. Notes, never deleted ----------------------------------------------------------------------

create table research_notes (
  id                  uuid primary key default gen_random_uuid(),
  research_product_id uuid not null references research_products (id) on delete cascade,
  body                text not null,
  author_user_id      uuid references auth.users (id),
  created_at          timestamptz not null default now(),

  -- An edit is a NEW note; this points from the old one to its replacement. The thread of what
  -- somebody thought at each point survives, which is the reason to keep notes at all.
  superseded_by       uuid references research_notes (id) on delete set null,

  constraint research_notes_body_not_blank check (btrim(body) <> ''),
  constraint research_notes_no_self_supersede
    check (superseded_by is null or superseded_by <> id)
);

comment on table research_notes is
  'Append-only. An edit is a new note with superseded_by set on the old one; nothing is deleted, because what somebody thought before they changed their mind is the useful half of a note thread.';

create index research_notes_by_product_idx
  on research_notes (research_product_id, created_at desc);

create or replace function public.tg_research_notes_append_only()
  returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op = 'DELETE' then
    -- The same cascade exemption, for the same reason and by the same test as
    -- `tg_research_review_actions_append_only()`: notes about a row that no longer exists go with
    -- it, and a direct delete while the row is still there is refused.
    if not exists (select 1 from public.research_products where id = old.research_product_id) then
      return old;
    end if;
    raise exception 'research_notes is append-only: supersede a note, do not delete it'
      using errcode = 'restrict_violation';
  end if;
  if new.id is distinct from old.id
     or new.research_product_id is distinct from old.research_product_id
     or new.body is distinct from old.body
     or new.author_user_id is distinct from old.author_user_id
     or new.created_at is distinct from old.created_at then
    raise exception 'research_notes is append-only: only superseded_by may be set'
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

create trigger research_notes_append_only
  before update or delete on research_notes
  for each row execute function public.tg_research_notes_append_only();

-- --- 5. A controlled tag vocabulary, and the rows it is applied to ---------------------------------
--
-- FREE TEXT IS REJECTED, AND THE FOREIGN KEY IS WHAT REJECTS IT. "oversized", "over-sized" and
-- "Oversized" as three tags is the failure mode of every free-text tagging system, and it is not
-- recoverable later: by the time somebody notices, the three spellings are spread across a
-- thousand rows and nobody knows which meant what.

create table research_tags (
  id         uuid primary key default gen_random_uuid(),
  slug       citext not null unique,
  label      text not null,

  -- A CSS custom-property NAME from the token layer, never a hex value. A colour literal in a
  -- database row is a colour that does not change when the palette does, and it is the one thing
  -- a person editing a tag should not be able to type.
  colour     text,
  is_enabled boolean not null default true,

  -- The same common set, for the same reason, and the closest precedent is exact:
  -- `research_material_lexicon` is a controlled parsing vocabulary and carries it.
  status     content_status not null default 'DRAFT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),

  -- `slug::text` — `slug` is citext, and citext overloads `~` to the CASE-INSENSITIVE operator, so
  -- the same pattern without the cast admits `Oversized`. The lesson of `0262`, applied at the
  -- point of writing rather than after a review found it.
  constraint research_tags_slug_shape check (slug::text ~ '^[a-z][a-z0-9-]*$'),
  constraint research_tags_label_not_blank check (btrim(label) <> ''),
  constraint research_tags_colour_is_token
    check (colour is null or colour ~ '^--[a-z][a-z0-9-]*$')
);

comment on table research_tags is
  'The controlled vocabulary a merchandiser may tag a research row with. Free text is rejected by the foreign key on research_product_tags. colour names a design token, never a hex value.';

create table research_product_tags (
  research_product_id uuid not null references research_products (id) on delete cascade,
  tag_id              uuid not null references research_tags (id) on delete cascade,
  assigned_by         uuid references auth.users (id),
  assigned_at         timestamptz not null default now(),

  primary key (research_product_id, tag_id)
);

comment on table research_product_tags is
  'Which controlled tags are on which research row. The composite primary key makes assigning a tag twice a no-op rather than a duplicate.';

create index research_product_tags_by_tag_idx on research_product_tags (tag_id);

-- --- 6. The daily digest --------------------------------------------------------------------------
--
-- IDEMPOTENT BY KEY, NOT BY CARE. `digest_date` is unique, so running the job twice for the same
-- day updates the row rather than appending a second one — which matters because the cron route
-- is drained in bounded slices and a retried slice must not double a count somebody reads as a
-- trend.

create table research_change_digests (
  id           uuid primary key default gen_random_uuid(),
  digest_date  date not null unique,
  stats        jsonb not null,
  generated_at timestamptz not null default now(),

  constraint research_change_digests_stats_is_object check (jsonb_typeof(stats) = 'object')
);

comment on table research_change_digests is
  'One row per day: material changes by source and field, products discovered, products that disappeared, and the oldest undecided change. A Studio surface, not an email — outbound notification is Phase 38.';

-- --- 7. The eleven global default rules -----------------------------------------------------------
--
-- SEEDED HERE RATHER THAN IN `content/seed/`, AND THE DISTINCTION IS THE ONE `0260` DREW FOR THE
-- MATERIAL LEXICON: this is a PARSING VOCABULARY, not content. `db:check-migrations` refuses
-- content inserts in a migration and permits configuration rows, because a materiality rule with
-- no row is a detector that classifies nothing, and a system that cannot run until somebody seeds
-- it is a system that will be found broken by whoever first tries to use it.
--
-- THE NUMBERS ARE THE PHASE DOCUMENT'S TABLE, VERBATIM. Where a field has no threshold — any
-- change is MATERIAL — the columns are null rather than 0, because 0 is a threshold that means
-- "everything" and null means "not a question of degree".

-- check-migrations: allow-insert (the eleven thresholds the detector needs in order to classify anything at all, editable in Studio thereafter — configuration, not content)
insert into research_change_rules (source_id, field, material_threshold, minor_threshold, status) values
  -- ≥ 5 % of the previous amount, or any change of price STATE regardless of amount.
  (null, 'price',           0.0500, null,   'PUBLISHED'),
  -- Trigram similarity BELOW 0.90 is material; 0.90–0.99 is minor; whitespace/case only is noise.
  (null, 'title',           0.9000, 0.9900, 'PUBLISHED'),
  (null, 'availability',    null,   null,   'PUBLISHED'),
  -- Any axis moving by ≥ 2 %, or an axis appearing or disappearing.
  (null, 'dimensions_mm',   0.0200, null,   'PUBLISHED'),
  (null, 'variant_count',   null,   null,   'PUBLISHED'),
  (null, 'material_tokens', null,   null,   'PUBLISHED'),
  (null, 'image_urls',      null,   null,   'PUBLISHED'),
  (null, 'lead_time_days',  null,   null,   'PUBLISHED'),
  (null, 'description',     0.8000, 0.9500, 'PUBLISHED'),
  (null, 'customization',   null,   null,   'PUBLISHED'),
  (null, 'sku',             null,   null,   'PUBLISHED');

-- --- 8. RLS on, policies in 0271 ------------------------------------------------------------------
--
-- ON HERE RATHER THAN IN THE GENERATED FILE, because `auth:gen-policies` rewrites `0271` whole on
-- every run and a table left un-enabled between the two migrations is a table with no protection
-- at all — on Supabase, `anon` and `authenticated` hold grants on everything in `public`, so RLS
-- is not an additional layer, it IS the boundary. The same placement as `0260`.

alter table research_changes         enable row level security;
alter table research_change_rules    enable row level security;
alter table research_review_actions  enable row level security;
alter table research_notes           enable row level security;
alter table research_tags            enable row level security;
alter table research_product_tags    enable row level security;
alter table research_change_digests  enable row level security;

-- The two append-only triggers run as SECURITY DEFINER and must not be callable directly.
revoke execute on function public.tg_research_review_actions_append_only() from public, anon, authenticated;
revoke execute on function public.tg_research_notes_append_only() from public, anon, authenticated;
