import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SECTION_RENDERERS } from '@/components/sections/registry'
import { SectionList } from '@/components/sections/SectionList'
import { sectionActions } from '@/components/sections/SectionActions'
import { hasSectionCopy } from '@/components/sections/SectionCopy'
import { schemeOf } from '@/components/sections/SectionShell'
import { BLOCK_TYPES } from '@/lib/cms/block-types'
import { sectionMediaFor } from '@/lib/cms/media'
import { isBuilt } from '@/lib/cms/registry'
import { siteStrings } from '@/lib/cms/strings'
import type { GlobalContent, MediaAsset, PageSection } from '@/lib/supabase/schemas'

const CLOUD = 'rivya-test'

/**
 * Real uuids, not 'm1'. `blockMediaEntrySchema` validates `media_id` as a uuid, so a payload
 * referring to 'm1' is correctly discarded and the block falls back to its defaults — which for a
 * repeating block means no cards at all. The first draft of this file used short ids and every
 * repeating-media assertion failed for that reason and not for the one it was testing.
 */
const M1 = '11111111-1111-4111-8111-111111111111'
const M2 = '22222222-2222-4222-8222-222222222222'
const MISSING = '33333333-3333-4333-8333-333333333333'

function asset(id: string, over: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id,
    provider: 'cloudinary',
    resource_type: 'image',
    public_id: `rivya/${id}`,
    folder: 'rivya',
    filename: null,
    rivya_asset_id: null,
    kind: 'PHOTO',
    alt_text: `alt for ${id}`,
    is_ai_generated: false,
    is_concept: false,
    width: 1600,
    height: 900,
    aspect_ratio: '16:9',
    duration_s: null,
    uploaded_by: null,
    source: 'UPLOAD',
    title: null,
    caption: null,
    tags: [],
    subject_tags: [],
    mime_type: 'image/jpeg',
    bytes: 100,
    checksum: null,
    poster_public_id: null,
    model_format: null,
    file_size_bytes: null,
    poly_count: null,
    texture_count: null,
    model_thumbnail_id: null,
    model_poster_id: null,
    associated_product_id: null,
    ...over,
  } as MediaAsset
}

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

function global_(group: string, key: string, value: string, enabled = true): GlobalContent {
  return {
    id: `${group}-${key}`,
    group_key: group,
    key,
    label: null,
    value,
    description: null,
    is_enabled: enabled,
  } as GlobalContent
}

const STRINGS = siteStrings([
  // The groups are `global_content_group_allowed`'s own — a closed list, with ERROR added by 0055.
  global_('ERROR', 'media_unavailable.label', 'Image unavailable'),
  global_('ACTION_LABEL', 'media.play', 'Play'),
  global_('EMPTY_STATE', 'portfolio', 'Delivered work will appear here once it is confirmed.'),
  global_('EMPTY_STATE', 'disabled_one', 'Should never render', false),
])

function renderSections(sections: readonly PageSection[], assets: MediaAsset[] = []) {
  return render(
    <SectionList
      sections={sections}
      assets={new Map(assets.map((a) => [a.id, a]))}
      strings={STRINGS}
      cloudName={CLOUD}
    />,
  )
}

describe('the two registries agree', () => {
  it('gives every BUILT block a renderer and every PLANNED block none', () => {
    for (const type of BLOCK_TYPES) {
      const renderer = SECTION_RENDERERS[type]
      expect(renderer === null, `${type}`).toBe(!isBuilt(type))
    }
  })

  it('covers all 28 types', () => {
    expect(Object.keys(SECTION_RENDERERS)).toHaveLength(BLOCK_TYPES.length)
  })
})

