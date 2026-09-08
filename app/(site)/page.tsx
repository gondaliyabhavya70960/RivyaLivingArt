import type { Metadata } from 'next'
import type * as React from 'react'

import { cmsPageMetadata, renderCmsPage } from '@/lib/cms/render-page'
import { homepageJsonLd, serialiseJsonLd } from '@/lib/seo/jsonld'

/**
 * /
 *
 * ONE FILE PER D3 PATH, deliberately, rather than a catch-all segment: the route map lives in the
 * file system where D3 says it does, and `tests/unit/site-routes.test.ts` asserts the set of files
 * here equals the set of static paths exactly — no missing route, no undeclared one.
 *
 * THE HOMEPAGE IS THE ONE ROUTE THAT CARRIES STRUCTURED DATA, and it carries two nodes: `WebSite`
 * and `Organization`, with a name and a URL and nothing else. `lib/seo/jsonld.ts` states why the
 * absences matter more than the presences. Every other page's identity is its metadata; a
 * `WebSite` node on twelve pages would be twelve claims to be the site.
 *
 * IT RENDERS NOTHING WHEN THERE IS NOTHING TRUE TO SAY. With no `NEXT_PUBLIC_SITE_URL` or no
 * seeded brand name, `homepageJsonLd()` answers null and no script tag is emitted — rather than a
 * graph naming a business whose identity we had to guess.
 */
const PATH = '/'

export async function generateMetadata(): Promise<Metadata> {
  return cmsPageMetadata(PATH)
}

export default async function HomePage(): Promise<React.ReactElement> {
  const [graph, page] = await Promise.all([homepageJsonLd(), renderCmsPage(PATH)])

  return (
    <>
      {graph === null ? null : (
        <script
          type="application/ld+json"
          // The only `dangerouslySetInnerHTML` on the public site, and it is required: React
          // escapes text children as HTML, which would turn every `"` in the JSON into `&quot;`
          // and leave a crawler with a script it cannot parse. `serialiseJsonLd` escapes the one
          // sequence that actually matters inside a script block.
          dangerouslySetInnerHTML={{ __html: serialiseJsonLd(graph) }}
        />
      )}
      {page}
    </>
  )
}
