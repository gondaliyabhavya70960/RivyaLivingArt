import * as React from 'react'

import { Stack } from '@/components/primitives/Stack'
import type { ContactDetails } from '@/lib/site/contact-details'
import { cn } from '@/lib/ui/cn'
import { buildDirectContactUrl, type DirectContactSource } from '@/lib/whatsapp'

/**
 * The studio's channels as a list of links — phone, WhatsApp, email, location.
 *
 * ONE RENDERER FOR TWO SURFACES, and the reason is §21's rule read one step further. §21 says the
 * number must not be hardcoded in several components, and Phase 09 answered the VALUES half by
 * putting them in a single `contact-details` section. This is the BEHAVIOUR half: how a number
 * becomes a `tel:` href, which strings must resolve before a WhatsApp link may exist, and when a
 * location renders. The footer had all of that and the `contact-details` block needed the same
 * rules; a second copy would have been correct on the day it was written and wrong the first time
 * one of them changed.
 *
 * THE DETAILS ARE THEIR OWN LINK TEXT. A `tel:` link labelled with the number, and a `mailto:`
 * labelled with the address, need no separate "Phone" and "Email" labels — which is fortunate,
 * because those labels do not exist in `global_content` and inventing them in JSX is what D2
 * forbids. The WhatsApp link is the exception and uses the seeded
 * `ACTION_LABEL.discuss_on_whatsapp`, because a bare number there would not say where it goes.
 *
 * A MISSING STRING MEANS NO LINK, NEVER AN INVENTED ONE. Both the label and the greeting must
 * resolve: a WhatsApp link with no label is an anonymous destination, and one with no greeting
 * opens a chat containing a sentence a developer wrote.
 *
 * IT USED TO TAKE THE WHOLE SITE DOWN, and the bug is worth recording because nothing found it for
 * two phases. `buildDirectContactUrl` read `NEXT_PUBLIC_WHATSAPP_NUMBER` through `requiredEnv`,
 * which THROWS; this list is in the footer of every page; and the footer renders it as soon as the
 * `contact-details` section is published. So in any environment without that variable, the first
 * time the owner did what they are asked to do — verify the studio's number and publish it — every
 * route answered 500. It had never fired because the section had never been published. Phase 45
 * published it in a local harness and every page went red at once. `buildDirectContactUrl` now
 * returns null instead, and a missing number means no link, like a missing label and a missing
 * greeting already did.
 *
 * A SERVER COMPONENT WITH NO STATE. It appears in the footer of every page, and an island there is
 * a tax on the whole site.
 */

export type ContactChannelsProps = {
  readonly contact: ContactDetails
  /** `ACTION_LABEL.discuss_on_whatsapp`. Null suppresses the WhatsApp link entirely. */
  readonly whatsappLabel: string | null
  /** `WHATSAPP_TEMPLATE.direct`. Null suppresses the WhatsApp link entirely. */
  readonly greeting: string | null
  /** Which chrome surface is opening the chat. A closed union — see `DirectContactSource`. */
  readonly source: DirectContactSource
  /**
   * The studio's WhatsApp number, resolved by the caller through `resolveWhatsAppNumber`.
   *
   * PASSED, NOT READ, and only the VERIFIED section's number counts (A20): an unconfirmed phone
   * number is worse than none, because a customer will ring it. Null falls back to the environment
   * inside the builder, and if neither resolves there is simply no link.
   */
  readonly whatsappNumber?: string | null
  /** `sm` in the footer's column, `base` in a band that is the page's own contact section. */
  readonly size?: 'sm' | 'base'
}

export function ContactChannels({
  contact,
  whatsappLabel,
  greeting,
  source,
  whatsappNumber = null,
  size = 'sm',
}: ContactChannelsProps): React.ReactElement {
  /*
   * THREE THINGS MUST RESOLVE BEFORE THERE IS A LINK: a label, a greeting and a number. The first
   * two were always checked here; the third used to THROW instead, which took every page on the
   * site down the first time the contact section was published without the variable set. See the
   * note on `DirectContactInput.number`.
   */
  const chatUrl =
    contact.whatsapp === null || whatsappLabel === null || greeting === null
      ? null
      : buildDirectContactUrl({ source, greeting, number: whatsappNumber })
  const linkClass = cn(
    size === 'sm' ? 'text-sm' : 'text-base',
    'text-ink-secondary underline-offset-4',
    'transition-[color] duration-(--rv-duration-fast) ease-standard',
    'hover:text-ink hover:underline focus-visible:text-ink',
  )

  return (
    <Stack as="ul" gap={2} className="list-none">
      {contact.phone === null ? null : (
        <li>
          {/* `tel:` wants no spaces; the visible text keeps the owner's formatting. */}
          <a href={`tel:${contact.phone.replace(/\s+/gu, '')}`} className={linkClass}>
            {contact.phone}
          </a>
        </li>
      )}

      {chatUrl === null ? null : (
        <li>
          <a href={chatUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {whatsappLabel}
          </a>
        </li>
      )}

      {contact.email === null ? null : (
        <li>
          <a href={`mailto:${contact.email}`} className={linkClass}>
            {contact.email}
          </a>
        </li>
      )}

      {/* §21 refers to a Google Maps destination and supplies none, so both halves are null and
          this renders nothing. A label with no link would be a location claim with no address. */}
      {contact.locationUrl === null ? null : (
        <li>
          <a
            href={contact.locationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            {contact.locationLabel ?? contact.locationUrl}
          </a>
        </li>
      )}
    </Stack>
  )
}
