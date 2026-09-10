import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { connect, disconnect } from './harness'

import {
  SOURCE_HEALTH_COLUMNS,
  SOURCE_HEALTH_STATES,
} from '@/lib/supabase/repositories/research/source-health'

/**
 * The five health states, proved by driving the database into each one and reading the view back.
 *
 * THIS IS PHASE 26 VERIFICATION STEP 7, WRITTEN DOWN. That step is a sequence of `psql` commands —
 * force two failed runs and see FAILING, succeed and see HEALTHY, age the success past twice the
 * interval and see STALE. A checklist item nobody re-runs is a checklist item that stops being
 * true, so it is a test instead, and it inserts the run histories itself rather than trusting a
 * fixture to have the right shape.
 *
 * WHY THE VIEW HAS TO BE EXERCISED RATHER THAN READ. `research_source_health_v` is a CASE over five
 * joined CTEs, and every mistake it can make is silent: a branch in the wrong order returns a
 * plausible state, an `array_length` off by one returns HEALTHY for a source that has failed twice,
 * a wrap-around in the interval arithmetic returns HEALTHY for a source that has not run in a week.
 * None of those is a type error, none is a constraint violation, and all of them read as a green
 * badge on the screen an operator checks during an incident. The only way to know the CASE is right
 * is to put a source in each state and ask.
 *
 * WHY IT LIVES IN THE `rls` PROJECT, AND WHY IT DID NOT — A DEFECT THIS FILE CAUSED.
 *
 * Phase 26 put it in the `unit` project, reasoning that it needs a real cluster but not the RLS
 * harness: it asserts what the view COMPUTES, not who may read it. That reasoning was about the
 * ADVISORY LOCK and it missed the thing that actually decides where a database test belongs —
 * WHEN CI RUNS IT. `npm run test:unit` is step five of the workflow, before `db:reset`, against a
 * database with no migrations in it; `ci.yml` says so in as many words, because the unit project is
 * supposed to need no database at all. So every assertion here failed on `main` from the moment
 * Phase 26 merged, and went on failing through two more merges.
 *
 * `tests/unit/rls/**` is the project that runs AFTER the migrations and the seed, and it is
 * selected by directory alone. Moving the file is the whole fix.
 *
 * IT TAKES THE HARNESS'S CLIENT, AND THEREFORE ITS ADVISORY LOCK. Holding a private `pg` client
 * was safe while this file ran in a project of its own; in the `rls` project it would run beside
 * suites whose `loadFixture` wipes tables outside any transaction, and a wipe landing mid-run is
 * exactly what `FIXTURE_LOCK` exists to prevent. It still creates and cleans up only its own
 * `p26h-` rows.
 *
 * IT NO LONGER SKIPS WHEN `DATABASE_URL` IS UNSET IN CI. Nothing here can be answered without a
 * cluster — the subject is a SQL expression — so a skipped run proves nothing and must not be
 * mistaken for one that did. `RLS_TESTS_REQUIRED` turns the absence into a failure, which is the
 * posture every other file in this directory takes.
 *
 * `scripts/db/check-unit-tests-offline.mjs` now fails the build if a unit-project test reaches for
 * a database again, so the invariant is enforced rather than described.
 *
 * NO REAL HOST APPEARS. Every base URL is under the reserved `.example` top-level domain and every
 * label is invented; nothing in this file names, or could be mistaken for, a real business.
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

/** The harness's client, which holds `FIXTURE_LOCK` — see the header. */
async function db(): Promise<pg.Client> {
  return connect()
}

/**
 * A reviewer, because an ENABLED source needs one.
 *
 * `research_sources_enabled_requires_approval` refuses an enabled source that is not APPROVED, and
 * `research_sources_approval_is_attributed` refuses an approval that names nobody — so five of the
 * eight sources below cannot exist without a real `auth.users` row to point at. That is the schema
 * working: there is no way to fabricate a running source without also fabricating the person who
 * said it could run.
 */
