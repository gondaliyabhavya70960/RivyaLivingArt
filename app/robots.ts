import type { MetadataRoute } from 'next'

/**
 * `/robots.txt`.
 *
 * `/studio` IS DISALLOWED, AND THAT IS NOT HOW IT IS PROTECTED. `proxy.ts` redirects an
 * unauthenticated request and every Studio page calls `requirePermission()`; RLS refuses
 * underneath both. This line exists so that a crawler does not waste requests on a login redirect
 * and so that no Studio URL appears in a search result — a directive a well-behaved crawler
 * honours and a hostile one ignores, which is why it is the third layer and not the first.
 *
 * `/api` TOO, for the same reason and one more: `app/api/preview` sets a cookie, and a crawler
 * following it would be enabling draft mode for itself on every fetch. It would fail the
 * permission check, but it would fail it thousands of times.
 *
 * THE SITEMAP IS ONLY ANNOUNCED WHEN THERE IS AN ORIGIN TO ANNOUNCE IT AT. `sitemap` takes an
 * absolute URL; without `NEXT_PUBLIC_SITE_URL` the field is omitted rather than emitted relative,
 * which crawlers ignore anyway.
 *
 * FULL SEO IS PHASE 39. This is the minimum that stops a preview deployment from being indexed as
 * if it were production.
 */
export default function robots(): MetadataRoute.Robots {
  const origin = process.env['NEXT_PUBLIC_SITE_URL']?.trim()

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/studio', '/api'],
    },
    ...(origin === undefined || origin === ''
      ? {}
      : { sitemap: new URL('/sitemap.xml', origin).toString() }),
  }
}
