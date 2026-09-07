import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Field } from '@/components/primitives/Field'
import { Switch } from './index'

describe('Switch', () => {
  it('exposes a switch role carrying its own state', () => {
    render(<Switch aria-label="Visible on the public site" onLabel="On" offLabel="Off" />)
    const control = screen.getByRole('switch', { name: 'Visible on the public site' })
    expect(control).toHaveAttribute('aria-checked', 'false')
  })

  it('states on and off in words, not in track colour alone', async () => {
    render(<Switch aria-label="Visible on the public site" onLabel="On" offLabel="Off" />)
    expect(screen.getByText('Off')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('switch'))

    expect(screen.getByText('On')).toBeInTheDocument()
    expect(screen.queryByText('Off')).not.toBeInTheDocument()
  })

  it('reports the setting it is being moved to', async () => {
    const onCheckedChange = vi.fn()
    render(
      <Switch
        aria-label="Visible on the public site"
        onLabel="On"
        offLabel="Off"
        onCheckedChange={onCheckedChange}
      />,
    )

    await userEvent.click(screen.getByRole('switch'))

    expect(onCheckedChange).toHaveBeenCalledWith(true)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('operates with both Space and Enter', async () => {
    const onCheckedChange = vi.fn()
    render(
      <Switch
        aria-label="Visible on the public site"
        onLabel="On"
        offLabel="Off"
        onCheckedChange={onCheckedChange}
      />,
    )
    const control = screen.getByRole('switch')

    await userEvent.tab()
    expect(control).toHaveFocus()

    await userEvent.keyboard('[Space]')
    expect(control).toHaveAttribute('aria-checked', 'true')

    await userEvent.keyboard('{Enter}')
    expect(control).toHaveAttribute('aria-checked', 'false')

    expect(onCheckedChange).toHaveBeenNthCalledWith(1, true)
    expect(onCheckedChange).toHaveBeenNthCalledWith(2, false)
  })

  it('does not move on its own when the setting is controlled elsewhere', async () => {
    const onCheckedChange = vi.fn()
    render(
      <Switch
        aria-label="Visible on the public site"
        onLabel="On"
        offLabel="Off"
        checked={false}
        onCheckedChange={onCheckedChange}
      />,
    )

    await userEvent.click(screen.getByRole('switch'))

    expect(onCheckedChange).toHaveBeenCalledWith(true)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText('Off')).toBeInTheDocument()
  })

  it('does not toggle while disabled, and stays discoverable', async () => {
    const onCheckedChange = vi.fn()
    render(
      <Switch
        aria-label="Visible on the public site"
        onLabel="On"
        offLabel="Off"
        disabled
        onCheckedChange={onCheckedChange}
      />,
    )
    const control = screen.getByRole('switch')

    await userEvent.click(control)

    expect(control).toBeDisabled()
    expect(control).toHaveAttribute('aria-checked', 'false')
    expect(onCheckedChange).not.toHaveBeenCalled()
  })

  it('lets Field own the id relationships, even though it is not a native input', () => {
    render(
      <Field label="Visible on the public site" help="Takes effect immediately.">
        <Switch onLabel="On" offLabel="Off" />
      </Field>,
    )

    const control = screen.getByRole('switch', { name: 'Visible on the public site' })
    expect(control).toHaveAccessibleDescription('Takes effect immediately.')
  })

  it('starts from the state it is given', () => {
    render(
      <Switch aria-label="Visible on the public site" onLabel="On" offLabel="Off" defaultChecked />,
    )
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('On')).toBeInTheDocument()
  })
})
