-- ============================================================================================
-- 0140 — the two enum values Phase 16 needs, and NOTHING else
--
-- WHY THIS FILE EXISTS AT ALL. It holds three `alter type` statements and no other work, which
-- looks like a migration that should have been folded into the next one. It cannot be.
--
-- `scripts/db/migrate.mjs` runs every migration under a single `--single-transaction` (see its
-- header: "Each migration and its bookkeeping row are applied in ONE transaction"), and PostgreSQL
-- refuses to USE an enum value that was added in the transaction still adding it:
--
--     ALTER TYPE tmp ADD VALUE 'B';
--     CREATE TABLE t (v tmp NOT NULL DEFAULT 'B');
--     ERROR:  unsafe use of new value "B" of enum type tmp
--     HINT:   New enum values must be committed before they can be used.
--
-- That was measured against this project's own cluster, not assumed. The phase document asks for
-- the additions "in its own migration statement so no transaction uses a value it just created" —
-- a statement is not sufficient under this runner, because the runner's transaction is the FILE.
-- So the boundary is a file, and `0141` may then reference `OWNER_CONFIRMED` freely.
--
-- WHAT COUNTS AS "USE" IS NARROWER THAN IT LOOKS, and the distinction is why this file could not
-- simply be merged with a bit of care. A plpgsql function BODY is stored as text and not parsed
-- until first execution, so `enforce_collection_publish_gate` could have lived beside the additions.
-- An RLS policy expression is parsed AT CREATION, and `0142`'s policy compares `concept_state` to
-- `OWNER_CONFIRMED` — that one would have failed. Splitting on the safe-looking case is how this
-- becomes a migration that passes locally and fails on the next database.
--
-- `add value if not exists` because ALTER TYPE ... ADD VALUE IS IRREVERSIBLE: PostgreSQL has no
-- `drop value`. A re-run must be a no-op rather than an error, and a mistake here is corrected by
-- a new enum and a column rewrite, never by undoing this.
--
-- THE ORDER OF THE VALUES IS THE LIFECYCLE, and it is stated rather than incidental: a concept is
-- drafted, then confirmed by the owner, then eventually retired. `sortorder` follows the sequence a
-- collection actually moves through, so `order by concept_state` in any Studio list reads as
-- progress rather than as alphabetical accident.
-- ============================================================================================

-- --- collection_concept_state (FEAT §9) -------------------------------------------------------
-- DRAFT_COLLECTION_CONCEPT exists from Phase 03 and is the default. These are the other two.
alter type collection_concept_state add value if not exists 'OWNER_CONFIRMED';
alter type collection_concept_state add value if not exists 'RETIRED';

comment on type collection_concept_state is
  'The lifecycle of a collection CONCEPT (FEAT §9). A collection may only be PUBLISHED while this is OWNER_CONFIRMED — enforced by enforce_collection_publish_gate in 0141. A seeded concept is DRAFT_COLLECTION_CONCEPT and stays there until a person says otherwise.';
