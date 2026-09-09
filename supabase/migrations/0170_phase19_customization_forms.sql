-- ============================================================================================
-- 0170 — the bespoke brief: four tables that make the questions editable, and no way to price
--
-- WHAT THIS PHASE BUILDS IS A FORM DEFINITION, NOT A FORM. FEAT §15 fixes a sequence of eleven
-- steps and then says "every step configurable from Studio", which only means something if the
-- questions live in rows rather than in JSX. So a step is a row, a field is a row, an option is an
-- element of a jsonb array on that row, and `lib/cms/forms.ts` generates the Zod schema from the
-- same rows the editor edits. Changing what the configurator asks is an editorial act with no
-- deploy, which is the whole point of the phase.
--
-- THERE IS NO PRICE COLUMN, AND THERE IS NO PLACE TO PUT ONE. FEAT §15 says in as many words: do
-- not calculate fake bespoke pricing. D1 forbids checkout entirely. The risk the phase document
-- names is not that somebody adds a price to the public form — nobody would — it is that somebody
-- adds `price_modifier` to a field "just for internal estimating", and six months later a summary
-- renders it. Three things make that hard rather than merely forbidden: no column exists;
-- `customization_form_fields.validation` is constrained to a fixed allowlist of Zod keys, so a
-- surcharge cannot be smuggled in as validation; and `tests/unit/no-pricing.test.ts` greps this
-- file and the configurator directory for price-shaped identifiers.
--
-- THE CONTACT STEP IS PINNED RATHER THAN POLICED, and that decision is the interesting one.
-- The rule is that `contact` may be renamed but never disabled and never moved off the end —
-- without it a brief arrives with nobody to reply to. The obvious implementation is a constraint
-- trigger that REFUSES a write leaving contact anywhere but last. It does not survive contact with
-- the Studio: every Studio write goes through PostgREST, one row per statement per transaction, so
-- reordering ten steps means ten transactions and nine of them are transiently illegal. A
-- deferrable constraint does not help — deferred means "at commit", and each of those statements
-- commits on its own.
--
-- So `normalise_form_step_order()` REPAIRS instead: after any write to the step table it renumbers
-- that form's steps densely, contact last. The invariant becomes true by construction rather than
-- by rejection, a naive one-row-at-a-time reorder can no longer produce an illegal state, and the
-- two rules that genuinely need a refusal — you may not delete the contact step, you may not
-- disable it — stay as single-row refusals where no transient state exists to trip over.
--
-- A FORM WITH NO CONTACT STEP IS A DRAFT, NOT AN ERROR. A blank form has no steps at all and must
-- be creatable; requiring contact from the first INSERT would mean a form could never be built up
-- one step at a time. `enforce_form_publishable()` is where it becomes compulsory: PUBLISHED
-- requires an enabled contact step, a way to reply on it, and no enabled choice field left with an
-- empty option list — a select with nothing in it is a question a visitor cannot answer.
--
-- WHY STEPS AND FIELDS CARRY SEED COLUMNS. SEED §33 requires every field to be renameable, and
-- renaming is exactly what the seed runner must not undo on its next pass. `owner_edited` plus
-- `seed_content_hash` on the child rows is what lets the runner stand down per field rather than
-- per template — otherwise renaming "Finish Preference" would either be reverted on the next run
-- or would freeze the entire template against every future correction.
-- ============================================================================================

set search_path = public, extensions;

-- --- 1. the two vocabularies --------------------------------------------------------------------
create type form_kind as enum ('FURNITURE', 'PRESERVATION', 'THREE_D_RESIN', 'CUSTOM');

comment on type form_kind is
  'Which of the three SEED §33-35 templates a form descends from. CUSTOM is for a form the owner builds from nothing; it is not a fourth template.';

/*
 * `form_field_type` is a RENDERING and VALIDATION contract, not a list of HTML input types.
 * DIMENSION carries a unit and is not a bare NUMBER; COLOUR_DIRECTION is a choice among named
 * directions rather than a colour picker, because Rivya works in directions ("warm amber, low
 * transparency") and a hex value would be a promise about a finish nobody has agreed; and the
 * three CONTACT_* members exist so `enforce_form_publishable()` can ask "is there a way to reply
 * to this?" without pattern-matching on a label an editor is free to rename.
 */
