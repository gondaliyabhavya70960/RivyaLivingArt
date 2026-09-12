import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CardLayout, cardLayoutOf } from '@/components/sections/CardLayout'
import { SectionList } from '@/components/sections/SectionList'
import { ContentCarousel } from '@/components/patterns/ContentCarousel'
import { blockModule } from '@/lib/cms/registry'
import { BLOCK_TYPES } from '@/lib/cms/block-types'
import { siteStrings } from '@/lib/cms/strings'
import type { GlobalContent, PageSection } from '@/lib/supabase/schemas'

/**
 * The twelve declared-but-unbuilt layout variants, and the component three of them share.
 *
 * THE DEFECT THIS FILE EXISTS FOR is not a broken variant — it is a variant that is declared, offered
 * in the Studio's picker, chosen by an editor, and then ignored. Eleven blocks shipped two
 * `layoutVariants` each and branched on neither, so the picker changed nothing and nobody found out
 * because both values produced the same page. A test that renders one variant proves very little;
 * these assert that the two DIFFER, which is the only claim the picker actually makes.
 */

const CLOUD = 'rivya-test'
const LIVE_PATHS = new Set(['/contact'])

function global_(group: string, key: string, value: string): GlobalContent {
  return {
    id: `${group}-${key}`,
    group_key: group,
    key,
    label: null,
    value,
    description: null,
    is_enabled: true,
  } as GlobalContent
}

const STRINGS = siteStrings([
  global_('ERROR', 'media_unavailable.label', 'Image unavailable'),
  global_('ACTION_LABEL', 'media.play', 'Play'),
  global_('UI_LABEL', 'carousel.roledescription', 'carousel'),
  global_('UI_LABEL', 'carousel.item_position', '{{index}} of {{total}}'),
  global_('ACTION_LABEL', 'carousel.previous', 'Previous'),
  global_('ACTION_LABEL', 'carousel.next', 'Next'),
])

/** No carousel strings at all — the degrade path. */
const BARE_STRINGS = siteStrings([
  global_('ERROR', 'media_unavailable.label', 'Image unavailable'),
  global_('ACTION_LABEL', 'media.play', 'Play'),
])

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
    heading: null,
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
    schedule_state: 'IDLE',
    schedule_attempts: 0,
    schedule_error: null,
    schedule_last_attempt_at: null,
    status: 'PUBLISHED',
    fact_classification: 'GENERIC_SAFE',
    owner_verification: 'NOT_REQUIRED',
    ...over,
  } as PageSection
}

function renderSection(one: PageSection) {
  return render(
    <SectionList
      livePaths={LIVE_PATHS}
      sections={[one]}
      assets={new Map()}
      strings={STRINGS}
      cloudName={CLOUD}
    />,
  )
}

/**
 * THE CENSUS, AS AN ASSERTION.
 *
 * Every block declaring two or more variants must NAME at least one of them in its renderer — a
 * branch on the first implies the rest as its else. A block that names none renders one arrangement
 * whatever an editor picks, which is the state eleven of them shipped in.
 *
 * It reads the source rather than rendering, because "did this branch" is a question about the file:
 * a render test would need a fixture payload per block, and the blocks that draw nothing without
 * entities would pass vacuously.
 */
describe('every declared layout variant is branched on', () => {
  it('names at least one variant in each renderer that declares two', async () => {
    const { readFileSync } = await import('node:fs')
    const registry = readFileSync('components/sections/registry.ts', 'utf8')
    const renderers = new Map<string, string>()
    for (const match of registry.matchAll(/^\s*'?([a-z0-9-]+)'?:\s*([A-Za-z]+),/gm)) {
      renderers.set(match[1] as string, match[2] as string)
    }

    const silent: string[] = []
    for (const type of BLOCK_TYPES) {
      const variants = blockModule(type).layoutVariants
      if (variants.length < 2) continue
      const component = renderers.get(type)
      if (component === undefined) continue
      const source = readFileSync(`components/sections/${component}.tsx`, 'utf8')
      const names = variants.some((variant) => source.includes(`'${variant}'`))
      // The four card blocks branch inside `CardLayout`, naming their fallback at the call site.
      const delegates = source.includes('cardLayoutOf(') || source.includes('layout={')
      if (!names && !delegates) silent.push(type)
    }
    expect(silent).toEqual([])
  })
})

