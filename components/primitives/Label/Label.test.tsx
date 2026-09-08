import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Label } from './index'

describe('Label', () => {
  it('names the control it points at', () => {
    render(
      <>
        <Label htmlFor="city">Delivery city</Label>
        <input id="city" />
      </>,
    )
    expect(screen.getByRole('textbox', { name: 'Delivery city' })).toBeInTheDocument()
  })

  it('puts the required word into the accessible name, where a marker belongs', () => {
    render(
      <>
        <Label htmlFor="city" required requiredLabel="Required">
          Delivery city
        </Label>
        <input id="city" />
      </>,
    )
    expect(screen.getByRole('textbox', { name: 'Delivery city Required' })).toBeInTheDocument()
  })

  it('renders no marker when no word was supplied — a symbol alone is not a marker', () => {
    render(
      <>
        <Label htmlFor="city" required>
          Delivery city
        </Label>
        <input id="city" />
      </>,
    )
    expect(screen.getByRole('textbox', { name: 'Delivery city' })).toBeInTheDocument()
    expect(screen.queryByText('*')).not.toBeInTheDocument()
  })

  it('moves focus to its control when clicked', async () => {
    render(
      <>
        <Label htmlFor="city">Delivery city</Label>
        <input id="city" />
      </>,
    )
    await userEvent.click(screen.getByText('Delivery city'))
    expect(screen.getByRole('textbox')).toHaveFocus()
  })
})
