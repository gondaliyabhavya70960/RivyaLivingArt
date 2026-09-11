import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FIXTURE_USERS, asAnon, asSession, connect, disconnect, loadFixture } from './harness'

/**
 * Phase 37 at the table: `analytics_snapshots` has row security and no anon leg; no session may
 * insert a row, the owner included; an editor (no `research.read`) reads the FIRST_PARTY rows and
 * not one COMPETITIVE row — decided by the policy predicate, so a direct request returns nothing
 * to hide; a researcher and a viewer read both; the reason travels with UNAVAILABLE and with
 * nothing else (the CHECK); one row per metric per day.
 */

const REQUIRE_DB = process.env.CI === 'true' || process.env.RLS_TESTS_REQUIRED === '1'
const HAVE_DB = Boolean(process.env.DATABASE_URL)
if (REQUIRE_DB && !HAVE_DB) {
  throw new Error(
    'DATABASE_URL is not set and this environment requires the database suite to run.',
  )
}
const describeDb = HAVE_DB ? describe : describe.skip

const asOwner = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.owner, fn)
const asEditor = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.editor, fn)
const asResearcher = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.researcher, fn)
const asViewer = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.viewer, fn)

const AS_OF = '2001-01-01'

async function cleanup(): Promise<void> {
  const db = await connect()
  await db.query('delete from analytics_snapshots where as_of = $1', [AS_OF])
}

beforeAll(async () => {
  await loadFixture()
  await cleanup()
  const db = await connect()
  // Two rows the service role wrote: a first-party true zero and a competitive reading.
  await db.query(
    `insert into analytics_snapshots (metric_id, dimension, as_of, value, n, denominator, availability)
     values ('catalog', 'FIRST_PARTY', $1, '{"figure": 0, "unit": "count"}', 0, 0, 'AVAILABLE'),
            ('assortment', 'COMPETITIVE', $1, '{"figure": 12, "unit": "count"}', 12, 40, 'AVAILABLE')`,
    [AS_OF],
  )
})

afterAll(async () => {
  await cleanup()
  await disconnect()
})

describeDb('analytics_snapshots — Phase 37', () => {
  it('has row security on and no anon policy', async () => {
    const db = await connect()
    const rls = await db.query(
      "select relrowsecurity from pg_class where relname = 'analytics_snapshots'",
    )
    expect(rls.rows[0]?.relrowsecurity).toBe(true)
    const anon = await db.query(
      "select count(*)::int as n from pg_policies where tablename = 'analytics_snapshots' and 'anon' = any(roles)",
    )
    expect(anon.rows[0]?.n).toBe(0)
    const visible = await asAnon((sql) =>
      sql.rows('select metric_id from analytics_snapshots where as_of = $1', [AS_OF]),
    )
    expect(visible).toHaveLength(0)
  })

  it('refuses every session an insert, the owner included', async () => {
    const attempt = await asOwner((sql) =>
      sql.attempt(
        `insert into analytics_snapshots (metric_id, dimension, as_of, value, availability)
         values ('catalog', 'FIRST_PARTY', '2001-01-02', '{}', 'AVAILABLE')`,
      ),
    )
    expect(attempt.ok).toBe(false)
  })

  it('shows an editor the first-party row and not the competitive one', async () => {
    const rows = await asEditor((sql) =>
      sql.rows<{ metric_id: string }>(
        'select metric_id from analytics_snapshots where as_of = $1 order by metric_id',
        [AS_OF],
      ),
    )
    expect(rows.map((row) => row.metric_id)).toEqual(['catalog'])
  })

  it('shows a researcher and a viewer both rows', async () => {
    for (const as of [asResearcher, asViewer]) {
      const rows = await as((sql) =>
        sql.rows<{ metric_id: string }>(
          'select metric_id from analytics_snapshots where as_of = $1 order by metric_id',
          [AS_OF],
        ),
      )
      expect(rows.map((row) => row.metric_id)).toEqual(['assortment', 'catalog'])
    }
  })

  it('makes an unexplained unavailable row, and an explained available one, unstorable', async () => {
    const db = await connect()
    const unexplained = db
      .query(
        `insert into analytics_snapshots (metric_id, dimension, as_of, value, availability)
         values ('colours', 'COMPETITIVE', $1, '{}', 'UNAVAILABLE')`,
        [AS_OF],
      )
      .then(
        () => 'stored',
        (error: unknown) => (error instanceof Error ? error.message : 'error'),
      )
    expect(await unexplained).toMatch(/reason_iff_unavailable/u)
    const explained = db
      .query(
        `insert into analytics_snapshots (metric_id, dimension, as_of, value, availability, unavailable_reason)
         values ('colours', 'COMPETITIVE', $1, '{}', 'AVAILABLE', 'but it is fine')`,
        [AS_OF],
      )
      .then(
        () => 'stored',
        (error: unknown) => (error instanceof Error ? error.message : 'error'),
      )
    expect(await explained).toMatch(/reason_iff_unavailable/u)
    const blank = db
      .query(
        `insert into analytics_snapshots (metric_id, dimension, as_of, value, availability, unavailable_reason)
         values ('colours', 'COMPETITIVE', $1, '{}', 'UNAVAILABLE', '   ')`,
        [AS_OF],
      )
      .then(
        () => 'stored',
        (error: unknown) => (error instanceof Error ? error.message : 'error'),
      )
    expect(await blank).toMatch(/reason_not_blank/u)
  })

  it('holds one row per metric per day', async () => {
    const db = await connect()
    const duplicate = db
      .query(
        `insert into analytics_snapshots (metric_id, dimension, as_of, value, availability)
         values ('catalog', 'FIRST_PARTY', $1, '{}', 'AVAILABLE')`,
        [AS_OF],
      )
      .then(
        () => 'stored',
        (error: unknown) => (error instanceof Error ? error.message : 'error'),
      )
    expect(await duplicate).toMatch(/metric_per_day/u)
  })

  it('refuses a dimension outside the two, and n above the denominator', async () => {
    const db = await connect()
    const dimension = db
      .query(
        `insert into analytics_snapshots (metric_id, dimension, as_of, value, availability)
         values ('catalog', 'PUBLIC', '2001-01-03', '{}', 'AVAILABLE')`,
      )
      .then(
        () => 'stored',
        (error: unknown) => (error instanceof Error ? error.message : 'error'),
      )
    expect(await dimension).toMatch(/dimension_allowed/u)
    const counts = db
      .query(
        `insert into analytics_snapshots (metric_id, dimension, as_of, value, n, denominator, availability)
         values ('catalog', 'FIRST_PARTY', '2001-01-03', '{}', 5, 4, 'AVAILABLE')`,
      )
      .then(
        () => 'stored',
        (error: unknown) => (error instanceof Error ? error.message : 'error'),
      )
    expect(await counts).toMatch(/n_within_denominator/u)
  })
})
