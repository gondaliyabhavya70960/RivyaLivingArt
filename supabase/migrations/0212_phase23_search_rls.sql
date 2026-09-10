-- 0212_phase23_search_rls.sql — Phase 23
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for `search_documents`, `research_search_documents` and `search_queries`, which
-- migration 0210 creates. GENERATED from lib/auth/table-permissions.ts and rewritten whole, so it
-- may hold nothing a human wrote.
--
-- THE INDEX IS READ BY ANON AND WRITTEN BY NOBODY. `search_documents` gets the one named `anon`
-- grant §1.5 permits — `visibility = 'PUBLIC' and status = 'PUBLISHED'` — and NO insert or update
-- policy for any session role at all. Every row is written by `refresh_search_document()`, a
-- security-definer trigger function (0211), so a signed-in member of staff cannot hand-write a
-- search result carrying a title, a URL and a picture that the entity itself does not say.
--
-- TWO INDEXES, AND THE SECOND HAS NO ANON LEG AND NEVER WILL. `research_search_documents` is
-- staff-only under `research.read` — the one permission `editor` does not hold — which is
-- research isolation invariant I2 arriving two phases before the subsystem it protects.
--
-- `search_queries` IS NOT PUBLICLY READABLE EITHER, in either direction: a visitor may not read
-- what other visitors searched for, and may not write a row claiming a search that never happened.
-- Both scopes log through the service role.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- search_documents — shape A
-- ----------------------------------------------------------------------------------------------
-- read: catalog.read (owner, admin, editor, merchandiser, researcher, viewer)

create policy search_documents_select_public on search_documents for select
  to anon, authenticated using (visibility = 'PUBLIC' and status = 'PUBLISHED');

create policy search_documents_select_staff on search_documents for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

-- No write policy for authenticated: see the deviation note above.

-- ----------------------------------------------------------------------------------------------
-- research_search_documents — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. The research corpus. No anon policy may ever exist on any research_* table
-- (isolation invariant I2), and no authenticated write policy either: the index is maintained by
-- the Phase 25-28 pipeline through the service role, never by a session.
-- read: research.read (owner, admin, merchandiser, researcher, viewer)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_search_documents_select_staff on research_search_documents for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

-- No write policy for authenticated: see the deviation note above.

-- ----------------------------------------------------------------------------------------------
-- search_queries — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. A record of searches, not content. No anon read: it would expose what other
-- visitors looked for. No authenticated write: public searches have no session, so logging runs
-- through the service role for both scopes rather than opening an anon insert policy.
-- read: analytics.read (owner, admin, editor, merchandiser, researcher, viewer)

-- No anon policy. Shape C tables are never publicly readable.

create policy search_queries_select_staff on search_queries for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

-- No write policy for authenticated: see the deviation note above.