describe('SectionList', () => {
  it('renders nothing for a block type this build does not know', () => {
    const { container } = renderSections([section({ block_type: 'not-a-real-block' })])
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing for a planned block', () => {
    const { container } = renderSections([section({ block_type: 'quote', heading: 'A line' })])
    expect(container).toBeEmptyDOMElement()
  })

  it('renders sections in the order given, not sorted', () => {
    renderSections([
      section({ id: 'a', block_type: 'statement', heading: 'Second in the array' }),
      section({ id: 'b', block_type: 'statement', heading: 'First in the array' }),
    ])
    const headings = screen.getAllByRole('heading').map((h) => h.textContent)
    expect(headings).toEqual(['Second in the array', 'First in the array'])
  })

  /** `isFirst` drives eager loading, and only the top section may have it. */
  it('marks only the first section as first', () => {
    renderSections(
      [
        section({ id: 'a', block_type: 'hero', heading: 'Top', media_desktop_id: M1 }),
        section({ id: 'b', block_type: 'hero', heading: 'Lower', media_desktop_id: M1 }),
      ],
      [asset(M1)],
    )
    const images = screen.getAllByRole('img')
    expect(images[0]?.getAttribute('loading')).toBe('eager')
    expect(images[1]?.getAttribute('loading')).toBe('lazy')
  })

  it('gives the first section an h1 and later ones an h2', () => {
    renderSections([
      section({ id: 'a', block_type: 'hero', heading: 'Opener' }),
      section({ id: 'b', block_type: 'hero', heading: 'Later' }),
    ])
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Opener')
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Later')
  })
})

describe('shared copy', () => {
  it('renders only the fields that are set', () => {
    renderSections([
      section({ block_type: 'statement', eyebrow: 'Materials', heading: 'Resin and timber' }),
    ])
    expect(screen.getByText('Materials')).toBeTruthy()
    expect(screen.getByText('Resin and timber')).toBeTruthy()
  })

  it('renders nothing at all when no copy is written', () => {
    const { container } = renderSections([section({ block_type: 'statement' })])
    expect(container).toBeEmptyDOMElement()
  })

  it('hasSectionCopy is the predicate the renderers use', () => {
    expect(hasSectionCopy(section())).toBe(false)
    expect(hasSectionCopy(section({ supporting: 'x' }))).toBe(true)
    // The trap this exists for: a JSX element is truthy whether or not it renders null.
    expect(hasSectionCopy(section({ cta_label: 'Enquire', cta_url: '/contact' }))).toBe(false)
  })
})

describe('calls to action', () => {
  it('needs both a label and a url', () => {
    expect(sectionActions(section({ cta_label: 'Enquire' }))).toEqual([])
    expect(sectionActions(section({ cta_url: '/contact' }))).toEqual([])
    expect(sectionActions(section({ cta_label: '  ', cta_url: '/contact' }))).toEqual([])
  })

  it('promotes a lone secondary to primary', () => {
    const actions = sectionActions(
      section({ cta_secondary_label: 'See the process', cta_secondary_url: '/process' }),
    )
    expect(actions).toEqual([{ label: 'See the process', url: '/process' }])
  })

  it('keeps both when both are filled, primary first', () => {
    const actions = sectionActions(
      section({
        cta_label: 'Commission a piece',
        cta_url: '/contact',
        cta_secondary_label: 'See the process',
        cta_secondary_url: '/process',
      }),
    )
    expect(actions.map((a) => a.label)).toEqual(['Commission a piece', 'See the process'])
  })

  it('never opens a new tab', () => {
    renderSections([
      section({ block_type: 'statement', heading: 'x', cta_label: 'Enquire', cta_url: '/contact' }),
    ])
    expect(screen.getByRole('link').getAttribute('target')).toBeNull()
  })
})

describe('themes', () => {
  it('falls back rather than throwing on an unknown theme', () => {
    expect(schemeOf('BONE')).toBe('BONE')
    expect(schemeOf(null)).toBe('DEEP')
    expect(schemeOf('dark')).toBe('DEEP')
    expect(schemeOf('dark', 'BONE')).toBe('BONE')
  })
})

