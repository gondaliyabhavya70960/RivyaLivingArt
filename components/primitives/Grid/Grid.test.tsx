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
