import { render } from '@testing-library/react'
import * as React from 'react'
import { describe, expect, it } from 'vitest'

import { EditorialFallback } from '@/components/patterns/EditorialFallback'
import { JournalStripSection } from '@/components/sections/JournalStripSection'
import { SelectedWorksSection } from '@/components/sections/SelectedWorksSection'
import { tileFromSection } from '@/lib/cms/editorial-tile'
import { resolveSlot } from '@/lib/cms/merchandising'
import type { SelectorClient } from '@/lib/cms/selectors'
import { siteStrings } from '@/lib/cms/strings'
import type { GlobalContent, MediaAsset, PageSection } from '@/lib/supabase/schemas'

/**
 * The resolution ladder, step by step, against a client that answers from memory.
 *
 * WHY A FAKE CLIENT AND NOT THE DATABASE. What is under test is the ORDER of the five steps and
 * what each returns — provenance, rule, fallback — which is pure logic over rows. The RLS suite
 * (`tests/unit/rls/phase22.test.ts`) proves what a visitor may read; this proves what the
 * resolver does with what it read. The two together are the ladder.
 *
 * THE RISK TABLE'S FIRST ROW IS THE LAST TEST HERE: the fallback output contains no product route
 * and no price label. It is asserted on rendered HTML, because that is where a fabricated card
 * would appear.
 */

type Row = Record<string, unknown>

const SLOT_ID = '00000000-0000-4000-8000-00000000c001'
const P1 = '00000000-0000-4000-8000-00000000d001'
const P2 = '00000000-0000-4000-8000-00000000d002'
const P3 = '00000000-0000-4000-8000-00000000d003'
const P4 = '00000000-0000-4000-8000-00000000d004'

const NOW = new Date('2026-09-10T12:00:00Z')

function slotRow(over: Row = {}): Row {
  return {
    id: SLOT_ID,
    key: 'HOMEPAGE_SELECTED_WORKS',
    name: 'Homepage — Selected Works',
    description: null,
    surface: '/',
    owning_studio_route: '/studio/merchandising/homepage',
    allowed_entity_types: ['PRODUCT'],
    min_items: 3,
    max_items: 12,
    auto_fill: false,
    auto_fill_rule: null,
    fallback_mode: 'EDITORIAL_BLOCK',
    fallback_section_id: null,
    status: 'PUBLISHED',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    updated_by: null,
    ...over,
  }
}

function entryRow(id: string, entityId: string, position: number, over: Row = {}): Row {
  return {
    id,
    slot_id: SLOT_ID,
    entity_type: 'PRODUCT',
    entity_id: entityId,
    position,
    is_pinned: false,
    publish_at: null,
    unpublish_at: null,
    window_state: 'PENDING',
    status: 'PUBLISHED',
    note: null,
    published_at: '2026-09-01T00:00:00Z',
    published_by: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    updated_by: null,
    ...over,
  }
}

function productRow(
  id: string,
  slug: string,
  status = 'PUBLISHED',
  publishedAt = '2026-08-01T00:00:00Z',
): Row {
  return {
    id,
    slug,
    title: `Piece ${slug}`,
    summary: null,
    hero_media_id: null,
    published_at: publishedAt,
    status,
  }
}

/**
 * A client answering three tables from memory. It honours the filters the repository actually
 * applies — `eq`, `in`, `order`, `limit` — so a test that expects an unpublished target dropped is
 * exercising the repository's `status = 'PUBLISHED'` clause and not a coincidence of the fixture.
 */
function fakeClient(tables: { slots: Row[]; entries: Row[]; products: Row[] }): SelectorClient {
  function query(rows: Row[]) {
    let working = [...rows]
    let single = false
    const orderBy: { column: string; ascending: boolean }[] = []
    let cap: number | null = null
    const compare = (a: Row, b: Row): number => {
      for (const { column, ascending } of orderBy) {
        const av = a[column] as string | number | boolean | null
        const bv = b[column] as string | number | boolean | null
        if (av === bv) continue
        if (av === null) return 1
        if (bv === null) return -1
        const sign = av < bv ? -1 : 1
        return ascending ? sign : -sign
      }
      return 0
    }
    const chain = {
      select: () => chain,
      eq: (column: string, value: unknown) => {
        working = working.filter((row) => row[column] === value)
        return chain
      },
      in: (column: string, values: readonly unknown[]) => {
        working = working.filter((row) => values.includes(row[column]))
        return chain
      },
      // PostgREST applies every `order` together, as one multi-key sort; so does this.
      order: (column: string, options: { ascending: boolean }) => {
        orderBy.push({ column, ascending: options.ascending })
        return chain
      },
      limit: (n: number) => {
        cap = n
        return chain
      },
      maybeSingle: () => {
        single = true
        return chain
      },
      then: (resolve: (value: { data: unknown; error: null }) => void) => {
        const sorted = [...working].sort(compare)
        const limited = cap === null ? sorted : sorted.slice(0, cap)
        resolve({ data: single ? (limited[0] ?? null) : limited, error: null })
      },
    }
    return chain
  }
  return {
    from: (table: string) => {
      if (table === 'merchandising_slots') return query(tables.slots)
      if (table === 'merchandising_entries') return query(tables.entries)
      if (table === 'products') return query(tables.products)
      throw new Error(`unexpected table ${table}`)
    },
  } as unknown as SelectorClient
}

