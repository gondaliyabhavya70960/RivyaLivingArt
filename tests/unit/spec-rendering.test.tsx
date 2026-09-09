import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProductSpecifications } from '@/components/patterns/ProductSpecifications'
import { siteStrings } from '@/lib/cms/strings'
import type { GlobalContent, ProductSpec } from '@/lib/supabase/schemas'

/**
 * The specification block's promise, asserted as ABSENCE.
 *
 * The Phase 15 risk table names this file for one specific failure: "the specification block
 * invents a value to avoid an ugly gap". So most of what is below checks that something is NOT
 * rendered, which is an awkward kind of test to write and the only kind that can catch this. A
 * placeholder is not a bug that throws — it is a component quietly being helpful, and it reads as
 * a fact to the visitor.
 *
 * THE PLACEHOLDER LIST IS EXPLICIT AND CHECKED AGAINST THE WHOLE DOM, not against a particular
 * element, because the way a placeholder actually arrives is in a branch nobody is looking at: a
 * `?? '—'` on a unit, an "N/A" in an empty group heading, a "Contact us" in a fallback. Searching
 * the rendered output for the strings themselves does not care where they came from.
 */

/**
 * Strings that cannot occur innocently anywhere in this block.
 *
 * A BARE HYPHEN IS NOT ON THIS LIST, and leaving it off was a correction rather than a compromise:
 * the first version included `-` and failed against "Hand-rubbed oil", a perfectly good finish. A
 * whole-DOM scan for a character that appears inside ordinary words reports the content, not the
 * defect. The hyphen is still checked — as a VALUE, by `expectNoPlaceholderValues` below, which is
 * where a placeholder actually lives.
 */
const PLACEHOLDERS = ['—', 'N/A', 'n/a', 'TBD', 'tbd', 'Coming soon', 'Contact us', 'contact us']

/** Tokens that are a placeholder when they are the WHOLE of a value. */
const PLACEHOLDER_VALUES = ['—', '-', '–', 'N/A', 'n/a', 'TBD', '?', '...', '…']

function spec(over: Partial<ProductSpec> = {}): ProductSpec {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    product_id: '99999999-9999-4999-8999-999999999999',
    sort_order: 0,
    label: 'Seat height',
    value: '450',
    unit: 'mm',
    group_label: null,
    status: 'PUBLISHED',
    owner_verification: 'NOT_REQUIRED',
    fact_classification: 'PRODUCT_FACT',
    ...over,
  } as ProductSpec
}

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
  global_('UI_LABEL', 'product.specifications.heading', 'Specifications'),
  global_('UI_LABEL', 'product.dimension.length_mm', 'Length'),
  global_('UI_LABEL', 'product.dimension.width_mm', 'Width'),
  global_('UI_LABEL', 'product.dimension.seats', 'Seats'),
])

/** Every unambiguous placeholder, against the whole rendered tree. */
function expectNoPlaceholders(container: HTMLElement): void {
  const textContent = container.textContent ?? ''
  for (const placeholder of PLACEHOLDERS) {
    expect(textContent, `rendered output contains the placeholder "${placeholder}"`).not.toContain(
      placeholder,
    )
  }
  expectNoPlaceholderValues(container)
}

/**
 * No rendered VALUE is a placeholder, which is the check that catches a bare dash.
 *
 * `-` inside a word is content; `-` as the entire contents of a `<dd>` is a component telling a
 * visitor that a measurement exists and is being withheld.
 */
function expectNoPlaceholderValues(container: HTMLElement): void {
  for (const dd of container.querySelectorAll('dd')) {
    const value = (dd.textContent ?? '').trim()
    expect(PLACEHOLDER_VALUES, `a value rendered as the placeholder "${value}"`).not.toContain(
      value,
    )
  }
}

