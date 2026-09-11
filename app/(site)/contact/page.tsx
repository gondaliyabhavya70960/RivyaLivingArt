import type { Metadata } from 'next'
import type * as React from 'react'

import { JsonLd } from '@/components/patterns/JsonLd'
import { cmsPageMetadata, renderCmsPage } from '@/lib/cms/render-page'
import { optionalEnv } from '@/lib/env'
import { siteOrigin } from '@/lib/seo/canonical'
import { contactPointJsonLd, graphOf } from '@/lib/seo/jsonld'
import { getSiteChrome } from '@/lib/site/chrome'

/**
 * /contact
 *
 * Phase 20 makes the form submit. Until then it renders from its seeded schema with the submit control disabled.
 *
 * ONE FILE PER D3 PATH, deliberately, rather than a catch-all segment: the route map lives in the
 * file system where D3 says it does, and `tests/unit/site-routes.test.ts` asserts the set of files
 * here equals the set of static paths exactly — no missing route, no undeclared one.
 */
const PATH = '/contact'

export async function generateMetadata(): Promise<Metadata> {
  return cmsPageMetadata(PATH)
}

export default async function ContactPage(): Promise<React.ReactElement> {
  const [page, chrome] = await Promise.all([renderCmsPage(PATH), getSiteChrome()])
  const origin = siteOrigin(optionalEnv('NEXT_PUBLIC_SITE_URL'))
  /*
   * `ContactPoint` ONLY WHEN THE CONTACT SECTION IS VERIFIED (Phase 39). `chrome.contactVerified`
   * is the section's own `owner_verification`; until the owner has confirmed the destination the
   * node is null and nothing is emitted. No `address`, ever: there is no premises to verify.
   */
  const contact = contactPointJsonLd({
    verified: chrome.contactVerified,
    email: chrome.contact?.email ?? null,
    phone: chrome.contact?.phone ?? null,
    url: origin === null ? null : new URL(PATH, origin).toString(),
  })
  return (
    <>
      <JsonLd graph={graphOf([contact])} />
      {page}
    </>
  )
}
