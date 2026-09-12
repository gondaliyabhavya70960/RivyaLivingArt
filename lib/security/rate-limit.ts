import 'server-only'

import { createHmac } from 'node:crypto'

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
  return (
    process.env['IP_HASH_SALT'] ??
    process.env['RATE_LIMIT_SALT'] ??
    process.env['SUPABASE_SERVICE_ROLE_KEY'] ??
    'rivya'
  )
}

/**
 * `<prefix>:<hmac-sha256(salt, value)>`, truncated. Matches the table's `bucket_key` CHECK.
 *
 * PHASE 41 MADE THIS AN HMAC RATHER THAN A SALTED HASH, and the difference is not cosmetic.
 * `sha256(salt + value)` is vulnerable to a length-extension attack and, more practically, to an
 * offline dictionary run: the IPv4 space is four billion values, which is minutes of GPU time
 * against a plain hash if the salt ever leaks. HMAC is the construction designed for keyed digests
 * and costs the same. SECURITY.md §6 calls this `ip_hash = hmac(ip, server_salt)`, so the code now
 * says what the document says.
 *
 * `IP_HASH_SALT` IS THE PREFERRED NAME, with the old chain kept behind it. A rename that dropped
 * the fallback would silently reset every live window on deploy — everybody's counter back to zero
 * at the moment of a change, which is the worst possible time for a limit to be off.
 */
export function bucketKey(prefix: string, value: string): string {
  const digest = createHmac('sha256', salt()).update(value).digest('hex').slice(0, 32)
  return `${prefix}:${digest}`
}

/**
 * A hashed address for something other than a bucket key — an `ip_hash` column, a log field.
 *
 * Same construction, no prefix. `inquiries.ip_hash` (Phase 20) and the SECURITY-channel log a
 * refusal writes both want this, and neither should re-derive it.
 */
export function hashAddress(value: string): string {
  return createHmac('sha256', salt()).update(value).digest('hex').slice(0, 64)
}

/** A non-address value hashed the same way — an email at sign-in, a form fingerprint. */
export function hashIdentifier(value: string): string {
  return createHmac('sha256', salt()).update(value.trim().toLowerCase()).digest('hex').slice(0, 64)
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
  return addressFromHeaders(request.headers)
}

/**
 * The same rule, for a caller that has headers but no `Request`.
 *
 * A SERVER ACTION IS THAT CALLER. `next/headers` hands back a `ReadonlyHeaders` and there is no
 * `Request` object to pass — and Phase 20's submit path needs exactly this rule, because a rate
 * limit that read the FIRST forwarded entry would let one client mint a fresh bucket per request by
 * prepending an address of their choosing.
 */
export function addressFromHeaders(headers: {
  get(name: string): string | null | undefined
}): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded !== null && forwarded !== undefined && forwarded.trim() !== '') {
    const parts = forwarded.split(',').map((part) => part.trim())
    const last = parts[parts.length - 1]
    if (last !== undefined && last !== '') return last
  }
  return headers.get('x-real-ip') ?? 'unknown'
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

/**
 * THE TEN SURFACES — Phase 41, FEAT §47; amendment A43 added the last two.
 *
 * Every limit in the product lives here, as data, so that SECURITY.md §6 describes one table and the
 * Studio's Security section reads the same one. A limit written at its call site is a limit nobody
 * can audit without opening eight files.
 *
 * EVERY WINDOW IS GENEROUS FOR A PERSON AND TIGHT FOR A SCRIPT, which is the only useful calibration:
 * the threat is abuse volume, and the cost of getting it wrong in the other direction is refusing a
 * real enquiry, which is worse than absorbing a few hundred wasted requests.
 *
 * FIXED WINDOWS ALLOW A 2× BURST AT A BOUNDARY, and that is accepted and documented rather than
 * worked around. A sliding window needs Redis, which D1 does not include.
 */

/**
 * An enquiry: five per ten minutes, plus an hourly outer bound.
 *
 * PHASE 41 CHANGED THE SHAPE PHASE 19 SHIPPED, from a single five-per-hour, and the reason is a real
 * case rather than a preference. Five an hour refuses a second enquiry from a shared address the same
 * afternoon — a household, an office, a hotel — and the person on the other end has no way to know
 * why. Five per ten minutes catches the flood a script produces just as well, and the hourly ten
 * keeps a ceiling that a patient script cannot walk past.
 */
export const INQUIRY_SUBMIT_WINDOWS: readonly RateWindow[] = [
  { seconds: 600, limit: 5 },
  { seconds: 3600, limit: 10 },
]

/** The public upload endpoint. Bursty by nature: a browser sends several in a row for one brief. */
export const INQUIRY_UPLOAD_WINDOWS: readonly RateWindow[] = [
  { seconds: 60, limit: 3 },
  { seconds: 3600, limit: 10 },
]

