import type { ContactDetails } from '@/lib/site/contact-details'

/**
 * Which number the handoff dials, and where that number comes from.
 *
 * TWO SOURCES, IN THIS ORDER, AND THE ORDER IS THE DECISION.
 *
 *   1. The `contact-details` SECTION — the one row SEED §21's facts already live in — but only when
 *      the owner has VERIFIED it. The footer and the contact page read the same row, so the studio's
 *      number has exactly one home and changing it is one edit in Studio, with no deployment.
 *   2. `NEXT_PUBLIC_WHATSAPP_NUMBER` (D8) — the deployment default, so a fresh environment has a
 *      working handoff before anybody has opened the Studio.
 *
 * THE PHASE DOCUMENT ASKED FOR A `global_content` GROUP CALLED `CONTACT` AND THIS IS NOT THAT, for
 * the reason the phase document itself gives. §21 says "do not hardcode these values in multiple
 * components"; Phase 09 obeyed it by putting them in one section payload, and adding a second home
 * now would be the exact failure the sentence warns about — two places to change a phone number,
 * one of which somebody forgets. Recorded as amendment A20.
 *
 * VERIFICATION IS A CONDITION AND NOT A FORMALITY. A phone number is a business fact under D10: an
 * unverified one is worse than none, because a customer will ring it. A section still carrying
 * `OWNER_VERIFICATION_REQUIRED` does not merely lose to the environment variable — it does not
 * count at all.
 *
 * NEITHER RESOLVING IS A STATE, NOT AN ERROR. `null` here means the enquiry is still saved, the
 * visitor still sees their reference code and the studio's other contact details, and the row
 * records `whatsapp_state = 'UNAVAILABLE'`. Losing an enquiry because a link could not be built is
 * the one outcome that is never acceptable.
 */

/**
 * Digits only, with the country code, as `wa.me` requires — `919825012345`, never `+91 98250 12345`.
 *
 * IT DOES NOT INVENT A COUNTRY CODE. A ten-digit Indian mobile typed without one is ambiguous to
 * this function and would be unambiguous only because somebody assumed; `wa.me` with the wrong
 * prefix opens a chat with a stranger. A leading `00` is the international prefix and becomes
 * nothing; a leading `+` is already the right idea and becomes nothing. Anything shorter than a
 * plausible international number is refused.
 */
export function normaliseE164(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null

  const trimmed = raw.trim()
  if (trimmed === '') return null

  const digits = trimmed.replace(/[^\d]/g, '')
  const withoutPrefix = digits.startsWith('00') ? digits.slice(2) : digits

  // 8 is the shortest national number in use anywhere plus a one-digit country code; 15 is E.164's
  // own ceiling. Outside that range it is not a number somebody can be reached on.
  if (withoutPrefix.length < 8 || withoutPrefix.length > 15) return null
  return withoutPrefix
}

/**
 * Resolve the studio's WhatsApp number, falling back to the environment.
 *
 * `verified` is the section's own `owner_verification === 'VERIFIED'`, passed in rather than read
 * here so this stays pure: the caller already holds the row it is rendering contact details from.
 */
export function resolveWhatsAppNumber(
  details: ContactDetails | null,
  verified: boolean,
  envNumber: string | null | undefined,
): string | null {
  const fromContent = verified ? normaliseE164(details?.whatsapp ?? null) : null
  return fromContent ?? normaliseE164(envNumber)
}
