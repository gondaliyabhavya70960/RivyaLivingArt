import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CollectionProductsSection } from '@/components/sections/CollectionProductsSection'
import { SignatureMediaSection } from '@/components/sections/SignatureMediaSection'
import type { SectionRenderProps } from '@/components/sections/types'
import { sectionMediaFor } from '@/lib/cms/media'
import { siteStrings } from '@/lib/cms/strings'
import type { GlobalContent, MediaAsset, PageSection } from '@/lib/supabase/schemas'

/**
 * The two Phase 16 blocks, at the renderer.
 *
 * THE ASSERTIONS THAT MATTER HERE ARE THE ABSENCES. A band that renders a card is easy to see in a
 * browser; a band that renders a lone `<video>` with no still, or an empty `<figcaption>`, or a
 * "this collection is being prepared" message in a Studio preview where nothing was ever asked,
 * looks close enough to right that nobody opens it twice. Each of those is asserted below.
 *
 * RENDERED DIRECTLY RATHER THAN THROUGH `SectionList`, because `reference` is the whole subject:
 * the list has no way to supply one, and passing `undefined` is exactly one of the cases under
 * test rather than the only one available.
 */

const CLOUD = 'rivya-test'
const STILL = '11111111-1111-4111-8111-111111111111'
const FILM = '22222222-2222-4222-8222-222222222222'

function asset(id: string, over: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id,
    provider: 'cloudinary',
    resource_type: 'image',
    public_id: `rivya/${id}`,
    folder: 'rivya',
    kind: 'PHOTO',
    alt_text: `alt for ${id}`,
    is_ai_generated: false,
    is_concept: false,
    width: 1600,
    height: 900,
    aspect_ratio: '16:9',
    duration_s: null,
    source: 'UPLOAD',
    tags: [],
    subject_tags: [],
    mime_type: 'image/jpeg',
    bytes: 100,
    poster_public_id: null,
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

function global_(group: string, key: string, value: string): GlobalContent {
  return { id: `${group}-${key}`, group_key: group, key, value, is_enabled: true } as GlobalContent
}

const STRINGS = siteStrings([
  global_('ERROR', 'media_unavailable.label', 'Image unavailable'),
  global_('ACTION_LABEL', 'media.play', 'Play'),
  global_('EMPTY_STATE', 'collection', 'This collection is being prepared.'),
])

function props(
  over: Partial<SectionRenderProps> & { readonly section: PageSection },
  assets: MediaAsset[] = [],
): SectionRenderProps {
  const map = new Map(assets.map((a) => [a.id, a]))
  return {
    media: sectionMediaFor(over.section, map),
    strings: STRINGS,
    cloudName: CLOUD,
    isFirst: false,
    ordinal: 1,
    livePaths: new Set<string>(),
    ...over,
  }
}

/** A reference answer, as `lib/cms/references.ts` would hand one down. */
function reference(cards: { id: string; slug: string; title: string }[], reason = 'OK' as const) {
  return {
    result: {
      cards: cards.map((c) => ({
        id: c.id,
        key: c.slug,
        title: c.title,
        summary: null,
        href: `/product/${c.slug}`,
        mediaId: null,
      })),
      reason: cards.length === 0 ? ('EMPTY' as const) : reason,
    },
    assets: new Map<string, MediaAsset>(),
  }
}

describe('CollectionProductsSection', () => {
  const base = section({ block_type: 'collection-products', payload: { limit: 12 } })

  it('renders the curated pieces as product cards', () => {
    render(
      <CollectionProductsSection
        {...props({
          section: base,
          reference: reference([{ id: 'p1', slug: 'a-piece', title: 'A piece' }]),
        })}
      />,
    )
    expect(screen.getByText('A piece')).toBeTruthy()
    expect(document.querySelectorAll('[data-product-card]')).toHaveLength(1)
  })

  it('renders the seeded empty state when the collection has nothing in it', () => {
    render(<CollectionProductsSection {...props({ section: base, reference: reference([]) })} />)
    expect(screen.getByText('This collection is being prepared.')).toBeTruthy()
  })

  /**
   * The Studio-preview case, and the reason `reference` is optional on the props.
   *
   * `undefined` means nobody asked the selector — not that the answer was "none". Rendering the
   * empty state here would tell an editor their collection is empty when the question was never
   * put, which is a different and worse thing than showing them nothing.
   */
  it('renders neither cards nor an empty state when nothing was asked', () => {
    render(<CollectionProductsSection {...props({ section: base, reference: undefined })} />)
    expect(screen.queryByText('This collection is being prepared.')).toBeNull()
    expect(document.querySelectorAll('[data-product-card]')).toHaveLength(0)
  })

  /**
   * D10, at the renderer. A band on an exhibition page must never quietly show pieces that are not
   * in the collection — that would present them as part of a collection nobody put them in.
   */
  it('shows no cards at all rather than substituting other products', () => {
    render(<CollectionProductsSection {...props({ section: base, reference: reference([]) })} />)
    expect(document.querySelectorAll('[data-product-card]')).toHaveLength(0)
  })
})

describe('SignatureMediaSection', () => {
  const still = asset(STILL)
  const film = asset(FILM, { resource_type: 'video', kind: 'VIDEO', duration_s: 8 })

  const withStill = (payload: PageSection['payload']) =>
    section({ block_type: 'signature-media', media_desktop_id: STILL, payload })

  it('renders the still and its caption', () => {
    render(
      <SignatureMediaSection
        {...props(
          {
            section: withStill({ is_video: false, autoplay: false, caption: 'Cast resin, 2024.' }),
          },
          [still],
        )}
      />,
    )
    expect(screen.getByText('Cast resin, 2024.')).toBeTruthy()
  })

  it('renders no figcaption at all when the caption is blank', () => {
    render(
      <SignatureMediaSection
        {...props({ section: withStill({ is_video: false, autoplay: false, caption: '   ' }) }, [
          still,
        ])}
      />,
    )
    // An empty figcaption is an element a screen reader announces with nothing inside it.
    expect(document.querySelector('[data-signature-caption]')).toBeNull()
  })

  /**
   * THE ONE THAT WOULD OTHERWISE SHIP. A film bound with no still renders nothing — not a lone
   * `<video>`, which would make the largest element on the page a media element that may never be
   * allowed to play, and would hand a reduced-motion visitor a frame chosen by the encoder.
   */
  it('renders nothing when a film is bound but no still is', () => {
    const filmOnly = section({
      block_type: 'signature-media',
      payload: {
        is_video: true,
        autoplay: true,
        caption: null,
        media: [{ slot: 'video', role: 'DESKTOP', media_id: FILM }],
      },
    })
    const { container } = render(
      <SignatureMediaSection {...props({ section: filmOnly }, [film])} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('still renders the picture when is_video is set but no film is bound', () => {
    const { container } = render(
      <SignatureMediaSection
        {...props(
          { section: withStill({ is_video: true, autoplay: true, caption: null, media: [] }) },
          [still],
        )}
      />,
    )
    expect(container.querySelector('img, picture')).toBeTruthy()
  })
})
