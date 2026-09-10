import { describe, expect, it } from 'vitest'

import type { CategoryMapping } from '@/lib/scraper/core/category-map'
import type { DimensionsMm } from '@/lib/scraper/normalization'
import {
  AUTO_MERGE_CONFIDENCE,
  KEYWORD_CONFIDENCE,
  TRIGRAM_THRESHOLD,
  compareDimensions,
  matchTaxonomy,
  proposeDuplicate,
  trigramSimilarity,
  type CategoryTerm,
  type DuplicateSubject,
} from '@/lib/scraper/workflows/match'

/**
 * Two questions that both produce candidates rather than verdicts.
 *
 * THE ASSERTIONS THAT MATTER ARE THE REFUSALS. Auto-merging two genuinely different products hides
 * one of them from every later comparison, opportunity score and shortlist, and nothing on any
 * screen says why a product is missing — so the tests that earn their keep are the ones proving
 * that a near-miss title, a contradicted measurement and an unmapped category all stop short.
 *
 * `trigramSimilarity` IS ASSERTED AGAINST `pg_trgm`'s OWN DEFINITION rather than against
 * "feels about right". The database has a trigram index on `title_normalized` and Phase 31 will
 * query it; a similarity function here that disagreed with `similarity()` there would give two
 * different answers about the same pair depending on which one asked.
 */

