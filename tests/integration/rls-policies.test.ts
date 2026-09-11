import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { asAnon, connect, disconnect } from '../unit/rls/harness'

/**
 * ROW SECURITY, ACROSS THE WHOLE SCHEMA — Phase 42.
 *
 * Every `tests/unit/rls/phaseNN.test.ts` asks whether one phase's policies do what that phase
 * intended. Not one of them notices a table added by a LATER phase that nobody wrote a suite for —
 * and a table with row security switched off is readable by `anon` in its entirety, because on
 * Supabase `anon` and `authenticated` hold full DML on `public` and RLS is the whole of the
 * boundary.
 *
 * So this asks the question no phase suite asks: is there ANY table in `public` without row
 * security, or with row security and no policy at all? The first is an open table. The second is a
 * table nobody can read, which is a different bug and just as worth knowing.
 *
 * IT NAMES NO TABLE AND HAS NO ALLOWLIST TO EDIT. A gate whose first response to a new table is
 * "add it to the list" teaches the wrong reflex. The assertion is over `pg_class`, so a table
 * created tomorrow is covered tomorrow.
 */

const REQUIRE_DB = process.env.CI === 'true' || process.env.RLS_TESTS_REQUIRED === '1'
const HAVE_DB = Boolean(process.env.DATABASE_URL)
if (REQUIRE_DB && !HAVE_DB) {
  throw new Error('DATABASE_URL is not set and this environment requires the database suite to run.')
}
const describeDb = HAVE_DB ? describe : describe.skip

interface TableRow {
  readonly table_name: string
  readonly rls_enabled: boolean
  readonly rls_forced: boolean
  readonly policy_count: string
}

describeDb('row security across the schema', () => {
  let tables: TableRow[] = []

  beforeAll(async () => {
    const db = await connect()
    const result = await db.query<TableRow>(`
      select c.relname as table_name,
             c.relrowsecurity as rls_enabled,
             c.relforcerowsecurity as rls_forced,
             (select count(*) from pg_policy p where p.polrelid = c.oid)::text as policy_count
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and c.relkind = 'r'
       order by c.relname
    `)
    tables = result.rows
  })

  afterAll(async () => {
    await disconnect()
  })

  it('finds tables to check', () => {
    // A query that returned nothing would make every assertion below vacuously true.
    expect(tables.length).toBeGreaterThan(80)
  })

  it('has row security enabled on every table', () => {
    const open = tables.filter((table) => !table.rls_enabled).map((table) => table.table_name)
    expect(
      open,
      'these tables are readable and writable by anon in their entirety — on Supabase, GRANT is not the boundary, RLS is',
    ).toEqual([])
  })

  it('has at least one policy on every table except the migration ledger', () => {
    /*
     * RLS ON WITH NO POLICY DENIES EVERYTHING except the owner and the service role. Usually that
     * is a bug: a table the application cannot read, discovered later as an empty page rather than
     * as an error.
     *
     * `schema_migrations` IS THE ONE PLACE IT IS THE POINT. `scripts/db/migrate.mjs` creates it and
     * enables row security with no policy on purpose — the ledger is a map of the schema's history,
     * the runner connects as the owner and bypasses RLS, and no PostgREST session has any business
     * reading it. Its own comment says so at length.
     *
     * ASSERTED AS AN EXACT SET, not filtered out. A second table arriving in this state fails here,
     * which is what an allowlist with one entry is for and an `.filter(…)` would not do.
     */
    const silent = tables
      .filter((table) => Number(table.policy_count) === 0)
      .map((table) => table.table_name)
    expect(
      silent,
      'row security is on and no policy admits anybody — every read returns zero rows',
    ).toEqual(['schema_migrations'])
  })

  it('never lets anon read a DRAFT row on a public-facing table', () => {
    /*
     * THE END-TO-END VERSION OF THE SAME QUESTION. The structural assertions above prove a policy
     * exists; this one proves the policies actually shipped say PUBLISHED. Four tables the site
     * renders from, one query each, as the role a stranger arrives with.
     */
    return asAnon(async (sql) => {
      for (const table of ['products', 'collections', 'journal_articles', 'portfolio_projects']) {
        const rows = await sql.rows<{ count: string }>(
          `select count(*)::text as count from ${table} where status <> 'PUBLISHED'`,
        )
        expect(Number(rows[0]?.count ?? -1), `anon can see unpublished rows in ${table}`).toBe(0)
      }
    })
  })

  it('never lets anon read a table that holds personal data', () => {
    return asAnon(async (sql) => {
      for (const table of ['inquiries', 'staff_profiles', 'audit_logs', 'system_logs']) {
        const rows = await sql.rows<{ count: string }>(
          `select count(*)::text as count from ${table}`,
        )
        expect(Number(rows[0]?.count ?? -1), `anon can read ${table}`).toBe(0)
      }
    })
  })
})