const REVIEWER_ID = '00000000-0000-4000-8000-000000026a00'

/** Ids in a block no other suite uses. `tests/unit/rls/phase26.test.ts` owns `…00000026 0x`. */
const SOURCE = {
  healthy: '00000000-0000-4000-8000-000000026a01',
  failingRuns: '00000000-0000-4000-8000-000000026a02',
  degraded: '00000000-0000-4000-8000-000000026a03',
  staleAgedSuccess: '00000000-0000-4000-8000-000000026a04',
  failingCircuit: '00000000-0000-4000-8000-000000026a05',
  disabled: '00000000-0000-4000-8000-000000026a06',
  neverRan: '00000000-0000-4000-8000-000000026a07',
  staleNeverRan: '00000000-0000-4000-8000-000000026a08',
} as const

/** Twice this is the staleness threshold: a twelve-hour schedule is stale after a day. */
const TWELVE_HOURLY = '0 */12 * * *'
const TWELVE_HOURLY_MINUTES = 720

interface HealthCase {
  readonly id: string
  readonly label: string
  /** What the view must answer. */
  readonly health: string
  /** Which branch of the CASE decides it, and what a plausible bug would have answered instead. */
  readonly why: string
}

const CASES: readonly HealthCase[] = [
  {
    id: SOURCE.healthy,
    label: 'a recent success against a twelve-hour schedule',
    health: 'HEALTHY',
    why: 'nothing above it fires and the success is well inside twice the interval',
  },
  {
    id: SOURCE.failingRuns,
    label: 'two failed runs after an older success',
    health: 'FAILING',
    why: 'the LAST TWO decide, not the whole history — a rule that read every run would say DEGRADED',
  },
  {
    id: SOURCE.degraded,
    label: 'a PARTIAL last run on an otherwise 80 % record',
    health: 'DEGRADED',
    why: 'the PARTIAL branch alone: four of five succeeded, so the rate branch is exactly not below 0.8',
  },
  {
    id: SOURCE.staleAgedSuccess,
    label: 'a success three days old against a twelve-hour schedule',
    health: 'STALE',
    why: 'twice 720 minutes is a day; a perfect record does not stop a source having stopped running',
  },
  {
    id: SOURCE.failingCircuit,
    label: 'an open circuit over a run that succeeded half an hour ago',
    health: 'FAILING',
    why: 'the circuit outranks the run history — reading the history alone would answer HEALTHY',
  },
  {
    id: SOURCE.disabled,
    label: 'a disabled source with an open circuit and two failed runs',
    health: 'DISABLED',
    why: 'DISABLED is first in the CASE: a source somebody switched off is off, not failing',
  },
  {
    id: SOURCE.neverRan,
    label: 'a source that has never run and is not scheduled',
    health: 'HEALTHY',
    why: 'staleness needs a promise to be late against; nobody said when this one should run',
  },
  {
    id: SOURCE.staleNeverRan,
    label: 'a source scheduled a month ago that has never succeeded',
    health: 'STALE',
    why: 'created_at stands in for the missing success, so an unrun schedule is late rather than fine',
  },
]

interface HealthRow {
  readonly source_id: string
  readonly last_run_at: string | null
  readonly last_run_status: string | null
  readonly success_rate_7d: string | null
  readonly queue_depth: number
  readonly interval_minutes: number | null
  readonly last_success_at: string | null
  readonly health: string
}

async function readHealth(sourceId: string): Promise<HealthRow> {
  const sql = await db()
  const { rows } = await sql.query<HealthRow>(
    `select ${SOURCE_HEALTH_COLUMNS} from research_source_health_v where source_id = $1`,
    [sourceId],
  )
  const row = rows[0]
  if (row === undefined) {
    throw new Error(
      `No health row for ${sourceId} — the view left-joins from research_sources, so ` +
        'a missing row means the source was never inserted.',
    )
  }
  return row
}

