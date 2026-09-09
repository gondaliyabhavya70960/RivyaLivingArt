-- ============================================================================================
-- 0190 — `inquiries`, `inquiry_attachments`, `inquiry_events`: where the funnel ends
--
-- THE NUMBER IS NOT THE PHASE DOCUMENT'S. PHASE-16-22 assigns Phase 20 `0180`–`0182`; all three
-- were spent while Phase 19 was being finished — `0180` marks demonstration content, `0181` fixes
-- the publication date a status trigger failed to carry, and `0182`/`0183` bring the rate limiter
-- forward for the unauthenticated upload endpoint. Renumbering those would reorder the apply
-- sequence relative to migrations that have already run on two databases. Phase 20 therefore takes
-- `0190`–`0192`, recorded as amendment A20 and re-registered in DATA_MODEL §12.
--
-- D1 IS THE WHOLE DESIGN OF THIS TABLE. There is no order, no cart, no payment and no customer
-- account, and there is no column here that could become one. An enquiry is a message with a
-- reference code; everything after it happens in a conversation.
--
-- THE REFERENCE CODE IS ALLOCATED BY A TRIGGER, NOT BY THE APPLICATION, and the trigger OVERWRITES
-- whatever arrived. Two reasons, and the second is the one that matters. The first is atomicity: a
-- code allocated in the same statement as the insert cannot be handed out for a row that then fails
-- to write. The second is that the public insert comes from an ANONYMOUS session — the visitor is
-- nobody, by design — and a code a caller could choose is a code a caller could collide, or
-- enumerate, or use to claim somebody else's enquiry in a WhatsApp message.
--
-- `pipeline_status` IS NOT `content_status`, AND THAT IS A DECLARED DEVIATION FROM D5. An enquiry is
-- not content: it is never published, never scheduled, never revised and never verified. It moves
-- through a sales pipeline — the same deviation `activity_events` made in Phase 05, recorded in
-- DATA_MODEL §1.4.
--
-- STORAGE MINIMISATION IS A CONSTRAINT, NOT A PREFERENCE. No raw IP: `ip_hash` is a salted hash
-- written by the application, and the CHECK below makes an address stored here fail loudly rather
-- than sit in the column looking like a hash. No cookies beyond the session, no fingerprinting, no
-- third-party captcha.
-- ============================================================================================

set search_path = public, extensions;

-- --- 1. Enums --------------------------------------------------------------------------------

-- The five D4 inbox views. GENERAL is the contact form, which has no view of its own and is
-- surfaced under *All* — a sixth sidebar entry for "the ones that are not the other four" would be
-- a view nobody navigates to on purpose.
create type inquiry_kind as enum ('PRODUCT', 'COMMISSION', 'CONSULTATION', 'QUOTE', 'GENERAL');

comment on type inquiry_kind is
  'Which surface produced the enquiry. Decides the D4 view it appears in and which WhatsApp template renders it.';

/*
 * The pipeline. NOT a content workflow: an enquiry is never published.
 *
 * SPAM IS A STATUS RATHER THAN A DELETE, because a deleted enquiry cannot be un-deleted when the
 * judgement was wrong, and "we never received it" is the worst answer a studio can give a customer
 * who did send one. ARCHIVED is the same idea for a conversation that simply ended.
 */
create type inquiry_status as enum (
  'NEW', 'READ', 'IN_CONVERSATION', 'QUOTED', 'WON', 'LOST', 'SPAM', 'ARCHIVED'
);

comment on type inquiry_status is
  'The sales pipeline. Deliberately not content_status: an enquiry is never published, scheduled or verified.';

/*
 * What happened to the handoff.
 *
 * UNAVAILABLE IS THE HONEST STATE AND IT EXISTS ON PURPOSE. If no WhatsApp number resolves — the
 * `global_content` row is missing or unverified and the environment variable is unset — the enquiry
 * is still SAVED and the visitor is still shown their reference code and the studio's contact
 * details. Refusing to store the enquiry because a link could not be built would lose the one thing
 * that matters to keep.
 */
create type whatsapp_state as enum ('NOT_SENT', 'REDIRECTED', 'SHORTENED', 'UNAVAILABLE');