create type form_field_type as enum (
  'TEXT', 'TEXTAREA', 'NUMBER', 'DIMENSION',
  'SELECT', 'MULTISELECT', 'RADIO', 'CHECKBOX',
  'COLOUR_DIRECTION', 'FILE', 'CITY',
  'CONTACT_NAME', 'CONTACT_PHONE', 'CONTACT_EMAIL'
);

-- --- 2. customization_forms ---------------------------------------------------------------------
create table customization_forms (
  id            uuid primary key default gen_random_uuid(),
  slug          citext not null unique,
  name          text not null,
  kind          form_kind not null default 'CUSTOM',
  description   text,
  -- What the configurator says on its first screen, above step one. Distinct from `description`,
  -- which is what the Studio list says ABOUT the form.
  intro_heading text,
  intro_body    text,
  /*
   * The submit button's words, as a `global_content` key rather than as text.
   *
   * D2 puts every visitor-readable string in `global_content`, and this one is already there —
   * `CTA.send_an_enquiry`, seeded in Phase 09 under amendment A3·a. Storing the words here would
   * fork the site's action vocabulary: change the CTA library and eleven forms keep the old verb.
   */
  submit_label_key text,
  -- The form a product or category falls back to when nothing is bound. One per kind at most.
  is_default    boolean not null default false,

  status        content_status not null default 'DRAFT',
  owner_verification  owner_verification not null default 'NOT_REQUIRED',
  fact_classification fact_classification not null default 'EDITORIAL_COPY',

  seed_key             text,
  content_seed_version text,
  seed_content_hash    text,
  seed_last_applied_at timestamptz,
  owner_edited         boolean not null default false,

  published_at  timestamptz,
  published_by  uuid references auth.users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users (id),

  constraint customization_forms_verified_before_publish
    check (status <> 'PUBLISHED' or owner_verification <> 'OWNER_VERIFICATION_REQUIRED'),
  constraint customization_forms_name_present check (btrim(name) <> ''),
  -- `GROUP.key`, the dotted form `lib/cms/strings.ts` reads. A typo here renders no button label at
  -- all rather than an internal identifier, so the pattern is the earliest place to catch it.
  constraint customization_forms_submit_label_key_shape
    check (submit_label_key is null or submit_label_key ~ '^[A-Z][A-Z_]*\.[a-z0-9_.]+$')
);

comment on table customization_forms is
  'A bespoke brief definition: the questions, in order, that /custom-commissions asks. Three arrive seeded from SEED §33-35; an owner may build more. Nothing here prices anything.';
comment on column customization_forms.is_default is
  'The form used when a product has no binding of its own. At most one per kind, enforced by a partial unique index.';
comment on column customization_forms.slug is
  'IMMUTABLE ONCE SEEDED. `?form=<slug>` is a link a product page emits; changing it breaks the link rather than redirecting it.';

create unique index customization_forms_seed_key_idx on customization_forms (seed_key)
  where seed_key is not null;
create unique index customization_forms_one_default_per_kind_idx on customization_forms (kind)
  where is_default;
create index customization_forms_status_idx on customization_forms (status, slug);

alter table customization_forms enable row level security;

-- --- 3. customization_form_steps ----------------------------------------------------------------
create table customization_form_steps (
  id          uuid primary key default gen_random_uuid(),
  form_id     uuid not null references customization_forms (id) on delete cascade,
  /*
   * The eleven FEAT §15 keys. NOT an enum, deliberately: an owner may add a step of their own and
   * an enum would need a migration to allow it. `contact` is the only key the database knows by
   * name, and it knows it because that is the one step whose absence makes a brief unanswerable.
   */
  key         text not null,
  title       text not null,
  description text,
  position    int not null default 1,
  is_enabled  boolean not null default true,
  is_required boolean not null default false,

  seed_key             text,
  content_seed_version text,
  seed_content_hash    text,
  seed_last_applied_at timestamptz,
  owner_edited         boolean not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id),

  constraint customization_form_steps_key_shape check (key ~ '^[a-z][a-z0-9_]*$'),
  constraint customization_form_steps_title_present check (btrim(title) <> ''),
  constraint customization_form_steps_position_positive check (position >= 1),
  -- The contact step may be renamed. It may not be switched off, and the constraint says so on
  -- every row rather than leaving it to the trigger that catches the UPDATE.
  constraint customization_form_steps_contact_enabled
    check (key <> 'contact' or is_enabled),
  constraint customization_form_steps_key_unique unique (form_id, key),
  -- DEFERRABLE because `normalise_form_step_order()` renumbers a whole form in one UPDATE, and an
  -- immediate constraint would reject the intermediate state of that single statement.
  constraint customization_form_steps_position_unique unique (form_id, position)
    deferrable initially deferred,
  -- The target of the composite foreign key on `customization_form_fields`, which is what stops a
  -- field belonging to a step of a different form.
  constraint customization_form_steps_id_form_unique unique (id, form_id)
);

