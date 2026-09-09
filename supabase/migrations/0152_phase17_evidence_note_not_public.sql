-- ============================================================================================
-- 0152 — `evidence_note` is staff-only, at the grant rather than in a query
--
-- WHAT THIS FIXES. `portfolio_projects` is an RLS shape-A table: anon may `select` a row whose
-- status is PUBLISHED. RLS filters ROWS, not COLUMNS — so with only that policy in place, every
-- column of a published project is public, `evidence_note` among them.
--
-- That column is where an owner writes what proves the project happened: an invoice number, a
-- delivery date, "photos in the shared folder", possibly a client's own reference. It exists so
-- that "is this real" has an answer written down. It is emphatically not for visitors, and a
-- repository that simply declines to select it protects nothing — PostgREST builds its column list
-- from the request, so `?select=evidence_note` returns it to anyone holding the anon key.
--
-- SO THE FIX IS A COLUMN-LEVEL REVOKE, which composes with RLS: the policy decides which rows, the
-- grant decides which columns, and neither can be talked out of its half by a crafted request.
--
-- THE COST IS THAT `select *` NO LONGER WORKS FOR ANON on this table, and that is why the public
-- repository read names its columns explicitly. This is a real constraint on future code rather
-- than a detail: a new public read that reaches for `*` will fail with `permission denied for
-- column evidence_note` instead of quietly leaking it, which is the right way round.
--
-- `authenticated` KEEPS THE COLUMN. Every staff role that can read the table at all needs it — it
-- is the field the Verification panel shows the owner while they decide whether to publish.
-- ============================================================================================

-- A COLUMN-LEVEL REVOKE ALONE DOES NOTHING HERE, and that was measured rather than assumed. `anon`
-- holds a TABLE-level SELECT on this table (Supabase grants it on everything in `public`), and
-- PostgreSQL treats table and column privileges as independent grants: revoking the column while
-- the table grant stands leaves `has_column_privilege('anon', …, 'evidence_note', 'select')` true.
-- The first version of this migration did exactly that and changed nothing.
--
-- So the table grant is dropped and the permitted columns are granted back by name. The column list
-- is therefore a closed allow-list: a column added to this table in a later phase is NOT public
-- until someone adds it here, which is the safer default for a table whose whole subject is other
-- people's projects.
revoke select on public.portfolio_projects from anon;

grant select (
  id, slug, page_id, title, subtitle, summary, project_type, location_label, completed_on,
  is_client_project, client_display_name, client_consent, client_consent_reference,
  client_consent_recorded_at, client_consent_recorded_by, hero_media_id, seo_entry_id,
  sort_order, status, owner_verification, fact_classification, published_at, published_by,
  created_at, updated_at, updated_by
) on public.portfolio_projects to anon;

comment on column public.portfolio_projects.evidence_note is
  'What proves this project happened — an invoice reference, a delivery date, where the photographs live. STAFF ONLY: 0152 revokes column-level SELECT from anon, because RLS filters rows and not columns. Never rendered publicly.';
