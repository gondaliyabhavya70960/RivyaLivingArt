import type { Metadata } from 'next'
import type * as React from 'react'

import { cmsPageMetadata, renderCmsPage } from '@/lib/cms/render-page'

/**
 * /large-format
 *
 * Phase 13 builds the Large Format experience.
 *
 * ONE FILE PER D3 PATH, deliberately, rather than a catch-all segment: the route map lives in the
 * file system where D3 says it does, and `tests/unit/site-routes.test.ts` asserts the set of files
 * here equals the set of static paths exactly — no missing route, no undeclared one.
 */
const PATH = '/large-format'

export async function generateMetadata(): Promise<Metadata> {
  return cmsPageMetadata(PATH)
}

export default async function LargeFormatPage(): Promise<React.ReactElement> {
  return renderCmsPage(PATH)
}
