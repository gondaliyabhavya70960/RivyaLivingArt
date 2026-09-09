-- ============================================================================================
-- 0171 — feature_flags: one table, and no rows
--
-- FEAT §32 asks for a lightweight flag system and adds a warning worth keeping in view: "not a
-- substitute for proper configuration". So this is deliberately the smallest thing that works —
-- a key, a description, a boolean, and who last moved it.
--
-- THE REGISTER OF FLAGS LIVES IN TYPESCRIPT, NOT IN THIS TABLE. `lib/flags/flags.ts` holds the
-- union of flag keys; a row here is what an OWNER created by switching one on. Two consequences,
-- both of them the reason for the design:
--
--   * `isEnabled()` returns false for a flag with no row. Absence and "off" are the same state,
--     so a fresh database, a restored backup and a preview branch all behave identically, and
--     nobody has to remember to seed a flag before a feature can be dark.
--   * A flag key is an IDENTIFIER, referenced from code as `isEnabled('commission_configurator')`.
--     Identifiers belong in the type system, where deleting a flag breaks its call sites at
--     compile time. A row cannot do that, and a row that had drifted from the code would show the
--     owner a switch that controls nothing.
--
-- It also keeps this file honest about `db:check-migrations` rule 1: a migration carries structure
-- and a seed carries content, and two rows saying `false` would have been content dressed as
-- structure — recreated by every `db:reset` and quietly overwriting whatever the owner had set.
--
-- WRITEABLE UNDER `system.flags.write`, WHICH IS OWNER AND ADMIN — not owner alone. The Phase 19
-- document calls this screen "owner-only" and the Phase 04 matrix has said owner+admin since it
-- shipped; DATA_MODEL and STUDIO_GUIDE both already follow the matrix, and STUDIO_GUIDE's open
-- question 5 records the disagreement. Amendment A17 closes it in the matrix's favour, for the
-- reason amendment A7 gave in the same situation: a later phase's prose does not narrow a shipped
-- authorisation. Every toggle is audited, so an admin's flip has a name against it either way.
-- ============================================================================================

set search_path = public, extensions;

create table feature_flags (
  -- THE KEY IS THE IDENTITY. Call sites read `isEnabled('three_d_viewer')` and never hold a uuid;
  -- a surrogate key would add a lookup to every read and buy nothing. DATA_MODEL §1.1 carve-out.
  key         text primary key,
  description text,
  is_enabled  boolean not null default false,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id),

  -- The same shape `lib/flags/flags.ts` requires of a registered key, so a row written by hand
  -- through psql cannot claim a key the type system would refuse.
  constraint feature_flags_key_shape check (key ~ '^[a-z][a-z0-9_]*$')
);

comment on table feature_flags is
  'A flag is off unless a row says otherwise, so absence and false are the same state. The register of which flags exist is lib/flags/flags.ts; this table holds only the ones somebody switched.';
comment on column feature_flags.is_enabled is
  'Evaluated server-side only. A flag never reaches the browser as a flag — it reaches it as markup that is present or absent.';

create trigger feature_flags_set_updated_at
  before update on public.feature_flags
  for each row execute function public.set_updated_at();

alter table feature_flags enable row level security;