describe('the resolution ladder', () => {
  it('reports UNKNOWN_SLOT with the register fallback when no row carries the key', async () => {
    const resolved = await resolveSlot(
      fakeClient({ slots: [], entries: [], products: [] }),
      'HOMEPAGE_SELECTED_WORKS',
      { now: NOW },
    )
    expect(resolved.reason).toBe('UNKNOWN_SLOT')
    expect(resolved.provenance).toBe('FALLBACK')
    expect(resolved.fallback?.mode).toBe('EDITORIAL_BLOCK')
    expect(resolved.cards).toEqual([])
  })

  it('step 3: returns the curated list in position order when it reaches min_items', async () => {
    const client = fakeClient({
      slots: [slotRow()],
      entries: [
        entryRow('00000000-0000-4000-8000-00000000e001', P2, 1),
        entryRow('00000000-0000-4000-8000-00000000e002', P1, 0),
        entryRow('00000000-0000-4000-8000-00000000e003', P3, 2),
      ],
      products: [productRow(P1, 'one'), productRow(P2, 'two'), productRow(P3, 'three')],
    })
    const resolved = await resolveSlot(client, 'HOMEPAGE_SELECTED_WORKS', { now: NOW })
    expect(resolved.provenance).toBe('CURATED')
    expect(resolved.cards.map((card) => card.key)).toEqual(['one', 'two', 'three'])
    expect(resolved.cards.map((card) => card.href)).toEqual([
      '/product/one',
      '/product/two',
      '/product/three',
    ])
    expect(resolved.fallback).toBeNull()
  })

  it('step 2: drops an entry whose target is not PUBLISHED, and falls back below the minimum', async () => {
    const client = fakeClient({
      slots: [slotRow()],
      entries: [
        entryRow('00000000-0000-4000-8000-00000000e001', P1, 0),
        entryRow('00000000-0000-4000-8000-00000000e002', P2, 1),
        entryRow('00000000-0000-4000-8000-00000000e003', P3, 2),
      ],
      products: [productRow(P1, 'one'), productRow(P2, 'two', 'DRAFT'), productRow(P3, 'three')],
    })
    const resolved = await resolveSlot(client, 'HOMEPAGE_SELECTED_WORKS', { now: NOW })
    expect(resolved.provenance).toBe('FALLBACK')
    expect(resolved.reason).toBe('EMPTY')
    expect(resolved.cards).toEqual([])
    expect(resolved.fallback).toEqual({ mode: 'EDITORIAL_BLOCK', sectionId: null })
  })

  it('step 1: drops an entry outside its window, and one that is not itself PUBLISHED', async () => {
    const client = fakeClient({
      slots: [slotRow({ min_items: 1 })],
      entries: [
        entryRow('00000000-0000-4000-8000-00000000e001', P1, 0, {
          publish_at: '2026-09-11T00:00:00Z',
        }),
        entryRow('00000000-0000-4000-8000-00000000e002', P2, 1, {
          unpublish_at: '2026-09-10T12:00:00Z',
        }),
        entryRow('00000000-0000-4000-8000-00000000e003', P3, 2, { status: 'DRAFT' }),
        entryRow('00000000-0000-4000-8000-00000000e004', P4, 3, {
          publish_at: '2026-09-10T00:00:00Z',
          unpublish_at: '2026-09-11T00:00:00Z',
        }),
      ],
      products: [
        productRow(P1, 'one'),
        productRow(P2, 'two'),
        productRow(P3, 'three'),
        productRow(P4, 'four'),
      ],
    })
    const resolved = await resolveSlot(client, 'HOMEPAGE_SELECTED_WORKS', { now: NOW })
    expect(resolved.cards.map((card) => card.key)).toEqual(['four'])
    expect(resolved.provenance).toBe('CURATED')
  })

  it('step 4: tops up by recency with the rule named, and never below the minimum', async () => {
    const client = fakeClient({
      slots: [slotRow({ auto_fill: true, auto_fill_rule: 'Most recently published first' })],
      entries: [entryRow('00000000-0000-4000-8000-00000000e001', P1, 0)],
      products: [
        productRow(P1, 'one'),
        productRow(P2, 'two', 'PUBLISHED', '2026-08-20T00:00:00Z'),
        productRow(P3, 'three', 'PUBLISHED', '2026-08-25T00:00:00Z'),
        productRow(P4, 'four', 'DRAFT', '2026-08-30T00:00:00Z'),
      ],
    })
    const resolved = await resolveSlot(client, 'HOMEPAGE_SELECTED_WORKS', { now: NOW })
    expect(resolved.provenance).toBe('RULE_FILLED')
    expect(resolved.rule).toBe('Most recently published first')
    // The curated one first, then the two published by recency; the draft never.
    expect(resolved.cards.map((card) => card.key)).toEqual(['one', 'three', 'two'])
  })

  it('step 4 → 5: a top-up that still misses the minimum falls back', async () => {
    const client = fakeClient({
      slots: [
        slotRow({
          auto_fill: true,
          auto_fill_rule: 'Most recently published first',
          fallback_mode: 'HIDE_SECTION',
        }),
      ],
      entries: [],
      products: [productRow(P1, 'one')],
    })
    const resolved = await resolveSlot(client, 'HOMEPAGE_SELECTED_WORKS', { now: NOW })
    expect(resolved.provenance).toBe('FALLBACK')
    expect(resolved.fallback?.mode).toBe('HIDE_SECTION')
  })

  it('step 3: caps the curated list at max_items and at the block limit', async () => {
    const client = fakeClient({
      slots: [slotRow({ min_items: 1, max_items: 3 })],
      entries: [
        entryRow('00000000-0000-4000-8000-00000000e001', P1, 0),
        entryRow('00000000-0000-4000-8000-00000000e002', P2, 1),
        entryRow('00000000-0000-4000-8000-00000000e003', P3, 2),
        entryRow('00000000-0000-4000-8000-00000000e004', P4, 3),
      ],
      products: [
        productRow(P1, 'one'),
        productRow(P2, 'two'),
        productRow(P3, 'three'),
        productRow(P4, 'four'),
      ],
    })
    const capped = await resolveSlot(client, 'HOMEPAGE_SELECTED_WORKS', { now: NOW })
    expect(capped.cards).toHaveLength(3)
    const limited = await resolveSlot(client, 'HOMEPAGE_SELECTED_WORKS', { now: NOW, limit: 2 })
    expect(limited.cards).toHaveLength(2)
  })

  it('a slot that is not itself PUBLISHED resolves to its fallback whatever its entries say', async () => {
    const client = fakeClient({
      slots: [slotRow({ status: 'DRAFT', min_items: 1 })],
      entries: [entryRow('00000000-0000-4000-8000-00000000e001', P1, 0)],
      products: [productRow(P1, 'one')],
    })
    const resolved = await resolveSlot(client, 'HOMEPAGE_SELECTED_WORKS', { now: NOW })
    expect(resolved.provenance).toBe('FALLBACK')
  })
})

