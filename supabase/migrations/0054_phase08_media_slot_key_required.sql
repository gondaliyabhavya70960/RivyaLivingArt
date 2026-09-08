-- ============================================================================================
-- 0054 — a bound asset must name its slot
--
-- THE HOLE THIS CLOSES, stated plainly: before this constraint, a section could set
-- `media_desktop_id` while leaving `media_slot_key` null, and every media gate in the system
-- would then see nothing at all.
--
-- `sync_media_usages` only writes the desktop/mobile pair into `media_usages` when
-- `media_slot_key is not null` — reasonably, since `media_usages.slot_key` is `not null` and the
-- trigger has no other value to put there. But `media_usages` is the ONLY thing
-- `cms_publish_section` consults: RV003 (an asset nobody approved) and RV006 (an approved asset
-- still asserting an unverified claim) are both joins through that table. No usage row means no
-- binding as far as those checks are concerned, so the section publishes and the asset it
-- displays was never reviewed by anyone.
--
-- Verified before writing this: a section bound to a DRAFT, OWNER_VERIFICATION_REQUIRED asset with
-- a null slot key went to PUBLISHED with no refusal, and the asset stayed DRAFT — visible on the
-- public site, unreviewed, and invisible to `lib/media/gaps.ts` as well, which joins on the same
-- key and would have reported the slot as an unfilled gap.
--
-- A CHECK CONSTRAINT RATHER THAN A DEFAULT SLOT KEY. There is no honest default: the key names a
-- specific entry in `content/media-slots.ts`, and inventing one would put a binding in the reverse
-- index that points at a slot the registry does not have. Refusing the write is the only answer
-- that cannot be silently wrong.
--
-- NOT VALID + VALIDATE, in two steps, because this is how a constraint is added to a table that
-- may already hold rows: NOT VALID applies it to new writes immediately without scanning, and
-- VALIDATE then checks what is already there under a lock that does not block reads. The table is
-- empty today; the pattern is here so it stays correct when it is not.
-- ============================================================================================

alter table page_sections
  add constraint page_sections_media_needs_slot_key
  check (
    media_slot_key is not null
    or (media_desktop_id is null and media_mobile_id is null)
  )
  not valid;

alter table page_sections validate constraint page_sections_media_needs_slot_key;

comment on constraint page_sections_media_needs_slot_key on page_sections is
  'A bound desktop/mobile asset must name its content/media-slots.ts key. Without one sync_media_usages writes no reverse-index row, and cms_publish_section RV003/RV006 — which join through media_usages — see no binding at all, so an unapproved asset reaches the public site unchecked.';
