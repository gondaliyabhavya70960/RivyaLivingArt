-- ============================================================================================
-- 0055 — an ERROR group for global_content
--
-- `global_content_group_allowed` (0050) lists the eleven groups the specification names. The list
-- is right and stays closed — a free-text group would let a typo create a group of one that no
-- surface ever reads — but it has no home for the one string the media layer has required since
-- Phase 05.
--
-- `components/primitives/MediaFrame/index.tsx` has said this in its header since it was written:
-- the fallback label "is `error.media_unavailable.label` in `global_content`". It is a REQUIRED
-- prop precisely so a frame can never collapse silently, and `lib/cms/strings.ts` ships no
-- fallback copy at all, so without a row the label is empty and the well carries nothing.
--
-- It is not a call to action, not a commerce label and not an action label; filing it under one of
-- those to fit the constraint would make it unfindable in Studio and would corrupt what those
-- groups mean. ERROR is its own kind of string and there will be more of them — a failed form
-- submission, an unreachable third party — so the group is added rather than the string bent.
--
-- DROP AND RE-ADD, NOT `ALTER CONSTRAINT`: PostgreSQL cannot change a check constraint's
-- expression in place. The new list is a strict superset of the old, so every existing row
-- satisfies it and the validation scan finds nothing to reject.
-- ============================================================================================

alter table global_content drop constraint global_content_group_allowed;

alter table global_content
  add constraint global_content_group_allowed check (group_key in (
    'CTA', 'COMMERCE_LABEL', 'ACTION_LABEL', 'EMPTY_STATE', 'FORM_COPY', 'ANNOUNCEMENT',
    'WHATSAPP_TEMPLATE', 'STUDIO_HELP', 'SEO_DEFAULT', 'SOCIAL', 'NEWSLETTER',
    -- Added 0055. Interface strings shown when something did not resolve.
    'ERROR'
  ));

comment on constraint global_content_group_allowed on global_content is
  'The twelve groups a site-wide string may belong to. Closed on purpose: a free-text group lets a typo create a group of one that no surface reads.';
