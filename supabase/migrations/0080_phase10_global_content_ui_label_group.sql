-- ============================================================================================
-- 0080 — a UI_LABEL group for global_content
--
-- WHY A PHASE THAT DECLARES "DATABASE — NONE" SHIPS A MIGRATION. It is the same reason 0055 and
-- 0071 exist, and the phase document's "none" means "no new tables", which still holds: this adds
-- no table, no column and no policy. It adds one member to a closed list.
--
-- Phase 10's exit criteria require that every visitor-visible string in the chrome comes from
-- `global_content` — zero copy literals in `components/patterns/Site*`. The chrome needs strings
-- the site has never needed before, and they are not any of the thirteen existing kinds:
--
--   * the skip link's words, and the accessible names of the two menu controls;
--   * the announcement bar's dismiss control;
--   * the accessible names of the four landmarks a page carries — a page with three unnamed
--     <nav> elements gives a screen-reader user three landmarks called "navigation".
--
-- ACTION_LABEL IS THE NEAR MISS, AND THE FIRST DRAFT USED IT. "Open menu" is an action, so half of
-- these fit; "Primary navigation" is not an action by any reading, and filing it under a group
-- named for actions makes it unfindable in the one screen an editor would go to. That is 0055's
-- and 0071's mistake stated a third time, so it is answered the same way rather than tolerated
-- because the group list is getting long. The controls that ARE actions stay in ACTION_LABEL;
-- only the names of regions and landmarks move here.
--
-- The list stays closed. Adding a member is a migration precisely so that it is a decision with a
-- reason attached rather than whatever a module happened to type.
-- ============================================================================================

alter table global_content drop constraint global_content_group_allowed;

alter table global_content
  add constraint global_content_group_allowed check (group_key in (
    'CTA', 'COMMERCE_LABEL', 'ACTION_LABEL', 'EMPTY_STATE', 'FORM_COPY', 'ANNOUNCEMENT',
    'WHATSAPP_TEMPLATE', 'STUDIO_HELP', 'SEO_DEFAULT', 'SOCIAL', 'NEWSLETTER',
    -- Added 0055. Interface strings shown when something did not resolve.
    'ERROR',
    -- Added 0071. SEED §6's brand name, descriptor, statement and introduction.
    'BRAND',
    -- Added 0080. The names of regions and landmarks in the site chrome — the accessible names of
    -- the header, footer and category navigation, and of the search region. Not actions: the
    -- controls themselves stay in ACTION_LABEL.
    'UI_LABEL'
  ));

comment on constraint global_content_group_allowed on global_content is
  'The fourteen groups a site-wide string may belong to. Closed on purpose: a free-text group lets a typo create a group of one that no surface reads.';
