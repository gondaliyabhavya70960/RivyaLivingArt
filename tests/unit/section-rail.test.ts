import { describe, expect, it } from 'vitest'

import { railEntries } from '@/components/patterns/SectionRail'
import type { PageReferences, SectionReference } from '@/lib/cms/references'
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

  /**
   * A LABEL IS NOT ENOUGH, AND THIS IS THE HALF THAT WAS MISSING.
   *
   * `tests/e2e/section-rail.spec.ts` caught it in a browser before this file did: on the seeded
   * homepage `journal-strip` carries the eyebrow "JOURNAL", is PUBLISHED and visible, and renders
   * NOTHING — its renderer returns null when its cards resolve empty and the merchandising fallback
   * is HIDE_SECTION. The rail listed it and linked to `#section-<id>` for an element that was never
   * emitted, which is a dead link inside a navigation device.
   *
   * The rule is uniform rather than a table of block types: every selector reports `result.reason`,
   * so "did this band's reference find anything" is one field that cannot fall out of step with a
   * renderer the way a hand-maintained list would.
   */
  function reference(reason: 'OK' | 'EMPTY' | 'NOT_YET_BUILT'): SectionReference {
    return { result: { cards: [], reason }, assets: new Map() } as SectionReference
  }

  function refs(entries: readonly (readonly [string, SectionReference])[]): PageReferences {
    return new Map(entries)
  }

  it('skips a labelled band whose reference resolved to nothing', () => {
    const entries = railEntries(
      [section({ id: 'a', block_type: 'journal-strip', eyebrow: 'JOURNAL' })],
      refs([['a', reference('EMPTY')]]),
    )
    expect(entries).toEqual([])
  })

  it('skips a band whose reference names a table that does not exist yet', () => {
    const entries = railEntries(
      [section({ id: 'a', eyebrow: 'PROJECTS' })],
      refs([['a', reference('NOT_YET_BUILT')]]),
    )
    expect(entries).toEqual([])
  })

  it('keeps a labelled band whose reference found something', () => {
    const entries = railEntries(
      [section({ id: 'a', eyebrow: 'JOURNAL' })],
      refs([['a', reference('OK')]]),
    )
    expect(entries).toEqual([{ id: 'a', label: 'JOURNAL' }])
  })

  /** Most bands have no reference at all, and those are decided by the eyebrow alone. */
  it('keeps a labelled band that has no reference, which is most of them', () => {
    expect(railEntries([section({ id: 'a', eyebrow: 'THE POUR' })], refs([]))).toEqual([
      { id: 'a', label: 'THE POUR' },
    ])
  })

  it('renumbers across a band dropped for an empty reference, leaving no hole', () => {
    const entries = railEntries(
      [
        section({ id: 'a', eyebrow: 'ONE' }),
        section({ id: 'b', eyebrow: 'GONE' }),
        section({ id: 'c', eyebrow: 'TWO' }),
      ],
      refs([['b', reference('EMPTY')]]),
    )
    expect(entries.map((e) => e.id)).toEqual(['a', 'c'])
    expect(entries.map((_, i) => String(i + 1).padStart(2, '0'))).toEqual(['01', '02'])
  })

  it('returns an empty list for a page with no labelled bands', () => {
    expect(railEntries([section(), section()])).toEqual([])
  })
})
