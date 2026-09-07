import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from './index'

describe('Badge', () => {
  it('renders the status word, so the state is never colour alone', () => {
    render(<Badge tone="warning">Owner verification required</Badge>)
    expect(screen.getByText('Owner verification required')).toBeInTheDocument()
  })

  it('contributes its word to the accessible name of the control it sits in', () => {
    render(
      <button type="button">
        <Badge tone="success">Published</Badge> Open row
      </button>,
    )
    expect(screen.getByRole('button', { name: 'Published Open row' })).toBeInTheDocument()
  })

  it('can describe a control when wired by id', () => {
    render(
      <>
        <input aria-labelledby="row-label" aria-describedby="row-status" />
        <span id="row-label">Collection name</span>
        <Badge id="row-status" tone="info">
          In review
        </Badge>
      </>,
    )
    expect(screen.getByRole('textbox')).toHaveAccessibleDescription('In review')
  })

  it('does not compile without a word', () => {
    render(
      // @ts-expect-error §2.9: a status pill with no label carries its state in colour
      // alone, which WCAG 1.4.1 forbids. `children` is required for that reason.
      <Badge tone="danger" />,
    )
    expect(screen.queryByText('Rejected')).not.toBeInTheDocument()
  })

  it('exposes its DOM node to the row that positions it', () => {
    const ref = { current: null as HTMLSpanElement | null }
    render(
      <Badge ref={ref} tone="neutral">
        Draft
      </Badge>,
    )
    expect(ref.current?.textContent).toBe('Draft')
  })
})
