/**
 * D3's static public paths, as a value the application can reason about.
 *
 * WHY THIS EXISTS RATHER THAN LIVING ONLY IN THE FILE SYSTEM. Two surfaces need to know which
 * addresses are real: `tests/unit/site-routes.test.ts`, which asserts the route files and this
 * list agree exactly, and `/studio/content/navigation`, which tells an editor whether the `href`
 * they typed resolves to anything. The file system is the fact; this is the declaration, and the
 * test is what keeps the two from drifting.
 *
 * THE DYNAMIC ROUTES ARE ABSENT ON PURPOSE. `/collection/[category]`, `/product/[slug]`,
 * `/collections/[slug]`, `/portfolio/[slug]`, `/journal/[slug]` and `/journal/category/[slug]`
 * belong to Phases 14 to 18. Listing them here would make the parity test demand route files that
 * do not exist yet, or worse, invite someone to create empty ones to satisfy it. A path under one
 * of those families still resolves in Studio when a `pages` row carries it — the seven CATEGORY
 * pages are exactly that case — which is why href resolution consults the database as well.
 */
export const STATIC_PUBLIC_PATHS = [
  '/',
  '/about',
  '/process',
  '/large-format',
  '/collection',
  '/custom-commissions',
  '/portfolio',
  '/journal',
  '/contact',
  '/faq',
  '/search',
  '/privacy',
  '/terms',
] as const

export type StaticPublicPath = (typeof STATIC_PUBLIC_PATHS)[number]