// --- What the fallback looks like, on the page -------------------------------------------------------

const CLOUD = 'rivya-test'

function content(dotted: string, value: string): GlobalContent {
  const [group, ...rest] = dotted.split('.')
  const key = rest.join('.')
  return {
    id: `id-${dotted}`,
    group_key: group ?? '',
    key,
    label: key,
    value,
    description: null,
    is_enabled: true,
  } as unknown as GlobalContent
}

function section(over: Partial<PageSection> = {}): PageSection {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    page_id: '00000000-0000-4000-8000-0000000000ff',
    block_type: 'selected-works',
    position: 4,
    is_visible: true,
    theme: null,
    layout_variant: null,
    eyebrow: 'SELECTED WORKS',
    heading: 'Objects with presence.',
    heading_highlight: null,
    body: null,
    supporting: null,
    cta_label: null,
    cta_url: null,
    cta_secondary_label: null,
    cta_secondary_url: null,
    media_desktop_id: null,
    media_mobile_id: null,
    media_alt_override: null,
    media_slot_key: null,
    payload: {},
    field_classifications: {},
    publish_at: null,
    unpublish_at: null,
    schedule_state: 'PENDING',
    schedule_attempts: 0,
    schedule_error: null,
    schedule_last_attempt_at: null,
    fact_classification: 'BRAND_COPY',
    owner_verification: 'NOT_REQUIRED',
    status: 'PUBLISHED',
    seed_key: null,
    content_seed_version: null,
    seed_content_hash: null,
    seed_last_applied_at: null,
    owner_edited: false,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    updated_by: null,
    published_at: null,
    ...over,
  } as PageSection
}

