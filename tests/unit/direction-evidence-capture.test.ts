import { describe, expect, it } from 'vitest'

import {
  CAPTURE_SCHEMAS,
  EVIDENCE_TYPES,
  VOLATILE_EVIDENCE,
  figuresFromSnapshotPayload,
  parseCaptured,
  scoreDrift,
  snapshotDrift,
} from '@/lib/scraper/analytics/direction/capture'
import {
  INTERNAL_DOCUMENT_HEADER,
  OBSERVED_LABEL,
  formatFigure,
  renderBriefMarkdown,
} from '@/lib/scraper/analytics/direction/export'

/**
 * Evidence is captured BY VALUE where it is volatile, and the brief shows drift against the
 * current value. Every captured payload is numbers, ids, names and dates copied from research —
 * never prose, never a Rivya fact — and the export prints every observed figure with its coverage
 * and the observed-in-research label.
 */

const COVERAGE = {
  metricKey: 'price_architecture',
  n: 40,
  denominator: 52,
  coveragePct: 77,
  excludedReasons: { no_price: 12 },
  asOf: '2026-09-10T02:30:00Z',
}

describe('captured payloads', () => {
  it('names seven evidence types, two of them volatile', () => {
    expect([...EVIDENCE_TYPES]).toHaveLength(7)
    expect([...VOLATILE_EVIDENCE]).toEqual(['OPPORTUNITY_SCORE', 'ANALYTICS_SNAPSHOT'])
    for (const type of EVIDENCE_TYPES) expect(CAPTURE_SCHEMAS[type]).toBeDefined()
  })

  it('a score capture holds the score, confidence, state and model version as they stood', () => {
    const captured = parseCaptured('OPPORTUNITY_SCORE', {
      researchProductId: '00000000-0000-4000-8000-000000003402',
      score: 82,
      confidence: 0.85,
      completeness: 1,
      state: 'SCORED',
      modelVersion: 'v1',
      computedAt: '2026-09-10T03:15:00Z',
    })
    expect(captured.score).toBe(82)
    expect(() =>
      parseCaptured('OPPORTUNITY_SCORE', { score: 82, confidence: 0.85, state: 'SCORED' }),
    ).toThrow()
  })

  it('a media capture must be concept, AI-generated imagery — a photograph cannot be captured', () => {
    expect(
      CAPTURE_SCHEMAS.MEDIA_ASSET.safeParse({
        rivyaAssetId: 'MATERIAL-MACRO-001',
        publicId: 'rivya/x',
        isConcept: true,
        isAiGenerated: true,
      }).success,
    ).toBe(true)
    expect(
      CAPTURE_SCHEMAS.MEDIA_ASSET.safeParse({
        rivyaAssetId: null,
        publicId: 'rivya/real-photo',
        isConcept: false,
        isAiGenerated: false,
      }).success,
    ).toBe(false)
  })

  it('no capture schema accepts free prose or a Rivya price, dimension or lead time', () => {
    for (const type of EVIDENCE_TYPES) {
      const shape = CAPTURE_SCHEMAS[type].shape as Record<string, unknown>
      for (const forbidden of [
        'description',
        'body',
        'rivyaPrice',
        'rivyaDimensions',
        'leadTime',
        'material',
      ]) {
        expect(shape).not.toHaveProperty(forbidden)
      }
    }
  })
})

describe('observed figures from a snapshot payload', () => {
  it('reads the price architecture summary, each figure carrying the coverage record', () => {
    const figures = figuresFromSnapshotPayload({
      family: 'PRICE_ARCHITECTURE',
      result: {
        currency: 'INR',
        minMinor: 450000,
        maxMinor: 3200000,
        percentiles: { p10: 500000, p25: 700000, median: 1200000, p75: 1900000, p90: 2800000 },
      },
      coverage: [COVERAGE],
    })
    expect(figures.map((figure) => figure.key)).toEqual(['price_min', 'price_median', 'price_max'])
    expect(figures[1]?.value).toBe(1200000)
    expect(figures[1]?.currency).toBe('INR')
    for (const figure of figures) expect(figure.coverage).toEqual(COVERAGE)
  })

  it('reads the dimension medians and the table-scale count', () => {
    const figures = figuresFromSnapshotPayload({
      family: 'DIMENSIONS',
      result: {
        axes: [
          { axis: 'width', n: 30, insufficientSample: false, p10: 600, p50: 1800, p90: 2400 },
          { axis: 'height', n: 30, insufficientSample: false, p10: 700, p50: 750, p90: 800 },
        ],
        tableScale: { thresholdMm: 1800, count: 14, share: 0.47 },
      },
      coverage: [COVERAGE],
    })
    expect(figures.map((figure) => figure.key)).toEqual([
      'axis_width_p50',
      'axis_height_p50',
      'table_scale_count',
    ])
    expect(figures[0]?.value).toBe(1800)
    expect(figures[2]?.value).toBe(14)
  })

  it('an assortment snapshot yields no figure, and a payload without coverage yields none', () => {
    expect(
      figuresFromSnapshotPayload({ family: 'ASSORTMENT', result: {}, coverage: [COVERAGE] }),
    ).toEqual([])
    expect(
      figuresFromSnapshotPayload({ family: 'PRICE_ARCHITECTURE', result: {}, coverage: [] }),
    ).toEqual([])
  })
})

