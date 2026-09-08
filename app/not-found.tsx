import type * as React from 'react'

import { ErrorSurface } from '@/components/patterns/ErrorSurface'
import { siteString } from '@/lib/cms/strings'
import { getSiteChrome } from '@/lib/site/chrome'

/**
 * A URL that matched no route in the application at all.
 *
 * IT RENDERS WITHOUT THE SITE CHROME, and that is a consequence of where Next looks rather than a
 * design choice: a request that matches no route is not inside `app/(site)/`, so
 * `app/(site)/layout.tsx` never runs and there is no header to inherit. `app/(site)/not-found.tsx`
 * is the one a `notFound()` from a real route reaches, and it does have the chrome.
 *
 * IT STILL READS THE SAME SEEDED COPY. The words a visitor sees must not depend on which of the
 * two files they landed on — that is the kind of difference nobody notices for a year and then
 * cannot explain.
 *
 * IF THE DATABASE IS UNREACHABLE this throws, and `app/global-error.tsx` catches it. That is the
 * correct escalation: a 404 page that cannot read its own copy is not a 404 page.
 */
export default async function NotFound(): Promise<React.ReactElement> {
  const { strings } = await getSiteChrome()

  const collection = siteString(strings, 'CTA.view_the_collection')
  const home = siteString(strings, 'CTA.return_home')

  return (
    <ErrorSurface
      eyebrow={siteString(strings, 'ERROR.not_found.eyebrow')}
      heading={siteString(strings, 'ERROR.not_found.heading')}
      body={siteString(strings, 'ERROR.not_found.body')}
      actions={[
        ...(collection === null ? [] : [{ label: collection, href: '/collection' }]),
        ...(home === null ? [] : [{ label: home, href: '/' }]),
      ]}
    />
  )
}
