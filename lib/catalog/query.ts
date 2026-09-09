import { z } from 'zod'

import {
  availabilityStateSchema,
  editionStateSchema,
  priceStateSchema,
} from '@/lib/supabase/schemas'
import type { Enums } from '@/lib/supabase/database.types'

/**
 * The catalogue query lives entirely in the URL.
 *
 * WHY THE URL AND NOT CLIENT STATE. A filter held in React state is a filter that cannot be
 * linked, bookmarked, shared, indexed, or reached with the back button, and that stops working
 * when JavaScript does not load. Every filter, the sort and the page are therefore query
 * parameters, the whole listing is server-rendered from them, and the filter rail is an ordinary
 * `<form method="get">`. Nothing on the listing needs JavaScript to work.
 *
 * AN UNPARSEABLE VALUE IS DROPPED, NOT AN ERROR. `?sort=price` and `?page=-4` are things crawlers,
 * old links and hand-edited URLs produce constantly; answering with a 400 would turn a stale
 * bookmark into a broken page. The value is discarded, the rest of the query still applies, and
 * `canonicalCatalogUrl` emits the URL WITHOUT it — so the canonical link tells a crawler the
 * address that actually describes what it is looking at, and the bad parameter does not
 * accumulate its own indexable variant of the page.
 *
 * PARSING IS TOTAL AND ORDER-INDEPENDENT. Values inside one parameter are de-duplicated and
 * sorted, so `?material=resin,oak` and `?material=oak,resin` are one canonical URL rather than two
 * pages with identical content. The parameters themselves are emitted in a fixed order for the
 * same reason.
 *
 * WHY THERE IS NO `price` SORT. Four price states, three of which carry no number at all: any
 * ordering across them would have to invent a position for "Request a Quote", and whatever it
 * invented would read to a visitor as a statement about cost. Sorting by a number that does not
 * exist is a fiction, so the option does not exist either. This is a decision, recorded in
 * `docs/project/BUSINESS_RULES.md`, not an omission to be filled in later.
 */

export type PriceState = Enums<'price_state'>
export type AvailabilityState = Enums<'availability_state'>
export type EditionState = Enums<'edition_state'>

export const CATALOG_SORTS = ['curated', 'newest', 'title'] as const
export type CatalogSort = (typeof CATALOG_SORTS)[number]

export const DEFAULT_SORT: CatalogSort = 'curated'

/** 24 per page: divisible by the 2-, 3- and 4-column grids the listing uses at its breakpoints. */
export const PAGE_SIZE = 24

/** The one value `?scale=` accepts. `products.is_large_format` is a boolean; this is its name. */
export const SCALE_LARGE_FORMAT = 'large-format'

/** The parameter names, in the order `canonicalCatalogUrl` emits them. */
export const CATALOG_PARAMS = [
  'material',
  'price',
  'availability',
  'edition',
  'scale',
  'customizable',
  'collection',
  'sort',
  'page',
] as const

export type CatalogParam = (typeof CATALOG_PARAMS)[number]

/** What a slug may look like. Anything else cannot name a row, so it is dropped before the query. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const slugSchema = z.string().regex(SLUG)

export interface CatalogQuery {
  /** Material slugs. OR within the dimension: a product matching any listed material qualifies. */
  readonly material: readonly string[]
  readonly price: readonly PriceState[]
  readonly availability: readonly AvailabilityState[]
  readonly edition: readonly EditionState[]
  readonly largeFormat: boolean
  readonly customizable: boolean
  /**
   * Collection slugs.
   *
   * MULTI-VALUED, LIKE EVERY OTHER DIMENSION, and the phase table's "collection slug" is satisfied
   * either way — a slug is what the parameter carries. Uniformity is the reason: a single-valued
   * dimension needs a different control from a multi-valued one (a select with an "any" option
   * rather than checkboxes), a different way to clear it, and its own word for "any". Allowing
   * more than one is a superset of the specified behaviour that keeps the rail one shape.
   */
  readonly collection: readonly string[]
  readonly sort: CatalogSort
  /** 1-based. Always at least 1; `page=0` and `page=-2` are dropped rather than clamped silently. */
  readonly page: number
}

export const EMPTY_CATALOG_QUERY: CatalogQuery = {
  material: [],
  price: [],
  availability: [],
  edition: [],
  largeFormat: false,
  customizable: false,
  collection: [],
  sort: DEFAULT_SORT,
  page: 1,
}

/** What `page.tsx` receives from Next: a value may be absent, a string, or repeated. */
export type RawSearchParams = Readonly<Record<string, string | string[] | undefined>>

/**
 * One parameter as a flat list of candidate values.
 *
 * `?material=oak,resin` and `?material=oak&material=resin` mean the same thing and are treated the
 * same way — the second form is what a `<form method="get">` with checkboxes produces, and the
 * first is what a hand-written link looks like. Supporting only one of them would make the rail
 * and its own links disagree.
 */
function values(raw: RawSearchParams, key: CatalogParam): string[] {
  const value = raw[key]
  if (value === undefined) return []
  const joined = Array.isArray(value) ? value : [value]
  return joined
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
}

