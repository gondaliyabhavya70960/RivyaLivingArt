-- ============================================================================================
-- 0192 — `global_content` gains the group `CONTACT`
--
-- SEED §21 SAYS IT PLAINLY: "do not hardcode these values in multiple components". A phone number
-- that appears in the footer, on the contact page, in the announcement bar and in three CTAs is a
-- number that changes in four of those places when the studio moves. This group is where it lives
-- once: `phone`, `whatsapp_number`, `email`, `maps_url`.
--
-- IT IS THE OVERRIDE, NOT THE ONLY SOURCE, and the order is deliberate.
-- `NEXT_PUBLIC_WHATSAPP_NUMBER` (D8) remains the deployment default so a fresh environment has a
-- working handoff before anyone has opened the Studio; a `global_content` row that is PUBLISHED and
-- VERIFIED wins over it, so the owner can change the number without a deployment. If neither
-- resolves, the enquiry is still saved and `whatsapp_state` records `UNAVAILABLE` — losing an
-- enquiry because a link could not be built is the one outcome that is never acceptable.
--
-- NO ROWS ARE INSERTED HERE. The four values are business facts about a real studio: a phone number
-- nobody has confirmed is worse than no phone number, because a customer will ring it. They are
-- seeded by `content/seed/contact-details.ts` carrying `OWNER_VERIFICATION_REQUIRED`, which is what
-- keeps them off the site until the owner has said they are right — and what
-- `global_content_verified_before_publish` enforces at the column.
-- ============================================================================================

set search_path = public, extensions;

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
    'UI_LABEL',
    -- Added 0192. SEED §21's four contact facts: phone, whatsapp_number, email, maps_url. Every
    -- surface that shows one reads it from here, so the studio moving is one edit rather than six.
    'CONTACT'
  ));

comment on constraint global_content_group_allowed on global_content is
  'The fifteen groups a site-wide string may belong to. Closed on purpose: a free-text group lets a typo create a group of one that no surface reads.';