/** One source. `enabled` implies APPROVED, because the table will not have it any other way. */
async function insertSource(
  id: string,
  slug: string,
  options: {
    readonly enabled: boolean
    readonly circuitOpen?: boolean
    readonly createdDaysAgo?: number
  },
): Promise<void> {
  const sql = await db()
  await sql.query(
    `insert into research_sources
       (id, slug, name, base_url, region, currency, source_type, analytics_league,
        collection_mode, is_enabled, policy_status, policy_reviewed_by, policy_reviewed_at,
        circuit_open_until, created_at)
     values ($1, $2, $3, $4, 'IN', 'INR', 'BRAND', 'PEER', 'SEED_URLS', $5,
             $6, $7, $8,
             case when $9::boolean then now() + interval '1 hour' else null end,
             now() - make_interval(days => $10::int))`,
    [
      id,
      slug,
      `Phase 26 health fixture ${slug}`,
      `https://${slug}.example`,
      options.enabled,
      options.enabled ? 'APPROVED' : 'UNREVIEWED',
      options.enabled ? REVIEWER_ID : null,
      options.enabled ? new Date().toISOString() : null,
      options.circuitOpen ?? false,
      options.createdDaysAgo ?? 30,
    ],
  )
}

/**
 * One finished run, aged.
 *
 * All three timestamps are set to the same moment. `research_runs_finished_has_started` refuses a
 * finish with no start, and the view orders by `coalesce(finished_at, started_at, queued_at)`, so a
 * run that is finished must be aged at its finish or it sorts in the wrong place.
 */
async function insertRun(sourceId: string, status: string, minutesAgo: number): Promise<string> {
  const sql = await db()
  const { rows } = await sql.query<{ id: string }>(
    `insert into research_runs (source_id, status, queued_at, started_at, finished_at)
     values ($1, $2::research_run_status,
             now() - make_interval(mins => $3::int),
             now() - make_interval(mins => $3::int),
             now() - make_interval(mins => $3::int))
     returning id`,
    [sourceId, status, minutesAgo],
  )
  const id = rows[0]?.id
  if (id === undefined) throw new Error('research_runs insert returned no id')
  return id
}

async function insertSchedule(sourceId: string, cronExpression: string): Promise<void> {
  const sql = await db()
  await sql.query(
    `insert into research_source_schedules (source_id, job_type, cron_expression, is_enabled)
     values ($1, 'REFRESH', $2, true)`,
    [sourceId, cronExpression],
  )
}

