-- ============================================================================================
-- 0230 — Phase 25: the research vocabulary, as six enums
--
-- ENUMS BEFORE USE, IN THEIR OWN MIGRATION, which is the pattern 0002 set and every phase since
-- has followed. PostgreSQL will not let a new enum value be used in the same transaction that adds
-- it, and a type created beside the table that uses it makes a later `alter type ... add value`
-- a migration that must be split anyway. Separating them once, here, costs one file.
--
-- THE SEVEN STAGES ARE FEAT §23'S, VERBATIM, AND REJECTION IS NOT ONE OF THEM. A discovered row
-- moves RAW → NORMALIZED → VALIDATED → MATCHED → REVIEW → SHORTLISTED → CONFIRMED, one step at a
-- time. Rejecting, ignoring or marking a row duplicate is a DISPOSITION — a separate column — so
-- that the pipeline vocabulary stays literally the requirement's and a rejected row keeps the
-- stage it actually reached. Folding rejection into the stage enum would have made "how far did
-- this row get before we said no" unanswerable, which is the question the review screens exist to
-- answer.
--
-- `research_policy_status` IS THE ONE ENUM THAT IS NOT ABOUT DATA. It records a judgement a
-- person made about whether Rivya may read a given website at all, and it starts at UNREVIEWED
-- for every source because this repository cannot make that judgement on anybody's behalf. See
-- 0231's constraint and `docs/architecture/SCRAPER.md`.
-- ============================================================================================

set search_path = public, extensions;

-- FEAT §23, in order. A row moves forward one value at a time; `lib/scraper/core/stage.ts` is the
-- only writer, and every move writes a `research_pipeline_events` row.
create type research_stage as enum (
  'RAW', 'NORMALIZED', 'VALIDATED', 'MATCHED', 'REVIEW', 'SHORTLISTED', 'CONFIRMED'
);

comment on type research_stage is
  'FEAT §23 verbatim. Forward only, one step at a time, written only by lib/scraper/core/stage.ts. Rejection is deliberately NOT here — see research_disposition — so a rejected row keeps the stage it reached.';

-- Orthogonal to the stage, on purpose.
create type research_disposition as enum ('NONE', 'IGNORED', 'REJECTED', 'DUPLICATE');

comment on type research_disposition is
  'What a person decided about a row, independent of how far it got. Separate from research_stage so the stage vocabulary stays FEAT §23''s and "how far did this get before we said no" stays answerable.';

-- PARTIAL IS A REAL OUTCOME, as it is for a bulk operation and for the same reason: a run that
-- fetched four hundred URLs and failed on one has not failed.
create type research_run_status as enum (
  'QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED'
);

create type research_job_type as enum ('DISCOVERY', 'DETAIL', 'REFRESH');

-- UNREVIEWED IS THE DEFAULT AND THE ONLY ONE THIS REPOSITORY MAY SET. Moving a source to APPROVED
-- is an assertion about a third party's terms of use, which is a legal and commercial judgement.
create type research_policy_status as enum ('UNREVIEWED', 'APPROVED', 'RESTRICTED', 'BLOCKED');

comment on type research_policy_status is
  'Whether the owner has reviewed a source and asserted that Rivya may read it. Starts UNREVIEWED. Only owner or admin may set APPROVED, and only they may enable a source — see the check on research_sources. The determination is the owner''s assertion, never the engineering team''s.';

create type research_trigger as enum ('MANUAL', 'SCHEDULED');
