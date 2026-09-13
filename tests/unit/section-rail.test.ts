import { describe, expect, it } from 'vitest'

import { railEntries } from '@/components/patterns/SectionRail'
import type { PageSection } from '@/lib/supabase/schemas'

/**
 * WHAT THE RAIL LISTS IS A RULE, AND THIS IS THE PART OF IT THAT CAN BE WRONG.
 *
 * `SectionRail` holds no list of its own: a band appears in the index if and only if it carries an
 * `eyebrow`, so an editor lengthens the rail by writing one and shortens it by clearing one. That
 * makes the selection rule the whole of the component's behaviour worth asserting — the rest is
 * anchors and utilities.
 *
 * The numbers are deliberately NOT asserted against the page's own order. They are the rail's
 * 1-based order over what it lists, which is the same rule `ordinal` follows in `SectionList`: a
 * page whose second band is withheld for owner verification must read 01, 02, 03 rather than
 * 01, 03, 04, because a gap in the numbering tells a visitor something is missing.
 */
function section(over: Partial<PageSection> = {}): PageSection {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    page_id: '00000000-0000-4000-8000-0000000000ff',
    block_type: 'statement',
    position: 0,
    is_visible: true,
    theme: null,
    layout_variant: null,
    eyebrow: null,
    payload: {},
    field_classifications: {},
    status: 'PUBLISHED',
    fact_classification: 'GENERIC_SAFE',
    owner_verification: 'NOT_REQUIRED',
    ...over,
  } as PageSection
}

describe('section rail entries', () => {
  it('lists a band that has an eyebrow', () => {
    const entries = railEntries([section({ id: 'a', eyebrow: 'THE POUR' })])
    expect(entries).toEqual([{ id: 'a', label: 'THE POUR' }])
  })

  it('skips a band with no eyebrow rather than inventing a label', () => {
    expect(railEntries([section({ id: 'a', eyebrow: null })])).toEqual([])
  })

  /** A cleared field arrives from a Studio text input as whitespace, not as null. */
  it('treats a whitespace eyebrow as absent', () => {
    expect(railEntries([section({ id: 'a', eyebrow: '   ' })])).toEqual([])
  })

  it('keeps the page order of the bands it does list', () => {
    const entries = railEntries([
      section({ id: 'a', eyebrow: 'ONE' }),
      section({ id: 'b', eyebrow: null }),
      section({ id: 'c', eyebrow: 'TWO' }),
    ])
    expect(entries.map((e) => e.id)).toEqual(['a', 'c'])
  })

  /**
   * THE NUMBERING IS POSITIONAL OVER THE RESULT, which is why this asserts the shape of the list
   * rather than a stored number: a skipped band in the middle must not leave a hole, and the only
   * way that stays true is if nothing here carries an index from the page.
   */
  it('renumbers across a skipped band rather than leaving a hole', () => {
    const entries = railEntries([
      section({ id: 'a', eyebrow: 'ONE' }),
      section({ id: 'b', eyebrow: null }),
      section({ id: 'c', eyebrow: 'TWO' }),
      section({ id: 'd', eyebrow: 'THREE' }),
    ])
    expect(entries.map((_, i) => String(i + 1).padStart(2, '0'))).toEqual(['01', '02', '03'])
  })

  it('returns an empty list for a page with no labelled bands', () => {
    expect(railEntries([section(), section()])).toEqual([])
  })
})
