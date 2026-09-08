import { z } from 'zod'

import type { PageSection } from '@/lib/supabase/schemas'

/**
 * The studio's contact details, from the one `contact-details` section that holds them.
 *
 * ONE ROW, READ IN TWO PLACES. SEED §21 supplies the phone, WhatsApp and email and says not to
 * hardcode them in several components; Phase 09 obeyed that by putting them in a single section
 * payload rather than in `global_content` beside the labels. The footer's contact column and the
 * contact page both read it here, so the owner corrects one field once.
 *
 * VALIDATED AT THE BOUNDARY LIKE ANY OTHER JSON. `payload` is `jsonb` and arrives as `unknown`; a
 * renderer reading `payload.phone` off it would find out at render time that an editor cleared the
 * field. Every field is optional and nullable because that is the truth of the row: §21 refers to
 * a Google Maps destination and supplies none, so `location_url` is seeded null and stays null
 * until the owner provides one.
 */
export const contactDetailsSchema = z.object({
  phone: z.string().nullish(),
  whatsapp: z.string().nullish(),
  email: z.string().nullish(),
  location_url: z.string().nullish(),
  location_label: z.string().nullish(),
})

export type ContactDetails = {
  readonly phone: string | null
  readonly whatsapp: string | null
  readonly email: string | null
  /** Both null unless the owner supplies the destination: a label with no link is not a link. */
  readonly locationUrl: string | null
  readonly locationLabel: string | null
}

function trimmedOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}

/**
 * Null for a missing section, and null for a section whose payload does not parse.
 *
 * A MALFORMED PAYLOAD RENDERS NOTHING RATHER THAN THROWING. This is chrome on every page on the
 * site: a bad `contact-details` payload taking down `/` as well as `/contact` would turn one
 * editor's mistake into an outage. The section is visible in Studio with its payload on screen,
 * which is where the person who can fix it is looking.
 */
export function contactDetailsOf(section: PageSection | null): ContactDetails | null {
  if (section === null) return null

  const parsed = contactDetailsSchema.safeParse(section.payload)
  if (!parsed.success) return null

  const details: ContactDetails = {
    phone: trimmedOrNull(parsed.data.phone),
    whatsapp: trimmedOrNull(parsed.data.whatsapp),
    email: trimmedOrNull(parsed.data.email),
    locationUrl: trimmedOrNull(parsed.data.location_url),
    locationLabel: trimmedOrNull(parsed.data.location_label),
  }

  // Every field empty is the same as no section at all — a heading with nothing under it.
  const anything =
    details.phone !== null ||
    details.whatsapp !== null ||
    details.email !== null ||
    details.locationUrl !== null
  return anything ? details : null
}
