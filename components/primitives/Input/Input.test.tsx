import * as React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from './index'

describe('Input', () => {
  it('takes typed text and reports it', async () => {
    render(
      <>
        <label htmlFor="name">Full name</label>
        <Input id="name" name="name" />
      </>,
    )
    const input = screen.getByRole('textbox', { name: 'Full name' })
    await userEvent.type(input, 'Aarav Shah')
    expect(input).toHaveValue('Aarav Shah')
  })

  it('is named by its label and not by its placeholder', () => {
    render(
      <>
        <label htmlFor="postcode">Postcode</label>
        <Input id="postcode" placeholder="380015" />
      </>,
    )
    expect(screen.getByRole('textbox', { name: 'Postcode' })).toHaveAttribute(
      'placeholder',
      '380015',
    )
  })

  it('passes autocomplete and inputmode through to the control', () => {
    render(<Input aria-label="Telephone" autoComplete="tel" inputMode="tel" />)
    const input = screen.getByRole('textbox', { name: 'Telephone' })
    expect(input).toHaveAttribute('autocomplete', 'tel')
    expect(input).toHaveAttribute('inputmode', 'tel')
  })

  it('reports an invalid state programmatically, not only in colour', () => {
    render(
      <>
        <label htmlFor="email">Email address</label>
        <Input id="email" aria-invalid aria-describedby="email-error" />
        <p id="email-error">Enter an email address we can reply to</p>
      </>,
    )
    const input = screen.getByRole('textbox', { name: 'Email address' })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Enter an email address we can reply to')
  })

  it('cannot be typed into when disabled, and stays in the accessibility tree', async () => {
    render(<Input aria-label="Full name" disabled />)
    const input = screen.getByRole('textbox', { name: 'Full name' })
    await userEvent.type(input, 'Aarav Shah')
    expect(input).toBeDisabled()
    expect(input).toHaveValue('')
  })

  it('hands the consumer the DOM node', () => {
    const ref = React.createRef<HTMLInputElement>()
    render(<Input aria-label="Full name" ref={ref} />)
    ref.current?.focus()
    expect(screen.getByRole('textbox', { name: 'Full name' })).toHaveFocus()
  })
})
