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

/**
 * The dynamic public route families that EXIST on disk, as Next writes their segments.
 *
 * WHY THIS LIST EXISTS. `tests/unit/site-routes.test.ts` compares the route files against the
 * declaration and fails in both directions. Without this, the first dynamic route would have to be
 * exempted from the "no undeclared route" half of that test — and an exemption for one shape of
 * path is an exemption for every future one, which is exactly the drift the test prevents.
 *
 * IT IS SEPARATE FROM `STATIC_PUBLIC_PATHS` because the two answer different questions. A static
 * path is an address; a dynamic family is a shape. Studio's href resolution can check a typed href
 * against the first directly, and against the second only by consulting the database — which is
 * what `listPublicPagePaths` is for.
 *
 * Phase 14 added the first entry and Phase 15 the second. `/collections/[slug]`,
 * `/portfolio/[slug]`, `/journal/[slug]` and `/journal/category/[slug]` join them in Phases 16
 * to 18.
 */
export const DYNAMIC_PUBLIC_ROUTES = [
  '/collection/[category]',
  '/product/[slug]',
  '/collections/[slug]',
] as const

export type DynamicPublicRoute = (typeof DYNAMIC_PUBLIC_ROUTES)[number]