describe('cardLayoutOf', () => {
  it('falls through to the block’s own default on a value nobody implemented', () => {
    expect(cardLayoutOf(section({ layout_variant: 'nonsense' }), 'grid')).toBe('grid')
    expect(cardLayoutOf(section({ layout_variant: null }), 'strip')).toBe('strip')
  })

  it('reads the catalogue’s own words, including `row` for a strip', () => {
    expect(cardLayoutOf(section({ layout_variant: 'carousel' }), 'grid')).toBe('carousel')
    expect(cardLayoutOf(section({ layout_variant: 'row' }), 'grid')).toBe('strip')
    expect(cardLayoutOf(section({ layout_variant: 'strip' }), 'grid')).toBe('strip')
  })
})

describe('CardLayout', () => {
  const children = [<div key="a">First</div>, <div key="b">Second</div>]

  it('is a grid for `grid` and a scroll row for the other two', () => {
    const grid = render(
      <CardLayout layout="grid" gridClassName="grid-cols-3" strings={STRINGS} label="A band">
        {children}
      </CardLayout>,
    )
    expect(grid.container.querySelector('[data-carousel]')).toBeNull()
    expect(grid.container.querySelector('.grid-cols-3')).toBeTruthy()
    grid.unmount()

    for (const layout of ['carousel', 'strip'] as const) {
      const row = render(
        <CardLayout layout={layout} gridClassName="grid-cols-3" strings={STRINGS} label="A band">
          {children}
        </CardLayout>,
      )
      expect(row.container.querySelector('[data-carousel]')).toBeTruthy()
      expect(row.container.querySelector('.grid-cols-3')).toBeNull()
      row.unmount()
    }
  })

  /**
   * THE DEGRADE PATH, THROUGH THE REAL WIRING. The component-level test below proves it handles a
   * null; this proves `carouselLabels` actually delivers one when `global_content` has no row —
   * which is the state of every environment until the Phase 45 seed module has been applied.
   */
  it('renders a nameless but working row when the carousel strings are not seeded', () => {
    const { container } = render(
      <CardLayout layout="carousel" gridClassName="" strings={BARE_STRINGS} label="A band">
        {children}
      </CardLayout>,
    )
    const root = container.querySelector('[data-carousel]')
    expect(root?.hasAttribute('aria-roledescription')).toBe(false)
    expect(container.querySelector('[data-carousel-item]')?.hasAttribute('aria-label')).toBe(false)
    // The row itself still exists, still scrolls and still carries its section's name.
    expect(root?.getAttribute('aria-label')).toBe('A band')
    expect(container.querySelector('[data-carousel-scroller]')?.getAttribute('tabindex')).toBe('0')
  })

  /** The reveal layer fades a group's members in as the band scrolls past; a sideways row never does. */
  it('keeps `rv-reveal-group` off a scroll row', () => {
    const grid = render(
      <CardLayout layout="grid" gridClassName="" strings={STRINGS} label={null}>
        {children}
      </CardLayout>,
    )
    expect(grid.container.querySelector('.rv-reveal-group')).toBeTruthy()
    grid.unmount()

    const row = render(
      <CardLayout layout="strip" gridClassName="" strings={STRINGS} label={null}>
        {children}
      </CardLayout>,
    )
    expect(row.container.querySelector('.rv-reveal-group')).toBeNull()
  })
})

