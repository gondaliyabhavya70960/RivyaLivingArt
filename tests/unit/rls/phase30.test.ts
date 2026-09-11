import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FIXTURE_USERS, asAnon, asSession, connect, disconnect, loadFixture } from './harness'

/**
 * Phase 30 at the table: the three-valued column, the ordered rules, and the one research table
 * whose rows belong to individual people.
 *
 * THE INVARIANT THIS FILE EXISTS FOR IS THE FIRST BLOCK: **a row with no measurement carries no
 * verdict.** `research_products_unmeasured_has_no_verdict` is what makes the three-valued design
 * structural rather than a convention the classifier happens to follow — and it is also where the
 * first version of this phase got it wrong, tying the null verdict to the BAND instead. A
 * well-measured piece whose proportions match no band signature is banded `UNKNOWN` and its SIZE is
 * perfectly well known; refusing it a verdict would hide a confident answer among the unanswerable
 * ones, which is the dishonesty the whole column exists to prevent.
 *
 * `research_saved_views` IS THE OWNER-SCOPE TABLE, and the second block is what proves the scope
 * carries the security rather than the permission. Five of the six roles hold `research.read`, so
 * without the narrowing any of them could rewrite everyone else's views. The shared leg is a
 * separate SELECT policy: sharing widens who may READ a row and must not widen who may edit it.
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

const SOURCE_ID = '00000000-0000-4000-8000-000000003001'
const PRODUCT_ID = '00000000-0000-4000-8000-000000003002'
const UNMEASURED_ID = '00000000-0000-4000-8000-000000003003'
const VIEW_ID = '00000000-0000-4000-8000-000000003004'
const SHARED_VIEW_ID = '00000000-0000-4000-8000-000000003005'

const PHASE_30_TABLES = ['research_large_format_rules', 'research_saved_views'] as const

async function seed(): Promise<void> {
  const db = await connect()

  await db.query(
    `insert into research_sources (id, slug, name, base_url, currency)
     values ($1, 'p30-source', 'Phase 30 Source', 'https://p30.example', 'GBP')
     on conflict (id) do nothing`,
    [SOURCE_ID],
  )
  await db.query(
    `insert into research_products
       (id, source_id, source_url, stage, title_normalized, dimension_parse_state, dimensions_mm,
        scale_band, is_large_format, longest_axis_mm, large_format_source, classified_at)
     values ($1, $2, 'https://p30.example/p/1', 'MATCHED', 'A Phase 30 Table', 'PARSED',
             '{"length_mm": 2100, "height_mm": 750}'::jsonb, 'DINING', true, 2100, 'RULE', now())
     on conflict (id) do nothing`,
    [PRODUCT_ID, SOURCE_ID],
  )
  await db.query(
    `insert into research_products
       (id, source_id, source_url, stage, title_normalized, dimension_parse_state,
        scale_band, is_large_format, large_format_source, classified_at)
     values ($1, $2, 'https://p30.example/p/2', 'MATCHED', 'An Unmeasured Piece', 'AMBIGUOUS',
             'UNKNOWN', null, 'RULE', now())
     on conflict (id) do nothing`,
    [UNMEASURED_ID, SOURCE_ID],
  )
  await db.query(
    `insert into research_saved_views (id, surface, name, filters, owner_user_id, is_shared)
     values ($1, 'large-format', 'p30 private', '{"band": "DINING"}'::jsonb, $2, false)
     on conflict (id) do nothing`,
    [VIEW_ID, FIXTURE_USERS.researcher],
  )
  await db.query(
    `insert into research_saved_views (id, surface, name, filters, owner_user_id, is_shared)
     values ($1, 'large-format', 'p30 shared', '{"large": true}'::jsonb, $2, true)
     on conflict (id) do nothing`,
    [SHARED_VIEW_ID, FIXTURE_USERS.researcher],
  )
}

async function cleanup(): Promise<void> {
  const db = await connect()
  await db.query("delete from research_saved_views where name like 'p30 %'")
  await db.query('delete from research_large_format_rules where priority >= 900')
  await db.query("delete from research_sources where slug like 'p30-%'")
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

describeDb('Phase 30 — a row with no measurement carries no verdict', () => {
  it('refuses a verdict on an unmeasured row', () => {
    return (async () => {
      const db = await connect()
      await expect(
        db.query(`update research_products set is_large_format = false where id = $1`, [
          UNMEASURED_ID,
        ]),
      ).rejects.toThrow(/unmeasured_has_no_verdict/u)
    })()
  })

  it('permits a verdict on a measured row banded UNKNOWN', async () => {
    /*
     * THE ASSERTION THAT SETTLED THE DESIGN. An earlier constraint tied the null verdict to the
     * BAND, which would have refused this row — a measured piece whose kind nobody can name is
     * still confidently large or not, and pushing it into the could-not-tell bucket would hide a
     * confident answer among the unanswerable ones.
     */
    const db = await connect()
    await db.query(
      `update research_products
          set scale_band = 'UNKNOWN', is_large_format = true, large_format_source = 'EDITOR'
        where id = $1`,
      [PRODUCT_ID],
    )
    const { rows } = await db.query(
      'select scale_band, is_large_format from research_products where id = $1',
      [PRODUCT_ID],
    )
    expect(rows[0]).toEqual({ scale_band: 'UNKNOWN', is_large_format: true })

    await db.query(
      `update research_products set scale_band = 'DINING', large_format_source = 'RULE' where id = $1`,
      [PRODUCT_ID],
    )
  })

  it('refuses a classification with no provenance', async () => {
    const db = await connect()
    await expect(
      db.query(`update research_products set large_format_source = null where id = $1`, [
        PRODUCT_ID,
      ]),
    ).rejects.toThrow(/classification_is_attributed/u)
  })
})

