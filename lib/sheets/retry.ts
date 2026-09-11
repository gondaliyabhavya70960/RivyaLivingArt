/**
 * Bounded retry with exponential backoff and jitter — Phase 36.
 *
 * FIVE ATTEMPTS, BASE 500 ms, CAP 30 s, `Retry-After` HONOURED, AND 401/403 NEVER RETRIED. A
 * credentials or sharing problem does not fix itself in thirty seconds; retrying it would turn a
 * one-line banner into a five-minute stall. Only a rate limit (429) or a server error (5xx) is
 * retried, and the caller says which by throwing `RetryableUpstream`; anything else propagates on
 * the first attempt.
 *
 * INJECTABLE CLOCK AND RANDOM, so `sheets-retry.test.ts` asserts the exact delay sequence.
 */

export class RetryableUpstream extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterMs: number | null,
  ) {
    super(`upstream ${String(status)}`)
    this.name = 'RetryableUpstream'
  }
}

export interface RetryOptions {
  readonly attempts?: number
  readonly baseMs?: number
  readonly capMs?: number
  readonly sleep?: (ms: number) => Promise<void>
  readonly random?: () => number
  readonly onRetry?: (attempt: number, delayMs: number, status: number) => void
}

export const RETRY_DEFAULTS = { attempts: 5, baseMs: 500, capMs: 30_000 } as const

export function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599)
}

/**
 * `Retry-After` as milliseconds: an integer number of seconds, or an HTTP date. Null when absent
 * or unreadable — the backoff then decides.
 */
export function parseRetryAfter(header: string | null, nowMs: number): number | null {
  if (header === null || header.trim() === '') return null
  const seconds = Number(header)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000)
  const at = Date.parse(header)
  if (Number.isNaN(at)) return null
  return Math.max(0, at - nowMs)
}

/**
 * The delay before retry number `attempt` (1 = after the first failure).
 *
 * `Retry-After` wins when present, capped. Otherwise base × 2^(attempt−1), capped, plus up to one
 * second of jitter so a fleet of runs does not retry in lockstep.
 */
export function backoffDelay(
  attempt: number,
  retryAfterMs: number | null,
  options: RetryOptions = {},
): number {
  const baseMs = options.baseMs ?? RETRY_DEFAULTS.baseMs
  const capMs = options.capMs ?? RETRY_DEFAULTS.capMs
  if (retryAfterMs !== null) return Math.min(capMs, Math.max(0, retryAfterMs))
  const exponential = Math.min(capMs, baseMs * 2 ** Math.max(0, attempt - 1))
  const jitter = Math.floor((options.random ?? Math.random)() * Math.min(1000, exponential))
  return Math.min(capMs, exponential + jitter)
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

/**
 * Run `fn` until it returns, throws a non-retryable error, or the attempts run out. Returns the
 * value and how many attempts it took; on exhaustion rethrows the last `RetryableUpstream`.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<{ readonly value: T; readonly attempts: number }> {
  const attempts = options.attempts ?? RETRY_DEFAULTS.attempts
  const sleep = options.sleep ?? defaultSleep
  let last: RetryableUpstream | null = null
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const value = await fn(attempt)
      return { value, attempts: attempt }
    } catch (error) {
      if (!(error instanceof RetryableUpstream)) throw error
      last = error
      if (attempt === attempts) break
      const delay = backoffDelay(attempt, error.retryAfterMs, options)
      options.onRetry?.(attempt, delay, error.status)
      await sleep(delay)
    }
  }
  throw last ?? new Error('retry exhausted')
}
