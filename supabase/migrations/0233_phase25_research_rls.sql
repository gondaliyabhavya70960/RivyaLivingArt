-- 0233_phase25_research_rls.sql — Phase 25
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for the nine research tables, which migrations 0231 and 0232 create. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote.
--
-- ISOLATION INVARIANT I2 IS THIS FILE. NOT ONE `anon` POLICY APPEARS BELOW, on any table, and
-- none ever may. There is no visitor-facing view of a competitor's catalogue, of what Rivya
-- fetched from one, or of what it decided about the result — so an anon leg here would not be a
-- change of policy but a defect with a syntax. `scripts/research/check-research-isolation.mjs`
-- reads `pg_policies` and fails the build the moment one exists.
--
-- READ IS `research.read` THROUGHOUT — owner, admin, merchandiser, researcher and viewer.
-- `editor` is the one role that does not hold it, which is the line Phase 23 already drew for
-- `research_search_documents`.
--
-- WRITE SPLITS THREE WAYS, AND THE SPLIT IS THE PHASE DOCUMENT'S: a researcher OPERATES the
-- pipeline and a merchandiser JUDGES its output.
--
--   research.write    sources, jobs, runs — the machinery
--   research.confirm  research_products — because its editable columns here are `stage` and
--                     `disposition`, and both are disposition-bearing. The dividing line is the
--                     COLUMN, not the screen
--   nobody            fetches, raw items, work items, the robots cache and the pipeline events
--
-- THAT LAST GROUP IS THE POLITENESS POSTURE, AND IT IS WHY THEY HAVE NO SESSION WRITE. A row in
-- `research_fetches` is the evidence that a URL was refused before any packet left; a session
-- able to write one could record a request that never happened, or claim a robots-DISALLOWED URL
-- had been ALLOWED. A session able to write `research_robots_cache` could tell the fetcher that a
-- forbidden host permits everything. A session able to write `research_work_items` could clear a
-- `not_before_at` and edit the rate limit from inside the building. All four are written by the
-- engine through the service role, after `requirePermission`.
--
-- `research_pipeline_events` IS APPEND-ONLY, the `audit_logs` precedent applied to the
-- pipeline's own history: no write policy at all, and 0231 revokes update and delete outright.
-- `lib/scraper/core/stage.ts` writes it in the same call that moves the stage, so a move without
-- an event is not something that can happen.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- research_sources — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. A competitor website and its politeness settings. No anon policy may ever
-- exist on any research_* table (isolation invariant I2). Enabling one, and approving its policy
-- review, additionally require system.settings.write and are checked in the server action — RLS
-- cannot express a per-column rule, and the row-level CHECK refuses an enabled source that was
-- never approved whatever the session.
-- read: research.read (owner, admin, merchandiser, researcher, viewer)   write: research.write (owner, admin, researcher)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_sources_select_staff on research_sources for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

create policy research_sources_insert_staff on research_sources for insert
  to authenticated with check (public.has_role('owner','admin','researcher'));

create policy research_sources_update_staff on research_sources for update
  to authenticated using  (public.has_role('owner','admin','researcher'))
                with check (public.has_role('owner','admin','researcher'));

create policy research_sources_delete_staff on research_sources for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- research_jobs — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. The standing definition of work against a source. Staff-only under
-- research.read; operated by research.write, which is owner, admin and researcher.
-- read: research.read (owner, admin, merchandiser, researcher, viewer)   write: research.write (owner, admin, researcher)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_jobs_select_staff on research_jobs for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

create policy research_jobs_insert_staff on research_jobs for insert
  to authenticated with check (public.has_role('owner','admin','researcher'));

create policy research_jobs_update_staff on research_jobs for update
  to authenticated using  (public.has_role('owner','admin','researcher'))
                with check (public.has_role('owner','admin','researcher'));

create policy research_jobs_delete_staff on research_jobs for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- research_runs — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. One execution of a job. A researcher may queue and cancel one; nobody
-- deletes one, because a run is the record of what Rivya asked a third party for and when.
-- read: research.read (owner, admin, merchandiser, researcher, viewer)   write: research.write (owner, admin, researcher)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_runs_select_staff on research_runs for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

create policy research_runs_insert_staff on research_runs for insert
  to authenticated with check (public.has_role('owner','admin','researcher'));

create policy research_runs_update_staff on research_runs for update
  to authenticated using  (public.has_role('owner','admin','researcher'))
                with check (public.has_role('owner','admin','researcher'));

-- ----------------------------------------------------------------------------------------------
-- research_work_items — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. The lease queue. Readable by staff so a run can be watched, and written by
-- NOBODY with a session: the drain loop leases and releases through the service role. A session
-- able to write here could re-point a queued URL or clear a not_before_at, which is the rate limit
-- being edited from inside the building.
-- read: research.read (owner, admin, merchandiser, researcher, viewer)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_work_items_select_staff on research_work_items for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

-- No write policy for authenticated: see the deviation note above.

-- ----------------------------------------------------------------------------------------------
-- research_fetches — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. One attempt per row, including the ones refused before any packet left. No
-- session write: a hand-written fetch row could record a request that never happened, or claim a
-- robots-DISALLOWED URL had been ALLOWED — which is the evidence that the rules were honoured
-- being forged.
-- read: research.read (owner, admin, merchandiser, researcher, viewer)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_fetches_select_staff on research_fetches for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

-- No write policy for authenticated: see the deviation note above.

-- ----------------------------------------------------------------------------------------------
-- research_raw_items — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. What a page said, unstructured. Written only by the pipeline through the
-- service role, after the Zod schema that refuses anything richer than a title, a canonical URL
-- and links.
-- read: research.read (owner, admin, merchandiser, researcher, viewer)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_raw_items_select_staff on research_raw_items for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

-- No write policy for authenticated: see the deviation note above.

-- ----------------------------------------------------------------------------------------------
-- research_products — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. A discovered product, carried through the seven FEAT §23 stages. Write is
-- research.confirm rather than research.write because the two columns a person edits in this phase
-- are stage and disposition, and the dividing line the phase document draws is the column rather
-- than the screen. It has no foreign key to any public table and never will (isolation invariant
-- I1).
-- read: research.read (owner, admin, merchandiser, researcher, viewer)   write: research.confirm (owner, admin, merchandiser)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_products_select_staff on research_products for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

create policy research_products_insert_staff on research_products for insert
  to authenticated with check (public.has_role('owner','admin','merchandiser'));

create policy research_products_update_staff on research_products for update
  to authenticated using  (public.has_role('owner','admin','merchandiser'))
                with check (public.has_role('owner','admin','merchandiser'));

-- ----------------------------------------------------------------------------------------------
-- research_pipeline_events — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. Append-only. No anon policy, no authenticated write policy of any kind, and
-- update and delete are revoked outright in 0231. Only lib/scraper/core/stage.ts writes it,
-- through the service role, in the same call that moves the stage — so a move without an event is
-- not a thing that can happen.
-- read: research.read (owner, admin, merchandiser, researcher, viewer)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_pipeline_events_select_staff on research_pipeline_events for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

-- No write policy for authenticated: see the deviation note above.

-- ----------------------------------------------------------------------------------------------
-- research_robots_cache — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. One robots.txt per host, 24-hour TTL. Readable so an operator can see what a
-- host asked for; written by nobody with a session, because a hand-written row could tell the
-- fetcher that a forbidden host permits everything.
-- read: research.read (owner, admin, merchandiser, researcher, viewer)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_robots_cache_select_staff on research_robots_cache for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

-- No write policy for authenticated: see the deviation note above.