describeDb('Phase 30 — the rules are configuration, and configuration is research.write', () => {
  it('lets a researcher write a rule and refuses a merchandiser', async () => {
    // THE PHASE 04 SPLIT. A scale band says what KIND of object a page describes and carries no
    // disposition meaning, so it belongs with the operating half rather than the judging one.
    const allowed = await asResearcher((sql) =>
      sql.attempt(
        `insert into research_large_format_rules (priority, predicate, result_is_large, status)
         values (900, '{"minLongestAxisMm": 3000}'::jsonb, true, 'PUBLISHED')`,
      ),
    )
    expect(allowed.ok).toBe(true)

    const refused = await asMerchandiser((sql) =>
      sql.attempt(
        `insert into research_large_format_rules (priority, predicate, result_is_large, status)
         values (901, '{"minLongestAxisMm": 3000}'::jsonb, true, 'PUBLISHED')`,
      ),
    )
    expect(refused.ok).toBe(false)
  })

  it('keeps the priority order unambiguous', async () => {
    // Two rules at one priority could tie, and "first match wins" would then depend on which row
    // the planner returned first — a classification that changes between runs for no reason.
    const db = await connect()
    await expect(
      db.query(
        `insert into research_large_format_rules (priority, predicate, result_is_large)
         values (10, '{}'::jsonb, true)`,
      ),
    ).rejects.toThrow(/priority/u)
  })

  it('refuses a rule that decides nothing', async () => {
    const db = await connect()
    await expect(
      db.query(
        `insert into research_large_format_rules (priority, predicate)
         values (999, '{}'::jsonb)`,
      ),
    ).rejects.toThrow(/decides_something/u)
  })

  it('has the five seeded rules, published and in order', async () => {
    const db = await connect()
    const { rows } = await db.query(
      `select priority, result_band, result_is_large, status
         from research_large_format_rules
        where priority < 100 order by priority`,
    )
    expect(rows.map((row) => Number(row.priority))).toEqual([10, 20, 30, 40, 50])
    expect(rows[0]).toMatchObject({ result_band: 'UNKNOWN', result_is_large: null })
    expect(rows.every((row) => row.status === 'PUBLISHED')).toBe(true)
  })
})

describeDb('Phase 30 — a saved view belongs to the person who saved it', () => {
  it('shows a researcher their own private view', async () => {
    const rows = await asResearcher((sql) =>
      sql.rows(`select id from research_saved_views where id = $1`, [VIEW_ID]),
    )
    expect(rows).toHaveLength(1)
  })

  it('hides that private view from another role', async () => {
    // THE SCOPE CARRIES THE SECURITY, NOT THE PERMISSION. A merchandiser holds `research.read`;
    // without the owner narrowing they would read and rewrite everyone else's views.
    const rows = await asMerchandiser((sql) =>
      sql.rows(`select id from research_saved_views where id = $1`, [VIEW_ID]),
    )
    expect(rows).toHaveLength(0)
  })

  it('shows the shared view to everyone with research.read', async () => {
    for (const [name, as] of [
      ['merchandiser', asMerchandiser],
      ['owner', asOwner],
    ] as const) {
      const rows = await as((sql) =>
        sql.rows(`select id from research_saved_views where id = $1`, [SHARED_VIEW_ID]),
      )
      expect(rows, name).toHaveLength(1)
    }
  })

  it('refuses an editor even the shared view', async () => {
    const rows = await asEditor((sql) =>
      sql.rows(`select id from research_saved_views where id = $1`, [SHARED_VIEW_ID]),
    )
    expect(rows).toHaveLength(0)
  })

  it('lets nobody but the owner edit a shared view', async () => {
    // SHARING WIDENS WHO MAY READ AND MUST NOT WIDEN WHO MAY EDIT. A view somebody else can edit is
    // a view whose results change under the person who linked to it.
    const affected = await asMerchandiser((sql) =>
      sql.affectedRows(`update research_saved_views set name = 'stolen' where id = $1`, [
        SHARED_VIEW_ID,
      ]),
    )
    expect(affected).toBe(0)

    const mine = await asResearcher((sql) =>
      sql.affectedRows(`update research_saved_views set name = 'p30 shared v2' where id = $1`, [
        SHARED_VIEW_ID,
      ]),
    )
    expect(mine).toBe(1)
  })

  it("refuses a view saved under somebody else's name", async () => {
    const forged = await asMerchandiser((sql) =>
      sql.attempt(
        `insert into research_saved_views (surface, name, filters, owner_user_id)
         values ('large-format', 'p30 forged', '{}'::jsonb, $1)`,
        [FIXTURE_USERS.researcher],
      ),
    )
    expect(forged.ok).toBe(false)
  })

  it('refuses a second view with the same name for one owner and surface', async () => {
    const db = await connect()
    await expect(
      db.query(
        `insert into research_saved_views (surface, name, filters, owner_user_id)
         values ('large-format', 'p30 private', '{}'::jsonb, $1)`,
        [FIXTURE_USERS.researcher],
      ),
    ).rejects.toThrow(/unique_per_owner/u)
  })
})

describeDb('Phase 30 — I2: anon reads nothing from either table', () => {
  it.each(PHASE_30_TABLES)('anon reads zero rows from %s', async (table) => {
    const rows = await asAnon((sql) => sql.rows(`select 1 from ${table}`))
    expect(rows).toHaveLength(0)
  })

  it('proves the seed landed, so the zeros above mean something', async () => {
    const db = await connect()
    for (const table of PHASE_30_TABLES) {
      const { rows } = await db.query(`select count(*)::int as count from ${table}`)
      expect(Number(rows[0].count), table).toBeGreaterThan(0)
    }
  })
})
