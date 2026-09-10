import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FIXTURE_USERS, asAnon, asSession, connect, disconnect, loadFixture } from './harness'

/**
 * Phase 27 at the table: two tables nobody with a session may write, and the four rules that make a
 * version worth diffing.
 *
 * THE WRITE ASSERTIONS ARE THE POINT OF THIS FILE, and they are stronger than the ones Phase 26
 * needed. `research_sources` is configuration, so a researcher edits it; these two tables are the
 * RECORD OF WHAT HAPPENED, and a record its author can edit is not a record.
 * `research_product_versions` is what Phase 29 diffs to say a competitor's price moved — a member
 * of staff able to edit one could make a change appear that never happened, or make one disappear
 * that did, and this table is precisely what somebody would read to check. `research_adapter_runs`
 * exists to make "a broken adapter stopped at its own source" checkable, and a claim about failure
 * that the failing party can rewrite proves nothing.
 *
 * So every role — owner included — is asserted to be refused, in both directions. An owner may
 * delete a source and cascade the lot; an owner may not quietly correct one version's price.
 *
 * THE UNIQUE CONTENT HASH IS ASSERTED AT THE ROW rather than only in the workflow, for the reason
 * `0250` gives: a nightly run over four hundred unchanged pages would otherwise write four hundred
 * versions a night, and "what changed" would become a question about noise. The workflow gets it
 * right; the constraint is what holds when a future caller does not.
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
const asEditor = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.editor, fn)
const asMerchandiser = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.merchandiser, fn)

const SOURCE_ID = '00000000-0000-4000-8000-000000002701'
const RUN_ID = '00000000-0000-4000-8000-000000002702'
const PRODUCT_ID = '00000000-0000-4000-8000-000000002703'
const VERSION_ID = '00000000-0000-4000-8000-000000002704'
const ADAPTER_RUN_ID = '00000000-0000-4000-8000-000000002705'

const PHASE_27_TABLES = ['research_product_versions', 'research_adapter_runs'] as const

/** A draft shaped as `rawProductDraftSchema` writes it: every value the source's own string. */
const DRAFT = JSON.stringify({
  title: 'A Long Table',
  priceText: '1.299,00',
  currencyText: null,
  skuText: 'LT-1',
  availabilityText: null,
  leadTimeText: null,
  descriptionHtml: null,
  externalId: null,
  canonicalUrl: 'https://p27.example/p/1',
  dimensionTexts: ['200 x 90 x 75 cm'],
  materialTexts: [],
  variantTexts: [],
  customizationTexts: [],
  imageUrls: [],
  categoryLabels: ['Long Tables'],
  confidence: { title: 1, priceText: 1 },
  provenance: { title: 'jsonld', priceText: 'jsonld' },
})

async function seed(): Promise<void> {
  const db = await connect()

  await db.query(
    `insert into research_sources (id, slug, name, base_url)
     values ($1, 'p27-source', 'Phase 27 Source', 'https://p27.example')
     on conflict (id) do nothing`,
    [SOURCE_ID],
  )
  await db.query(
    `insert into research_runs (id, source_id, status, trigger)
     values ($1, $2, 'RUNNING', 'SCHEDULED') on conflict (id) do nothing`,
    [RUN_ID, SOURCE_ID],
  )
  await db.query(
    `insert into research_products (id, source_id, source_url)
     values ($1, $2, 'https://p27.example/p/1') on conflict (id) do nothing`,
    [PRODUCT_ID, SOURCE_ID],
  )
  await db.query(
    `insert into research_product_versions
       (id, research_product_id, run_id, raw, content_hash, storage_key, adapter_key, adapter_version)
     values ($1, $2, $3, $4::jsonb, 'hash-one', 'research/p27/2026/09/10/a.html.gz', 'generic', '2.0.0')
     on conflict (id) do nothing`,
    [VERSION_ID, PRODUCT_ID, RUN_ID, DRAFT],
  )
  await db.query('update research_products set current_version_id = $1 where id = $2', [
    VERSION_ID,
    PRODUCT_ID,
  ])
  await db.query(
    `insert into research_adapter_runs
       (id, run_id, source_id, adapter_key, adapter_version, status, items_seen, items_extracted)
     values ($1, $2, $3, 'generic', '2.0.0', 'OK', 3, 3)
     on conflict (id) do nothing`,
    [ADAPTER_RUN_ID, RUN_ID, SOURCE_ID],
  )
}