describe('hero', () => {
  it('renders one image when only the desktop asset is set', () => {
    renderSections([section({ block_type: 'hero', media_desktop_id: M1 })], [asset(M1)])
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })

  it('renders both when desktop and mobile differ, each with its own alt', () => {
    renderSections(
      [section({ block_type: 'hero', media_desktop_id: M1, media_mobile_id: M2 })],
      [asset(M1), asset(M2)],
    )
    const alts = screen.getAllByRole('img').map((i) => i.getAttribute('alt'))
    expect(alts).toEqual([`alt for ${M2}`, `alt for ${M1}`])
  })

  it('renders one when both columns point at the same asset', () => {
    renderSections(
      [section({ block_type: 'hero', media_desktop_id: M1, media_mobile_id: M1 })],
      [asset(M1)],
    )
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })

  it('prefers the section override for alt text', () => {
    renderSections(
      [section({ block_type: 'hero', media_desktop_id: M1, media_alt_override: 'The opener' })],
      [asset(M1)],
    )
    expect(screen.getByRole('img').getAttribute('alt')).toBe('The opener')
  })

  it("falls back to the asset's own alt when the override is blank", () => {
    renderSections(
      [section({ block_type: 'hero', media_desktop_id: M1, media_alt_override: '   ' })],
      [asset(M1)],
    )
    expect(screen.getByRole('img').getAttribute('alt')).toBe(`alt for ${M1}`)
  })

  /**
   * The frame is reserved from the CMS ratio before the asset is known, so an unresolved asset
   * must not collapse it — that is the layout shift MediaFrame exists to prevent.
   */
  it('keeps the frame and shows the fallback label when the asset does not resolve', () => {
    renderSections([section({ block_type: 'hero', media_desktop_id: MISSING })], [])
    expect(screen.queryAllByRole('img')).toHaveLength(0)
    expect(screen.getByText('Image unavailable')).toBeTruthy()
  })
})

describe('category grid', () => {
  const cards = {
    columns: 3,
    cards: [
      { title: 'Wall art', description: 'Resin on timber', href: '/wall-art', media_index: 0 },
      { title: 'Tables', description: '', href: '/tables', media_index: 1 },
      { title: 'Objects', description: 'Smaller pieces', href: '', media_index: null },
    ],
    media: [
      { slot: 'cards', role: 'GALLERY', media_id: M1 },
      { slot: 'cards', role: 'GALLERY', media_id: M2 },
    ],
  }

  it('renders a card per titled entry', () => {
    renderSections(
      [section({ block_type: 'category-grid', payload: cards })],
      [asset(M1), asset(M2)],
    )
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Wall art',
      'Tables',
      'Objects',
    ])
  })

  it('links only the cards with a destination', () => {
    renderSections(
      [section({ block_type: 'category-grid', payload: cards })],
      [asset(M1), asset(M2)],
    )
    expect(screen.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([
      '/wall-art',
      '/tables',
    ])
  })

  it('skips a card with no title', () => {
    renderSections([
      section({
        block_type: 'category-grid',
        payload: {
          columns: 3,
          cards: [{ title: '  ', description: 'x', href: '/x', media_index: null }],
        },
      }),
    ])
    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0)
  })

  /**
   * Verification step 9's rendering half: `media_index` indexes the slot array, and that array is
   * position-stable. If the first asset is hidden the second card must still draw the second
   * asset — a compacted array would draw m2 for card one and nothing for card two.
   */
  it('keeps media_index pointing at the same reference when an earlier asset is missing', () => {
    renderSections([section({ block_type: 'category-grid', payload: cards })], [asset(M2)])
    const alts = screen.getAllByRole('img').map((i) => i.getAttribute('alt'))
    expect(alts).toEqual([`alt for ${M2}`])
  })
})

