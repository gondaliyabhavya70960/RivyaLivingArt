import * as React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/primitives/Button'
import { Cluster } from './index'

describe('Cluster', () => {
  it('keeps list semantics when it lays a list out as a wrapping row', () => {
    render(
      <Cluster as="ul" gap={2} aria-label="Applied filters">
        <li>Walnut</li>
        <li>1:1</li>
      </Cluster>,
    )
    const list = screen.getByRole('list', { name: 'Applied filters' })
    expect(list).toHaveAttribute('role', 'list')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('does not invent a role for an element that is not a list', () => {
    render(
      <Cluster data-testid="cluster">
        <span>From</span>
      </Cluster>,
    )
    expect(screen.getByTestId('cluster')).not.toHaveAttribute('role')
  })

  it('leaves the controls it wraps individually focusable in source order', async () => {
    render(
      <Cluster justify="start" gap={3}>
        <Button variant="primary">Send an Enquiry</Button>
        <Button>Save for later</Button>
      </Cluster>,
    )
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Send an Enquiry' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Save for later' })).toHaveFocus()
  })

  it('spreads id and aria attributes onto the element it renders', () => {
    render(
      <Cluster as="nav" aria-label="Breadcrumb" id="trail">
        <a href="/collection">Collection</a>
      </Cluster>,
    )
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveAttribute('id', 'trail')
  })

  it('forwards a ref to the DOM node', () => {
    const ref = React.createRef<HTMLElement>()
    render(<Cluster ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })
})
