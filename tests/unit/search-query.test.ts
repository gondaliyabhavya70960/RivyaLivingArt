import { describe, expect, it } from 'vitest'

import {
  EMPTY_SEARCH_QUERY,
  QUERY_MAX,
  canonicalSearchUrl,
  isSearchable,
  normalizeQuery,
  parseSearchQuery,
  searchUrl,
} from '@/lib/search/query'
import { groupResults } from '@/lib/search/group'
import type { SearchHit } from '@/lib/supabase/repositories/search'

/**
 * What a search URL means, and what it means when it is nonsense.
 *
 * THE INTERESTING ASSERTIONS ARE THE ONES ABOUT RUBBISH INPUT. A search URL is typed by strangers
 * and shared by visitors, so `?type=banana` must return a search rather than an error page — a
 * mistyped link that 400s turns somebody's shared URL into a dead end.
 */

const hit = (over: Partial<SearchHit> = {}): SearchHit => ({
  id: over.id ?? 'id-1',
  entity_type: over.entity_type ?? 'product',
  entity_id: over.entity_id ?? 'e-1',
  visibility: 'PUBLIC',
  status: 'PUBLISHED',
  url_path: over.url_path ?? '/product/a',
  title: over.title ?? 'A',
  subtitle: null,
  body: null,
  keywords: [],
  image_media_id: null,
  category_slug: null,
  indexed_at: '2026-01-01T00:00:00+00:00',
  rank: over.rank ?? 1,
  matchMode: over.matchMode ?? 'EXACT',
})

describe('parseSearchQuery', () => {
  it('reads a plain query', () => {
    expect(parseSearchQuery({ q: 'resin table' })).toEqual({
      q: 'resin table',
      type: null,
      category: null,
      page: 1,
    })
  })

  it('returns the empty query when nothing was asked', () => {
    expect(parseSearchQuery({})).toEqual(EMPTY_SEARCH_QUERY)
  })

  it('truncates rather than refusing a very long query', () => {
    const parsed = parseSearchQuery({ q: 'a'.repeat(500) })
    expect(parsed.q).toHaveLength(QUERY_MAX)
  })

  it('DROPS an unknown type rather than failing the page', () => {
    expect(parseSearchQuery({ q: 'x', type: 'banana' }).type).toBeNull()
  })

  it('refuses a research type as a filter, because it is not a public entity type', () => {
    expect(parseSearchQuery({ q: 'x', type: 'research_product' }).type).toBeNull()
  })

  it('ignores a category unless the type is product — one result set, one URL', () => {
    expect(parseSearchQuery({ q: 'x', category: 'decor' }).category).toBeNull()
    expect(parseSearchQuery({ q: 'x', type: 'collection', category: 'decor' }).category).toBeNull()
    expect(parseSearchQuery({ q: 'x', type: 'product', category: 'decor' }).category).toBe('decor')
  })

  it('refuses a category that is not a slug, so nothing arbitrary reaches SQL', () => {
    expect(
      parseSearchQuery({ q: 'x', type: 'product', category: "de'cor; drop" }).category,
    ).toBeNull()
  })

  it('ignores a page number on the grouped landing view, where pagination has no meaning', () => {
    expect(parseSearchQuery({ q: 'x', page: '3' }).page).toBe(1)
    expect(parseSearchQuery({ q: 'x', type: 'product', page: '3' }).page).toBe(3)
  })

  it('takes the first value when a parameter repeats', () => {
    expect(parseSearchQuery({ q: ['first', 'second'] }).q).toBe('first')
  })
})

describe('isSearchable', () => {
  it('needs two characters', () => {
    expect(isSearchable(parseSearchQuery({ q: 'a' }))).toBe(false)
    expect(isSearchable(parseSearchQuery({ q: 'ab' }))).toBe(true)
    expect(isSearchable(parseSearchQuery({ q: '  a  ' }))).toBe(false)
  })
})

describe('normalizeQuery', () => {
  it('folds accents, case and whitespace so one search counts once', () => {
    expect(normalizeQuery('Résin   Table ')).toBe('resin table')
    expect(normalizeQuery('RESIN table')).toBe(normalizeQuery('resin  Table'))
  })

  it('leaves Devanagari alone rather than mangling it', () => {
    expect(normalizeQuery('राल')).toBe('राल')
  })
})

describe('canonicalSearchUrl', () => {
  it('omits every default, so one result set has one address', () => {
    expect(canonicalSearchUrl(parseSearchQuery({ q: 'resin' }))).toBe('/search?q=resin')
    expect(canonicalSearchUrl(parseSearchQuery({ q: 'resin', page: '1' }))).toBe('/search?q=resin')
  })

  it('is /search with nothing when no query was asked', () => {
    expect(canonicalSearchUrl(EMPTY_SEARCH_QUERY)).toBe('/search')
  })
})

describe('searchUrl', () => {
  it('returns to page one when anything but the page changes', () => {
    const query = parseSearchQuery({ q: 'resin', type: 'product', page: '4' })
    expect(searchUrl(query, { type: 'collection' })).toBe('/search?q=resin&type=collection')
    expect(searchUrl(query, { page: 5 })).toBe('/search?q=resin&type=product&page=5')
  })
})

describe('groupResults', () => {
  it('groups in the fixed order, whatever order the rows arrive in', () => {
    const grouped = groupResults([
      hit({ id: '1', entity_type: 'journal_article' }),
      hit({ id: '2', entity_type: 'product' }),
      hit({ id: '3', entity_type: 'category' }),
    ])
    expect(grouped.groups.map((group) => group.entityType)).toEqual([
      'product',
      'category',
      'journal_article',
    ])
  })

  it('keeps near matches OUT of the groups and in a band of their own', () => {
    const grouped = groupResults([
      hit({ id: '1', entity_type: 'product', matchMode: 'EXACT' }),
      hit({ id: '2', entity_type: 'product', matchMode: 'SIMILAR' }),
    ])
    expect(grouped.groups[0]?.hits).toHaveLength(1)
    expect(grouped.similar).toHaveLength(1)
    expect(grouped.exactCount).toBe(1)
    expect(grouped.similarCount).toBe(1)
  })

  it('reports the real total so a see-all link is honest', () => {
    const grouped = groupResults([hit()], { product: 34 })
    expect(grouped.groups[0]?.total).toBe(34)
  })

  it('renders no group for a type that matched nothing', () => {
    const grouped = groupResults([hit({ entity_type: 'product' })])
    expect(grouped.groups).toHaveLength(1)
  })
})
