import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Select } from './index'

function renderSelect(props: ComponentProps<typeof Select> = {}) {
  return render(
    <>
      <label htmlFor="finish">Finish</label>
      <Select id="finish" defaultValue="" {...props}>
        <option value="" disabled>
          Choose a finish
        </option>
        <option value="matte">Matte</option>
        <option value="gloss">High gloss</option>
      </Select>
    </>,
  )
}

describe('Select', () => {
  it('is a native select that takes its name from the field label', () => {
    renderSelect()
    expect(screen.getByRole('combobox', { name: 'Finish' })).toBeInTheDocument()
  })

  it('reports the chosen option to the consumer', async () => {
    const onChange = vi.fn()
    renderSelect({ onChange })
    const select = screen.getByRole('combobox', { name: 'Finish' })

    await userEvent.selectOptions(select, 'gloss')

    expect(select).toHaveValue('gloss')
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('carries the help and error wiring a Field hands it', () => {
    render(
      <>
        <label htmlFor="species">Timber species</label>
        <p id="species-help">Available species change with the season.</p>
        <Select id="species" aria-describedby="species-help" aria-invalid>
          <option value="walnut">Walnut</option>
        </Select>
      </>,
    )

    const select = screen.getByRole('combobox', { name: 'Timber species' })
    expect(select).toHaveAccessibleDescription('Available species change with the season.')
    expect(select).toHaveAttribute('aria-invalid', 'true')
  })

  it('cannot be changed while disabled, and stays discoverable', async () => {
    const onChange = vi.fn()
    renderSelect({ disabled: true, onChange })
    const select = screen.getByRole('combobox', { name: 'Finish' })

    await userEvent.click(select)

    expect(select).toBeDisabled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('is reachable by keyboard', async () => {
    renderSelect()
    await userEvent.tab()
    expect(screen.getByRole('combobox', { name: 'Finish' })).toHaveFocus()
  })
})
