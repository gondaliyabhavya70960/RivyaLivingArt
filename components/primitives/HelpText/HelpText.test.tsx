import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HelpText } from './index'

describe('HelpText', () => {
  it('describes the control that points at it', () => {
    render(
      <>
        <HelpText id="phone-help">Include your country code</HelpText>
        <input aria-label="Telephone" aria-describedby="phone-help" />
      </>,
    )
    expect(screen.getByRole('textbox', { name: 'Telephone' })).toHaveAccessibleDescription(
      'Include your country code',
    )
  })

  it('does not interrupt: a hint is not a live region', () => {
    render(<HelpText id="phone-help">Include your country code</HelpText>)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