async function cleanup(): Promise<void> {
  const db = await connect()
  // Everything else cascades from the source.
  await db.query('delete from research_sources where id = $1', [SOURCE_ID])
  await db.query("delete from research_sources where slug like 'p27-%'")
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

describeDb('Phase 27 — I2: anon reads nothing from either extraction table', () => {
  it.each(PHASE_27_TABLES)('anon reads zero rows from %s', async (table) => {
    const rows = await asAnon((sql) => sql.rows(`select 1 from ${table}`))
    expect(rows).toHaveLength(0)
  })

  it('proves the seed landed, so the zeros above mean something', async () => {
    const db = await connect()
    for (const table of PHASE_27_TABLES) {
      const { rows } = await db.query(`select count(*)::int as count from ${table}`)
      expect(Number(rows[0].count), table).toBeGreaterThan(0)
    }
  })

  it('refuses an EDITOR, the one staff role without research.read', async () => {
    for (const table of PHASE_27_TABLES) {
      const rows = await asEditor((sql) => sql.rows(`select 1 from ${table}`))
      expect(rows, table).toHaveLength(0)
    }
  })
})

describeDb('Phase 27 — nobody with a session writes the record of what happened', () => {
  /*
   * OWNER INCLUDED, AND THAT IS THE ASSERTION WORTH HAVING. Every other staff-writable table in
   * this subsystem gives an owner a way in. These two do not, because what they hold is not
   * configuration somebody is entitled to change — it is what an adapter read and what failed
   * while reading it.
   */
  const roles = [
    ['owner', asOwner],
    ['researcher', asResearcher],
    ['merchandiser', asMerchandiser],
  ] as const

  it.each(roles)('refuses %s an INSERT into research_product_versions', async (_name, as) => {
    const result = await as((sql) =>
      sql.attempt(
        `insert into research_product_versions
           (research_product_id, raw, content_hash, adapter_key, adapter_version)
         values ($1, '{}'::jsonb, 'forged', 'generic', '2.0.0')`,
        [PRODUCT_ID],
      ),
    )
    expect(result.ok).toBe(false)
  })

  it.each(roles)('refuses %s an UPDATE of a stored version', async (_name, as) => {
    // NOT AN ERROR, A ZERO. With no update policy the row is invisible to the statement, so the
    // UPDATE matches nothing rather than being refused — and asserting on the effect is what the
    // note in `phase25.test.ts` insists on, because a session's write never persists here anyway.
    const changed = await as((sql) =>
      sql.affectedRows(
        `update research_product_versions set content_hash = 'rewritten' where id = $1`,
        [VERSION_ID],
      ),
    )
    expect(changed).toBe(0)
  })

  it.each(roles)('refuses %s an UPDATE of an adapter run', async (_name, as) => {
    const changed = await as((sql) =>
      sql.affectedRows(`update research_adapter_runs set items_failed = 0 where id = $1`, [
        ADAPTER_RUN_ID,
      ]),
    )
    expect(changed).toBe(0)
  })

  it('refuses an owner a DELETE of either table, because history is not deletable', async () => {
    for (const [table, id] of [
      ['research_product_versions', VERSION_ID],
      ['research_adapter_runs', ADAPTER_RUN_ID],
    ] as const) {
      const deleted = await asOwner((sql) =>
        sql.affectedRows(`delete from ${table} where id = $1`, [id]),
      )
      expect(deleted, table).toBe(0)
    }
  })

  it('still lets a researcher READ both, because a run is meant to be watched', async () => {
    const versions = await asResearcher((sql) =>
      sql.rows('select id from research_product_versions where id = $1', [VERSION_ID]),
    )
    const runs = await asResearcher((sql) =>
      sql.rows('select id from research_adapter_runs where id = $1', [ADAPTER_RUN_ID]),
    )
    expect(versions).toHaveLength(1)
    expect(runs).toHaveLength(1)
  })
})

describeDb('Phase 27 — the four rules that make a version worth diffing', () => {
  it('refuses a second version with the same content hash', async () => {
    const db = await connect()
    let error = ''
    try {
      await db.query(
        `insert into research_product_versions
           (research_product_id, raw, content_hash, adapter_key, adapter_version)
         values ($1, $2::jsonb, 'hash-one', 'generic', '2.0.0')`,
        [PRODUCT_ID, DRAFT],
      )
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    }
    // AN UNCHANGED PAGE PRODUCES NO NEW VERSION, at the row and not only in the caller.
    expect(error).toMatch(/unique_content/i)
  })

  it('accepts a second version whose content differs', async () => {
    const db = await connect()
    await db.query('begin')
    try {
      const { rowCount } = await db.query(
        `insert into research_product_versions
           (research_product_id, raw, content_hash, adapter_key, adapter_version)
         values ($1, $2::jsonb, 'hash-two', 'generic', '2.0.0')`,
        [PRODUCT_ID, DRAFT],
      )
      expect(rowCount).toBe(1)
    } finally {
      await db.query('rollback')
    }
  })

  it('unsets the product’s current version rather than deleting the product', async () => {
    /*
     * `on delete set null`, NOT CASCADE, AND THE DIFFERENCE IS A ROW SOMEBODY IS TRIAGING. Deleting
     * a version must not delete the product that was observed; the product simply has no current
     * version until the next run — a state the explorer can render, where a cascade would have
     * removed the row and hidden the fact entirely.
     */
    const db = await connect()
    await db.query('begin')
    try {
      await db.query('delete from research_product_versions where id = $1', [VERSION_ID])
      const { rows } = await db.query<{ current_version_id: string | null }>(
        'select current_version_id from research_products where id = $1',
        [PRODUCT_ID],
      )
      expect(rows).toHaveLength(1)
      expect(rows[0]?.current_version_id).toBeNull()
    } finally {
      await db.query('rollback')
    }
  })

  it('takes every version with the product when the product goes', async () => {
    const db = await connect()
    await db.query('begin')
    try {
      await db.query('delete from research_products where id = $1', [PRODUCT_ID])
      const { rows } = await db.query<{ count: string }>(
        'select count(*)::text as count from research_product_versions where research_product_id = $1',
        [PRODUCT_ID],
      )
      expect(rows[0]?.count).toBe('0')
    } finally {
      await db.query('rollback')
    }
  })

  it('refuses an adapter-run status outside the four the accounting knows', async () => {
    const db = await connect()
    let error = ''
    try {
      await db.query('update research_adapter_runs set status = $1 where id = $2', [
        'BROKEN',
        ADAPTER_RUN_ID,
      ])
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    }
    expect(error).toMatch(/status_allowlist/i)
  })

  it('keeps one adapter row per run, source and adapter, because a run spans many ticks', async () => {
    const db = await connect()
    let error = ''
    try {
      await db.query(
        `insert into research_adapter_runs (run_id, source_id, adapter_key, adapter_version)
         values ($1, $2, 'generic', '2.0.0')`,
        [RUN_ID, SOURCE_ID],
      )
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    }
    // The counters are cumulative across cron ticks; a second row would split them in two.
    expect(error).toMatch(/adapter_runs_unique/i)
  })

  it('refuses a negative count', async () => {
    const db = await connect()
    let error = ''
    try {
      await db.query('update research_adapter_runs set items_failed = -1 where id = $1', [
        ADAPTER_RUN_ID,
      ])
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    }
    expect(error).toMatch(/counts_sane/i)
  })
})

describeDb('Phase 27 — I1 is unchanged: still exactly one crossing', () => {
  it('adds no research → public foreign key', async () => {
    const db = await connect()
    const { rows } = await db.query<{ constraint_name: string }>(`
      select tc.constraint_name
      from information_schema.table_constraints tc
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name
       and ccu.table_schema = tc.table_schema
      where tc.constraint_type = 'FOREIGN KEY'
        and tc.table_schema = 'public'
        and ccu.table_schema = 'public'
        and ((tc.table_name like 'research\\_%') <> (ccu.table_name like 'research\\_%'))
    `)
    // `research_products_current_version_fk` points at another research table, which is why it does
    // not appear here. Phase 28 adds the second and final crossing.
    expect(rows.map((row) => row.constraint_name)).toEqual([
      'research_source_category_map_category_fk',
    ])
  })
})
