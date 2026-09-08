import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/primitives/Button'
import { DropdownMenu, type DropdownMenuItem } from './index'

function items(onSelect = vi.fn()): readonly DropdownMenuItem[] {
  return [
    { id: 'profile', label: 'Your profile', onSelect },
    { id: 'settings', label: 'Studio settings', onSelect },
    { id: 'sign-out', label: 'Sign out', onSelect },
  ]
}

function renderMenu(menuItems: readonly DropdownMenuItem[] = items()) {
  return render(
    <>
      <DropdownMenu trigger={<Button>Account</Button>} items={menuItems} />
      <button type="button">After the menu</button>
    </>,
  )
}

describe('DropdownMenu', () => {
  it('wires the trigger as a menu button', async () => {
    renderMenu()
    const trigger = screen.getByRole('button', { name: 'Account' })

    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    await userEvent.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const menu = screen.getByRole('menu', { name: 'Account' })
    expect(trigger.getAttribute('aria-controls')).toBe(menu.getAttribute('id'))
  })

  it('opens on click, Enter and Space with focus on the first item', async () => {
    renderMenu()
    const trigger = screen.getByRole('button', { name: 'Account' })

    await userEvent.click(trigger)
    expect(screen.getByRole('menuitem', { name: 'Your profile' })).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('menuitem', { name: 'Your profile' })).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    await userEvent.keyboard('[Space]')
    expect(screen.getByRole('menuitem', { name: 'Your profile' })).toHaveFocus()
  })

  it('opens downward on ArrowDown and upward on ArrowUp', async () => {
    renderMenu()

    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Account' })).toHaveFocus()

    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Your profile' })).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toHaveFocus()
  })

  it('moves through the items with the arrow keys and jumps with Home and End', async () => {
    renderMenu()

    await userEvent.click(screen.getByRole('button', { name: 'Account' }))

    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Studio settings' })).toHaveFocus()

    await userEvent.keyboard('{End}')
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toHaveFocus()

    // Wrapping, in both directions.
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Your profile' })).toHaveFocus()

    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toHaveFocus()

    await userEvent.keyboard('{Home}')
    expect(screen.getByRole('menuitem', { name: 'Your profile' })).toHaveFocus()
  })

  it('closes on Escape and puts focus back on the trigger', async () => {
    renderMenu()
    const trigger = screen.getByRole('button', { name: 'Account' })

    await userEvent.click(trigger)
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveFocus()
  })

  it('does not trap focus: Tab closes the menu and leaves it', async () => {
    renderMenu()
    const trigger = screen.getByRole('button', { name: 'Account' })

    await userEvent.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await userEvent.tab()

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0)
  })

  it('closes on an outside press without dragging focus back', async () => {
    renderMenu()

    await userEvent.click(screen.getByRole('button', { name: 'Account' }))
    await userEvent.click(screen.getByRole('button', { name: 'After the menu' }))

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    // The press was itself a focus decision; it is not undone.
    expect(screen.getByRole('button', { name: 'After the menu' })).toHaveFocus()
  })

  it('runs the item, closes, and returns focus to the trigger', async () => {
    const onSelect = vi.fn()
    renderMenu([
      { id: 'profile', label: 'Your profile' },
      { id: 'sign-out', label: 'Sign out', onSelect },
    ])
    const trigger = screen.getByRole('button', { name: 'Account' })

    await userEvent.click(trigger)
    await userEvent.keyboard('{End}')
    await userEvent.keyboard('{Enter}')

    expect(onSelect).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('keeps a disabled item reachable but never runs it', async () => {
    const onSelect = vi.fn()
    renderMenu([
      { id: 'profile', label: 'Your profile' },
      { id: 'archive', label: 'Archive this piece', onSelect, disabled: true },
    ])

    await userEvent.click(screen.getByRole('button', { name: 'Account' }))
    await userEvent.keyboard('{ArrowDown}')

    const disabled = screen.getByRole('menuitem', { name: 'Archive this piece' })
    // Reachable, so a reader can discover it exists (§12.1's rule for zero-result options).
    expect(disabled).toHaveFocus()
    expect(disabled).toHaveAttribute('aria-disabled', 'true')

    await userEvent.keyboard('{Enter}')
    expect(onSelect).not.toHaveBeenCalled()
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('activates a link item with Space, which the DOM does not do for an anchor', async () => {
    const onSelect = vi.fn()
    renderMenu([{ id: 'settings', label: 'Studio settings', href: '#settings', onSelect }])

    await userEvent.click(screen.getByRole('button', { name: 'Account' }))
    await userEvent.keyboard('[Space]')

    expect(onSelect).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('reports open and closed, and leaves a controlled menu alone', async () => {
    const onOpenChange = vi.fn()
    render(
      <DropdownMenu
        trigger={<Button>Account</Button>}
        items={items()}
        open={false}
        onOpenChange={onOpenChange}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Account' }))

    expect(onOpenChange).toHaveBeenCalledWith(true)
    // The owner of the state decides; the component did not open itself.
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
