-- 0221_phase24_bulk_rls.sql — Phase 24
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for the four bulk tables, which migration 0220 creates. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote.
--
-- FOUR SHAPE-C TABLES AND NOT ONE WRITE POLICY BETWEEN THEM. Every write goes through
-- `lib/bulk/run.ts` on the service-role client, AFTER `requirePermission`. An `authenticated`
-- insert policy would let a signed-in merchandiser hand-write a `bulk_operations` row — a preview
-- carrying a selection nobody previewed, or a SUCCEEDED row for an operation that never ran — and
-- an update policy on `bulk_operation_items` would let one edit the `before` snapshot that undo
-- re-applies, writing anything they liked into a live row while the audit log recorded a
-- restoration.
--
-- NO DELETE POLICY FOR THE TWO RECORD TABLES, EVER, and 0220 revokes the grant as well. They are
-- the account of what somebody did to a page of live content, and a record its author can erase is
-- not a record. The two IMPORT tables are deletable under `destructive.execute`, because an
-- import is a working file whose rows are pruned at thirty days rather than history.
--
-- READ IS `bulk.execute` (owner, admin, merchandiser). The phase document says "bulk.execute or
-- operations.audit.read"; those two hold {owner, admin, merchandiser} and {owner, admin}, so the
-- union IS `bulk.execute`'s set and naming the wider one is the same policy with one fewer thing
-- that can drift.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- bulk_operations — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. The record of a bulk operation. No anon policy — a visitor has no business
-- knowing what was archived — and no authenticated write policy: the engine writes through the
-- service role after requirePermission, so a session cannot forge a preview or a result. Delete is
-- absent by design and revoked in 0220.
-- read: bulk.execute (owner, admin, merchandiser)

-- No anon policy. Shape C tables are never publicly readable.

create policy bulk_operations_select_staff on bulk_operations for select
  to authenticated using (public.has_role('owner','admin','merchandiser'));

-- No write policy for authenticated: see the deviation note above.

-- ----------------------------------------------------------------------------------------------
-- bulk_operation_items — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. The per-item before/after snapshot the 24-hour undo re-applies. Same
-- reasoning as bulk_operations, and one more: a session able to edit `before` could make an undo
-- write whatever it liked into a live row while the audit log recorded a restoration.
-- read: bulk.execute (owner, admin, merchandiser)

-- No anon policy. Shape C tables are never publicly readable.

create policy bulk_operation_items_select_staff on bulk_operation_items for select
  to authenticated using (public.has_role('owner','admin','merchandiser'));

-- No write policy for authenticated: see the deviation note above.

-- ----------------------------------------------------------------------------------------------
-- bulk_imports — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. An uploaded file and its column mapping. No anon policy and no session
-- write: the import pipeline runs through the service role after requirePermission, and the
-- uploaded file itself is not retained after apply.
-- read: bulk.execute (owner, admin, merchandiser)

-- No anon policy. Shape C tables are never publicly readable.

create policy bulk_imports_select_staff on bulk_imports for select
  to authenticated using (public.has_role('owner','admin','merchandiser'));

-- No write policy for authenticated: see the deviation note above.

create policy bulk_imports_delete_staff on bulk_imports for delete
  to authenticated using (public.has_role('owner','admin'));

-- ----------------------------------------------------------------------------------------------
-- bulk_import_rows — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. One row of an uploaded file, retained 30 days for post-hoc review. No anon
-- policy — it is an operator's spreadsheet — and no session write: only the import pipeline writes
-- it.
-- read: bulk.execute (owner, admin, merchandiser)

-- No anon policy. Shape C tables are never publicly readable.

create policy bulk_import_rows_select_staff on bulk_import_rows for select
  to authenticated using (public.has_role('owner','admin','merchandiser'));

-- No write policy for authenticated: see the deviation note above.

create policy bulk_import_rows_delete_staff on bulk_import_rows for delete
  to authenticated using (public.has_role('owner','admin'));
