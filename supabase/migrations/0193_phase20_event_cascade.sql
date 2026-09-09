-- ============================================================================================
-- 0193 — an append-only log must still be able to go with the row it describes
--
-- WHAT THE TEST FOUND. `inquiry_events` refuses UPDATE and DELETE outright, which is what makes it
-- a record of what happened rather than of what somebody later wished had happened. But
-- `inquiry_events.inquiry_id` is `on delete cascade`, and a cascade is a DELETE: the trigger fired
-- on the child rows and refused, so DELETING AN ENQUIRY WAS IMPOSSIBLE FOR ANYBODY, including a
-- superuser. The Phase 20 RLS suite could not even clean up its own fixture.
--
-- WHY THAT IS A DEFECT AND NOT A FEATURE. "Nothing deletes an enquiry" is a rule about the STUDIO,
-- and it is enforced where it belongs: no session role has a delete policy on `inquiries`, and SPAM
-- and ARCHIVED exist as statuses precisely so a judgement can be reversed rather than executed. It
-- was never meant to be a rule about the DATABASE. An erasure request under India's DPDP Act, a
-- fixture teardown, a restore that has to drop a bad import — all of them need the row to be
-- removable by somebody with the privilege to do it, and none of them is served by a log that
-- outlives the thing it is a log of.
--
-- THE FIX IS ONE CONDITION, AND IT IS DELIBERATELY NARROW. An event may be deleted only when the
-- enquiry it belongs to is already gone — which, inside a cascade, it is: PostgreSQL deletes the
-- parent first and then the children. A hand-written `delete from inquiry_events where …` still
-- finds the parent present and is still refused, by name. UPDATE is refused unconditionally, as
-- before: there is no circumstance in which rewriting an event is the right answer.
-- ============================================================================================

set search_path = public, extensions;

create or replace function public.reject_inquiry_event_mutation() returns trigger
  language plpgsql
  security definer
  set search_path = pg_catalog, public
  as $$
begin
  /*
   * THE CASCADE, AND ONLY THE CASCADE. Inside `delete from inquiries where id = …` the parent row
   * is already gone by the time this fires on its children, so the lookup finds nothing and the
   * event goes with it. A direct delete finds the enquiry still there and is refused.
   */
  if tg_op = 'DELETE' then
    if not exists (select 1 from inquiries where id = old.inquiry_id) then
      return old;
    end if;

    raise exception
      'inquiry_events is append-only. An event can only be removed with the enquiry it belongs to.'
      using errcode = 'restrict_violation';
  end if;

  raise exception
    'inquiry_events is append-only. Correct a mistaken entry by appending the correction, not by rewriting the record.'
    using errcode = 'restrict_violation';
end $$;

comment on function public.reject_inquiry_event_mutation() is
  'Refuses UPDATE always and DELETE unless the parent enquiry is already gone — so a cascade works and a hand-written delete does not.';

revoke execute on function public.reject_inquiry_event_mutation() from public, anon, authenticated;
