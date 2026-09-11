/**
 * A definition's schedule — Phase 36.
 *
 * `MANUAL`, or a five-field cron expression evaluated in UTC. THE MINIMUM INTERVAL IS HOURLY: the
 * minute field must be one number (`0 * * * *` is hourly at :00; a step in the minute field, such
 * as every fifteen minutes, is refused). The
 * cron route ticks once an hour and asks, per definition, "did this expression fire since the last
 * run?" — so a schedule is never missed by a slow tick and never run twice for one firing.
 *
 * Pure. No clock of its own; every function takes the time it reasons about.
 */

export const MANUAL_SCHEDULE = 'MANUAL'

const FIELD_RANGES = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 6],
] as const

function parseField(text: string, [min, max]: readonly [number, number]): Set<number> | null {
  const values = new Set<number>()
  for (const part of text.split(',')) {
    const [rangeText, stepText] = part.split('/')
    if (rangeText === undefined || rangeText === '') return null
    const step = stepText === undefined ? 1 : Number(stepText)
    if (!Number.isInteger(step) || step < 1) return null
    let from: number
    let to: number
    if (rangeText === '*') {
      from = min
      to = max
    } else if (rangeText.includes('-')) {
      const [a, b] = rangeText.split('-').map(Number)
      if (a === undefined || b === undefined || !Number.isInteger(a) || !Number.isInteger(b))
        return null
      from = a
      to = b
    } else {
      const only = Number(rangeText)
      if (!Number.isInteger(only)) return null
      from = only
      to = stepText === undefined ? only : max
    }
    if (from < min || to > max || from > to) return null
    for (let value = from; value <= to; value += step) values.add(value)
  }
  return values
}

export interface ParsedSchedule {
  readonly minutes: Set<number>
  readonly hours: Set<number>
  readonly daysOfMonth: Set<number>
  readonly months: Set<number>
  readonly daysOfWeek: Set<number>
}

export function parseSchedule(text: string): ParsedSchedule | null {
  const fields = text.trim().split(/\s+/u)
  if (fields.length !== 5) return null
  const parsed = fields.map((field, index) => {
    const range = FIELD_RANGES[index]
    return range === undefined ? null : parseField(field, range)
  })
  if (parsed.some((set) => set === null)) return null
  const [minutes, hours, daysOfMonth, months, daysOfWeek] = parsed as Set<number>[]
  if (
    minutes === undefined ||
    hours === undefined ||
    daysOfMonth === undefined ||
    months === undefined ||
    daysOfWeek === undefined
  ) {
    return null
  }
  return { minutes, hours, daysOfMonth, months, daysOfWeek }
}

export type ScheduleValidation =
  { readonly ok: true } | { readonly ok: false; readonly error: string }

/** MANUAL, or a valid five-field expression whose minute field is one number (hourly at most). */
export function validateSchedule(text: string): ScheduleValidation {
  if (text === MANUAL_SCHEDULE) return { ok: true }
  const parsed = parseSchedule(text)
  if (parsed === null) {
    return { ok: false, error: 'The schedule must be MANUAL or a five-field cron expression.' }
  }
  const minuteField = text.trim().split(/\s+/u)[0] ?? ''
  if (parsed.minutes.size !== 1 || !/^\d{1,2}$/u.test(minuteField)) {
    return {
      ok: false,
      error: 'The minimum schedule is hourly: the minute field must be one number, such as 0.',
    }
  }
  return { ok: true }
}

function matches(schedule: ParsedSchedule, at: Date): boolean {
  return (
    schedule.minutes.has(at.getUTCMinutes()) &&
    schedule.hours.has(at.getUTCHours()) &&
    schedule.daysOfMonth.has(at.getUTCDate()) &&
    schedule.months.has(at.getUTCMonth() + 1) &&
    schedule.daysOfWeek.has(at.getUTCDay())
  )
}

const LOOKBACK_MINUTES = 8 * 24 * 60

/** The latest firing at or before `now`, scanning back at most eight days; null when none. */
export function previousFire(text: string, now: Date): Date | null {
  const schedule = parseSchedule(text)
  if (schedule === null) return null
  const cursor = new Date(now.getTime())
  cursor.setUTCSeconds(0, 0)
  for (let step = 0; step < LOOKBACK_MINUTES; step += 1) {
    if (matches(schedule, cursor)) return new Date(cursor.getTime())
    cursor.setUTCMinutes(cursor.getUTCMinutes() - 1)
  }
  return null
}

/** Due when the expression has fired since the last run (or has fired at all, with no run yet). */
export function isDue(text: string, now: Date, lastRunAt: Date | null): boolean {
  if (text === MANUAL_SCHEDULE) return false
  const fired = previousFire(text, now)
  if (fired === null) return false
  return lastRunAt === null || fired.getTime() > lastRunAt.getTime()
}