comment on type whatsapp_state is
  'Whether the visitor was handed off, and whether the message had to be shortened to fit. UNAVAILABLE means the enquiry was saved and no number resolved.';

create type inquiry_event_kind as enum (
  'CREATED', 'WHATSAPP_REDIRECT', 'VIEWED', 'STATUS_CHANGED', 'NOTE_ADDED', 'ASSIGNED', 'EXPORTED'
);

-- --- 2. The reference code -------------------------------------------------------------------

/*
 * `RIV-<yyyy>-<six digits>`.
 *
 * ONE SEQUENCE, NOT ONE PER YEAR, and it does not reset. A per-year reset needs either a table of
 * counters — which serialises every insert behind one row lock — or a `create sequence` at each new
 * year, which is a migration nobody will remember to write on the 1st of January. The year in the
 * code is the year the enquiry arrived, which is what it is for; the digits are simply unique.
 *
 * SIX DIGITS IS A MINIMUM WIDTH, NOT A CEILING. `FM000000` pads below a million and prints the true
 * value above it, so the millionth enquiry gets a seven-digit code rather than a duplicate.
 */
create sequence inquiry_reference_seq as bigint start with 1 increment by 1 no cycle;

comment on sequence inquiry_reference_seq is
  'Feeds reference_code. Never reset: a year boundary changes the prefix, not the counter.';

create or replace function public.allocate_inquiry_reference() returns trigger
  language plpgsql
  security definer
  set search_path = pg_catalog, public
  as $$
begin
  -- OVERWRITES rather than defaults. The public insert is anonymous, so a caller-supplied code is
  -- a code a caller chose — and a chosen code can collide with, or impersonate, somebody else's.
  new.reference_code := 'RIV-' || to_char(now(), 'YYYY') || '-' ||
                        to_char(nextval('inquiry_reference_seq'), 'FM000000');
  return new;
end $$;

comment on function public.allocate_inquiry_reference() is
  'Allocates reference_code in the inserting statement, overwriting anything supplied. The public insert is anonymous, so the code cannot be a caller''s choice.';

revoke execute on function public.allocate_inquiry_reference() from public, anon, authenticated;

-- --- 3. `inquiries` --------------------------------------------------------------------------

create table inquiries (
  id             uuid primary key default gen_random_uuid(),
  reference_code text not null unique,
  kind           inquiry_kind not null,
  pipeline_status inquiry_status not null default 'NEW',

  -- Which D3 route produced it. Useful to the studio and to nobody else; it is not rendered.
  source_path    text,

  product_id             uuid references products (id) on delete set null,
  collection_id          uuid references collections (id) on delete set null,
  customization_form_id  uuid references customization_forms (id) on delete set null,

  -- A name and a phone number are the two things without which the studio cannot reply. Email is
  -- optional because SEED §22 makes it optional: a customer who gives a number has given enough.
  name  text not null,
  phone text not null,
  email citext,
  city  text,
  message text,

  -- The configurator's answers, field key to value. `{}` for a contact-form enquiry, which asks no
  -- configured questions.
  answers jsonb not null default '{}'::jsonb,

  -- SEED §22's eight enquiry types. Free text rather than an enum: the list is editorial and
  -- changing it should not be a migration.
  enquiry_type text,

  whatsapp_state whatsapp_state not null default 'NOT_SENT',
  -- Which rung of the five-level ladder fired, or null if the message fitted as rendered.
  whatsapp_shortened_at_level int,

  consent_contact boolean not null default true,

  referrer   text,
  utm        jsonb,
  /*
   * A SALTED HASH, NEVER AN ADDRESS. SECURITY.md forbids storing a raw visitor IP and
   * `rate_limit_buckets` says the same in its own comment. The CHECK does not make the value a
   * hash — the application does that — but it makes an address written here by mistake fail at the
   * insert rather than sit in the column for a year looking like a hash.
   */
  ip_hash    text,
  user_agent text,

  assigned_to uuid references auth.users (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),

  constraint inquiries_name_present check (btrim(name) <> ''),
  constraint inquiries_phone_present check (btrim(phone) <> ''),
  constraint inquiries_reference_shape check (reference_code ~ '^RIV-[0-9]{4}-[0-9]{6,}$'),
  constraint inquiries_answers_is_object check (jsonb_typeof(answers) = 'object'),
  constraint inquiries_utm_is_object check (utm is null or jsonb_typeof(utm) = 'object'),
  constraint inquiries_ip_hash_is_hash check (ip_hash is null or ip_hash ~ '^[a-f0-9]{64}$'),
  constraint inquiries_shorten_level_range check (
    whatsapp_shortened_at_level is null
    or whatsapp_shortened_at_level between 1 and 5
  ),
  /*
   * A PRODUCT ENQUIRY NAMES A PRODUCT AND A COMMISSION NAMES A FORM. Not enforced the other way —
   * a commission may legitimately start from a product page, and a QUOTE may name either — but an
   * enquiry filed under PRODUCT with no product is a row nobody can act on.
   */
  constraint inquiries_product_kind_has_product check (kind <> 'PRODUCT' or product_id is not null)
);

