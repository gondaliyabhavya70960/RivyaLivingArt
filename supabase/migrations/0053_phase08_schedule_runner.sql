-- ============================================================================================
-- 0053 — cms_run_content_schedule(): the scheduled publish/unpublish sweep
--
-- WHY THIS IS SQL AND NOT TYPESCRIPT. The cron route could read the due rows, loop, and call
-- cms_publish_section over PostgREST — and it would be wrong in three ways that only show up
-- under concurrency or failure:
--
--   1. Two overlapping invocations (a slow run, a manual trigger, a Vercel retry) would both
--      read the same due rows and both publish them. `for update skip locked` makes the second
--      run see an empty set instead, with no coordination between the two processes.
--   2. A refusal from cms_publish_section aborts its transaction. Recording "this failed, and
--      why" therefore has to happen in a DIFFERENT transaction from the failure. plpgsql's
--      exception block is a subtransaction, so the failed publish rolls back and the bookkeeping
--      write survives — over HTTP that is two round trips with a window in between where a crash
--      loses the attempt count.
--   3. Each publish is atomic with its media cascade already; doing the sweep row by row from
--      outside adds a partial-sweep state that nothing can reason about.
--
-- THE ACTOR IS NULL, DELIBERATELY. `set_owner_edited` sets `owner_edited = true` whenever
-- `updated_by` is not null, and an owner-edited row is skipped by the seed runner forever after.
-- A scheduled publish is not an owner edit — nobody touched the copy — so attributing it to a
-- person would quietly freeze that section against future seeds. A null actor is also what
-- `enforce_status_transition` recognises as the service role, which is what this is.
-- ============================================================================================

create or replace function public.cms_run_content_schedule(
  p_now timestamptz default now(),
  p_max_attempts int default 3
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row        record;
  v_target     content_status;
  v_result     jsonb;
  v_published  jsonb := '[]'::jsonb;
  v_failed     jsonb := '[]'::jsonb;
  v_paths      text[] := array[]::text[];
  v_attempts   int;
  v_state      text;
  v_error      text;
begin
  if p_max_attempts < 1 then
    raise exception 'p_max_attempts must be at least 1' using errcode = 'RV001';
  end if;

  for v_row in
    select id, page_id, status, publish_at, unpublish_at, schedule_attempts
      from page_sections
     where schedule_state = 'PENDING'
       and (
         -- Due to go live: approved, with its moment passed.
         (status = 'APPROVED' and publish_at is not null and publish_at <= p_now)
         -- Due to come down. The public site already stops rendering it at unpublish_at — the
         -- resolver's window is the guarantee — so this is not what takes it off the site. It is
         -- what makes the row's STATUS tell the truth afterwards, so Studio does not show a
         -- section as PUBLISHED that no visitor can reach.
         or (status = 'PUBLISHED' and unpublish_at is not null and unpublish_at <= p_now)
       )
     order by coalesce(publish_at, unpublish_at)
     for update skip locked
  loop
    v_target := case when v_row.status = 'APPROVED' then 'PUBLISHED' else 'ARCHIVED' end;

    begin
      v_result := public.cms_publish_section(v_row.id, v_target, null, 'Scheduled');
      v_published := v_published || jsonb_build_array(v_result);
      v_paths := v_paths || array(select jsonb_array_elements_text(v_result->'paths'));
    exception when others then
      -- The subtransaction rolls the failed publish back; everything below is a fresh write.
      --
      -- BLOCKED AFTER p_max_attempts, not never and not forever. A section refused because its
      -- media is unverified (RV006) will be refused identically every five minutes until a human
      -- acts, and a scheduled publish that retries silently for a week is indistinguishable from
      -- one that worked. BLOCKED stops the retry and leaves the reason on the row;
      -- `reset_schedule_state` puts it back to PENDING the moment a human edits the section,
      -- which is the only thing that could have changed the answer.
      v_attempts := v_row.schedule_attempts + 1;
      v_state := case when v_attempts >= p_max_attempts then 'BLOCKED' else 'PENDING' end;
      -- SQLERRM, not the exception's own detail: the message names the assets or the constraint,
      -- which is what an editor needs. Truncated because it is shown in a table cell.
      v_error := left(coalesce(sqlstate || ': ' || sqlerrm, 'unknown'), 500);

      update page_sections
         set schedule_attempts = v_attempts,
             schedule_state = v_state,
             schedule_error = v_error,
             schedule_last_attempt_at = p_now
       where id = v_row.id;

      v_failed := v_failed || jsonb_build_array(jsonb_build_object(
        'section_id', v_row.id,
        'target', v_target,
        'attempts', v_attempts,
        'state', v_state,
        'error', v_error
      ));
    end;
  end loop;

  return jsonb_build_object(
    'ran_at', p_now,
    'published', v_published,
    'failed', v_failed,
    -- Deduped: two sections on one page produce one path to revalidate, not two.
    'paths', to_jsonb(array(select distinct unnest(v_paths) order by 1))
  );
end;
$$;

revoke execute on function public.cms_run_content_schedule(timestamptz, int) from public, anon, authenticated;
grant execute on function public.cms_run_content_schedule(timestamptz, int) to service_role;

comment on function public.cms_run_content_schedule(timestamptz, int) is
  'The scheduled publish/unpublish sweep. Row-locked with SKIP LOCKED so overlapping runs cannot double-publish; records a refusal on the row and BLOCKS after p_max_attempts rather than retrying forever.';
