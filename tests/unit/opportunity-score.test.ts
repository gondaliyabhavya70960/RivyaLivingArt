import { describe, expect, it } from 'vitest'

import { completeness, REQUIRED_FIELDS } from '@/lib/scraper/analytics/opportunity/completeness'
import { rankMovement } from '@/lib/scraper/analytics/opportunity/rank'
import { scoreRow, totalFromComponents } from '@/lib/scraper/analytics/opportunity/score'

import { fullContext, scoringRow, SOURCE_A, V1 } from './opportunity-fixture'

/**
 * THE WORKED EXAMPLE, BY HAND. Under `fullContext()` and the fixture row the seven signals give:
 *
 *   category_gap        20 ×  75  (3 published of 12)
 *   large_format_fit    20 × 100  (furniture, large)
 *   price_band_gap      15 ×  50  (100 000 → band 2, adjacent to occupied 3)
 *   assortment_density  15 × 100  (three sources in furniture band 2)
 *   change_velocity     10 ×  40  (4 material changes / 90 d)
 *   customisation       10 × 100
 *   material_adjacency  10 × 100  (oak, resin both in vocabulary)
 *
 *   Σ w×n = 1500 + 2000 + 750 + 1500 + 400 + 1000 + 1000 = 8150 ; Σ w = 100 → raw 81.5
 *   completeness 6/6 = 1 → score = round(81.5 × 1.0) = 82 ; confidence 1 → SCORED
 */

describe('scoreRow — the worked example', () => {
  it('reproduces the hand-computed raw, confidence, completeness and score', () => {
    const result = scoreRow(scoringRow(), fullContext(), V1)
    expect(result.raw).toBe(81.5)
    expect(result.confidence).toBe(1)
    expect(result.completeness).toBe(1)
    expect(result.score).toBe(82)
    expect(result.state).toBe('SCORED')
    expect(result.components.map((component) => component.contribution)).toEqual([
      15, 20, 7.5, 15, 4, 10, 10,
    ])
  })

  it('lowers confidence — never contributes zero — when a signal is excluded', () => {
    // Break price_band_gap (15) and change_velocity (10): confidence 0.75, raw over 75 weight.
    // With no band edges the row has no band, so assortment_density finds no sources in
    // (furniture, none) and is INCLUDED at 0 — a real answer, unlike the two exclusions.
    const context = fullContext({
      runHistoryDaysBySource: new Map([[SOURCE_A, 3]]),
      occupiedBandsByCurrency: new Map(),
    })
    const result = scoreRow(scoringRow(), context, V1)
    expect(result.confidence).toBe(0.75)
    // Σ w×n over included = 1500 + 2000 + 0 + 1000 + 1000 = 5500 ; Σ w = 75 → 73.33
    expect(result.raw).toBe(73.33)
    expect(result.score).toBe(73)
    const excluded = result.components.filter((component) => !component.included)
    expect(excluded.map((component) => component.signalKey)).toEqual([
      'price_band_gap',
      'change_velocity',
    ])
    expect(
      excluded.every(
        (component) => component.normalised === null && component.exclusionReason !== null,
      ),
    ).toBe(true)
  })

  it('returns INSUFFICIENT_DATA below the confidence floor and still stores the number', () => {
    // Keep only category_gap (20) and material_adjacency (10): confidence 0.30.
    const context = fullContext({
      enabledSourceCount: 1,
      runHistoryDaysBySource: new Map(),
      occupiedBandsByCurrency: new Map(),
      attributeKeysBySource: new Map(),
    })
    const result = scoreRow(scoringRow({ isLargeFormat: null }), context, V1)
    expect(result.confidence).toBe(0.3)
    expect(result.state).toBe('INSUFFICIENT_DATA')
    expect(result.score).not.toBeNull()
  })

  it('applies the completeness multiplier: a sparse row is capped at 60 % of raw', () => {
    const sparse = scoringRow({
      titleNormalized: null,
      currency: null,
      priceState: 'UNKNOWN',
      priceMinMinor: null,
      dimensionParseState: 'ABSENT',
      dimensionsMm: null,
      materialTokens: [],
    })
    expect(completeness(sparse)).toBe(0.167)
    expect(REQUIRED_FIELDS).toHaveLength(6)
    const result = scoreRow(sparse, fullContext(), V1)
    // Included: category_gap 75 (20), large_format_fit 100 (20), assortment_density (15) — unpriced → band none.
    expect(result.score).toBe(Math.round((result.raw ?? 0) * (0.6 + 0.4 * 0.167)))
  })

  it('reproduces the stored total from the components alone', () => {
    const result = scoreRow(scoringRow(), fullContext(), V1)
    expect(totalFromComponents(result.components, result.completeness)).toBe(result.score)
  })
})

describe('rankMovement', () => {
  it('counts rows that move by more than the threshold when weights change', () => {
    const rows = Array.from({ length: 30 }, (_, index) => ({
      productId: `p${String(index).padStart(2, '0')}`,
      completeness: 1,
      components: [
        { signalKey: 'category_gap' as const, normalised: index * 3 },
        { signalKey: 'material_adjacency' as const, normalised: 100 - index * 3 },
      ],
    }))
    const from = {
      signals: [
        { ...V1.signals[0]!, weight: 90 },
        { ...V1.signals[6]!, weight: 10 },
      ],
      minConfidence: 0,
    }
    const to = {
      signals: [
        { ...V1.signals[0]!, weight: 10 },
        { ...V1.signals[6]!, weight: 90 },
      ],
      minConfidence: 0,
    }
    const movement = rankMovement(rows, from, to)
    expect(movement.ranked).toBe(30)
    expect(movement.movedMoreThan).toBeGreaterThan(0)
    expect(movement.weights.find((weight) => weight.key === 'category_gap')).toEqual({
      key: 'category_gap',
      from: 90,
      to: 10,
    })
  })
  it('reports zero movement for identical weights', () => {
    const rows = [
      {
        productId: 'a',
        completeness: 1,
        components: [{ signalKey: 'category_gap' as const, normalised: 50 }],
      },
    ]
    expect(rankMovement(rows, V1, V1).movedMoreThan).toBe(0)
  })
})
