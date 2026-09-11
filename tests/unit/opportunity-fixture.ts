import type { ScoringContext, ScoringRow } from '@/lib/scraper/analytics/opportunity/context'
import { MODEL_V1, type ScoringModel } from '@/lib/scraper/analytics/opportunity/model'

import {
  AS_OF,
  CAT_FURNITURE,
  CATEGORIES,
  row as analyticsRow,
  SOURCE_A,
} from './analytics-fixture'

export { AS_OF, CAT_FURNITURE, CATEGORIES, SOURCE_A }

export function scoringRow(overrides: Partial<ScoringRow> = {}): ScoringRow {
  return {
    ...analyticsRow(),
    materialTokens: ['oak', 'resin'],
    normalized: { customization: true },
    titleNormalized: 'A river table',
    availability: 'MADE_TO_ORDER',
    ...overrides,
  }
}

/** A context in which every signal's coverage is met, so a test names only what it breaks. */
export function fullContext(overrides: Partial<ScoringContext> = {}): ScoringContext {
  return {
    asOf: AS_OF,
    categories: CATEGORIES,
    publishedCountByCategory: new Map([[CAT_FURNITURE, 3]]),
    occupiedBandsByCurrency: new Map([
      [
        'INR',
        {
          edges: [50_000, 100_000, 200_000],
          occupied: new Set([0, 3]),
          pricedProducts: 6,
          snapshotId: null,
        },
      ],
    ]),
    enabledSourceCount: 3,
    runHistoryDaysBySource: new Map([[SOURCE_A, 45]]),
    materialChanges90dByCategory: new Map([[CAT_FURNITURE, 4]]),
    sourcesByCategoryBand: new Map([[`${CAT_FURNITURE}:2`, new Set([SOURCE_A, 'b', 'c'])]]),
    attributeKeysBySource: new Map([[SOURCE_A, new Set(['customization', 'materials'])]]),
    materialVocabulary: new Set(['oak', 'walnut', 'resin', 'epoxy']),
    ...overrides,
  }
}

export const V1: ScoringModel = {
  id: '00000000-0000-4000-8000-000000003201',
  version: 'v1',
  name: 'Seven declared signals',
  lifecycle: 'ACTIVE',
  minConfidence: 0.5,
  signals: MODEL_V1,
}
