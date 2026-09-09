-- ============================================================================================
-- 0150 — the project archive, built so it cannot lie
--
-- Three tables, all of which ship with ZERO ROWS and will stay empty until the owner has real work
-- to show. That is the phase, not a caveat on it: SEED §17 says "DO NOT create fictional customer
-- projects to fill Portfolio" in capitals, and D10 lists delivered projects and named customers as
-- the first two things that may never be fabricated. `/portfolio` already renders the §28 empty
-- state from a seeded row; what this migration adds is the machinery for the day that changes, and
-- the guards that make the change safe.
--
-- ONE ENUM, ONE FILE — AND NO SPLIT THIS TIME. Phases 14 and 16 each needed a separate migration
-- for their enum work because `alter type ... add value` cannot be followed by a USE of that value
-- in the same transaction, and `db:migrate` makes the file the transaction. `client_consent_state`
-- is a BRAND-NEW type, and a new type IS usable in the transaction that creates it — only ADD VALUE
-- is restricted. Measured in Phase 16 against this project's own cluster. So `0150` may create the
-- enum and the columns that use it, and DATA_MODEL §12's allocation of `0150`–`0151` holds.
--
-- TWO GATE FUNCTIONS, ONE PER TABLE, AND THIS IS NOT DUPLICATION. The two tables name a person
-- through different columns — `portfolio_projects.client_display_name` / `client_consent` and
-- `testimonials.attributed_to` / `consent`. A single shared trigger function referencing both would
-- compile fine and then raise `record "new" has no field "client_display_name"` on the first write
-- to `testimonials`, because plpgsql resolves a record field at execution rather than at creation.
-- The phase document calls this out explicitly and it is worth the second function.
--
-- THE CONSENT GATE IS NOT THE SAME RULE AS THE VERIFICATION GATE, and both are enforced. Owner
-- verification asks "did this happen"; consent asks "may we say whose it was". A project can be
-- entirely real and still not publishable under someone's name. They are separate columns, separate
-- refusals and separate sentences in the Studio.
--
-- `WITHDRAWN` REWRITES `status` IN PLACE rather than refusing. Consent is not ours to argue with:
-- when it is withdrawn the row leaves the public site immediately, on the same statement, without
-- anyone having to remember to unpublish it. That is why both triggers are BEFORE triggers.
--
-- CONCEPT MEDIA MAY NEVER ENTER A PROJECT GALLERY. The five `gallery-scene` assets are landing
-- atmosphere, carry `is_concept = true`, and are the exact material someone would reach for to make
-- an empty portfolio look fuller. A CHECK constraint cannot see another table, so this is a trigger
-- — the same shape as `reject_concept_product_media` from Phase 14, for the same reason.
-- ============================================================================================

-- Extension objects (`citext`) are resolved through this search_path, exactly as `0004` sets it and
-- for the same reason: on Supabase the extension lives in the `extensions` schema, not in `public`,
-- so a bare `citext` column type fails with `type "citext" does not exist`.
set search_path = public, extensions;

-- --- 1. the consent vocabulary ----------------------------------------------------------------
-- NOT_APPLICABLE is the default on a project because most projects name nobody; PENDING is the
-- default on a testimonial because a quote always comes from someone. The difference is deliberate
-- and is why the two columns do not share a default.
create type client_consent_state as enum (
  'NOT_APPLICABLE', 'PENDING', 'GRANTED', 'WITHDRAWN'
);

comment on type client_consent_state is
  'Whether the person or client a row names has agreed to be named. GRANTED is the only value that permits publication of a row carrying a name (FEAT §38, D10).';

