import { resolveHref } from './href-resolution'

/**
 * Where an editor's link actually goes, or nothing.
 *
 * WHY A SEPARATE FUNCTION FROM `resolveHref`. That one answers a Studio question — "is this
 * navigation item a heading, an external link, a real page or a typo?" — and it answers it about
 * paths that HAVE a `pages` row. This one answers a rendering question with a narrower test: may
 * this be an anchor on a public page RIGHT NOW? A page whose sections are all still DRAFT has a
 * row and answers 404, so it is a real path and not a live one, and an anchor to it is a dead link
 * inside a page body.
 *
 * THAT DISTINCTION IS THE WHOLE PHASE-13 PROBLEM. `/large-format` links to `/custom-commissions`
 * twice, and Phase 19 builds that page: today the route file exists, the `pages` row exists, and
 * every section on it is DRAFT. `resolveHref` says RESOLVED; a visitor gets a 404. So the live set
 * passed in here is `listPublicPagePaths` — pages with at least one section the anonymous client
 * can see — rather than every path in the route map.
 *
 * NULL MEANS "RENDER IT, BUT NOT AS A LINK". The copy an editor wrote is still true and still
 * belongs on the page; what cannot be honoured is the destination. A card whose target is not live
 * renders as text, and `CategoryListSection` and `SectionActions` both take that branch — the
 * alternative, hiding the content because its link is not ready, would delete an editor's work
 * over a URL.
 *
 * EXTERNAL LINKS PASS THROUGH UNCHANGED. We cannot know whether someone else's URL resolves, and
 * refusing to render one because we cannot check it would make every outbound link unpublishable.
 */
export function resolveInternalTarget(
  href: string | null | undefined,
  livePaths: Iterable<string>,
): string | null {
  const trimmed = href?.trim() ?? ''
  if (trimmed === '') return null

  const resolution = resolveHref(trimmed, livePaths)
  if (resolution === 'EXTERNAL') return trimmed
  if (resolution !== 'RESOLVED') return null

  /*
   * `resolveHref` accepts a path present in EITHER the static route map or the live set, which is
   * right for a menu item and wrong here: a static route with nothing published on it still 404s.
   * So the live set is re-checked directly, and the route map is only consulted for the paths that
   * render without CMS content at all.
   */
  const withoutQuery = trimmed.split(/[?#]/u)[0] ?? ''
  const normalised = withoutQuery === '/' ? '/' : withoutQuery.replace(/\/+$/u, '')
  const live = new Set(
    [...livePaths].map((path) => (path === '/' ? '/' : path.replace(/\/+$/u, ''))),
  )

  return live.has(normalised) || ROUTES_WITHOUT_CMS_CONTENT.has(normalised) ? trimmed : null
}

/**
 * The public routes that render without a `pages` row, so "has published sections" cannot judge
 * them.
 *
 * `/search` is the whole list, and amendment A9 records why it has no row: it is a query surface
 * with nothing an editor composes. It always renders, so a link to it is always live.
 */
const ROUTES_WITHOUT_CMS_CONTENT: ReadonlySet<string> = new Set(['/search'])