comment on table customization_form_steps is
  'One screen of the configurator. Steps 1-10 may be renamed, reordered, disabled or removed; `contact` may only be renamed, and is always last.';
comment on column customization_form_steps.position is
  'Maintained by normalise_form_step_order(): dense from 1, contact last. Writing a position is a request, not a decision.';

create unique index customization_form_steps_seed_key_idx on customization_form_steps (seed_key)
  where seed_key is not null;
create index customization_form_steps_form_idx on customization_form_steps (form_id, position);

alter table customization_form_steps enable row level security;

-- --- 4. customization_form_fields ---------------------------------------------------------------
create table customization_form_fields (
  id          uuid primary key default gen_random_uuid(),
  form_id     uuid not null references customization_forms (id) on delete cascade,
  step_id     uuid not null,
  key         text not null,
  label       text not null,
  help_text   text,
  placeholder text,
  field_type  form_field_type not null default 'TEXT',
  /*
   * The choices, as `[{"value": "...", "label": "..."}]`. Shape is checked element by element by
   * `enforce_form_field_shape()` rather than by a CHECK, because a CHECK cannot loop over an array.
   */
  options     jsonb not null default '[]'::jsonb,
  /*
   * ZOD KEYS ONLY, AND THE ALLOWLIST IS A CHECK RATHER THAN A CONVENTION.
   *
   * `validation - <allowed keys>` deletes every permitted key and must leave `{}`. So `min`,
   * `maxBytes` and `pattern` are accepted and `price_multiplier`, `surcharge` and `cost_per_mm`
   * are rejected by the same expression that keeps the object Zod-shaped. This is the column a
   * pricing field would arrive through if one ever did, and it is closed at the schema.
   */
  validation  jsonb not null default '{}'::jsonb,
  is_enabled  boolean not null default true,
  is_required boolean not null default false,
  position    int not null default 1,
  -- Phase 20 reads this when it builds the WhatsApp summary. A field may be worth asking and not
  -- worth pasting into a message — a long note, an upload the recipient already has.
  include_in_whatsapp boolean not null default true,

  seed_key             text,
  content_seed_version text,
  seed_content_hash    text,
  seed_last_applied_at timestamptz,
  owner_edited         boolean not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id),

  constraint customization_form_fields_key_shape check (key ~ '^[a-z][a-z0-9_]*$'),
  constraint customization_form_fields_label_present check (btrim(label) <> ''),
  constraint customization_form_fields_position_positive check (position >= 1),
  constraint customization_form_fields_options_is_array check (jsonb_typeof(options) = 'array'),
  constraint customization_form_fields_validation_is_object check (jsonb_typeof(validation) = 'object'),
  constraint customization_form_fields_validation_keys check (
    validation - array[
      'min', 'max', 'step', 'minLength', 'maxLength', 'pattern', 'accept', 'maxFiles', 'maxBytes'
    ] = '{}'::jsonb
  ),
  constraint customization_form_fields_key_unique unique (form_id, key),
  constraint customization_form_fields_position_unique unique (step_id, position)
    deferrable initially deferred,
  -- A field's step must belong to the field's own form. A plain `references
  -- customization_form_steps (id)` would let a field on the furniture form hang off a step of the
  -- preservation one, and every read joining the two would then silently drop it or duplicate it.
  constraint customization_form_fields_step_fk
    foreign key (step_id, form_id) references customization_form_steps (id, form_id)
    on delete cascade
);

