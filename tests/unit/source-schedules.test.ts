import pg from 'pg'
import { afterAll, describe, expect, it } from 'vitest'

import {
  MIN_SCHEDULE_INTERVAL_MINUTES,
  cronMinIntervalMinutes,
  minCircularGap,
} from '@/lib/scraper/core/cron'
import { nextCronRun, parseCronField } from '@/lib/scraper/workflows/schedule'

/**
 * The six-hour minimum, asserted twice against one table.
 *
 * THE RULE EXISTS IN TWO PLACES BY DESIGN — as a CHECK on `research_source_schedules` that no
 * server action, script or hand-written UPDATE can step around, and in TypeScript so the Studio
 * form can say what is wrong before the write. Two copies of a rule drift, and the drift is
 * invisible until an operator saves a schedule the form called acceptable and the database refuses
 * with a constraint violation. This file is what stops that: ONE table of expressions, run through
 * `cronMinIntervalMinutes` and then — whenever DATABASE_URL is set — through
 * `public.research_cron_min_interval_minutes` itself, row for row.
 *
 * THE INTERESTING ANSWER IS 360, NOT 5. Anyone can see that a five-minute schedule is too frequent.
 * The rows worth having are the ones where a plausible reading gives the wrong number: `0 0,18` is
 * a SIX-hour gap across midnight rather than an eighteen-hour one inside the day, and `0x1 3` looks
 * like a daily schedule to JavaScript and like an unreadable expression to PostgreSQL.
 */

interface IntervalCase {
  /** The expression as an operator would type it into the schedule form. */
  readonly expression: string
  /** What BOTH implementations must answer, in minutes. */
  readonly minutes: number
  /** Which rule decides it — what a future reader needs, rather than the arithmetic. */
  readonly why: string
}

/**
 * Every example the SQL function's own comments give, the phase document's refusal case, and the
 * three ways the two grammars could disagree.
 *
 * NOTHING HERE ASSERTS AN ANSWER THE DATABASE WOULD NOT GIVE. An integer literal too large for a
 * PostgreSQL `int` is the one input where the two differ — SQL raises inside the CHECK, TypeScript
 * refuses the field and answers 0 — so no row uses one. Both refuse the write; only the wording is
 * different, and a row asserting a number here would fail the database half for the wrong reason.
 */