comment on table inquiries is
  'The conversion record. There is no next table: D1 forbids an order, a cart, a payment and a customer account.';
comment on column inquiries.id is
  'SUPPLIED BY THE APPLICATION, not defaulted in practice. anon has no SELECT policy, and PostgreSQL applies the SELECT policy to an INSERT ... RETURNING — so the public write path cannot read back the row it just created. It generates the uuid, inserts with it, and asks inquiry_reference_code() for the code.';
comment on column inquiries.pipeline_status is
  'DECLARED DEVIATION from D5. An enquiry is not content — never published, scheduled, revised or verified — so it carries a sales pipeline instead of content_status. Same deviation as activity_events (DATA_MODEL §1.4).';
comment on column inquiries.ip_hash is
  'A SALTED HASH of the caller address, never an address. The CHECK makes a raw IP fail at the insert.';
comment on column inquiries.answers is
  'The configurator''s field key to value map. Fields carrying include_in_whatsapp = false live here and never enter a message.';

create index inquiries_pipeline_idx on inquiries (pipeline_status, created_at desc);
create index inquiries_kind_idx on inquiries (kind, created_at desc);
create index inquiries_assigned_idx on inquiries (assigned_to, pipeline_status);
create index inquiries_product_idx on inquiries (product_id) where product_id is not null;
-- The rate limiter reads by hash and window; the inbox never does.
create index inquiries_ip_hash_idx on inquiries (ip_hash, created_at) where ip_hash is not null;

alter table inquiries enable row level security;

create trigger inquiries_allocate_reference
  before insert on public.inquiries
  for each row execute function public.allocate_inquiry_reference();

create trigger inquiries_set_updated_at
  before update on public.inquiries
  for each row execute function public.set_updated_at();

-- --- 4. `inquiry_attachments` ------------------------------------------------------------------

/*
 * The visitor's reference images.
 *
 * THE ASSET ROW IS CREATED AT SUBMIT, NOT AT UPLOAD. `app/api/inquiries/upload-sign` signs a folder
 * before the browser has a public_id, so a `media_assets` row minted there would name an object
 * that may never exist. Its own comment says Phase 20 does this; this is Phase 20 doing it.
 */
create table inquiry_attachments (
  inquiry_id     uuid not null references inquiries (id) on delete cascade,
  media_asset_id uuid not null references media_assets (id) on delete cascade,
  position       int not null default 1,
  created_at     timestamptz not null default now(),

  primary key (inquiry_id, media_asset_id),
  constraint inquiry_attachments_position_positive check (position >= 1)
);

comment on table inquiry_attachments is
  'Visitor reference images. The asset rows are USER_UPLOAD/DRAFT and are never returned by a public read path.';

create index inquiry_attachments_asset_idx on inquiry_attachments (media_asset_id);

alter table inquiry_attachments enable row level security;

-- --- 5. `inquiry_events` -----------------------------------------------------------------------

/*
 * Append-only, and enforced rather than intended.
 *
 * An event log that can be edited is a log that cannot answer "what actually happened", which is
 * the only question it exists for. The trigger below refuses UPDATE and DELETE for every role
 * including the owner's session; correcting a mistaken entry means appending the correction.
 */
