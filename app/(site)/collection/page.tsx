import type { Metadata } from 'next'
import type * as React from 'react'

import { cmsPageMetadata, renderCmsPage } from '@/lib/cms/render-page'

/**
 * /collection
 *
 * Phase 14 adds /collection/[category] beside this; this file stays the index.
 *
 * ONE FILE PER D3 PATH, deliberately, rather than a catch-all segment: the route map lives in the
 * file system where D3 says it does, and `tests/unit/site-routes.test.ts` asserts the set of files
 * here equals the set of static paths exactly — no missing route, no undeclared one.
 */
const PATH = '/collection'

export async function generateMetadata(): Promise<Metadata> {
  return cmsPageMetadata(PATH)
}

export default async function CollectionPage(): Promise<React.ReactElement> {
  return renderCmsPage(PATH)
}