describe('process steps', () => {
  const steps = {
    numbered: true,
    steps: [
      { title: 'Pour', body: 'The resin goes in', media_index: 0 },
      { title: 'Cure', body: '', media_index: null },
    ],
    media: [{ slot: 'steps', role: 'GALLERY', media_id: M1 }],
  }

  it('numbers from the array order', () => {
    renderSections([section({ block_type: 'process-steps', payload: steps })], [asset(M1)])
    expect(screen.getByText('01')).toBeTruthy()
    expect(screen.getByText('02')).toBeTruthy()
  })

  it('uses a list when numbered, so the order is announced', () => {
    renderSections([section({ block_type: 'process-steps', payload: steps })], [asset(M1)])
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('is not a list when the order is presentational', () => {
    renderSections([
      section({ block_type: 'process-steps', payload: { ...steps, numbered: false } }),
    ])
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })
})

describe('empty state', () => {
  it('renders the global message for its key', () => {
    renderSections([
      section({
        block_type: 'empty-state',
        payload: { content_key: 'portfolio', show_cta: false },
      }),
    ])
    expect(screen.getByText('Delivered work will appear here once it is confirmed.')).toBeTruthy()
  })

  it('renders nothing when no key is chosen', () => {
    const { container } = renderSections([
      section({ block_type: 'empty-state', payload: { content_key: null, show_cta: false } }),
    ])
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the key names a missing row', () => {
    const { container } = renderSections([
      section({ block_type: 'empty-state', payload: { content_key: 'journal', show_cta: false } }),
    ])
    expect(container).toBeEmptyDOMElement()
  })

  /** A disabled row is the owner saying "do not show this", not "show the previous one". */
  it('renders nothing when the row is disabled', () => {
    const { container } = renderSections([
      section({
        block_type: 'empty-state',
        payload: { content_key: 'disabled_one', show_cta: false },
      }),
    ])
    expect(container).toBeEmptyDOMElement()
  })

  it('never shows the key itself', () => {
    renderSections([
      section({ block_type: 'empty-state', payload: { content_key: 'journal', show_cta: false } }),
    ])
    expect(screen.queryByText(/journal/i)).toBeNull()
  })
})

describe('divider', () => {
  it('renders a rule when asked and whitespace when not', () => {
    const withRule = renderSections([
      section({ block_type: 'divider', payload: { spacing: 'normal', rule: true } }),
    ])
    expect(withRule.container.querySelector('hr,[role="separator"]')).not.toBeNull()
    withRule.unmount()

    const withoutRule = renderSections([
      section({ block_type: 'divider', payload: { spacing: 'loose', rule: false } }),
    ])
    expect(withoutRule.container.querySelector('hr,[role="separator"]')).toBeNull()
  })

  /** A block with no copy fields still gets the chrome — this is the sharedFields: [] case. */
  it('still honours the section theme', () => {
    const { container } = renderSections([
      section({ block_type: 'divider', theme: 'BONE', payload: { spacing: 'tight', rule: true } }),
    ])
    expect(container.querySelector('.rv-scheme-bone')).not.toBeNull()
  })
})

describe('sectionMediaFor', () => {
  const assets = new Map([
    [M1, asset(M1)],
    [M2, asset(M2)],
  ])

  it('resolves the desktop and mobile columns', () => {
    const media = sectionMediaFor(section({ media_desktop_id: M1, media_mobile_id: M2 }), assets)
    expect(media.desktop?.id).toBe(M1)
    expect(media.mobile?.id).toBe(M2)
  })

  it('returns null for an id nothing resolves', () => {
    const media = sectionMediaFor(section({ media_desktop_id: MISSING }), assets)
    expect(media.desktop).toBeNull()
  })

  it('preserves slot positions, with null for a missing asset', () => {
    const media = sectionMediaFor(
      section({
        payload: {
          media: [
            { slot: 'cards', role: 'GALLERY', media_id: MISSING },
            { slot: 'cards', role: 'GALLERY', media_id: M2 },
          ],
        },
      }),
      assets,
    )
    expect(media.slot('cards').map((a) => a?.id ?? null)).toEqual([null, M2])
  })

  it('ignores malformed payload entries rather than throwing', () => {
    const media = sectionMediaFor(
      section({ payload: { media: [{ slot: 'cards' }, 'nonsense', null] } }),
      assets,
    )
    expect(media.slot('cards')).toEqual([])
  })

  it('separates slots', () => {
    const media = sectionMediaFor(
      section({
        payload: {
          media: [
            { slot: 'cards', role: 'GALLERY', media_id: M1 },
            { slot: 'steps', role: 'GALLERY', media_id: M2 },
          ],
        },
      }),
      assets,
    )
    expect(media.slot('cards').map((a) => a?.id)).toEqual([M1])
    expect(media.slot('steps').map((a) => a?.id)).toEqual([M2])
  })
})
