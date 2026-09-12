import * as React from 'react'

import { ContactChannels } from '@/components/patterns/ContactChannels'
import { Stack } from '@/components/primitives/Stack'
import { siteString } from '@/lib/cms/strings'
import { contactDetailsOf } from '@/lib/site/contact-details'

import { hasSectionCopy, SectionCopy } from './SectionCopy'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * The studio's channels, from this section's own payload.
 *
 * THE EASIEST OF THE SEVEN PLANNED BLOCKS AND THE LAST TO BE BUILT. `contactDetailsOf` is a PURE
 * FUNCTION OVER A `PageSection`, and a renderer is handed its own section — so this needs no
 * selector, no reference resolution and no extra query. Both ends existed for phases; the middle
 * was missing, which is the same shape of gap `cropsForAssets` had.
 *
 * ONE ROW, TWO SURFACES, ONE RENDERER. The footer's contact column and this band are the same list
 * of links, so they are the same component — `ContactChannels` (RC-244). §21 forbids hardcoding the
 * number in several components; two copies of the rules for turning it into a `tel:` href is the
 * same mistake one level up.
 *
 * A MALFORMED PAYLOAD RENDERS THE HEADING AND NOTHING ELSE, rather than throwing. `contactDetailsOf`
 * returns null for a payload that does not parse, and this is a band on the page a visitor reaches
 * when they want to get in touch: an editor's typo should not take `/contact` down. The section is
 * visible in Studio with its payload on screen, which is where the person who can fix it is looking.
 *
 * SEEDED `OWNER_VERIFICATION_REQUIRED`, so this renders nothing publicly until the owner confirms
 * the number. A transcribed phone number is a business fact, and a wrong one is paid for by a
 * customer who cannot reach anybody.
 */
export function ContactDetailsSection({
  section,
  strings,
}: SectionRenderProps): React.ReactElement | null {
  const contact = contactDetailsOf(section)
  if (contact === null && !hasSectionCopy(section)) return null

  return (
    <SectionShell section={section} container="prose">
      <Stack gap={6}>
        <SectionCopy section={section} size="display-sm" />
        {contact === null ? null : (
          <ContactChannels
            contact={contact}
            whatsappLabel={siteString(strings, 'ACTION_LABEL.discuss_on_whatsapp')}
            greeting={siteString(strings, 'WHATSAPP_TEMPLATE.direct')}
            source="contact-page"
            /* A20: an unconfirmed number is worse than none, because a customer will ring it. */
            whatsappNumber={section.owner_verification === 'VERIFIED' ? contact.whatsapp : null}
            size="base"
          />
        )}
      </Stack>
    </SectionShell>
  )
}
