import 'server-only'

import { siteString } from '@/lib/cms/strings'
import { optionalEnv } from '@/lib/env'
import { getSiteChrome } from '@/lib/site/chrome'
import { createPublicClient } from '@/lib/supabase/public'
import { getPageByPath } from '@/lib/supabase/repositories/cms'

import { siteOrigin } from './canonical'
import { breadcrumbJsonLd, type BreadcrumbJsonLd, type Crumb } from './jsonld'

/**
 * A trail of REAL published parents for an entity route — Phase 39.
 *
 * THE LISTING CRUMB EXISTS ONLY WHILE THE LISTING IS LIVE. `/journal` between the home page and an
 * article is a parent only if `/journal` currently renders — `chrome.livePaths` is the set of
 * paths with a published section, the same set the sitemap and the footer read — and its name is
 * the `pages` row's own title, never a literal. A trail that named a parent which 404s would be
 * exactly the fabricated parent the phase document forbids.
 *
 * NULL WITHOUT AN ORIGIN: a crumb's `item` must be absolute, and there is nothing to make one from.
 */
export async function entityBreadcrumbs(input: {
  /** The listing the entity sits under, e.g. `/journal`. */
  readonly listingPath: string | null
  readonly entityName: string
  readonly entityPath: string
}): Promise<BreadcrumbJsonLd | null> {
  const origin = siteOrigin(optionalEnv('NEXT_PUBLIC_SITE_URL'))
  if (origin === null) return null
  const absolute = (path: string): string => new URL(path, origin).toString()

  const chrome = await getSiteChrome()
  const listing =
    input.listingPath !== null && chrome.livePaths.has(input.listingPath)
      ? await getPageByPath(createPublicClient(), input.listingPath).catch(() => null)
      : null

  const trail: Crumb[] = [
    { name: siteString(chrome.strings, 'BRAND.brand.name'), url: absolute('/') },
    ...(listing === null || input.listingPath === null
      ? []
      : [{ name: listing.title, url: absolute(input.listingPath) }]),
    { name: input.entityName, url: absolute(input.entityPath) },
  ]
  return breadcrumbJsonLd(trail)
}
