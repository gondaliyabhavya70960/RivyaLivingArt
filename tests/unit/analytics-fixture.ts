import type { AnalyticsRow } from '@/lib/scraper/analytics/rows'

/**
 * A row builder for the analytics suites. Every default is the "measured, priced, mapped, fresh"
 * case, so a test names only the field it is about.
 */
export const AS_OF = new Date('2026-09-11T12:00:00.000Z')
export const AS_OF_ISO = AS_OF.toISOString()

export const SOURCE_A = '00000000-0000-4000-8000-00000000a001'
export const SOURCE_B = '00000000-0000-4000-8000-00000000a002'
export const SOURCE_C = '00000000-0000-4000-8000-00000000a003'
export const CAT_FURNITURE = '00000000-0000-4000-8000-00000000c001'
export const CAT_DECOR = '00000000-0000-4000-8000-00000000c002'

export const CATEGORIES = [
  { id: CAT_FURNITURE, slug: 'furniture' },
  { id: CAT_DECOR, slug: 'decor' },
]

let counter = 0

export function row(overrides: Partial<AnalyticsRow> = {}): AnalyticsRow {
  counter += 1
  return {
    id: `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    sourceId: SOURCE_A,
    matchedCategoryId: CAT_FURNITURE,
    categorySlug: 'furniture',
    isLargeFormat: true,
    currency: 'INR',
    priceState: 'FIXED',
    priceMinMinor: 100_000,
    priceMaxMinor: null,
    dimensionsMm: { width_mm: 2000, depth_mm: 900, height_mm: 750 },
    dimensionParseState: 'PARSED',
    longestAxisMm: 2000,
    firstSeenAt: '2026-08-01T00:00:00.000Z',
    lastSeenAt: '2026-09-10T00:00:00.000Z',
    ...overrides,
  }
}
