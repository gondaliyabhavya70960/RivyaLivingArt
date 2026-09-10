-- ============================================================================================
-- 0234 — Phase 25: fill the research index, and correct the status allowlist it was given
--
-- WHY THERE IS A FIFTH MIGRATION IN THIS PHASE. `research_search_documents` was created in Phase
-- 23 (0210), two phases before the subsystem that fills it, so that the separation between the two
-- corpora was visible in the schema from the day there was a search index at all. That was the
-- right call and it is unchanged. What it could not get right in advance is this:
--
--   constraint research_search_documents_status_allowlist
--     check (status in ('RAW','NORMALIZED','VALIDATED','MATCHED','REVIEW','SHORTLISTED','CONFIRMED'))
--
-- Those are the seven FEAT §23 STAGES, and they are the whole story for a `research_product`. But
-- the same table's `entity_type` allowlist admits `research_source` and `research_run` as well —
-- and a source has no stage, nor does a run. A source's status is its POLICY STATUS, which is the
-- one fact anybody searching for a source needs; a run's is its RUN STATUS. Under the constraint
-- as written, neither could be indexed at all, so the two providers this phase's deliverable names
-- would have had nothing to query.
--
-- THE ALLOWLIST IS WIDENED RATHER THAN DROPPED. It could have become free text — no other table
-- would have noticed — and that would have thrown away what the constraint is for: `status` is
-- rendered in the palette beside a result, so a junk value is a junk word on a screen. The new
-- list is the union of the three vocabularies, each named, which keeps a typo unstorable.
--
-- THE INDEX IS MAINTAINED BY A SECURITY DEFINER TRIGGER, exactly as the public one is (0211), and
-- for the same reason: there is no insert or update policy on `research_search_documents` for any
-- session role, so a member of staff cannot hand-write a search result that the source row does not
-- say. A delete on the source deletes its document; a row that stops being findable is a row that
-- stops existing, not one that lingers in a search box pointing at nothing.
-- ============================================================================================

set search_path = public, extensions;

-- --- 1. The correction ---------------------------------------------------------------------------

alter table research_search_documents
  drop constraint research_search_documents_status_allowlist;

alter table research_search_documents
  add constraint research_search_documents_status_allowlist
  check (status in (
    -- research_product: the seven FEAT §23 stages, unchanged.
    'RAW', 'NORMALIZED', 'VALIDATED', 'MATCHED', 'REVIEW', 'SHORTLISTED', 'CONFIRMED',
    -- research_source: the policy review, which is what a person searching for a source needs to
    -- see beside its name — "is this one we may read".
    'UNREVIEWED', 'APPROVED', 'RESTRICTED', 'BLOCKED',
    -- research_run: how it ended, or that it has not.
    'QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED'
  ));

comment on constraint research_search_documents_status_allowlist on research_search_documents is
  'The union of the three indexed types'' status vocabularies: the seven pipeline stages for a research_product, the four policy states for a research_source, the six run states for a research_run. Widened in 0234 — 0210 had only the stages, which left a source and a run unindexable.';

-- --- 2. The only writer of the research index -----------------------------------------------------

create function public.refresh_research_search_document(p_entity_type text, p_entity_id uuid)
  returns void
  language plpgsql
  volatile
  security definer
  set search_path = public, extensions
as $fn$
declare
  v_title    text;
  v_subtitle text;
  v_body     text;
  v_status   text;
  v_url      text;
  v_source   text;
  v_keywords text[] := '{}';
  v_found    boolean := false;
begin
  if p_entity_type = 'research_source' then
    select true,
           s.name,
           s.base_url,
           concat_ws(' ', s.region, s.source_type, s.adapter_key),
           s.policy_status::text,
           '/studio/research/sources',
           s.base_url,
           array_remove(array[s.slug::text, s.region, s.source_type], null)
      into v_found, v_title, v_subtitle, v_body, v_status, v_url, v_source, v_keywords
      from research_sources s
     where s.id = p_entity_id;

  elsif p_entity_type = 'research_run' then
    -- A RUN'S TITLE IS ITS SOURCE'S NAME PLUS ITS SHORT ID, because "run 3ed8b379" is not
    -- something anybody types into a search box and "Acme — 3ed8b379" is.
    select true,
           concat_ws(' — ', s.name, left(r.id::text, 8)),
           r.trigger::text,
           coalesce(r.error_summary, ''),
           r.status::text,
           '/studio/research/runs/' || r.id::text,
           null,
           array_remove(array[s.slug::text, r.status::text, r.trigger::text], null)
      into v_found, v_title, v_subtitle, v_body, v_status, v_url, v_source, v_keywords
      from research_runs r
      join research_sources s on s.id = r.source_id
     where r.id = p_entity_id;

  elsif p_entity_type = 'research_product' then
    select true,
           coalesce(nullif(btrim(p.source_external_id), ''), p.source_url),
           s.name,
           '',
           p.stage::text,
           '/studio/research/explorer?product=' || p.id::text,
           p.source_url,
           array_remove(array[s.slug::text, p.disposition::text], null)
      into v_found, v_title, v_subtitle, v_body, v_status, v_url, v_source, v_keywords
      from research_products p
      join research_sources s on s.id = p.source_id
     where p.id = p_entity_id;

  else
    -- An entity type this function does not know about is not indexed. The table's own allowlist
    -- would refuse it anyway; refusing here as well means a future type is added deliberately.
    return;
  end if;

  -- NO TITLE, NO DOCUMENT. The same rule 0211 arrived at for the public index: a row that cannot
  -- produce a title has nothing to show in a result, and deleting it is better than failing the
  -- write on the source row — which would make an unrelated insert fail for want of a search entry.
  if not coalesce(v_found, false) or v_title is null or btrim(v_title) = '' then
    delete from research_search_documents
     where entity_type = p_entity_type and entity_id = p_entity_id;
    return;
  end if;

  -- check-migrations: allow-insert (an index row derived from a source row inside a trigger function, not seeded content)
  insert into research_search_documents
    (entity_type, entity_id, visibility, status, url_path, title, subtitle, body, keywords,
     source_url, indexed_at)
  values
    (p_entity_type, p_entity_id, 'STAFF', v_status, v_url, v_title, v_subtitle, v_body,
     coalesce(v_keywords, '{}'::text[]), v_source, now())
  on conflict (entity_type, entity_id) do update
    set status     = excluded.status,
        url_path   = excluded.url_path,
        title      = excluded.title,
        subtitle   = excluded.subtitle,
        body       = excluded.body,
        keywords   = excluded.keywords,
        source_url = excluded.source_url,
        indexed_at = now();
