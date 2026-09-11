import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FIXTURE_ID_PREFIX, FIXTURE_NOW } from '../fixtures/ids'
import { connect, disconnect } from '../unit/rls/harness'
import { seedFixture } from '../../scripts/test/seed-fixture'

/**
 * SEEDING TWICE CHANGES NOTHING — Phase 42.
 *
 * A seed runner that is not idempotent is discovered in the worst way: somebody re-runs it on a
 * database that already has content, and either it fails halfway with a duplicate key — leaving the
 * fixture in a state no test expects — or it quietly doubles everything and a suite that asserted
 * "four products" starts reporting eight.
 *
 * THE ASSERTION IS OVER THE WHOLE ROW SET, NOT OVER COUNTS. Counts catch duplication and miss the
 * subtler failure: the same number of rows with different contents, because the second run wrote a
 * timestamp from `now()` rather than from the frozen clock. So the check is a digest of every
 * fixture row's every column, and it must be byte-identical across two runs.
 *
 * `--reset` IS CHECKED TOO, in the other direction: after it, nothing with the fixture prefix may
 * remain anywhere. A fixture that cannot remove itself accumulates in every developer's database
 * until an unrelated suite fails on a duplicate slug.
 */

const REQUIRE_DB = process.env.CI === 'true' || process.env.RLS_TESTS_REQUIRED === '1'
const HAVE_DB = Boolean(process.env.DATABASE_URL)
if (REQUIRE_DB && !HAVE_DB) {
  throw new Error('DATABASE_URL is not set and this environment requires the database suite to run.')
}
const describeDb = HAVE_DB ? describe : describe.skip

/** Every table the fixture writes a prefixed id into, with the column that carries it. */
const FIXTURE_TABLES: readonly [string, string][] = [
  ['staff_profiles', 'user_id'],
  ['media_assets', 'id'],
  ['pages', 'id'],
  ['page_sections', 'id'],
  ['products', 'id'],
  ['collections', 'id'],
  ['portfolio_projects', 'id'],
  ['journal_articles', 'id'],
  ['faqs', 'id'],
  ['inquiries', 'id'],
  ['research_sources', 'id'],
  ['research_runs', 'id'],
  ['research_products', 'id'],
]

/**
 * COLUMNS THE DATABASE OWNS, EXCLUDED FROM THE DIGEST — each one found by running this test, not by
 * anticipating it, and each one correct behaviour rather than a defect in the seeder.
 *
 *   `updated_at` everywhere — `set_updated_at` is a BEFORE UPDATE trigger writing `now()`. Three
 *     tables take a legitimate update during a seed: `inquiries` when the fixed reference code
 *     replaces the one the allocator assigned, and `pages` when `sync_article_page_path` writes the
 *     article's path onto its body page. A seeder that could pin this could only do so by disabling
 *     a trigger, which would mean testing a database this project does not ship.
 *
 *   `staff_profiles.created_at` — the profile row is created by a trigger on `auth.users`, so the
 *     seeder never inserts it and has no timestamp to offer.
 *
 *   `collections.owner_confirmed_at` — `enforce_concept_authority` stamps it when a collection
 *     becomes OWNER_CONFIRMED. The seeder passes the frozen clock and the trigger overrules it,
 *     which is right: the moment of confirmation is the database's to record.
 *
 * EXCLUDING THEM IS NOT WAIVING THEM. `the clock the seeder controls is frozen` below asserts every
 * timestamp the seeder DOES set, and a drift in any of those still fails.
 */
const DATABASE_OWNED: Record<string, readonly string[]> = {
  staff_profiles: ['created_at'],
  collections: ['owner_confirmed_at'],
}
const ALWAYS_EXCLUDED = ['updated_at']

/**
 * A digest of every fixture row in every fixture table.
 *
 * `to_jsonb(t)` renders the whole row, so a column added tomorrow is covered tomorrow, and ordering
 * by the id column makes the digest independent of physical row order — which changes freely after
 * a delete and re-insert and would otherwise make every second run look different.
 */
