import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AspectBox } from '@/components/primitives/AspectBox'
import { SectionShell, rhythmOf } from '@/components/sections/SectionShell'
import { BLOCK_TYPES } from '@/lib/cms/block-types'
import type { PageSection } from '@/lib/supabase/schemas'

/**
 * THE RHYTHM IS A DECISION, AND THIS ASSERTS THAT IT IS STILL ONE.
 *
 * Phase 02 declared four section steps and the site used one: twenty-seven of thirty call sites
 * passed `spacing="lg"`, so `--rv-section-y-sm` and `--rv-section-y-xl` were tokens nothing
 * referenced and ten consecutive bands on `/` were spaced identically. `DESIGN_SYSTEM.md` §19.1
 * recorded it under "section rhythm is uniform" and §50 is the rule it broke.
 *
 * A map alone would not stop that happening again — a later edit could quietly set every entry to
 * `lg` and nothing would fail. So the test below asserts the SHAPE of the rhythm rather than any
 * one value: every block type has an answer, and all four steps are actually in use.
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

describe('section rhythm', () => {
  it('answers for every block type in the catalogue', () => {
    for (const blockType of BLOCK_TYPES) {
      expect(['sm', 'md', 'lg', 'xl']).toContain(rhythmOf(blockType))
    }
  })

  it('uses all four steps, which is the finding it exists to fix', () => {
    const used = new Set(BLOCK_TYPES.map((blockType) => rhythmOf(blockType)))
    expect([...used].sort()).toEqual(['lg', 'md', 'sm', 'xl'])
  })

  it('gives a held moment more silence than the band it sits beside', () => {
    // The editorial claim in one assertion: a manifesto is not spaced like a journal strip.
    expect(rhythmOf('manifesto')).toBe('xl')
    expect(rhythmOf('journal-strip')).toBe('md')
    expect(rhythmOf('divider')).toBe('sm')
  })

  it('falls back rather than throwing on a block type outside the union', () => {
    // `page_sections.block_type` reaches this from the database. An unrecognised value must render
    // a band, not a 500 — the same reasoning `schemeOf` applies to an unknown `theme`.
    expect(rhythmOf('something-an-editor-typed')).toBe('lg')
  })

  it('takes the block type as its default and still lets a renderer override', () => {
    const { container: byType } = render(
      <SectionShell section={section({ block_type: 'manifesto' })}>body</SectionShell>,
    )
    expect(byType.querySelector('section')?.style.paddingBlock).toBe('var(--rv-section-y-xl)')

    const { container: overridden } = render(
      <SectionShell section={section({ block_type: 'manifesto' })} spacing="sm">
        body
      </SectionShell>,
    )
    expect(overridden.querySelector('section')?.style.paddingBlock).toBe('var(--rv-section-y-sm)')
  })
})

/**
 * THE HERO FLOOR (FEAT §49 question 2).
 *
 * A hero was a 21:9 `AspectBox` and nothing else, so its height was a function of WIDTH and never
 * of the viewport: measured across the eight QA widths its share ran 91 · 69 · 61 · 49 · 37 · 91 ·
 * 82 · 76 %, and at 768 the opening image held barely a third of the screen. These assert the
 * mechanism rather than the percentage, which only a browser can measure.
 */
describe('the aspect box floor', () => {
  it('applies the floor as a raw token value', () => {
    const { container } = render(
      <AspectBox ratio="21:9" minBlockSize="var(--rv-hero-min-h)" data-testid="box" />,
    )
    expect(container.querySelector('div')?.style.minBlockSize).toBe('var(--rv-hero-min-h)')
  })

  it('sets no floor when none is asked for, so every other frame is unchanged', () => {
    const { container } = render(<AspectBox ratio="4:5" />)
    expect(container.querySelector('div')?.style.minBlockSize).toBe('')
  })

  it('keeps the ratio classes, because the floor is a minimum and not a height', () => {
    const { container } = render(<AspectBox ratio="21:9" minBlockSize="var(--rv-hero-min-h)" />)
    const className = container.querySelector('div')?.className ?? ''
    expect(className).toContain('aspect-21/9')
    expect(className).toContain('md:aspect-21/9')
  })

  it('does not discard a style the caller passed alongside it', () => {
    const { container } = render(
      <AspectBox ratio="1:1" minBlockSize="var(--rv-hero-min-h)" style={{ opacity: '0.5' }} />,
    )
    const style = container.querySelector('div')?.style
    expect(style?.minBlockSize).toBe('var(--rv-hero-min-h)')
    expect(style?.opacity).toBe('0.5')
  })
})
