import { NextResponse } from 'next/server'

import { isSameOrigin } from '@/lib/security/origin'
import { bucketKey, callerAddress, consume, type RateWindow } from '@/lib/security/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { insertVitalsSample } from '@/lib/supabase/repositories/web-vitals'
import { vitalsSampleSchema } from '@/lib/supabase/schemas/vitals'

/**
 * The Core Web Vitals beacon — Phase 40.
 *
 * `components/patterns/VitalsReporter` posts one small JSON body per metric, for one page view in
 * ten, through `navigator.sendBeacon`. This handler validates it, rate-limits the caller and
 * inserts as the service role.
 *
 * THE SECOND UNAUTHENTICATED WRITE PATH ON THE SITE, and it is built like the first
 * (`/api/inquiries/upload-sign`) for the same reason: there is nobody to authenticate. D1 forbids
 * customer accounts, so the visitor whose browser measured the paint is anonymous and must stay
 * that way. What keeps this from being an open write into the database is the shape of what it
 * will accept:
 *
 *   1. SAME-ORIGIN, from `Origin` or `Referer`, before anything else runs.
 *   2. RATE LIMIT, per hashed address, BEFORE THE BODY IS READ — so a malformed flood costs the
 *      sender exactly what a well-formed one does. `consume()` fails closed.
 *   3. ZOD, `.strict()`. Eight declared fields and nothing else. There is no field here a caller
 *      can use to steer anything, and an extra key is a 400 rather than a silent drop — which is
 *      the difference between "we ignore identifiers" and "we refuse them".
 *   4. THE TABLE ITSELF has no column an identifier could land in (`0380`).
 *
 * IT ANSWERS 204 AND SAYS NOTHING. `sendBeacon` discards the response and the page is usually gone
 * by the time it arrives, so a body would be bytes nobody reads. A refusal is a status code for
 * the same reason: there is no client-side error handling to inform, and a descriptive error on an
 * unauthenticated endpoint is a description of our validation for whoever is probing it.
 *
 * IT NEVER THROWS INTO A VISITOR'S PAGE. A database that is down must not turn into a failed
 * request the browser retries; the insert is wrapped and a failure is a 204 like any other, because
 * a lost performance sample is not worth one byte of a visitor's attention. The loss is visible
 * where it should be — the Studio panel's sample count stops rising.
 */

export const dynamic = 'force-dynamic'

/**
 * Generous for a person, tight for a script.
 *
 * A sampled page view sends at most five beacons (LCP, CLS, INP, TTFB, FCP). Thirty a minute is six
 * such page views inside a minute from one address, which no human browsing produces and which a
 * shared office NAT still comfortably fits under; two hundred an hour is forty. Both windows are
 * consumed on every request, so a caller over the per-minute ceiling still pays into the hourly one.
 */
const VITALS_WINDOWS: readonly RateWindow[] = [
  { seconds: 60, limit: 30 },
  { seconds: 3600, limit: 200 },
]

const NO_STORE = { 'cache-control': 'no-store' } as const

export async function POST(request: Request): Promise<NextResponse> {
  if (!isSameOrigin(request)) {
    return new NextResponse(null, { status: 403, headers: NO_STORE })
  }

  const { allowed } = await consume(bucketKey('vitals', callerAddress(request)), VITALS_WINDOWS)
  if (!allowed) return new NextResponse(null, { status: 429, headers: NO_STORE })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new NextResponse(null, { status: 400, headers: NO_STORE })
  }

  const parsed = vitalsSampleSchema.safeParse(body)
  if (!parsed.success) return new NextResponse(null, { status: 400, headers: NO_STORE })

  try {
    await insertVitalsSample(createAdminClient(), parsed.data)
  } catch {
    // See the header: a lost sample is not worth a retry loop in a visitor's browser.
  }

  return new NextResponse(null, { status: 204, headers: NO_STORE })
}
