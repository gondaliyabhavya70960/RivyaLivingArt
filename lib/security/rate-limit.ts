import 'server-only'

import { createHash } from 'node:crypto'

import { createAdminClient } from '@/lib/supabase/admin'
import { consumeRateLimit } from '@/lib/supabase/repositories/rate-limits'

/**
 * Fixed-window rate limiting for public endpoints.
 *
 * WHY THIS EXISTS IN PHASE 19 RATHER THAN PHASE 41, WHERE SECURITY.md PUTS IT.
 * `app/api/media/sign` deferred its own limit and said so in a comment, which was defensible: that
 * route demands a staff session, so the exposure is a colleague or a stolen session.
 * `app/api/inquiries/upload-sign` is UNAUTHENTICATED BY DESIGN — a visitor filling in a bespoke
 * brief has no account and D1 forbids giving them one — and an unlimited endpoint that mints upload
 * credentials is an open file host with Rivya's Cloudinary bill attached.
 *
 * THE ADDRESS IS HASHED AND NEVER STORED. SECURITY.md forbids a raw visitor IP at rest and
 * `activity_events` says the same. `bucketKey` hashes the address with a per-deployment salt, so
 * `rate_limit_buckets` holds a value that identifies a repeat caller without identifying a person,
 * and one that cannot be reversed by anybody reading the table.
 *
 * IT USES THE SERVICE-ROLE CLIENT, WHICH IS A DECISION. `consume_rate_limit()` is granted to
 * `service_role` alone, deliberately: the key is derived from the caller, and an anonymous session
 * able to pass any key could exhaust somebody else's window on their behalf. There is no user here
 * whose permissions could be checked — that is what "public endpoint" means — so this module is on
 * the `eslint.config.mjs` allowlist, and the seam is one RPC returning a boolean.
 *
 * FAIL CLOSED. If the database cannot be reached, the request is REFUSED rather than allowed. The
 * cost of the other choice is that a database blip turns the limit off entirely, which is precisely
 * when an endpoint is least able to absorb the traffic.
 */

/**
 * The salt. `RATE_LIMIT_SALT` if set, otherwise the service-role key, which every deployment has
 * and no visitor does.
 *
 * The fallback is not laziness: a salt that had to be configured before the limiter worked would be
 * a limiter that silently did not work on a deployment where somebody forgot. Reading a secret to
 * derive a hash never exposes it — the digest is one-way, and nothing here logs, returns or stores
 * the input. (CLAUDE.md: never log or display a secret value, prefix or length.)
 */
function salt(): string {
  return process.env['RATE_LIMIT_SALT'] ?? process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? 'rivya'
}

/** `<prefix>:<sha256(salt + value)>`, truncated. Matches the table's `bucket_key` CHECK. */
export function bucketKey(prefix: string, value: string): string {
  const digest = createHash('sha256').update(`${salt()}:${value}`).digest('hex').slice(0, 32)
  return `${prefix}:${digest}`
}

/**
 * The caller's address, as far as it can be known.
 *
 * `x-forwarded-for` IS A LIST AND THE FIRST ENTRY IS THE CLIENT'S CLAIM. Behind Vercel the proxy
 * appends the real peer, so the LAST entry is the trustworthy one and the first is whatever the
 * caller decided to send. Taking the last is what stops a header of a thousand fake addresses
 * producing a thousand fresh buckets.
 *
 * A request with no forwarded header at all — a direct hit in development — falls back to a single
 * shared bucket rather than to "unlimited". Sharing a bucket in development is a nuisance;
 * exempting every unheadered request is a hole.
 */
export function callerAddress(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded !== null && forwarded.trim() !== '') {
    const parts = forwarded.split(',').map((part) => part.trim())
    const last = parts[parts.length - 1]
    if (last !== undefined && last !== '') return last
  }
  return request.headers.get('x-real-ip') ?? 'unknown'
}

export interface RateWindow {
  /** Width of the window, in seconds. */
  readonly seconds: number
  /** How many requests the window admits. */
  readonly limit: number
}

/**
 * Consume one request against every window, and say whether it is allowed.
 *
 * ALL WINDOWS ARE CONSUMED, INCLUDING AFTER ONE HAS REFUSED. Short-circuiting would let a caller
 * who is over the per-minute limit avoid touching the per-hour counter, so hammering the endpoint
 * for sixty seconds would cost them nothing against the hourly ceiling.
 */
export async function consume(
  key: string,
  windows: readonly RateWindow[],
): Promise<{ allowed: boolean }> {
  const client = createAdminClient()
  let allowed = true

  for (const window of windows) {
    try {
      if (!(await consumeRateLimit(client, key, window.seconds, window.limit))) allowed = false
    } catch {
      // Fail closed. See the header: a database that cannot be reached is the moment an endpoint is
      // least able to absorb whatever is hitting it.
      allowed = false
    }
  }

  return { allowed }
}

/** The two windows the phase document fixes for the public upload endpoint. */
export const INQUIRY_UPLOAD_WINDOWS: readonly RateWindow[] = [
  { seconds: 60, limit: 3 },
  { seconds: 3600, limit: 10 },
]
