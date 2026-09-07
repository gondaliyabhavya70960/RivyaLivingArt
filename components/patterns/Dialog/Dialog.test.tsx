import { describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dialog, type DialogProps } from './index'

/**
 * A trigger before the dialog and a link after it, so a focus leak in either direction
 * lands on a named element an assertion can catch. The dialog is rendered by a real
 * `open` state, because "restores focus to the trigger" is only true if the trigger is
 * still the thing that opened it.
 */
function Harness(props: Partial<DialogProps> = {}) {
  const [open, setOpen] = React.useState(false)
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Delete collection
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Delete this collection?"
        closeLabel="Close"
        {...props}
      >
        <p>Every product stays; only the grouping goes.</p>
        <button type="button">Delete permanently</button>
      </Dialog>
      <a href="/studio">Back to Studio</a>
    </div>
  )
}

/**
 * The scrim is the overlay's first child — the sheet of colour painted behind the panel.
 * It has no role and no name by design (every route out of the dialog it offers is
 * already in the accessible tree), so it is reached by walking out of the panel rather
 * than by a query.
 */
function scrimBehind(dialog: HTMLElement): HTMLElement {
  const scrim = dialog.parentElement?.parentElement?.firstElementChild
  if (!(scrim instanceof HTMLElement)) throw new Error('the dialog has no scrim behind it')
  return scrim
}

async function open() {
  await userEvent.click(screen.getByRole('button', { name: 'Delete collection' }))
  return screen.getByRole('dialog')
}

describe('Dialog', () => {
  it('is a modal dialog named by its own title', async () => {
    render(<Harness />)
    const dialog = await open()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('dialog', { name: 'Delete this collection?' })).toBe(dialog)
  })

  it('is absent from the page until it is opened', () => {
    render(<Harness />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('takes the description a consumer gives it', async () => {
    render(<Harness description="Products stay in the catalogue." />)
    const dialog = await open()
    expect(dialog).toHaveAccessibleDescription('Products stay in the catalogue.')
  })

  /*
   * THIS TEST CANNOT PROVE FOCUS RESTORATION ON ITS OWN. jsdom does not implement `inert`'s
   * focus behaviour: setting `inert` on an ancestor of the focused element leaves it focused
   * here, while a real browser blurs it to <body>.
   *
   * That difference hid a genuine defect. `useModalSurface` marks the rest of the page inert
   * in a layout effect; `FocusTrap` captured `document.activeElement` in a passive effect,
   * which runs later. In a browser it therefore captured <body> and correctly refused to
   * restore to it, so Escape left focus at the top of the document — while this test passed.
   * The fix captures the trigger before `inert` is applied.
   *
   * The binding assertion is in tests/e2e/design-system.spec.ts, which runs in Chromium.
   * Keep this one, but do not treat it as the guarantee.
   */
  it('moves focus into itself on open and hands it back to the trigger on close', async () => {
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Delete collection' })

    await userEvent.click(trigger)
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('honours an initialFocus over the first tabbable', async () => {
    function ConfirmHarness() {
      const cancelRef = React.useRef<HTMLButtonElement>(null)
      return (
        <Dialog
          open
          onClose={vi.fn()}
          title="Delete this collection?"
          closeLabel="Close"
          initialFocus={cancelRef}
        >
          <button type="button">Delete permanently</button>
          <button type="button" ref={cancelRef}>
            Keep it
          </button>
        </Dialog>
      )
    }
    render(<ConfirmHarness />)
    expect(await screen.findByRole('button', { name: 'Keep it' })).toHaveFocus()
  })

  it('keeps Tab inside itself', async () => {
    render(<Harness />)
    await open()

    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Delete permanently' })).toHaveFocus()

    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
    expect(screen.getByRole('link', { name: 'Back to Studio' })).not.toHaveFocus()
  })

  it('closes from the close control, which carries the name the consumer supplied', async () => {
    render(<Harness closeLabel="Close without deleting" />)
    await open()

    await userEvent.click(screen.getByRole('button', { name: 'Close without deleting' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes on a click outside the panel', async () => {
    render(<Harness />)
    const dialog = await open()

    await userEvent.click(scrimBehind(dialog))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('stays open on an outside click when the consumer forbids it', async () => {
    render(<Harness closeOnScrimClick={false} />)
    const dialog = await open()

    await userEvent.click(scrimBehind(dialog))

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
