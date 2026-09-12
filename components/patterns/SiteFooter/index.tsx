import * as React from 'react'

import { ContactChannels } from '@/components/patterns/ContactChannels'
import { NavLink } from '@/components/patterns/NavLink'
import { Container } from '@/components/primitives/Container'
import { Stack } from '@/components/primitives/Stack'
import { siteString } from '@/lib/cms/strings'
import type { SiteChrome } from '@/lib/site/chrome'
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
 * THE CHANNELS THEMSELVES ARE `ContactChannels` (RC-244), not a list written here. Phase 45 built
 * the `contact-details` block and it needed the identical rules — how a number becomes a `tel:`
 * href, which strings must resolve before a WhatsApp link may exist, when a location renders — so
 * the list moved out to one component both surfaces use. §21 forbids hardcoding the NUMBER in
 * several components; a second copy of the behaviour is the same mistake one level up.
 */

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
                      <ContactChannels
                        contact={contact}
                        whatsappLabel={whatsappLabel}
                        greeting={greeting}
                        source="footer"
                        /* A20: only a VERIFIED number is dialled; otherwise the environment's. */
                        whatsappNumber={chrome.contactVerified ? contact.whatsapp : null}
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
