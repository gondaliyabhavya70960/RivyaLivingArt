-- ============================================================================================
-- 0184 — `cms_duplicate_customization_form()`, because "start from the furniture template" is
-- the way a second brief actually gets written
--
-- STUDIO_GUIDE §7.6 LISTS *Duplicate from template* AS AN ACTION OF THE BUILDER, and the three
-- seeded templates (SEED §33-35) exist to be started from. Without this a merchandiser building a
-- fourth brief retypes eleven steps and forty questions, and the copy diverges from the original in
-- ways nobody notices until a visitor is asked something the studio stopped asking.
--
-- IT IS ONE FUNCTION AND NOT THREE REPOSITORY CALLS, and that is the whole reason it is a
-- migration. Each PostgREST write is its own transaction: a form, then its steps, then its fields
-- is three transactions, and an interruption between the second and the third leaves a form whose
-- steps ask nothing — visible in the builder, publishable-looking, and wrong. Here the three
-- inserts are one statement chain in one transaction, so the copy either exists whole or not at
-- all.
--
-- SECURITY INVOKER, LIKE THE TWO ORDERING FUNCTIONS BESIDE IT. An INSERT is REFUSED by a `with
-- check` policy rather than filtered by it, so a session without `catalog.write` gets an error from
-- the policy itself and this function needs no permission logic of its own. Definer rights would
-- have meant hard-coding the role list into a hand-written migration, where it would drift from
-- lib/auth/permissions.ts.
--
-- THE COPY IS NOT SEEDED CONTENT AND MUST NOT CLAIM TO BE. Every `seed_key`, `content_seed_version`,
-- `seed_content_hash` and `seed_last_applied_at` is dropped: `customization_forms_seed_key_idx` is
-- unique where `seed_key is not null`, so carrying it across would refuse the second copy outright
-- — and carrying it on the first would hand the seed runner a row it did not write and would then
-- overwrite.
--
-- THE COPY IS A DRAFT AND IS NEVER THE DEFAULT. `is_default` is unique per kind among default rows,
-- and a duplicate that inherited it would silently displace the template it was copied from as the
-- form `/custom-commissions` reaches for. `status` starts DRAFT for the same reason a new form
-- does: publication is a decision about a form somebody has read.
--
-- `owner_verification` AND `fact_classification` ARE CARRIED ACROSS UNCHANGED. The THREE_D_RESIN
-- template is seeded `OWNER_VERIFICATION_REQUIRED` because its manufacturing options are not yet
-- confirmed, and a copy asks the same unconfirmed questions. Resetting the copy to NOT_REQUIRED
-- would launder an unverified claim through a duplicate button, which is D10 with an extra step.
-- ============================================================================================

set search_path = public, extensions;

create or replace function public.cms_duplicate_customization_form(
  p_source_id uuid,
  p_slug text,
  p_name text
) returns uuid
  language plpgsql
  security invoker
  set search_path = pg_catalog, public
  as $$
declare
  v_new_id uuid;
begin
  -- check-migrations: allow-insert (a function body, not a seeded row — this copies a form)
  insert into customization_forms (
    slug, name, kind, description, intro_heading, intro_body, submit_label_key,
    is_default, status, owner_verification, fact_classification, updated_by
  )
  select p_slug,
         p_name,
         source.kind,
         source.description,
         source.intro_heading,
         source.intro_body,
         source.submit_label_key,
         false,
         'DRAFT',
         source.owner_verification,
         source.fact_classification,
         auth.uid()
    from customization_forms source
   where source.id = p_source_id
  returning id into v_new_id;

  -- A source this session cannot READ is indistinguishable from one that does not exist, and must
  -- stay that way: naming the difference would tell a caller which form ids are real.
  if v_new_id is null then
    raise exception 'No customization form % could be copied.', p_source_id
      using errcode = 'no_data_found';
  end if;

  /*
   * STEPS AND FIELDS IN ONE STATEMENT, WITH THE OLD ID CARRIED THROUGH THE CTE. The field rows need
   * the NEW step id, and the only thing that connects the two is the step row the copy came from —
   * so the insert returns it alongside the new id rather than matching on `key` afterwards. Matching
   * on key would work today and break the first time a form is allowed two steps with the same key
   * on different forms, which is exactly what `(form_id, key)` uniqueness permits.
   */
  -- check-migrations: allow-insert (a function body, not a seeded row — this copies a form)
  with copied_steps as (
    insert into customization_form_steps (
      form_id, key, title, description, position, is_enabled, is_required, updated_by
    )
    select v_new_id, s.key, s.title, s.description, s.position, s.is_enabled, s.is_required,
           auth.uid()
      from customization_form_steps s
     where s.form_id = p_source_id
     order by s.position
    returning id, key
  )
  -- check-migrations: allow-insert (a function body, not a seeded row — this copies a form)
  insert into customization_form_fields (
    form_id, step_id, key, label, help_text, placeholder, field_type, options, validation,
    is_enabled, is_required, position, include_in_whatsapp, updated_by
  )
  select v_new_id,
         copied_steps.id,
         f.key, f.label, f.help_text, f.placeholder, f.field_type, f.options, f.validation,
         f.is_enabled, f.is_required, f.position, f.include_in_whatsapp,
         auth.uid()
    from customization_form_fields f
    join customization_form_steps s on s.id = f.step_id
    join copied_steps on copied_steps.key = s.key
   where f.form_id = p_source_id;

  return v_new_id;
end $$;

comment on function public.cms_duplicate_customization_form(uuid, text, text) is
  'Copies a form, its steps and its fields in ONE transaction. The copy is a DRAFT, is never the default, and carries no seed identity — it is somebody''s edit, not the runner''s.';

-- `anon` has no business copying a form, and `public` would grant it by default. `authenticated`
-- keeps EXECUTE and is refused by the insert policies unless it holds `catalog.write`.
revoke execute on function public.cms_duplicate_customization_form(uuid, text, text) from public, anon;