/**
 * The Studio signing route, keyed by staff user id rather than by address.
 *
 * KEYED BY THE PERSON, BECAUSE THE ADDRESS IS SHARED. A studio works from one office and one
 * connection; an address key would make one editor's bulk upload refuse another's. Twenty an hour is
 * a working session's worth of media.
 */
export const MEDIA_SIGN_WINDOWS: readonly RateWindow[] = [{ seconds: 3600, limit: 20 }]

/**
 * Search suggestions: sixty a minute.
 *
 * A PERSON TYPING PRODUCES ABOUT ONE REQUEST PER KEYSTROKE and the box is debounced, so sixty a
 * minute is several searches with room to spare. Exceeding it degrades to no suggestions and the
 * plain form beneath still submits — the failure is invisible and costs nothing.
 */
export const SUGGEST_WINDOWS: readonly RateWindow[] = [{ seconds: 60, limit: 60 }]

/**
 * The vitals beacon: sixty a minute, two hundred an hour.
 *
 * A sampled page view sends at most five beacons, so sixty a minute is twelve sampled page views
 * inside a minute from one address — which a shared office connection can genuinely produce and a
 * person cannot.
 */
export const VITALS_WINDOWS: readonly RateWindow[] = [
  { seconds: 60, limit: 60 },
  { seconds: 3600, limit: 200 },
]

/**
 * Revalidation: thirty a minute, keyed by the secret rather than by the caller.
 *
 * KEYED BY THE SECRET DELIBERATELY. A caller who does not hold it is refused before the limiter is
 * reached, so the only thing left to bound is a holder of the secret looping — a misconfigured
 * webhook, a retry storm — and the key that describes that is the credential, not the address it
 * came from.
 */
export const REVALIDATE_WINDOWS: readonly RateWindow[] = [{ seconds: 60, limit: 30 }]

/**
 * Studio sign-in: ten per fifteen minutes, keyed by email hash AND address.
 *
 * TWO KEYS, CONSUMED SEPARATELY, because the two attacks are different. A hundred attempts against
 * one address is a person who forgot their password or a script working through a wordlist; a
 * hundred attempts against one email from a hundred addresses is credential stuffing. A single key
 * would miss one of them whichever one it was.
 */
export const SIGN_IN_WINDOWS: readonly RateWindow[] = [{ seconds: 900, limit: 10 }]

/**
 * Studio password reset: five requests per hour, keyed by email hash AND address.
 *
 * TIGHTER THAN SIGN-IN, AND THE REASON IS THE SIDE EFFECT. A refused sign-in costs the person
 * nothing but a retry; a request here SENDS AN EMAIL to an address the requester has merely typed.
 * An unthrottled form is therefore a way to post mail to somebody else’s inbox in Rivya’s name,
 * over and over, from a page that requires no account — and the volume is the harassment, not the
 * content of any one message. Five is above what a person who has genuinely lost their password
 * needs in an hour and far below what makes a mailbox unusable.
 *
 * KEYED THE SAME TWO WAYS AS SIGN-IN, for the same reason: by address catches one sender working
 * through a list of staff addresses, by email hash catches a list of senders working on one.
 */
export const PASSWORD_RESET_WINDOWS: readonly RateWindow[] = [{ seconds: 3600, limit: 5 }]

/**
 * Consuming a recovery link: twenty per hour by address.
 *
 * KEYED BY ADDRESS ALONE, because there is nothing else to key on — the caller presents a token and
 * no identity, and the token is exactly what must not be used as a bucket key: a distinct key per
 * token gives an attacker a fresh allowance for every guess, which is the opposite of a limit.
 * Twenty is generous for a person clicking a link in an email (the same link opened twice, a
 * prefetching mail client, a retry) and is a wall in front of anybody grinding token hashes.
 */
export const RECOVERY_CONFIRM_WINDOWS: readonly RateWindow[] = [{ seconds: 3600, limit: 20 }]

/**
 * How long to tell a refused caller to wait.
 *
 * THE SHORTEST WINDOW'S LENGTH, and not the longest. A 429 is a message to a person who is about to
 * press the button again: "try in ten minutes" is actionable and "try in an hour" invites them to
 * give up on an enquiry they were in the middle of writing. The shortest window is also the one most
 * likely to be the one they tripped.
 *
 * IT IS AN UPPER BOUND ON THE TRUTH, not the exact remaining time. A fixed window resets at a wall
 * clock instant the caller cannot see, and computing the remainder would mean returning the window's
 * start — which tells a script exactly when to resume. Rounding up to the whole window is the safe
 * imprecision.
 */
export function retryAfterSeconds(windows: readonly RateWindow[]): number {
  return Math.min(...windows.map((window) => window.seconds))
}
