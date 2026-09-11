-- ============================================================================================
-- 0330 — Phase 35: Shortlist + Confirmation
--
-- THE PIPELINE GETS ITS WORKSPACE AND ITS GATE — AND NOTHING ELSE. `research_stage` keeps its
-- seven values and `research_disposition` its four; this file alters no type at all. There is
-- no second transition log beside `research_pipeline_events` and no second state machine beside
-- `lib/scraper/core/stage.ts`. Archival of a decision is a COLUMN on the decision record, not an
-- eighth stage: a row whose confirmation was archived is still a confirmed research reference.
--
-- TWO DECISION RECORDS:
--
--   `research_shortlist_entries`   why a row was shortlisted, by whom, the score as it stood; a row
--                                  leaving SHORTLISTED closes the entry rather than deleting it.
--   `research_confirmations`       the decision note behind CONFIRMED (mandatory, non-empty), an
--                                  optional link to the brief that argued for it, archival, and —
--                                  written only by the hand-operated bridge — the id of the Rivya
--                                  product a person started from it.
--
-- `created_product_id` CARRIES NO FOREIGN KEY, DELIBERATELY. D5 says research tables never join
-- directly to public product tables and I1's allowlist is closed at two constraint names; a key
-- would breach both, would cascade a product deletion into research history, and would let a
-- careless query join the two. It is an opaque identifier the research repository resolves with a
-- second query when a Studio screen asks.
--
-- THE STAGE-WRITER GUARD, VERBATIM FROM THE PHASE DOCUMENT, enforces the Phase 25 rule that only
-- `lib/scraper/core/stage.ts` writes `stage` — at a second layer, against an ad-hoc `psql` update.
-- It defines no transitions and holds no table of its own. The transaction-local flag it checks
-- is set by `research_write_stage()`, the one function the repository calls to move a stage or a
-- disposition, executable by the service role only: under PostgREST every request is its own
-- transaction, so the flag and the write must share a function to share a transaction.
--
-- ISOLATION: no foreign key to any public table (I1 stays at two); no anon policy (I2).
-- ============================================================================================

set search_path = public, extensions;

-- --- 1. Shortlist entries -----------------------------------------------------------------------

create table research_shortlist_entries (
  id                   uuid primary key default gen_random_uuid(),
  research_product_id  uuid not null references research_products (id) on delete cascade,
  reason               text not null,
  -- The score, confidence and model version at the moment of shortlisting.
  captured             jsonb not null default '{}'::jsonb,
  brief_id             uuid references research_direction_briefs (id) on delete set null,
  opened_at            timestamptz not null default now(),
  opened_by            uuid not null references auth.users (id) on delete restrict,
  closed_at            timestamptz,
  closed_reason        text,
  closed_by            uuid references auth.users (id) on delete set null,

  constraint research_shortlist_entries_reason_not_blank check (length(btrim(reason)) > 0),
  constraint research_shortlist_entries_captured_is_object check (jsonb_typeof(captured) = 'object'),
  -- Closed means closed for a reason, by somebody; open means none of the three.
  constraint research_shortlist_entries_closed_together
    check ((closed_at is null) = (closed_reason is null) and (closed_at is null) = (closed_by is null)),
  constraint research_shortlist_entries_closed_reason_not_blank
    check (closed_reason is null or length(btrim(closed_reason)) > 0)
);

-- One OPEN entry per research row. Closing frees the row for a fresh entry, and the history stays.
create unique index research_shortlist_entries_one_open_idx
  on research_shortlist_entries (research_product_id) where closed_at is null;
create index research_shortlist_entries_opened_idx
  on research_shortlist_entries (opened_at) where closed_at is null;

comment on table research_shortlist_entries is
  'Phase 35. Why a row was shortlisted, by whom, and the score as it stood. A row leaving '
  'SHORTLISTED closes its entry rather than deleting it. Written under research.confirm; no anon '
  'policy (I2).';

-- --- 2. Confirmations ---------------------------------------------------------------------------

