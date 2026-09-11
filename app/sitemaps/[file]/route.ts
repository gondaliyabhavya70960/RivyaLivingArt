import { optionalEnv } from '@/lib/env'
import { siteOrigin } from '@/lib/seo/canonical'
import { isSitemapType, sitemapEntries, urlsetXml } from '@/lib/seo/sitemap'
import { createPublicClient } from '@/lib/supabase/public'
import { listSitemapRows } from '@/lib/supabase/repositories/sitemap'

/**
 * `/sitemaps/{pages,categories,products,collections,portfolio,journal}.xml` — the six children.
 *
 * PUBLISHED ROWS ONLY, TWICE OVER: the anonymous client's policies admit nothing else, and
 * `sitemapEntries()` checks `status` again. `lastmod` is `published_at` falling back to
 * `updated_at`. No `priority`, no `changefreq`, no images — `lib/seo/sitemap.ts` says why.
 *
 * ANY OTHER FILE NAME IS A 404, including `images.xml`: an image sitemap must not exist while the
 * site's imagery is concept media (D6, D10), and the surest way for it not to exist is for the
 * route to refuse the name.
 */
export const revalidate = 3600

export async function GET(
  _request: Request,
  context: { params: Promise<{ file: string }> },
): Promise<Response> {
  const origin = siteOrigin(optionalEnv('NEXT_PUBLIC_SITE_URL'))
  if (origin === null) return new Response(null, { status: 404 })

  const { file } = await context.params
  const type = file.endsWith('.xml') ? file.slice(0, -'.xml'.length) : ''
  if (!isSitemapType(type)) return new Response(null, { status: 404 })

  const rows = await listSitemapRows(createPublicClient(), type)
  return new Response(urlsetXml(sitemapEntries(rows, origin)), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
