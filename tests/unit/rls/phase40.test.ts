import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FIXTURE_USERS, asAnon, asSession, connect, disconnect, loadFixture } from './harness'

/**
 * Phase 40 at the table.
 *
 * THE FIRST TEST IS THE ONE THAT MATTERS AND IT IS NOT ABOUT POLICIES. `web_vitals_samples` carries
 * no identifier, and the defence is that there is no column to put one in. A promise like that
 * decays — the next person to want "just a session id, to deduplicate" adds a column, and nothing
 * stops them unless something asserts the exact column set. So this file pins it: ten columns, by
 * name, and a new one fails here with a comment explaining why that is the point.
 *
 * The rest is the posture: row security on, `analytics.read` to select, and NO write policy of any
 * kind for any session including `anon` — the row arrives from an anonymous browser and is inserted
 * by the route handler as the service role, precisely so that no unauthenticated write policy has
 * to exist.
 */

const REQUIRE_DB = process.env.CI === 'true' || process.env.RLS_TESTS_REQUIRED === '1'
const HAVE_DB = Boolean(process.env.DATABASE_URL)
if (REQUIRE_DB && !HAVE_DB) {
  throw new Error(
    'DATABASE_URL is not set and this environment requires the database suite to run.',
  )
}
const describeDb = HAVE_DB ? describe : describe.skip

const asViewer = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.viewer, fn)
const asEditor = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.editor, fn)

/**
 * THE COLUMN SET, WRITTEN OUT.
 *
 * Ten columns: an id, the route pattern, the three parts of a measurement, four coarse buckets and
 * a timestamp. Not one of them can name a person, a device, a session or a page a person looked at.
 */
const COLUMNS = [
  'id',
  'route_pattern',
  'metric',
  'value',
  'rating',
  'nav_type',
  'effective_type',
  'device_memory_bucket',
  'viewport_bucket',
  'occurred_at',
] as const

/** The shapes an identifier would arrive as. Named so the failure says what went wrong. */
const FORBIDDEN_COLUMN_PATTERNS = [
  /(^|_)ip($|_)/,
  /user_?agent/,
  /session/,
  /(^|_)user_?id($|_)/,
  /referr?er/,
  /fingerprint/,
  /visitor/,
  /(^|_)url($|_)/,
  /slug/,
  /query/,
]

async function cleanup(): Promise<void> {
  const db = await connect()
  await db.query("delete from web_vitals_samples where route_pattern like '/p40-%'")
}

beforeAll(async () => {
  await loadFixture()
  await cleanup()
})

afterAll(async () => {
  await cleanup()
  await disconnect()
})

describeDb('web_vitals_samples — the shape is the privacy guarantee', () => {
  it('has exactly the ten columns, and not one more', async () => {
    const db = await connect()
    const result = await db.query(
      "select column_name from information_schema.columns where table_schema = 'public' " +
        "and table_name = 'web_vitals_samples' order by column_name",
    )
    const actual = result.rows.map((row: { column_name: string }) => row.column_name).sort()
    expect(
      actual,
      'A column was added to or removed from web_vitals_samples. If it was added: this table is ' +
        'deliberately incapable of holding an identifier (D1 — there are no customer accounts and ' +
        'this must not become the thing that creates one). Adding one is a decision for the ' +
        'owner, recorded in DATA_MODEL §11.ag, not a convenience.',
    ).toEqual([...COLUMNS].sort())
  })

  it('has no column whose name could hold an identifier', async () => {
    const db = await connect()
    const result = await db.query(
      "select column_name from information_schema.columns where table_schema = 'public' " +
        "and table_name = 'web_vitals_samples'",
    )
    for (const row of result.rows as { column_name: string }[]) {
      for (const pattern of FORBIDDEN_COLUMN_PATTERNS) {
        expect(pattern.test(row.column_name), `${row.column_name} matches ${String(pattern)}`).toBe(
          false,
        )
      }
    }
  })
})

