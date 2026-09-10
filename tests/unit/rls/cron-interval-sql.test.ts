import { afterAll, describe, expect, it } from 'vitest'

import { MIN_SCHEDULE_INTERVAL_MINUTES, cronMinIntervalMinutes } from '@/lib/scraper/core/cron'

import { INTERVAL_CASES, label } from '../cron-interval-cases'
import { connect, disconnect } from './harness'

/**
 * The same twenty-one expressions, answered by the DATABASE.
 *
 * THE RULE EXISTS IN TWO PLACES BY DESIGN — as a CHECK on `research_source_schedules` that no
 * server action, script or hand-written UPDATE can step around, and in TypeScript so the Studio
 * form can say what is wrong before the write. Two copies of a rule drift, and the drift is
 * invisible until an operator saves a schedule the form called acceptable and the database refuses
 * with a constraint violation. `tests/unit/cron-interval-cases.ts` holds the table both halves are
 * asked; `tests/unit/source-schedules.test.ts` asks the TypeScript, and this asks the SQL.
 *
 * WHY IT IS HERE AND NOT BESIDE THE TYPESCRIPT, WHICH IS WHERE IT WAS. Phase 26 put it in the
 * `unit` project on the reasoning that it reads nothing, writes nothing and needs no fixture lock —
 * all true, and all beside the point. What decides where a database test belongs is WHEN CI RUNS
 * IT: `npm run test:unit` is step five of the workflow, before `db:reset`, against a database with
 * no migrations in it. `DATABASE_URL` is set for the whole job so the database gates further down
 * can use it, which is exactly why this did not skip — it connected, found no function, and failed.
 * Twenty-two assertions did, on every run from the moment Phase 26 merged.
 *
 * `tests/unit/rls/**` is the project that starts after the migrations and the seed, and it is
 * selected by directory alone. `RLS_TESTS_REQUIRED` makes a missing database a failure here rather
 * than a skip, which is the posture this comparison always wanted: a green run on a machine with no
 * cluster must never stand in for the constraint being exercised.
 *
 * IT STILL READS NOTHING AND WRITES NOTHING — every query is a scalar expression against no table —
 * but it takes the harness's client, and therefore `FIXTURE_LOCK`, because the suites it now runs
 * beside wipe tables outside any transaction.
 */

const REQUIRE_DB = process.env.CI === 'true' || process.env.RLS_TESTS_REQUIRED === '1'
const HAVE_DB = Boolean(process.env.DATABASE_URL)

if (REQUIRE_DB && !HAVE_DB) {
  throw new Error(
    'DATABASE_URL is not set and this environment requires the database suite to run. ' +
      'Refusing to skip: a skipped guard suite reports success while proving nothing.',
  )
}

const describeDb = HAVE_DB ? describe : describe.skip

afterAll(async () => {
  if (HAVE_DB) await disconnect()
})

describeDb('public.research_cron_min_interval_minutes', () => {
  for (const { expression, minutes, why } of INTERVAL_CASES) {
    it(`${label(expression)} → ${minutes} — ${why}`, async () => {
      const sql = await connect()
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
    const sql = await connect()
    const result = await sql.query<{ definition: string }>(
      'select pg_get_constraintdef(oid) as definition from pg_constraint where conname = $1',
      ['research_source_schedules_min_interval'],
    )
    expect(result.rows[0]?.definition).toContain(`>= ${MIN_SCHEDULE_INTERVAL_MINUTES}`)
  })
})
