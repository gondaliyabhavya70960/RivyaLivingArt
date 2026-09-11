import { describe, expect, it } from 'vitest'

import { diffVersions, type VersionSide } from '@/lib/scraper/analytics/diff'
import type { ChangeRule } from '@/lib/scraper/analytics/materiality'
import type { RawProductDraft } from '@/lib/scraper/adapters/draft-schema'
import type { NormalizedProduct } from '@/lib/scraper/normalization/schema'

/**
 * Two versions in, a list of movements out.
 *
 * THE FIXTURES ARE WHOLE VERSIONS RATHER THAN FIELD PAIRS, and the difference matters. A test that
 * called each rule directly would pass while the DIFFER read the wrong column — which is the defect
 * that produces a queue reporting nothing at all, and the one nobody notices because an empty queue
 * looks like a quiet week.
 *
 * NO DATABASE. `diffVersions` takes two payloads and a rule list, which is what makes a detection
 * pass reproducible years later from stored evidence.
 */

const SOURCE = 'source-a'

const RULES: readonly ChangeRule[] = [
  {
    sourceId: null,
    field: 'price',
    materialThreshold: 0.05,
    minorThreshold: null,
    isEnabled: true,
  },
  { sourceId: null, field: 'title', materialThreshold: 0.9, minorThreshold: 0.99, isEnabled: true },
  {
    sourceId: null,
    field: 'dimensions_mm',
    materialThreshold: 0.02,
    minorThreshold: null,
    isEnabled: true,
  },
]

function raw(overrides: Partial<RawProductDraft> = {}): RawProductDraft {
  return {
    title: 'Oak dining table',
    priceText: '£1,200',
    currencyText: null,
    skuText: 'OAK-1200',
    availabilityText: 'In stock',
    leadTimeText: null,
    descriptionHtml: '<p>A solid oak table.</p>',
    dimensionTexts: [],
    materialTexts: [],
    variantTexts: [],
    customizationTexts: [],
    imageUrls: [],
    categoryLabels: [],
    externalId: null,
    canonicalUrl: 'https://example.com/oak-table',
    provenance: {},
    ...overrides,
  } as unknown as RawProductDraft
}

function normalized(overrides: Partial<NormalizedProduct> = {}): NormalizedProduct {
  return {
    titleNormalized: 'Oak dining table',
    brandText: null,
    currency: 'GBP',
    priceState: 'FIXED',
    priceMinMinor: 120_000,
    priceMaxMinor: null,
    dimensionsMm: { length_mm: 1_200, width_mm: 900 },
    dimensionParseState: 'PARSED',
    materialTokens: ['oak'],
    availability: 'IN_STOCK',
    leadTimeDaysMin: null,
    leadTimeDaysMax: null,
    variantCount: 2,
    imageUrls: ['https://example.com/a.jpg'],
    categoryLabels: [],
    sourceTexts: {
      price: '£1,200',
      dimensions: [],
      materials: [],
      availability: 'In stock',
      leadTime: null,
    },
    parseStates: {},
    normalizerVersion: '1.0.0',
    ...overrides,
  } as unknown as NormalizedProduct
}

function side(
  versionId: string,
  overrides: { raw?: Partial<RawProductDraft>; normalized?: Partial<NormalizedProduct> } = {},
): VersionSide {
  return {
    versionId,
    raw: raw(overrides.raw),
    normalized: normalized(overrides.normalized),
    storageKey: `snapshots/${versionId}.gz`,
  }
}

