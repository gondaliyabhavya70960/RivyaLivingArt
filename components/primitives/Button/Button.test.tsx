import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './index'

describe('Button', () => {
  it('renders a real button element, not a link', () => {
    render(<Button>Send an Enquiry</Button>)
    expect(screen.getByRole('button', { name: 'Send an Enquiry' })).toBeInTheDocument()
  })

  it('keeps its accessible name while loading', () => {
    render(<Button loading>Send an Enquiry</Button>)
    const btn = screen.getByRole('button', { name: 'Send an Enquiry' })
    expect(btn).toHaveAttribute('aria-busy', 'true')
    expect(btn).toBeDisabled()
  })

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Place Order
      </Button>,
    )
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('is reachable and activatable by keyboard', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Commission a Piece</Button>)
    await userEvent.tab()
    expect(screen.getByRole('button')).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledOnce()
  })
})
