-- ============================================================================================
-- 0220 — Phase 24: one bulk engine, one audit trail, one undo window
--
-- ONE ENGINE, AND THE TABLES ARE WHAT MAKE THAT ENFORCEABLE. Every surface — products, media, and
-- the research explorer from Phase 29 — registers operations against `lib/bulk/run.ts`; none loops
-- on its own. What stops a second bulk path being written is not a convention but the fact that
-- an operation without a `bulk_operations` row has no preview, no confirmation token, no per-item
-- snapshot and no undo, and `scripts/bulk/check-bulk-registry.mjs` fails the build on a mutation
-- outside the engine.
--
-- THE PREVIEW IS A ROW, NOT A SESSION. `status = 'PREVIEW'` with a `confirmation_token`, and Apply
-- requires that exact token AND re-reads `selection` from the row. A stale tab therefore cannot
-- apply a preview built from a different filter: the ids it would touch are the ids that were
-- shown, because they are stored, and a changed filter produces a new preview with a new token.
-- This is the whole reason `selection` is a column rather than something the request carries.
--
-- BULK NEVER HARD-DELETES. There is no operation kind that removes a row, and there is no flag
-- that turns archive into delete. Permanent deletion stays a single-row action on its own surface,
-- so a mis-click can destroy one row and never a page of them. That is a product decision the
-- schema cannot enforce on its own — what it CAN enforce is the other half: `revoke delete` on the
-- two record tables, so the account of what was done is not itself erasable.
--
-- UNDO IS A COMPARISON, NOT A REWIND. Every applied item stores `before` and the `updated_at` the
-- operation LEFT the entity at (`row_version_before` — named for the undo, which is the only thing
-- that reads it). Undo re-applies `before` only where the row's current `updated_at` still
-- matches, and reports the rest by id. Without that column an undo two hours later would silently
-- overwrite whatever somebody edited in between — which is worse than not offering undo at all,
-- because the operator believes they restored a known state.
--
-- FIVE HUNDRED ROWS, IN BATCHES OF FIFTY, AND `PARTIAL` IS A REAL OUTCOME. A 500-row publish that
-- fails on row 499 must not discard 498 good writes, so each batch commits on its own and the
-- operation ends `PARTIAL` with exact per-item results. The cap is a CHECK on the row rather than
-- a number in TypeScript, because the number is what makes the batching arithmetic safe.
-- ============================================================================================

set search_path = public, extensions;

-- --- 1. The operation ---------------------------------------------------------------------------

