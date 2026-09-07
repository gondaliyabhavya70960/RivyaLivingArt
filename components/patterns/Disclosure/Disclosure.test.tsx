import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Disclosure } from './index'

describe('Disclosure', () => {
  it('reports its expanded state and names the region it controls', async () => {
    render(
      <Disclosure label="Delivery and installation">
        <p>Crated, insured, and installed by our own team.</p>
      </Disclosure>,
    )
    const trigger = screen.getByRole('button', { name: 'Delivery and installation' })

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveAttribute('aria-controls')

    await userEvent.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const regionId = trigger.getAttribute('aria-controls')
    expect(regionId).not.toBeNull()
    expect(document.getElementById(regionId ?? '')).toHaveTextContent(
      'Crated, insured, and installed by our own team.',
    )
  })

  it('opens from Enter and from Space, and leaves focus on the trigger', async () => {
    render(
      <Disclosure label="Delivery and installation">
        <p>Crated, insured, and installed by our own team.</p>
      </Disclosure>,
    )
    const trigger = screen.getByRole('button', { name: 'Delivery and installation' })

    await userEvent.tab()
    expect(trigger).toHaveFocus()

    await userEvent.keyboard('{Enter}')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(trigger).toHaveFocus()

    await userEvent.keyboard('[Space]')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveFocus()
  })

  it('starts open when it is seeded open', () => {
    render(
      <Disclosure label="Contact" defaultOpen>
        <p>By appointment.</p>
      </Disclosure>,
    )

    expect(screen.getByRole('button', { name: 'Contact' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('reports the state it is being moved to and leaves a controlled disclosure alone', async () => {
    const onOpenChange = vi.fn()
    render(
      <Disclosure label="Materials" open={false} onOpenChange={onOpenChange}>
        <p>Black walnut and bio-resin.</p>
      </Disclosure>,
    )
    const trigger = screen.getByRole('button', { name: 'Materials' })

    await userEvent.click(trigger)

    expect(onOpenChange).toHaveBeenCalledWith(true)
    // The owner of the state decides; the component did not open itself.
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('is a landmark only when asked to be', async () => {
    const { rerender } = render(
      <Disclosure label="Materials" defaultOpen>
        <p>Black walnut and bio-resin.</p>
      </Disclosure>,
    )

    expect(screen.queryByRole('region', { name: 'Materials' })).not.toBeInTheDocument()

    rerender(
      <Disclosure label="Materials" defaultOpen landmark>
        <p>Black walnut and bio-resin.</p>
      </Disclosure>,
    )

    expect(screen.getByRole('region', { name: 'Materials' })).toBeInTheDocument()
  })

  it('keeps the collapsed content in the document but out of the accessibility tree', () => {
    render(
      <Disclosure label="Materials">
        <p>Black walnut and bio-resin.</p>
      </Disclosure>,
    )

    // Present for find-in-page (RC-204/RC-206), inert so nothing reads it or tabs into it.
    const trigger = screen.getByRole('button', { name: 'Materials' })
    const region = document.getElementById(trigger.getAttribute('aria-controls') ?? '')
    expect(region).toHaveTextContent('Black walnut and bio-resin.')
    expect(region).toHaveAttribute('inert')
  })
})