-- --- 2. portfolio_projects ---------------------------------------------------------------------
create table portfolio_projects (
  id            uuid primary key default gen_random_uuid(),
  slug          citext not null unique,
  -- The story is an ordinary CMS page, exactly as a collection's exhibition is. Phase 16 built that
  -- pattern; this is its second user, which is what makes it a pattern rather than a special case.
  page_id       uuid unique references pages (id) on delete set null,
  title         text not null,
  subtitle      text,
  summary       text,
  project_type  text,
  -- A LABEL, NEVER AN ADDRESS. "A private residence in Ahmedabad" is a label; a street is a fact
  -- about someone's home that no portfolio needs and no client consented to.
  location_label text,
  completed_on  date,

  is_client_project    boolean not null default false,
  client_display_name  text,
  client_consent       client_consent_state not null default 'NOT_APPLICABLE',
  client_consent_reference   text,
  client_consent_recorded_at timestamptz,
  client_consent_recorded_by uuid references auth.users (id),

  -- WHAT PROVES THIS HAPPENED. Not rendered anywhere and not meant to be: it is the note the owner
  -- writes for themselves and for whoever asks later. Its existence is the point — a project row
  -- with an empty evidence note is one nobody has had to justify.
  evidence_note text,

  hero_media_id uuid references media_assets (id) on delete set null,
  seo_entry_id  uuid references seo_entries (id) on delete set null,
  sort_order    int not null default 0,

  status        content_status not null default 'DRAFT',
  -- THE DEFAULT IS INVERTED HERE, DELIBERATELY. Every other content table defaults to
  -- NOT_REQUIRED and flags the rows that make claims. A portfolio project IS a claim — that Rivya
  -- delivered this — so the safe default is the other way round and the owner clears it per row.
  owner_verification  owner_verification not null default 'OWNER_VERIFICATION_REQUIRED',
  -- `VERIFIED_BUSINESS_FACT` NAMES THE KIND OF CONTENT, NOT ITS STATE — the same way PRODUCT_FACT
  -- does. It says "this row is a claim about the business", which is what makes the pairing with
  -- OWNER_VERIFICATION_REQUIRED above coherent rather than contradictory: the classification is the
  -- category, and the column beside it carries whether anyone has confirmed it.
  fact_classification fact_classification not null default 'VERIFIED_BUSINESS_FACT',

  published_at  timestamptz,
  published_by  uuid references auth.users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users (id),

  -- A consent state that names nobody, or a name with no consent decision, are both incoherent.
  -- The gate below refuses to PUBLISH them; this refuses to STORE the second one at all, because
  -- "NOT_APPLICABLE" beside a client name is a contradiction rather than a draft.
  constraint portfolio_projects_consent_coherent check (
    client_display_name is null or client_consent <> 'NOT_APPLICABLE'
  ),
  constraint portfolio_projects_client_named check (
    client_display_name is null or is_client_project
  )
);

comment on table portfolio_projects is
  'Delivered work. ZERO ROWS ARE EVER SEEDED (SEED §17, §28, D10): a project exists because the owner entered one and verified it. Publishing requires owner_verification = VERIFIED, and naming a client additionally requires GRANTED consent.';
comment on column portfolio_projects.evidence_note is
  'What proves this project happened — an invoice number, a delivery date, a photograph reference. Never rendered publicly; it exists so that "is this real" has an answer written down.';
comment on column portfolio_projects.owner_verification is
  'Defaults to OWNER_VERIFICATION_REQUIRED, unlike every other content table. A portfolio project asserts that Rivya delivered something, so the safe default is that it has not been confirmed.';

create index portfolio_projects_status_idx on portfolio_projects (status, sort_order);
create index portfolio_projects_type_idx on portfolio_projects (project_type);

alter table portfolio_projects enable row level security;

-- --- 3. portfolio_project_media ----------------------------------------------------------------
create table portfolio_project_media (
  project_id     uuid not null references portfolio_projects (id) on delete cascade,
  media_asset_id uuid not null references media_assets (id) on delete cascade,
  role           text not null,
  caption        text,
  -- What this picture is doing HERE, which is a different sentence from what the picture is of.
  alt_override   text,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  created_by     uuid references auth.users (id),

  primary key (project_id, media_asset_id),

  constraint portfolio_project_media_role_allowed
    check (role in ('hero', 'gallery', 'detail', 'process', 'video', 'model')),
  constraint portfolio_project_media_caption_present
    check (caption is null or btrim(caption) <> ''),
  constraint portfolio_project_media_alt_present
    check (alt_override is null or btrim(alt_override) <> '')
);

comment on table portfolio_project_media is
  'The pictures of a delivered project. A concept render may never be one of them — see reject_concept_project_media.';

create index portfolio_project_media_project_idx
  on portfolio_project_media (project_id, role, sort_order);

alter table portfolio_project_media enable row level security;