describe('drift', () => {
  const captured = {
    researchProductId: '00000000-0000-4000-8000-000000003402',
    score: 82,
    confidence: 0.85,
    completeness: 1,
    state: 'SCORED' as const,
    modelVersion: 'v1',
    computedAt: '2026-09-10T03:15:00Z',
  }

  it('a score that moved, changed model or vanished is drift; an identical one is not', () => {
    expect(scoreDrift(captured, { ...captured, computedAt: '2026-09-11T03:15:00Z' }).changed).toBe(
      false,
    )
    expect(scoreDrift(captured, { ...captured, score: 79 }).changed).toBe(true)
    expect(scoreDrift(captured, { ...captured, modelVersion: 'v2' }).changed).toBe(true)
    expect(scoreDrift(captured, null).changed).toBe(true)
  })

  it('a snapshot superseded since attachment is drift', () => {
    const snapshot = {
      metricFamily: 'PRICE_ARCHITECTURE' as const,
      scopeType: 'SET',
      currency: 'INR',
      computedAt: '2026-09-10T02:30:00Z',
      rowCount: 52,
      figures: [],
    }
    expect(snapshotDrift(snapshot, '2026-09-10T02:30:00Z')).toBe(false)
    expect(snapshotDrift(snapshot, '2026-09-11T02:30:00Z')).toBe(true)
    expect(snapshotDrift(snapshot, null)).toBe(true)
  })
})

describe('the Markdown export', () => {
  const markdown = renderBriefMarkdown({
    brief: {
      title: 'A low table in ash',
      slug: 'low-table-in-ash',
      status: 'REVIEW',
      targetCategorySlug: 'furniture',
      approvedAt: null,
      updatedAt: '2026-09-11T05:00:00Z',
      sections: {
        intent: 'The dining-scale gap the comparison set shows.',
        scale_intent: 'Dining-table scale, longest axis around two metres.',
        form_language: null,
        material_direction: null,
        finish_direction: null,
        constraints: null,
        open_questions: null,
        not_doing: 'No resin river top.',
      },
    },
    figures: [
      {
        key: 'price_median',
        label: 'Median observed price',
        value: 1200000,
        unit: 'minor',
        currency: 'INR',
        coverage: COVERAGE,
      },
      {
        key: 'axis_width_p50',
        label: 'Median observed width',
        value: 1800,
        unit: 'mm',
        currency: null,
        coverage: COVERAGE,
      },
    ],
    evidence: [
      {
        type: 'COMPARISON_SET',
        label: 'Dining tables, three sources',
        rationale: 'The set the gap came from.',
        capturedAt: '2026-09-11T04:00:00Z',
        drift: false,
      },
      {
        type: 'OPPORTUNITY_SCORE',
        label: 'Score 82 under v1',
        rationale: 'Highest-ranked dining row.',
        capturedAt: '2026-09-11T04:00:00Z',
        drift: true,
      },
    ],
  })

  it('opens with the internal-document header and prints all eight sections', () => {
    expect(markdown.startsWith(`> ${INTERNAL_DOCUMENT_HEADER}`)).toBe(true)
    for (const title of [
      'Intent — why now',
      'Scale intent',
      'Form language',
      'Material direction',
      'Finish direction',
      'Constraints',
      'Open questions',
      'Not doing',
    ]) {
      expect(markdown).toContain(`### ${title}`)
    }
    expect(markdown).toContain('_(not yet written)_')
  })

  it('prints every observed figure with its coverage and the observed-in-research label', () => {
    expect(markdown).toContain(
      '| Median observed price | INR 12,000 | 40 of 52 (77 %), as of 2026-09-10 — observed in competitor research |',
    )
    expect(markdown).toContain('| Median observed width | 1800 mm |')
    expect(markdown.match(new RegExp(OBSERVED_LABEL, 'gu'))?.length).toBeGreaterThanOrEqual(3)
  })

  it('names drift on the evidence that changed, and never presents a Rivya specification', () => {
    expect(markdown).toContain('changed since attachment')
    expect(markdown).toContain('intended — Rivya prose, not a specification')
    expect(markdown.toLowerCase()).not.toContain('rivya price')
    expect(markdown.toLowerCase()).not.toContain('lead time:')
  })

  it('formats figures by unit', () => {
    expect(
      formatFigure({
        key: 'k',
        label: 'l',
        value: null,
        unit: 'mm',
        currency: null,
        coverage: COVERAGE,
      }),
    ).toBe('—')
    expect(
      formatFigure({
        key: 'k',
        label: 'l',
        value: 14,
        unit: 'count',
        currency: null,
        coverage: COVERAGE,
      }),
    ).toBe('14')
  })
})
