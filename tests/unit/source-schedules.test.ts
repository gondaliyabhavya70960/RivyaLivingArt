import { describe, expect, it } from 'vitest'

import {
  MIN_SCHEDULE_INTERVAL_MINUTES,
  cronMinIntervalMinutes,
  minCircularGap,
} from '@/lib/scraper/core/cron'
import { nextCronRun, parseCronField } from '@/lib/scraper/workflows/schedule'

import { INTERVAL_CASES, label } from './cron-interval-cases'

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

/*
 * THE DATABASE HALF OF THIS FILE MOVED TO `tests/unit/rls/cron-interval-sql.test.ts`, and the move
 * fixed a defect rather than tidying anything.
 *
 * It ran here, in the `unit` project, and `ci.yml` runs `npm run test:unit` as step five — BEFORE
 * `db:reset`, against a database with no migrations in it. `DATABASE_URL` is set for the whole job
 * so the database gates further down can use it, which is precisely why a unit test that reaches
 * for a cluster does not skip: it connects, finds nothing, and fails. Twenty-two of them did, on
 * every run since Phase 26 merged.
 *
 * The comparison itself is unchanged and still runs against the same twenty-one expressions; it
 * now runs in the project that starts after the migrations, where a missing database is a hard
 * failure rather than a silent skip. What stays here is what needs no cluster at all.
 */
