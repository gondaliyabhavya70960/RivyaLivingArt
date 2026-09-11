import { describe, expect, it } from 'vitest'

import { isDue, parseSchedule, previousFire, validateSchedule } from '@/lib/sheets/schedule'

/** MANUAL or hourly-at-most cron, evaluated in UTC, due once per firing. */

describe('validateSchedule', () => {
  it('accepts MANUAL and an hourly expression', () => {
    expect(validateSchedule('MANUAL')).toEqual({ ok: true })
    expect(validateSchedule('0 * * * *')).toEqual({ ok: true })
    expect(validateSchedule('30 6 * * 1')).toEqual({ ok: true })
    expect(validateSchedule('15 */6 * * *')).toEqual({ ok: true })
  })

  it('refuses anything more frequent than hourly, and nonsense', () => {
    expect(validateSchedule('*/15 * * * *').ok).toBe(false)
    expect(validateSchedule('* * * * *').ok).toBe(false)
    expect(validateSchedule('0,30 * * * *').ok).toBe(false)
    expect(validateSchedule('every hour').ok).toBe(false)
    expect(validateSchedule('60 * * * *').ok).toBe(false)
    expect(validateSchedule('0 25 * * *').ok).toBe(false)
  })
})

describe('previousFire and isDue', () => {
  const now = new Date('2026-09-11T07:30:00Z')

  it('finds the latest firing at or before now', () => {
    expect(previousFire('0 * * * *', now)?.toISOString()).toBe('2026-09-11T07:00:00.000Z')
    expect(previousFire('30 6 * * *', now)?.toISOString()).toBe('2026-09-11T06:30:00.000Z')
    // Friday 11 September 2026; the last Monday 06:30 was the 7th.
    expect(previousFire('30 6 * * 1', now)?.toISOString()).toBe('2026-09-07T06:30:00.000Z')
    expect(parseSchedule('bad')).toBeNull()
    expect(previousFire('bad', now)).toBeNull()
  })

  it('is due once per firing and never for MANUAL', () => {
    expect(isDue('MANUAL', now, null)).toBe(false)
    expect(isDue('0 * * * *', now, null)).toBe(true)
    expect(isDue('0 * * * *', now, new Date('2026-09-11T06:59:00Z'))).toBe(true)
    expect(isDue('0 * * * *', now, new Date('2026-09-11T07:01:00Z'))).toBe(false)
    expect(isDue('30 6 * * 1', now, new Date('2026-09-08T00:00:00Z'))).toBe(false)
  })
})
