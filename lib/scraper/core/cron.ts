/**
 * The cron grammar: when a schedule fires, and how close together two of its fires may be.
 *
 * PURE, AND WITHOUT THE `server-only` MARKER, WHICH IS THE WHOLE REASON THIS FILE EXISTS. Both
 * halves of this grammar were written in `lib/scraper/workflows/schedule.ts`, whose first line is
 * `import 'server-only'` — a module that throws on import the moment anything in a client bundle
 * reaches it. Phase 26 puts a cron expression in a Studio FORM, and a form validator is reached
 * from a Client Component, so the grammar could not stay where it was without either weakening
 * that marker or keeping a second parser beside it. It moved down to `core/` instead: no I/O, no
 * ambient clock (`nextCronRun` takes its `from`), nothing that belongs to the server. `schedule.ts`
 * re-exports `nextCronRun` and `parseCronField`, so no caller changed (CANONICAL-DECISIONS.md,
 * amendment A26).
 *
 * WHY THE SIX-HOUR MINIMUM EXISTS TWICE, ON PURPOSE. It is a politeness setting — it bounds how
 * often Rivya may ask a third party for anything — so it lives in the database as a CHECK on
 * `research_source_schedules`, where a server action, a script, a fixture or a hand-written UPDATE
 * cannot step around it. `public.research_cron_min_interval_minutes` in
 * `supabase/migrations/0240_phase26_source_config.sql` IS that rule and remains the authority. The
 * copy here does the one thing a CHECK cannot: tell an operator what is wrong with the expression
 * while they are still typing it, rather than answering a save with a constraint violation naming
 * a function no researcher has heard of.
 *
 * TWO COPIES OF A RULE DRIFT UNLESS SOMETHING HOLDS THEM TOGETHER, and here that something is
 * `tests/unit/source-schedules.test.ts`: one table of expressions, asserted against this module and
 * then — whenever DATABASE_URL is set — against the SQL function itself, row for row. A change to
 * either side that the other does not make fails that file.
 */

/**
 * Six hours, in minutes. FEAT §26 field 19's floor, and the number inside the CHECK.
 *
 * EXPORTED SO THE FORM QUOTES THE CONSTRAINT RATHER THAN RESTATING IT. A bare `360` typed into a
 * Zod schema is a second place to edit when the number changes, and the copy that gets forgotten
 * is always the one the operator reads.
 */
export const MIN_SCHEDULE_INTERVAL_MINUTES = 360

/**
 * The next time a five-field cron expression fires after `from`.
 *
 * A MINUTE-BY-MINUTE SEARCH, BOUNDED AT ~370 DAYS, and not a cron library. The expression is
 * `minute hour day-of-month month day-of-week` with `*`, lists, ranges and steps — which is what
 * an operator types and all this needs to read. A dependency for it would be a dependency parsing
 * a string a person edits in a form, and this is fifty lines that a test can enumerate exhaustively.
 * The bound means a nonsensical-but-parseable expression (February 30th) returns null rather than
 * looping, and a null `next_run_at` is a job that never fires — visible in the Studio as "no next
 * run" rather than as a hung request.
 */
export function nextCronRun(expression: string, from: Date): Date | null {
  const fields = expression.trim().split(/\s+/)
  if (fields.length !== 5) return null

  const minutes = parseCronField(fields[0]!, 0, 59)
  const hours = parseCronField(fields[1]!, 0, 23)
  const days = parseCronField(fields[2]!, 1, 31)
  const months = parseCronField(fields[3]!, 1, 12)
  const weekdays = parseCronField(fields[4]!, 0, 6)
  if (!minutes || !hours || !days || !months || !weekdays) return null

  // Start at the next whole minute: a cron that fires "now" has already fired.
  const cursor = new Date(from.getTime())
  cursor.setUTCSeconds(0, 0)
  cursor.setUTCMinutes(cursor.getUTCMinutes() + 1)

  const limit = 370 * 24 * 60
  for (let step = 0; step < limit; step += 1) {
    if (
      minutes.has(cursor.getUTCMinutes()) &&
      hours.has(cursor.getUTCHours()) &&
      months.has(cursor.getUTCMonth() + 1) &&
      // CRON'S ODD RULE, AND IT IS THE STANDARD ONE: when both day-of-month and day-of-week are
      // restricted, a match on EITHER fires. Treating it as an AND makes `0 0 1 * 1` mean "the
      // first of the month, if it is a Monday" instead of "the first of the month, and every
      // Monday" — which is a schedule that fires roughly one seventh as often as intended.
      matchesDay(cursor, fields[2]!, fields[4]!, days, weekdays)
    ) {
      return cursor
    }
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1)
  }
  return null
}

