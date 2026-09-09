import type { GlobalContent } from '@/lib/supabase/schemas'

/**
 * Which number the handoff dials, and where that number comes from.
 *
 * TWO SOURCES, IN THIS ORDER, AND THE ORDER IS THE DECISION.
 *
 *   1. `global_content` group `CONTACT`, key `whatsapp_number` — but only when it is PUBLISHED,
 *      enabled and `VERIFIED`. The owner changes the studio's number in the Studio, and it changes
 *      on the site without a deployment. That is SEED §21's "do not hardcode these values in
 *      multiple components" taken to its conclusion: the value has one home.
 *   2. `NEXT_PUBLIC_WHATSAPP_NUMBER` (D8) — the deployment default, so a fresh environment has a
 *      working handoff before anybody has opened the Studio.
 *
 * `VERIFIED` IS A CONDITION AND NOT A FORMALITY. A phone number is a business fact under D10: an
 * unverified one is worse than none, because a customer will ring it. A row seeded
 * `OWNER_VERIFICATION_REQUIRED` therefore does not win over the environment variable — it does not
 * count at all — and `global_content_verified_before_publish` stops it being published anyway.
 *
 * NEITHER RESOLVING IS A STATE, NOT AN ERROR. `null` here means the enquiry is still saved, the
 * visitor still sees their reference code and the studio's other contact details, and the row
 * records `whatsapp_state = 'UNAVAILABLE'`. Losing an enquiry because a link could not be built is
 * the one outcome that is never acceptable.
 */

/** The `global_content` address of each contact fact. SEED §21. */
export const CONTACT_KEYS = {
  phone: 'CONTACT.phone',
  whatsappNumber: 'CONTACT.whatsapp_number',
  email: 'CONTACT.email',
  mapsUrl: 'CONTACT.maps_url',
} as const

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
 * Resolve the studio's WhatsApp number from the content rows, falling back to the environment.
 *
 * The rows are passed in rather than read here so this stays pure and testable: the caller already
 * holds the `CONTACT` group for the contact details it is rendering.
 */
export function resolveWhatsAppNumber(
  rows: readonly GlobalContent[],
  envNumber: string | null | undefined,
): string | null {
  const verified = rows.find(
    (row) =>
      row.group_key === 'CONTACT' &&
      row.key === 'whatsapp_number' &&
      row.is_enabled &&
      row.status === 'PUBLISHED' &&
      row.owner_verification === 'VERIFIED',
  )

  return normaliseE164(verified?.value ?? null) ?? normaliseE164(envNumber)
}
