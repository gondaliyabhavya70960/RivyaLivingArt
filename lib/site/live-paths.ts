/**
 * The paths that answer 200 — which is NOT the set of paths with published content.
 *
 * WHY THIS IS NOT ONE QUERY. `listPublicPagePaths` asks the question the `pages` table can answer:
 * does this path have a row with at least one section the anonymous client can see? For twelve of
 * the site's paths that is the same question as "will it render". For the seven `/collection/<slug>`
 * paths it is not, because `app/(site)/collection/[category]/page.tsx` gates on the `categories`
 * table FIRST and calls `notFound()` before any section is looked at. `pages` has no foreign key to
 * `categories` — the two are joined only by the convention `path = '/collection/' || slug` — so
 * PostgREST cannot express the conjunction and the caller has to compose it. It costs no extra
 * query: `getSiteChrome` already loads both lists.
 *
 * THE DEFECT THIS EXISTS TO FIX (Phase 45). Every `categories` row is `DRAFT`, so all seven
 * category routes 404 — while `livePaths` reported every one of them live, because each has a
 * published `pages` row. `resolveInternalTarget` is the one mechanism in this codebase built to
 * stop a dead link reaching a visitor, and it was being handed an oracle that was wrong about the
 * seven most important destinations on the site. A wrong oracle is worse than none: it is trusted.
 *
 * DELIBERATELY NOT GENERALISED. `/product/<slug>` and `/journal/<slug>` never appear in
 * `publicPaths` at all — they have no `pages` rows — so the prefix branch below is the only
 * asymmetry that exists today. A second prefix belongs here the day a second entity route grows a
 * `pages` row, and not before: a general "route resolver" with one real case is a thing nobody can
 * test.
 */

/** The one path family whose `pages` row does not decide whether it renders. */
const CATEGORY_PREFIX = '/collection/'

/**
 * Compose the two gates.
 *
 * `categories.slug` is `citext` and `product/[slug]` lower-cases before comparing, so both sides
 * are normalised here rather than trusting either caller.
 */
export function livePathsFrom(
  publicPaths: Iterable<string>,
  visibleCategorySlugs: Iterable<string>,
): ReadonlySet<string> {
  const slugs = new Set([...visibleCategorySlugs].map((slug) => slug.toLowerCase()))
  const live = new Set<string>()

  for (const path of publicPaths) {
    if (path.startsWith(CATEGORY_PREFIX)) {
      const slug = path.slice(CATEGORY_PREFIX.length).replace(/\/+$/u, '').toLowerCase()
      // The `pages` row is live; the route is not. Only the route matters to a link.
      if (!slugs.has(slug)) continue
    }
    live.add(path)
  }

  return live
}
