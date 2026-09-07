import { describe, expect, it } from 'vitest'
import { useRef, type ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FocusTrap } from './index'

/**
 * A trigger before the trap and a link after it, so any leak in either direction lands on
 * a named element the assertion can catch — a test that only checks "focus is still
 * inside" passes even when the trap has stopped working.
 */
function Harness({
  open,
  active = true,
  restoreFocus = true,
  children,
}: {
  open: boolean
  active?: boolean
  restoreFocus?: boolean
  children?: ReactNode
}) {
  return (
    <div>
      <button type="button">Open the drawer</button>
      {open ? (
        <FocusTrap active={active} restoreFocus={restoreFocus}>
          {children}
        </FocusTrap>
      ) : null}
      <a href="/collection">Back to the collection</a>
    </div>
  )
}

const panel = (
  <>
    <button type="button">Cancel</button>
    <input aria-label="Project name" />
    <button type="button">Save changes</button>
  </>
)

/**
 * §11's composition: a confirm opened over a filter drawer. Both surfaces portal to
 * <body>, so the two containers are SIBLINGS — neither contains the other — which is
 * exactly the arrangement that has each trap's guard pulling focus out of the other's.
 * Rendered as siblings here for the same reason the portals produce siblings there.
 */
function DrawerWithConfirm({ confirmOpen }: { confirmOpen: boolean }) {
  return (
    <div>
      <FocusTrap>
        <button type="button">Apply filters</button>
        <button type="button">Clear all</button>
      </FocusTrap>
      {confirmOpen ? (
        <FocusTrap>
          <button type="button">Delete permanently</button>
          <button type="button">Keep it</button>
        </FocusTrap>
      ) : null}
    </div>
  )
}

