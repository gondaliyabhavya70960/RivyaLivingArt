import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProductCard, type ProductCardProduct } from '@/components/patterns/ProductCard'
import { siteStrings } from '@/lib/cms/strings'
import type { GlobalContent } from '@/lib/supabase/schemas'

/**
 * The catalogue card's EMPTY well — §A5, "a sand well with the category word in mono, never
 * Image unavailable".
 *
 * WHY THIS FILE EXISTS AT ALL. `ProductCard` had no unit test of its own; what coverage it had came
 * through the section renderers that mount it, which count cards rather than read them. The empty
 * state is the one part of this card most visitors currently see — `product_media` holds zero rows
 * and every asset in the library is concept media the trigger refuses — so it is worth pinning
 * directly rather than inferring from a card count.
 */

function global_(group: string, key: string, value: string): GlobalContent {
  return { id: `${group}-${key}`, group_key: group, key, value, is_enabled: true } as GlobalContent
}

const strings = siteStrings([global_('PRICE_LABEL', 'price_on_request', 'Price on request')])

const product: ProductCardProduct = {
  id: '00000000-0000-4000-8000-0000000000a1',
  slug: 'river-table',
  title: 'River table',
  price_state: 'PRICE_ON_REQUEST',
  price_minor: null,
  price_from_minor: null,
  currency: 'INR',
  availability_state: 'MADE_TO_ORDER',
  edition_state: 'OPEN_EDITION',
  edition_size: null,
  is_customizable: true,
  hero_media_id: null,
}

describe('ProductCard — the empty well', () => {
  it('sets the category word in the well when no asset resolves', () => {
    render(
      <ProductCard
        product={product}
        asset={null}
        categoryName="Furniture"
        strings={strings}
        cloudName="rivya-test"
      />,
    )

    // The reserved box is still drawn — collapsing it is the layout shift MediaFrame prevents.
    const well = document.querySelector('[data-media-fallback]')
    expect(well).not.toBeNull()

    const label = well?.querySelector('[data-card-empty-category]')
    expect(label?.textContent).toBe('Furniture')
    // The mono face and the CSS uppercase, so the accessible name keeps the editor's casing.
    expect(label?.className).toContain('font-mono')
    expect(label?.className).toContain('uppercase')
  })

  /**
   * The same word is real text under the title. Announcing it twice would make every card in a
   * grid stutter, and a stand-in for a photograph is exactly what assistive tech should skip.
   */
  it('hides the well label from assistive tech, because the category is already real text', () => {
    render(
      <ProductCard
        product={product}
        asset={null}
        categoryName="Furniture"
        strings={strings}
        cloudName="rivya-test"
      />,
    )

    expect(document.querySelector('[data-card-empty-category]')?.getAttribute('aria-hidden')).toBe(
      'true',
    )

    /*
     * EXACTLY ONE ANNOUNCED INSTANCE, and the filter is the assertion rather than noise.
     * `getAllByText` walks the DOM, not the accessibility tree, so it finds the hidden well label
     * too — two matches here is the CORRECT markup, and a bare `toHaveLength(1)` would fail on
     * working code. What must be true is that only one of them reaches assistive tech.
     */
    const announced = screen
      .getAllByText('Furniture')
      .filter((node) => node.closest('[aria-hidden="true"]') === null)
    expect(announced).toHaveLength(1)
  })

  /**
   * A52's rule still holds everywhere it held before: a well with nothing to say says nothing.
   * A listing that spans categories passes no name, and must not acquire a sentence instead.
   */
  it('stays silent when the listing spans categories and passes no name', () => {
    render(<ProductCard product={product} asset={null} strings={strings} cloudName="rivya-test" />)

    const well = document.querySelector('[data-media-fallback]')
    expect(well).not.toBeNull()
    expect(well?.textContent).toBe('')
    expect(screen.queryByText('Image unavailable')).toBeNull()
  })
})
