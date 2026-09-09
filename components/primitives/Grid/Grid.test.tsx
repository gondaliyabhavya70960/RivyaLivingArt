import * as React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Grid } from './index'

describe('Grid', () => {
  it('keeps list semantics when a list is laid out on the column grid', () => {
    render(
      <Grid as="ul" aria-label="Portfolio projects">
        <li>Foyer table</li>
        <li>Reception desk</li>
        <li>Boardroom table</li>
      </Grid>,
    )
    const list = screen.getByRole('list', { name: 'Portfolio projects' })
    expect(list).toHaveAttribute('role', 'list')
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('does not invent a role for an element that is not a list', () => {
    render(
      <Grid data-testid="grid">
        <div>Foyer table</div>
      </Grid>,
    )
    expect(screen.getByTestId('grid')).not.toHaveAttribute('role')
  })

  it('leaves an ordered list to number itself, and still names it', () => {
    render(
      <Grid as="ol" aria-label="Commission steps" data-testid="steps">
        <li>Enquire</li>
        <li>Design</li>
      </Grid>,
    )
    // `ol` already exposes role="list"; setting it would only match base.css's
    // `ol[role='list']` arm and strip the markers that carry the order.
    expect(screen.getByRole('list', { name: 'Commission steps' })).toBeInTheDocument()
    expect(screen.getByTestId('steps')).not.toHaveAttribute('role')
  })

  it('presents every child, so nothing is hidden by the column count', () => {
    render(
      <Grid as="ul">
        {['Foyer table', 'Reception desk', 'Boardroom table', 'Console', 'Bench'].map((name) => (
          <li key={name}>{name}</li>
        ))}
      </Grid>,
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
  })

  it('spreads id and aria attributes onto the element it renders', () => {
    render(
      <Grid as="section" aria-label="Related pieces" id="related">
        <article>Foyer table</article>
      </Grid>,
    )
    expect(screen.getByRole('region', { name: 'Related pieces' })).toHaveAttribute('id', 'related')
  })

  it('forwards a ref to the DOM node', () => {
    const ref = React.createRef<HTMLElement>()
    render(<Grid as="ul" ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLUListElement)
  })
})

/**
 * The column-override contract, asserted on the class list because that is where it broke.
 *
 * `cn` joins without Tailwind awareness, so emitting the editorial defaults ALONGSIDE a caller's
 * columns produced an element carrying both. Two competing `grid-cols-*` utilities are settled by
 * stylesheet order, and Tailwind emits them in ascending numeric order per breakpoint layer, so
 * `grid-cols-4` beat `grid-cols-1` and `lg:grid-cols-12` beat `lg:grid-cols-3` — every caller that
 * stated columns rendered 4 across on a phone and 12 on a desktop.
 */
describe('Grid columns', () => {
  it('drops the editorial defaults when the caller states its own columns', () => {
    render(
      <Grid data-testid="cards" className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <div />
      </Grid>,
    )

    const cards = screen.getByTestId('cards')
    expect(cards).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3')
    expect(cards).not.toHaveClass('grid-cols-4')
    expect(cards).not.toHaveClass('md:grid-cols-8')
    expect(cards).not.toHaveClass('lg:grid-cols-12')
  })

  it('recognises a breakpoint-only override, where the class follows a colon', () => {
    render(
      <Grid data-testid="wide" className="lg:grid-cols-5">
        <div />
      </Grid>,
    )

    expect(screen.getByTestId('wide')).not.toHaveClass('grid-cols-4')
  })

  it('keeps the editorial 4/8/12 when the caller states no columns', () => {
    render(
      <Grid data-testid="editorial" className="items-center">
        <div />
      </Grid>,
    )

    expect(screen.getByTestId('editorial')).toHaveClass(
      'grid-cols-4',
      'md:grid-cols-8',
      'lg:grid-cols-12',
    )
  })

  it('is not fooled by a class that merely ends in something similar', () => {
    render(
      <Grid data-testid="gapped" className="auto-cols-fr">
        <div />
      </Grid>,
    )

    expect(screen.getByTestId('gapped')).toHaveClass('grid-cols-4')
  })
})
