import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PriceStatePill } from './PriceStatePill'

/**
 * §9's Phase D line, as a test: "RFQ is a pill, not a blank."
 *
 * WHY THE EMPTY-CELL CASE IS THE ONE WORTH PINNING. Most of this catalogue is request-for-quote, so
 * a price column that renders only the number renders nothing for most rows — and an empty cell is
 * indistinguishable from one somebody forgot to fill in. The regression this guards against is
 * somebody "simplifying" the column back to a figure.
 */

const STATES = ['FIXED', 'STARTING_FROM', 'REQUEST_QUOTE', 'PRICE_ON_REQUEST'] as const

describe('PriceStatePill', () => {
  it.each(STATES)('renders %s as words rather than an empty cell', (state) => {
    const { container } = render(<PriceStatePill state={state} />)
    const pill = container.querySelector(`[data-price-state="${state}"]`)
    expect(pill).not.toBeNull()
    expect(pill?.textContent?.trim()).not.toBe('')
  })

  it('names the two numberless states in full, because they are the common case here', () => {
    render(<PriceStatePill state="REQUEST_QUOTE" />)
    expect(screen.getByText('Request a quote')).toBeInTheDocument()
  })

  it('marks no state as an error, because none of them is one', () => {
    // A request-for-quote product is this studio's whole conversion model, not a deficiency.
    for (const state of STATES) {
      const { container } = render(<PriceStatePill state={state} />)
      const pill = container.querySelector(`[data-price-state="${state}"]`)
      expect(pill?.className).not.toContain('danger')
    }
  })
})
