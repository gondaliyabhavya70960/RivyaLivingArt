import { describe, expect, it } from 'vitest'

import {
  BACKOFF_MAX_EXPONENT,
  CIRCUIT_FAILURE_THRESHOLD,
  CIRCUIT_OPEN_MINUTES,
  MAX_ATTEMPTS,
  MAX_RETRY_AFTER_MS,
  backoffMs,
  failureStateAfter,
  isBackoffStatus,
  isCircuitOpen,
  leaseBudget,
  nextAttemptAt,
  nextSourceFetchAt,
  retryAfterMs,
} from '@/lib/scraper/core/rate-limit'

/**
 * The politeness arithmetic.
 *
 * EVERY TEST HERE IS ABOUT NOT MAKING A REQUEST. There is nothing to assert about the happy path —
 * a fetch that is due happens — so the whole file is about the cases where something must wait,
 * back off, or stop, and about the ways a bug in each would produce MORE traffic rather than less.
 */

/** A pinned random, so a jittered value is a value rather than a range. */
const half = () => 0.5

describe('the backoff ladder', () => {
  it('doubles per attempt, from one minute', () => {
    expect(backoffMs(0, half)).toBe(60_000)
    expect(backoffMs(1, half)).toBe(120_000)
    expect(backoffMs(3, half)).toBe(480_000)
  })

  it('stops doubling at 2^5, so a stuck item does not wait a month', () => {
    const ceiling = backoffMs(BACKOFF_MAX_EXPONENT, half)
    expect(backoffMs(20, half)).toBe(ceiling)
  })

  it('spreads by ±25%, which is what stops a thundering herd', () => {
    // TWENTY ITEMS THAT FAILED TOGETHER MUST NOT RETRY TOGETHER. Without jitter, a host that
    // returned one 503 receives twenty simultaneous requests exactly two minutes later.
    const low = backoffMs(1, () => 0)
    const high = backoffMs(1, () => 1)
    expect(low).toBe(90_000)
    expect(high).toBe(150_000)
    expect(high).toBeGreaterThan(low)
  })

  it('treats a negative attempt as the first one', () => {
    expect(backoffMs(-3, half)).toBe(backoffMs(0, half))
  })
})

describe('Retry-After', () => {
  it('reads delta-seconds', () => {
    expect(retryAfterMs('30')).toBe(30_000)
  })

  it('reads an HTTP date', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    expect(retryAfterMs('Thu, 01 Jan 2026 00:01:00 GMT', now)).toBe(60_000)
  })

  it('clamps a date in the past to zero rather than going negative', () => {
    const now = new Date('2026-01-01T00:05:00Z')
    // A NEGATIVE DELAY WOULD MOVE not_before_at BACKWARDS, making an item more eager after a
    // rate-limit response than before it.
    expect(retryAfterMs('Thu, 01 Jan 2026 00:00:00 GMT', now)).toBe(0)
  })

  it('ignores an absent, empty or unreadable header', () => {
    expect(retryAfterMs(null)).toBeNull()
    expect(retryAfterMs('  ')).toBeNull()
    expect(retryAfterMs('later')).toBeNull()
    expect(retryAfterMs('-5')).toBeNull()
  })

  it('caps a preposterous value at six hours', () => {
    expect(retryAfterMs('999999')).toBe(MAX_RETRY_AFTER_MS)
  })

  it('recognises only 429 and 503 as "come back later"', () => {
    expect(isBackoffStatus(429)).toBe(true)
    expect(isBackoffStatus(503)).toBe(true)
    expect(isBackoffStatus(500)).toBe(false)
    expect(isBackoffStatus(404)).toBe(false)
  })
})

describe('the next attempt', () => {
  const now = new Date('2026-01-01T00:00:00Z')

  it('honours Retry-After when it is longer than the ladder', () => {
    const at = nextAttemptAt({ attempt: 0, retryAfterMs: 300_000, now, random: half })
    expect(at.getTime() - now.getTime()).toBe(300_000)
  })

  it('keeps the ladder when Retry-After is shorter', () => {
    // A HOST SAYING "30 SECONDS" ON THE FOURTH CONSECUTIVE FAILURE has not seen the first three.
    // Honouring it would be us overriding our own caution with a number from the struggling server.
    const at = nextAttemptAt({ attempt: 4, retryAfterMs: 30_000, now, random: half })
    expect(at.getTime() - now.getTime()).toBe(backoffMs(4, half))
  })
})

describe('the circuit breaker', () => {
  const now = new Date('2026-01-01T00:00:00Z')

  it('counts up to the threshold without opening', () => {
    const state = failureStateAfter({ succeeded: false, consecutiveFailures: 3, now })
    expect(state.consecutiveFailures).toBe(4)
    expect(state.circuitOpenUntil).toBeNull()
  })

  it('opens on the fifth consecutive failure', () => {
    const state = failureStateAfter({
      succeeded: false,
      consecutiveFailures: CIRCUIT_FAILURE_THRESHOLD - 1,
      now,
    })
    expect(state.consecutiveFailures).toBe(CIRCUIT_FAILURE_THRESHOLD)
    expect(state.circuitOpenUntil?.getTime()).toBe(now.getTime() + CIRCUIT_OPEN_MINUTES * 60_000)
  })

  it('resets to zero on a success, because "consecutive" means consecutive', () => {
    // A SOURCE THAT FAILS FOUR TIMES, SUCCEEDS, THEN FAILS FOUR MORE has not failed nine times in
    // a row and must not be disabled as though it had.
    const state = failureStateAfter({ succeeded: true, consecutiveFailures: 4, now })
    expect(state.consecutiveFailures).toBe(0)
    expect(state.circuitOpenUntil).toBeNull()
  })

  it('reads an open circuit as open only while it is in the future', () => {
    const at = new Date('2026-01-01T00:10:00Z')
    expect(isCircuitOpen(at.toISOString(), now)).toBe(true)
    expect(isCircuitOpen(now.toISOString(), at)).toBe(false)
    expect(isCircuitOpen(null, now)).toBe(false)
  })
})

describe('the lease budget', () => {
  it('is the concurrency minus what is already in flight', () => {
    expect(leaseBudget(3, 1)).toBe(2)
    expect(leaseBudget(1, 1)).toBe(0)
  })

  it('never exceeds the concurrency, even if the in-flight count went negative', () => {
    // A DOUBLE RELEASE would otherwise produce a budget LARGER than the configured concurrency —
    // the rate limit inverted by a bookkeeping slip.
    expect(leaseBudget(2, -5)).toBe(2)
  })

  it('never goes negative', () => {
    expect(leaseBudget(1, 4)).toBe(0)
  })
})

describe('the source clock', () => {
  it('moves forward by the delay', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    expect(nextSourceFetchAt(3000, now).getTime()).toBe(now.getTime() + 3000)
  })
})

describe('the attempt ceiling', () => {
  it('is six, which bounds a permanently broken URL', () => {
    expect(MAX_ATTEMPTS).toBe(6)
  })
})
