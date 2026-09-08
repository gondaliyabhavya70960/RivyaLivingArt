-- ============================================================================================
-- 0070 — Phase 09 seed guards
--
-- MOST OF WHAT THE PHASE DOCUMENT ASSIGNS TO THIS MIGRATION IS ALREADY DONE, and saying so is more
-- useful than silently shipping a shorter file. The document was written expecting Phase 03 to have
-- left `seed_version` on every seedable table and Phase 08 to have added `owner_edited`. Checked
-- against the database rather than the plan:
--
--   * `content_seed_version` — already the column name on all 10 seedable tables. Phase 03's
--     `0007` shipped it under the SEED §4 name, so there is no rename to perform. (The one
--     remaining `seed_version` is on `content_seed_runs`, where it names the version a RUN applied
--     rather than a row's stamp. That is a different fact and keeps its own name.)
--   * `owner_edited` — already present on all 10, with `set_owner_edited` attached by 0050.
--
-- What is genuinely missing, and is what this file does:
--
--   1. `content_seed_runs.deferred_count`, for the fourth per-record outcome.
--   2. The `seed_key` and `content_seed_version` indexes. Seven of the ten tables have no
--      `seed_key` index at all, and NONE has one on `content_seed_version` — including the six
--      Phase 08 tables this phase is about to write thousands of rows into.
--   3. `set_owner_edited` hardened to SECURITY DEFINER.
--
-- WHY THE INDEXES MATTER MORE THAN THEY LOOK. The runner's decision for every record is a lookup
-- by `seed_key`, and its version sweep is a scan by `content_seed_version`. Without these, a seed
-- run is one sequential scan per record — fine at 25 rows, not fine at the several hundred this
-- phase adds, and worse on every re-run forever after. They are plain indexes rather than unique
-- ones: `seed_key` is already unique where Phase 03 declared it so, and adding uniqueness here
-- would silently change the constraint set on tables that never had it.
-- ============================================================================================

set search_path = public, extensions;

-- --------------------------------------------------------------------------------------------
-- 1. The fourth outcome
-- --------------------------------------------------------------------------------------------
--
-- `deferred` is NOT a skip and must not be counted as one. A skipped record is one the runner
-- chose to leave alone because a human owns it; a deferred record is one the runner WANTS to write
-- and cannot yet, because the table it targets arrives in a later phase. Folding them together
-- would make "22 skipped" mean two entirely different things in one number, and the failure it
-- hides — a deferred record quietly never applied — is exactly the risk the phase document names.
alter table content_seed_runs add column if not exists deferred_count int not null default 0;

comment on column content_seed_runs.deferred_count is
  'Records the runner wanted to write but whose target table does not exist yet (journal_*, customization_forms*). Counted separately from skipped_owner_edited: one is the runner deferring, the other is the runner deferring TO someone.';

-- --------------------------------------------------------------------------------------------
-- 2. The seed lookup indexes
-- --------------------------------------------------------------------------------------------
--
-- `if not exists` throughout: three tables already carry a `seed_key` index from Phase 03 and
-- re-creating one would fail the migration on a database that has it.
create index if not exists categories_seed_key_idx        on categories (seed_key);
create index if not exists collections_seed_key_idx       on collections (seed_key);
create index if not exists materials_seed_key_idx         on materials (seed_key);
create index if not exists products_seed_key_idx          on products (seed_key);
create index if not exists pages_seed_key_idx             on pages (seed_key);
create index if not exists page_sections_seed_key_idx     on page_sections (seed_key);
create index if not exists navigation_items_seed_key_idx  on navigation_items (seed_key);
create index if not exists global_content_seed_key_idx    on global_content (seed_key);
create index if not exists seo_entries_seed_key_idx       on seo_entries (seed_key);
create index if not exists faqs_seed_key_idx              on faqs (seed_key);

create index if not exists categories_seed_version_idx       on categories (content_seed_version);
create index if not exists collections_seed_version_idx      on collections (content_seed_version);
create index if not exists materials_seed_version_idx        on materials (content_seed_version);
create index if not exists products_seed_version_idx         on products (content_seed_version);
create index if not exists pages_seed_version_idx            on pages (content_seed_version);
create index if not exists page_sections_seed_version_idx    on page_sections (content_seed_version);
create index if not exists navigation_items_seed_version_idx on navigation_items (content_seed_version);
create index if not exists global_content_seed_version_idx   on global_content (content_seed_version);
create index if not exists seo_entries_seed_version_idx      on seo_entries (content_seed_version);
create index if not exists faqs_seed_version_idx             on faqs (content_seed_version);

-- --------------------------------------------------------------------------------------------
-- 3. set_owner_edited(), hardened
-- --------------------------------------------------------------------------------------------
--
-- SECURITY DEFINER, so the trigger's own behaviour cannot depend on who is connected. As
-- SECURITY INVOKER it ran with the caller's rights, which is harmless for the assignment it makes
-- but means the guard's correctness rested on the caller — and the whole point of this flag is to
-- record a fact ABOUT the caller.
--
-- THE BODY IS UNCHANGED, AND STILL HAS NO `else` BRANCH. A branch clearing the flag would let the
-- seed runner un-mark a row a human edited, silently restoring seeded copy over their work on the
-- next run. That is the failure the flag exists to prevent, and it stays impossible by omission.
--
-- WHAT THIS DOES NOT CLOSE, stated rather than implied. A direct `psql` UPDATE that sets no
-- `updated_by` still does not set `owner_edited` — it cannot, because there is nothing to read.
-- That gap is covered by the OTHER guard: `seed_content_hash` is compared against the row's
-- current values, so an edit made outside the application is caught by the content not matching
-- what the seed last wrote. The two guards cover different attack surfaces and neither is
-- redundant; the runner treats either as decisive.
create or replace function public.set_owner_edited()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.updated_by is not null then
    new.owner_edited := true;
  end if;
  return new;
end;
$$;

revoke execute on function public.set_owner_edited() from public, anon, authenticated;

comment on function public.set_owner_edited() is
  'Marks a row as owner-edited when a write carries updated_by. One-way by design: no branch clears the flag, so a seed run cannot un-mark a human edit. A write with no updated_by is caught by the seed_content_hash comparison instead.';
