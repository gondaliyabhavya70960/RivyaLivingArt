import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SectionList } from '@/components/sections/SectionList'
import { siteStrings } from '@/lib/cms/strings'
import type { GlobalContent, PageSection } from '@/lib/supabase/schemas'

/**
 * A CARD WHOSE DESTINATION 404s RENDERS AS TEXT, NOT AS A LINK — pinned for the two renderers that
 * claimed the rule and tested something else.
 *
 * `CategoryGridSection` and `SecondaryObjectsSection` both asked only whether `href` was non-empty.
 * That is a different question: three category pages sit DRAFT behind the owner's verification
 * gate, so `/collection/collectible-design`, `/collection/3d-resin` and `/collection/preservation`
 * were live anchors to 404s — three on `/collection` and two of them on the homepage as well,
 * measured by fetching the live site and checking every internal link on ten pages (55 unique
 * paths, exactly those three dead).
 *
 * `SectionRenderProps.livePaths` already existed for precisely this, and its own comment describes
 * the failure: "a path that answers 404 looks exactly like one that does not". These renderers
 * simply never destructured it.
 *
 * THE RULE ITSELF is `lib/site/resolve-target.ts`, tested in `tests/unit/resolve-target.test.ts`.
 * What is pinned here is that these two renderers CONSULT it — the part that was missing.
 */

const CLOUD = 'rivya-test'

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

const STRINGS = siteStrings([global_('ERROR', 'media_unavailable.label', 'Image unavailable')])

/** `/collection/furniture` renders; the other two are the real DRAFT-gated pages. */
const LIVE_PATHS = new Set(['/collection/furniture'])

function section(over: Partial<PageSection>): PageSection {
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

/**
 * A payload that SATISFIES the block schema, which matters more than it looks.
 *
 * `parseBlockPayload` falls back to the block's DEFAULTS when a payload fails its schema — quietly,
 * by design, so one stale row cannot take a page down. A fixture missing `description`,
 * `media_index` or `owner_verification` therefore renders the DEFAULT cards instead of failing, and
 * the test then passes or fails for a reason that has nothing to do with links.
 */
const CARDS = [
  {
    key: 'furniture',
    title: 'Furniture',
    description: 'Tables and planes.',
    href: '/collection/furniture',
    media_index: null,
    owner_verification: 'NOT_REQUIRED',
  },
  {
    key: 'collectible-design',
    title: 'Collectible Design',
    description: 'Objects with presence.',
    href: '/collection/collectible-design',
    media_index: null,
    owner_verification: 'NOT_REQUIRED',
  },
  {
    key: 'preservation',
    title: 'Preservation',
    description: 'Flowers held in resin.',
    href: '/collection/preservation',
    media_index: null,
    owner_verification: 'NOT_REQUIRED',
  },
]

function renderOne(blockType: string) {
  return render(
    <SectionList
      livePaths={LIVE_PATHS}
      sections={[
        section({
          block_type: blockType as PageSection['block_type'],
          payload: { cards: CARDS, columns: 3, media: [] },
        }),
      ]}
      assets={new Map()}
      strings={STRINGS}
      cloudName={CLOUD}
    />,
  )
}

describe.each([['category-grid'], ['secondary-objects']])('%s', (blockType) => {
  it('links the card whose destination renders', () => {
    const { container } = renderOne(blockType)
    const live = container.querySelector('[data-entry-key="furniture"]')
    expect(live, 'the live card is missing entirely').not.toBeNull()
    expect(live?.tagName).toBe('A')
    expect(live?.getAttribute('href')).toBe('/collection/furniture')
  })

  it('renders a card whose destination 404s as text, keeping the copy', () => {
    const { container } = renderOne(blockType)
    for (const key of ['collectible-design', 'preservation']) {
      const dead = container.querySelector(`[data-entry-key="${key}"]`)
      // Not hidden — hiding the card would delete an editor's work over a URL.
      expect(dead, `${key} was dropped instead of unlinked`).not.toBeNull()
      expect(dead?.tagName, `${key} still renders as an anchor`).toBe('DIV')
    }
  })

  it('emits no anchor at all to a path that is not live', () => {
    const { container } = renderOne(blockType)
    const hrefs = [...container.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'))
    expect(hrefs).not.toContain('/collection/collectible-design')
    expect(hrefs).not.toContain('/collection/preservation')
  })
})