const INTERVAL_CASES: readonly IntervalCase[] = [
  {
    expression: '*/5 * * * *',
    minutes: 5,
    why: 'twelve minutes selected in the hour, five apart — the phase document’s refusal case',
  },
  {
    expression: '0 */6 * * *',
    minutes: 360,
    why: 'one minute, four hours six apart: exactly the floor, and therefore acceptable',
  },
  {
    expression: '0 */4 * * *',
    minutes: 240,
    why: 'the same shape one step too fast, which is the only reason 360 is a boundary worth having',
  },
  {
    expression: '0 0,18 * * *',
    minutes: 360,
    why: 'the wrap IS the answer: midnight to 18:00 is eighteen hours, 18:00 to midnight is six',
  },
  {
    expression: '0 0,1 * * *',
    minutes: 60,
    why: 'two adjacent hours — the gap inside the day, not the twenty-three-hour one around it',
  },
  {
    expression: '0,45 * * * *',
    minutes: 15,
    why: 'minutes wrap at 60 exactly as hours wrap at 24: 45 → 00 is fifteen minutes',
  },
  {
    expression: '0,30 3 * * *',
    minutes: 30,
    why: 'more than one minute selected means two fires inside one hour, whatever the hour says',
  },
  {
    expression: '0-10/5 * * * *',
    minutes: 5,
    why: 'a range with a step is a list of minutes like any other',
  },
  {
    expression: '30 3 * * *',
    minutes: 1440,
    why: 'one minute, one hour: at most once a day',
  },
  {
    expression: '0 2 * * *',
    minutes: 1440,
    why: 'the SQL comment’s own example — hours {2} is a daily schedule, not a two-hourly one',
  },
  {
    expression: '0 0 1 * *',
    minutes: 1440,
    why: 'a day-of-month restriction only ever makes a schedule less frequent, so it is ignored',
  },
  {
    expression: '0 3 * * 1',
    minutes: 1440,
    why: 'and so does a day-of-week restriction — neither can admit something that fires too often',
  },
  {
    expression: '  0   3   *   *   *  ',
    minutes: 1440,
    why: 'both sides trim and split on runs of whitespace, so padding changes nothing',
  },
  {
    expression: '0 24 * * *',
    minutes: 0,
    why: 'hour 24 is outside 0–23, and an out-of-range value is unreadable rather than clamped',
  },
  {
    expression: '0 0 * * * *',
    minutes: 0,
    why: 'six fields is not this grammar, and the sixth would be seconds — far below the floor',
  },
  {
    expression: 'not a cron',
    minutes: 0,
    why: 'three fields: unreadable, and unreadable is 0 so the CHECK refuses it',
  },
  {
    expression: '',
    minutes: 0,
    why: 'the empty string splits to one field, not five',
  },
  {
    expression: 'a b c d e',
    minutes: 0,
    why: 'five fields that are not numbers — the shape is right and the grammar is not',
  },
  {
    expression: '0x1 3 * * *',
    minutes: 0,
    why: 'JavaScript reads 0x1 as one; PostgreSQL’s ^[0-9]+$ reads nothing, so the answer is 0',
  },
  {
    expression: '0, 3 * * *',
    minutes: 0,
    why: 'a blank list item is null in SQL — not a zero, which is what Number("") would make it',
  },
  {
    expression: '0/ 3 * * *',
    minutes: 1440,
    why: 'an empty step is no step on both sides, so this is the daily schedule it looks like',
  },
]

const label = (expression: string) => JSON.stringify(expression)

describe('cronMinIntervalMinutes', () => {
  for (const { expression, minutes, why } of INTERVAL_CASES) {
    it(`${label(expression)} → ${minutes} — ${why}`, () => {
      expect(cronMinIntervalMinutes(expression)).toBe(minutes)
    })
  }

  it('answers 0 rather than null or Infinity for an unreadable expression', () => {
    // THE REASON IS IN THE SQL AND IT IS NOT A STYLE CHOICE. A null makes the constraint
    // `null >= 360`, which is null, which PostgreSQL treats as satisfied — so the expression
    // nobody can read would pass the very CHECK written to catch it. Infinity is the same mistake
    // wearing a friendlier face: it would make the worst expression in the set the politest.
    const unreadable = cronMinIntervalMinutes('a b c d e')
    expect(unreadable).toBe(0)
    expect(Number.isFinite(unreadable)).toBe(true)
    expect(unreadable).toBeLessThan(MIN_SCHEDULE_INTERVAL_MINUTES)
  })
})

describe('the six-hour floor', () => {
  it('is the number the migration checks against', () => {
    expect(MIN_SCHEDULE_INTERVAL_MINUTES).toBe(360)
  })

  /**
   * The same table read as the CHECK reads it: `>= 360` accepts, everything else is refused. This
   * is the assertion the Studio form makes, so the split it produces is the split an operator sees.
   */
  it('accepts exactly the schedules whose smallest gap is six hours or wider', () => {
    const accepted = INTERVAL_CASES.filter(
      ({ expression }) => cronMinIntervalMinutes(expression) >= MIN_SCHEDULE_INTERVAL_MINUTES,
    ).map(({ expression }) => expression)

    expect(accepted).toEqual([
      '0 */6 * * *',
      '0 0,18 * * *',
      '30 3 * * *',
      '0 2 * * *',
      '0 0 1 * *',
      '0 3 * * 1',
      '  0   3   *   *   *  ',
      '0/ 3 * * *',
    ])
  })
})