comment on table customization_form_fields is
  'One question. Every row supports the SEED §33 contract: enabled, disabled, required, optional, reordered, renamed. No column here prices, costs or surcharges anything.';
comment on column customization_form_fields.validation is
  'Zod-shaped only, enforced by an allowlist CHECK. This is where a price multiplier would be smuggled in, so the allowlist is the closed door.';

create unique index customization_form_fields_seed_key_idx on customization_form_fields (seed_key)
  where seed_key is not null;
create index customization_form_fields_step_idx on customization_form_fields (step_id, position);
create index customization_form_fields_form_idx on customization_form_fields (form_id);

alter table customization_form_fields enable row level security;

-- --- 5. product_customization_forms --------------------------------------------------------------
create table product_customization_forms (
  id          uuid primary key default gen_random_uuid(),
  form_id     uuid not null references customization_forms (id) on delete cascade,
  product_id  uuid references products (id) on delete cascade,
  category_id uuid references categories (id) on delete cascade,
  position    int not null default 1,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id),

  -- Exactly one target. A row with both would be ambiguous about which binding won; a row with
  -- neither would bind the form to nothing and sit there looking like a binding.
  constraint product_customization_forms_one_target
    check (num_nonnulls(product_id, category_id) = 1)
);

comment on table product_customization_forms is
  'Binds a form to a product or a category. A product binding wins over its category binding; with neither, the default form for the kind applies.';

create unique index product_customization_forms_product_idx
  on product_customization_forms (product_id, form_id) where product_id is not null;
create unique index product_customization_forms_category_idx
  on product_customization_forms (category_id, form_id) where category_id is not null;
create index product_customization_forms_form_idx on product_customization_forms (form_id);

alter table product_customization_forms enable row level security;

-- --- 6. the revision trail covers form definitions ------------------------------------------------
--
-- The phase document's risk table says field changes are versioned through `content_revisions`,
-- and that table's `entity_type` is a closed CHECK rather than free text — so the three new types
-- have to be admitted here or every write would fail inside the trigger. Naming them is also what
-- makes `cms_restore_revision()` able to roll a form back, which is the reason the builder can warn
-- about a required field added to a bound form and still be recoverable if somebody ignores it.
alter table content_revisions drop constraint content_revisions_entity_type_allowed;
alter table content_revisions add constraint content_revisions_entity_type_allowed
  check (entity_type in (
    'page', 'page_section', 'navigation_item', 'global_content', 'faq',
    'customization_form', 'customization_form_step', 'customization_form_field'
  ));

-- --- 6b. write_revision() learns that not every versioned row has a status ---------------------------
--
-- FOUND BY THE FIRST WRITE TO `customization_form_steps`, and worth recording because the failure
-- mode is the one Phase 17 already hit once: plpgsql resolves a record field at EXECUTION, so
-- `old.status is distinct from new.status` compiles against every table and raises
-- `record "old" has no field "status"` on the first UPDATE to a table that has no such column.
-- Steps and fields have `is_enabled`, not `status` — a question is switched on or off, it is not
-- drafted, reviewed and published on its own.
--
-- The fix asks the row rather than the writer: `to_jsonb(old) -> 'status'` is NULL for a table
-- without the column, so the comparison is false and the action falls through to UPDATE. For the
-- five tables that have carried this trigger since Phase 08 the semantics are unchanged — a jsonb
-- string compares exactly as the enum did — which is what makes replacing the shipped function
-- safe rather than a rewrite of their history.
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
  v_action := nullif(current_setting('rivya.revision_action', true), '');

  if v_action is null then
    if tg_op = 'INSERT' then
      v_action := 'CREATE';
    elsif (to_jsonb(old) -> 'status') is distinct from (to_jsonb(new) -> 'status') then
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

  v_snapshot := to_jsonb(new) - 'updated_at' - 'seed_last_applied_at';

  -- check-migrations: allow-insert (a trigger body, not a seeded row — this is the audit trail)
  insert into content_revisions (entity_type, entity_id, revision_no, action, snapshot, created_by)
  values (v_entity_type, new.id, v_next, v_action, v_snapshot, new.updated_by);

  return new;
end;
$$;

revoke execute on function public.write_revision() from public, anon, authenticated;

