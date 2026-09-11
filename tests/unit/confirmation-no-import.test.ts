import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { findBridgeViolations } from '../../scripts/research/bridge-isolation.mjs'
import {
  BRIDGE_FIELDS,
  BRIDGE_SLUG,
  emptyDraftForBridge,
  titleCaseSlug,
} from '@/lib/scraper/workflows/bridge-draft'
import { confirmationForBridgeSchema } from '@/lib/supabase/schemas/research-shortlist'

/**
 * THE FIELD-PROVENANCE TEST — Phase 35's load-bearing test.
 *
 * A research row whose every text field is a unique sentinel is put through the bridge's two
 * halves — the projection the bridge may read, and the insert it writes — and no sentinel may
 * survive into any column of the product. The projection is `.strict()`, so widening the select
 * without widening the schema fails here; widening the schema fails the isolation guard's
 * carve-out (`findBridgeViolations`), which is asserted alongside. The database half — the same
 * assertion against a real `products` row and its three join tables — is `tests/unit/rls/
 * phase35.test.ts`.
 */

const SENTINELS = {
  title_normalized: 'SENTINEL-TITLE-7f3a',
  source_url: 'https://sentinel-9c1d.example/p/1',
  summary: 'SENTINEL-SUMMARY-2b8e',
  description: 'SENTINEL-DESCRIPTION-5d0c',
  currency: 'SENTINEL-CURRENCY-4e7f',
  material_tokens: ['SENTINEL-MATERIAL-8a2b'],
  image_urls: ['https://sentinel-1f6e.example/image.jpg'],
  decision_note: 'SENTINEL-NOTE-3c9a',
  reason: 'SENTINEL-REASON-6b4d',
  dimensions_mm: { width_mm: 9_871 },
  price_min_minor: 987_654,
} as const

const everySentinel = JSON.stringify(SENTINELS)

function containsSentinel(value: unknown): boolean {
  const text = JSON.stringify(value) ?? ''
  return Object.values(SENTINELS)
    .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
    .some((sentinel) =>
      typeof sentinel === 'string'
        ? text.includes(sentinel)
        : text.includes(JSON.stringify(sentinel)),
    )
}

describe('the bridge’s projection', () => {
  it('admits id, stage and archived_at and refuses everything else', () => {
    const projected = confirmationForBridgeSchema.parse({
      id: '00000000-0000-4000-8000-000000003501',
      stage: 'CONFIRMED',
      archived_at: null,
    })
    expect(Object.keys(projected).sort()).toEqual(['archived_at', 'id', 'stage'])

    // A wider select — the "convenience" change — fails at the schema before it reaches the insert.
    expect(() =>
      confirmationForBridgeSchema.parse({
        id: '00000000-0000-4000-8000-000000003501',
        stage: 'CONFIRMED',
        archived_at: null,
        ...SENTINELS,
      }),
    ).toThrow()
  })
})

describe('the bridge’s insert', () => {
  it('writes exactly slug, title, category_id, status and price_state', () => {
    const draft = emptyDraftForBridge({
      slug: 'demo-console',
      categoryId: '00000000-0000-4000-8000-0000000000c1',
    })
    expect(Object.keys(draft).sort()).toEqual([...BRIDGE_FIELDS].sort())
    expect(draft).toEqual({
      slug: 'demo-console',
      title: 'Demo Console',
      category_id: '00000000-0000-4000-8000-0000000000c1',
      status: 'DRAFT',
      price_state: 'PRICE_ON_REQUEST',
    })
  })

  it('carries no sentinel from a research row, because none is in scope', () => {
    // The builder does not take a research row. The strongest version of "copies nothing" is
    // that there is nothing to copy from; this asserts it with the sentinels in hand.
    const draft = emptyDraftForBridge({
      slug: 'sentinel-free-slug',
      categoryId: '00000000-0000-4000-8000-0000000000c1',
    })
    expect(containsSentinel(draft)).toBe(false)
    expect(everySentinel).toContain('SENTINEL-TITLE-7f3a')
  })

  it('title-cases the slug and refuses a non-slug', () => {
    expect(titleCaseSlug('demo-console')).toBe('Demo Console')
    expect(titleCaseSlug('a-3-metre-dining-table')).toBe('A 3 Metre Dining Table')
    expect(BRIDGE_SLUG.test('Demo Console')).toBe(false)
    expect(BRIDGE_SLUG.test('demo--console')).toBe(false)
    expect(() =>
      emptyDraftForBridge({ slug: SENTINELS.title_normalized, categoryId: 'x' }),
    ).toThrow()
  })
})

describe('the bridge’s file', () => {
  const source = readFileSync('app/(studio)/studio/(shell)/research/confirmed/actions.ts', 'utf8')

  it('imports from research only the projection reader and the two claim writers', () => {
    const research = [
      ...source.matchAll(
        /import\s+\{([^}]*)\}\s*from\s*'@\/lib\/supabase\/repositories\/research\/([^']+)'/gu,
      ),
    ]
    expect(research).toHaveLength(1)
    const names = (research[0]?.[1] ?? '')
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name !== '')
      .sort()
    expect(names).toEqual(['getConfirmationForBridge', 'markProductStarted', 'releaseProductStart'])
  })

  it('names no competitor field', () => {
    for (const field of [
      'title_normalized',
      'source_url',
      'price_min_minor',
      'dimensions_mm',
      'material_tokens',
      'image_urls',
      'decision_note',
    ]) {
      expect(source, field).not.toContain(field)
    }
  })

  it('is the one carve-out the isolation guard admits', () => {
    expect(findBridgeViolations(process.cwd())).toEqual([])
  })
})
