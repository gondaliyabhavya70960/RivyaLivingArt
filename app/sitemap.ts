import type { MetadataRoute } from 'next'

import { createPublicClient } from '@/lib/supabase/public'
import { listPublicPagePaths } from '@/lib/supabase/repositories/cms'

/**
 * `/sitemap.xml`, listing published paths only.
 *
 * IT LISTS WHAT A VISITOR CAN ACTUALLY LOAD, which is a narrower set than "published pages".
 * `renderCmsPage` answers a page whose sections are all unpublished with a 404, so listing it here
 * would advertise a URL that 404s — and a sitemap full of 404s is how a site teaches a crawler to
 * distrust it. `listPublicPagePaths` inner-joins the sections for exactly that reason.
 *
 * IN THE SEEDED STATE THIS IS EMPTY, and correctly so: Phase 09 seeds every section `DRAFT`, so
 * nothing is live yet. An empty sitemap is a true statement about a site with no published pages.
 *
 * `/search` IS ABSENT AND MUST STAY ABSENT. It has no `pages` row, and a search-results URL is not
 * a document — it is a query surface whose contents depend on a parameter. It is `noindex` in its
 * own metadata for the same reason.
 *
 * THE ANONYMOUS CLIENT IS THE FILTER. Nothing here says `status = 'PUBLISHED'`; RLS does, in the
 * policy, once. A hand-written status filter would be a second copy of the publication rule that
 * could drift from the one the site actually renders by.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = process.env['NEXT_PUBLIC_SITE_URL']?.trim()
  // Without an origin there is no absolute URL to emit, and a sitemap of relative paths is invalid
  // rather than merely unhelpful. Empty is the honest answer in development.
  if (origin === undefined || origin === '') return []

  const pages = await listPublicPagePaths(createPublicClient())

  return pages.map((page) => ({
    url: new URL(page.path, origin).toString(),
    lastModified: new Date(page.updatedAt),
  }))
}
