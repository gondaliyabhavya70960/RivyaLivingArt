import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FIXTURE_USERS, asAnon, asSession, connect, disconnect, loadFixture } from './harness'

/**
 * Phase 31 at the table: who may write a comparison set, who may NOT write a snapshot, and the
 * schema's own refusals — a combined-currency price snapshot has no key to live under, a member
 * carries exactly one target, and coverage is generated so it cannot disagree with its integers.
 *
 * THE INVARIANT THIS FILE EXISTS FOR IS THE SNAPSHOT BLOCK: no session, owner included, may insert
 * a snapshot. A snapshot a session could insert is a market figure nobody computed, sitting in the
 * dashboard beside the ones that were and indistinguishable from them.
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

const asOwner = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.owner, fn)
const asResearcher = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.researcher, fn)
const asViewer = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.viewer, fn)
const asEditor = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.editor, fn)

const SOURCE_ID = '00000000-0000-4000-8000-000000003101'
const PRODUCT_ID = '00000000-0000-4000-8000-000000003102'
const SET_ID = '00000000-0000-4000-8000-000000003103'
const SNAPSHOT_ID = '00000000-0000-4000-8000-000000003104'

const PHASE_31_TABLES = [
  'research_comparison_sets',
  'research_comparison_members',
  'research_analytics_snapshots',
  'research_metric_coverage',
] as const

async function seed(): Promise<void> {
  const db = await connect()
  await db.query(
    `insert into research_sources (id, slug, name, base_url, currency)
     values ($1, 'p31-source', 'Phase 31 Source', 'https://p31.example', 'INR')
     on conflict (id) do nothing`,
    [SOURCE_ID],
  )
  await db.query(
    `insert into research_products (id, source_id, source_url, stage, title_normalized)
     values ($1, $2, 'https://p31.example/p/1', 'MATCHED', 'A Phase 31 Row')
     on conflict (id) do nothing`,
    [PRODUCT_ID, SOURCE_ID],
  )
  await db.query(
    `insert into research_comparison_sets (id, name, slug, created_by)
     values ($1, 'p31 set', 'p31-set', $2)
     on conflict (id) do nothing`,
    [SET_ID, FIXTURE_USERS.researcher],
  )
  await db.query(
    `insert into research_analytics_snapshots
       (id, scope_type, scope_id, metric_family, currency, payload, row_count)
     values ($1, 'SET', $2, 'PRICE_ARCHITECTURE', 'INR', '{"family":"PRICE_ARCHITECTURE"}'::jsonb, 3)
     on conflict (id) do nothing`,
    [SNAPSHOT_ID, SET_ID],
  )
}

async function cleanup(): Promise<void> {
  const db = await connect()
  await db.query("delete from research_comparison_sets where slug like 'p31-%'")
  await db.query('delete from research_analytics_snapshots where scope_id = $1', [SET_ID])
  await db.query("delete from research_sources where slug like 'p31-%'")
}

beforeAll(async () => {
  await loadFixture()
  await cleanup()
  await seed()
})

afterAll(async () => {
  await cleanup()
  await disconnect()
})

describeDb('Phase 31 — isolation invariant I2 on all four tables', () => {
  it('has no anon policy on any of them', async () => {
    const db = await connect()
    const { rows } = await db.query<{ tablename: string }>(
      `select tablename from pg_policies
       where schemaname = 'public' and tablename = any($1) and 'anon' = any(roles)`,
      [[...PHASE_31_TABLES]],
    )
    expect(rows).toEqual([])
  })

  it('shows anon zero rows of every table', async () => {
    for (const table of PHASE_31_TABLES) {
      const rows = await asAnon((sql) =>
        sql.rows<{ n: number }>(`select count(*)::int as n from ${table}`),
      )
      // RLS with no anon policy returns zero rows rather than an error through the session role.
      expect(Number(rows[0]?.n ?? 0)).toBe(0)
    }
  })
})

describeDb('Phase 31 — a set is a person’s workspace', () => {
  it('lets a researcher create, read and delete a set', async () => {
    await asResearcher(async (sql) => {
      const inserted = await sql.attempt(
        `insert into research_comparison_sets (name, slug, created_by) values ('p31 mine', 'p31-mine', $1)`,
        [FIXTURE_USERS.researcher],
      )
      expect(inserted.ok).toBe(true)
      const rows = await sql.rows(
        `select slug from research_comparison_sets where slug = 'p31-mine'`,
      )
      expect(rows).toHaveLength(1)
      expect(
        await sql.affectedRows(`delete from research_comparison_sets where slug = 'p31-mine'`),
      ).toBe(1)
    })
  })

  it('lets a viewer read a set and refuses them a write', async () => {
    const rows = await asViewer((sql) =>
      sql.rows(`select slug from research_comparison_sets where id = $1`, [SET_ID]),
    )
    expect(rows).toHaveLength(1)
    const refused = await asViewer((sql) =>
      sql.attempt(
        `insert into research_comparison_sets (name, slug, created_by) values ('x', 'p31-viewer', $1)`,
        [FIXTURE_USERS.viewer],
      ),
    )
    expect(refused.ok).toBe(false)
    expect(refused.error).toMatch(/row-level security/u)
  })

  it('hides every table from an editor, who does not hold research.read', async () => {
    const rows = await asEditor((sql) =>
      sql.rows(`select id from research_comparison_sets where id = $1`, [SET_ID]),
    )
    expect(rows).toHaveLength(0)
  })

  it('pins a member to exactly one target', async () => {
    const db = await connect()
    await expect(
      db.query(
        `insert into research_comparison_members (set_id, member_type, source_id, research_product_id)
         values ($1, 'SOURCE', $2, $3)`,
        [SET_ID, SOURCE_ID, PRODUCT_ID],
      ),
    ).rejects.toThrow(/matches_type/u)
    await expect(
      db.query(
        `insert into research_comparison_members (set_id, member_type) values ($1, 'SOURCE')`,
        [SET_ID],
      ),
    ).rejects.toThrow(/matches_type/u)
  })

  it('refuses the same source twice in one set', async () => {
    const db = await connect()
    await db.query(
      `insert into research_comparison_members (set_id, member_type, source_id) values ($1, 'SOURCE', $2)`,
      [SET_ID, SOURCE_ID],
    )
    await expect(
      db.query(
        `insert into research_comparison_members (set_id, member_type, source_id) values ($1, 'SOURCE', $2)`,
        [SET_ID, SOURCE_ID],
      ),
    ).rejects.toThrow(/unique_target/u)
  })

  it('refuses a FIXED rule with no edges and a QUANTILE rule with edges', async () => {
    const db = await connect()
    await expect(
      db.query(`update research_comparison_sets set band_rule = 'FIXED' where id = $1`, [SET_ID]),
    ).rejects.toThrow(/edges_match_rule/u)
    await expect(
      db.query(`update research_comparison_sets set band_edges = '{100,200}' where id = $1`, [
        SET_ID,
      ]),
    ).rejects.toThrow(/edges_match_rule/u)
    await expect(
      db.query(
        `update research_comparison_sets set band_rule = 'FIXED', band_edges = '{200,100}' where id = $1`,
        [SET_ID],
      ),
    ).rejects.toThrow(/edges_ascending/u)
  })
})

describeDb('Phase 31 — snapshots are the machine’s record', () => {
  it('refuses every session a snapshot insert, the owner included', async () => {
    const refused = await asOwner((sql) =>
      sql.attempt(
        `insert into research_analytics_snapshots (scope_type, scope_id, metric_family, payload, row_count)
         values ('CORPUS', null, 'ASSORTMENT', '{}'::jsonb, 0)`,
      ),
    )
    expect(refused.ok).toBe(false)
    expect(refused.error).toMatch(/row-level security/u)
  })

  it('lets a researcher read one', async () => {
    const rows = await asResearcher((sql) =>
      sql.rows(`select currency from research_analytics_snapshots where id = $1`, [SNAPSHOT_ID]),
    )
    expect(rows).toEqual([{ currency: 'INR' }])
  })

  it('has no key under which a combined-currency price snapshot could live', async () => {
    const db = await connect()
    await expect(
      db.query(
        `insert into research_analytics_snapshots (scope_type, scope_id, metric_family, currency, payload, row_count)
         values ('SET', $1, 'PRICE_ARCHITECTURE', null, '{}'::jsonb, 0)`,
        [SET_ID],
      ),
    ).rejects.toThrow(/currency_matches_family/u)
    await expect(
      db.query(
        `insert into research_analytics_snapshots (scope_type, scope_id, metric_family, currency, payload, row_count)
         values ('SET', $1, 'ASSORTMENT', 'INR', '{}'::jsonb, 0)`,
        [SET_ID],
      ),
    ).rejects.toThrow(/currency_matches_family/u)
  })

  it('generates coverage_pct from the integers and refuses n above the denominator', async () => {
    const db = await connect()
    const { rows } = await db.query<{ coverage_pct: string }>(
      `insert into research_metric_coverage (snapshot_id, metric_key, n, denominator, as_of)
       values ($1, 'price_architecture', 69, 95, now()) returning coverage_pct`,
      [SNAPSHOT_ID],
    )
    expect(Number(rows[0]?.coverage_pct)).toBeCloseTo(72.63, 2)
    const zero = await db.query<{ coverage_pct: string }>(
      `insert into research_metric_coverage (snapshot_id, metric_key, n, denominator, as_of)
       values ($1, 'empty', 0, 0, now()) returning coverage_pct`,
      [SNAPSHOT_ID],
    )
    expect(Number(zero.rows[0]?.coverage_pct)).toBe(0)
    await expect(
      db.query(
        `insert into research_metric_coverage (snapshot_id, metric_key, n, denominator, as_of)
         values ($1, 'bad', 5, 4, now())`,
        [SNAPSHOT_ID],
      ),
    ).rejects.toThrow(/within_denominator/u)
  })

  it('takes the snapshot history and its coverage with a deleted set', async () => {
    const db = await connect()
    await db.query('begin')
    try {
      await db.query(`delete from research_comparison_sets where id = $1`, [SET_ID])
      const snapshots = await db.query<{ n: number }>(
        `select count(*)::int as n from research_analytics_snapshots where scope_type = 'SET' and scope_id = $1`,
        [SET_ID],
      )
      expect(snapshots.rows[0]?.n).toBe(0)
      const { rows } = await db.query<{ n: number }>(
        `select count(*)::int as n from research_metric_coverage where snapshot_id = $1`,
        [SNAPSHOT_ID],
      )
      expect(rows[0]?.n).toBe(0)
    } finally {
      await db.query('rollback')
    }
  })
})
