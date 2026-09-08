import { STATIC_PUBLIC_PATHS } from './routes'

/**
 * Does a `navigation_items.href` go anywhere?
 *
 * WHY THIS IS WORTH A MODULE. A menu item pointing at a path with no route is a link that 404s,
 * and nothing about it looks wrong: the item renders, the label is right, and the failure only
 * appears when a visitor clicks it. It is also the one class of mistake that `typedRoutes` cannot
 * catch, because the value arrives from the database long after the build — `NavLink` has to cast
 * to `Route` for exactly that reason. The check therefore belongs where the href is typed, which
 * is `/studio/content/navigation`.
 *
 * PURE, SO IT CAN BE TESTED. The two things it needs to know — the static route map and the paths
 * that have `pages` rows — are passed in.
 */

export type HrefResolution =
  /** The seed's inert `#`: a footer column heading, not a destination. */
  | 'HEADING'
  /** Another site. Not checked further: we cannot know whether someone else's URL resolves. */
  | 'EXTERNAL'
  /** A static route file, or a `pages` row carrying this path. */
  | 'RESOLVED'
  /** Site-relative and matching neither. Almost always a typo, and always a 404 for a visitor. */
  | 'UNKNOWN'

const INERT_HREF = '#'

/** Site-relative: one leading slash, and not `//`, which a browser reads as a host. */
function isInternal(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//')
}

/**
 * `/about/` and `/about` are the same page; `/` is only itself.
 *
 * Next resolves both spellings, so an editor who types a trailing slash has not made a mistake and
 * must not be told they have.
 */
function normalise(href: string): string {
  const trimmed = href.trim()
  if (trimmed === '/') return '/'
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
}

export function resolveHref(href: string, pagePaths: Iterable<string>): HrefResolution {
  const trimmed = href.trim()
  if (trimmed === INERT_HREF || trimmed === '') return 'HEADING'
  if (!isInternal(trimmed)) return 'EXTERNAL'

  // The query and the fragment are not part of the route. `/search?q=x` resolves iff `/search`
  // does, and an editor linking to an anchor on a real page has not made a mistake.
  const withoutQuery = normalise(trimmed.split(/[?#]/u)[0] ?? '')

  const known = new Set<string>([...STATIC_PUBLIC_PATHS, ...pagePaths].map(normalise))
  return known.has(withoutQuery) ? 'RESOLVED' : 'UNKNOWN'
}
