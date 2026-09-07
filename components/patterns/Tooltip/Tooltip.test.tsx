import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tooltip } from './index'

/**
 * §11 fixes two delays: 400ms before a hover opens the tooltip, 100ms of grace before a
 * leave closes it. Both are asserted from BOTH sides — the state immediately after the
 * event, and the state once the timer has run — because a test that only waited for the
 * settled state would pass just as well against a tooltip with no delays at all.
 *
 * THE CLOCK IS REAL, and the raised timeout below is the price of that. Faking it here
 * means faking it for `userEvent` too, and the two disagree often enough that a hung test
 * would be the most likely failure of this file rather than a broken tooltip. Waiting on
 * real timers instead makes these tests sensitive to load: on their own they finish well
 * inside a second, but under the full suite they were pushed past vitest's 5000ms default
 * and failed as timeouts, looking for all the world like a broken tooltip.
 *
 * A HIDDEN TOOLTIP IS OUT OF THE ACCESSIBLE TREE, so `queryByRole('tooltip')` is `null`
 * while it is closed even though the element never leaves the DOM — which is exactly the
 * state this component wants, and is why the first two tests below still find its words in
 * the trigger's description: an explicit `aria-describedby` reference resolves through a
 * hidden element by design.
 */
vi.setConfig({ testTimeout: 20_000 })

const TOOLTIP_TEXT = 'Publishing makes this collection visible on the public site.'

function Fixture() {
  return (
    <div>
      <Tooltip content={TOOLTIP_TEXT}>
        <button type="button">Publish</button>
      </Tooltip>
      <a href="/studio">Back to Studio</a>
    </div>
  )
}

const trigger = () => screen.getByRole('button', { name: 'Publish' })
const shownTooltip = () => screen.queryByRole('tooltip')

describe('Tooltip', () => {
  it('describes the trigger rather than naming it', () => {
    render(<Fixture />)
    expect(trigger()).toHaveAccessibleName('Publish')
    expect(trigger()).toHaveAccessibleDescription(TOOLTIP_TEXT)
  })

  it('adds to a description the trigger already had rather than replacing it', () => {
    render(
      <>
        <p id="publish-help">Only an owner may publish.</p>
        <Tooltip content={TOOLTIP_TEXT}>
          <button type="button" aria-describedby="publish-help">
            Publish
          </button>
        </Tooltip>
      </>,
    )
    expect(trigger()).toHaveAccessibleDescription(`Only an owner may publish. ${TOOLTIP_TEXT}`)
  })

  it('waits out the hover delay before showing', async () => {
    render(<Fixture />)

    await userEvent.hover(trigger())
    expect(shownTooltip()).toBeNull()

    expect(await screen.findByRole('tooltip')).toHaveTextContent(TOOLTIP_TEXT)
  })

  it('shows at once on keyboard focus, with no delay to wait through', async () => {
    render(<Fixture />)

    await userEvent.tab()

    expect(trigger()).toHaveFocus()
    expect(shownTooltip()).toBeVisible()
  })

  it('hides again when focus moves on', async () => {
    render(<Fixture />)
    await userEvent.tab()
    expect(shownTooltip()).toBeVisible()

    await userEvent.tab()

    expect(screen.getByRole('link', { name: 'Back to Studio' })).toHaveFocus()
    expect(shownTooltip()).toBeNull()
  })

  it('grants a grace period on the way out so the pointer can reach it', async () => {
    render(<Fixture />)
    await userEvent.hover(trigger())
    await screen.findByRole('tooltip')

    await userEvent.unhover(trigger())
    expect(shownTooltip()).toBeVisible()

    await waitFor(() => expect(shownTooltip()).toBeNull())
  })

  it('keeps showing while the trigger is focused, even after the pointer leaves', async () => {
    render(<Fixture />)
    await userEvent.tab()
    await userEvent.hover(trigger())
    expect(shownTooltip()).toBeVisible()

    await userEvent.unhover(trigger())

    // Longer than the 100ms leave grace: focus outranks the pointer, so nothing closes it.
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(shownTooltip()).toBeVisible()
  })

  it('is dismissed by Escape while the pointer is still on the trigger (WCAG 1.4.13)', async () => {
    render(<Fixture />)
    await userEvent.hover(trigger())
    await screen.findByRole('tooltip')

    // Nothing inside the tooltip holds focus, so the key never reaches the wrapper: this
    // passes only because the listener is on the document.
    await userEvent.keyboard('{Escape}')

    expect(shownTooltip()).toBeNull()
  })

  it('stays dismissed under a pointer that has not moved, and opens again once it has', async () => {
    render(<Fixture />)
    await userEvent.hover(trigger())
    await screen.findByRole('tooltip')
    await userEvent.keyboard('{Escape}')

    // Longer than the 400ms hover delay: a dismissal that merely cancelled the pending
    // timer rather than latching would let the tooltip come straight back.
    await new Promise((resolve) => setTimeout(resolve, 600))
    expect(shownTooltip()).toBeNull()

    await userEvent.unhover(trigger())
    await userEvent.hover(trigger())
    expect(await screen.findByRole('tooltip')).toBeVisible()
  })

  it('never takes focus itself', async () => {
    render(<Fixture />)

    await userEvent.tab()
    await userEvent.tab()

    expect(screen.getByRole('link', { name: 'Back to Studio' })).toHaveFocus()
  })
})
