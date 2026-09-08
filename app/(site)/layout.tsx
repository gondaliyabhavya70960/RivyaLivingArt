import * as React from 'react'

import { AnnouncementBar } from '@/components/patterns/AnnouncementBar'
import { SiteFooter } from '@/components/patterns/SiteFooter'
import { SiteErrorCopyProvider } from '@/components/patterns/SiteErrorCopy'
import { SiteHeader } from '@/components/patterns/SiteHeader'
import { siteString } from '@/lib/cms/strings'
import { requiredEnv } from '@/lib/env'
import { getSiteChrome } from '@/lib/site/chrome'

/**
 * The public shell. Every route under `app/(site)/` renders inside it.
 *
 * THE ORDER IS THE ACCESSIBILITY CONTRACT, not a layout preference:
 *
 *   skip link → announcement → header → <main id="main"> → footer
 *
 * The skip link is FIRST IN THE DOM because it is the first thing a keyboard user reaches, and its
 * whole purpose is to let them past the header — which, with the mega menu open, is a lot of Tab
 * presses. `<main id="main">` is its target, and there is exactly one `<main>` on the page.
 *
 * THE CHROME IS FETCHED ONCE, HERE. `getSiteChrome()` is `React.cache`d, so a page that also needs
 * a string — or `generateMetadata`, which needs the brand name for the title template — asks for
 * it again and pays nothing. No component below this one fetches chrome.
 *
 * NO `'use client'` IN THIS FILE OR IN ANY PAGE BELOW IT. `scripts/site/check-client-boundary.mjs`
 * fails the build on one, because a client layout would drag the entire public site into the
 * browser bundle and turn every Server Component below it into a child that cannot fetch.
 *
 * THE ANNOUNCEMENT BAR IS RENDERED CONDITIONALLY AND THAT IS A PERFORMANCE DECISION, not a
 * cosmetic one. `AnnouncementBar` reads a cookie to decide whether it was dismissed, and reading a
 * cookie opts the whole route out of static rendering. When there is no announcement — which is
 * the seeded state, because §9's message awaits owner verification — the component is never
 * rendered, the cookie is never read, and every page on the site stays statically renderable.
 */
/**
 * INCREMENTAL, NOT FULLY STATIC — and this line is what makes `app/api/revalidate` work at all.
 *
 * Without it, every public route builds as a pure static file: no dynamic API is called, no
 * `fetch` is cached, so Next prerenders once at build time and serves that HTML forever.
 * `revalidatePath` then returns 200 and changes nothing, because there is no cache entry behind
 * the page to invalidate. That was the observed behaviour before this export existed — publish a
 * section, call the endpoint, get a 200, and the page keeps 404ing. It looks exactly like a broken
 * publish workflow and the endpoint reports success throughout.
 *
 * Declaring a revalidation window makes the route incremental instead, which is what gives
 * `revalidatePath` something to mark stale. The number is a BACKSTOP, not the mechanism: the
 * intended path is that Phase 08's publishing service calls the endpoint the moment an editor
 * publishes, and the page is fresh within a request. An hour is how long the site could stay wrong
 * if that call is ever lost — long enough that a crawler is not re-rendering pages for nothing,
 * short enough that nobody has to be told to wait until tomorrow.
 *
 * It sits on the layout so it applies to every route beneath it. A per-page copy would be twelve
 * chances to forget one, and the one that was forgotten would be the one that looked broken.
 */
export const revalidate = 3600

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode
}): Promise<React.ReactElement> {
  const chrome = await getSiteChrome()
  const cloudName = requiredEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME')
  const skipLabel = siteString(chrome.strings, 'ACTION_LABEL.skip_to_content')

  return (
    <>
      {/*
       * Visually hidden until focused — `sr-only` plus `focus:not-sr-only`, so it is in the
       * accessibility tree and the tab order at all times and on screen only when it is being
       * used. A skip link that is `display: none` until focus can never receive focus.
       */}
      {skipLabel === null ? null : (
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-surface-raised focus:px-4 focus:py-2 focus:text-ink"
        >
          {skipLabel}
        </a>
      )}

      {chrome.announcement === null ? null : (
        <AnnouncementBar announcement={chrome.announcement} strings={chrome.strings} />
      )}

      <SiteHeader chrome={chrome} cloudName={cloudName} />

      {/* `tabIndex={-1}` so the skip link's jump actually moves focus rather than only the
          viewport — without it, the next Tab press returns to the top of the document. */}
      <main id="main" tabIndex={-1}>
        {/*
         * The provider wraps `children` — which is the already-server-rendered page tree, passed
         * as a prop — so nothing below becomes a Client Component. It exists only so that
         * `app/(site)/error.tsx`, which Next requires to be a Client Component, can render seeded
         * copy instead of five literals. See components/patterns/SiteErrorCopy.tsx.
         */}
        <SiteErrorCopyProvider
          copy={{
            heading: siteString(chrome.strings, 'ERROR.server_error.heading'),
            body: siteString(chrome.strings, 'ERROR.server_error.body'),
            tryAgain: siteString(chrome.strings, 'ACTION_LABEL.try_again'),
            returnHome: siteString(chrome.strings, 'CTA.return_home'),
            referenceLabel: siteString(chrome.strings, 'UI_LABEL.error.reference'),
          }}
        >
          {children}
        </SiteErrorCopyProvider>
      </main>

      <SiteFooter chrome={chrome} />
    </>
  )
}
