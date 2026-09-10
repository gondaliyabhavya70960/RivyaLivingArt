/**
 * The politeness arithmetic: how long to wait, and when to stop entirely.
 *
 * PURE FUNCTIONS, ON PURPOSE. Everything here takes numbers and dates and returns numbers and
 * dates. Nothing fetches, nothing sleeps, nothing reads the clock except through an argument with
 * a default. That is what makes the backoff ladder, the `Retry-After` handling and the circuit
 * breaker testable without a network, a database or a timer — and these are exactly the rules that
 * must be right, because they are what stands between a misconfigured source and somebody else's
 * server falling over.
 *
 * THE ENFORCEMENT IS NOT HERE. It is in the lease query, which reads `not_before_at` on the item
 * and `next_fetch_not_before` on the source and simply does not claim work that is not due. This
 * module computes the values that query compares against. A `sleep()` before each fetch would be
 * the obvious alternative and is wrong twice over: it burns a sixty-second function doing nothing,
 * and it loses the delay entirely when the function is terminated mid-wait — which on a
 * short-lived runtime is not an edge case but the normal end of every invocation.
 */

/** Five consecutive failures open the circuit. FEAT §23's number. */
export const CIRCUIT_FAILURE_THRESHOLD = 5

/** How long a circuit stays open once it trips. */
export const CIRCUIT_OPEN_MINUTES = 30

/** The backoff ladder, in minutes: 2⁰ … 2⁵. */
export const BACKOFF_MAX_EXPONENT = 5

/** Beyond this many attempts an item is FAILED rather than retried forever. */
export const MAX_ATTEMPTS = 6

/**
 * Exponential backoff with jitter, in milliseconds.
 *
 * JITTER IS NOT DECORATION. Without it, twenty items that failed together retry together, so a
 * host that returned one 503 receives twenty simultaneous requests exactly two minutes later —
 * the thundering herd, aimed at a server that has already said it is struggling. The ±25% spread
 * turns that back into a trickle.
 *
 * `random` IS AN ARGUMENT so a test can pin it. A test that asserts on a jittered value with a
 * real `Math.random` either flakes or asserts on a range so wide it proves nothing.
 */
export function backoffMs(attempt: number, random: () => number = Math.random): number {
  const exponent = Math.min(Math.max(attempt, 0), BACKOFF_MAX_EXPONENT)
  const baseMs = 2 ** exponent * 60_000
  const jitter = 0.75 + random() * 0.5
  return Math.round(baseMs * jitter)
}

/**
 * `Retry-After`, in milliseconds, or null if the header said nothing we can act on.
 *
 * TWO FORMATS, BOTH IN THE STANDARD: delta-seconds, and an HTTP date. Sites serve both, and a
 * parser that handles only the first silently ignores the second — which means ignoring a host
 * that has just told us, precisely, when to come back.
 *
 * A DATE IN THE PAST YIELDS ZERO, NOT A NEGATIVE. A negative delay would move `not_before_at`
 * backwards and make an item MORE eager after a rate-limit response than before it.
 */
export function retryAfterMs(header: string | null, now = new Date()): number | null {
  if (header === null) return null
  const value = header.trim()
  if (value === '') return null

  const seconds = Number(value)
  if (Number.isFinite(seconds)) {
    if (seconds < 0) return null
    return Math.min(Math.round(seconds * 1000), MAX_RETRY_AFTER_MS)
  }

  const when = Date.parse(value)
  if (Number.isNaN(when)) return null
  return Math.min(Math.max(when - now.getTime(), 0), MAX_RETRY_AFTER_MS)
}

/**
 * The longest `Retry-After` this repository will honour, in milliseconds — six hours.
 *
 * A host asking for longer than that is, for practical purposes, asking Rivya not to come back
 * today, and the run should end rather than hold a lease into tomorrow. The cap bounds the damage
 * a malformed or hostile header can do to the queue; the source's circuit breaker is the control
 * that handles a host which really is unavailable for a long time.
 */
export const MAX_RETRY_AFTER_MS = 6 * 60 * 60 * 1000

/** Does an HTTP status mean "come back later" rather than "this failed"? */
export function isBackoffStatus(status: number): boolean {
  return status === 429 || status === 503
}

/**
 * When may this item next be attempted, after a response?
 *
 * `Retry-After` WINS OVER THE LADDER WHEN IT IS LONGER, and the ladder wins when it is longer.
 * A host that says "30 seconds" on the fourth consecutive failure has not seen the previous three;
 * honouring 30 s there would retry sixteen minutes earlier than our own backoff had decided, which
 * is us overriding our own caution with a number supplied by the server we are struggling with.
 */
export function nextAttemptAt(input: {
  readonly attempt: number
  readonly retryAfterMs: number | null
  readonly now?: Date
  readonly random?: () => number
}): Date {
  const now = input.now ?? new Date()
  const ladder = backoffMs(input.attempt, input.random ?? Math.random)
  const wait = Math.max(ladder, input.retryAfterMs ?? 0)
  return new Date(now.getTime() + wait)
}

/** Where the next request to this source may earliest be made, after a successful fetch. */
export function nextSourceFetchAt(delayMs: number, now = new Date()): Date {
  return new Date(now.getTime() + delayMs)
}

/**
 * The source's failure counters after one outcome.
 *
 * A SUCCESS RESETS THE COUNT TO ZERO AND CLOSES THE CIRCUIT. "Five consecutive failures" means
 * consecutive; a source that fails four times, succeeds, then fails four more has not failed nine
 * times in a row and must not be disabled as though it had.
 */
export function failureStateAfter(input: {
  readonly succeeded: boolean
  readonly consecutiveFailures: number
  readonly now?: Date
}): { consecutiveFailures: number; circuitOpenUntil: Date | null } {
  if (input.succeeded) return { consecutiveFailures: 0, circuitOpenUntil: null }

  const now = input.now ?? new Date()
  const failures = input.consecutiveFailures + 1
  if (failures < CIRCUIT_FAILURE_THRESHOLD) {
    return { consecutiveFailures: failures, circuitOpenUntil: null }
  }
  return {
    consecutiveFailures: failures,
    circuitOpenUntil: new Date(now.getTime() + CIRCUIT_OPEN_MINUTES * 60_000),
  }
}

/** Is this source's circuit currently open — that is, is it to be left alone? */
export function isCircuitOpen(circuitOpenUntil: string | null, now = new Date()): boolean {
  if (circuitOpenUntil === null) return false
  return new Date(circuitOpenUntil) > now
}

/**
 * How many items may be leased for this source right now.
 *
 * NEVER NEGATIVE, which is not a defensive nicety: `in_flight_count` is decremented on release,
 * and a release that runs twice after a retried invocation would otherwise produce a negative
 * count and a lease budget LARGER than the configured concurrency — the rate limit quietly
 * inverted by a bookkeeping slip.
 */
export function leaseBudget(concurrency: number, inFlight: number): number {
  return Math.max(0, concurrency - Math.max(0, inFlight))
}
