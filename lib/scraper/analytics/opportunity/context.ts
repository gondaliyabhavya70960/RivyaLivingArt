import type { AnalyticsRow } from '../rows'

/**
 * Everything a signal may read, gathered ONCE by the repository and handed to pure functions.
 *
 * THE FIRST-PARTY SIDE IS COUNTED HERE AND NEVER JOINED. `publishedCountByCategory`,
 * `occupiedBandsByCurrency` and `materialVocabulary` come from reads of `products` and
 * `materials`; the comparison with a research row happens in the signal modules, in TypeScript.
 * No SQL join crosses the research boundary and no research module imports a first-party
 * repository (the no-auto-import guard).
 */

export interface ScoringRow extends AnalyticsRow {
  readonly materialTokens: readonly string[]
  /** The current version's normalised payload, or null when the row has no version yet. */
  readonly normalized: Readonly<Record<string, unknown>> | null
  readonly titleNormalized: string | null
  readonly availability: string | null
}

export interface OccupiedBands {
  /** The Phase 31 quantile edges for this currency, from the research rows. */
  readonly edges: readonly number[]
  /** Band indexes a published, priced Rivya product falls in. */
  readonly occupied: ReadonlySet<number>
  /** How many published Rivya products carry a price in this currency. */
  readonly pricedProducts: number
  readonly snapshotId: string | null
}

export interface ScoringContext {
  readonly asOf: Date
  readonly categories: readonly { readonly id: string; readonly slug: string }[]
  /** Published Rivya products per category id. Zero is a real answer; an absent key is zero too. */
  readonly publishedCountByCategory: ReadonlyMap<string, number>
  readonly occupiedBandsByCurrency: ReadonlyMap<string, OccupiedBands>
  readonly enabledSourceCount: number
  /** Days since a source's first run, or null when it has never run. */
  readonly runHistoryDaysBySource: ReadonlyMap<string, number | null>
  /** MATERIAL changes in the last 90 days, keyed by category id (or `unmapped`). */
  readonly materialChanges90dByCategory: ReadonlyMap<string, number>
  /** Distinct source ids listing a row in (category id, band index). */
  readonly sourcesByCategoryBand: ReadonlyMap<string, ReadonlySet<string>>
  /** Attribute keys each source's `attribute_extraction` declares. */
  readonly attributeKeysBySource: ReadonlyMap<string, ReadonlySet<string>>
  /** Lower-cased material tokens: `materials.slug` and every word of `materials.name`. */
  readonly materialVocabulary: ReadonlySet<string>
}

export const densityKey = (categoryId: string | null, bandIndex: number | null): string =>
  `${categoryId ?? 'unmapped'}:${bandIndex === null ? 'none' : String(bandIndex)}`
