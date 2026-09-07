import { describe, expect, it } from 'vitest'
import * as React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Drawer, type DrawerProps, type DrawerSide } from './index'

/**
 * A trigger before the drawer and a link after it, so a focus leak in either direction
 * lands on a named element an assertion can catch.
 */
function Harness(props: Partial<DrawerProps> = {}) {
  const [open, setOpen] = React.useState(false)
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Filters
      </button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Refine the collection"
        closeLabel="Close"
        {...props}
      >
        <button type="button">Apply filters</button>
      </Drawer>
      <a href="/collection">Back to the collection</a>
    </div>
  )
}

/** The scrim is the overlay's first child — the sheet of colour painted behind the panel. */
function scrimBehind(drawer: HTMLElement): HTMLElement {
  const scrim = drawer.parentElement?.parentElement?.firstElementChild
  if (!(scrim instanceof HTMLElement)) throw new Error('the drawer has no scrim behind it')
  return scrim
}

async function open() {
  await userEvent.click(screen.getByRole('button', { name: 'Filters' }))
  return screen.getByRole('dialog')
}

describe('Drawer', () => {
  it('is absent from the page until it is opened', () => {
    render(<Harness />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it.each<DrawerSide>(['left', 'right', 'bottom'])(
    'is a modal dialog named by its title when anchored to the %s',
    async (side) => {
      render(<Harness side={side} />)
      const drawer = await open()
      expect(drawer).toHaveAttribute('aria-modal', 'true')
      expect(screen.getByRole('dialog', { name: 'Refine the collection' })).toBe(drawer)
    },
  )

  it('keeps its name when the title is taken off the screen', async () => {
    render(<Harness title="Menu" titleHidden />)
    const drawer = await open()
    expect(drawer).toHaveAccessibleName('Menu')
    expect(screen.getByRole('heading', { name: 'Menu' })).toBeInTheDocument()
  })

  it('moves focus into itself on open and hands it back to the trigger on close', async () => {
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Filters' })

    await userEvent.click(trigger)
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('keeps Tab inside itself', async () => {
    render(<Harness />)
    await open()

    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Apply filters' })).toHaveFocus()

    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
    expect(screen.getByRole('link', { name: 'Back to the collection' })).not.toHaveFocus()
  })

  it('closes from the close control, which carries the name the consumer supplied', async () => {
    render(<Harness closeLabel="Close the filter sheet" />)
    await open()

    await userEvent.click(screen.getByRole('button', { name: 'Close the filter sheet' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes on a click outside the panel', async () => {
    render(<Harness />)
    const drawer = await open()

    await userEvent.click(scrimBehind(drawer))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('stays open on an outside click when the consumer forbids it', async () => {
    render(<Harness closeOnScrimClick={false} />)
    const drawer = await open()

    await userEvent.click(scrimBehind(drawer))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('locks page scrolling while it is open and releases it on close', async () => {
    render(<Harness />)
    await open()
    expect(document.body).toHaveStyle({ overflow: 'hidden' })

    await userEvent.keyboard('{Escape}')

    expect(document.body.style.overflow).toBe('')
  })

  it('releases the scroll lock even when it is unmounted while still open', async () => {
    const { unmount } = render(<Harness />)
    await open()
    expect(document.body).toHaveStyle({ overflow: 'hidden' })

    unmount()

    expect(document.body.style.overflow).toBe('')
  })

  it('makes the rest of the page inert while open, and interactive again after', async () => {
    const { container } = render(<Harness />)
    await open()
    expect(container).toHaveAttribute('inert')

    await userEvent.keyboard('{Escape}')

    expect(container).not.toHaveAttribute('inert')
  })
})
