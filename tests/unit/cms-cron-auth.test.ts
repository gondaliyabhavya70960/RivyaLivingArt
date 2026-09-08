import { describe, expect, it } from 'vitest'

import { checkCronAuth, secretMatches } from '@/lib/cms/cron-auth'

const SECRET = 'a-long-enough-cron-secret-value'

function request(authorization?: string): Request {
  return new Request('https://example.test/api/cron/content-schedule', {
    headers: authorization === undefined ? {} : { authorization },
  })
}

describe('secretMatches', () => {
  it('accepts an exact match and rejects anything else', () => {
    expect(secretMatches(SECRET, SECRET)).toBe(true)
    expect(secretMatches(`${SECRET}x`, SECRET)).toBe(false)
    expect(secretMatches(SECRET.slice(0, -1), SECRET)).toBe(false)
    expect(secretMatches('', SECRET)).toBe(false)
  })

  /**
   * The reason both sides are hashed. `timingSafeEqual` throws on a length mismatch, so a raw
   * comparison would answer "wrong length" with an exception and "right length, wrong value" with
   * false — a 500 against a 401, which leaks the secret's length to anyone who tries two guesses.
   */
  it('does not throw on a length mismatch', () => {
    expect(() => secretMatches('x', SECRET)).not.toThrow()
    expect(() => secretMatches(SECRET, 'x')).not.toThrow()
    expect(() => secretMatches('x'.repeat(10_000), SECRET)).not.toThrow()
  })

  it('is case- and whitespace-sensitive', () => {
    expect(secretMatches(SECRET.toUpperCase(), SECRET)).toBe(false)
    expect(secretMatches(` ${SECRET}`, SECRET)).toBe(false)
  })
})

describe('checkCronAuth', () => {
  it('accepts a correct bearer token', () => {
    expect(checkCronAuth(request(`Bearer ${SECRET}`), SECRET)).toBe('OK')
  })

  /** Fails CLOSED: a deploy that forgot the variable must not become an open publish endpoint. */
  it('refuses when no secret is configured, even with a plausible header', () => {
    expect(checkCronAuth(request(`Bearer ${SECRET}`), undefined)).toBe('NOT_CONFIGURED')
    expect(checkCronAuth(request(`Bearer ${SECRET}`), '')).toBe('NOT_CONFIGURED')
    expect(checkCronAuth(request(), undefined)).toBe('NOT_CONFIGURED')
  })

  it('refuses a wrong, absent or malformed token', () => {
    expect(checkCronAuth(request(`Bearer wrong`), SECRET)).toBe('UNAUTHORISED')
    expect(checkCronAuth(request(), SECRET)).toBe('UNAUTHORISED')
    expect(checkCronAuth(request(SECRET), SECRET)).toBe('UNAUTHORISED')
    expect(checkCronAuth(request(`bearer ${SECRET}`), SECRET)).toBe('UNAUTHORISED')
    expect(checkCronAuth(request(`Basic ${SECRET}`), SECRET)).toBe('UNAUTHORISED')
  })

  /** `Bearer ` with nothing after it is an empty guess, not an absent header. */
  it('refuses an empty bearer value', () => {
    expect(checkCronAuth(request('Bearer '), SECRET)).toBe('UNAUTHORISED')
  })
})
