import type * as React from 'react'

import { ErrorSurface } from '@/components/patterns/ErrorSurface'
import { siteString } from '@/lib/cms/strings'
import { getSiteChrome } from '@/lib/site/chrome'

/**
 * A path under the site that resolved to nothing (SEED §45).
 *
 * TWO NOT-FOUND FILES, AND THE DIFFERENCE MATTERS. This one is inside the `(site)` group, so Next
 * renders it within the public shell: a visitor who followed a stale link gets the header, the
 * menu and the footer, and §45's body — "there is more to explore" — is true rather than an empty
 * promise. `app/not-found.tsx` handles a URL that matched no route at all, which is outside this
 * group and therefore outside this layout; it renders the same words with no chrome.
 *
 * A SERVER COMPONENT, unlike `error.tsx`. `notFound()` is not an exception boundary — there is no
 * `reset` and nothing is broken — so this can read its copy directly and needs no provider.
 *
 * NO MEDIA. Same reason as the 500 surface: the likeliest thing to be wrong when a page does not
 * resolve is not media, but a 404 that depends on an image is one that can fail twice.
 */
export default async function SiteNotFound(): Promise<React.ReactElement> {
  const { strings } = await getSiteChrome()

  const collection = siteString(strings, 'CTA.view_the_collection')
  const home = siteString(strings, 'CTA.return_home')

  return (
    <ErrorSurface
      eyebrow={siteString(strings, 'ERROR.not_found.eyebrow')}
      heading={siteString(strings, 'ERROR.not_found.heading')}
      body={siteString(strings, 'ERROR.not_found.body')}
      actions={[
        // §45's order: the collection first, home second. A visitor who reached a dead end is more
        // likely to want the catalogue than the front door.
        ...(collection === null ? [] : [{ label: collection, href: '/collection' }]),
        ...(home === null ? [] : [{ label: home, href: '/' }]),
      ]}
    />
  )
}
