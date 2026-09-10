-- ============================================================================================
-- 0250 — Phase 27: versions, not overwrites, and an accounting of the blast radius
--
-- TWO TABLES, AND THE FIRST ONE IS THE PHASE. `research_product_versions` is append-only and
-- deduplicated by content hash, so a page that has not changed produces NO new row and a page that
-- has produces exactly one. Everything Phase 29 does — diffing, materiality, the claim that a
-- change record can be reproduced from evidence — rests on that and cannot be retrofitted: a
-- subsystem that mutated a current row would be comparing against something that had already moved.
--
-- WHY A CONTENT HASH RATHER THAN A TIMESTAMP. A nightly run over four hundred pages, most of them
-- unchanged, would otherwise write four hundred versions a night and make "what changed" a question
-- about noise. `unique (research_product_id, content_hash)` makes the unchanged case a no-op at the
-- ROW, so the rule holds against a bug in the caller as well as against the caller doing it right.
-- The hash is over the DRAFT the adapter produced, not over the page body: two pages that differ
-- only in a session id or a rotating banner are the same product observation, and the version table
-- exists to record product observations.
--
-- `research_adapter_runs` IS THE UNIT OF BLAST-RADIUS ACCOUNTING, and it exists because FEAT §27's
-- defining constraint — "a broken source adapter must not break other sources" — is a claim about
-- what happens when something throws, and a claim about failure needs a record or it cannot be
-- checked. One row per (run, source, adapter): what it saw, what it extracted, what failed, the
-- first five errors with their URLs, and whether it was ABORTED. Ten consecutive item failures for
-- one source stop THAT SOURCE for the rest of the run and nothing else; three consecutive ABORTED
-- adapter runs open the source's circuit.
--
-- NOTHING HERE POINTS AT A PUBLIC TABLE. `current_version_id` closes the loop Phase 25 deliberately
-- left open — it was declared as a bare uuid in `0231` because the table it points at did not exist
-- yet — and it points at another `research_*` table. The isolation guard's allowlist is unchanged at
-- one entry; Phase 28 adds the second and last.
--
-- NO COMPETITOR IMAGE IS FETCHED, STORED OR TRANSFORMED BY ANYTHING THIS MIGRATION CREATES. An
-- extracted image reference is a string inside `raw`, and it stays one.
-- ============================================================================================

set search_path = public, extensions;

-- --- 1. One observation of one product, kept forever ----------------------------------------------

create table research_product_versions (
  id                  uuid primary key default gen_random_uuid(),
  research_product_id uuid not null references research_products (id) on delete cascade,

  -- Null for a version produced by the offline re-extraction script, which reads stored snapshots
  -- and belongs to no run. That is the honest value: inventing a run id for it would put a row in
  -- the run detail screen for work that never fetched anything.
  run_id              uuid references research_runs (id) on delete set null,
  fetch_id            uuid references research_fetches (id) on delete set null,

  -- THE `RawProductDraft`, WHOSE EVERY FIELD IS THE SOURCE'S OWN STRING. Not a parsed number, not a
  -- converted unit, not a resolved currency — those are Phase 28's, and the Zod schema in
  -- `lib/scraper/adapters/draft-schema.ts` refuses a numeric field outright. What is stored here is
  -- what the page said, so that a normalisation rule can be corrected years later and re-run over
  -- evidence rather than over its own earlier output.
  raw                 jsonb not null,

  -- Phase 28 writes these two. Declared here because the shape is already known and a column added
  -- later is a migration nobody needs — the same reasoning `0231` used for `current_version_id`.
  normalized          jsonb,
  normalizer_version  text,

  content_hash        text not null,

  -- The gzipped page this draft was read from, in the private snapshot bucket. Null when the
  -- snapshot has been pruned at 180 days — the version outlives the evidence, which is why the
  -- draft is stored rather than re-derived on demand.
  storage_key         text,

  adapter_key         text not null,
  adapter_version     text not null,
  observed_at         timestamptz not null default now(),

  constraint research_product_versions_raw_is_object check (jsonb_typeof(raw) = 'object'),
  constraint research_product_versions_normalized_is_object
    check (normalized is null or jsonb_typeof(normalized) = 'object'),
  -- THE RULE THE WHOLE TABLE IS FOR. An unchanged page produces no new version.
  constraint research_product_versions_unique_content
    unique (research_product_id, content_hash)
);