describe('minCircularGap', () => {
  it('returns the wrap for a single value, because one value fires once per revolution', () => {
    // Hours {2} is a daily schedule. Returning the gap from a value to itself — zero — would make
    // every once-a-day schedule the most frequent one there is.
    expect(minCircularGap([2], 24)).toBe(24)
    expect(minCircularGap([0], 60)).toBe(60)
  })

  it('measures across the wrap, which is the common case rather than the edge one', () => {
    expect(minCircularGap([0, 18], 24)).toBe(6)
    expect(minCircularGap([0, 45], 60)).toBe(15)
  })

  it('takes the smallest gap, not the first or the last', () => {
    expect(minCircularGap([0, 1, 12], 24)).toBe(1)
  })

  it('ignores order and duplicates, as `select distinct … order by 1` does', () => {
    expect(minCircularGap([18, 0, 18], 24)).toBe(6)
  })

  it('has nothing to measure on an empty list, and says so with null', () => {
    expect(minCircularGap([], 24)).toBeNull()
  })
})

describe('the grammar re-exported from workflows/schedule.ts', () => {
  /**
   * The move is only invisible if the old names still work. `nextCronRun` and `parseCronField` now
   * live in `lib/scraper/core/cron.ts`; every Phase 25 caller imports them from the workflow
   * module, and this is what says so.
   */
  it('still answers from its old home', () => {
    const from = new Date('2026-09-10T03:29:00Z')
    expect(nextCronRun('30 3 * * *', from)?.toISOString()).toBe('2026-09-10T03:30:00.000Z')
    expect(parseCronField('1-5', 0, 59)).toEqual(new Set([1, 2, 3, 4, 5]))
  })
})

/**
 * The same table, answered by the database.
 *
 * SKIPPED WHEN DATABASE_URL IS UNSET, and the skip is why the SQL half is ALSO proved by
 * `tests/unit/rls/phase26.test.ts`: that file runs in the `rls` project, which refuses to skip in
 * CI, so a green run here on a machine with no cluster never stands in for the constraint being
 * exercised. What this block adds is the comparison — the two implementations answering the same
 * twenty-one expressions identically — which is the only thing that catches drift between them.
 *
 * It reads nothing and writes nothing: every query is a scalar expression against no table, so it
 * takes no fixture lock and belongs in the `unit` project beside the TypeScript it is checking.
 */
const { Client } = pg
const connectionString = process.env.DATABASE_URL
const describeDb = connectionString === undefined ? describe.skip : describe

let client: pg.Client | null = null

async function db(): Promise<pg.Client> {
  if (!client) {
    client = new Client({ connectionString })
    await client.connect()
  }
  return client
}

afterAll(async () => {
  if (client) {
    await client.end()
    client = null
  }
})

describeDb('public.research_cron_min_interval_minutes', () => {
  for (const { expression, minutes, why } of INTERVAL_CASES) {
    it(`${label(expression)} → ${minutes} — ${why}`, async () => {
      const sql = await db()
      const result = await sql.query<{ answer: number }>(
        'select research_cron_min_interval_minutes($1) as answer',
        [expression],
      )
      expect(result.rows[0]?.answer).toBe(minutes)
      // Stated as an equality rather than as two numbers that happen to match: the point of the
      // row is that the form and the constraint agree, not that either is 360.
      expect(result.rows[0]?.answer).toBe(cronMinIntervalMinutes(expression))
    })
  }

  it('checks schedules against the same floor this module exports', async () => {
    // The constant is the form's copy of the number in the CHECK. Reading the constraint back is
    // what stops the two being edited apart — a form that refuses at 360 while the table refuses
    // at 720 is a form that promises what the database will not accept.
    const sql = await db()
    const result = await sql.query<{ definition: string }>(
      'select pg_get_constraintdef(oid) as definition from pg_constraint where conname = $1',
      ['research_source_schedules_min_interval'],
    )
    expect(result.rows[0]?.definition).toContain(`>= ${MIN_SCHEDULE_INTERVAL_MINUTES}`)
  })
})
