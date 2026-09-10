import { z } from 'zod'

import { PUBLIC_ENTITY_TYPES, type PublicEntityType } from '@/lib/supabase/schemas'

/**
 * `/search?q=&type=&category=&page=` — what the URL means, and what it means when it is nonsense.
 *
 * A SEARCH URL IS TYPED BY STRANGERS AND SHARED BY VISITORS, so every value here is parsed rather
 * than trusted, and an unparseable value is DROPPED rather than rejected. A `?type=banana` that
 * 400s turns a mistyped link into an error page; the same link with the filter ignored returns the
 * search the visitor was trying to run. The only thing that can make this page fail is a query so
 * long it is not a query, and even that is truncated rather than refused.
 *
 * THE QUERY IS CAPPED AT 64 CHARACTERS on both surfaces. That is not a defence against attack — the
 * statement timeout and the cache are — it is a statement about what a search box is for. Sixty-four
 * characters is longer than any product name in the catalogue and longer than any two.
 *
 * NORMALISATION IS FOR COUNTING, NOT FOR SEARCHING. `normalizeQuery` lower-cases, strips accents
 * and collapses whitespace so that `Résin  Table` and `resin table` count as the same search in
 * `search_queries`. The database does its own unaccenting on the way into the vector; this exists
 * so the owner's "what did people look for" list is not three near-identical rows.
 */

export const QUERY_MIN = 2
export const QUERY_MAX = 64

/** Results per group on the landing view, and per page when one type is selected. */
export const GROUP_SIZE = 10
export const PAGE_SIZE = 20

export type RawSearchParams = Readonly<Record<string, string | string[] | undefined>>

export interface SearchQuery {
  /** Exactly what was typed, trimmed and truncated. Empty means "no search was run". */
  readonly q: string
  /** A single entity type, or null for the grouped landing view. */
  readonly type: PublicEntityType | null
  /** A category slug, honoured only when `type` is `product` — the Phase 14 URL contract. */
  readonly category: string | null
  readonly page: number
}

export const EMPTY_SEARCH_QUERY: SearchQuery = { q: '', type: null, category: null, page: 1 }

const typeSchema = z.enum(PUBLIC_ENTITY_TYPES)

/** The Phase 14 slug shape, so a crafted `?category=` cannot become an arbitrary string in SQL. */
const categorySchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)

const pageSchema = z
  .string()
  .regex(/^\d+$/)
  .transform((value) => Number(value))
  .pipe(z.number().int().min(1).max(500))

function firstValue(raw: RawSearchParams, key: string): string | null {
  const value = raw[key]
  if (value === undefined) return null
  const entry = Array.isArray(value) ? value[0] : value
  return entry === undefined ? null : entry
}

/**
 * Lower-cased, accent-stripped, whitespace-collapsed. What "the same search" means when counting.
 *
 * `NFD` + a combining-mark strip rather than a lookup table: it handles every accented Latin
 * character without a list anybody has to maintain, and leaves Devanagari — which has no accents to
 * strip — untouched rather than mangling it, which a naïve ASCII fold would.
 */
export function normalizeQuery(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseSearchQuery(raw: RawSearchParams): SearchQuery {
  const rawQ = firstValue(raw, 'q') ?? ''
  const q = rawQ.trim().slice(0, QUERY_MAX)

  const typeCandidate = firstValue(raw, 'type')
  const typeResult = typeCandidate === null ? null : typeSchema.safeParse(typeCandidate)
  const type = typeResult?.success === true ? typeResult.data : null

  const categoryCandidate = firstValue(raw, 'category')
  const categoryResult =
    categoryCandidate === null ? null : categorySchema.safeParse(categoryCandidate)
  // The category facet exists on the product listing and means nothing anywhere else. Keeping it
  // in the URL while ignoring it would produce two addresses for one result set, which is exactly
  // what the canonical builder exists to prevent.
  const category =
    type === 'product' && categoryResult?.success === true ? categoryResult.data : null

  const pageCandidate = firstValue(raw, 'page')
  const pageResult = pageCandidate === null ? null : pageSchema.safeParse(pageCandidate)
  // Pagination only exists on the single-type view. The landing view shows the first ten of each
  // group and links into the type view for more, so `?page=3` with no type is meaningless.
  const page = type !== null && pageResult?.success === true ? pageResult.data : 1

  return { q, type, category, page }
}

/** True when there is something to search for. Below two characters the endpoint refuses. */
export function isSearchable(query: SearchQuery): boolean {
  return query.q.length >= QUERY_MIN
}

export function searchParamsOf(query: SearchQuery): URLSearchParams {
  const params = new URLSearchParams()
  if (query.q !== '') params.set('q', query.q)
  if (query.type !== null) params.set('type', query.type)
  if (query.category !== null) params.set('category', query.category)
  if (query.page > 1) params.set('page', String(query.page))
  return params
}

/** The address this result set should be linked at — one URL per result set, always. */
export function canonicalSearchUrl(query: SearchQuery, basePath = '/search'): string {
  const search = searchParamsOf(query).toString()
  return search === '' ? basePath : `${basePath}?${search}`
}

/**
 * The same search with something changed. Any change but `page` returns to page one, for the
 * reason the catalogue does the same: page 3 of a narrower result set is usually past the end, and
 * an empty page reads as "no matches" rather than "wrong page".
 */
export function searchUrl(query: SearchQuery, changes: Partial<SearchQuery> = {}): string {
  const next: SearchQuery = {
    ...query,
    ...changes,
    page: changes.page ?? (Object.keys(changes).length > 0 ? 1 : query.page),
  }
  return canonicalSearchUrl(next)
}
