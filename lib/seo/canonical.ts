/**
 * The canonical rules — PHASE-39-46 §Phase 39, one table, no exceptions:
 *
 *   any static path                          `${NEXT_PUBLIC_SITE_URL}${path}`, no trailing slash, no query
 *   /collection/[category] with filters      the UNFILTERED category path
 *   /collection/[category]?page=n, n > 1     the paginated URL itself, plus rel=prev/next
 *   /search and any ?q=                      none — the route is noindex, follow
 *   draft preview routes                     none — noindex, nofollow
 *   an owner-set seo_entries.canonical_url   that value, absolute, validated as same-origin
 *
 * PURE. The origin comes in as a string; nothing here reads the environment, so a test can state
 * every case without stubbing a variable.
 *
 * A FILTERED LISTING IS `noindex, follow` AND CANONICAL TO THE UNFILTERED PATH. Before Phase 39 the
 * catalogue passed its full query as the canonical, on the reasoning that page 2 of a filtered
 * listing is a real page — and it is, but it is one of an unbounded number of them, and a crawler
 * that indexes every combination of material, price band and sort has indexed the same twenty
 * products two thousand times. The category path is the page; the filters are a view of it.
 * Pagination alone is different: `?page=2` is a fixed, finite, linkable address, and it stays
 * canonical to itself.
 */

export type CanonicalSource = 'OWNER' | 'PAGINATED' | 'UNFILTERED' | 'PATH' | 'NONE'

export type CanonicalInput = {
  /** `NEXT_PUBLIC_SITE_URL`, or null when unset or malformed. */
  readonly siteUrl: string | null
  readonly path: string
  /** A listing's page number. Absent or 1 means the bare path. */
  readonly page?: number
  /** A listing with any query beyond `page` — filters, sort, a collection facet. */
  readonly filtered?: boolean
  /** `/search`, and any route whose contents depend on `?q=`. */
  readonly searchSurface?: boolean
  /** `seo_entries.canonical_url` from the ENTITY or PATH rung, when an owner set one. */
  readonly ownerCanonical?: string | null
}

export type CanonicalResult = {
  /** Site-relative, for `alternates.canonical` (Next resolves it against `metadataBase`). */
  readonly path: string | null
  /** Absolute, for `og:url`. Null without an origin, or when the page has no canonical. */
  readonly href: string | null
  readonly source: CanonicalSource
  /** True when the canonical rule itself says the view must not be indexed. */
  readonly noindex: boolean
}

/** `NEXT_PUBLIC_SITE_URL` reduced to its origin, or null. A malformed value is null, never a guess. */
export function siteOrigin(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() ?? ''
  if (trimmed === '') return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.origin
  } catch {
    return null
  }
}

/** `/about/` → `/about`; `/` stays `/`. Trailing slashes are two addresses for one page. */
export function stripTrailingSlash(path: string): string {
  if (path.length > 1 && path.endsWith('/')) return path.replace(/\/+$/, '') || '/'
  return path
}

/** `?page=n`, and nothing else. Page 1 has no parameter, so page 1's address is the bare path. */
export function paginatedPath(path: string, page: number): string {
  const base = stripTrailingSlash(path)
  return page <= 1 ? base : `${base}?page=${String(page)}`
}

/**
 * An owner-typed canonical, accepted only as an absolute same-origin URL.
 *
 * A canonical pointing at another host is a statement that this page is a copy of someone
 * else's, and an owner typing one has almost certainly mistyped; a relative one is ambiguous
 * about what it is relative to. Both are refused (null) rather than corrected, and the Studio's
 * validator says why before the row is saved.
 */
export function sameOriginCanonical(
  value: string | null | undefined,
  siteUrl: string | null,
): string | null {
  const trimmed = value?.trim() ?? ''
  if (trimmed === '' || siteUrl === null) return null
  try {
    const url = new URL(trimmed)
    if (url.origin !== siteUrl) return null
    url.hash = ''
    return `${url.origin}${stripTrailingSlash(url.pathname)}${url.search}`
  } catch {
    return null
  }
}

export function canonicalFor(input: CanonicalInput): CanonicalResult {
  const origin = input.siteUrl === null ? null : siteOrigin(input.siteUrl)
  const absolute = (path: string): string | null =>
    origin === null ? null : new URL(path, origin).toString()

  if (input.searchSurface) return { path: null, href: null, source: 'NONE', noindex: true }

  const base = stripTrailingSlash(input.path)

  if (input.filtered) {
    // The filters are a view of the category, so the category is the canonical — and this view
    // is not indexed at all. Page numbers under a filter are part of the same unbounded set.
    return { path: base, href: absolute(base), source: 'UNFILTERED', noindex: true }
  }

  const owner = sameOriginCanonical(input.ownerCanonical, origin)
  if (owner !== null) {
    const url = new URL(owner)
    return {
      path: `${url.pathname}${url.search}`,
      href: owner,
      source: 'OWNER',
      noindex: false,
    }
  }

  const page = input.page ?? 1
  if (page > 1) {
    const paged = paginatedPath(base, page)
    return { path: paged, href: absolute(paged), source: 'PAGINATED', noindex: false }
  }

  return { path: base, href: absolute(base), source: 'PATH', noindex: false }
}