function matchesDay(
  at: Date,
  dayField: string,
  weekdayField: string,
  days: Set<number>,
  weekdays: Set<number>,
): boolean {
  const dayRestricted = dayField !== '*'
  const weekdayRestricted = weekdayField !== '*'
  const dayMatch = days.has(at.getUTCDate())
  const weekdayMatch = weekdays.has(at.getUTCDay())

  if (dayRestricted && weekdayRestricted) return dayMatch || weekdayMatch
  if (dayRestricted) return dayMatch
  if (weekdayRestricted) return weekdayMatch
  return true
}

// `*`, `5`, `1-5`, a star with a `/15` step, `1,3,5`, `1-10/2`. Null for anything else.
// (Written as a line comment because a step expression contains the sequence that would end a
// block comment — which is exactly the kind of thing a cron parser has to be careful about.)
export function parseCronField(field: string, min: number, max: number): Set<number> | null {
  const values = new Set<number>()

  for (const part of field.split(',')) {
    const [rangePart, stepPart] = part.split('/')
    if (rangePart === undefined) return null

    const step = stepPart === undefined ? 1 : Number(stepPart)
    if (!Number.isInteger(step) || step < 1) return null

    let start: number
    let end: number
    if (rangePart === '*') {
      start = min
      end = max
    } else if (rangePart.includes('-')) {
      const [a, b] = rangePart.split('-')
      start = Number(a)
      end = Number(b)
    } else {
      start = Number(rangePart)
      end = start
    }

    if (!Number.isInteger(start) || !Number.isInteger(end)) return null
    if (start < min || end > max || start > end) return null

    for (let value = start; value <= end; value += step) values.add(value)
  }

  return values.size === 0 ? null : values
}

/**
 * The smallest gap between two selected values on a dial that wraps — minutes at 60, hours at 24.
 *
 * THE WRAP IS NOT AN EDGE CASE, IT IS THE COMMON ONE. Hours {0, 18} is an eighteen-hour gap read
 * left to right and a SIX-hour one across midnight, and six is the number that decides whether the
 * schedule is polite. A reader that only subtracts neighbours answers 1,080 minutes and admits a
 * source that is fetched twice inside six hours every single night.
 *
 * A SINGLE VALUE RETURNS THE WRAP, because one value fires once per revolution: hours {2} is a
 * daily schedule, not a two-hourly one. Returning the gap to itself — zero — would make every
 * once-a-day schedule the most frequent one there is, which is the failure in the direction that
 * costs somebody else bandwidth.
 *
 * Null only when there is nothing to measure at all, mirroring `public.research_min_circular_gap`
 * on an empty array.
 */
export function minCircularGap(values: readonly number[], wrap: number): number | null {
  const sorted = [...new Set(values)].sort((a, b) => a - b)
  if (sorted.length === 0) return null
  if (sorted.length === 1) return wrap

  let smallest = wrap
  for (let index = 0; index < sorted.length; index += 1) {
    const gap =
      index === sorted.length - 1
        ? wrap - sorted[sorted.length - 1]! + sorted[0]!
        : sorted[index + 1]! - sorted[index]!
    if (gap < smallest) smallest = gap
  }
  return smallest
}

