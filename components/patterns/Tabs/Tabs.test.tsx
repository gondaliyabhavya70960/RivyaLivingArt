import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tabs, type TabItem } from './index'

const ITEMS: readonly TabItem[] = [
  { id: 'overview', label: 'Overview', content: 'Cast in three layers over eleven weeks.' },
  { id: 'materials', label: 'Materials', content: 'Black walnut, bio-resin, brass inlay.' },
  { id: 'care', label: 'Care', content: 'Wipe with a dry cloth. No solvents.' },
]

describe('Tabs', () => {
  it('names the tab list and marks the selected tab', () => {
    render(<Tabs items={ITEMS} label="Product details" defaultValue="materials" />)

    expect(screen.getByRole('tablist', { name: 'Product details' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Materials', selected: true })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Overview', selected: false })).toBeInTheDocument()
  })

  it('labels the visible panel by its own tab', () => {
    render(<Tabs items={ITEMS} label="Product details" />)

    const panel = screen.getByRole('tabpanel', { name: 'Overview' })
    expect(panel).toHaveTextContent('Cast in three layers over eleven weeks.')
    expect(screen.queryByRole('tabpanel', { name: 'Care' })).not.toBeInTheDocument()
  })

  it('puts exactly one tab in the tab order, so Tab walks past the whole strip', async () => {
    render(
      <>
        <Tabs items={ITEMS} label="Product details" />
        <button type="button">After the tabs</button>
      </>,
    )

    await userEvent.tab()
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveFocus()

    // The second and third tabs are tabIndex -1: one more Tab leaves the widget entirely
    // rather than stepping through the remaining tabs.
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'After the tabs' })).toHaveFocus()
  })

  it('selects the tab the arrow keys move to, by default', async () => {
    render(<Tabs items={ITEMS} label="Product details" />)

    await userEvent.tab()
    await userEvent.keyboard('{ArrowRight}')

    expect(screen.getByRole('tab', { name: 'Materials' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Materials' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel', { name: 'Materials' })).toHaveTextContent(
      'Black walnut, bio-resin, brass inlay.',
    )
  })

  it('moves focus without activating when activation is manual', async () => {
    render(<Tabs items={ITEMS} label="Product details" activation="manual" />)

    await userEvent.tab()
    await userEvent.keyboard('{ArrowRight}')

    expect(screen.getByRole('tab', { name: 'Materials' })).toHaveFocus()
    // Focus moved; selection did not.
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel', { name: 'Overview' })).toBeInTheDocument()
  })

  it('activates the focused tab on Enter and on Space under manual activation', async () => {
    render(<Tabs items={ITEMS} label="Product details" activation="manual" />)

    await userEvent.tab()
    await userEvent.keyboard('{ArrowRight}{Enter}')
    expect(screen.getByRole('tabpanel', { name: 'Materials' })).toHaveTextContent(
      'Black walnut, bio-resin, brass inlay.',
    )

    await userEvent.keyboard('{ArrowRight}[Space]')
    expect(screen.getByRole('tabpanel', { name: 'Care' })).toBeInTheDocument()
  })

  it('wraps at both ends and jumps with Home and End', async () => {
    render(<Tabs items={ITEMS} label="Product details" />)

    await userEvent.tab()
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Care' })).toHaveFocus()

    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveFocus()

    await userEvent.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Care' })).toHaveFocus()

    await userEvent.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveFocus()
  })

  it('skips a disabled tab and never selects one', async () => {
    const items: readonly TabItem[] = [
      { id: 'overview', label: 'Overview', content: 'One' },
      { id: 'materials', label: 'Materials', content: 'Two', disabled: true },
      { id: 'care', label: 'Care', content: 'Three' },
    ]
    render(<Tabs items={items} label="Product details" />)

    expect(screen.getByRole('tab', { name: 'Materials' })).toBeDisabled()

    await userEvent.tab()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Care' })).toHaveFocus()
    // Arrowing selects as it moves, and it moved past the disabled tab rather than onto it.
    expect(screen.getByRole('tab', { name: 'Care' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Materials' })).toHaveAttribute('aria-selected', 'false')
  })

  it('reports the tab being selected and leaves a controlled strip alone', async () => {
    const onValueChange = vi.fn()
    render(
      <Tabs items={ITEMS} label="Product details" value="overview" onValueChange={onValueChange} />,
    )

    await userEvent.click(screen.getByRole('tab', { name: 'Care' }))

    expect(onValueChange).toHaveBeenCalledWith('care')
    // The owner of the value decides; the component did not move itself.
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
  })

  it('falls back to the first selectable tab when the value names no tab', () => {
    render(<Tabs items={ITEMS} label="Product details" defaultValue="dimensions" />)

    // A strip with nothing selected has no tab in the tab order and is unreachable.
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
  })
})
