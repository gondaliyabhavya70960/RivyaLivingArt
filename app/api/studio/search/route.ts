import { NextResponse } from 'next/server'
import { z } from 'zod'

import { runProviders } from '@/components/studio/command/registry'
// Imported for its side effect: registering the route provider. Without this the endpoint would
// answer every query with an empty list and nothing would say why.
import '@/components/studio/command/route-provider'
// And Phase 23's eight entity providers, registered the same way and for the same reason: an
// import for its side effect, so the endpoint answers with records as well as with routes.
import '@/components/studio/command/providers'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/require'

/**
 * The command palette's search endpoint.
 *
 * POST, NOT GET, and not because the query is secret. A GET would be logged with its query string
 * by every proxy and browser history in the path, and the query is whatever a staff member typed
 * while looking for a record — a customer's name, an enquiry reference. A POST body is not private
 * either, but it is not written into a URL that gets shared, bookmarked and screenshotted.
 *
 * IT AUTHORISES BEFORE IT PARSES. `requirePermission` runs first, so an unauthenticated request
 * never reaches the schema and the DENIED audit row is written for the attempt rather than for a
 * well-formed attempt. The order matters for what the security log shows.
 *
 * IT NEVER SAYS WHY IT REFUSED. 401 and 403 are distinguished — one means sign in, the other means
 * you cannot — but neither carries a message about what exists.
 */

const bodySchema = z.object({
  // Bounded on both ends: an empty query would ask every provider for everything, and a very long
  // one is not a search, it is somebody probing the parser.
  query: z.string().min(1).max(200),
})

/** Total results returned, across all providers. Each provider is capped at 20 by the registry. */
const TOTAL_CAP = 50

export async function POST(request: Request): Promise<NextResponse> {
  let session
  try {
    session = await requirePermission('studio.access')
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    throw error
  }

  let parsed
  try {
    parsed = bodySchema.safeParse(await request.json())
  } catch {
    // Malformed JSON. Deliberately the same shape as a schema failure: both mean "that request was
    // not usable", and telling them apart helps nobody but somebody mapping the parser.
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const outcome = await runProviders(parsed.data.query, session.role, {
    signal: request.signal,
  })

  return NextResponse.json(
    {
      results: outcome.results.slice(0, TOTAL_CAP),
      // Reported so the palette can say results may be incomplete rather than showing fewer and
      // letting the reader conclude the record does not exist.
      incomplete: outcome.timedOut.length > 0 || outcome.failed.length > 0,
    },
    // The response is per-session and per-query. A cached one served to the next reader would be
    // another person's search results.
    { headers: { 'cache-control': 'no-store' } },
  )
}
