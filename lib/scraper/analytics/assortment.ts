import {
  coverageRecord,
  ExclusionTally,
  tallyThreeValued,
  type CoverageRecord,
  type Tally,
} from './coverage'
import { PRICED_STATES } from './price-architecture'
import { DEFAULT_STALE_AFTER_DAYS, isStale, type AnalyticsRow } from './rows'

/**
 * Assortment: what is actually being made, and in what proportion.
 *
 * PER SOURCE AND PER MAPPED CATEGORY, with `unmapped` as a first-class bucket. A row whose
 * `matchedCategoryId` is null is reported as unmapped and NEVER distributed across the seven
 * categories — shares that add to less than 100 % are a chart lying by omission, and a unit test
 * asserts they add to 100 ± 0.01 including the unmapped bucket.
 *
 * LARGE-FORMAT SHARE IS THREE-VALUED. `true`, `false` and `unknown` are all reported, because on a
 * corpus of other people's web pages the third number is usually the biggest one.
 *
 * "LIVE" MEANS SEEN RECENTLY. A row last seen ninety days ago is counted `stale` rather than as a
 * current listing; the repository already excludes rows a person has rejected, ignored or marked
 * duplicate, so this module sees only what is still in play.
 */

export const UNMAPPED = 'unmapped'

export interface CategoryShare {
  /** A category id, or `unmapped`. */
  readonly key: string
  readonly slug: string
  readonly count: number
  /** Percent of the scope, one decimal. */
  readonly share: number
}

export interface SourceAssortment {
  readonly sourceId: string
  readonly liveCount: number
  /** This source's share of every live row in scope, one decimal. */
  readonly share: number
  readonly largeFormat: Tally
  readonly pricedCount: number
  readonly pricedShare: number
  readonly firstSeenAt: string | null
  readonly lastSeenAt: string | null
  readonly byCategory: readonly CategoryShare[]
}

export interface AssortmentResult {
  readonly n: number
  readonly sources: readonly SourceAssortment[]
  readonly byCategory: readonly CategoryShare[]
  readonly largeFormat: Tally
  readonly coverage: CoverageRecord
}

export interface AssortmentOptions {
  readonly asOf: Date
  readonly staleAfterDays?: number
  /** Every category that may be matched, so an empty category still renders at zero. */
  readonly categories: readonly { readonly id: string; readonly slug: string }[]
}

export const METRIC_KEY = 'assortment'

const share = (part: number, whole: number): number =>
  whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10

function categoryShares(
  rows: readonly AnalyticsRow[],
  categories: AssortmentOptions['categories'],
): readonly CategoryShare[] {
  const counts = new Map<string, number>()
  for (const category of categories) counts.set(category.id, 0)
  counts.set(UNMAPPED, 0)
  for (const row of rows) {
    const key =
      row.matchedCategoryId !== null && counts.has(row.matchedCategoryId)
        ? row.matchedCategoryId
        : UNMAPPED
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const slugs = new Map(categories.map((category) => [category.id, category.slug]))
  return [...counts.entries()].map(([key, count]) => ({
    key,
    slug: key === UNMAPPED ? UNMAPPED : (slugs.get(key) ?? key),
    count,
    share: share(count, rows.length),
  }))
}

export function computeAssortment(
  rows: readonly AnalyticsRow[],
  options: AssortmentOptions,
): AssortmentResult {
  const staleAfterDays = options.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS
  const excluded = new ExclusionTally()
  const live: AnalyticsRow[] = []
  for (const row of rows) {
    if (isStale(row, options.asOf, staleAfterDays)) {
      excluded.add('stale')
      continue
    }
    live.push(row)
  }

  const bySource = new Map<string, AnalyticsRow[]>()
  for (const row of live) {
    const list = bySource.get(row.sourceId) ?? []
    list.push(row)
    bySource.set(row.sourceId, list)
  }

  const sources = [...bySource.entries()]
    .map(([sourceId, sourceRows]): SourceAssortment => {
      const priced = sourceRows.filter(
        (row) =>
          row.priceState !== null &&
          PRICED_STATES.has(row.priceState) &&
          row.priceMinMinor !== null,
      ).length
      const seen = sourceRows.map((row) => row.firstSeenAt).sort()
      const last = sourceRows.map((row) => row.lastSeenAt).sort()
      return {
        sourceId,
        liveCount: sourceRows.length,
        share: share(sourceRows.length, live.length),
        largeFormat: tallyThreeValued(sourceRows.map((row) => row.isLargeFormat)),
        pricedCount: priced,
        pricedShare: share(priced, sourceRows.length),
        firstSeenAt: seen[0] ?? null,
        lastSeenAt: last[last.length - 1] ?? null,
        byCategory: categoryShares(sourceRows, options.categories),
      }
    })
    .sort((a, b) => b.liveCount - a.liveCount || a.sourceId.localeCompare(b.sourceId))

  return {
    n: live.length,
    sources,
    byCategory: categoryShares(live, options.categories),
    largeFormat: tallyThreeValued(live.map((row) => row.isLargeFormat)),
    coverage: coverageRecord(METRIC_KEY, rows.length, excluded.counts, options.asOf.toISOString()),
  }
}
