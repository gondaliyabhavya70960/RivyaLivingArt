import { describe, expect, it } from 'vitest'

import { roleHasPermission, rolesWithPermission } from '@/lib/auth/permissions'
import { ratioDrift } from '@/lib/media/crop'
import { callerAddress } from '@/lib/security/rate-limit'
import type { MediaCropRow } from '@/lib/media/crop'

/**
 * THE BRANCHES ON THE CRITICAL LIST THAT NOTHING ELSE REACHES — Phase 42.
 *
 * `vitest.config.ts` holds five files to 100% branch coverage, and the reason is stated there: each
 * one decides something that cannot be undone. Four of them were already complete; the branches
 * below are the ones the existing suites never entered, and they were found by running coverage for
 * the first time rather than by reading the code.
 *
 * EVERY ONE OF THEM IS A GUARD, which is exactly the kind of branch that goes untested: nobody
 * writes the test for the case they believe cannot happen, and the guard is there because somebody
 * once believed that about a different case. A guard nobody has executed is a guard nobody knows
 * works.
 */

const crop = (over: Partial<MediaCropRow> = {}): MediaCropRow =>
  ({
    id: '00000000-0000-4000-8000-00000000c001',
    media_asset_id: '00000000-0000-4000-8000-00000000a001',
    aspect_ratio: '16:9',
    gravity: null,
    x: 0,
    y: 0,
    width: 1600,
    height: 900,
    created_at: '2026-01-15T12:00:00.000Z',
    updated_at: '2026-01-15T12:00:00.000Z',
    updated_by: null,
    ...over,
  }) as MediaCropRow

describe('roleHasPermission with no role', () => {
  it('refuses when the caller has no role at all', () => {
    /*
     * `null` IS AN UNAUTHENTICATED CALLER, or one whose staff profile was removed while they held a
     * session. The safe answer is no, and this is the branch that says so — reached by the proxy on
     * every request from a stranger, and never by a test until now.
     */
    expect(roleHasPermission(null, 'catalog.write')).toBe(false)
    expect(roleHasPermission(null, 'inquiries.read')).toBe(false)
  })

  it('still answers for a real role', () => {
    // Load-bearing: the assertion above passes if the function returns false for everything.
    expect(roleHasPermission('owner', 'catalog.write')).toBe(true)
    expect(rolesWithPermission('catalog.write')).toContain('owner')
  })
})

describe('ratioDrift with a ratio it cannot parse', () => {
  it('returns null rather than NaN for a malformed ratio', () => {
    /*
     * THE GUARD IS FOR A VALUE FROM THE DATABASE, and `aspect_ratio` is a text column with an
     * allowlist CHECK — so this should be unreachable. It is here because "should be unreachable"
     * is what everybody said about every other value that later appeared, and because the
     * alternative return is `NaN`, which compares false against every threshold and would report a
     * badly drifted crop as fine.
     */
    expect(ratioDrift(crop(), 'not-a-ratio' as never)).toBeNull()
    expect(ratioDrift(crop(), '16:0' as never)).toBeNull()
    expect(ratioDrift(crop(), '16' as never)).toBeNull()
  })

  it('measures drift on a ratio it can parse', () => {
    // A 1600×900 box is exactly 16:9, so nothing has drifted.
    expect(ratioDrift(crop(), '16:9')).toBeCloseTo(0, 6)
    // The same box asked to be 1:1 is off by 78%.
    expect(ratioDrift(crop(), '1:1')).toBeCloseTo(0.7778, 3)
  })

  it('returns null for a crop with no box to measure', () => {
    expect(ratioDrift(crop({ width: null, height: null, gravity: 'auto' }), '16:9')).toBeNull()
    expect(ratioDrift(crop({ height: 0 }), '16:9')).toBeNull()
  })
})

describe('callerAddress', () => {
  it('reads the address from a Request the same way it reads bare headers', () => {
    /*
     * A THIN WRAPPER, AND WORTH ITS TEST ANYWAY. `callerAddress` is what a route handler calls and
     * `addressFromHeaders` is what a Server Action calls, and they must agree: if they ever drifted,
     * one surface would rate-limit by a different key than the other and a caller refused on the
     * route could simply use the action.
     *
     * THE LAST FORWARDED ENTRY, NOT THE FIRST. The first is whatever the caller chose to send, so
     * reading it would let one client mint a fresh bucket per request by prepending an address.
     */
    const request = new Request('https://rivyalivingart.com/api/vitals', {
      headers: { 'x-forwarded-for': '198.51.100.7, 203.0.113.9' },
    })
    expect(callerAddress(request)).toBe('203.0.113.9')
  })

  it('falls back to something rather than throwing when no header is present', () => {
    const request = new Request('https://rivyalivingart.com/api/vitals')
    expect(typeof callerAddress(request)).toBe('string')
  })
})
