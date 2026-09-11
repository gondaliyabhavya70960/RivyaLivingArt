import type { DimensionsMm, ParseState, ResearchPriceState } from '../normalization/schema'

/**
 * The one row shape every Phase 31 analysis reads.
 *
 * THE MODULES TAKE ROWS AND RETURN NUMBERS; THE REPOSITORY IS WHAT FETCHES. That split is why each
 * analysis is a fixture table with no database, and why `research:analytics --dry-run` costs zero
 * network traffic. Nothing here is a Supabase type: the repository maps a `research_products` row
 * into this once, and a column renamed later breaks one function rather than four.
 *
 * `categorySlug` IS RESOLVED BY THE CALLER FROM THE ALLOWLISTED TAXONOMY READ. The modules never
 * touch `categories`; they receive the slug beside the id so an unmapped row (`null`) is a bucket
 * they can name rather than a join they would have to make.
 */
export interface AnalyticsRow {
  readonly id: string
  readonly sourceId: string
  readonly matchedCategoryId: string | null
  readonly categorySlug: string | null
  /** Three-valued, from Phase 30: null is "we have no measurement". */
  readonly isLargeFormat: boolean | null
  readonly currency: string | null
  readonly priceState: ResearchPriceState | null
  readonly priceMinMinor: number | null
  readonly priceMaxMinor: number | null
  readonly dimensionsMm: DimensionsMm | null
  readonly dimensionParseState: ParseState
  readonly longestAxisMm: number | null
  readonly firstSeenAt: string
  readonly lastSeenAt: string
}

/** Days since `lastSeenAt` beyond which a row is counted `stale` rather than measured. */
export const DEFAULT_STALE_AFTER_DAYS = 90

export function isStale(row: AnalyticsRow, asOf: Date, staleAfterDays: number): boolean {
  const seen = Date.parse(row.lastSeenAt)
  if (!Number.isFinite(seen)) return true
  return asOf.getTime() - seen > staleAfterDays * 24 * 60 * 60 * 1000
}
