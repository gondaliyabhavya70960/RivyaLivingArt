import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { SectionList } from '@/components/sections/SectionList'
import type { MediaAsset, PageSection } from '@/lib/supabase/schemas'

/**
 * `/process` chapter numbering, asserted at the counts that actually occur.
 *
 * WHY THIS TEST EXISTS. All seven chapters are `OWNER_VERIFICATION_REQUIRED`, so the page will
 * spend its early life with SOME of them published — one the day the owner clears the first, three
 * a week later, seven eventually. The failure it guards against is the obvious implementation: put
 * the number in the seeded eyebrow, and a page with chapters 1, 4 and 6 verified reads "01 04 06",
 * which tells a visitor that something has been removed and invites them to wonder what. Numbering
 * by rendered position reads 01 02 03, which is true: these are the stages Rivya has confirmed.
 *
 * ALTERNATION IS ASSERTED WITH IT, because it has the same bug in the same place. If the band
 * inverted on the section's authored position rather than its rendered one, three published
 * chapters could all land on the same parity and the page would lose the rhythm the layout is for.
 *
 * IT RENDERS THE REAL `SectionList`, not the renderer directly — the ordinal is computed there, so
 * a test that called `ProcessStepsSection` with a hand-made `ordinal` would be asserting its own
 * arithmetic.
 */

function chapter(index: number): PageSection {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    page_id: 'page',
    block_type: 'process-steps',
    position: index,
    is_visible: true,
    theme: null,
    layout_variant: 'chapter',
    eyebrow: `STEP ${index}`,
    heading: `Chapter ${index}`,
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
    payload: { numbered: false, steps: [], media: [] },
    fact_classification: 'BRAND_COPY',
    owner_verification: 'NOT_REQUIRED',
    status: 'PUBLISHED',
    publish_at: null,
    unpublish_at: null,
  } as unknown as PageSection
}

function renderChapters(count: number): string {
  const sections = Array.from({ length: count }, (_, i) => chapter(i + 1))
  return renderToStaticMarkup(
    <SectionList
      livePaths={new Set<string>()}
      sections={sections}
      assets={new Map<string, MediaAsset>()}
      strings={new Map()}
      cloudName="rivya-test"
    />,
  )
}

/** The rendered chapter numbers, in document order. */
function numbers(html: string): string[] {
  return [...html.matchAll(/>(\d{2})</g)].map((match) => match[1] as string)
}

/** How many chapters had their columns swapped — the `order-2` class the layout applies. */
function reversedCount(html: string): number {
  return html.split('md:order-2').length - 1
}

describe('chapter numbering', () => {
  it.each([1, 3, 5, 7])('numbers %i chapters contiguously from 01', (count) => {
    const rendered = numbers(renderChapters(count))

    expect(rendered).toEqual(
      Array.from({ length: count }, (_, i) => String(i + 1).padStart(2, '0')),
    )
  })

  it('renumbers what rendered rather than what was authored', () => {
    // The launch-day shape: the owner verifies three of the seven, and the three that publish are
    // whichever three they cleared. Whatever their authored positions were, the page reads 01-03.
    expect(numbers(renderChapters(3))).toEqual(['01', '02', '03'])
  })

  it.each([
    [1, 0],
    [3, 1],
    [5, 2],
    [7, 3],
  ])('inverts every second band at %i chapters', (count, expected) => {
    // Even ordinals swap: 2, 4, 6. The parity is of the RENDERED index, so a page missing the
    // authored second chapter still alternates from its own first band.
    expect(reversedCount(renderChapters(count))).toBe(expected)
  })
})