create table inquiry_events (
  id          uuid primary key default gen_random_uuid(),
  inquiry_id  uuid not null references inquiries (id) on delete cascade,
  event       inquiry_event_kind not null,
  actor_id    uuid references auth.users (id) on delete set null,
  from_status inquiry_status,
  to_status   inquiry_status,
  note        text,
  metadata    jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),

  constraint inquiry_events_metadata_is_object check (jsonb_typeof(metadata) = 'object'),
  -- A status change that does not say what changed is not a record of a status change.
  constraint inquiry_events_status_change_complete check (
    event <> 'STATUS_CHANGED' or (from_status is not null and to_status is not null)
  )
);

comment on table inquiry_events is
  'Append-only timeline. UPDATE and DELETE are refused by trigger for every role: a log that can be edited cannot answer what happened.';

create index inquiry_events_inquiry_idx on inquiry_events (inquiry_id, occurred_at desc);

alter table inquiry_events enable row level security;

create or replace function public.reject_inquiry_event_mutation() returns trigger
  language plpgsql
  security definer
  set search_path = pg_catalog, public
  as $$
begin
  raise exception
    'inquiry_events is append-only. Correct a mistaken entry by appending the correction, not by rewriting the record.'
    using errcode = 'restrict_violation';
end $$;

revoke execute on function public.reject_inquiry_event_mutation() from public, anon, authenticated;

create trigger inquiry_events_append_only
  before update or delete on public.inquiry_events
  for each row execute function public.reject_inquiry_event_mutation();

-- --- 6. The two triggers that write the timeline -----------------------------------------------

create or replace function public.log_inquiry_created() returns trigger
  language plpgsql
  security definer
  set search_path = pg_catalog, public
  as $$
begin
  -- check-migrations: allow-insert (a function body, not a seeded row — this writes the timeline)
  insert into inquiry_events (inquiry_id, event, to_status, metadata)
  values (
    new.id,
    'CREATED',
    new.pipeline_status,
    jsonb_build_object('kind', new.kind, 'source_path', new.source_path)
  );
  return null;
end $$;

comment on function public.log_inquiry_created() is
  'Writes the CREATED event in the inserting transaction, so an enquiry cannot exist without the row that says when it arrived.';

revoke execute on function public.log_inquiry_created() from public, anon, authenticated;

create trigger inquiries_log_created
  after insert on public.inquiries
  for each row execute function public.log_inquiry_created();

create or replace function public.log_inquiry_status_change() returns trigger
  language plpgsql
  security definer
  set search_path = pg_catalog, public
  as $$
begin
  if new.pipeline_status is distinct from old.pipeline_status then
    -- check-migrations: allow-insert (a function body, not a seeded row — this writes the timeline)
    insert into inquiry_events (inquiry_id, event, actor_id, from_status, to_status)
    values (new.id, 'STATUS_CHANGED', auth.uid(), old.pipeline_status, new.pipeline_status);
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    -- check-migrations: allow-insert (a function body, not a seeded row — this writes the timeline)
    insert into inquiry_events (inquiry_id, event, actor_id, metadata)
    values (
      new.id,
      'ASSIGNED',
      auth.uid(),
      jsonb_build_object('assigned_to', new.assigned_to)
    );
  end if;

  return null;
end $$;

comment on function public.log_inquiry_status_change() is
  'Writes STATUS_CHANGED and ASSIGNED from the row itself, so a change made through PostgREST is recorded as surely as one made through the Studio.';

revoke execute on function public.log_inquiry_status_change() from public, anon, authenticated;

create trigger inquiries_log_status_change
  after update on public.inquiries
  for each row execute function public.log_inquiry_status_change();

-- --- 7. The three functions the anonymous submit path needs ------------------------------------

/*
 * Was an enquiry with this id created in the last ten minutes and not yet triaged?
 *
 * SECURITY DEFINER BECAUSE `anon` CANNOT READ `inquiries` AT ALL, which is the point of the table's
 * RLS. The two functions below need to know that the row they are about to touch is the one the
 * caller has just created, and this is the narrowest thing that answers it: a boolean, gated on a
 * uuid the caller must already hold, expiring in ten minutes.
 */
create or replace function public.inquiry_is_fresh(p_inquiry_id uuid) returns boolean
  language sql
  stable
  security definer
  set search_path = pg_catalog, public
  as $$
  select exists (
    select 1 from inquiries
     where id = p_inquiry_id
       and pipeline_status = 'NEW'
       and created_at > now() - interval '10 minutes'
  );
