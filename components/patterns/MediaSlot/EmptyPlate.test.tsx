import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { EmptyPlate } from '@/components/patterns/MediaSlot/EmptyPlate'
import { BlockImage } from '@/components/patterns/MediaSlot'
import { siteStrings } from '@/lib/cms/strings'
import type { GlobalContent } from '@/lib/supabase/schemas'

/**
 * "Empty is designed" — public redesign guide §3, and §5.4's bone plate.
 *
 * WHAT THIS FILE IS REALLY GUARDING. The homepage hero rendered an empty `<div>` in production: a
 * black box above the fold. Before that it rendered the media FAILURE string, five times down the
 * page, which told a visitor something was broken when nothing was. Both are wrong in opposite
 * directions, and the plate is the third answer — so the tests below are mostly about which of the
 * three states the well is in.
 */

function global_(group: string, key: string, value: string): GlobalContent {
  return { id: `${group}-${key}`, group_key: group, key, value, is_enabled: true } as GlobalContent
}

const PENDING = global_('EMPTY_STATE', 'media_pending.label', 'Photograph in preparation')
const strings = siteStrings([PENDING])

describe('EmptyPlate', () => {
  it('says a photograph is in preparation, from the CMS row', () => {
    render(<EmptyPlate strings={strings} />)
    expect(screen.getByText('Photograph in preparation')).toBeInTheDocument()
  })

  it('names the object when the surface has a name for it', () => {
    render(<EmptyPlate strings={strings} title="River dining table" />)
    expect(screen.getByText('River dining table')).toBeInTheDocument()
  })

  it('renders nothing at all when the row is missing or disabled', () => {
    /*
     * THE DEGRADATION PATH, AND IT IS DELIBERATE. An unseeded database gets the quiet well A52
     * settled on, not the key name and not an English literal compiled into the bundle. This is
     * also why every existing test kept passing when the plate landed.
     */
    const { container: missing } = render(<EmptyPlate strings={siteStrings([])} />)
    expect(missing).toBeEmptyDOMElement()

    const disabled = siteStrings([{ ...PENDING, is_enabled: false }])
    const { container } = render(<EmptyPlate strings={disabled} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('never claims a date', () => {
    // SEED §55. "In preparation" is true the moment an object is briefed; "coming soon" is a
    // delivery promise nobody has made.
    const { container } = render(<EmptyPlate strings={strings} />)
    expect(container.textContent?.toLowerCase()).not.toContain('coming soon')
  })
})

describe('BlockImage — which empty the well shows', () => {
  const common = {
    asset: null,
    ratio: '16:9' as const,
    preset: 'hero' as const,
    sizes: '100vw',
    strings,
    cloudName: 'rivya-test',
  }

  it('draws the designed empty by default, where it used to draw nothing', () => {
    render(<BlockImage {...common} />)
    expect(screen.getByText('Photograph in preparation')).toBeInTheDocument()
  })

  it('still reserves the box, so nothing below it moves', () => {
    const { container } = render(<BlockImage {...common} />)
    expect(container.querySelector('[data-media-fallback]')).not.toBeNull()
  })

  it('lets a caller override it, which is how the catalogue keeps its category word', () => {
    render(<BlockImage {...common} fallback={<span data-own="">Furniture</span>} />)
    expect(screen.getByText('Furniture')).toBeInTheDocument()
    expect(screen.queryByText('Photograph in preparation')).not.toBeInTheDocument()
  })

  it('never reports a failure for a slot nobody has filled', () => {
    // ERROR.media_unavailable.* means an image that EXISTS could not be shown. This well is empty
    // because no photograph has been taken, which is the ordinary state of this catalogue.
    const { container } = render(<BlockImage {...common} />)
    expect(container.textContent).not.toContain('unavailable')
  })
})
