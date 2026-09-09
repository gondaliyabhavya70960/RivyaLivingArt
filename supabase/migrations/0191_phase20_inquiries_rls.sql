-- 0191_phase20_inquiries_rls.sql — Phase 20
--
-- GENERATED FILE. Do not edit by hand.
--
-- Produced by `npm run auth:gen-policies` from lib/auth/permissions.ts and
-- lib/auth/table-permissions.ts. `npm run auth:check-policies` regenerates and diffs, so a matrix
-- change that is not reflected here fails the build — and so does a hand edit here.
--
-- Policies for the three tables migration 0190 creates. GENERATED from
-- lib/auth/table-permissions.ts and rewritten whole, so it may hold nothing a human wrote.
--
-- `inquiries` IS THE ONLY TABLE ON THIS SITE A STRANGER MAY WRITE, and the only one whose write
-- has no session behind it. D1 forbids customer accounts, so the person filling in the form is
-- nobody: the `with check` below is doing the work `requirePermission` does everywhere else.
--
-- THERE IS NO ANON SELECT ON ANY OF THE THREE, and that absence is the most load-bearing thing in
-- this file. An enquiry carries a name, a phone number, a city and whatever a visitor chose to say
-- about their home; one `using (true)` and the customer list is a GET away through PostgREST,
-- with the publishable key that ships in every browser. anon INSERTS and never reads back — not
-- even the row it has just written.
--
-- READ IS `inquiries.read`, WHICH THE RESEARCHER DOES NOT HOLD. table-permissions.ts used this
-- table as its worked example years before it existed: `using (is_staff())` here would hand every
-- customer's phone number to a role whose entire remit is looking at competitors.
--
-- `inquiry_attachments` HAS NO ANON INSERT despite the phase document naming one. An attachment
-- references `media_assets`, and anon cannot create one of those — so the policy would describe a
-- path with no way to satisfy its own foreign key. `attach_inquiry_references()` is SECURITY
-- DEFINER instead (amendment A20). `inquiry_events` has no write policy at all: it is written by
-- triggers and refuses UPDATE and DELETE outright.

set search_path = public, extensions;

-- ----------------------------------------------------------------------------------------------
-- inquiries — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. No anon SELECT of any kind. An enquiry carries a name, a phone number and a
-- city; a public read policy would publish the customer list through PostgREST with the
-- publishable key that ships in every browser. anon INSERTS and never reads back — not even the
-- row it just wrote.
-- read: inquiries.read (owner, admin, editor, merchandiser, viewer)   write: inquiries.write (owner, admin, merchandiser)

-- No anon SELECT policy. Shape C tables are never publicly readable; this one is written by anon and read by nobody outside the studio.

-- ANON INSERT. The public write path. A visitor has no account, so this predicate is the whole
-- guard: it pins the enquiry to the start of the pipeline, unassigned, with no claimed editor and
-- no claimed handoff. `reference_code` is not pinned here because the BEFORE trigger overwrites
-- it, which is stronger than a check — a caller cannot supply one at all.
create policy inquiries_insert_public on inquiries for insert
  to anon, authenticated with check (pipeline_status = 'NEW' and assigned_to is null and updated_by is null and whatsapp_state = 'NOT_SENT');

create policy inquiries_select_staff on inquiries for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','viewer'));

create policy inquiries_insert_staff on inquiries for insert
  to authenticated with check (public.has_role('owner','admin','merchandiser'));

create policy inquiries_update_staff on inquiries for update
  to authenticated using  (public.has_role('owner','admin','merchandiser'))
                with check (public.has_role('owner','admin','merchandiser'));

-- ----------------------------------------------------------------------------------------------
-- inquiry_attachments — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. No anon policy of either kind. A public read would list what a customer
-- sent; a public insert could not satisfy its foreign key, because anon cannot create the
-- media_assets row an attachment points at. Rows arrive through attach_inquiry_references(), which
-- is SECURITY DEFINER, checks the enquiry is fresh, and refuses a public_id outside the incoming
-- folder.
-- read: inquiries.read (owner, admin, editor, merchandiser, viewer)

-- No anon policy. Shape C tables are never publicly readable.

create policy inquiry_attachments_select_staff on inquiry_attachments for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','viewer'));

-- No write policy for authenticated: see the deviation note above.

-- ----------------------------------------------------------------------------------------------
-- inquiry_events — shape C
-- ----------------------------------------------------------------------------------------------
-- DECLARED DEVIATION. No anon policy, and no UPDATE or DELETE policy for any session role. Staff
-- holding inquiries.write may APPEND an event; nobody may change one, because a log that can be
-- edited cannot answer what happened.
-- read: inquiries.read (owner, admin, editor, merchandiser, viewer)   write: inquiries.write (owner, admin, merchandiser)

-- No anon policy. Shape C tables are never publicly readable.

create policy inquiry_events_select_staff on inquiry_events for select
  to authenticated using (public.has_role('owner','admin','editor','merchandiser','viewer'));

create policy inquiry_events_insert_staff on inquiry_events for insert
  to authenticated with check (public.has_role('owner','admin','merchandiser'));

-- NO UPDATE POLICY. APPEND ONLY. A trigger refuses UPDATE and DELETE for every role including the
-- owner, so an update policy would name a path the database will not take. Staff APPEND — a note,
-- an export record — and the timeline is what happened rather than what somebody later wished had
-- happened.
