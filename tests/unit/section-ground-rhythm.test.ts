import { describe, expect, it } from 'vitest'

import { withDefaultTheme } from '@/components/sections/rhythm'
import { BLOCK_TYPES } from '@/lib/cms/block-types'
import type { PageSection } from '@/lib/supabase/schemas'

/**
 * THE GROUND RHYTHM IS A DECISION, AND THIS ASSERTS THAT IT IS STILL ONE.
 *
 * `section-rhythm.test.tsx` guards the VERTICAL rhythm — how much silence a band gets. This guards
 * the other axis: what colour the band sits on. The finding it exists against is the same shape and
 * was worse. `page_sections.theme` is nullable, `SectionShell` fell back to `DEEP`, and exactly one
 * of the thirty-four renderers ever passed anything else — so every band of every CMS route
 * rendered on one ocean ground and the homepage measured 11,993px of a single colour at 1440px.
 *
 * A map alone would not stop that returning. The tests below assert the PROPERTIES the composition
 * depends on rather than any one band's colour, because a later edit that made every section
 * MINERAL would be exactly as wrong as the DEEP it replaced and would pass a value-by-value check.
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
    payload: {},
    field_classifications: {},
    status: 'PUBLISHED',
    fact_classification: 'GENERIC_SAFE',
    owner_verification: 'NOT_REQUIRED',
    ...over,
  } as PageSection
}

const themes = (sections: readonly PageSection[]): readonly (string | null)[] =>
  withDefaultTheme(sections).map((s) => s.theme)

describe('default ground rhythm', () => {
  it('gives every section a ground, whatever its block type', () => {
    const all = BLOCK_TYPES.map((blockType, position) =>
      section({ block_type: blockType, position }),
    )
    for (const theme of themes(all)) {
      expect(theme).not.toBeNull()
    }
  })

  it('alternates the two warm grounds, which is the finding it exists to fix', () => {
    const bands = [0, 1, 2, 3].map((position) => section({ block_type: 'statement', position }))
    expect(themes(bands)).toEqual(['MINERAL', 'SAND', 'MINERAL', 'SAND'])
  })

  it('never leaves an unconfigured page on a single ground', () => {
    const bands = [0, 1, 2, 3, 4].map((position) => section({ block_type: 'statement', position }))
    expect(new Set(themes(bands)).size).toBeGreaterThan(1)
  })

  /**
   * THE ONE RULE MOST LIKELY TO BE "TIDIED" AWAY. Advancing the warm counter on a dark band reads
   * as the obvious implementation and is wrong: it puts two SAND bands either side of a hero, which
   * is the one adjacency the alternation exists to prevent, and it is invisible in a diff.
   */
  it('does not advance the warm alternation across a dark interruption', () => {
    const bands = [
      section({ block_type: 'statement', position: 0 }),
      section({ block_type: 'hero', position: 1 }),
      section({ block_type: 'statement', position: 2 }),
    ]
    expect(themes(bands)).toEqual(['MINERAL', 'INK', 'SAND'])
  })

  it('puts the material and opening bands on a dark ground wherever they appear', () => {
    const bands = [
      section({ block_type: 'hero', position: 0 }),
      section({ block_type: 'material-story', position: 1 }),
      section({ block_type: 'scale-statement', position: 2 }),
      section({ block_type: 'signature-media', position: 3 }),
      section({ block_type: 'three-d-resin', position: 4 }),
      section({ block_type: 'final-cta', position: 5 }),
    ]
    for (const theme of themes(bands)) {
      expect(['INK', 'DEEP']).toContain(theme)
    }
  })

  /**
   * THE EDITORIAL GUARANTEE. `theme` is an editable column with a Studio control; a default that
   * overrode it would make that control a lie. Both the set case and the whitespace case are here
   * because a `''` coming back from a `<select>` whose empty option means "inherit" is the shape
   * this is most likely to meet in production.
   */
  it('never overrides a theme an editor has set', () => {
    const bands = [
      section({ block_type: 'statement', position: 0, theme: 'BONE' }),
      section({ block_type: 'hero', position: 1, theme: 'SAND' }),
    ]
    expect(themes(bands)).toEqual(['BONE', 'SAND'])
  })

  it('treats an empty theme string as unset rather than as a scheme', () => {
    expect(themes([section({ block_type: 'statement', theme: '   ' })])).toEqual(['MINERAL'])
  })

  it('leaves an unknown block type on the warm alternation rather than dropping it', () => {
    const bands = [
      section({ block_type: 'not-a-real-block' as PageSection['block_type'], position: 0 }),
      section({ block_type: 'statement', position: 1 }),
    ]
    expect(themes(bands)).toEqual(['MINERAL', 'SAND'])
  })

  it('is pure — it returns new rows and mutates none of its input', () => {
    const input = [section({ block_type: 'statement' })]
    const output = withDefaultTheme(input)
    expect(input[0]?.theme).toBeNull()
    expect(output[0]?.theme).toBe('MINERAL')
  })
})
