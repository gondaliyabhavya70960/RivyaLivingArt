-- ============================================================================================
-- 0262 — Phase 28 follow-up: two CHECK constraints that passed what they were written to refuse
--
-- BOTH ARE THE SAME MISTAKE MADE TWICE, AND `0260` ALREADY DOCUMENTS THE FIRST INSTANCE OF IT.
-- A CHECK constraint refuses a row only when its expression evaluates to FALSE; an expression that
-- evaluates to NULL PASSES. `0260` was written after that trap had already been sprung once —
-- `array_length(patterns, 1) >= 1` is NULL for an empty array, so the "must have patterns" rule
-- admitted exactly the row it existed to refuse — and its comment says so at length. Two more of
-- the same family survived into the applied migration, and this corrects them.
--
-- FORWARD-ONLY. `0260` is applied to both databases and carries a checksum in
-- `public.schema_migrations`; `scripts/db/migrate.mjs` refuses a migration edited after it was
-- applied, which is the rule that makes the ledger worth keeping. So the fixes arrive as their own
-- numbered file rather than as an edit to the file that got them wrong.
--
-- NEITHER HAS CORRUPTED ANY DATA. There are no research sources, nothing has ever been fetched, and
-- `research_material_lexicon` holds only the forty rows `0260` seeded — every one of them lower
-- case with no null element. These are latent defects being closed before the table is used.
-- ============================================================================================

set search_path = public, extensions;

-- --- 1. The token shape check was case-INSENSITIVE, because the column is citext -----------------
--
-- `token` is `citext`, and the citext extension overloads `~` to the case-insensitive
-- `texticregexeq`. So `check (token ~ '^[a-z][a-z0-9_]*$')` — an anchored lower-case character
-- class, which reads as watertight — happily admits `OAK`. Verified against this database:
-- `insert into research_material_lexicon (token, patterns) values ('OAK_UPPER_PROBE', ...)`
-- succeeded before this migration.
--
-- WHY THAT MATTERS BEYOND TIDINESS. `material_tokens` is a `text[]` on thousands of research rows
-- and is compared, grouped and charted as an exact string. A lexicon that can hold both `oak` and
-- `OAK` produces two materials where there is one, splitting every breakdown built from them. The
-- Zod schema in `lib/scraper/normalization/lexicon.ts` refuses upper case at the Studio form; this
-- is the row refusing it for every other path, which is what a constraint is for.
--
-- `token::text` FORCES THE CASE-SENSITIVE OPERATOR. The cast is the whole fix: `text ~ text`
-- resolves to `textregexeq`, which means what the pattern looks like it means.
alter table research_material_lexicon
  drop constraint research_material_lexicon_token_shape,
  add constraint research_material_lexicon_token_shape
    check (token::text ~ '^[a-z][a-z0-9_]*$');

comment on constraint research_material_lexicon_token_shape on research_material_lexicon is
  'Lower case, starting with a letter, words joined by _. The token::text cast is load-bearing: token is citext, and citext overloads ~ to the case-INSENSITIVE operator, so the same pattern without the cast admitted OAK.';

-- --- 2. `has_no_blank_pattern` passed an array containing a SQL NULL ------------------------------
--
-- `btrim(null) = ''` is NULL, not TRUE, so a NULL element was filtered out of the EXISTS and
-- `not exists (...)` came back true. `array['microcement', null]` therefore satisfied a function
-- whose whole job is to refuse a pattern that is not a word.
--
-- THE HAZARD IS THE ONE THE FUNCTION WAS WRITTEN FOR. `matchMaterials` builds a word-boundary
-- expression per pattern; a null or empty one matches at almost any boundary, so a single such row
-- would tag every scraped product in the system with that material.
--
-- `p.entry is null or btrim(p.entry) = ''` is the correction — the null is now caught explicitly
-- rather than evaporating through a comparison, which is the same lesson as the header.
create or replace function public.has_no_blank_pattern(value text[]) returns boolean
  language sql immutable set search_path = pg_catalog, public
  as $$
  select value is null
      or not exists (
        select 1 from unnest(value) as p(entry)
         where p.entry is null or btrim(p.entry) = ''
      )
$$;

comment on function public.has_no_blank_pattern(text[]) is
  'True when no element of the array is null, empty or whitespace. Exists because a CHECK may not contain a subquery and walking an array needs one. The explicit null test is a fix: btrim(null) = '''' is NULL, so a null element used to be filtered out of the EXISTS and passed. A blank material pattern would match at almost any word boundary and tag every scraped product with that material.';

revoke execute on function public.has_no_blank_pattern(text[]) from public, anon;
grant execute on function public.has_no_blank_pattern(text[]) to authenticated, service_role;

-- The constraint is re-validated against the existing rows by dropping and re-adding it, so a row
-- that slipped past the old function is refused now rather than lingering as a legal exception.
alter table research_material_lexicon
  drop constraint research_material_lexicon_patterns_are_words,
  add constraint research_material_lexicon_patterns_are_words
    check (public.has_no_blank_pattern(patterns));
