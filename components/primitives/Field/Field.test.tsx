import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '@/components/primitives/Input'
import { Field } from './index'

describe('Field', () => {
  it('labels the control it wraps, without the consumer wiring an id', () => {
    render(
      <Field label="Full name">
        <Input name="name" />
      </Field>,
    )
    expect(screen.getByRole('textbox', { name: 'Full name' })).toBeInTheDocument()
  })

  it('marks a required field with the supplied word', () => {
    render(
      <Field label="Email address" required requiredLabel="Required">
        <Input name="email" />
      </Field>,
    )
    expect(screen.getByRole('textbox', { name: 'Email address Required' })).toBeInTheDocument()
  })

  it('puts the required state on the control, not only the word in the label', () => {
    render(
      <Field label="Email address" required requiredLabel="Required">
        <Input name="email" />
      </Field>,
    )
    expect(screen.getByRole('textbox', { name: /Email address/ })).toBeRequired()
  })

  it('keeps a required state the control already carried', () => {
    render(
      <Field label="Email address">
        <Input name="email" aria-required />
      </Field>,
    )
    expect(screen.getByRole('textbox', { name: 'Email address' })).toBeRequired()
  })

  it('describes the control with its help text, which precedes the control', () => {
    render(
      <Field label="Telephone" help="Include your country code">
        <Input name="phone" />
      </Field>,
    )
    const control = screen.getByRole('textbox', { name: 'Telephone' })
    expect(control).toHaveAccessibleDescription('Include your country code')
    const help = screen.getByText('Include your country code')
    expect(help.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('announces an error, marks the control invalid and describes it with both messages', () => {
    render(
      <Field
        label="Email address"
        help="We reply within two working days"
        error="Enter an email address we can reply to"
      >
        <Input name="email" />
      </Field>,
    )
    const control = screen.getByRole('textbox', { name: 'Email address' })
    expect(control).toHaveAttribute('aria-invalid', 'true')
    expect(control).toHaveAccessibleDescription(
      'We reply within two working days Enter an email address we can reply to',
    )
    const error = screen.getByRole('alert')
    expect(error).toHaveTextContent('Enter an email address we can reply to')
    expect(error.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
  })

  it('leaves a healthy control unmarked and undescribed', () => {
    render(
      <Field label="Company">
        <Input name="company" />
      </Field>,
    )
    const control = screen.getByRole('textbox', { name: 'Company' })
    expect(control).not.toHaveAttribute('aria-invalid')
    expect(control).not.toHaveAttribute('aria-describedby')
    expect(control).not.toBeRequired()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps a description the control already carried', () => {
    render(
      <>
        <p id="privacy-note">We never share your address</p>
        <Field label="Email address" error="Enter an email address we can reply to">
          <Input name="email" aria-describedby="privacy-note" />
        </Field>
      </>,
    )
    expect(screen.getByRole('textbox', { name: 'Email address' })).toHaveAccessibleDescription(
      'Enter an email address we can reply to We never share your address',
    )
  })

  it('honours an id the control brought with it', () => {
    render(
      <Field label="Postcode" help="Six digits, no space">
        <Input id="delivery-postcode" name="postcode" />
      </Field>,
    )
    const control = screen.getByRole('textbox', { name: 'Postcode' })
    expect(control).toHaveAttribute('id', 'delivery-postcode')
    expect(control).toHaveAccessibleDescription('Six digits, no space')
  })

  it('accepts a caller-supplied control id', () => {
    render(
      <Field label="Length" controlId="length" help="In centimetres">
        <Input name="length" inputMode="numeric" />
      </Field>,
    )
    const control = screen.getByRole('textbox', { name: 'Length' })
    expect(control).toHaveAttribute('id', 'length')
    expect(control).toHaveAccessibleDescription('In centimetres')
  })

  it('gives every field its own ids when the same field is rendered twice', () => {
    render(
      <>
        <Field label="City" help="Where the piece will live">
          <Input name="city" />
        </Field>
        <Field label="Country" help="Where the piece will live">
          <Input name="country" />
        </Field>
      </>,
    )
    const city = screen.getByRole('textbox', { name: 'City' })
    const country = screen.getByRole('textbox', { name: 'Country' })
    expect(city.getAttribute('aria-describedby')).not.toBe(country.getAttribute('aria-describedby'))
  })

  it('focuses the control when its label is clicked', async () => {
    render(
      <Field label="Full name">
        <Input name="name" />
      </Field>,
    )
    await userEvent.click(screen.getByText('Full name'))
    expect(screen.getByRole('textbox', { name: 'Full name' })).toHaveFocus()
  })
})
