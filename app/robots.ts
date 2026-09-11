import type { MetadataRoute } from 'next'

import { optionalEnv } from '@/lib/env'
import { siteOrigin } from '@/lib/seo/canonical'

/**
 * `/robots.txt`.
 *
 * `/studio` IS DISALLOWED, AND THAT IS NOT HOW IT IS PROTECTED. `proxy.ts` redirects an
 * unauthenticated request and every Studio page calls `requirePermission()`; RLS refuses
 * underneath both; and since Phase 39 every `/studio` response also carries
 * `X-Robots-Tag: noindex, nofollow` (`next.config.ts`). This line exists so that a crawler does
 * not waste requests on a login redirect and so that no Studio URL appears in a search result —
 * a directive a well-behaved crawler honours and a hostile one ignores, which is why it is the
 * third layer and not the first.
 *
 * `/api` TOO, for the same reason and one more: `app/api/preview` sets a cookie, and a crawler
 * following it would be enabling draft mode for itself on every fetch. It would fail the
 * permission check, but it would fail it thousands of times.
 *
 * `/search` IS NOT DISALLOWED, DELIBERATELY. It is `noindex, follow` in its own metadata: a
 * crawler may pass through it and discover what it links to, and must not keep it. A `Disallow`
 * would block the pass-through as well as the index.
 *
 * THE SITEMAP IS THE INDEX, ANNOUNCED ONLY WHEN THERE IS AN ORIGIN TO ANNOUNCE IT AT. Without
 * `NEXT_PUBLIC_SITE_URL` the index route answers 404 and this line is omitted, so the two agree.
 *
 * A PREVIEW DEPLOYMENT IS NOT PROTECTED HERE — robots.txt is advisory. `next.config.ts` puts
 * `X-Robots-Tag: noindex, nofollow` on every response when `VERCEL_ENV` is not `production`,
 * which a crawler honours per response rather than per site.
 */
export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin(optionalEnv('NEXT_PUBLIC_SITE_URL'))

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/studio', '/api'],
    },
    ...(origin === null ? {} : { sitemap: new URL('/sitemap.xml', origin).toString() }),
  }
}