create table bulk_operations (
  id                   uuid primary key default gen_random_uuid(),

  -- `product.publish`, `media.tag`, `research.shortlist`. Text rather than an enum: the registry in
  -- `lib/bulk/registry.ts` is the register, Phase 29 adds five kinds without a migration, and an
  -- enum would make "which operations exist" a question with two answers.
  kind                 text not null,
  target_entity        text not null,

  status               text not null default 'PREVIEW',
  is_destructive       boolean not null default false,

  -- THE EXACT ID LIST THAT WAS PREVIEWED. Apply re-reads this rather than trusting the request, so
  -- Apply cannot widen a selection. Capped here because the cap is what makes the batching safe.
  selection            jsonb not null,
  params               jsonb not null default '{}',
  counts               jsonb not null default '{}',

  -- Issued with the preview, required by Apply. A stale tab holds an old token and is refused.
  confirmation_token   text,
  confirmed_at         timestamptz,

  actor_user_id        uuid references auth.users (id),
  actor_role           user_role,

  requested_at         timestamptz not null default now(),
  started_at           timestamptz,
  finished_at          timestamptz,

  -- 24 hours from the apply, set by the engine. Null on a PREVIEW row that was never applied.
  undo_deadline_at     timestamptz,
  undone_at            timestamptz,
  undone_by            uuid references auth.users (id),

  -- UNDOING AN UNDO IS A NORMAL OPERATION. It gets its own row pointing at the one it reverses,
  -- so the audit trail reads forwards rather than as a row that changed its mind.
  undo_of_operation_id uuid references bulk_operations (id),

  constraint bulk_operations_target_allowlist
    check (target_entity in ('product', 'media_asset', 'inquiry', 'research_product')),

  constraint bulk_operations_status_allowlist
    check (status in ('PREVIEW', 'QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'UNDONE')),

  constraint bulk_operations_selection_is_array
    check (jsonb_typeof(selection) = 'array'),

  -- FIVE HUNDRED, AND THE NUMBER IS LOAD-BEARING. Batches of fifty inside one transaction each;
  -- a selection an order of magnitude larger would hold a lock long enough to matter.
  constraint bulk_operations_selection_capped
    check (jsonb_array_length(selection) <= 500),

  constraint bulk_operations_params_is_object
    check (jsonb_typeof(params) = 'object'),
  constraint bulk_operations_counts_is_object
    check (jsonb_typeof(counts) = 'object'),

  -- CONFIRMATION IS TWO CONSTRAINTS, NOT ONE, BECAUSE THE TWO COLUMNS ARE NOT A PAIR. An earlier
  -- draft tied them together and was wrong in both directions, which running the engine against a
  -- real database is what proved. The lifecycle is:
  --
  --   PREVIEW                 token set,  confirmed_at null   — minted with the preview
  --   RUNNING                 token set,  confirmed_at set    — confirmed, not yet finished
  --   SUCCEEDED/PARTIAL/…     token NULL, confirmed_at set    — the token is spent at the finish,
  --                                                             which is what makes a preview
  --                                                             single-use against a double submit
  --
  -- So neither "token implies confirmation" nor its converse holds. What holds at every state, and
  -- is what actually matters, is that a PREVIEW carries the token that makes it applicable, and
  -- that nothing leaves PREVIEW without a confirmation behind it.
  constraint bulk_operations_preview_has_token
    check (status <> 'PREVIEW' or confirmation_token is not null),
  constraint bulk_operations_confirmed_before_running
    check (status = 'PREVIEW' or confirmed_at is not null),

  -- An undone operation records both halves or neither.
  constraint bulk_operations_undone_pair
    check ((undone_at is null) = (undone_by is null)),
  constraint bulk_operations_undone_status
    check (undone_at is null or status = 'UNDONE'),

  constraint bulk_operations_no_self_undo
    check (undo_of_operation_id is null or undo_of_operation_id <> id)
);

comment on table bulk_operations is
  'One row per bulk operation, from the preview onward. `selection` stores the exact id list that was previewed so Apply cannot widen it; `confirmation_token` is what a stale tab fails to present. Never deletable: the record of what was done is not itself erasable.';
comment on column bulk_operations.selection is
  'The exact ids the preview was computed over. Apply re-reads this rather than trusting the request — a changed filter produces a new preview and a new token.';
comment on column bulk_operations.undo_deadline_at is
  'Twenty-four hours from the apply. Past it the operation is history rather than something to reverse; the per-item snapshots stay, because they are the audit trail.';
comment on column bulk_operations.kind is
  'The registered operation, e.g. product.publish. Text rather than an enum: lib/bulk/registry.ts is the register, and an enum would make "which operations exist" a question with two answers.';

create index bulk_operations_recent_idx on bulk_operations (requested_at desc);
create index bulk_operations_actor_idx on bulk_operations (actor_user_id, requested_at desc);
create index bulk_operations_undoable_idx on bulk_operations (undo_deadline_at)
  where undone_at is null and status in ('SUCCEEDED', 'PARTIAL');

-- --- 2. Per-item, which is where undo lives ------------------------------------------------------

create table bulk_operation_items (
  id                 uuid primary key default gen_random_uuid(),
  operation_id       uuid not null references bulk_operations (id) on delete cascade,
  entity_id          uuid not null,

  result             text not null,
  -- Why a row was skipped or which rule it failed. Rendered in the preview, so it is a sentence a
  -- person reads rather than a code.
  reason             text,

  before             jsonb,
  after              jsonb,

  -- THE VERSION THE OPERATION LEFT THE ROW AT — read after its own write, and named from the
  -- undo's point of view: this is what the row held BEFORE THE UNDO. Undo compares it with the
  -- row's current value and skips on a mismatch, which is what stops an undo overwriting
  -- somebody's later edit. Storing the pre-write version instead would mismatch on every row the
  -- operation itself touched, so the undo would skip everything and blame an edit nobody made.
  row_version_before timestamptz,
  error              text,

  constraint bulk_operation_items_unique unique (operation_id, entity_id),
  constraint bulk_operation_items_result_allowlist
    check (result in ('APPLIED', 'SKIPPED', 'FAILED', 'UNDONE')),
  -- A skip or a failure without a reason is a row nobody can act on.
  constraint bulk_operation_items_reason_present
    check (result not in ('SKIPPED', 'FAILED') or reason is not null or error is not null)
);

comment on table bulk_operation_items is
  'The per-item record: what happened to each entity, why, and what it looked like before. This is what makes the 24-hour undo real and what keeps the audit log readable — one audit_logs row per operation, the detail here behind a link.';
comment on column bulk_operation_items.row_version_before is
  'The entity''s updated_at as the operation LEFT it — the version the row held before the undo. Undo re-applies `before` only where this still matches, and reports the rest by id: an undo that silently overwrote a later manual edit would be worse than no undo, because the operator would believe they had restored a known state.';

create index bulk_operation_items_by_result_idx on bulk_operation_items (operation_id, result);
create index bulk_operation_items_entity_idx on bulk_operation_items (entity_id);

-- --- 3. Import ------------------------------------------------------------------------------------

create table bulk_imports (
  id            uuid primary key default gen_random_uuid(),
  operation_id  uuid references bulk_operations (id) on delete set null,

  filename      text not null,
  -- Of the uploaded bytes. The FILE ITSELF IS NOT RETAINED after apply — it is a customer's
  -- spreadsheet that may hold anything, and the row set it produced is already recorded below.
  checksum      text not null,
  delimiter     text not null default ',',
  column_map    jsonb not null default '{}',

  row_count     int not null default 0,
  valid_count   int not null default 0,
  invalid_count int not null default 0,
  status        text not null default 'MAPPED',

  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users (id),

  constraint bulk_imports_delimiter_allowlist check (delimiter in (',', E'\t')),
  constraint bulk_imports_status_allowlist
    check (status in ('UPLOADED', 'MAPPED', 'VALIDATED', 'APPLIED', 'ABANDONED')),
  constraint bulk_imports_counts_sane
    check (row_count >= 0 and valid_count >= 0 and invalid_count >= 0
           and valid_count + invalid_count <= row_count),
  constraint bulk_imports_column_map_is_object check (jsonb_typeof(column_map) = 'object')
);

comment on table bulk_imports is
  'One uploaded CSV or TSV, its column mapping and its validation result. The uploaded FILE is not retained after apply; the checksum identifies it and bulk_import_rows records what it contained.';

create index bulk_imports_recent_idx on bulk_imports (created_at desc);

create table bulk_import_rows (
  id               uuid primary key default gen_random_uuid(),
  import_id        uuid not null references bulk_imports (id) on delete cascade,

  -- The line number in the operator's own file, so an error names something they can find.
  row_number       int not null,
  raw              jsonb not null,
  mapped           jsonb not null default '{}',
  issues           jsonb not null default '[]',

  action           text not null default 'SKIP',
  target_entity_id uuid,
  applied          boolean not null default false,

  created_at       timestamptz not null default now(),

  constraint bulk_import_rows_unique unique (import_id, row_number),
  constraint bulk_import_rows_action_allowlist check (action in ('INSERT', 'UPDATE', 'SKIP')),
  constraint bulk_import_rows_row_number_sane check (row_number >= 1),
  constraint bulk_import_rows_issues_is_array check (jsonb_typeof(issues) = 'array'),
  -- An applied row names what it became. A row that claims to have been applied to nothing is a
  -- record nobody can follow.
  constraint bulk_import_rows_applied_has_target
    check (applied = false or target_entity_id is not null)
);

comment on table bulk_import_rows is
  'One row of an uploaded file: what it said, what it mapped to, what was wrong with it, and what became of it. Retained 30 days for post-hoc review, then pruned — long enough to answer "why did that import do that", short enough that a spreadsheet of somebody''s data does not live here forever.';

create index bulk_import_rows_by_import_idx on bulk_import_rows (import_id, row_number);
create index bulk_import_rows_prune_idx on bulk_import_rows (created_at);

-- --- 4. The record is not erasable -----------------------------------------------------------------
--
-- NO DELETE POLICY IS GENERATED FOR EITHER RECORD TABLE (see 0221), and these revokes close the
-- other half: a table-level GRANT is not the security boundary on Supabase, RLS is — but a role
-- with no RLS delete policy AND no delete grant cannot reach the statement at all, and saying it
-- twice costs nothing. `bulk_imports` and `bulk_import_rows` ARE deletable by the pruner, which
-- runs as the service role and is unaffected.

revoke delete on bulk_operations from anon, authenticated;
revoke delete on bulk_operation_items from anon, authenticated;

alter table bulk_operations enable row level security;
alter table bulk_operation_items enable row level security;
alter table bulk_imports enable row level security;
alter table bulk_import_rows enable row level security;