/**
 * One cron field expanded to its values, under the SQL function's grammar rather than this file's.
 *
 * WHY THIS IS NOT `parseCronField`, WHICH READS THE SAME SYNTAX FORTY LINES ABOVE. The two answer
 * to different authorities, and what separates them is JavaScript's idea of a number. `Number()`
 * happily reads '0x1e', '+7' and '1e2'; `public.research_cron_field_values` tests every literal
 * against `^[0-9]+$` and reads none of them. `parseCronField` also treats an empty list item as a
 * zero, where the SQL returns null for a blank part. Reuse it here and this module answers 1440
 * for `0x1 3 * * *` and for `0, 3 * * *`, both of which the CHECK computes as 0 and refuses: the
 * form would call the schedule fine and the save would fail, which is precisely the failure this
 * module was extracted to prevent, in the one direction that matters.
 *
 * SO THE STRICT READER MIRRORS SQL AND `parseCronField` STAYS THE SCHEDULER'S. Keeping them apart
 * is the point rather than an oversight: the scheduler reads an expression a CHECK has already
 * admitted, so being generous there costs nothing, while being generous HERE would be a promise
 * the database does not keep.
 *
 * ONE DIVERGENCE IS LEFT AND IT IS NAMED. A literal too large for a PostgreSQL `int` raises inside
 * the CHECK rather than returning a number, while this reader refuses it and its caller answers 0.
 * Both refuse the write and only the wording differs — so no row of the shared test table asserts
 * an answer the database would not give.
 */
function intervalFieldValues(field: string, min: number, max: number): number[] | null {
  const trimmed = field.trim()
  if (trimmed === '') return null

  const values = new Set<number>()

  for (const part of trimmed.split(',')) {
    if (part.trim() === '') return null

    // `split_part(part, '/', 1)` and `split_part(part, '/', 2)`: everything before the first slash,
    // and whatever sits between the first and the second. A third segment is ignored on both sides.
    const segments = part.split('/')
    const range = segments[0] ?? ''
    const stepText = segments[1] === undefined || segments[1] === '' ? null : segments[1]

    let step = 1
    if (stepText !== null) {
      if (!/^[0-9]+$/.test(stepText)) return null
      step = Number(stepText)
    }
    if (step < 1) return null

    let start: number
    let end: number
    if (range === '*') {
      start = min
      end = max
    } else if (/^[0-9]+-[0-9]+$/.test(range)) {
      const [a, b] = range.split('-')
      start = Number(a)
      end = Number(b)
    } else if (/^[0-9]+$/.test(range)) {
      start = Number(range)
      end = start
    } else {
      return null
    }

    if (start < min || end > max || start > end) return null

    for (let value = start; value <= end; value += step) values.add(value)
  }

  return values.size === 0 ? null : [...values].sort((a, b) => a - b)
}

/**
 * The smallest gap in minutes between two fires of a five-field cron expression, or 0 when the
 * expression cannot be read.
 *
 * ZERO, NOT NULL AND NOT INFINITY, FOR SOMETHING UNREADABLE, and the SQL says why: a null makes
 * the constraint `null >= 360`, which is null, which PostgreSQL treats as satisfied — so an
 * unparseable expression would sail through the very CHECK written to catch it. `Infinity` would
 * be the same mistake in TypeScript with a friendlier face, the form calling the one expression
 * nobody can read the politest schedule in the set.
 *
 * IT READS THE MINUTE AND HOUR FIELDS ONLY, exactly as the SQL does. Restricting day-of-month or
 * day-of-week can only make a schedule LESS frequent, so ignoring them can never admit something
 * that fires too often — and a parser that reads less is a parser with less to disagree about.
 */
export function cronMinIntervalMinutes(expression: string): number {
  const fields = expression.trim().split(/\s+/)
  if (fields.length !== 5) return 0

  const minutes = intervalFieldValues(fields[0]!, 0, 59)
  const hours = intervalFieldValues(fields[1]!, 0, 23)
  if (minutes === null || hours === null) return 0

  // More than one minute selected means two fires inside one hour, whatever the hour field says.
  // The `?? 0` cannot happen — a list of more than one value always measures — and it resolves the
  // impossible case in the same direction as every other uncertainty here: refuse the schedule.
  if (minutes.length > 1) return minCircularGap(minutes, 60) ?? 0

  // One minute, several hours: the gap is between the hours, converted to minutes.
  if (hours.length > 1) return (minCircularGap(hours, 24) ?? 0) * 60

  // One minute, one hour: at most once a day, and any day restriction only widens it.
  return 1440
}
