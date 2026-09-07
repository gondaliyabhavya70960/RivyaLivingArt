import * as React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Stack } from './index'

describe('Stack', () => {
  it('keeps list semantics when it lays a list out as a flex column', () => {
    render(
      <Stack as="ul" gap={2}>
        <li>Walnut</li>
        <li>Resin</li>
        <li>Brass</li>
      </Stack>,
    )
    // Removing the markers costs a flexed list its semantics in Safari and VoiceOver;
    // the explicit role is what base.css's ul[role='list'] reset is written against.
    expect(screen.getByRole('list')).toHaveAttribute('role', 'list')
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('names the list from the caller so it is announced as something', () => {
    render(
      <Stack as="ol" aria-label="Commission steps">
        <li>Enquire</li>
        <li>Design</li>
      </Stack>,
    )
    expect(screen.getByRole('list', { name: 'Commission steps' })).toBeInTheDocument()
  })

  it('does not invent a role for an element that is not a list', () => {
    render(
      <Stack data-testid="stack">
        <p>Each piece is made once</p>
      </Stack>,
    )
    expect(screen.getByTestId('stack')).not.toHaveAttribute('role')
  })

  it('lets a caller override the role it would otherwise set', () => {
    render(
      <Stack as="ul" role="presentation" data-testid="stack">
        <li>Walnut</li>
      </Stack>,
    )
    expect(screen.getByTestId('stack')).toHaveAttribute('role', 'presentation')
  })

  it('keeps its children in source order, which is reading order', () => {
    render(
      <Stack>
        <p>Enquire</p>
        <p>Design</p>
      </Stack>,
    )
    const first = screen.getByText('Enquire')
    const second = screen.getByText('Design')
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('spreads id and data attributes onto the element it renders', () => {
    render(<Stack id="enquiry-fields" data-testid="stack" />)
    expect(screen.getByTestId('stack')).toHaveAttribute('id', 'enquiry-fields')
  })

  it('forwards a ref to the DOM node', () => {
    const ref = React.createRef<HTMLElement>()
    render(<Stack as="ul" ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLUListElement)
  })
})