function subject(overrides: Partial<DuplicateSubject> = {}): DuplicateSubject {
  return {
    id: 'a',
    externalId: null,
    titleNormalized: 'Halden Oak Dining Table',
    currency: 'GBP',
    priceMinMinor: 129900,
    dimensionsMm: { length_mm: 1800, width_mm: 900, height_mm: 750 },
    firstSeenAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('trigramSimilarity', () => {
  it('is 1 for an identical string', () => {
    expect(trigramSimilarity('oak table', 'oak table')).toBe(1)
  })

  it('is 0 when nothing is shared', () => {
    expect(trigramSimilarity('oak', 'zzz')).toBe(0)
  })

  it('is 0 for an empty string, rather than dividing by nothing', () => {
    expect(trigramSimilarity('', 'oak')).toBe(0)
    expect(trigramSimilarity('oak', '')).toBe(0)
  })

  it('ignores case and punctuation, as pg_trgm does', () => {
    expect(trigramSimilarity('Oak Table', 'oak — table')).toBe(1)
  })

  it('rates a near-identical title above the threshold and a different one below', () => {
    expect(
      trigramSimilarity('Halden Oak Dining Table', 'Halden Oak Dining Tables'),
    ).toBeGreaterThan(TRIGRAM_THRESHOLD)
    expect(trigramSimilarity('Halden Oak Dining Table', 'Corbel Walnut Console')).toBeLessThan(
      TRIGRAM_THRESHOLD,
    )
  })
})

describe('compareDimensions', () => {
  it('agrees within five per cent', () => {
    expect(compareDimensions({ length_mm: 1800 }, { length_mm: 1850 })).toBe('AGREE')
  })

  it('contradicts beyond it', () => {
    expect(compareDimensions({ length_mm: 1800 }, { length_mm: 2000 })).toBe('CONTRADICT')
  })

  it('IS UNKNOWN RATHER THAN AGREEING when one row has no measurements', () => {
    // Three answers, not two. Collapsing UNKNOWN into agreement merges two different tables;
    // collapsing it into disagreement refuses to merge two identical ones.
    expect(compareDimensions(null, { length_mm: 1800 })).toBe('UNKNOWN')
    expect(compareDimensions({ length_mm: 1800 }, null)).toBe('UNKNOWN')
  })

  it('is UNKNOWN when the two share no axis', () => {
    expect(compareDimensions({ length_mm: 1800 }, { diameter_mm: 900 })).toBe('UNKNOWN')
  })
})

describe('proposeDuplicate', () => {
  it('never proposes a row against itself', () => {
    expect(proposeDuplicate(subject(), subject())).toBeNull()
  })

  it('takes the source’s own identifier as the strongest evidence', () => {
    const proposal = proposeDuplicate(
      subject({ id: 'a', externalId: 'SKU-1' }),
      subject({ id: 'b', externalId: 'SKU-1', titleNormalized: 'Halden Table (2026)' }),
    )
    expect(proposal?.method).toBe('EXTERNAL_ID')
    expect(proposal?.score).toBe(1)
    // A site that renamed a product still means the same SKU. Nothing Rivya infers outranks that.
    expect(proposal?.autoMerge).toBe(true)
  })

  it('REFUSES TO AUTO-MERGE ON AN IDENTIFIER THE MEASUREMENTS CONTRADICT', () => {
    // Same SKU, 1 800 mm and 2 400 mm: the identifier is being reused, which is a thing sites do
    // when a range shares a code. A merchandiser decides.
    const proposal = proposeDuplicate(
      subject({ id: 'a', externalId: 'SKU-1', dimensionsMm: { length_mm: 1800 } }),
      subject({ id: 'b', externalId: 'SKU-1', dimensionsMm: { length_mm: 2400 } }),
    )
    expect(proposal?.method).toBe('EXTERNAL_ID')
    expect(proposal?.autoMerge).toBe(false)
  })

  it('takes an identical title and price as the second tier', () => {
    const proposal = proposeDuplicate(subject({ id: 'a' }), subject({ id: 'b' }))
    expect(proposal?.method).toBe('TITLE_PRICE')
    expect(proposal?.score).toBeGreaterThanOrEqual(AUTO_MERGE_CONFIDENCE)
    expect(proposal?.autoMerge).toBe(true)
  })

  it('does not take an identical title with a DIFFERENT price as that tier', () => {
    const proposal = proposeDuplicate(
      subject({ id: 'a', priceMinMinor: 129900 }),
      subject({ id: 'b', priceMinMinor: 189900 }),
    )
    expect(proposal?.method).toBe('TRIGRAM_DIMENSION')
  })

  it('does not take an identical title in a DIFFERENT currency as that tier', () => {
    const proposal = proposeDuplicate(
      subject({ id: 'a', currency: 'GBP' }),
      subject({ id: 'b', currency: 'EUR' }),
    )
    expect(proposal?.method).toBe('TRIGRAM_DIMENSION')
  })

  it('proposes a fuzzy match above the threshold', () => {
    const proposal = proposeDuplicate(
      subject({ id: 'a', priceMinMinor: 129900 }),
      subject({ id: 'b', titleNormalized: 'Halden Oak Dining Tables', priceMinMinor: 139900 }),
    )
    expect(proposal?.method).toBe('TRIGRAM_DIMENSION')
    expect(proposal?.score).toBeGreaterThan(TRIGRAM_THRESHOLD)
  })

  it('proposes nothing below the threshold', () => {
    expect(
      proposeDuplicate(
        subject({ id: 'a' }),
        subject({ id: 'b', titleNormalized: 'Corbel Walnut Console', priceMinMinor: 89900 }),
      ),
    ).toBeNull()
  })

  it('AUTO-MERGES A FUZZY MATCH ONLY WITH POSITIVE DIMENSION AGREEMENT', () => {
    /*
     * THE STRICTEST OF THE THREE, AND THE ONLY HEURISTIC. `UNKNOWN` measurements are not enough
     * here, because a title alone is how "Halden Dining Table 180" gets merged into "Halden Dining
     * Table 200" — two products, one of which then disappears.
     */
    const unknownDimensions = proposeDuplicate(
      subject({ id: 'a', priceMinMinor: 129900, dimensionsMm: null }),
      subject({
        id: 'b',
        titleNormalized: 'Halden Oak Dining Table.',
        priceMinMinor: 139900,
        dimensionsMm: null,
      }),
    )
    expect(unknownDimensions?.method).toBe('TRIGRAM_DIMENSION')
    expect(unknownDimensions?.dimensions).toBe('UNKNOWN')
    expect(unknownDimensions?.autoMerge).toBe(false)

    const agreeing = proposeDuplicate(
      subject({ id: 'a', priceMinMinor: 129900, dimensionsMm: { length_mm: 1800 } }),
      subject({
        id: 'b',
        titleNormalized: 'Halden Oak Dining Table.',
        priceMinMinor: 139900,
        dimensionsMm: { length_mm: 1820 },
      }),
    )
    expect(agreeing?.autoMerge).toBe(true)
  })

  it('proposes nothing when either title is missing', () => {
    expect(proposeDuplicate(subject({ titleNormalized: null }), subject({ id: 'b' }))).toBeNull()
    expect(
      proposeDuplicate(subject({ id: 'a' }), subject({ id: 'b', titleNormalized: null })),
    ).toBeNull()
  })
})

describe('matchTaxonomy', () => {
  const CATEGORIES: readonly CategoryTerm[] = [
    { id: 'cat-dining', name: 'Dining Tables', slug: 'dining-tables' },
    { id: 'cat-seating', name: 'Seating', slug: 'seating' },
  ]

  const mapping = (overrides: Partial<CategoryMapping>): CategoryMapping => ({
    id: 'm1',
    sourceLabel: 'Long Tables',
    sourcePath: null,
    categoryId: 'cat-dining',
    isIgnored: false,
    ...overrides,
  })

  it('takes a human-authored mapping at full confidence', () => {
    const match = matchTaxonomy(['Long Tables'], [mapping({})], CATEGORIES)
    expect(match).toEqual({
      categoryId: 'cat-dining',
      confidence: 1,
      method: 'MAP',
      ignored: false,
    })
  })

  it('A HUMAN’S DISMISSAL IS FINAL and no keyword rule overrules it', () => {
    // Somebody looked at this label and decided it maps to nothing Rivya makes. A keyword rule that
    // then matched it would overrule a decision already taken, invisibly.
    const match = matchTaxonomy(
      ['Seating'],
      [mapping({ sourceLabel: 'Seating', categoryId: null, isIgnored: true })],
      CATEGORIES,
    )
    expect(match.ignored).toBe(true)
    expect(match.categoryId).toBeNull()
  })

  it('falls back to an exact keyword match, at a lower confidence that says so', () => {
    const match = matchTaxonomy(['Dining Tables'], [], CATEGORIES)
    expect(match).toEqual({
      categoryId: 'cat-dining',
      confidence: KEYWORD_CONFIDENCE,
      method: 'KEYWORD',
      ignored: false,
    })
  })

  it('matches a slug spelling as well as a name', () => {
    expect(matchTaxonomy(['dining tables'], [], CATEGORIES).categoryId).toBe('cat-dining')
  })

  it('DOES NOT MATCH A PARTIAL, because that is a taxonomy judgement', () => {
    // "Console Tables" matching a *Tables* category is somebody deciding what a console table is.
    expect(matchTaxonomy(['Console Tables'], [], CATEGORIES).categoryId).toBeNull()
  })

  it('NEVER DEFAULTS TO A CATEGORY when nothing matches', () => {
    const match = matchTaxonomy(['Parasols'], [], CATEGORIES)
    expect(match.categoryId).toBeNull()
    expect(match.method).toBeNull()
    expect(match.ignored).toBe(false)
  })

  it('has nothing to say about a row with no labels at all', () => {
    expect(matchTaxonomy([], [], CATEGORIES).categoryId).toBeNull()
  })
})

describe('the thresholds are the phase document’s own', () => {
  it('auto-merge at 0.95, trigram at 0.85', () => {
    expect(AUTO_MERGE_CONFIDENCE).toBe(0.95)
    expect(TRIGRAM_THRESHOLD).toBe(0.85)
  })

  it('a dimension tolerance of five per cent', () => {
    const within: DimensionsMm = { length_mm: 1000 }
    expect(compareDimensions(within, { length_mm: 1050 })).toBe('AGREE')
    expect(compareDimensions(within, { length_mm: 1060 })).toBe('CONTRADICT')
  })
})
