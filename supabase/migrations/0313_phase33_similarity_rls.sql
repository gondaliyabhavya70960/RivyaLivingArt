-- 0313_phase33_similarity_rls.sql — Phase 33
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for the four research tables migration 0310 creates and the ONE first-party table
-- migration 0311 creates. GENERATED from lib/auth/table-permissions.ts and rewritten whole, so it
-- may hold nothing a human wrote.
--
--   `research_image_hashes`            SERVICE-ROLE WRITES ONLY, and under amendment A33 there is
--                                      no writer: competitor images are referenced by URL and never
--                                      fetched, so the table holds no rows. Readable by research.read.
--
--   `research_similarity_runs`         research.similarity.run — owner, admin, researcher. A run is
--                                      an operator's act, recorded with its counts. No delete leg.
--
--   `research_similarity_pairs`        SERVICE-ROLE WRITES ONLY, with its run. Readable by research.read.
--
--   `research_similarity_suppressions` research.write records and undoes a dismissal.
--
--   `media_asset_hashes`               NOT A RESEARCH TABLE. Read under media.read, exactly as
--                                      media_assets is; written by the service role only (the
--                                      upload path and npm run media:hash). A hash is not published
--                                      content, so there is no anon leg here either.
--
-- ISOLATION INVARIANT I2 IS UNCHANGED: not one `anon` leg appears below, on any of the five.
-- I1 IS UNCHANGED TOO: the research tables reference research tables; media_asset_hashes
-- references media_assets; neither names the other, in a constraint or a policy.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- research_image_hashes — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. Perceptual hashes of competitor images. Service-role writes only, and under
-- amendment A33 no writer exists: competitor images are referenced by URL and never fetched. No
-- anon policy (I2).
-- read: research.read (owner, admin, merchandiser, researcher, viewer)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_image_hashes_select_staff on research_image_hashes for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

-- No write policy for authenticated: see the deviation note above.

-- ----------------------------------------------------------------------------------------------
-- research_similarity_runs — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. A similarity run is an operator act: research.similarity.run (owner, admin,
-- researcher) inserts and closes it. Delete is nobody: a run is a record of what was compared. No
-- anon policy (I2).
-- read: research.read (owner, admin, merchandiser, researcher, viewer)   write: research.similarity.run (owner, admin, researcher)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_similarity_runs_select_staff on research_similarity_runs for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

create policy research_similarity_runs_insert_staff on research_similarity_runs for insert
  to authenticated with check (public.has_role('owner','admin','researcher'));

create policy research_similarity_runs_update_staff on research_similarity_runs for update
  to authenticated using  (public.has_role('owner','admin','researcher'))
                with check (public.has_role('owner','admin','researcher'));

-- ----------------------------------------------------------------------------------------------
-- research_similarity_pairs — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. Two research hashes and a banded distance. Service-role writes only, with
-- its run. No anon policy (I2).
-- read: research.read (owner, admin, merchandiser, researcher, viewer)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_similarity_pairs_select_staff on research_similarity_pairs for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

-- No write policy for authenticated: see the deviation note above.

-- ----------------------------------------------------------------------------------------------
-- research_similarity_suppressions — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. A dismissed pair, with its reason. research.write records and undoes a
-- dismissal — a judgement about a picture, not a verdict on a product. No anon policy (I2).
-- read: research.read (owner, admin, merchandiser, researcher, viewer)   write: research.write (owner, admin, researcher)

-- No anon policy. Shape C tables are never publicly readable.

create policy research_similarity_suppressions_select_staff on research_similarity_suppressions for select
  to authenticated using (public.has_role('owner','admin','merchandiser','researcher','viewer'));

create policy research_similarity_suppressions_insert_staff on research_similarity_suppressions for insert
  to authenticated with check (public.has_role('owner','admin','researcher'));

create policy research_similarity_suppressions_update_staff on research_similarity_suppressions for update
  to authenticated using  (public.has_role('owner','admin','researcher'))
                with check (public.has_role('owner','admin','researcher'));

create policy research_similarity_suppressions_delete_staff on research_similarity_suppressions for delete
  to authenticated using (public.has_role('owner','admin','researcher'));

-- ----------------------------------------------------------------------------------------------
-- media_asset_hashes — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. FIRST-PARTY, not research: the hashes of Rivya's own library, following the
-- Phase 06 media read policy. Service-role writes only (the upload path and media:hash). A hash is
-- not published content, so no anon policy.
-- read: media.read (owner, admin, editor, merchandiser, researcher, viewer)

-- No anon policy. Shape C tables are never publicly readable.

create policy media_asset_hashes_select_staff on media_asset_hashes for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','researcher','viewer'));

-- No write policy for authenticated: see the deviation note above.
