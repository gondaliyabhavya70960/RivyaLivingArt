import type { Metadata } from 'next'
import type * as React from 'react'

import { cmsPageMetadata, renderCmsPage } from '@/lib/cms/render-page'

/**
 * /
 *
 * ONE FILE PER D3 PATH, deliberately, rather than a catch-all segment: the route map lives in the
 * file system where D3 says it does, and `tests/unit/site-routes.test.ts` asserts the set of files
 * here equals the set of static paths exactly — no missing route, no undeclared one.
 *
 * THE HOMEPAGE NO LONGER CARRIES ITS OWN STRUCTURED DATA. Phase 39 moved `WebSite` and
 * `Organization` to `app/(site)/layout.tsx`, where they are emitted once for every public route:
 * the site's identity is a property of the site, not of one page. `lib/seo/jsonld/` states why
 * the absences in those two nodes matter more than the presences.
 */
const PATH = '/'

export async function generateMetadata(): Promise<Metadata> {
  return cmsPageMetadata(PATH)
}

export default async function HomePage(): Promise<React.ReactElement> {
  return renderCmsPage(PATH)
}
