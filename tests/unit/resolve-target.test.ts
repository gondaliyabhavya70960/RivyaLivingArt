import { describe, expect, it } from 'vitest'

import { resolveInternalTarget } from '@/lib/site/resolve-target'

/**
 * Whether an editor's link may be an anchor.
 *
 * THE DISTINCTION THIS EXISTS FOR: a path can be real and still 404. `/custom-commissions` has a
 * route file and a `pages` row, and every section on it is DRAFT — so `resolveHref` calls it
 * RESOLVED (it is a known path) while a visitor clicking it gets a 404. `/large-format` links to it
 * twice. The live set is therefore "pages with at least one published section", not the route map.
 *
 * NULL MEANS "RENDER THE CONTENT WITHOUT A LINK", never "hide the content". A card whose target is
 * not ready is still a card an editor wrote.
 */

/** What `getSiteChrome` supplies: the paths that actually render. */
const LIVE = new Set(['/', '/about', '/large-format'])

describe('resolveInternalTarget', () => {
  it('returns the path when the page is live', () => {
    expect(resolveInternalTarget('/about', LIVE)).toBe('/about')
  })

  it('returns null for a path whose page has nothing published', () => {
    // The Phase 13 case exactly: the route exists, the row exists, every section is DRAFT.
    expect(resolveInternalTarget('/custom-commissions', LIVE)).toBeNull()
  })

  it('returns null for an empty or missing href', () => {
    expect(resolveInternalTarget('', LIVE)).toBeNull()
    expect(resolveInternalTarget(null, LIVE)).toBeNull()
    expect(resolveInternalTarget(undefined, LIVE)).toBeNull()
    // The seed's inert `#` is a footer column heading, not a destination.
    expect(resolveInternalTarget('#', LIVE)).toBeNull()
  })

  it('accepts a trailing slash as the same page', () => {
    // Next resolves both spellings, so an editor who typed one has not made a mistake.
    expect(resolveInternalTarget('/about/', LIVE)).toBe('/about/')
  })

  it('keeps a query and a fragment while judging the path', () => {
    expect(resolveInternalTarget('/about?x=1', LIVE)).toBe('/about?x=1')
    expect(resolveInternalTarget('/about#materials', LIVE)).toBe('/about#materials')
    expect(resolveInternalTarget('/nope?x=1', LIVE)).toBeNull()
  })

  it('passes an external URL through unchecked', () => {
    // We cannot know whether someone else's URL resolves, and refusing to render one because we
    // cannot check it would make every outbound link unpublishable.
    expect(resolveInternalTarget('https://example.test/x', LIVE)).toBe('https://example.test/x')
  })

  it('treats a protocol-relative URL as external rather than as a path', () => {
    expect(resolveInternalTarget('//evil.test/x', LIVE)).toBe('//evil.test/x')
  })

  it('resolves /search even though it has no page row', () => {
    // Amendment A9: `/search` is a query surface with nothing an editor composes, so it has no
    // `pages` row and always renders. "Has published sections" cannot judge it.
    expect(resolveInternalTarget('/search', LIVE)).toBe('/search')
    expect(resolveInternalTarget('/search?q=resin', LIVE)).toBe('/search?q=resin')
  })

  it('returns null for every path when nothing is live', () => {
    // The launch-day state of a fresh database: every section DRAFT, so every internal link on the
    // site renders as text. That is the correct outcome, not a bug to route around.
    expect(resolveInternalTarget('/about', new Set())).toBeNull()
  })
})
