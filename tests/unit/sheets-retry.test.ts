import { describe, expect, it } from 'vitest'

import {
  RETRY_DEFAULTS,
  RetryableUpstream,
  backoffDelay,
  isRetryableStatus,
  parseRetryAfter,
  withRetry,
} from '@/lib/sheets/retry'
import { SheetsAuthError } from '@/lib/sheets/errors'

/**
 * Backoff with a stubbed clock — Phase 36, verification 2. Five attempts, base 500 ms, cap 30 s,
 * `Retry-After` honoured, and 401/403 never retried.
 */

const noJitter = { random: () => 0 }

describe('backoff', () => {
  it('doubles from the base and caps', () => {
    const delays = [1, 2, 3, 4, 5, 6, 7, 8].map((attempt) => backoffDelay(attempt, null, noJitter))
    expect(delays).toEqual([500, 1000, 2000, 4000, 8000, 16000, 30000, 30000])
  })

  it('adds at most one second of jitter', () => {
    expect(backoffDelay(1, null, { random: () => 0.999 })).toBeLessThanOrEqual(500 + 500)
    expect(backoffDelay(4, null, { random: () => 0.999 })).toBeLessThanOrEqual(4000 + 1000)
  })

  it('honours Retry-After, capped', () => {
    expect(backoffDelay(1, 7000, noJitter)).toBe(7000)
    expect(backoffDelay(1, 90_000, noJitter)).toBe(RETRY_DEFAULTS.capMs)
    expect(parseRetryAfter('3', 0)).toBe(3000)
    expect(parseRetryAfter(new Date(10_000).toUTCString(), 0)).toBe(10_000)
    expect(parseRetryAfter('soon', 0)).toBeNull()
    expect(parseRetryAfter(null, 0)).toBeNull()
  })

  it('retries 429 and 5xx only', () => {
    expect(isRetryableStatus(429)).toBe(true)
    expect(isRetryableStatus(503)).toBe(true)
    expect(isRetryableStatus(401)).toBe(false)
    expect(isRetryableStatus(403)).toBe(false)
    expect(isRetryableStatus(400)).toBe(false)
  })
})

describe('withRetry', () => {
  it('produces the expected delay sequence and gives up after five attempts', async () => {
    const slept: number[] = []
    const sleep = async (ms: number): Promise<void> => {
      slept.push(ms)
    }
    let calls = 0
    await expect(
      withRetry(
        async () => {
          calls += 1
          throw new RetryableUpstream(503, null)
        },
        { sleep, random: () => 0 },
      ),
    ).rejects.toBeInstanceOf(RetryableUpstream)
    expect(calls).toBe(5)
    expect(slept).toEqual([500, 1000, 2000, 4000])
  })

  it('returns the value and the attempt count once the upstream recovers', async () => {
    let calls = 0
    const result = await withRetry(
      async () => {
        calls += 1
        if (calls < 3) throw new RetryableUpstream(429, 100)
        return 'ok'
      },
      { sleep: async () => undefined },
    )
    expect(result).toEqual({ value: 'ok', attempts: 3 })
  })

  it('never retries an auth refusal', async () => {
    let calls = 0
    await expect(
      withRetry(
        async () => {
          calls += 1
          throw new SheetsAuthError(403)
        },
        { sleep: async () => undefined },
      ),
    ).rejects.toBeInstanceOf(SheetsAuthError)
    expect(calls).toBe(1)
  })
})