comment on function public.write_revision() is
  'Appends an immutable snapshot per mutation. SECURITY DEFINER because content_revisions has no write policy for any session role. Reads `status` through to_jsonb so it can also version tables that have none.';

-- --- 7. normalise_form_step_order() ----------------------------------------------------------------
--
-- See the header. This is the mechanism that makes "contact is last" true rather than merely
-- required, and it is what lets the Studio reorder steps one PostgREST statement at a time without
-- ever passing through a state the database would reject.
--
-- SECURITY DEFINER because it renumbers rows the caller may not hold an UPDATE policy for — a
-- merchandiser adding a step must not be refused a renumber of the steps around it — and because
-- an invoker-rights renumber would silently update zero rows under RLS and leave the order wrong
-- with no error at all.
create or replace function public.normalise_form_step_order() returns trigger
  language plpgsql
  security definer
  set search_path = pg_catalog, public
  as $$
declare
  v_form_id uuid;
begin
  -- The UPDATE below fires this same trigger once per renumbered row. Without the guard the first
  -- write recurses until the stack limit.
  if pg_trigger_depth() > 1 then
    return null;
  end if;

  if tg_op = 'DELETE' then
    v_form_id := old.form_id;
  else
    v_form_id := new.form_id;
  end if;

  -- A cascade from `customization_forms` removes the parent first, so there is nothing left to
  -- order. Renumbering here would be a write against a row that is already gone.
  if not exists (select 1 from customization_forms where id = v_form_id) then
    return null;
  end if;

  with ordered as (
    select id,
           row_number() over (
             -- `false` sorts before `true`, so the contact step lands last whatever position an
             -- editor typed for it. `created_at, id` after `position` so that two steps sharing a
             -- position resolve the same way every time rather than by scan order.
             order by (key = 'contact'), position, created_at, id
           ) as n
      from customization_form_steps
     where form_id = v_form_id
  )
  update customization_form_steps s
     set position = ordered.n
    from ordered
   where s.id = ordered.id
     and s.position is distinct from ordered.n;

  return null;
end $$;

revoke execute on function public.normalise_form_step_order() from public, anon, authenticated;

comment on function public.normalise_form_step_order() is
  'Renumbers a form''s steps densely with `contact` last after every write. Repairs rather than refuses, because a Studio reorder is one PostgREST statement per row and every intermediate state would otherwise be illegal.';

create trigger trg_customization_form_steps_normalise
  after insert or update or delete on public.customization_form_steps
  for each row execute function public.normalise_form_step_order();

-- --- 8. the contact step cannot be removed ----------------------------------------------------------
--
-- Disabling it is refused by a CHECK on the row itself. Deleting it needs a trigger, because there
-- is no row left to check.
create or replace function public.enforce_contact_step_kept() returns trigger
  language plpgsql
  security definer
  set search_path = pg_catalog, public
  as $$
begin
  if old.key <> 'contact' then
    return old;
  end if;

  -- Deleting the whole form takes its steps with it. The parent row is already gone by the time
  -- the cascade reaches here, which is exactly how this tells the two cases apart: without it the
  -- only way to delete a form would be to delete its contact step first, which is what this
  -- function refuses.
  if not exists (select 1 from customization_forms where id = old.form_id) then
    return old;
  end if;

  raise exception
    'The contact step cannot be removed from a customization form. Without it a brief arrives with no way to reply to it. Rename it if the wording is wrong.'
    using errcode = 'check_violation';
end $$;

revoke execute on function public.enforce_contact_step_kept() from public, anon, authenticated;

create trigger trg_customization_form_steps_contact_kept
  before delete on public.customization_form_steps
  for each row execute function public.enforce_contact_step_kept();

-- --- 9. enforce_form_field_shape() -------------------------------------------------------------------
--
-- What a CHECK cannot say: every element of `options` is an object carrying a string `value` and a
-- string `label`. A malformed option renders as a blank line in a select — a choice a visitor can
-- pick and nobody can read — so it is refused at the write rather than tolerated at the render.
create or replace function public.enforce_form_field_shape() returns trigger
  language plpgsql
  security definer
  set search_path = pg_catalog, public
  as $$
declare
  v_option jsonb;
