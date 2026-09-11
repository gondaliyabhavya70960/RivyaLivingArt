import { optionalEnv } from '@/lib/env'
import { siteOrigin } from '@/lib/seo/canonical'
import { sitemapIndexXml } from '@/lib/seo/sitemap'

/**
 * `/sitemap.xml` — the index, and only the index. Six children under `/sitemaps/<type>.xml`
 * (`app/sitemaps/[file]/route.ts`); no URL is listed here directly.
 *
 * A ROUTE HANDLER RATHER THAN `app/sitemap.ts`, because Next's metadata-file convention writes a
 * `<urlset>` and cannot write a `<sitemapindex>` — and the phase document's split is the point:
 * a crawler fetching the products file does not re-read every journal entry, and a file that
 * crosses 5 000 URLs splits without touching the others.
 *
 * WITHOUT AN ORIGIN THERE IS NO SITEMAP. `NEXT_PUBLIC_SITE_URL` unset or malformed is the
 * development state, and a sitemap of relative locations is invalid rather than merely
 * unhelpful; a 404 is the honest answer, and `robots.txt` omits the `Sitemap:` line in the same
 * state for the same reason.
 */
export const revalidate = 3600

export function GET(): Response {
  const origin = siteOrigin(optionalEnv('NEXT_PUBLIC_SITE_URL'))
  if (origin === null) return new Response(null, { status: 404 })

  return new Response(sitemapIndexXml(origin), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