describe('ContentCarousel', () => {
  const items = [<span key="a">One</span>, <span key="b">Two</span>, <span key="c">Three</span>]

  function carousel(over: Partial<React.ComponentProps<typeof ContentCarousel>> = {}) {
    return render(
      <ContentCarousel
        items={items}
        roleDescription="carousel"
        itemPosition="{{index}} of {{total}}"
        label="Selected works"
        previousLabel="Previous"
        nextLabel="Next"
        {...over}
      />,
    )
  }

  it('is a group that says what kind of group it is, named by its section', () => {
    const { container } = carousel()
    const root = container.querySelector('[data-carousel]')
    expect(root?.getAttribute('role')).toBe('group')
    expect(root?.getAttribute('aria-roledescription')).toBe('carousel')
    expect(root?.getAttribute('aria-label')).toBe('Selected works')
  })

  it('labels each item with its position, 1-based', () => {
    const { container } = carousel()
    const labels = [...container.querySelectorAll('[data-carousel-item]')].map((item) =>
      item.getAttribute('aria-label'),
    )
    expect(labels).toEqual(['1 of 3', '2 of 3', '3 of 3'])
  })

  it('makes the scroller focusable, which is the whole keyboard implementation', () => {
    const { container } = carousel()
    expect(container.querySelector('[data-carousel-scroller]')?.getAttribute('tabindex')).toBe('0')
  })

  /** Every card keeps its own tab stop — a roving tabindex is what usually breaks this. */
  it('leaves the items’ own links alone', () => {
    const { container } = render(
      <ContentCarousel
        items={[
          <a key="a" href="/contact">
            A link
          </a>,
        ]}
        roleDescription="carousel"
        itemPosition="{{index}} of {{total}}"
        label={null}
        previousLabel="Previous"
        nextLabel="Next"
      />,
    )
    expect(container.querySelector('a[href="/contact"]')).toBeTruthy()
  })

  it('renders no arrows in `free` mode — a strip scrolls and does not step', () => {
    const { container } = carousel({ mode: 'free' })
    expect(container.querySelector('[data-carousel]')?.getAttribute('data-carousel')).toBe('free')
  })

  /** A missing string is never invented: the row degrades to a plain group and still scrolls. */
  it('drops what it cannot name rather than making a word up', () => {
    const { container } = carousel({
      roleDescription: null,
      itemPosition: null,
      label: null,
      previousLabel: null,
      nextLabel: null,
    })
    const root = container.querySelector('[data-carousel]')
    expect(root?.hasAttribute('aria-roledescription')).toBe(false)
    expect(root?.hasAttribute('aria-label')).toBe(false)
    expect(container.querySelector('[data-carousel-item]')?.hasAttribute('aria-label')).toBe(false)
    expect(container.querySelector('[data-carousel-scroller]')).toBeTruthy()
  })

  it('renders nothing at all with no items', () => {
    const { container } = carousel({ items: [] })
    expect(container.querySelector('[data-carousel]')).toBeNull()
  })
})

describe('hero — the third variant', () => {
  const base = {
    block_type: 'hero' as const,
    heading: 'Objects shaped by flow',
    payload: { is_video: false, autoplay: false, scrim: 30 },
  }

  it('puts the copy beside the media on `split` and beneath it on `contained`', () => {
    const split = renderSection(section({ ...base, layout_variant: 'split' }))
    expect(split.container.querySelector('.lg\\:grid-cols-2')).toBeTruthy()
    split.unmount()

    const contained = renderSection(section({ ...base, layout_variant: 'contained' }))
    expect(contained.container.querySelector('.lg\\:grid-cols-2')).toBeNull()
  })

  /** Before Phase 45 these two produced byte-identical output. That is the defect, asserted. */
  it('no longer renders `split` and `contained` the same', () => {
    const split = renderSection(section({ ...base, layout_variant: 'split' }))
    const splitHtml = split.container.innerHTML
    split.unmount()
    const contained = renderSection(section({ ...base, layout_variant: 'contained' }))
    expect(contained.container.innerHTML).not.toBe(splitHtml)
  })

  it('falls through to full-bleed on a value nobody implemented', () => {
    const { container } = renderSection(section({ ...base, layout_variant: 'nonsense' }))
    expect(container.querySelector('.lg\\:grid-cols-2')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Objects shaped by flow' })).toBeTruthy()
  })
})

describe('material-story — `stacked` drops the island', () => {
  const base = {
    block_type: 'material-story' as const,
    heading: 'Material defines the character',
    payload: {
      stages: [
        { key: 'a', title: 'One', body: '', media_index: null },
        { key: 'b', title: 'Two', body: '', media_index: null },
      ],
    },
  }

  it('renders no sticky column and no sequence wrapper on `stacked`', () => {
    const stacked = renderSection(section({ ...base, layout_variant: 'stacked' }))
    expect(stacked.container.querySelector('.lg\\:sticky')).toBeNull()
    const stackedHtml = stacked.container.innerHTML
    stacked.unmount()

    const sequence = renderSection(section({ ...base, layout_variant: 'sequence' }))
    expect(sequence.container.querySelector('.lg\\:sticky')).toBeTruthy()
    expect(sequence.container.innerHTML).not.toBe(stackedHtml)
  })
})