begin
  for v_option in select jsonb_array_elements(new.options) loop
    if jsonb_typeof(v_option) <> 'object'
       or jsonb_typeof(v_option -> 'value') <> 'string'
       or jsonb_typeof(v_option -> 'label') <> 'string'
       or btrim(v_option ->> 'label') = ''
       or btrim(v_option ->> 'value') = '' then
      raise exception
        'Field "%" has a malformed option. Every option must be {"value": "...", "label": "..."} with both non-empty.',
        new.key
        using errcode = 'check_violation';
    end if;
  end loop;

  return new;
end $$;

revoke execute on function public.enforce_form_field_shape() from public, anon, authenticated;

create trigger trg_customization_form_fields_shape
  before insert or update on public.customization_form_fields
  for each row execute function public.enforce_form_field_shape();

-- --- 10. enforce_form_publishable() ------------------------------------------------------------------
--
-- The gate, and it fires only on the transition into PUBLISHED. A form under construction is
-- allowed to be incomplete in every one of these ways; a form on the public site is not.
--
-- WHAT IT DOES NOT CHECK is as considered as what it does. It does not require any particular step
-- to exist, does not require a minimum number of questions, and does not judge wording — those are
-- editorial decisions, and a trigger refusing publication for reasons an editor cannot predict is
-- worse than one that refuses for three they can.
create or replace function public.enforce_form_publishable() returns trigger
  language plpgsql
  security definer
  set search_path = pg_catalog, public
  as $$
declare
  v_contact_id uuid;
  v_broken text;
begin
  if new.status <> 'PUBLISHED' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'PUBLISHED' and new.status = 'PUBLISHED' then
    return new;
  end if;

  select id into v_contact_id
    from customization_form_steps
   where form_id = new.id and key = 'contact' and is_enabled;

  if v_contact_id is null then
    raise exception
      'Form "%" cannot be published without an enabled contact step. A brief with no contact step arrives with nobody to reply to.',
      new.slug
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from customization_form_fields
     where step_id = v_contact_id
       and is_enabled
       and field_type in ('CONTACT_PHONE', 'CONTACT_EMAIL')
  ) then
    raise exception
      'Form "%" cannot be published: its contact step asks for no phone number and no email address, so a completed brief could not be answered.',
      new.slug
      using errcode = 'check_violation';
  end if;

  -- An enabled choice field with no choices is a question that cannot be answered. It is also the
  -- exact shape a half-finished template takes, which is why it is caught here rather than left to
  -- render as an empty select on the public site.
  select string_agg(key, ', ' order by key) into v_broken
    from customization_form_fields
   where form_id = new.id
     and is_enabled
     and field_type in ('SELECT', 'MULTISELECT', 'RADIO', 'COLOUR_DIRECTION')
     and jsonb_array_length(options) = 0;

  if v_broken is not null then
    raise exception
      'Form "%" cannot be published: the choice fields % have no options, so a visitor would see a control with nothing in it.',
      new.slug, v_broken
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

revoke execute on function public.enforce_form_publishable() from public, anon, authenticated;

comment on function public.enforce_form_publishable() is
  'Refuses PUBLISHED for a form with no enabled contact step, no way to reply on it, or an enabled choice field carrying no options.';

create trigger trg_customization_forms_publishable
  before insert or update on public.customization_forms
  for each row execute function public.enforce_form_publishable();

-- --- 11. ordering as one statement ----------------------------------------------------------------
--
-- `normalise_form_step_order()` guarantees the ORDER IS LEGAL; these two say what it should BE.
-- Positions are assigned from the array's order in a single statement, so the Studio's reorder is
-- one call rather than N writes racing each other's renumbering.
--
-- The contact step's place in the array is ignored: it is last because it is contact, and an
-- ordering that pretended otherwise would be silently corrected a moment later anyway.
create or replace function public.cms_set_form_step_order(p_form_id uuid, p_step_ids uuid[])
  returns void
  language plpgsql
  security invoker
  set search_path = pg_catalog, public
  as $$
declare
  v_touched int;
