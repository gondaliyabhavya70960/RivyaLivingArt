import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Radio } from './index'

function renderGroup(props: { disabled?: boolean; onChange?: () => void } = {}) {
  return render(
    <fieldset>
      <legend>Edge profile</legend>
      <Radio name="edge" value="live" label="Live edge" {...props} />
      <Radio name="edge" value="square" label="Square edge" {...props} />
    </fieldset>,
  )
}

describe('Radio', () => {
  it('takes its accessible name from the label it renders', () => {
    renderGroup()
    expect(screen.getByRole('radio', { name: 'Live edge' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Square edge' })).toBeInTheDocument()
  })

  it('is exclusive within its name group', async () => {
    renderGroup()
    const live = screen.getByRole('radio', { name: 'Live edge' })
    const square = screen.getByRole('radio', { name: 'Square edge' })

    await userEvent.click(screen.getByText('Live edge'))
    expect(live).toBeChecked()

    await userEvent.click(screen.getByText('Square edge'))
    expect(square).toBeChecked()
    expect(live).not.toBeChecked()
  })

  it('is operable from the keyboard with Space', async () => {
    render(<Radio name="delivery" value="collect" label="Collect from the studio" />)
    const radio = screen.getByRole('radio')

    await userEvent.tab()
    expect(radio).toHaveFocus()
    await userEvent.keyboard('[Space]')

    expect(radio).toBeChecked()
  })

  it('does not select while disabled', async () => {
    const onChange = vi.fn()
    renderGroup({ disabled: true, onChange })
    const live = screen.getByRole('radio', { name: 'Live edge' })

    await userEvent.click(screen.getByText('Live edge'))

    expect(live).toBeDisabled()
    expect(live).not.toBeChecked()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('carries the label, help and error wiring a Field hands it', () => {
    render(
      <>
        <label htmlFor="lead-time">Standard lead time</label>
        <p id="lead-time-help">Confirmed with you before any deposit.</p>
        <Radio id="lead-time" name="lead" value="standard" aria-describedby="lead-time-help" />
      </>,
    )

    const radio = screen.getByRole('radio', { name: 'Standard lead time' })
    expect(radio).toHaveAccessibleDescription('Confirmed with you before any deposit.')
  })
})
