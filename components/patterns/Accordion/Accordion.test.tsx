import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Accordion, type AccordionItem } from './index'

const ITEMS: readonly AccordionItem[] = [
  {
    id: 'lead-times',
    header: 'How long does a commission take?',
    content: 'Between eleven and sixteen weeks, depending on the slab.',
  },
  {
    id: 'materials',
    header: 'What materials do you work in?',
    content: 'Black walnut, English oak, and bio-resin.',
  },
  {
    id: 'shipping',
    header: 'Do you ship internationally?',
    content: 'Yes, crated and insured.',
  },
]

describe('Accordion', () => {
  it('renders each header as a button inside the declared heading level', () => {
    render(<Accordion items={ITEMS} headingLevel={3} />)

    expect(
      screen.getByRole('heading', { level: 3, name: 'Do you ship internationally?' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Do you ship internationally?' })).toBeInTheDocument()
  })

  it('reports its expanded state and names the region it controls', async () => {
    render(<Accordion items={ITEMS} headingLevel={3} />)
    const header = screen.getByRole('button', { name: 'What materials do you work in?' })

    expect(header).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(header)

    expect(header).toHaveAttribute('aria-expanded', 'true')
    const region = screen.getByRole('region', { name: 'What materials do you work in?' })
    expect(region).toHaveTextContent('Black walnut, English oak, and bio-resin.')
    expect(header.getAttribute('aria-controls')).toBe(region.getAttribute('id'))
  })

  it('leaves focus on the header after a toggle', async () => {
    render(<Accordion items={ITEMS} headingLevel={3} />)
    const header = screen.getByRole('button', { name: 'How long does a commission take?' })

    await userEvent.click(header)
    expect(header).toHaveFocus()

    await userEvent.keyboard('{Enter}')
    expect(header).toHaveAttribute('aria-expanded', 'false')
    expect(header).toHaveFocus()
  })

  it('closes the open panel when another opens in single mode', async () => {
    render(<Accordion items={ITEMS} headingLevel={3} defaultOpenIds={['lead-times']} />)

    await userEvent.click(screen.getByRole('button', { name: 'What materials do you work in?' }))

    expect(
      screen.getByRole('button', { name: 'How long does a commission take?' }),
    ).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'What materials do you work in?' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('keeps every opened panel open in multiple mode', async () => {
    render(<Accordion items={ITEMS} headingLevel={3} mode="multiple" />)

    await userEvent.click(screen.getByRole('button', { name: 'How long does a commission take?' }))
    await userEvent.click(screen.getByRole('button', { name: 'Do you ship internationally?' }))

    expect(
      screen.getByRole('button', { name: 'How long does a commission take?' }),
    ).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Do you ship internationally?' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('honours only the first seeded id in single mode', () => {
    render(<Accordion items={ITEMS} headingLevel={3} defaultOpenIds={['lead-times', 'shipping']} />)

    expect(
      screen.getByRole('button', { name: 'How long does a commission take?' }),
    ).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Do you ship internationally?' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('moves between headers with the arrow keys and jumps with Home and End', async () => {
    render(<Accordion items={ITEMS} headingLevel={3} />)

    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'How long does a commission take?' })).toHaveFocus()

    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('button', { name: 'What materials do you work in?' })).toHaveFocus()

    await userEvent.keyboard('{End}')
    expect(screen.getByRole('button', { name: 'Do you ship internationally?' })).toHaveFocus()

    // Wrapping: past the last header is the first one again.
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('button', { name: 'How long does a commission take?' })).toHaveFocus()

    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getByRole('button', { name: 'Do you ship internationally?' })).toHaveFocus()

    await userEvent.keyboard('{Home}')
    expect(screen.getByRole('button', { name: 'How long does a commission take?' })).toHaveFocus()
  })

  it('never toggles a disabled header', async () => {
    const items: readonly AccordionItem[] = [
      { id: 'a', header: 'Available now', content: 'One' },
      { id: 'b', header: 'Sold out', content: 'Two', disabled: true },
    ]
    render(<Accordion items={items} headingLevel={3} />)
    const disabled = screen.getByRole('button', { name: 'Sold out' })

    expect(disabled).toBeDisabled()
    await userEvent.click(disabled)
    expect(disabled).toHaveAttribute('aria-expanded', 'false')
  })

  it('reports the open set and leaves a controlled accordion alone', async () => {
    const onOpenChange = vi.fn()
    render(
      <Accordion
        items={ITEMS}
        headingLevel={3}
        mode="multiple"
        openIds={['lead-times']}
        onOpenChange={onOpenChange}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Do you ship internationally?' }))

    expect(onOpenChange).toHaveBeenCalledWith(['lead-times', 'shipping'])
    // The owner of the state decides; the component did not open itself.
    expect(screen.getByRole('button', { name: 'Do you ship internationally?' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('drops the landmark role once the panels would proliferate landmarks', async () => {
    const many: readonly AccordionItem[] = Array.from({ length: 7 }, (_, index) => ({
      id: `q${index}`,
      header: `Question ${index}`,
      content: `Answer ${index}`,
    }))
    render(<Accordion items={many} headingLevel={3} mode="multiple" />)

    await userEvent.click(screen.getByRole('button', { name: 'Question 0' }))

    // Still expanded and still labelled — only the landmark role is withheld, per APG.
    expect(screen.getByRole('button', { name: 'Question 0' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.queryByRole('region', { name: 'Question 0' })).not.toBeInTheDocument()
  })
})
