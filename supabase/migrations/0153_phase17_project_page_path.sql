-- ============================================================================================
-- 0153 — a project's story page follows its slug
--
-- WHAT WAS MISSING. `0150` extended `sync_entity_page_status` so publishing a PROJECT page publishes
-- its project, which is half of the entity-page pattern Phase 16 established. The other half — the
-- page's PATH following the entity's slug — was extended for collections in `0141` and not for
-- projects. Without it a project renamed from `oak-console` to `oak-console-ii` keeps a page at
-- `/portfolio/oak-console`, so `/portfolio/oak-console-ii` is a 404 and the old URL serves the
-- renamed project. Both are silent.
--
-- A SECOND FUNCTION RATHER THAN A GENERALISED ONE, matching the two evidence gates: the trigger
-- fires on `portfolio_projects` and reads `new.slug` from it. A shared function would have to be
-- told which table it was on, and plpgsql resolves `new.<field>` at execution — the same trap the
-- evidence gates avoid by being two functions.
--
-- SECURITY DEFINER for the reason `sync_collection_page_path` records: `pages_update_staff` admits
-- owner/admin/editor, and this trigger fires under whoever edited the project. An invoker-rights
-- trigger would have that UPDATE FILTERED AWAY BY RLS — zero rows, no error, the path silently
-- stale and the project's URL a 404 with nothing in the logs.
--
-- LOWERCASED, because `portfolio_projects.slug` is citext and preserves whatever case was typed
-- while `pages_path_shape` refuses any upper-case character.
-- ============================================================================================

create or replace function public.sync_project_page_path() returns trigger
  language plpgsql
  security definer
  set search_path = pg_catalog, public
  as $$
begin
  if new.page_id is not null and (tg_op = 'INSERT' or new.slug is distinct from old.slug) then
    update pages
       set path = '/portfolio/' || lower(new.slug::text)
     where id = new.page_id;
  end if;
  return new;
end $$;

comment on function public.sync_project_page_path() is
  'Keeps a project story page addressable at the project slug. SECURITY DEFINER because the role that edits projects may not update pages, and an RLS-filtered UPDATE reports success while changing nothing.';

revoke execute on function public.sync_project_page_path() from public, anon, authenticated;

create trigger portfolio_projects_sync_page_path
  after insert or update of slug, page_id on portfolio_projects
  for each row execute function public.sync_project_page_path();