async function seed(): Promise<void> {
  const sql = await db()

  await sql.query(`insert into auth.users (id, email) values ($1, 'p26-health@fixture.test')`, [
    REVIEWER_ID,
  ])

  // HEALTHY — a success an hour ago, scheduled twelve-hourly. Both the rate branch and the
  // staleness branch have something to look at and neither fires.
  await insertSource(SOURCE.healthy, 'p26h-healthy', { enabled: true })
  await insertSchedule(SOURCE.healthy, TWELVE_HOURLY)
  const healthyRun = await insertRun(SOURCE.healthy, 'SUCCEEDED', 60)

  /*
   * QUEUE DEPTH, ON THE ONE SOURCE THAT HAS WORK. `PENDING` and `LEASED` are outstanding; `DONE` is
   * not. Counting the third would make the dashboard's queue figure grow for ever and never fall,
   * which is the failure a reader would never question because the number keeps moving.
   */
  await sql.query(
    `insert into research_work_items (run_id, source_id, url, state, lease_until) values
       ($1, $2, 'https://p26h-healthy.example/a', 'PENDING', null),
       ($1, $2, 'https://p26h-healthy.example/b', 'PENDING', null),
       ($1, $2, 'https://p26h-healthy.example/c', 'LEASED',  now() + interval '5 minutes'),
       ($1, $2, 'https://p26h-healthy.example/d', 'DONE',    null)`,
    [healthyRun, SOURCE.healthy],
  )

  // FAILING by run history. The older success is the point: it proves the rule reads the last two
  // rather than the whole record.
  await insertSource(SOURCE.failingRuns, 'p26h-failing-runs', { enabled: true })
  await insertRun(SOURCE.failingRuns, 'SUCCEEDED', 300)
  await insertRun(SOURCE.failingRuns, 'FAILED', 200)
  await insertRun(SOURCE.failingRuns, 'FAILED', 100)

  // DEGRADED by a PARTIAL last run, and ONLY by that. Four successes and one partial is a 7-day
  // rate of exactly 0.8, which the rate branch tests with `< 0.8` — so it does not fire, and a
  // DEGRADED answer here can have come from nowhere else.
  await insertSource(SOURCE.degraded, 'p26h-degraded', { enabled: true })
  await insertRun(SOURCE.degraded, 'SUCCEEDED', 500)
  await insertRun(SOURCE.degraded, 'SUCCEEDED', 400)
  await insertRun(SOURCE.degraded, 'SUCCEEDED', 300)
  await insertRun(SOURCE.degraded, 'SUCCEEDED', 200)
  await insertRun(SOURCE.degraded, 'PARTIAL', 100)

  // STALE — three days since the last success against a schedule that promised twelve hours.
  await insertSource(SOURCE.staleAgedSuccess, 'p26h-stale', { enabled: true })
  await insertSchedule(SOURCE.staleAgedSuccess, TWELVE_HOURLY)
  await insertRun(SOURCE.staleAgedSuccess, 'SUCCEEDED', 3 * 24 * 60)

  // FAILING by an open circuit, over a run history that would otherwise read HEALTHY.
  await insertSource(SOURCE.failingCircuit, 'p26h-circuit', { enabled: true, circuitOpen: true })
  await insertRun(SOURCE.failingCircuit, 'SUCCEEDED', 30)

  // DISABLED, carrying everything that would otherwise say FAILING twice over.
  await insertSource(SOURCE.disabled, 'p26h-disabled', { enabled: false, circuitOpen: true })
  await insertRun(SOURCE.disabled, 'FAILED', 20)
  await insertRun(SOURCE.disabled, 'FAILED', 10)

  // HEALTHY with nothing at all: no runs, no schedule, nothing late.
  await insertSource(SOURCE.neverRan, 'p26h-never-ran', { enabled: true })

  // STALE with nothing at all except a promise. `created_at` stands in for the success that never
  // happened, so a source configured a month ago and never run is late rather than fine.
  await insertSource(SOURCE.staleNeverRan, 'p26h-stale-never-ran', { enabled: true })
  await insertSchedule(SOURCE.staleNeverRan, TWELVE_HOURLY)
}

/**
 * Everything this file created, in dependency order.
 *
 * Runs before the seed as well as after it, so a previous crashed run cannot make this one fail on
 * a duplicate id and leave a reader hunting a bug in the view.
 */
async function cleanup(): Promise<void> {
  const sql = await db()
  // Runs, work items, schedules and search documents all cascade from the source.
  await sql.query(`delete from research_sources where slug like 'p26h-%'`)
  // `staff_profiles.user_id` cascades from `auth.users`, so the profile the signup trigger made
  // goes with it.
  await sql.query('delete from auth.users where id = $1', [REVIEWER_ID])
}

beforeAll(async () => {
  if (!HAVE_DB) return
  await cleanup()
  await seed()
})

afterAll(async () => {
  if (!HAVE_DB) return
  await cleanup()
  // Releases FIXTURE_LOCK before closing, so the next waiting suite starts immediately rather than
  // after the server notices a dead connection. See the harness.
  await disconnect()
})

