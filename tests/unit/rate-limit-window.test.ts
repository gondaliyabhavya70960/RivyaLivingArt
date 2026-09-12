import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  INQUIRY_SUBMIT_WINDOWS,
  INQUIRY_UPLOAD_WINDOWS,
  MEDIA_SIGN_WINDOWS,
  PASSWORD_RESET_WINDOWS,
  RECOVERY_CONFIRM_WINDOWS,
  REVALIDATE_WINDOWS,
  SIGN_IN_WINDOWS,
  SUGGEST_WINDOWS,
  VITALS_WINDOWS,
  addressFromHeaders,
  bucketKey,
  hashAddress,
  hashIdentifier,
  retryAfterSeconds,
} from '@/lib/security/rate-limit'

/**
 * THE RATE LIMITER'S PURE HALF — Phase 41, tested in Phase 42.
 *
 * `consume()` needs a database and belongs to the RLS project. Everything here is arithmetic and
 * hashing, and every assertion is about a property that would be invisible if it broke: a key that
 * stopped depending on the salt, a `Retry-After` that told somebody to come back later than they
 * needed to, an address parser that let a caller mint a fresh bucket per request.
 *
 * THE ONE THING NEVER ASSERTED IS A DIGEST'S VALUE. Pinning `hashAddress('1.2.3.4')` to a literal
 * would bake the fallback salt into the repository and make the test fail the day somebody sets
 * `IP_HASH_SALT` — which is the day it should pass hardest. The assertions are about RELATIONSHIPS
 * between digests instead.
 */

const SALTS = ['IP_HASH_SALT', 'RATE_LIMIT_SALT'] as const
const saved = new Map<string, string | undefined>()