end;
$fn$;

comment on function public.refresh_research_search_document(text, uuid) is
  'The only writer of research_search_documents. SECURITY DEFINER because the table has no session write policy: a member of staff must not be able to hand-write a research result that the source row does not say.';

revoke execute on function public.refresh_research_search_document(text, uuid) from public, anon, authenticated;
grant execute on function public.refresh_research_search_document(text, uuid) to service_role;

-- --- 3. The triggers ------------------------------------------------------------------------------

create function public.tg_research_source_search() returns trigger
  language plpgsql volatile security definer set search_path = public, extensions
as $fn$
begin
  if tg_op = 'DELETE' then
    delete from research_search_documents
     where entity_type = 'research_source' and entity_id = old.id;
    return old;
  end if;
  perform public.refresh_research_search_document('research_source', new.id);
  return new;
end;
$fn$;

create trigger research_sources_search_sync
  after insert or update or delete on research_sources
  for each row execute function public.tg_research_source_search();

create function public.tg_research_run_search() returns trigger
  language plpgsql volatile security definer set search_path = public, extensions
as $fn$
begin
  if tg_op = 'DELETE' then
    delete from research_search_documents
     where entity_type = 'research_run' and entity_id = old.id;
    return old;
  end if;
  perform public.refresh_research_search_document('research_run', new.id);
  return new;
end;
$fn$;

create trigger research_runs_search_sync
  after insert or update or delete on research_runs
  for each row execute function public.tg_research_run_search();

create function public.tg_research_product_search() returns trigger
  language plpgsql volatile security definer set search_path = public, extensions
as $fn$
begin
  if tg_op = 'DELETE' then
    delete from research_search_documents
     where entity_type = 'research_product' and entity_id = old.id;
    return old;
  end if;
  perform public.refresh_research_search_document('research_product', new.id);
  return new;
end;
$fn$;

create trigger research_products_search_sync
  after insert or update or delete on research_products
  for each row execute function public.tg_research_product_search();

-- A SOURCE'S NAME APPEARS IN ITS RUNS' AND PRODUCTS' TITLES, so renaming one must re-index them.
-- Statement-level and guarded on the name, because a rename is rare and a politeness-counter
-- update — which happens after every single fetch — must not re-index the source's whole history.
create function public.tg_research_source_rename_search() returns trigger
  language plpgsql volatile security definer set search_path = public, extensions
as $fn$
begin
  if new.name is distinct from old.name then
    perform public.refresh_research_search_document('research_run', r.id)
       from research_runs r where r.source_id = new.id;
    perform public.refresh_research_search_document('research_product', p.id)
       from research_products p where p.source_id = new.id;
  end if;
  return new;
end;
$fn$;

create trigger research_sources_rename_search_sync
  after update of name on research_sources
  for each row execute function public.tg_research_source_rename_search();

-- --- 4. Nothing here is an RPC endpoint ------------------------------------------------------------
--
-- POSTGRESQL GRANTS EXECUTE TO `public` ON A NEW FUNCTION BY DEFAULT, and on Supabase `public`
-- includes `anon` — so every function above, SECURITY DEFINER and all, became a PostgREST RPC
-- endpoint the moment it was created. A trigger function invoked outside a trigger raises rather
-- than doing anything useful, so this is a narrow hole rather than a wide one; it is still a
-- security-definer function an anonymous caller can reach, which is exactly the shape the rule
-- exists to forbid.
--
-- 0211 does the same for the eleven public-index trigger functions, and
-- `tests/unit/rls/function-grants.test.ts` is what caught the omission here — a gate written two
-- phases ago failing on code written today, which is the whole point of having it.

revoke execute on function public.tg_research_source_search() from public, anon, authenticated;
revoke execute on function public.tg_research_run_search() from public, anon, authenticated;
revoke execute on function public.tg_research_product_search() from public, anon, authenticated;
revoke execute on function public.tg_research_source_rename_search() from public, anon, authenticated;