describe('FocusTrap', () => {
  it('moves focus to the first tabbable when it opens', () => {
    render(<Harness open>{panel}</Harness>)
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  it('cycles from the last tabbable back to the first on Tab', async () => {
    render(<Harness open>{panel}</Harness>)
    const save = screen.getByRole('button', { name: 'Save changes' })
    save.focus()

    await userEvent.tab()

    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    expect(screen.getByRole('link', { name: 'Back to the collection' })).not.toHaveFocus()
  })

  it('cycles from the first tabbable back to the last on Shift+Tab', async () => {
    render(<Harness open>{panel}</Harness>)
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()

    await userEvent.tab({ shift: true })

    expect(screen.getByRole('button', { name: 'Save changes' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Open the drawer' })).not.toHaveFocus()
  })

  it('moves normally between the controls inside it', async () => {
    render(<Harness open>{panel}</Harness>)

    await userEvent.tab()

    expect(screen.getByRole('textbox', { name: 'Project name' })).toHaveFocus()
  })

  it('skips a disabled control on the way round', async () => {
    render(
      <Harness open>
        <button type="button">Cancel</button>
        <button type="button" disabled>
          Publish
        </button>
        <button type="button">Save changes</button>
      </Harness>,
    )
    screen.getByRole('button', { name: 'Save changes' }).focus()

    await userEvent.tab()
    await userEvent.tab()

    expect(screen.getByRole('button', { name: 'Save changes' })).toHaveFocus()
  })

  it('does not open onto a control inside a disabled fieldset', () => {
    render(
      <Harness open>
        <fieldset disabled>
          <legend>Dimensions</legend>
          <input aria-label="Length" />
        </fieldset>
        <button type="button">Close</button>
      </Harness>,
    )
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
  })

  it('does not open onto a control inside a hidden subtree', () => {
    render(
      <Harness open>
        <div hidden>
          <button type="button">Edit the draft</button>
        </div>
        <button type="button">Close</button>
      </Harness>,
    )
    // A browser refuses focus() on a display:none control, so treating it as the first
    // tabbable would leave the keyboard on <body> and the next Tab would walk into the
    // page behind. jsdom permits the call, which is why this asserts where focus LANDED.
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
  })

  it('skips a control inside an aria-hidden subtree when it cycles', async () => {
    render(
      <Harness open>
        <button type="button">Cancel</button>
        <button type="button">Save changes</button>
        <div aria-hidden="true">
          <button type="button">Decorative control</button>
        </div>
      </Harness>,
    )
    screen.getByRole('button', { name: 'Save changes' }).focus()

    await userEvent.tab()

    // Save changes is the LAST tabbable, so Tab wraps. If the aria-hidden button counted,
    // the wrap would happen one control later and focus would land on it instead.
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  it('holds focus without throwing when there is nothing tabbable inside', async () => {
    render(
      <Harness open>
        <p>Deleting this collection cannot be undone.</p>
      </Harness>,
    )
    const message = screen.getByText('Deleting this collection cannot be undone.')

    await userEvent.tab()

    expect(screen.getByRole('link', { name: 'Back to the collection' })).not.toHaveFocus()
    expect(screen.getByRole('button', { name: 'Open the drawer' })).not.toHaveFocus()
    expect(message.parentElement).toHaveFocus()
  })

  it('returns focus to whatever had it before, when it goes away', async () => {
    const { rerender } = render(<Harness open={false} />)
    const trigger = screen.getByRole('button', { name: 'Open the drawer' })
    await userEvent.click(trigger)
    expect(trigger).toHaveFocus()

    rerender(<Harness open>{panel}</Harness>)
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()

    rerender(<Harness open={false} />)
    expect(trigger).toHaveFocus()
  })

  it('leaves focus alone on the way out when the caller asks it to', async () => {
    const { rerender } = render(<Harness open={false} restoreFocus={false} />)
    const trigger = screen.getByRole('button', { name: 'Open the drawer' })
    await userEvent.click(trigger)

    rerender(
      <Harness open restoreFocus={false}>
        {panel}
      </Harness>,
    )
    rerender(<Harness open={false} restoreFocus={false} />)

    expect(trigger).not.toHaveFocus()
  })

  it('honours initialFocus over the first tabbable', () => {
    function ConfirmPanel() {
      const cancelRef = useRef<HTMLButtonElement>(null)
      return (
        <FocusTrap initialFocus={cancelRef}>
          <button type="button">Delete permanently</button>
          <button type="button" ref={cancelRef}>
            Keep it
          </button>
        </FocusTrap>
      )
    }
    render(<ConfirmPanel />)
    expect(screen.getByRole('button', { name: 'Keep it' })).toHaveFocus()
  })

  it('traps nothing while it is inactive', async () => {
    render(
      <Harness open active={false}>
        {panel}
      </Harness>,
    )
    screen.getByRole('button', { name: 'Save changes' }).focus()

    await userEvent.tab()

    expect(screen.getByRole('link', { name: 'Back to the collection' })).toHaveFocus()
  })

  it('gives the keyboard to the trap opened over it, and cycles inside that one', async () => {
    render(<DrawerWithConfirm confirmOpen />)

    expect(screen.getByRole('button', { name: 'Delete permanently' })).toHaveFocus()

    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Keep it' })).toHaveFocus()

    // The wrap is the confirm's, not the drawer's: neither of the drawer's controls may
    // take the keyboard while a surface sits on top of them.
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Delete permanently' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Apply filters' })).not.toHaveFocus()
    expect(screen.getByRole('button', { name: 'Clear all' })).not.toHaveFocus()
  })

  it('takes the keyboard back when the trap above it goes away', async () => {
    const { rerender } = render(<DrawerWithConfirm confirmOpen />)
    expect(screen.getByRole('button', { name: 'Delete permanently' })).toHaveFocus()

    rerender(<DrawerWithConfirm confirmOpen={false} />)

    expect(screen.getByRole('button', { name: 'Apply filters' })).toHaveFocus()

    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Clear all' })).toHaveFocus()

    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Apply filters' })).toHaveFocus()
  })
})