describe('ProductSpecifications', () => {
  it('renders one row for one owner-entered spec', () => {
    render(<ProductSpecifications specs={[spec()]} dimensions={null} strings={STRINGS} />)

    expect(screen.getByText('Seat height')).toBeTruthy()
    // The unit is appended to the value, never converted.
    expect(screen.getByText('450 mm')).toBeTruthy()
    expect(document.querySelectorAll('[data-spec-row]')).toHaveLength(1)
  })

  it('is ABSENT from the DOM entirely when there is nothing to say', () => {
    const { container } = render(
      <ProductSpecifications specs={[]} dimensions={null} strings={STRINGS} />,
    )

    // Not "empty" — absent. An empty block is a heading over nothing, which reads as a section
    // that failed to load rather than a piece with no published specifications.
    expect(container.querySelector('[data-product-specifications]')).toBeNull()
    expect(container.textContent).toBe('')
  })

  it('is absent when the dimensions object is empty rather than null', () => {
    const { container } = render(
      <ProductSpecifications specs={[]} dimensions={{}} strings={STRINGS} />,
    )
    expect(container.querySelector('[data-product-specifications]')).toBeNull()
  })

  it('omits a null dimension key rather than rendering a placeholder for it', () => {
    // `width_mm` is absent from the object. The block must have exactly the two rows it was given.
    const { container } = render(
      <ProductSpecifications
        specs={[]}
        dimensions={{ length_mm: 1800, seats: 3 }}
        strings={STRINGS}
      />,
    )

    expect(container.querySelectorAll('[data-spec-row]')).toHaveLength(2)
    expect(screen.queryByText('Width')).toBeNull()
    expectNoPlaceholders(container)
  })

  it('renders a unitless spec without inventing a unit', () => {
    const { container } = render(
      <ProductSpecifications
        specs={[spec({ label: 'Finish', value: 'Hand-rubbed oil', unit: null })]}
        dimensions={null}
        strings={STRINGS}
      />,
    )

    expect(screen.getByText('Hand-rubbed oil')).toBeTruthy()
    expectNoPlaceholders(container)
  })

  it('renders a value that is not a number, unparsed', () => {
    // "made to order" is a legitimate answer and must survive intact. A component that parsed the
    // value to format it would be one step from converting a unit.
    render(
      <ProductSpecifications
        specs={[spec({ label: 'Lead time', value: 'made to order', unit: null })]}
        dimensions={null}
        strings={STRINGS}
      />,
    )
    expect(screen.getByText('made to order')).toBeTruthy()
  })

  it('performs no unit conversion — a millimetre stays a millimetre', () => {
    const { container } = render(
      <ProductSpecifications specs={[]} dimensions={{ length_mm: 1800 }} strings={STRINGS} />,
    )

    expect(screen.getByText('1800 mm')).toBeTruthy()
    // 1800 mm is 180 cm, 1.8 m and 70.87 in. None of them may appear.
    for (const converted of ['180 cm', '1.8 m', '70.87', '70.9 in', '1.8m']) {
      expect(container.textContent ?? '').not.toContain(converted)
    }
  })

  it('drops a dimension the CMS has no label for, rather than showing its raw key', () => {
    // `height_mm` has no `UI_LABEL` row here. `height_mm` is an internal identifier and showing one
    // to a visitor is worse than showing them one fewer fact.
    const { container } = render(
      <ProductSpecifications
        specs={[]}
        dimensions={{ length_mm: 1800, height_mm: 750 }}
        strings={STRINGS}
      />,
    )

    expect(container.querySelectorAll('[data-spec-row]')).toHaveLength(1)
    expect(container.textContent ?? '').not.toContain('height_mm')
    expect(container.textContent ?? '').not.toContain('750')
  })

  it('contributes no rows for a malformed dimensions blob', () => {
    // The database refuses this shape, so reaching the renderer means something else went wrong —
    // and the answer to that is still no row, never a guess at what was meant.
    const { container } = render(
      <ProductSpecifications specs={[]} dimensions={{ length_inches: 90 }} strings={STRINGS} />,
    )
    expect(container.querySelector('[data-product-specifications]')).toBeNull()
  })

  it('keeps the owner’s order rather than sorting', () => {
    const { container } = render(
      <ProductSpecifications
        specs={[
          spec({ id: 'a1111111-1111-4111-8111-111111111111', label: 'Zinc', sort_order: 0 }),
          spec({ id: 'b1111111-1111-4111-8111-111111111111', label: 'Ash', sort_order: 1 }),
        ]}
        dimensions={null}
        strings={STRINGS}
      />,
    )

    const labels = [...container.querySelectorAll('dt')].map((node) => node.textContent)
    expect(labels).toEqual(['Zinc', 'Ash'])
  })

  it('renders a group heading only for rows that carry one', () => {
    const { container } = render(
      <ProductSpecifications
        specs={[
          spec({
            id: 'a1111111-1111-4111-8111-111111111111',
            label: 'Seat height',
            group_label: 'Dimensions',
          }),
          spec({
            id: 'b1111111-1111-4111-8111-111111111111',
            label: 'Finish',
            value: 'Oil',
            unit: null,
          }),
        ]}
        dimensions={null}
        strings={STRINGS}
      />,
    )

    expect(screen.getByText('Dimensions')).toBeTruthy()
    expect(container.querySelectorAll('[data-spec-row]')).toHaveLength(2)
    expectNoPlaceholders(container)
  })

  it('renders no heading when the CMS has no heading row, but still renders the rows', () => {
    // A missing label must cost the heading, never the facts.
    const bare = siteStrings([global_('UI_LABEL', 'product.dimension.length_mm', 'Length')])
    const { container } = render(
      <ProductSpecifications specs={[]} dimensions={{ length_mm: 1800 }} strings={bare} />,
    )

    expect(container.querySelector('[data-product-specifications]')).not.toBeNull()
    expect(container.querySelectorAll('h2')).toHaveLength(0)
    expect(screen.getByText('1800 mm')).toBeTruthy()
  })
})