/** Every value that parses, de-duplicated and sorted. Values that do not parse are dropped. */
function accepted<T extends string>(
  raw: RawSearchParams,
  key: CatalogParam,
  schema: z.ZodType<T>,
): T[] {
  const kept = new Set<T>()
  for (const candidate of values(raw, key)) {
    const result = schema.safeParse(candidate)
    if (result.success) kept.add(result.data)
  }
  return [...kept].sort()
}

/** The single-valued parameters take the FIRST parseable value; a repeat is not an error. */
function first<T extends string>(
  raw: RawSearchParams,
  key: CatalogParam,
  schema: z.ZodType<T>,
): T | null {
  for (const candidate of values(raw, key)) {
    const result = schema.safeParse(candidate)
    if (result.success) return result.data
  }
  return null
}

const sortSchema = z.enum(CATALOG_SORTS)

const pageSchema = z
  .string()
  .regex(/^\d+$/)
  .transform((value) => Number(value))
  .pipe(z.number().int().min(1).max(10_000))

export function parseCatalogQuery(raw: RawSearchParams): CatalogQuery {
  const page = (() => {
    for (const candidate of values(raw, 'page')) {
      const result = pageSchema.safeParse(candidate)
      if (result.success) return result.data
    }
    return 1
  })()

  return {
    material: accepted(raw, 'material', slugSchema),
    price: accepted(raw, 'price', priceStateSchema),
    availability: accepted(raw, 'availability', availabilityStateSchema),
    edition: accepted(raw, 'edition', editionStateSchema),
    largeFormat: values(raw, 'scale').includes(SCALE_LARGE_FORMAT),
    customizable: values(raw, 'customizable').includes('1'),
    collection: accepted(raw, 'collection', slugSchema),
    sort: first(raw, 'sort', sortSchema) ?? DEFAULT_SORT,
    page,
  }
}

/** True when nothing is filtering the listing — the difference between two empty states. */
export function hasActiveFilters(query: CatalogQuery): boolean {
  return (
    query.material.length > 0 ||
    query.price.length > 0 ||
    query.availability.length > 0 ||
    query.edition.length > 0 ||
    query.largeFormat ||
    query.customizable ||
    query.collection.length > 0
  )
}

/**
 * The query as URL parameters, in a fixed order, with defaults omitted.
 *
 * DEFAULTS ARE OMITTED SO THERE IS ONE ADDRESS PER RESULT SET. `?sort=curated&page=1` shows exactly
 * what `/collection/furniture` shows; emitting both would give a crawler two URLs for one page and
 * split whatever either had earned. Page 1 is the bare path, and the first page's `rel="prev"` is
 * therefore absent rather than pointing at a duplicate.
 */
export function catalogSearchParams(query: CatalogQuery): URLSearchParams {
  const params = new URLSearchParams()
  if (query.material.length > 0) params.set('material', query.material.join(','))
  if (query.price.length > 0) params.set('price', query.price.join(','))
  if (query.availability.length > 0) params.set('availability', query.availability.join(','))
  if (query.edition.length > 0) params.set('edition', query.edition.join(','))
  if (query.largeFormat) params.set('scale', SCALE_LARGE_FORMAT)
  if (query.customizable) params.set('customizable', '1')
  if (query.collection.length > 0) params.set('collection', query.collection.join(','))
  if (query.sort !== DEFAULT_SORT) params.set('sort', query.sort)
  if (query.page > 1) params.set('page', String(query.page))
  return params
}

/** `basePath` plus the canonical query string. The address this result set should be indexed at. */
export function canonicalCatalogUrl(basePath: string, query: CatalogQuery): string {
  const params = catalogSearchParams(query)
  const search = params.toString()
  return search === '' ? basePath : `${basePath}?${search}`
}

/**
 * The same URL with some of the query changed — how every control on the page builds its href.
 *
 * CHANGING ANY FILTER RETURNS TO PAGE 1, unless the caller is explicitly setting `page`. Filtering
 * from page 3 of an unfiltered listing to page 3 of a narrower one usually lands past the end of
 * the results, and a visitor reads an empty page as "no matches" rather than "wrong page".
 */
export function catalogUrl(
  basePath: string,
  query: CatalogQuery,
  changes: Partial<CatalogQuery> = {},
): string {
  const next: CatalogQuery = {
    ...query,
    ...changes,
    page: changes.page ?? (Object.keys(changes).length > 0 ? 1 : query.page),
  }
  return canonicalCatalogUrl(basePath, next)
}

/** Add or remove one value of a multi-valued dimension — what a facet checkbox link does. */
export function toggleCatalogValue<
  K extends 'material' | 'price' | 'availability' | 'edition' | 'collection',
>(query: CatalogQuery, dimension: K, value: CatalogQuery[K][number]): CatalogQuery {
  const current = query[dimension] as readonly string[]
  const next = current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value].sort()
  return { ...query, [dimension]: next, page: 1 }
}