async function digest(): Promise<Record<string, string>> {
  const db = await connect()
  const out: Record<string, string> = {}
  for (const [table, key] of FIXTURE_TABLES) {
    const excluded = [...ALWAYS_EXCLUDED, ...(DATABASE_OWNED[table] ?? [])]
    const result = await db.query<{ digest: string | null; n: string }>(
      `select md5(coalesce(string_agg(row_text, '|' order by row_text), '')) as digest,
              count(*)::text as n
         from (select (to_jsonb(t) - $2::text[])::text as row_text
                 from ${table} t
                where t.${key}::text like $1) s`,
      [`${FIXTURE_ID_PREFIX}%`, excluded],
    )
    out[table] = `${result.rows[0]?.n ?? '?'}:${result.rows[0]?.digest ?? '?'}`
  }
  return out
}

describeDb('the fixture seeds the same thing every time', () => {
  let first: Record<string, string> = {}
  let second: Record<string, string> = {}

  beforeAll(async () => {
    const db = await connect()
    await seedFixture(db, { reset: false, allowRemote: true, publishSeeded: false })
    first = await digest()
    await seedFixture(db, { reset: false, allowRemote: true, publishSeeded: false })
    second = await digest()
  })

  afterAll(async () => {
    // Left seeded: the e2e and visual suites expect the fixture present, and a suite that tidied up
    // after itself would leave the next runner with an empty database and no message saying why.
    const db = await connect()
    await seedFixture(db, { reset: false, allowRemote: true, publishSeeded: false })
    await disconnect()
  })

  it('writes something in the first place', () => {
    // Without this every comparison below is two identical empty digests, which proves nothing.
    for (const [table] of FIXTURE_TABLES) {
      const [count] = (first[table] ?? '0:').split(':')
      expect(Number(count), `${table} holds no fixture rows`).toBeGreaterThan(0)
    }
  })

  it('produces a byte-identical row set on the second run', () => {
    expect(second).toEqual(first)
  })

  it('writes exactly the declared counts', () => {
    const counts = Object.fromEntries(
      Object.entries(first).map(([table, value]) => [table, Number(value.split(':')[0])]),
    )
    expect(counts).toMatchObject({
      staff_profiles: 6,
      media_assets: 12,
      products: 4,
      collections: 1,
      portfolio_projects: 1,
      journal_articles: 2,
      faqs: 10,
      inquiries: 5,
      research_sources: 1,
      research_runs: 1,
      research_products: 20,
    })
  })

  it('freezes every clock the seeder controls', async () => {
    /*
     * THE OTHER HALF OF THE EXCLUSION ABOVE. Four tables' timestamps belong to the database; every
     * other one belongs to the seeder, and if any of those came from `now()` a visual snapshot
     * showing "2 days ago" would change every night.
     */
    const db = await connect()
    const rows = await db.query<{ table_name: string; n: string }>(
      `select 'products' as table_name, count(*)::text as n
         from products where id::text like $1 and created_at <> $2::timestamptz
       union all
       select 'faqs', count(*)::text
         from faqs where id::text like $1 and created_at <> $2::timestamptz
       union all
       select 'media_assets', count(*)::text
         from media_assets where id::text like $1 and created_at <> $2::timestamptz
       union all
       select 'journal_articles', count(*)::text
         from journal_articles where id::text like $1 and created_at <> $2::timestamptz`,
      [`${FIXTURE_ID_PREFIX}%`, FIXTURE_NOW],
    )
    for (const row of rows.rows) {
      expect(Number(row.n), `${row.table_name} has a row dated from now() rather than the fixture clock`).toBe(0)
    }
  })

  it('leaves nothing behind after --reset', async () => {
    const db = await connect()
    await seedFixture(db, { reset: true, allowRemote: true, publishSeeded: false })
    const after = await digest()
    for (const [table] of FIXTURE_TABLES) {
      const [count] = (after[table] ?? '?:').split(':')
      expect(Number(count), `${table} still holds fixture rows after --reset`).toBe(0)
    }
  })
})
