-- 00-auth-shim.sql — LOCAL VERIFICATION ONLY. NOT A MIGRATION. NEVER RUN AGAINST SUPABASE.
--
-- Supabase provisions the `auth` schema and `auth.users` before any of our migrations run, so a
-- hosted project already has the table that `updated_by uuid references auth.users(id)` points at.
-- A plain PostgreSQL cluster does not.
--
-- This file is the smallest stand-in that lets the real migrations run unmodified against a plain
-- cluster. That is the whole point: the migrations stay production-accurate — they are not
-- softened to "uuid with no foreign key" so they can be tested — and the difference between here
-- and Supabase is isolated to this one file, where it is visible.
--
-- It creates ONLY the column our foreign keys reference. It is not a reimplementation of Supabase
-- Auth, it holds no rows, and nothing in the application may ever read it.
--
-- Applied by scripts/db/reset.mjs before migration 0001. It lives outside supabase/migrations/ so
-- it can never be picked up by `supabase db push`.

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid()
);

comment on schema auth is
  'LOCAL SHIM. On Supabase this schema is provisioned by the platform and contains the real auth tables.';