-- --- 4. testimonials ----------------------------------------------------------------------------
create table testimonials (
  id           uuid primary key default gen_random_uuid(),
  attributed_to     text,
  attribution_role  text,
  quote        text not null,
  project_id   uuid references portfolio_projects (id) on delete set null,

  -- PENDING, not NOT_APPLICABLE: a quote always came from someone, so consent is always a live
  -- question here in a way it is not for a project with no client.
  consent           client_consent_state not null default 'PENDING',
  consent_reference text,

  sort_order   int not null default 0,
  status       content_status not null default 'DRAFT',
  owner_verification  owner_verification not null default 'OWNER_VERIFICATION_REQUIRED',
  fact_classification fact_classification not null default 'VERIFIED_BUSINESS_FACT',

  published_at timestamptz,
  published_by uuid references auth.users (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users (id),

  constraint testimonials_quote_present check (btrim(quote) <> '')
);

comment on table testimonials is
  'Quotes from real people. ZERO ROWS ARE EVER SEEDED — D10 lists testimonials by name, and a testimonial written in-house is the purest form of the fabrication it forbids. consent defaults to PENDING and the publish gate treats attributed_to exactly as it treats a client name.';

create index testimonials_status_idx on testimonials (status, sort_order);

alter table testimonials enable row level security;

-- --- 5. pages learns about PROJECT ---------------------------------------------------------------
-- A CHECK on text, so a drop and a re-add — the same shape Phase 16 used to add COLLECTION.
alter table pages drop constraint pages_kind_allowed;

alter table pages add constraint pages_kind_allowed
  check (kind in ('PAGE', 'CATEGORY', 'SYSTEM', 'COLLECTION', 'PROJECT'));

comment on constraint pages_kind_allowed on pages is
  'What kind of thing a page is. COLLECTION arrives in Phase 16 and PROJECT in Phase 17; both are ordinary CMS pages joined to their entity by that entity''s page_id.';

-- --- 6. the project evidence gate ----------------------------------------------------------------
create or replace function public.enforce_project_evidence_gate() returns trigger
  language plpgsql
  set search_path = pg_catalog, public
  as $$
begin
  -- WITHDRAWAL IS HANDLED FIRST, AND THE ORDER IS THE WHOLE POINT.
  --
  -- The phase document's pseudo-code puts this branch last, and written that way the gate refuses
  -- the one operation it exists to permit. Setting consent to WITHDRAWN on a row that is currently
  -- PUBLISHED leaves `new.status` at 'PUBLISHED', so the consent check below raises and the
  -- withdrawal is REFUSED — the project stays published, under the name of someone who has just
  -- asked not to be named. Measured against this project's own cluster; the probe output read
  -- `portfolio project probe names a client without granted consent` on the withdrawal statement.
  --
  -- Ordered this way, withdrawal archives the row and the publish block below then sees ARCHIVED
  -- and does not fire. Consent is not ours to argue with: it takes effect on the same statement,
  -- rather than being blocked by the very rule that protects the person withdrawing it.
  --
  -- An attempt to PUBLISH a row whose consent is already withdrawn is archived rather than
  -- refused, which is the same answer said differently — and `OwnerVerificationPanel` names the
  -- unmet gate before an editor ever submits, so this is the backstop rather than the interface.
  if new.client_consent = 'WITHDRAWN' then
    new.status := 'ARCHIVED';
  end if;

  if new.status = 'PUBLISHED' then
    if new.owner_verification <> 'VERIFIED' then
      raise exception
        'portfolio project % cannot be published until the owner has verified it (D10)', new.slug
        using errcode = '23514',
              constraint = 'project_evidence_gate',
              detail = 'constraint=project_evidence_gate',
              hint = 'A portfolio project asserts that Rivya delivered this. Only an owner or admin may confirm that.';
    end if;

    if new.client_display_name is not null and new.client_consent is distinct from 'GRANTED' then
      raise exception
        'portfolio project % names a client without granted consent', new.slug
        using errcode = '23514',
              constraint = 'project_consent_gate',
              detail = 'constraint=project_consent_gate',
              hint = 'Naming a client in public needs their agreement on record. Set client_consent to GRANTED with a reference, or remove the name.';
    end if;
  end if;

  return new;
end $$;

comment on function public.enforce_project_evidence_gate() is
  'Two independent gates on publishing a project: the owner has verified it happened, and anyone it names has agreed to be named. Withdrawal of consent archives the row in place.';

revoke execute on function public.enforce_project_evidence_gate() from public, anon, authenticated;

create trigger portfolio_projects_evidence_gate
  before insert or update on portfolio_projects
  for each row execute function public.enforce_project_evidence_gate();

-- --- 7. the testimonial evidence gate ------------------------------------------------------------
-- A SECOND FUNCTION, NOT A SHARED ONE. See the header: plpgsql resolves `new.<field>` at execution,
-- so a shared function would raise `record "new" has no field "client_display_name"` the first time
-- anything wrote to `testimonials`.
create or replace function public.enforce_testimonial_evidence_gate() returns trigger
  language plpgsql
  set search_path = pg_catalog, public
  as $$
begin
  -- Withdrawal first, for the reason set out in full on enforce_project_evidence_gate above: in the
  -- phase document's order this branch is unreachable from a published row, so a person could not
  -- withdraw a quote they had already agreed to.
  if new.consent = 'WITHDRAWN' then
    new.status := 'ARCHIVED';
  end if;

  if new.status = 'PUBLISHED' then
    if new.owner_verification <> 'VERIFIED' then
      raise exception
        'testimonial % cannot be published until the owner has verified it (D10)', new.id
        using errcode = '23514',
              constraint = 'testimonial_evidence_gate',
              detail = 'constraint=testimonial_evidence_gate',
              hint = 'A testimonial asserts that a real person said this. Only an owner or admin may confirm that.';
    end if;

    if new.attributed_to is not null and new.consent is distinct from 'GRANTED' then
      raise exception
        'testimonial % names a person without granted consent', new.id
        using errcode = '23514',
              constraint = 'testimonial_consent_gate',
              detail = 'constraint=testimonial_consent_gate',
              hint = 'Attributing a quote in public needs that person''s agreement on record. Set consent to GRANTED with a reference, or publish it unattributed.';
    end if;
  end if;

  return new;
end $$;

comment on function public.enforce_testimonial_evidence_gate() is
  'The same two gates as enforce_project_evidence_gate, over this table''s own columns. Separate because plpgsql resolves record fields at execution, so one function cannot serve both tables.';

revoke execute on function public.enforce_testimonial_evidence_gate() from public, anon, authenticated;

create trigger testimonials_evidence_gate
  before insert or update on testimonials
  for each row execute function public.enforce_testimonial_evidence_gate();

-- --- 8. concept media may never illustrate delivered work -----------------------------------------
-- THE RISK THIS EXISTS FOR IS NAMED IN THE PHASE DOCUMENT: pressure to "fill" an empty portfolio
-- with concept imagery. The five `gallery-scene` assets are exactly what someone would reach for —
-- they are already on the /portfolio landing, they look like finished interiors, and they are
-- concept renders. Attaching one to a project row would turn atmosphere into a delivered-work claim.
create or replace function public.reject_concept_project_media() returns trigger
  language plpgsql
  set search_path = pg_catalog, public
  as $$
begin
  if exists (
    select 1 from media_assets m
     where m.id = new.media_asset_id
       and m.is_concept
  ) then
    raise exception
      'concept media cannot be attached to a portfolio project (%)', new.media_asset_id
      using errcode = 'check_violation',
            hint = 'A concept render may illustrate a material or a mood, never work that was delivered (D6, D10). The portfolio shows real project photography or it shows the empty state.';
  end if;
  return new;
end $$;

comment on function public.reject_concept_project_media() is
  'Refuses a portfolio_project_media row whose asset is a concept render. The same shape as reject_concept_product_media (Phase 14), for the same reason.';

revoke execute on function public.reject_concept_project_media() from public, anon, authenticated;

create trigger portfolio_project_media_reject_concept
  before insert or update on portfolio_project_media
  for each row execute function public.reject_concept_project_media();

-- --- 9. a project page publishes its project ------------------------------------------------------
-- Phase 16 named this function `sync_entity_page_status` rather than `sync_collection_page_status`
-- precisely so a second entity could join it. This is that second entity, and the direction is the
-- same for the same two reasons: `pages` carries the transition workflow and `portfolio_projects`
-- does not, and the roles that edit the two are not the same set.
--
-- THE PROJECT'S OWN GATE STILL FIRES, from inside this update. Publishing the page of an unverified
-- project fails and names the PROJECT — which is the correct reading: what is not ready is the
-- evidence, not the page.
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

  if new.kind = 'PROJECT' and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    update portfolio_projects
       set status = new.status
     where page_id = new.id
       and status is distinct from new.status;
  end if;

  return new;
end $$;

comment on function public.sync_entity_page_status() is
  'An entity page publishes its entity — a COLLECTION since Phase 16, a PROJECT since Phase 17. Runs page -> entity because pages carry the status workflow and the entity tables do not; the reverse is refused by enforce_status_transition for every actor, including the service role.';

revoke execute on function public.sync_entity_page_status() from public, anon, authenticated;

-- --- 10. keep updated_at honest -------------------------------------------------------------------
create trigger portfolio_projects_set_updated_at
  before update on portfolio_projects
  for each row execute function public.set_updated_at();

create trigger testimonials_set_updated_at
  before update on testimonials
  for each row execute function public.set_updated_at();
