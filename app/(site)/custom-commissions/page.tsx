import type { Metadata } from 'next'
import type * as React from 'react'

import { cmsPageMetadata, renderCmsPage } from '@/lib/cms/render-page'

/**
 * /custom-commissions
 *
 * ONE FILE PER D3 PATH, deliberately, rather than a catch-all segment: the route map lives in the
 * file system where D3 says it does, and `tests/unit/site-routes.test.ts` asserts the set of files
 * here equals the set of static paths exactly — no missing route, no undeclared one.
 *
 * THE ONE CMS ROUTE THAT READS A SEARCH PARAMETER, and therefore the one that is dynamic. Phase 15's
 * conversion rail links here as `/custom-commissions?product=<slug>`; Phase 19's configurator
 * resolves that piece, opens the form bound to it, and pre-fills the project type from the product's
 * own category. Reading `searchParams` opts a Server Component out of static rendering, so this is
 * a cost paid by this route alone — the other twelve CMS pages are unchanged.
 *
 * A SLUG THAT RESOLVES TO NOTHING IS NOT A 404. The parameter arrives from a shared link, an edited
 * URL or a piece that has since been unpublished, and the right response is the default brief rather
 * than taking the page down: the visitor still wants to ask about something.
 */
const PATH = '/custom-commissions'

export async function generateMetadata(): Promise<Metadata> {
  return cmsPageMetadata(PATH)
}

export default async function CustomCommissionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<React.ReactElement> {
  const params = await searchParams
  const product = params['product']
  // A repeated parameter arrives as an array. One product, so the first wins rather than the
  // request being refused: `?product=a&product=b` is a malformed link, not an attack.
  const slug = Array.isArray(product) ? product[0] : product
  return renderCmsPage(PATH, undefined, slug === undefined || slug === '' ? null : slug)
}
