import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Checkbox } from './index'

describe('Checkbox', () => {
  it('takes its accessible name from the label it renders', () => {
    render(<Checkbox label="Include a matching plinth" />)
    expect(screen.getByRole('checkbox', { name: 'Include a matching plinth' })).toBeInTheDocument()
  })

  it('toggles when the label text is clicked, not just the box', async () => {
    render(<Checkbox label="Include a matching plinth" />)
    const box = screen.getByRole('checkbox')
    expect(box).not.toBeChecked()

    await userEvent.click(screen.getByText('Include a matching plinth'))

    expect(box).toBeChecked()
  })

  it('is operable from the keyboard with Space', async () => {
    render(<Checkbox label="Subscribe to the studio journal" />)
    const box = screen.getByRole('checkbox')

    await userEvent.tab()
    expect(box).toHaveFocus()
    await userEvent.keyboard('[Space]')

    expect(box).toBeChecked()
  })

  it('defers to a controlled owner instead of moving on its own', async () => {
    const onChange = vi.fn()
    render(<Checkbox label="Include a matching plinth" checked={false} onChange={onChange} />)
    const box = screen.getByRole('checkbox')

    await userEvent.click(box)

    expect(onChange).toHaveBeenCalledOnce()
    expect(box).not.toBeChecked()
  })

  it('does not toggle while disabled', async () => {
    const onChange = vi.fn()
    render(<Checkbox label="Include a matching plinth" disabled onChange={onChange} />)
    const box = screen.getByRole('checkbox')

    await userEvent.click(screen.getByText('Include a matching plinth'))

    expect(box).toBeDisabled()
    expect(box).not.toBeChecked()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('carries the label, help and error wiring a Field hands it', () => {
    render(
      <>
        <label htmlFor="consent">I agree to be contacted about this enquiry</label>
        <p id="consent-help">We reply on WhatsApp within one working day.</p>
        <Checkbox id="consent" aria-describedby="consent-help" aria-invalid />
      </>,
    )

    const box = screen.getByRole('checkbox', {
      name: 'I agree to be contacted about this enquiry',
    })
    expect(box).toHaveAccessibleDescription('We reply on WhatsApp within one working day.')
    expect(box).toHaveAttribute('aria-invalid', 'true')
  })
})
