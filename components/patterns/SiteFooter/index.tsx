import * as React from 'react'

import { NavLink } from '@/components/patterns/NavLink'
import { Container } from '@/components/primitives/Container'
import { Stack } from '@/components/primitives/Stack'
import { siteString } from '@/lib/cms/strings'
import type { SiteChrome } from '@/lib/site/chrome'
import type { ContactDetails } from '@/lib/site/contact-details'
import { buildDirectContactUrl } from '@/lib/whatsapp'
import { cn } from '@/lib/ui/cn'

/**
 * The footer: SEED §24's four columns, the brand statement, and the studio's contact details.
 *
 * A SERVER COMPONENT WITH NO INTERACTION AT ALL. Nothing here has state, so nothing here is a
 * client island — the footer is on every page and an island in it is a tax on the whole site.
 *
 * THE CONTACT COLUMN READS ONE ROW AND MAY RENDER NOTHING. §21 supplies a phone number, a WhatsApp
 * number and an email address and forbids hardcoding them in several components; they live in the
 * single `contact-details` section, and Phase 09 seeded that section `OWNER_VERIFICATION_REQUIRED`
 * because a transcribed phone number is a business fact until somebody confirms it. Until then
 * `chrome.contact` is null and the column is a heading with nothing beneath it. A wrong number in
 * the footer of every page is paid for by a customer who cannot reach anyone.
 *
 * THE DETAILS ARE THEIR OWN LINK TEXT. A `tel:` link labelled with the number, and a `mailto:`
 * labelled with the address, need no separate "Phone" and "Email" labels — which is fortunate,
 * because those labels do not exist in `global_content` and inventing them in JSX is what D2
 * forbids. The WhatsApp link is the exception and uses the seeded
 * `ACTION_LABEL.discuss_on_whatsapp`, because a bare number there would not say where it goes.
 */

type ContactColumnProps = {
  readonly contact: ContactDetails
  readonly whatsappLabel: string | null
  readonly greeting: string | null
}

function ContactLinks({
  contact,
  whatsappLabel,
  greeting,
}: ContactColumnProps): React.ReactElement {
  const linkClass = cn(
    'text-sm text-ink-secondary underline-offset-4',
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

      {/*
       * Both the label and the greeting must resolve. A WhatsApp link with no label is an
       * anonymous destination, and one with no greeting opens an empty chat with a sentence
       * nobody wrote — so a missing string means no link rather than an invented one.
       */}
      {contact.whatsapp === null || whatsappLabel === null || greeting === null ? null : (
        <li>
          <a
            href={buildDirectContactUrl({ source: 'footer', greeting })}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
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

export type SiteFooterProps = {
  readonly chrome: SiteChrome
}

export function SiteFooter({ chrome }: SiteFooterProps): React.ReactElement {
  const { strings, footer, contact } = chrome

  const footerLabel = siteString(strings, 'UI_LABEL.nav.footer')
  const brand = siteString(strings, 'BRAND.brand.name')
  const statement = siteString(strings, 'BRAND.brand.statement')
  const whatsappLabel = siteString(strings, 'ACTION_LABEL.discuss_on_whatsapp')
  const greeting = siteString(strings, 'WHATSAPP_TEMPLATE.direct')

  /**
   * The contact column is the one whose links come from a section rather than from
   * `navigation_items`. Phase 09 seeded it as a heading with no children for exactly that reason,
   * so it is identified by having no links of its own — not by matching its label, which is copy
   * an editor may reword at any time.
   */
  const contactColumnId = footer.find((column) => column.links.length === 0)?.id ?? null

  return (
    <footer className="mt-16 border-t border-line bg-surface-sunken">
      <Container size="wide" className="py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            {brand === null ? null : (
              <p className="font-display text-lg tracking-heading text-ink">{brand}</p>
            )}
            {statement === null ? null : (
              <p className="mt-2 max-w-prose text-sm leading-body text-ink-secondary">
                {statement}
              </p>
            )}
          </div>

          <nav
            {...(footerLabel === null ? {} : { 'aria-label': footerLabel })}
            className="lg:col-span-4"
          >
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {footer.map((column) => (
                <div key={column.id}>
                  <h2 className="text-xs uppercase tracking-eyebrow text-ink-tertiary">
                    {column.href === null ? (
                      column.heading
                    ) : (
                      <NavLink href={column.href} className="hover:text-ink">
                        {column.heading}
                      </NavLink>
                    )}
                  </h2>

                  {column.id === contactColumnId && contact !== null ? (
                    <div className="mt-3">
                      <ContactLinks
                        contact={contact}
                        whatsappLabel={whatsappLabel}
                        greeting={greeting}
                      />
                    </div>
                  ) : (
                    <Stack as="ul" gap={2} className="mt-3 list-none">
                      {column.links.map((link) => (
                        <li key={link.id}>
                          <NavLink
                            href={link.href}
                            target={link.target}
                            className={cn(
                              'text-sm text-ink-secondary underline-offset-4',
                              'transition-[color] duration-(--rv-duration-fast) ease-standard',
                              'hover:text-ink hover:underline focus-visible:text-ink',
                            )}
                          >
                            {link.label}
                          </NavLink>
                        </li>
                      ))}
                    </Stack>
                  )}
                </div>
              ))}
            </div>
          </nav>
        </div>
      </Container>
    </footer>
  )
}
