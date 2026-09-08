import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ActorChip } from './ActorChip'
import { EmptyState } from './EmptyState'
import { PermissionGate } from './PermissionGate'
import { RelativeTime } from './RelativeTime'
import { StatCard } from './StatCard'
import { StatusPill, VerificationPill } from './StatusPill'

/**
 * The Studio primitives, tested for the one property each exists to guarantee.
 *
 * Not "does it render" — every one of these renders. What is worth asserting is the distinction
 * each was built to preserve, because every one of them fails by QUIETLY COLLAPSING into a
 * plausible wrong answer: an unavailable metric into `0`, a failed read into "nothing here", a
 * system write into a named person, a future timestamp into "in 2 hours".
 */

describe('StatCard', () => {
  it('shows a number when there is one', () => {
    render(<StatCard label="Products" value={42} unavailableLabel="From" unreadableLabel="Nope" />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('never renders 0 for a table that does not exist yet', () => {
    // THE REGRESSION THIS EXISTS FOR. "Open enquiries: 0" reads as "nobody has enquired" when the
    // truth is that enquiries do not exist until Phase 20 — a fabricated business fact (D10).
    render(
      <StatCard
        label="Open enquiries"
        value={undefined}
        unavailableFromPhase={20}
        unavailableLabel="Available from phase"
        unreadableLabel="Could not be read"
      />,
    )
    expect(screen.getByText(/Available from phase\s*20/)).toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('distinguishes a failed read from a real zero', () => {
    const { rerender } = render(
      <StatCard
        label="Products"
        value={null}
        unavailableLabel="From"
        unreadableLabel="Could not be read"
      />,
    )
    expect(screen.getByText('Could not be read')).toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()

    rerender(
      <StatCard
        label="Products"
        value={0}
        unavailableLabel="From"
        unreadableLabel="Could not be read"
      />,
    )
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('pads the phase number so it matches how phases are written everywhere else', () => {
    render(
      <StatCard
        label="Higgsfield"
        value={undefined}
        unavailableFromPhase={7}
        unavailableLabel="From"
        unreadableLabel="x"
      />,
    )
    expect(screen.getByText(/From\s*07/)).toBeInTheDocument()
  })
})

describe('StatusPill', () => {
  it('renders the state as a word, not only a colour', () => {
    // WCAG 1.4.1: colour alone is never the signal. A greyscale screenshot must still be readable.
    render(<StatusPill status="PUBLISHED" />)
    expect(screen.getByText('Published')).toBeInTheDocument()
  })

  it('makes OWNER_VERIFICATION_REQUIRED visible rather than quiet', () => {
    // It is the D10 gate — the one state an owner must act on. Rendering it as neutral grey would
    // make it the least noticeable thing on the row.
    const { container } = render(<VerificationPill verification="OWNER_VERIFICATION_REQUIRED" />)
    expect(screen.getByText('Owner verification required')).toBeInTheDocument()
    expect(container.querySelector('[class*="warning"]')).toBeTruthy()
  })

  it('renders nothing for NOT_REQUIRED, which is every ordinary row', () => {
    const { container } = render(<VerificationPill verification="NOT_REQUIRED" />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('RelativeTime', () => {
  const now = new Date('2026-09-08T12:00:00+05:30')

  it('says "just now" rather than a number that will silently become wrong', () => {
    // It renders on the server and never ticks, so "3 minutes ago" is false within a minute.
    render(<RelativeTime value="2026-09-08T11:35:00+05:30" now={now} />)
    expect(screen.getByText('Just now')).toBeInTheDocument()
  })

  it('counts hours, then days, then falls back to a date', () => {
    const { rerender } = render(<RelativeTime value="2026-09-08T07:00:00+05:30" now={now} />)
    expect(screen.getByText('5h ago')).toBeInTheDocument()

    rerender(<RelativeTime value="2026-09-05T12:00:00+05:30" now={now} />)
    expect(screen.getByText('3d ago')).toBeInTheDocument()

    rerender(<RelativeTime value="2026-07-01T12:00:00+05:30" now={now} />)
    expect(screen.queryByText(/ago/)).not.toBeInTheDocument()
  })

  it('always carries the exact instant, whatever it displays', () => {
    render(<RelativeTime value="2026-09-08T07:00:00+05:30" now={now} />)
    const time = screen.getByText('5h ago')
    expect(time).toHaveAttribute('datetime', '2026-09-08T07:00:00+05:30')
    expect(time).toHaveAttribute('title')
  })

  it('does not claim a future timestamp is in the past', () => {
    // A clock problem should look like one, not like "in 2 hours".
    render(<RelativeTime value="2026-09-09T12:00:00+05:30" now={now} />)
    expect(screen.queryByText(/ago/)).not.toBeInTheDocument()
  })

  it('shows an unparseable value rather than "Invalid Date"', () => {
    render(<RelativeTime value="not-a-date" now={now} />)
    expect(screen.getByText('not-a-date')).toBeInTheDocument()
  })
})

describe('ActorChip', () => {
  it('calls a null actor "System", not "Unknown"', () => {
    // A null actor is the seed runner or a migration (DATA_MODEL §1.6), not a mystery person.
    // "Unknown" would send somebody looking for a colleague who does not exist.
    render(<ActorChip role={null} />)
    expect(screen.getByText('System')).toBeInTheDocument()
  })

  it('shows the role when there is no name', () => {
    render(<ActorChip role="merchandiser" />)
    expect(screen.getByText('merchandiser')).toBeInTheDocument()
  })

  it('shows both when it has both', () => {
    render(<ActorChip role="editor" name="Asha" />)
    expect(screen.getByText('Asha · editor')).toBeInTheDocument()
  })
})

describe('EmptyState', () => {
  it('does not soften a failed read', () => {
    // The one emptiness the reader must not skim past — everything else on the page is still
    // rendering normally around it.
    render(<EmptyState reason="unreadable" heading="Could not be read" body="The query failed." />)
    expect(screen.getByText('Could not be read')).toBeInTheDocument()
    expect(screen.getByText('The query failed.')).toBeInTheDocument()
  })

  it('never says "coming soon"', () => {
    // SEED §55. A promise of a date nobody has set.
    const { container } = render(
      <EmptyState reason="empty" heading="No products yet" body="Create one to begin." />,
    )
    expect(container.textContent?.toLowerCase()).not.toContain('coming soon')
  })
})

describe('PermissionGate', () => {
  it('hides a control the role cannot use', () => {
    render(
      <PermissionGate role="viewer" permission="catalog.write">
        <button type="button">Publish</button>
      </PermissionGate>,
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows it to a role that can', () => {
    render(
      <PermissionGate role="merchandiser" permission="catalog.write">
        <button type="button">Publish</button>
      </PermissionGate>,
    )
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument()
  })

  it('hides everything from an unauthenticated reader', () => {
    render(
      <PermissionGate role={null} permission="catalog.read">
        <button type="button">Anything</button>
      </PermissionGate>,
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
