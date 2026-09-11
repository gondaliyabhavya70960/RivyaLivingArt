import type { Metadata } from 'next'
import type * as React from 'react'

import { JsonLd } from '@/components/patterns/JsonLd'
import { cmsPageMetadata, renderCmsPage } from '@/lib/cms/render-page'
import { faqPageJsonLd, graphOf } from '@/lib/seo/jsonld'
import { createPublicClient } from '@/lib/supabase/public'
import { listFaqs } from '@/lib/supabase/repositories/cms'

/**
 * /faq
 *
 * The 10 seeded FAQs render through the faq-list block, which Phase 11 builds.
 *
 * `FAQPage` STRUCTURED DATA ONLY FROM VERIFIED ROWS (Phase 39). `faqPageJsonLd` keeps the rows
 * whose `owner_verification = 'VERIFIED'` and answers null when none are — which is the seeded
 * state, every answer being OWNER_VERIFICATION_REQUIRED. The page still renders its answers; the
 * rich result waits for the owner's word, because a rich result carries none of the page's caveats.
 *
 * ONE FILE PER D3 PATH, deliberately, rather than a catch-all segment: the route map lives in the
 * file system where D3 says it does, and `tests/unit/site-routes.test.ts` asserts the set of files
 * here equals the set of static paths exactly — no missing route, no undeclared one.
 */
const PATH = '/faq'

export async function generateMetadata(): Promise<Metadata> {
  return cmsPageMetadata(PATH)
}

export default async function FaqPage(): Promise<React.ReactElement> {
  const [page, faqs] = await Promise.all([
    renderCmsPage(PATH),
    listFaqs(createPublicClient()).catch(() => []),
  ])
  return (
    <>
      <JsonLd graph={graphOf([faqPageJsonLd(faqs)])} />
      {page}
    </>
  )
}
