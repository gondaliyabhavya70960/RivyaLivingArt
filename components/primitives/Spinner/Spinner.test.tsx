import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Spinner } from './index'

describe('Spinner', () => {
  it('is hidden from assistive tech when it carries no label', () => {
    const { container } = render(<Spinner />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('announces itself when it is the only indication of progress', () => {
    render(<Spinner label="Loading products" />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading products')
  })
})