describe('diffVersions', () => {
  it('reports nothing when the two versions agree', () => {
    expect(diffVersions(side('v1'), side('v2'), RULES, SOURCE)).toEqual([])
  })

  it('reports one row per field that moved, and only those', () => {
    const changes = diffVersions(
      side('v1'),
      side('v2', { normalized: { priceMinMinor: 132_000 } }),
      RULES,
      SOURCE,
    )
    expect(changes).toHaveLength(1)
    expect(changes[0]?.field).toBe('price')
    expect(changes[0]?.changeKind).toBe('MODIFIED')
    expect(changes[0]?.materiality).toBe('MATERIAL')
  })

  it('carries both sides as the compared values, not as rendered strings', () => {
    // THE DRAWER ASKS "WHICH AXIS MOVED" AND THE STORED VALUE HAS TO BE ABLE TO ANSWER. A formatted
    // string would freeze a presentation decision into evidence.
    const changes = diffVersions(
      side('v1'),
      side('v2', { normalized: { dimensionsMm: { length_mm: 1_400, width_mm: 900 } } }),
      RULES,
      SOURCE,
    )
    expect(changes[0]?.before).toEqual({ length_mm: 1_200, width_mm: 900 })
    expect(changes[0]?.after).toEqual({ length_mm: 1_400, width_mm: 900 })
  })

  it('records ADDED when a field appears and REMOVED when it goes', () => {
    const added = diffVersions(
      side('v1', { normalized: { leadTimeDaysMin: null, leadTimeDaysMax: null } }),
      side('v2', { normalized: { leadTimeDaysMin: 28, leadTimeDaysMax: 42 } }),
      RULES,
      SOURCE,
    )
    expect(added.map((change) => change.changeKind)).toEqual(['ADDED'])
    expect(added[0]?.before).toBeNull()

    const removed = diffVersions(
      side('v1', { raw: { skuText: 'OAK-1200' } }),
      side('v2', { raw: { skuText: null } }),
      RULES,
      SOURCE,
    )
    expect(removed.map((change) => change.field)).toEqual(['sku'])
    expect(removed[0]?.changeKind).toBe('REMOVED')
    expect(removed[0]?.after).toBeNull()
  })

  it('produces no row when a field is absent on both sides', () => {
    // Otherwise every new row from a source that never publishes lead times reports a change.
    const changes = diffVersions(
      side('v1', { normalized: { leadTimeDaysMin: null, leadTimeDaysMax: null } }),
      side('v2', { normalized: { leadTimeDaysMin: null, leadTimeDaysMax: null } }),
      RULES,
      SOURCE,
    )
    expect(changes.some((change) => change.field === 'lead_time_days')).toBe(false)
  })

  it('classifies a whitespace-only title change as noise, and still records it', () => {
    const changes = diffVersions(
      side('v1'),
      side('v2', { normalized: { titleNormalized: '  Oak   Dining Table  ' } }),
      RULES,
      SOURCE,
    )
    const title = changes.find((change) => change.field === 'title')
    expect(title?.materiality).toBe('NOISE')
  })

  it('reads description, customization and sku from raw rather than normalized', () => {
    // The three fields the normalizer has no opinion about. A differ reading them from `normalized`
    // would find them absent on both sides forever and report nothing.
    const changes = diffVersions(
      side('v1'),
      side('v2', {
        raw: {
          descriptionHtml: '<p>A solid walnut sideboard with brass handles and three drawers.</p>',
          customizationTexts: ['brass handles'],
        },
      }),
      RULES,
      SOURCE,
    )
    const fields = changes.map((change) => change.field).sort()
    expect(fields).toContain('description')
    expect(fields).toContain('customization')
  })

  it('records a disabled rule as noise rather than dropping the change', () => {
    // Turning a field off is "stop showing me this", not "stop looking". The evidence stays, so
    // turning it back on re-classifies rows already detected.
    const muted: readonly ChangeRule[] = [
      {
        sourceId: SOURCE,
        field: 'price',
        materialThreshold: 0.05,
        minorThreshold: null,
        isEnabled: false,
      },
    ]
    const changes = diffVersions(
      side('v1'),
      side('v2', { normalized: { priceMinMinor: 240_000 } }),
      muted,
      SOURCE,
    )
    expect(changes).toHaveLength(1)
    expect(changes[0]?.materiality).toBe('NOISE')
    expect(changes[0]?.reason).toContain('rule_disabled')
  })

  it('handles a version that has not been normalised', () => {
    const changes = diffVersions({ ...side('v1'), normalized: null }, side('v2'), RULES, SOURCE)
    // Eight of the eleven fields read from `normalized`; a null side means they were absent, so
    // they appear as ADDED rather than crashing the pass.
    expect(changes.every((change) => change.changeKind === 'ADDED')).toBe(true)
  })
})
