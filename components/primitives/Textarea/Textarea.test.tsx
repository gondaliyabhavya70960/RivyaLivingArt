import * as React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Textarea } from './index'

describe('Textarea', () => {
  it('accepts more than one line', async () => {
    render(
      <>
        <label htmlFor="brief">Project brief</label>
        <Textarea id="brief" name="brief" />
      </>,
    )
    const area = screen.getByRole('textbox', { name: 'Project brief' })
    await userEvent.type(area, 'A dining table in walnut.{enter}Two metres by one.')
    expect(area).toHaveValue('A dining table in walnut.\nTwo metres by one.')
  })

  it('is named by its label and not by its placeholder', () => {
    render(
      <>
        <label htmlFor="brief">Project brief</label>
        <Textarea id="brief" placeholder="Dimensions, timing, room" />
      </>,
    )
    expect(screen.getByRole('textbox', { name: 'Project brief' })).toHaveAttribute(
      'placeholder',
      'Dimensions, timing, room',
    )
  })

  it('enforces a maximum the schema sets', async () => {
    render(<Textarea aria-label="Project brief" maxLength={10} />)
    const area = screen.getByRole('textbox', { name: 'Project brief' })
    await userEvent.type(area, 'A dining table in walnut')
    expect(area).toHaveValue('A dining t')
  })

  it('reports an invalid state programmatically, not only in colour', () => {
    render(
      <>
        <label htmlFor="brief">Project brief</label>
        <Textarea id="brief" aria-invalid aria-describedby="brief-error" />
        <p id="brief-error">Tell us a little about the piece</p>
      </>,
    )
    const area = screen.getByRole('textbox', { name: 'Project brief' })
    expect(area).toHaveAttribute('aria-invalid', 'true')
    expect(area).toHaveAccessibleDescription('Tell us a little about the piece')
  })

  it('cannot be typed into when disabled, and stays in the accessibility tree', async () => {
    render(<Textarea aria-label="Project brief" disabled />)
    const area = screen.getByRole('textbox', { name: 'Project brief' })
    await userEvent.type(area, 'A dining table')
    expect(area).toBeDisabled()
    expect(area).toHaveValue('')
  })

  it('hands the consumer the DOM node', () => {
    const ref = React.createRef<HTMLTextAreaElement>()
    render(<Textarea aria-label="Project brief" ref={ref} />)
    ref.current?.focus()
    expect(screen.getByRole('textbox', { name: 'Project brief' })).toHaveFocus()
  })
})
