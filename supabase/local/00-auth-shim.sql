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

-- =================================================================================================
-- PHASE 04 ADDITION — still LOCAL VERIFICATION ONLY, still not a migration.
-- =================================================================================================
--
-- Phase 04's policies are written `to anon, authenticated` and call auth.uid(). On a plain cluster
-- those roles do not exist, so migration 0011 would not even parse ("role \"anon\" does not
-- exist"). This is the minimum that lets the real migrations apply unmodified and, more
-- importantly, lets an RLS test MEAN something.
--
-- THE GRANTS BELOW ARE THE MOST IMPORTANT LINES IN THIS FILE. Read the note above them before
-- touching anything here.

-- 1. The four roles PostgREST switches between --------------------------------------------------
-- PostgREST logs in as exactly one role, `authenticator`, verifies the request's JWT, then issues
-- `set local role <the JWT's role claim>` for that request's transaction. NOINHERIT is what makes
-- `set role` the only way to acquire privileges, exactly as it works there.
--
-- Roles are CLUSTER-wide, so they survive db:reset's schema drop. Each is therefore created only
-- if absent but ALTERed unconditionally — a role left behind by an earlier experiment must not
-- silently carry different attributes into a test run.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon')          then create role anon;          end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role')  then create role service_role;  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator; end if;
end
$$;

alter role anon          with nologin noinherit nocreatedb nocreaterole nobypassrls;
alter role authenticated with nologin noinherit nocreatedb nocreaterole nobypassrls;
-- BYPASSRLS is how the service-role key ignores every policy. It is a ROLE ATTRIBUTE, not a
-- policy — which is why no amount of policy review can constrain it, and why lib/supabase/admin.ts
-- carries the warning it does.
alter role service_role  with nologin noinherit nocreatedb nocreaterole bypassrls;
alter role authenticator with login    noinherit nocreatedb nocreaterole nobypassrls;

grant anon, authenticated, service_role to authenticator;

-- 2. The grants ---------------------------------------------------------------------------------
-- On Supabase, `anon` and `authenticated` hold SELECT, INSERT, UPDATE and DELETE on every table in
-- `public`, and ALTER DEFAULT PRIVILEGES hands the same to every table a future migration creates.
-- GRANT IS NOT THE SECURITY BOUNDARY THERE. RLS IS THE WHOLE OF IT.
--
-- Reproducing that here is not tidiness, it is what makes the RLS suite honest. Without these
-- lines a denied query fails with "permission denied for table" — a PASS FOR THE WRONG REASON.
-- Every "anon must not see X" assertion would go green while proving nothing, and a table that
-- shipped without `enable row level security` would look safe locally and be world-readable in
-- production. The same applies to `revoke update, delete on audit_logs`: without a prior grant it
-- revokes nothing, and the append-only guarantee is tested by a no-op.
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth   to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all routines  in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

-- 3. auth.users, widened to what Phase 04 reads -------------------------------------------------
-- Deliberately NOT granted to anon/authenticated/service_role: on Supabase they hold usage on the
-- schema and nothing on the table, so a policy that tried to join auth.users must fail here
-- exactly as it would there.
--
-- These rows remain a fiction in one direction worth remembering: on Supabase, GoTrue owns this
-- table and an application never inserts into it. Fixtures belong in staff_profiles.
alter table auth.users add column if not exists aud                varchar(255) default 'authenticated';
alter table auth.users add column if not exists role               varchar(255) default 'authenticated';
alter table auth.users add column if not exists email              varchar(255);
alter table auth.users add column if not exists raw_app_meta_data  jsonb default '{}'::jsonb;
alter table auth.users add column if not exists raw_user_meta_data jsonb default '{}'::jsonb;
alter table auth.users add column if not exists is_anonymous       boolean not null default false;
alter table auth.users add column if not exists created_at         timestamptz default now();
alter table auth.users add column if not exists updated_at         timestamptz default now();
alter table auth.users add column if not exists deleted_at         timestamptz;

-- 4. The claim readers --------------------------------------------------------------------------
-- PostgREST sets one text GUC per transaction, `request.jwt.claims`, holding the whole verified
-- claims object as JSON. The older per-claim GUCs are the first arm of each coalesce because
-- Supabase's own definitions keep them for PostgREST <= 8 compatibility.
--
-- The `true` second argument to current_setting is load-bearing: without it an unset GUC RAISES
-- and aborts the transaction rather than returning null.
create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim',  true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

create or replace function auth.uid() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

create or replace function auth.email() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;

grant execute on function auth.jwt(), auth.uid(), auth.role(), auth.email()
  to anon, authenticated, service_role;

-- 5. An empty `extensions` schema ---------------------------------------------------------------
-- Hosted projects have one and put citext/unaccent/pg_trgm in it. Creating it here means the
-- migrations' `set search_path = public, extensions` resolves identically in both places rather
-- than silently naming a schema that does not exist. `npm run db:check-hosted-layout` is what
-- actually proves the placement is handled.
create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;

comment on schema auth is
  'LOCAL SHIM. On Supabase this schema, its roles, its grants and auth.uid()/role()/jwt() are provisioned by the platform.';