describeDb('web_vitals_samples — policies', () => {
  it('has row security on', async () => {
    const db = await connect()
    const result = await db.query(
      "select relrowsecurity from pg_class where relname = 'web_vitals_samples'",
    )
    expect(result.rows[0]?.relrowsecurity).toBe(true)
  })

  it('has no anon policy at all', async () => {
    const db = await connect()
    const result = await db.query(
      "select polname from pg_policy where polrelid = 'web_vitals_samples'::regclass " +
        "and 'anon' = any(polroles::regrole[]::text[])",
    )
    expect(result.rows).toEqual([])
  })

  it('has exactly one policy, and it is a select', async () => {
    const db = await connect()
    const result = await db.query(
      "select polname, polcmd from pg_policy where polrelid = 'web_vitals_samples'::regclass",
    )
    expect(result.rows).toHaveLength(1)
    // `r` is SELECT in pg_policy.polcmd.
    expect(result.rows[0]?.polcmd).toBe('r')
  })

  it('lets a viewer read and refuses a viewer write', async () => {
    // Committed through the superuser connection, because every asSession block is rolled back.
    const db = await connect()
    await db.query(
      'insert into web_vitals_samples (route_pattern, metric, value, rating) ' +
        "values ('/p40-read', 'LCP', 1200, 'good')",
    )

    const rows = await asViewer((sql) =>
      sql.rows("select id from web_vitals_samples where route_pattern = '/p40-read'"),
    )
    expect(rows).toHaveLength(1)

    const write = await asEditor((sql) =>
      sql.attempt(
        'insert into web_vitals_samples (route_pattern, metric, value, rating) ' +
          "values ('/p40-write', 'CLS', 0.01, 'good')",
      ),
    )
    expect(write.ok, 'an editor session must not be able to insert a sample').toBe(false)
  })

  it('shows an anonymous visitor nothing', async () => {
    const db = await connect()
    await db.query(
      'insert into web_vitals_samples (route_pattern, metric, value, rating) ' +
        "values ('/p40-anon', 'FCP', 900, 'good')",
    )
    const rows = await asAnon((sql) =>
      sql.rows("select id from web_vitals_samples where route_pattern = '/p40-anon'"),
    )
    expect(rows).toEqual([])
  })
})

describeDb('web_vitals_samples — the CHECK constraints', () => {
  it('refuses a resolved path, a query string and a fragment', async () => {
    const db = await connect()
    for (const bad of ['/p40-x?q=1', '/p40-x#top', 'p40-x', '/P40-Upper']) {
      await expect(
        db.query(
          'insert into web_vitals_samples (route_pattern, metric, value, rating) values ($1, $2, $3, $4)',
          [bad, 'LCP', 1000, 'good'],
        ),
        bad,
      ).rejects.toThrow()
    }
  })

  it('accepts the bracket form', async () => {
    const db = await connect()
    await expect(
      db.query(
        'insert into web_vitals_samples (route_pattern, metric, value, rating) values ($1, $2, $3, $4)',
        ['/p40-product/[slug]', 'LCP', 1000, 'good'],
      ),
    ).resolves.toBeDefined()
  })

  it('refuses a metric, rating or bucket outside its allowlist', async () => {
    const db = await connect()
    const cases: [string, string][] = [
      ['metric', 'FID'],
      ['rating', 'ok'],
      ['effective_type', '5g'],
      ['device_memory_bucket', 'huge'],
      ['viewport_bucket', 'watch'],
      ['nav_type', 'teleport'],
    ]
    for (const [column, value] of cases) {
      const columns = ['route_pattern', 'metric', 'value', 'rating']
      const values: unknown[] = ['/p40-check', 'LCP', 1000, 'good']
      const index = columns.indexOf(column)
      if (index === -1) {
        columns.push(column)
        values.push(value)
      } else {
        values[index] = value
      }
      await expect(
        db.query(
          `insert into web_vitals_samples (${columns.join(', ')}) values (${columns
            .map((_, position) => `$${String(position + 1)}`)
            .join(', ')})`,
          values,
        ),
        `${column} = ${value}`,
      ).rejects.toThrow()
    }
  })

  it('refuses a negative or absurd value', async () => {
    const db = await connect()
    for (const bad of [-1, 3_600_001]) {
      await expect(
        db.query(
          'insert into web_vitals_samples (route_pattern, metric, value, rating) values ($1, $2, $3, $4)',
          ['/p40-value', 'LCP', bad, 'good'],
        ),
        String(bad),
      ).rejects.toThrow()
    }
  })
})