describeDb('research_source_health_v — the five derived states', () => {
  it.each(CASES)('$label → $health', async ({ id, health, why }) => {
    const row = await readHealth(id)
    expect(row.health, why).toBe(health)
  })

  it('produces every state this module can name, and no other', async () => {
    // TWO CLAIMS IN ONE, and both matter. That the fixture reaches all five states, so none of the
    // assertions above is quietly covering for a state nobody exercises; and that the view never
    // answers something `SOURCE_HEALTH_STATES` has no name for, which is what would reach Studio as
    // an unstyled badge and Phase 31 as a group nobody defined.
    const observed = new Set<string>()
    for (const { id } of CASES) observed.add((await readHealth(id)).health)

    expect([...observed].sort()).toEqual([...SOURCE_HEALTH_STATES].sort())
  })
})

describeDb('research_source_health_v — the columns beside the verdict', () => {
  it('counts PENDING and LEASED work, and nothing else', async () => {
    const row = await readHealth(SOURCE.healthy)
    expect(row.queue_depth).toBe(3)
  })

  it('reports an empty queue as zero rather than as nothing', async () => {
    // `coalesce(queue.depth, 0)` in the view. A null here would render as a blank cell on the
    // dashboard beside sources showing real numbers, which reads as "unknown" rather than "none".
    const row = await readHealth(SOURCE.neverRan)
    expect(row.queue_depth).toBe(0)
  })

  it('reports the seven-day success rate to three decimals', async () => {
    const row = await readHealth(SOURCE.degraded)
    // `numeric` reaches this driver as a string and reaches PostgREST as a JSON number; the Zod
    // schema in source-health.ts parses the latter, which is why the conversion is here and not
    // there.
    expect(Number(row.success_rate_7d)).toBe(0.8)
  })

  it('reports no rate at all when there were no runs to rate', async () => {
    // Not zero. A source that has not run has no success rate, and 0 would read as "every run
    // failed" — the opposite of the truth, on the tile an operator scans first.
    const row = await readHealth(SOURCE.neverRan)
    expect(row.success_rate_7d).toBeNull()
  })

  it('reports the last run and its status', async () => {
    const row = await readHealth(SOURCE.degraded)
    expect(row.last_run_status).toBe('PARTIAL')
    expect(row.last_run_at).not.toBeNull()
    // The PARTIAL is the newest run; the last SUCCESS is the older one, and the two columns are
    // separate precisely so a source can be both recently active and long unsuccessful.
    expect(row.last_success_at).not.toBeNull()
    expect(Date.parse(String(row.last_success_at))).toBeLessThan(
      Date.parse(String(row.last_run_at)),
    )
  })

  it('reports the interval of the most frequent enabled schedule, or none', async () => {
    expect((await readHealth(SOURCE.healthy)).interval_minutes).toBe(TWELVE_HOURLY_MINUTES)
    expect((await readHealth(SOURCE.neverRan)).interval_minutes).toBeNull()
  })
})

describeDb('research_source_health_v — the repository reads the view that exists', () => {
  it('names every column the view has, and no column it does not', async () => {
    /*
     * THE ONE MISTAKE THIS MODULE CAN MAKE THAT NOTHING ELSE WOULD CATCH. A select list is a
     * string: TypeScript cannot check it, and a column renamed by a later migration leaves
     * `SOURCE_HEALTH_COLUMNS` naming something that no longer exists. PostgREST answers 42703 and
     * the first person to find out is whoever opened the sources page.
     *
     * BOTH DIRECTIONS ARE ASSERTED. A missing column is the failure above. An EXTRA column in the
     * view is quieter and worth catching too: it means somebody added a fact to the health rule
     * that Studio is not reading, and the honest response is to decide whether to render it rather
     * than to leave it unread for a phase.
     *
     * This is also the check that would have caught `owner_verification` in `sources.ts`, which
     * named a column `research_sources` has never had.
     */
    const sql = await db()
    const { rows } = await sql.query<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'research_source_health_v'`,
    )

    const inView = rows.map((row) => row.column_name).sort()
    const inRepository = SOURCE_HEALTH_COLUMNS.split(',')
      .map((name) => name.trim())
      .sort()

    expect(inRepository).toEqual(inView)
  })
})