comment on table research_product_versions is
  'Append-only. One row per (product, distinct content hash), holding the RawProductDraft an adapter produced and the snapshot it came from. Phase 29 diffs consecutive rows; nothing rewrites one, because a change record that cannot be reproduced from stored evidence is not a record.';
comment on column research_product_versions.raw is
  'The RawProductDraft: every field a string the source itself published. A parsed number here fails the Zod schema — parsing is Phase 28''s, in one place, over stored evidence.';
comment on column research_product_versions.content_hash is
  'SHA-256 over the normalised JSON of `raw`, NOT over the page body. Two fetches of a page that differ only in a session id or a rotating banner are one product observation.';
comment on column research_product_versions.adapter_version is
  'Recorded on every row, because an adapter fix must be traceable to the rows it produced. Changing an adapter''s output shape is a version bump, and re-extraction under a new version writes NEW rows rather than rewriting old ones.';

-- Newest first, per product. The query Phase 29 makes on every detection pass.
create index research_product_versions_recent_idx
  on research_product_versions (research_product_id, observed_at desc);
create index research_product_versions_by_run_idx on research_product_versions (run_id);
-- The pruner clears `storage_key` on this table for the same reason it does on research_fetches.
create index research_product_versions_prune_idx
  on research_product_versions (observed_at) where storage_key is not null;

-- --- 2. Closing the loop 0231 left open ------------------------------------------------------------
--
-- `current_version_id` HAS EXISTED SINCE `0231` AS A BARE uuid, deliberately: the shape was known
-- and the table it points at was two phases away. This is the foreign key it was always going to be.
-- `on delete set null` rather than cascade — deleting a version must not delete the product that was
-- observed; the product simply has no current version until the next run, which is a state the
-- explorer can render and a cascade would have hidden by removing the row.
alter table research_products
  add constraint research_products_current_version_fk
  foreign key (current_version_id) references research_product_versions (id) on delete set null;

comment on column research_products.current_version_id is
  'The newest version by observed_at, set by lib/scraper/workflows/extract.ts after a new version is written. A product with none has been discovered but not yet extracted.';

-- --- 3. What one adapter did to one source in one run ----------------------------------------------

create table research_adapter_runs (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid not null references research_runs (id) on delete cascade,
  source_id       uuid not null references research_sources (id) on delete cascade,

  adapter_key     text not null,
  adapter_version text not null,

  status          text not null default 'OK',

  items_seen      int not null default 0,
  items_extracted int not null default 0,
  items_failed    int not null default 0,

  -- THE FIRST FIVE, NOT ALL OF THEM. A source whose adapter is broken fails every item, and storing
  -- four hundred identical stack traces would make the run detail screen unreadable while telling
  -- an operator nothing the first five did not. The count is exact; the examples are bounded.
  first_errors    jsonb not null default '[]'::jsonb,

  duration_ms     int not null default 0,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,

  constraint research_adapter_runs_status_allowlist
    check (status in ('OK', 'PARTIAL', 'ABORTED', 'FAILED')),
  constraint research_adapter_runs_errors_is_array
    check (jsonb_typeof(first_errors) = 'array'),
  constraint research_adapter_runs_counts_sane
    check (items_seen >= 0 and items_extracted >= 0 and items_failed >= 0),
  -- ONE ROW PER ADAPTER PER SOURCE PER RUN. The upsert target, and what makes the counters
  -- cumulative across the many cron ticks a single run is drained over.
  constraint research_adapter_runs_unique unique (run_id, source_id, adapter_key)
);

comment on table research_adapter_runs is
  'One row per (run, source, adapter): the accounting FEAT §27''s "a broken adapter must not break other sources" needs in order to be checkable. ABORTED means ten consecutive item failures stopped this source for the rest of the run — and only this source.';
comment on column research_adapter_runs.status is
  'OK: nothing failed. PARTIAL: some items failed and the source kept going. ABORTED: ten consecutive failures stopped this source for the rest of the run. FAILED: the adapter could not be resolved or started at all.';

create index research_adapter_runs_by_run_idx on research_adapter_runs (run_id);
-- Three consecutive ABORTED runs open the source's circuit; this is the query that finds them.
create index research_adapter_runs_by_source_idx
  on research_adapter_runs (source_id, started_at desc);

-- --- 4. RLS on, policies in 0251 --------------------------------------------------------------------

alter table research_product_versions enable row level security;
alter table research_adapter_runs     enable row level security;
