-- 0251_phase27_extraction_rls.sql — Phase 27
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for the two extraction tables, which migration 0250 creates. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote. Its own
-- file for the reason every generated policy file has one: 0250 carries the DDL, and a shipped
-- generated file is never re-opened.
--
-- READ ONLY, FOR EVERYONE, AND THAT IS THE WHOLE FILE. Four select policies' worth of decision:
-- `research.read` may look, and no session role may write either table by any means.
--
-- WHY NOT `research.write` ON THE VERSIONS TABLE, which a reader might expect by analogy with
-- `research_sources`? Because these two tables are not configuration — they are the RECORD of what
-- happened. `research_product_versions` is what Phase 29 diffs to say a competitor's price moved,
-- and `research_adapter_runs` is what proves a broken adapter stopped at its own source. A
-- researcher able to edit the first could make a change appear that never happened; one able to
-- edit the second could make a failure they caused look like somebody else's. Both are written by
-- `lib/scraper/workflows/extract.ts` through the service role, after the drain loop has already
-- checked the kill switch, the policy review and robots.txt.
--
-- ISOLATION INVARIANT I2 IS UNCHANGED AND UNCHANGEABLE: not one `anon` leg appears below, on
-- either table, and `scripts/research/check-research-isolation.mjs` fails the build the moment one
-- does.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- research_product_versions — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. One observation of one product, append-only and deduplicated by content
-- hash. No anon policy may ever exist on any research_* table (isolation invariant I2), and no
-- session write policy of any kind: this table is the evidence a change record is reproduced from,
-- and evidence its author can edit is not evidence.
-- read: research.read (owner, admin, merchandiser, researcher, viewer)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_product_versions_select_staff on research_product_versions for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

-- No write policy for authenticated: see the deviation note above.

-- ----------------------------------------------------------------------------------------------
-- research_adapter_runs — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. The per-(run, source, adapter) accounting that makes FEAT §27's isolation
-- claim checkable. Staff read it on the run detail screen; nobody writes it with a session,
-- because a record of what failed that the failing party can edit proves nothing.
-- read: research.read (owner, admin, merchandiser, researcher, viewer)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_adapter_runs_select_staff on research_adapter_runs for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

-- No write policy for authenticated: see the deviation note above.
