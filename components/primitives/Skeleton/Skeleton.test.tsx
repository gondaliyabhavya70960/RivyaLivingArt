import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { Skeleton } from './index'

describe('Skeleton', () => {
  it('is not exposed to assistive technology', () => {
    render(
      <div role="status" aria-label="Loading the catalogue">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>,
    )
    const region = screen.getByRole('status', { name: 'Loading the catalogue' })
    // Three placeholders, nothing to read: the region owns the announcement, the blocks
    // are decoration and are excluded from the accessible tree.
    expect(within(region).queryAllByRole('generic', { hidden: false })).toHaveLength(0)
    expect(region).toHaveTextContent('')
  })

  it('stays hidden even when the caller tries to describe it', () => {
    render(<Skeleton data-testid="row" aria-label="Loading a product row" />)
    expect(screen.getByTestId('row')).toHaveAttribute('aria-hidden', 'true')
  })

  it('spreads consumer attributes onto the block', () => {
    render(<Skeleton data-testid="cell" id="row-3-title" radius="none" />)
    expect(screen.getByTestId('cell')).toHaveAttribute('id', 'row-3-title')
  })
})