$$;

revoke execute on function public.inquiry_is_fresh(uuid) from public;
grant execute on function public.inquiry_is_fresh(uuid) to anon, authenticated, service_role;

/**
 * The reference code of an enquiry that was just created.
 *
 * THIS FUNCTION EXISTS BECAUSE `INSERT ... RETURNING` DOES NOT WORK FOR `anon`, AND FINDING THAT
 * OUT IS WHY IT IS WORTH A PARAGRAPH. PostgreSQL applies a table's SELECT policy to the RETURNING
 * clause of an INSERT, not only to a SELECT — so on a table with an insert policy and no select
 * policy, the insert succeeds and the RETURNING is refused, with the message
 * `new row violates row-level security policy`, which reads exactly like a rejected write. The
 * write was fine. The read of what was written was not, and that is the correct behaviour: `anon`
 * must not read `inquiries`, not even its own row, because "its own row" is a claim the database
 * has no way to check.
 *
 * SO THE APPLICATION SUPPLIES THE `id` AND ASKS FOR THE CODE. The uuid is generated before the
 * insert, which the caller then already holds; the code is allocated by a trigger, which the caller
 * cannot see. This returns exactly that one string, and only for an enquiry created in the last ten
 * minutes and not yet triaged — so it cannot be used to walk the table even by somebody who has
 * guessed a uuid, and cannot be used at all a day later.
 */
create or replace function public.inquiry_reference_code(p_inquiry_id uuid) returns text
  language sql
  stable
  security definer
  set search_path = pg_catalog, public
  as $$
  select reference_code from inquiries
   where id = p_inquiry_id
     and pipeline_status = 'NEW'
     and created_at > now() - interval '10 minutes';
$$;

comment on function public.inquiry_reference_code(uuid) is
  'The reference code of a freshly created enquiry, by id. Exists because anon has no SELECT policy and PostgreSQL applies the SELECT policy to INSERT ... RETURNING.';

revoke execute on function public.inquiry_reference_code(uuid) from public;
grant execute on function public.inquiry_reference_code(uuid) to anon, authenticated, service_role;

/**
 * Turn the visitor's uploaded references into asset rows and attach them.
 *
 * ONE FUNCTION RATHER THAN AN `anon` INSERT POLICY ON `inquiry_attachments`, and the reason is
 * mechanical rather than stylistic: an attachment references a `media_assets` row, `anon` cannot
 * create one — Phase 06's policies do not admit it and should not — so an anon insert policy on the
 * join table would describe a path with no way to satisfy its foreign key. Recorded as amendment
 * A20 against the phase document's "anon has INSERT on inquiries and inquiry_attachments".
 *
 * THE FOLDER PREFIX IS CHECKED HERE AS WELL AS AT THE SIGNATURE. `upload-sign` mints
 * `rivya/inquiries/incoming/<uuid>` and signs it, so a credential cannot write elsewhere — but this
 * function is called with a public_id from the browser, and a browser can send any string. Without
 * this test a caller could attach any object in the Cloudinary account, including brand media, to
 * their own enquiry and have the Studio render it.
 *
 * IT IS IDEMPOTENT AND IT IS BOUNDED. Five references, matching the endpoint's own ceiling; a sixth
 * is ignored rather than refused, because a visitor who has already had their brief accepted should
 * not lose it over an extra image.
 */
create or replace function public.attach_inquiry_references(
  p_inquiry_id uuid,
  p_references jsonb
) returns int
  language plpgsql
  security definer
  set search_path = pg_catalog, public
  as $$
declare
  v_ref      jsonb;
  v_public   text;
  v_filename text;
  v_asset_id uuid;
  v_count    int := 0;
