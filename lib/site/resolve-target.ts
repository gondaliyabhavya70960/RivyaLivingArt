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
 * THAT DISTINCTION IS THE WHOLE PHASE-13 PROBLEM. The live set passed in here is built from
 * `listPublicPagePaths` — pages with at least one section the anonymous client can see — rather
 * than from every path in the route map, because a page whose sections are all DRAFT has a row and
 * answers 404. `/custom-commissions` was the original example and is no longer one: its sections
 * are published now, and `/faq`, `/privacy` and `/terms` are the three that hold the shape today.
 *
 * THE LIVE SET IS NO LONGER JUST `pages` — Phase 45. A `/collection/<slug>` listing is gated on the
 * `categories` table BEFORE any section is looked at, so a published `pages` row was not enough to
 * make one render and this function was being handed an oracle that was wrong about the seven most
 * important destinations on the site. `lib/site/live-paths.ts` composes both gates; a caller that
 * builds the set itself from `pages` alone will get the old, wrong answer.
 *
 * THE CHROME DOES NOT TAKE THE TEXT BRANCH. §8.1 of the design system records why: a navigation
 * item's entire payload is its destination, so `lib/site/menu.ts` omits it instead.
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
