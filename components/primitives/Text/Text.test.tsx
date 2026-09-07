import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Text } from './index'

describe('Text', () => {
  it('renders the element it was asked for, so a chip row can be a real list', () => {
    render(
      <ul>
        <Text as="li">Walnut</Text>
        <Text as="li">Clear resin</Text>
      </ul>,
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('can be the described-by target of a control', () => {
    render(
      <>
        <input aria-labelledby="w-label" aria-describedby="w-hint" />
        <span id="w-label">Width</span>
        <Text id="w-hint" size="sm" tone="tertiary">
          Measured across the widest point
        </Text>
      </>,
    )
    expect(screen.getByRole('textbox')).toHaveAccessibleDescription(
      'Measured across the widest point',
    )
  })

  it('hands assistive tech the real string when the label is set in caps', () => {
    render(<Text uppercase>Made to order</Text>)
    // Uppercasing is CSS. The DOM keeps the sentence-case string, so a screen reader is
    // not given an acronym to spell out.
    expect(screen.getByText('Made to order')).toBeInTheDocument()
  })

  it('refuses the 11px floor for sentence-case prose', () => {
    render(
      // @ts-expect-error §3.3: --rv-text-2xs is reachable only for an uppercase,
      // letter-spaced label, so size="2xs" without `uppercase` is not assignable.
      <Text size="2xs">A paragraph nobody can read at eleven pixels</Text>,
    )
    expect(screen.getByText('A paragraph nobody can read at eleven pixels')).toBeInTheDocument()
  })

  it('allows the 11px floor for the one case §3.3 permits', () => {
    render(
      <Text size="2xs" uppercase>
        One of one
      </Text>,
    )
    expect(screen.getByText('One of one')).toBeInTheDocument()
  })

  it('exposes the DOM node to a consumer that needs to measure it', () => {
    const ref = { current: null as HTMLElement | null }
    render(
      <Text as="figcaption" ref={ref}>
        Resin river table, walnut edge
      </Text>,
    )
    expect(ref.current?.tagName).toBe('FIGCAPTION')
  })
})
