-- ============================================================================================
-- 0390 — Phase 41: media_assets.is_decorative, and the alt-text constraint it relaxes
--
-- WCAG 1.1.1 HAS TWO CORRECT ANSWERS AND THE DATABASE COULD ONLY STORE ONE. An informative image
-- needs a text alternative. A DECORATIVE image — one carrying nothing the surrounding text does not
-- already say — needs `alt=""`, so that a screen reader skips it instead of reading a description of
-- a texture. Both are conformance; announcing a decorative image is a failure as real as omitting
-- alt text on an informative one.
--
-- `0005` shipped `check (length(btrim(alt_text)) > 0)`, which is the right constraint for the first
-- case and makes the second unstorable: the only way to get `alt=""` out of the renderer was to
-- leave the column blank, which the constraint refuses, or to type a space, which it also refuses.
-- Its own comment says "Phase 41 relaxes this to `is_decorative or (...)` when it adds that
-- column". This is that migration.
--
-- WHY A COLUMN RATHER THAN A CONVENTION. "Empty alt means decorative" is the convention the web has
-- used for twenty years and it cannot distinguish a deliberate empty string from a forgotten one —
-- which is exactly the distinction an audit needs. A boolean says which of the two happened, and
-- says it in a place `tests/unit/alt-text-coverage.test.ts` and the Studio drawer can both read.
--
-- THE DEFAULT IS false, WHICH IS THE SAFE DIRECTION. A new asset is informative until somebody
-- decides otherwise, so the strict half of the constraint applies unless a person has opted out of
-- it deliberately. Nothing in this migration changes a single existing row: all 250 manifest assets
-- carry non-empty `alt_text` today and every one of them still passes.
--
-- WHAT THIS MIGRATION DOES NOT FIX, stated because the number matters. 124 of those 250 values are
-- truncated prompt text ending mid-sentence, and the remaining 126 carry prompt vocabulary. Every
-- one satisfies this constraint and a large minority fails 1.1.1 in spirit. Rewriting them is Phase
-- 43's job; this migration supplies the constraint and the escape hatch that make the size of that
-- job visible rather than assumed.
--
-- NO OTHER TABLE IS CREATED BY PHASE 41. `rate_limit_buckets` — which the phase document lists as
-- this phase's table — already shipped in Phase 19's `0182` (amendment A18) with its count check,
-- its key-shape check, its `window_start` index and the `consume_rate_limit()` function. Recreating
-- it would be a migration that fails on a shared database. `0391` is therefore unused and recorded
-- as such in DATA_MODEL §12.
-- ============================================================================================

set search_path = public, extensions;

alter table media_assets
  add column is_decorative boolean not null default false;

comment on column media_assets.is_decorative is
  'Phase 41. True renders alt="" deliberately, for an image carrying nothing the surrounding text '
  'does not already say. It is the difference between a chosen empty alternative and a forgotten '
  'one, which is the distinction an accessibility audit needs and a bare empty string cannot make. '
  'Default false: an asset is informative until somebody decides otherwise.';

-- THE SWAP, IN ONE TRANSACTION. Dropping first and adding second would leave a window in which a
-- blank alt text is insertable; a migration is a transaction, so there is no such window here.
alter table media_assets
  drop constraint media_assets_alt_text_present;

alter table media_assets
  add constraint media_assets_alt_text_present
    check (is_decorative or (alt_text is not null and length(btrim(alt_text)) > 0));

comment on constraint media_assets_alt_text_present on media_assets is
  'WCAG 1.1.1 in one CHECK: an asset has a usable text alternative, or it is explicitly marked '
  'decorative. There is no third state, and in particular no way to store a blank alt text by '
  'accident.';
