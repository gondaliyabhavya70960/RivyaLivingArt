import { describe, expect, it } from 'vitest'

import { isInWindow, isLive, nextTransitionAt } from '@/lib/cms/windowing'

/**
 * The window's BOUNDARIES, which is the only part of it that can be wrong.
 *
 * A window is trivial in the middle and subtle at its edges, so every test here sits exactly on an
 * edge. The same boundaries are asserted in SQL by the RLS clause; if these two ever disagree, a
 * section is live to a visitor and not to the editor looking at it.
 */

const NOW = new Date('2026-09-08T12:00:00.000Z')
const iso = (s: string) => new Date(s).toISOString()

describe('isInWindow', () => {
  it('is open when both bounds are null', () => {
    expect(isInWindow({ publish_at: null, unpublish_at: null }, NOW)).toBe(true)
  })

  it('is open AT publish_at, not one moment after', () => {
    // Half-open at the lower bound. An editor scheduling 12:00 means live at 12:00.
    expect(isInWindow({ publish_at: iso('2026-09-08T12:00:00Z'), unpublish_at: null }, NOW)).toBe(
      true,
    )
  })

  it('is closed one millisecond before publish_at', () => {
    expect(
      isInWindow({ publish_at: iso('2026-09-08T12:00:00.001Z'), unpublish_at: null }, NOW),
    ).toBe(false)
  })

  it('is CLOSED at unpublish_at, not one moment after', () => {
    // The asymmetry that matters. Closed at the upper bound: a section set to unpublish at 12:00
    // is gone at 12:00. Inclusive here would leave an instant where a replacement and the thing it
    // replaces are both live.
    expect(isInWindow({ publish_at: null, unpublish_at: iso('2026-09-08T12:00:00Z') }, NOW)).toBe(
      false,
    )
  })

  it('is open one millisecond before unpublish_at', () => {
    expect(
      isInWindow({ publish_at: null, unpublish_at: iso('2026-09-08T12:00:00.001Z') }, NOW),
    ).toBe(true)
  })

  it('is open inside a two-sided window', () => {
    expect(
      isInWindow(
        { publish_at: iso('2026-09-08T11:00:00Z'), unpublish_at: iso('2026-09-08T13:00:00Z') },
        NOW,
      ),
    ).toBe(true)
  })
})

describe('isLive', () => {
  it('needs BOTH a PUBLISHED status and an open window', () => {
    const open = { publish_at: null, unpublish_at: null }
    expect(isLive({ ...open, status: 'PUBLISHED' }, NOW)).toBe(true)
    expect(isLive({ ...open, status: 'APPROVED' }, NOW)).toBe(false)
    expect(
      isLive(
        { status: 'PUBLISHED', publish_at: iso('2026-09-09T00:00:00Z'), unpublish_at: null },
        NOW,
      ),
    ).toBe(false)
  })

  it('is false for a DRAFT inside its window', () => {
    // A draft with a publish_at is not live, and the schedule cron does not promote it either —
    // scheduling must not become a way to skip review.
    expect(
      isLive({ status: 'DRAFT', publish_at: iso('2026-09-08T11:00:00Z'), unpublish_at: null }, NOW),
    ).toBe(false)
  })
})

describe('nextTransitionAt', () => {
  it('is null when nothing is scheduled', () => {
    expect(nextTransitionAt({ publish_at: null, unpublish_at: null }, NOW)).toBeNull()
  })

  it('is null once both bounds are in the past', () => {
    expect(
      nextTransitionAt(
        { publish_at: iso('2026-09-01T00:00:00Z'), unpublish_at: iso('2026-09-02T00:00:00Z') },
        NOW,
      ),
    ).toBeNull()
  })

  it('reports the future publish before the future unpublish', () => {
    const next = nextTransitionAt(
      { publish_at: iso('2026-09-08T13:00:00Z'), unpublish_at: iso('2026-09-08T14:00:00Z') },
      NOW,
    )
    expect(next?.toISOString()).toBe(iso('2026-09-08T13:00:00Z'))
  })

  it('reports the unpublish once the publish has passed', () => {
    const next = nextTransitionAt(
      { publish_at: iso('2026-09-08T11:00:00Z'), unpublish_at: iso('2026-09-08T14:00:00Z') },
      NOW,
    )
    expect(next?.toISOString()).toBe(iso('2026-09-08T14:00:00Z'))
  })
})
