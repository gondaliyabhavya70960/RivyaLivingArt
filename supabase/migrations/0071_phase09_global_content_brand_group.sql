-- ============================================================================================
-- 0071 — a BRAND group for global_content
--
-- SEED §6 names the Studio location for the brand strings explicitly: "Studio → Website → Global
-- Content → Brand". `global_content_group_allowed` has no such group, so the brand name,
-- descriptor, statement and introduction have nowhere to go that means what they are.
--
-- The nearest existing group is ANNOUNCEMENT, and the first draft of `content/seed/global.ts`
-- filed them there to fit the constraint. That is the mistake 0055 was written to avoid, in the
-- same words: a group is a place an editor LOOKS, so filing a string under a group it does not
-- belong to makes it unfindable and corrupts what that group means. An announcement bar is a
-- dismissible strip at the top of a page; the brand statement is the sentence the whole site is
-- built around. They are not the same kind of string and must not share a drawer.
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
    'BRAND'
  ));

comment on constraint global_content_group_allowed on global_content is
  'The thirteen groups a site-wide string may belong to. Closed on purpose: a free-text group lets a typo create a group of one that no surface reads.';