const strings = siteStrings([
  content('EMPTY_STATE.collection', 'Our collection is being prepared.'),
  content('EMPTY_STATE.journal', 'Stories from the studio are on their way.'),
  content('ERROR.media_unavailable.label', 'Image unavailable'),
])

const media = { desktop: null, mobile: null, poster: null, slot: () => [] } as never

const baseProps = {
  media,
  strings,
  cloudName: CLOUD,
  isFirst: false,
  ordinal: 1,
  livePaths: new Set<string>(),
}

function fallbackReference(mode: 'EDITORIAL_BLOCK' | 'HIDE_SECTION' | 'SHOW_EMPTY_STATE') {
  return {
    result: {
      cards: [],
      reason: 'EMPTY' as const,
      merchandising: {
        slotKey: 'HOMEPAGE_SELECTED_WORKS',
        provenance: 'FALLBACK' as const,
        rule: null,
        fallback: { mode, sectionId: null },
      },
    },
    assets: new Map<string, MediaAsset>(),
  }
}

describe('the fallback on the page', () => {
  it('HIDE_SECTION renders nothing — not even the heading', () => {
    const { container } = render(
      React.createElement(SelectedWorksSection, {
        ...baseProps,
        section: section(),
        reference: fallbackReference('HIDE_SECTION'),
      }),
    )
    expect(container.innerHTML).toBe('')

    const journal = render(
      React.createElement(JournalStripSection, {
        ...baseProps,
        section: section({ block_type: 'journal-strip', heading: 'Journal' }),
        reference: {
          ...fallbackReference('HIDE_SECTION'),
          result: {
            ...fallbackReference('HIDE_SECTION').result,
            merchandising: {
              ...fallbackReference('HIDE_SECTION').result.merchandising,
              slotKey: 'HOMEPAGE_JOURNAL_STRIP',
            },
          },
        },
      }),
    )
    expect(journal.container.innerHTML).toBe('')
  })

  it('SHOW_EMPTY_STATE renders the seeded sentence and no card', () => {
    const { container } = render(
      React.createElement(SelectedWorksSection, {
        ...baseProps,
        section: section(),
        reference: fallbackReference('SHOW_EMPTY_STATE'),
      }),
    )
    expect(container.textContent).toContain('Our collection is being prepared.')
    expect(container.querySelectorAll('[data-product-card]')).toHaveLength(0)
    expect(container.querySelector('[data-provenance]')?.getAttribute('data-provenance')).toBe(
      'FALLBACK',
    )
  })

  it('EDITORIAL_BLOCK renders tiles with no product route, no price label and no product card', () => {
    const story = section({
      id: '00000000-0000-4000-8000-000000000005',
      block_type: 'material-story',
      heading: 'LIQUID.\nFORM.\nCRAFT.\nOBJECT.',
      body: 'Resin begins without a fixed shape.',
      cta_label: 'Discover Our Process',
      cta_url: '/process',
    })
    const tile = tileFromSection(story, new Map())
    expect(tile).not.toBeNull()
    // `/process` is not one of the three destinations a tile may link to, so the CTA is dropped.
    expect(tile?.ctaHref).toBeNull()

    const allowed = tileFromSection(
      section({ ...story, cta_url: '/large-format', cta_label: 'Large format' }),
      new Map(),
    )
    expect(allowed?.ctaHref).toBe('/large-format')

    const { container } = render(
      React.createElement(SelectedWorksSection, {
        ...baseProps,
        section: section(),
        reference: { ...fallbackReference('EDITORIAL_BLOCK'), tiles: tile === null ? [] : [tile] },
      }),
    )
    const html = container.innerHTML
    expect(container.querySelectorAll('[data-editorial-tile]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-product-card]')).toHaveLength(0)
    expect(html).not.toMatch(/\/product\//)
    expect(html).not.toMatch(/price/i)
    expect(html).not.toMatch(/view product/i)
    expect(container.textContent).toContain('Resin begins without a fixed shape.')
  })

  it('the fallback component itself has no field for a price or a product link', () => {
    const { container } = render(
      React.createElement(EditorialFallback, {
        strings,
        contentKey: 'EMPTY_STATE.collection',
        reason: 'EMPTY',
        tiles: [
          {
            key: 't1',
            heading: 'A heading',
            body: 'A line.',
            asset: null,
            altOverride: null,
            ctaLabel: 'Commission',
            ctaHref: '/custom-commissions',
          },
        ],
      }),
    )
    expect(container.querySelectorAll('a')).toHaveLength(1)
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/custom-commissions')
    expect(container.innerHTML).not.toMatch(/\/product\//)
  })
})