create table research_confirmations (
  id                   uuid primary key default gen_random_uuid(),
  research_product_id  uuid not null references research_products (id) on delete cascade,
  decision_note        text not null,
  brief_id             uuid references research_direction_briefs (id) on delete set null,
  confirmed_at         timestamptz not null default now(),
  confirmed_by         uuid not null references auth.users (id) on delete restrict,
  -- NO FOREIGN KEY. See the header. Written only by the bridge, read only by research screens.
  created_product_id   uuid,
  product_started_at   timestamptz,
  product_started_by   uuid references auth.users (id) on delete set null,
  archived_at          timestamptz,
  archived_reason      text,

  constraint research_confirmations_note_not_blank check (length(btrim(decision_note)) > 0),
  constraint research_confirmations_archived_together
    check ((archived_at is null) = (archived_reason is null)),
  constraint research_confirmations_archived_reason_not_blank
    check (archived_reason is null or length(btrim(archived_reason)) > 0),
  -- A started product is stamped with when and by whom, or not at all.
  constraint research_confirmations_product_started_together
    check ((created_product_id is null) = (product_started_at is null)
           and (created_product_id is null) = (product_started_by is null))
);

-- One UNARCHIVED confirmation per research row. Archiving frees the row for a fresh decision.
create unique index research_confirmations_one_live_idx
  on research_confirmations (research_product_id) where archived_at is null;
create index research_confirmations_confirmed_idx on research_confirmations (confirmed_at desc);

comment on table research_confirmations is
  'Phase 35. The decision record behind a CONFIRMED stage: a mandatory note, the confirming '
  'person, an optional brief, archival as a column (the stage is untouched), and — from the '
  'hand-operated bridge only — the id of the Rivya product a person started, with no foreign key '
  'so research never joins the catalogue. Written under research.confirm; no anon policy (I2).';

-- --- 3. The stage-writer guard, verbatim, and the one function that carries the flag ------------

-- The body is the phase document's, verbatim. `set search_path` is the one addition, so the
-- Supabase security advisor (function_search_path_mutable) has nothing to say about it.
create or replace function public.guard_research_stage_writer() returns trigger
  language plpgsql
  set search_path = public, extensions
  as $$
begin
  if (new.stage is distinct from old.stage
      or new.disposition is distinct from old.disposition)
     and coalesce(current_setting('rivya.stage_transition', true), '') <> 'on' then
    raise exception 'stage/disposition on research_product % may only be changed by lib/scraper/core/stage.ts',
      old.id;
  end if;
  return new;
end $$;

revoke execute on function public.guard_research_stage_writer() from public, anon, authenticated;

create trigger research_products_guard_stage_writer
  before update on research_products
  for each row execute function public.guard_research_stage_writer();

/*
 * The flag and the write share a transaction here. `stage.ts` and the bulk engine reach this
 * through the products repository's `writeProductStage` / `writeProductDisposition` — the same two
 * functions they called before — and nothing else may: EXECUTE is granted to the service role
 * only, so a session can neither move a stage directly (the trigger) nor through this (the grant).
 * NULL leaves a column as it is; the transition itself is decided in TypeScript, in `stage.ts`,
 * exactly as before — this function holds no transition table.
 */
create or replace function public.research_write_stage(
  p_id          uuid,
  p_stage       research_stage,
  p_disposition research_disposition,
  p_actor       uuid
) returns void
  language plpgsql
  security definer
  set search_path = public, extensions
  as $$
begin
  perform set_config('rivya.stage_transition', 'on', true);
  update research_products
     set stage       = coalesce(p_stage, stage),
         disposition = coalesce(p_disposition, disposition),
         updated_by  = p_actor,
         updated_at  = now()
   where id = p_id;
  perform set_config('rivya.stage_transition', '', true);
end $$;

revoke execute on function public.research_write_stage(uuid, research_stage, research_disposition, uuid)
  from public, anon, authenticated;
grant execute on function public.research_write_stage(uuid, research_stage, research_disposition, uuid)
  to service_role;

-- --- 4. Row security on, policies in 0331 --------------------------------------------------------

alter table research_shortlist_entries enable row level security;
alter table research_confirmations     enable row level security;