begin
  if not public.inquiry_is_fresh(p_inquiry_id) then
    raise exception 'No enquiry was created recently under that reference.'
      using errcode = 'no_data_found';
  end if;

  if jsonb_typeof(p_references) <> 'array' then
    raise exception 'References must be an array of {publicId, filename}.'
      using errcode = 'invalid_parameter_value';
  end if;

  for v_ref in select jsonb_array_elements(p_references) loop
    exit when v_count >= 5;

    v_public   := v_ref ->> 'publicId';
    v_filename := coalesce(nullif(btrim(coalesce(v_ref ->> 'filename', '')), ''), 'reference');

    -- Outside the incoming prefix is not an error to report back — reporting it would tell a
    -- caller which public_ids exist. It is simply not attached.
    continue when v_public is null or v_public !~ '^rivya/inquiries/incoming/';

    -- check-migrations: allow-insert (a function body, not a seeded row — this records an upload)
    insert into media_assets (
      provider, resource_type, public_id, folder, filename, kind, alt_text,
      is_ai_generated, is_concept, source, status
    )
    values (
      'cloudinary',
      'image',
      v_public,
      regexp_replace(v_public, '/[^/]+$', ''),
      v_filename,
      'IMAGE',
      -- The visitor's own filename, which is the only description anybody has. Never invented.
      v_filename,
      false,
      false,
      'USER_UPLOAD',
      'DRAFT'
    )
    -- The unique key is (provider, resource_type, public_id), not public_id alone. Re-submitting a
    -- brief with the same references must attach the existing rows rather than fail on the second.
    on conflict (provider, resource_type, public_id) do update set filename = excluded.filename
    returning id into v_asset_id;

    v_count := v_count + 1;

    -- check-migrations: allow-insert (a function body, not a seeded row — this records an upload)
    insert into inquiry_attachments (inquiry_id, media_asset_id, position)
    values (p_inquiry_id, v_asset_id, v_count)
    on conflict (inquiry_id, media_asset_id) do nothing;
  end loop;

  return v_count;
end $$;

comment on function public.attach_inquiry_references(uuid, jsonb) is
  'Creates USER_UPLOAD/DRAFT asset rows for a fresh enquiry''s references and links them. Refuses any public_id outside rivya/inquiries/incoming/.';

revoke execute on function public.attach_inquiry_references(uuid, jsonb) from public;
grant execute on function public.attach_inquiry_references(uuid, jsonb) to anon, authenticated, service_role;

/**
 * Record what happened to the handoff.
 *
 * `anon` HAS NO UPDATE POLICY ON `inquiries` AND MUST NOT GET ONE. The visitor's session needs to
 * write exactly two columns, once, on a row it has just created — and a policy wide enough to
 * permit that is wide enough to permit editing the phone number on somebody else's enquiry. This
 * function writes those two columns and nothing else, only while the row is fresh and still
 * `NOT_SENT`, and appends the event.
 *
 * IT DOES NOT DECIDE WHETHER TO REDIRECT. By the time it runs the row exists and the URL has been
 * built from it; this is bookkeeping, and a failure here must never undo an enquiry that was saved.
 */
create or replace function public.record_inquiry_handoff(
  p_inquiry_id uuid,
  p_state whatsapp_state,
  p_level int
) returns boolean
  language plpgsql
  security definer
  set search_path = pg_catalog, public
  as $$
declare
  v_updated int;
begin
  if p_state = 'NOT_SENT' then
    raise exception 'record_inquiry_handoff records an outcome; NOT_SENT is the absence of one.'
      using errcode = 'invalid_parameter_value';
  end if;

  update inquiries
     set whatsapp_state = p_state,
         whatsapp_shortened_at_level = p_level
   where id = p_inquiry_id
     and whatsapp_state = 'NOT_SENT'
     and pipeline_status = 'NEW'
     and created_at > now() - interval '10 minutes';

  get diagnostics v_updated = row_count;
  if v_updated = 0 then return false; end if;

  -- check-migrations: allow-insert (a function body, not a seeded row — this writes the timeline)
  insert into inquiry_events (inquiry_id, event, metadata)
  values (
    p_inquiry_id,
    'WHATSAPP_REDIRECT',
    jsonb_build_object('state', p_state, 'shortened_at_level', p_level)
  );

  return true;
end $$;

comment on function public.record_inquiry_handoff(uuid, whatsapp_state, int) is
  'Writes whatsapp_state and the shorten level on a fresh, untouched enquiry and appends WHATSAPP_REDIRECT. Two columns only: anon must never hold an UPDATE policy on inquiries.';

revoke execute on function public.record_inquiry_handoff(uuid, whatsapp_state, int) from public;
grant execute on function public.record_inquiry_handoff(uuid, whatsapp_state, int) to anon, authenticated, service_role;
