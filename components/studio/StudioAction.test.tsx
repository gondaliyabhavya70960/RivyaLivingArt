import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { EmptyState } from './EmptyState'
import { ListPage } from './ListPage'
import { StudioActionAnchor, StudioActionButton, StudioActionLink } from './StudioAction'

/**
 * Phase B's shared list rhythm: the 44px control, the empty state's one next step, and the frame
 * that stops each screen inventing its own spacing.
 *
 * WHY THE HEIGHT IS ASSERTED AS A CLASS RATHER THAN MEASURED. jsdom has no layout — every element
 * reports a zero box — so `getBoundingClientRect().height` would pass on markup that renders 20px
 * tall in a browser. `min-h-11` is the token that produces 44px, and the class is the only honest
 * thing this harness can check. The measured version belongs in `tests/e2e/design-system.spec.ts`,
 * whose touch-target guard currently selects `button, input, select, textarea` and so would catch
 * `StudioActionButton` but not the two links: widening it needs a browser run.
 */

describe('StudioAction', () => {
  it('gives every variant the 44px row and Studio’s square corner', () => {
    render(
      <>
        <StudioActionLink href="/studio/catalog/products/new" label="New product" />
        <StudioActionButton label="Search" />
        <StudioActionAnchor href="/api/studio/inquiries/export" label="Export" />
      </>,
    )

    for (const name of ['New product', 'Search', 'Export']) {
      const control = screen.getByText(name).closest('a, button')
      expect(control).not.toBeNull()
      expect(control?.className).toContain('min-h-11')
      // A46's pill is the public register. A `rounded-full` control beside a data table reads as
      // marketing — §7's "public-cinematic mismatch", which is why this is not primitives/Button.
      expect(control?.className).toContain('rounded-sm')
      expect(control?.className).not.toContain('rounded-full')
    }
  })

  it('submits by default, because Studio’s forms work before hydration', () => {
    render(<StudioActionButton label="Apply" />)
    expect(screen.getByRole('button', { name: 'Apply' })).toHaveAttribute('type', 'submit')
  })

  it('leaves an export as a plain anchor so next/link cannot prefetch the download', () => {
    render(<StudioActionAnchor href="/api/studio/inquiries/export" label="Export" />)
    const anchor = screen.getByRole('link', { name: 'Export' })
    expect(anchor).toHaveAttribute('href', '/api/studio/inquiries/export')
  })
})

describe('EmptyState — the next step', () => {
  it('offers the CTA when a route and its words both arrive', () => {
    render(
      <EmptyState
        reason="empty"
        heading="No products yet"
        body="Nothing is seeded."
        actionHref="/studio/catalog/products/new"
        actionLabel="New product"
      />,
    )
    expect(screen.getByRole('link', { name: 'New product' })).toHaveAttribute(
      'href',
      '/studio/catalog/products/new',
    )
  })

  it('renders no half-configured control when only one half is given', () => {
    // An href with no words is a control a reader cannot use, and it would render without complaint.
    render(
      <EmptyState
        reason="empty"
        heading="No products yet"
        body="Nothing is seeded."
        actionHref="/studio/catalog/products/new"
      />,
    )
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('refuses a CTA on a failed read, whatever the caller passes', () => {
    /*
     * THE RULE THAT MATTERS MOST HERE. A failed query means nobody knows whether the list is
     * empty; "Create the first one" under a read that did not complete invites a duplicate of
     * something already there. Enforced in the component, not left to each caller.
     */
    render(
      <EmptyState
        reason="unreadable"
        heading="Could not be read"
        body="The query failed."
        actionHref="/studio/catalog/products/new"
        actionLabel="New product"
      />,
    )
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('prefers the typed CTA over a free-form action when both arrive', () => {
    render(
      <EmptyState
        reason="empty"
        heading="No products yet"
        body="Nothing is seeded."
        action={<button type="button">Legacy</button>}
        actionHref="/studio/catalog/products/new"
        actionLabel="New product"
      />,
    )
    expect(screen.getByRole('link', { name: 'New product' })).toBeInTheDocument()
    // Two next steps is the same defect as none.
    expect(screen.queryByRole('button', { name: 'Legacy' })).not.toBeInTheDocument()
  })
})

describe('ListPage', () => {
  it('renders no second h1, so heading navigation still lands on the page frame', () => {
    const { container } = render(
      <ListPage purpose="What this screen is for.">
        <table>
          <caption>Rows</caption>
          <tbody />
        </table>
      </ListPage>,
    )
    expect(container.querySelector('h1')).toBeNull()
  })

  it('omits the purpose line entirely when the route’s own name already says it', () => {
    const { container } = render(
      <ListPage>
        <p data-rows="">Rows</p>
      </ListPage>,
    )
    // Not an empty paragraph taking up rhythm — nothing at all.
    expect(container.querySelectorAll('p')).toHaveLength(1)
  })

  it('keeps the filter slot above the rows', () => {
    const { container } = render(
      <ListPage filters={<form method="get" data-filters="" />}>
        <p data-rows="">Rows</p>
      </ListPage>,
    )
    const filters = container.querySelector('[data-filters]')
    const rows = container.querySelector('[data-rows]')
    if (filters === null || rows === null) throw new Error('both slots must render')
    // `compareDocumentPosition` returns FOLLOWING (4) when `rows` comes after `filters`.
    expect(filters.compareDocumentPosition(rows) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })
})