begin
  update customization_form_steps s
     set position = ranked.n
    from (
      select requested.step_id,
             -- Contact last, here as well as in the normaliser. Doing it in both places is not
             -- belt-and-braces: if this statement wrote contact into the middle, the normaliser
             -- would immediately correct it, and every one of those corrections is an UPDATE that
             -- appends another revision. Ranking it correctly the first time makes the repair pass
             -- a no-op and halves the history a single reorder writes.
             row_number() over (order by (st.key = 'contact'), requested.ordinality) as n
        from unnest(p_step_ids) with ordinality as requested(step_id, ordinality)
        join customization_form_steps st
          on st.id = requested.step_id and st.form_id = p_form_id
    ) ranked
   where s.id = ranked.step_id
     and s.form_id = p_form_id;

  get diagnostics v_touched = row_count;

  /*
   * SECURITY INVOKER, AND THEN A READ-BACK, because RLS FILTERS AN UPDATE — IT DOES NOT REFUSE
   * ONE. A caller without `catalog.write` matches zero rows, gets no error, and would be told the
   * order was saved. Definer rights would have removed the question by removing the check, at the
   * cost of hard-coding the matrix's role list into a hand-written migration where it could drift
   * from lib/auth/permissions.ts. Counting what actually moved keeps the policy the only copy.
   *
   * The UPDATE deliberately writes every row rather than only the ones whose position changed: the
   * count is the check, and filtering no-ops would make "three rows were already right" look
   * identical to "three rows were refused".
   */
  if v_touched <> array_length(p_step_ids, 1) then
    raise exception
      'Reordering the steps of form % changed % of % rows. Either a step id does not belong to this form, or this session may not write the catalogue.',
      p_form_id, v_touched, array_length(p_step_ids, 1)
      using errcode = 'insufficient_privilege';
  end if;
end $$;

comment on function public.cms_set_form_step_order(uuid, uuid[]) is
  'Assigns step positions from array order in one statement, with `contact` forced last so normalise_form_step_order() has nothing to repair.';

revoke execute on function public.cms_set_form_step_order(uuid, uuid[]) from public, anon;

create or replace function public.cms_set_form_field_order(p_step_id uuid, p_field_ids uuid[])
  returns void
  language plpgsql
  security invoker
  set search_path = pg_catalog, public
  as $$
declare
  v_touched int;
begin
  update customization_form_fields f
     set position = requested.ordinality::int
    from unnest(p_field_ids) with ordinality as requested(field_id, ordinality)
   where f.id = requested.field_id
     and f.step_id = p_step_id;

  get diagnostics v_touched = row_count;

  -- Same read-back, same reason. No field is pinned the way `contact` is, so array order is the
  -- whole answer here.
  if v_touched <> array_length(p_field_ids, 1) then
    raise exception
      'Reordering the fields of step % changed % of % rows. Either a field id does not belong to this step, or this session may not write the catalogue.',
      p_step_id, v_touched, array_length(p_field_ids, 1)
      using errcode = 'insufficient_privilege';
  end if;
end $$;

revoke execute on function public.cms_set_form_field_order(uuid, uuid[]) from public, anon;

-- --- 12. updated_at, owner_edited and the revision trail --------------------------------------------
create trigger customization_forms_set_updated_at
  before update on public.customization_forms
  for each row execute function public.set_updated_at();
create trigger customization_form_steps_set_updated_at
  before update on public.customization_form_steps
  for each row execute function public.set_updated_at();
create trigger customization_form_fields_set_updated_at
  before update on public.customization_form_fields
  for each row execute function public.set_updated_at();

create trigger customization_forms_set_owner_edited
  before insert or update on public.customization_forms
  for each row execute function public.set_owner_edited();
create trigger customization_form_steps_set_owner_edited
  before insert or update on public.customization_form_steps
  for each row execute function public.set_owner_edited();
create trigger customization_form_fields_set_owner_edited
  before insert or update on public.customization_form_fields
  for each row execute function public.set_owner_edited();

create trigger customization_forms_write_revision
  after insert or update on public.customization_forms
  for each row execute function public.write_revision('customization_form');
create trigger customization_form_steps_write_revision
  after insert or update on public.customization_form_steps
  for each row execute function public.write_revision('customization_form_step');
create trigger customization_form_fields_write_revision
  after insert or update on public.customization_form_fields
  for each row execute function public.write_revision('customization_form_field');