beforeEach(() => {
  for (const name of SALTS) saved.set(name, process.env[name])
})
afterEach(() => {
  for (const name of SALTS) {
    const value = saved.get(name)
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
})

describe('bucket keys', () => {
  it('keeps the prefix readable and hides the value', () => {
    const key = bucketKey('vitals', '203.0.113.7')
    expect(key.startsWith('vitals:')).toBe(true)
    // The address itself must not survive into a column an operator can read.
    expect(key).not.toContain('203.0.113.7')
  })

  it('is stable for one value and different for another', () => {
    expect(bucketKey('suggest', 'a')).toBe(bucketKey('suggest', 'a'))
    expect(bucketKey('suggest', 'a')).not.toBe(bucketKey('suggest', 'b'))
  })

  it('separates prefixes, so one surface cannot spend what another was given', () => {
    expect(bucketKey('suggest', 'a')).not.toBe(bucketKey('vitals', 'a'))
  })

  it('changes entirely when the salt changes', () => {
    /*
     * THE PROPERTY THAT MAKES THE SALT WORTH SETTING. If the digest did not depend on it, an
     * attacker who knew the scheme could reproduce every stored key by guessing addresses — which
     * is the whole reason `hmac` replaced a plain hash in Phase 41.
     */
    process.env['IP_HASH_SALT'] = 'one'
    const first = bucketKey('inquiry', '203.0.113.7')
    process.env['IP_HASH_SALT'] = 'two'
    const second = bucketKey('inquiry', '203.0.113.7')
    expect(first).not.toBe(second)
  })

  it('fits the column, whatever the input length', () => {
    // `rate_limit_buckets.bucket_key` has a CHECK on its shape; a 4 kB user agent must not overflow.
    const long = bucketKey('suggest', 'x'.repeat(10_000))
    expect(long.length).toBeLessThan(64)
  })
})

describe('hashing an address and an identifier', () => {
  it('gives the same answer for the same input and a different one otherwise', () => {
    expect(hashAddress('198.51.100.4')).toBe(hashAddress('198.51.100.4'))
    expect(hashAddress('198.51.100.4')).not.toBe(hashAddress('198.51.100.5'))
  })

  it('does not leak the input', () => {
    expect(hashIdentifier('someone@example.com')).not.toContain('someone')
    expect(hashIdentifier('someone@example.com')).not.toContain('example.com')
  })
})

describe('the address a limit is keyed on', () => {
  const headers = (map: Record<string, string>) => ({
    get: (name: string) => map[name.toLowerCase()] ?? null,
  })

  it('takes the LAST forwarded entry, not the first', () => {
    /*
     * THE FIRST ENTRY IS CLIENT-CONTROLLED. A caller who prepends an address of their choosing
     * would mint a fresh bucket on every request and never be limited at all; the last entry is the
     * one the closest trusted proxy appended.
     */
    expect(
      addressFromHeaders(headers({ 'x-forwarded-for': '10.0.0.1, 192.0.2.9, 203.0.113.7' })),
    ).toBe('203.0.113.7')
  })

  it('falls back to x-real-ip, then to a literal', () => {
    expect(addressFromHeaders(headers({ 'x-real-ip': '203.0.113.8' }))).toBe('203.0.113.8')
    expect(addressFromHeaders(headers({}))).toBe('unknown')
  })

  it('ignores an empty forwarded header rather than keying everything on one bucket', () => {
    expect(
      addressFromHeaders(headers({ 'x-forwarded-for': '   ', 'x-real-ip': '203.0.113.9' })),
    ).toBe('203.0.113.9')
  })
})

describe('Retry-After', () => {
  it('is the SHORTEST window in force', () => {
    /*
     * A caller limited by a 3-per-minute window inside a 10-per-hour one can legitimately try again
     * in a minute. Reporting the hour would be a lie in the polite direction and would keep a real
     * visitor waiting fifty-nine minutes longer than the product requires.
     */
    expect(retryAfterSeconds(INQUIRY_UPLOAD_WINDOWS)).toBe(60)
    expect(retryAfterSeconds([{ seconds: 900, limit: 10 }])).toBe(900)
  })

  it('never returns zero or a negative number for any shipped surface', () => {
    for (const windows of [
      INQUIRY_SUBMIT_WINDOWS,
      INQUIRY_UPLOAD_WINDOWS,
      MEDIA_SIGN_WINDOWS,
      SUGGEST_WINDOWS,
      VITALS_WINDOWS,
      REVALIDATE_WINDOWS,
      SIGN_IN_WINDOWS,
      PASSWORD_RESET_WINDOWS,
      RECOVERY_CONFIRM_WINDOWS,
    ]) {
      expect(retryAfterSeconds(windows)).toBeGreaterThan(0)
    }
  })
})

describe('the shipped windows', () => {
  it('are all positive, which a typo would break silently', () => {
    for (const windows of [
      INQUIRY_SUBMIT_WINDOWS,
      INQUIRY_UPLOAD_WINDOWS,
      MEDIA_SIGN_WINDOWS,
      SUGGEST_WINDOWS,
      VITALS_WINDOWS,
      REVALIDATE_WINDOWS,
      SIGN_IN_WINDOWS,
      PASSWORD_RESET_WINDOWS,
      RECOVERY_CONFIRM_WINDOWS,
    ]) {
      expect(windows.length).toBeGreaterThan(0)
      for (const window of windows) {
        expect(window.seconds).toBeGreaterThan(0)
        expect(window.limit).toBeGreaterThan(0)
      }
    }
  })

  it('hold the figures SECURITY.md §8 publishes', () => {
    /*
     * The document is the contract; these are the numbers a reader is promised. This assertion
     * found a real disagreement on its first run: §8's table said the inquiry limit was "5 per
     * hour", and the code has shipped 5-per-10-minutes AND 10-per-hour since Phase 20 — with the
     * reasoning written down beside it, because five an hour refuses a second enquiry from a
     * household or an office the same afternoon. The document was corrected to the code.
     */
    expect(INQUIRY_SUBMIT_WINDOWS).toContainEqual({ seconds: 600, limit: 5 })
    expect(INQUIRY_SUBMIT_WINDOWS).toContainEqual({ seconds: 3600, limit: 10 })
    expect(MEDIA_SIGN_WINDOWS).toEqual([{ seconds: 3600, limit: 20 }])
    expect(SUGGEST_WINDOWS).toEqual([{ seconds: 60, limit: 60 }])
    expect(REVALIDATE_WINDOWS).toEqual([{ seconds: 60, limit: 30 }])
    expect(SIGN_IN_WINDOWS).toEqual([{ seconds: 900, limit: 10 }])
    // Amendment A43. The reset window is TIGHTER than sign-in, and §8 has to keep saying so: a
    // refused sign-in costs a retry, while a reset request sends mail to an address somebody typed.
    expect(PASSWORD_RESET_WINDOWS).toEqual([{ seconds: 3600, limit: 5 }])
    expect(RECOVERY_CONFIRM_WINDOWS).toEqual([{ seconds: 3600, limit: 20 }])
  })
})

/**
 * THE HASH THAT GOES IN A COLUMN, AND THE ONE THAT DOES NOT — added in Phase 42.
 *
 * `inquiries.ip_hash` carries `check (ip_hash ~ '^[a-f0-9]{64}$')`. `hashAddress` returns
 * sixty-four characters and exists for that column; `bucketKey` returns a prefix and a THIRTY-TWO
 * character digest, because a bucket key only has to be unguessable.
 *
 * `submit-inquiry.ts` used `bucketKey('ip', address).split(':')[1]` — the short one — so the
 * database refused EVERY enquiry insert, in every environment, from the day Phase 41 added the
 * constraint. The action caught it and returned `save_failed`, so the visitor was correctly not
 * handed to WhatsApp; the conversion path did not misbehave, it simply never worked.
 *
 * These two assertions cost nothing and run offline on every push, which is what that defect needed
 * and did not have: it took a browser, a published page and a dev server log to find.
 */
describe('the two hashes are not interchangeable', () => {
  /** The constraint, copied from `inquiries_ip_hash_is_hash`. */
  const IP_HASH_COLUMN = /^[a-f0-9]{64}$/

  it('hashAddress produces a value the ip_hash column accepts', () => {
    for (const address of ['1.2.3.4', '::1', '203.0.113.42']) {
      expect(IP_HASH_COLUMN.test(hashAddress(address)), address).toBe(true)
    }
  })

  it('a bucket key digest is too short for that column', () => {
    // Asserted rather than assumed, so a future widening of `bucketKey` does not silently make the
    // slice work again and turn this comment into fiction.
    const digest = bucketKey('ip', '1.2.3.4').split(':')[1] ?? ''
    expect(digest).toHaveLength(32)
    expect(IP_HASH_COLUMN.test(digest)).toBe(false)
  })

  it('gives the same address the same hash every time', () => {
    // An ip_hash that moved would make the rate limiter and the stored value disagree about who is
    // who, and would make a data-request erasure unable to find the rows it is meant to find.
    expect(hashAddress('203.0.113.42')).toBe(hashAddress('203.0.113.42'))
    expect(hashAddress('203.0.113.42')).not.toBe(hashAddress('203.0.113.43'))
  })
})
