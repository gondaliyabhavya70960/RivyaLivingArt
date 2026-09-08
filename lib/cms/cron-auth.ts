import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Authenticating a Vercel Cron invocation.
 *
 * EXTRACTED FROM THE ROUTE SO IT CAN BE TESTED. A comparison that is meant to be constant-time and
 * a check that is meant to fail closed are exactly the two things worth asserting, and neither is
 * reachable through a route handler without a running server.
 */

/**
 * Constant-time comparison of two secrets.
 *
 * BOTH SIDES ARE HASHED FIRST, and that is not belt-and-braces. `timingSafeEqual` THROWS when its
 * two buffers differ in length — so comparing raw values would turn a wrong-length guess into an
 * exception and a right-length one into a comparison, and the difference between a 500 and a 401
 * tells an attacker the exact length of the secret. Hashing makes both sides 32 bytes always, so
 * length stops being observable and the comparison itself is the only signal.
 */
export function secretMatches(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided, 'utf8').digest()
  const b = createHash('sha256').update(expected, 'utf8').digest()
  return timingSafeEqual(a, b)
}

/** What went wrong, for the route to turn into a status code. Never returned to the caller. */
export type CronAuthResult = 'OK' | 'NOT_CONFIGURED' | 'UNAUTHORISED'

/**
 * Is this request a genuine cron invocation?
 *
 * FAILS CLOSED ON A MISSING SECRET. `NOT_CONFIGURED` is distinct from `UNAUTHORISED` so the route
 * can answer 503 rather than 401 — a deploy that forgot the variable is an operations problem, not
 * a rejected caller, and the two need different alerts. What it must never do is treat "no secret
 * configured" as "no check required": that turns one missing variable into an open endpoint that
 * publishes content to the public site.
 *
 * THE HEADER NAME AND SCHEME ARE VERCEL'S, NOT OURS. It sends `Authorization: Bearer <value>`, and
 * only for a variable named exactly `CRON_SECRET`.
 */
export function checkCronAuth(request: Request, expected: string | undefined): CronAuthResult {
  if (expected === undefined || expected === '') return 'NOT_CONFIGURED'

  const header = request.headers.get('authorization') ?? ''
  const prefix = 'Bearer '
  if (!header.startsWith(prefix)) return 'UNAUTHORISED'

  return secretMatches(header.slice(prefix.length), expected) ? 'OK' : 'UNAUTHORISED'
}
