import { cookies } from 'next/headers'
import * as React from 'react'

import { dismissAnnouncement } from '@/app/(site)/announcement-actions'
import { Container } from '@/components/primitives/Container'
import { IconButton } from '@/components/primitives/IconButton'
import { TextLink } from '@/components/primitives/TextLink'
import { siteString, type SiteStrings } from '@/lib/cms/strings'
import type { Announcement } from '@/lib/site/announcement'

/**
 * The announcement strip (SEED §9).
 *
 * A SERVER COMPONENT WITH NO CLIENT ISLAND, WHICH IS THE POINT. Dismissal is a
 * `<form>` posting to a Server Action, so the bar renders in its final state in the first
 * response: it never appears and then vanishes on hydration, and it costs the shell zero bytes of
 * JavaScript on every route on the site. The alternative — a client component reading
 * `localStorage` in an effect — is a guaranteed layout shift at the very top of the page, which is
 * the worst place on the page to have one.
 *
 * IT READS THE COOKIE ONLY WHEN THERE IS AN ANNOUNCEMENT. `cookies()` opts the route out of static
 * rendering, so calling it unconditionally would make every page on the site dynamic in order to
 * decide whether to hide a bar that does not exist. The layout renders this component only when
 * `chrome.announcement` is non-null, and the read happens here rather than there so the cost and
 * the reason for it sit in the same file.
 *
 * NOTHING IS RENDERED WITHOUT A MESSAGE, and today there is no message: Phase 09 seeded §9's text
 * `OWNER_VERIFICATION_REQUIRED` because it asserts three services, so the row is `DRAFT` and the
 * public policy does not return it. That is D10 working, not a bug — the bar appears the moment
 * the owner confirms the claim in Studio.
 */

/** 20px is applied by IconButton; 1.5 stroke and `currentColor` are DESIGN_SYSTEM §7.2. */
const DismissGlyph = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path d="M6 6 18 18M18 6 6 18" strokeLinecap="round" />
  </svg>
)

export type AnnouncementBarProps = {
  readonly announcement: Announcement
  readonly strings: SiteStrings
}

export async function AnnouncementBar({
  announcement,
  strings,
}: AnnouncementBarProps): Promise<React.ReactElement | null> {
  const dismissed = (await cookies()).get('rv_ann_dismissed')?.value === announcement.token
  if (dismissed) return null

  const regionLabel = siteString(strings, 'UI_LABEL.announcement.region')
  const dismissLabel = siteString(strings, 'ACTION_LABEL.dismiss_announcement')

  return (
    <section
      // `aria-label` only when the string resolved. A region with an empty name is worse than an
      // unnamed one: a screen reader announces "region" and then nothing.
      {...(regionLabel === null ? {} : { 'aria-label': regionLabel })}
      className="bg-surface-inverse text-ink-inverse"
    >
      <Container size="wide" className="flex items-center justify-between gap-4 py-2">
        <p className="text-sm leading-body">
          {announcement.message}
          {announcement.ctaLabel !== null && announcement.ctaHref !== null ? (
            <>
              {' '}
              <TextLink href={announcement.ctaHref} className="text-ink-inverse">
                {announcement.ctaLabel}
              </TextLink>
            </>
          ) : null}
        </p>

        {/*
         * No `method` and no `action` URL: a Server Action form posts to the current route, which
         * is what makes the dismissal work on any page without knowing which page it is on.
         * `dismissAnnouncement` revalidates the layout, so the response already has the bar gone.
         */}
        {dismissLabel === null ? null : (
          <form action={dismissAnnouncement}>
            <input type="hidden" name="token" value={announcement.token} />
            <IconButton
              type="submit"
              size="sm"
              variant="ghost"
              aria-label={dismissLabel}
              className="text-ink-inverse"
            >
              {DismissGlyph}
            </IconButton>
          </form>
        )}
      </Container>
    </section>
  )
}
