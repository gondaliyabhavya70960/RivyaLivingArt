import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  FIXTURE_IDS,
  FIXTURE_USERS,
  asAnon,
  asSession,
  connect,
  disconnect,
  loadFixture,
} from './harness'

/**
 * Phase 26 at the table: the three configuration child tables, the health VIEW, and the four rules
 * that a form must not be the only thing enforcing.
 *
 * THE VIEW IS WHY THIS FILE EXISTS AT ALL, and it is a genuinely new shape for this repository.
 * Every previous access assertion has been about a TABLE, where RLS is the boundary and the grants
 * are irrelevant — Supabase hands every role every privilege on every new table in `public`, and
 * `enable row level security` with no `anon` policy is what refuses the read. A VIEW HAS NO
 * POLICIES. `research_source_health_v` reads nine staff-only tables, and two separate things stop
 * an anonymous caller seeing them: `security_invoker = true`, so the Phase 25 policies still apply
 * underneath, and the absence of a GRANT, which is what PostgREST consults first. Both are asserted
 * below, separately, because either one alone would leave a hole the other happens to cover today.
 *
 * THE FOUR CONSTRAINTS ARE ASSERTED HERE RATHER THAN ONLY IN THE FORM'S UNIT TEST, and the reason
 * is the same one the phase document gives for putting the six-hour interval in SQL: every one of
 * them is a POLITENESS RULE or a POLICY RULE, and a rule enforced only in a form is a rule that a
 * server action, a script, a fixture or a hand-written UPDATE steps around. `tests/unit/
 * source-schema.test.ts` proves the form says the same thing; this proves the database refuses it.
 *
 * WHAT IS DELIBERATELY NOT HERE. The five health states are proved in `tests/unit/
 * source-health.test.ts`, which inserts run histories and reads the view back — a data question
 * rather than an access one, and it does not need the fixture or the advisory lock this file takes.
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
const asViewer = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.viewer, fn)

const SOURCE_ID = '00000000-0000-4000-8000-000000002601'
const PATTERN_ID = '00000000-0000-4000-8000-000000002602'
const MAPPING_ID = '00000000-0000-4000-8000-000000002603'
const SCHEDULE_ID = '00000000-0000-4000-8000-000000002604'

/** The three tables this phase adds, each seeded before it is read as anon. */
const PHASE_26_TABLES = [
  'research_source_url_patterns',
  'research_source_category_map',
  'research_source_schedules',
] as const

async function seed(): Promise<void> {
  const db = await connect()

  await db.query(
    `insert into research_sources (id, slug, name, base_url, region, currency, source_type,
                                   analytics_league, collection_mode, image_extraction_mode)
     values ($1, 'p26-source', 'Phase 26 Source', 'https://p26.example', 'IN', 'INR', 'BRAND',
             'PEER', 'SEED_URLS', 'URL_ONLY')
     on conflict (id) do nothing`,
    [SOURCE_ID],
  )

  await db.query(
    `insert into research_source_url_patterns (id, source_id, kind, pattern, is_regex, priority)
     values ($1, $2, 'PRODUCT', '/collection/*/p/*', false, 10)
     on conflict (id) do nothing`,
    [PATTERN_ID, SOURCE_ID],
  )

  await db.query(
    `insert into research_source_category_map (id, source_id, source_label, source_path, category_id)
     values ($1, $2, 'Long Tables', '/collection/long-tables', $3)
     on conflict (id) do nothing`,
    [MAPPING_ID, SOURCE_ID, await furnitureCategoryId()],
  )

  await db.query(
    `insert into research_source_schedules (id, source_id, job_type, cron_expression, is_enabled)
     values ($1, $2, 'REFRESH', '0 */12 * * *', true)
     on conflict (id) do nothing`,
    [SCHEDULE_ID, SOURCE_ID],
  )
}

/**
 * A real `categories` row to point the mapping at.
 *
 * THE POINT OF USING A REAL ONE rather than a fabricated uuid is the foreign key itself: this is
 * the first reference from the research schema into a public table, and a mapping that pointed at
 * nothing would exercise the column without exercising the constraint.
 */
async function furnitureCategoryId(): Promise<string> {
  const db = await connect()
  const { rows } = await db.query<{ id: string }>(
    'select id from categories order by sort_order, slug limit 1',
  )
  const id = rows[0]?.id
  if (id === undefined) throw new Error('No categories in the fixture — has loadFixture run?')
  return id
}

async function cleanup(): Promise<void> {
  const db = await connect()
  // The three child tables cascade from the source.
  await db.query('delete from research_sources where id = $1', [SOURCE_ID])
  await db.query("delete from research_sources where slug like 'p26-%'")
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

describeDb('Phase 26 — I2: anon reads nothing from the configuration tables', () => {
  it.each(PHASE_26_TABLES)('anon reads zero rows from %s', async (table) => {
    const rows = await asAnon((sql) => sql.rows(`select 1 from ${table}`))
    expect(rows).toHaveLength(0)
  })

  it('proves the seed landed, so the zeros above mean something', async () => {
    const db = await connect()
    for (const table of PHASE_26_TABLES) {
      const { rows } = await db.query(`select count(*)::int as count from ${table}`)
      expect(Number(rows[0].count), table).toBeGreaterThan(0)
    }
  })

  it('refuses an EDITOR, the one staff role without research.read', async () => {
    for (const table of PHASE_26_TABLES) {
      const rows = await asEditor((sql) => sql.rows(`select 1 from ${table}`))
      expect(rows, table).toHaveLength(0)
    }
  })
})

describeDb('Phase 26 — the health view, which has no policies of its own', () => {
  it('refuses anon outright — a view is protected by its GRANTS, not by RLS', async () => {
    const result = await asAnon((sql) =>
      sql.attempt('select 1 from research_source_health_v limit 1'),
    )
    // NOT AN EMPTY RESULT SET — A REFUSAL. There is no `anon` grant on this view at all, so the
    // statement never reaches the policies underneath. An empty result here would mean the grant
    // existed and something else happened to be filtering, which is a weaker guarantee resting on
    // a different mechanism.
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/permission denied/i)
  })

  it('lets a viewer read it, and shows the seeded source', async () => {
    const rows = await asViewer((sql) =>
      sql.rows<{ source_id: string; health: string }>(
        'select source_id, health from research_source_health_v where source_id = $1',
        [SOURCE_ID],
      ),
    )
    expect(rows).toHaveLength(1)
    // The seeded source is not enabled, and DISABLED is the first branch of the precedence.
    expect(rows[0]?.health).toBe('DISABLED')
  })

  it('is security_invoker, so an EDITOR sees nothing through it either', async () => {
    /*
     * THE ASSERTION THAT MATTERS MOST IN THIS FILE. `editor` holds the same GRANT on this view as
     * every other authenticated role — the grant is to `authenticated`, not to a role list — so the
     * only thing that can hide the rows is the Phase 25 policy on `research_sources` being applied
     * as the CALLER. Drop `security_invoker` from the view and this test is the one that goes red,
     * while every grant-based assertion above keeps passing.
     */
    const rows = await asEditor((sql) => sql.rows('select 1 from research_source_health_v'))
    expect(rows).toHaveLength(0)
  })
})

describeDb('Phase 26 — who may configure a source', () => {
  it('lets a researcher add a URL pattern', async () => {
    const created = await asResearcher(async (sql) => {
      const rows = await sql.rows<{ id: string }>(
        `insert into research_source_url_patterns (source_id, kind, pattern, priority, updated_by)
         values ($1, 'CATEGORY', '/collection/*', 5, $2) returning id`,
        [SOURCE_ID, FIXTURE_USERS.researcher],
      )
      return rows
    })
    expect(created).toHaveLength(1)
  })

  it('refuses a MERCHANDISER, who judges output rather than operating the pipeline', async () => {
    // The mirror image of the Phase 25 split: a merchandiser holds `research.confirm` and not
    // `research.write`, so they may reject a row and may not widen what Rivya fetches.
    const result = await asMerchandiser((sql) =>
      sql.attempt(
        `insert into research_source_url_patterns (source_id, kind, pattern)
         values ($1, 'PRODUCT', '/p/*')`,
        [SOURCE_ID],
      ),
    )
    expect(result.ok).toBe(false)
  })

  it('refuses a VIEWER on all three tables', async () => {
    for (const [table, columns, values] of [
      ['research_source_url_patterns', '(source_id, kind, pattern)', `($1, 'PRODUCT', '/x/*')`],
      [
        'research_source_category_map',
        '(source_id, source_label, is_ignored)',
        `($1, 'Rugs', true)`,
      ],
      [
        'research_source_schedules',
        '(source_id, job_type, cron_expression)',
        `($1, 'DETAIL', '0 6 * * *')`,
      ],
    ] as const) {
      const result = await asViewer((sql) =>
        sql.attempt(`insert into ${table} ${columns} values ${values}`, [SOURCE_ID]),
      )
      expect(result.ok, table).toBe(false)
    }
  })

  it('lets only an owner or admin delete a pattern — removing an EXCLUDE widens the reach', async () => {
    const researcherDeleted = await asResearcher((sql) =>
      sql.affectedRows('delete from research_source_url_patterns where id = $1', [PATTERN_ID]),
    )
    expect(researcherDeleted).toBe(0)

    const ownerDeleted = await asOwner((sql) =>
      sql.affectedRows('delete from research_source_url_patterns where id = $1', [PATTERN_ID]),
    )
    expect(ownerDeleted).toBe(1)
  })
})

describeDb('Phase 26 — the rules a form must not be the only thing enforcing', () => {
  it('refuses a schedule that fires more often than every six hours', async () => {
    const db = await connect()
    let error = ''
    try {
      await db.query(
        `insert into research_source_schedules (source_id, job_type, cron_expression)
         values ($1, 'REFRESH', '*/5 * * * *')`,
        [SOURCE_ID],
      )
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    }
    expect(error).toMatch(/schedules_min_interval/i)
  })

  it('refuses a schedule whose expression cannot be read at all', async () => {
    // 0, not null, for an unparseable expression — see the SQL function's comment. A null would
    // make the CHECK `null >= 360`, which PostgreSQL treats as satisfied.
    const db = await connect()
    let error = ''
    try {
      await db.query(
        `insert into research_source_schedules (source_id, job_type, cron_expression)
         values ($1, 'DETAIL', 'every so often')`,
        [SOURCE_ID],
      )
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    }
    expect(error).toMatch(/schedules_min_interval/i)
  })

  it('accepts a six-hourly schedule, and the wrap-around case that looks like eighteen hours', async () => {
    const db = await connect()
    for (const expression of ['0 */6 * * *', '0 0,6,12,18 * * *', '0 0,18 * * *', '15 2 * * *']) {
      const { rows } = await db.query<{ minutes: number }>(
        'select research_cron_min_interval_minutes($1)::int as minutes',
        [expression],
      )
      expect(Number(rows[0]?.minutes), expression).toBeGreaterThanOrEqual(360)
    }
  })

  it('refuses a category mapping that is both mapped and dismissed', async () => {
    const db = await connect()
    let error = ''
    try {
      await db.query(
        `insert into research_source_category_map (source_id, source_label, category_id, is_ignored)
         values ($1, 'Both At Once', $2, true)`,
        [SOURCE_ID, await furnitureCategoryId()],
      )
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    }
    // The one thing that is never true. "Neither" IS storable and is called UNRESOLVED — see the
    // next test for the only way a row reaches that state.
    expect(error).toMatch(/not_both/i)
  })

  it('derives the three mapping states from the two columns', async () => {
    const db = await connect()
    const { rows } = await db.query<{ mapping_state: string }>(
      'select mapping_state from research_source_category_map where id = $1',
      [MAPPING_ID],
    )
    expect(rows[0]?.mapping_state).toBe('MAPPED')
  })

  it('unmaps a label rather than deleting it when a Rivya category goes away', async () => {
    /*
     * THE TEST THAT FOUND THE CONSTRAINT THIS TABLE USED TO CARRY. `check (category_id is not null
     * or is_ignored)` read as an obvious invariant and turned `on delete set null` into
     * `on delete restrict`: a merchandiser could not remove a category because a researcher had
     * once mapped a label to it. What survives a category delete is the OBSERVATION, and the
     * decision falls back to UNRESOLVED to be made again.
     *
     * A category of its own, created and rolled back, rather than one of the seven seeded ones:
     * deleting a seeded category would cascade into products and page sections and prove something
     * about those instead.
     */
    const db = await connect()
    await db.query('begin')
    try {
      const created = await db.query<{ id: string }>(
        `insert into categories (slug, name, sort_order)
         values ('p26-scratch', 'Phase 26 Scratch', 900) returning id`,
      )
      const categoryId = created.rows[0]?.id
      expect(categoryId).toBeDefined()

      await db.query(
        `insert into research_source_category_map (source_id, source_label, category_id)
         values ($1, 'Scratch Label', $2)`,
        [SOURCE_ID, categoryId],
      )

      await db.query('delete from categories where id = $1', [categoryId])

      const { rows } = await db.query<{ category_id: string | null; mapping_state: string }>(
        `select category_id, mapping_state from research_source_category_map
          where source_id = $1 and source_label = 'Scratch Label'`,
        [SOURCE_ID],
      )
      expect(rows).toHaveLength(1)
      expect(rows[0]?.category_id).toBeNull()
      expect(rows[0]?.mapping_state).toBe('UNRESOLVED')
    } finally {
      await db.query('rollback')
    }
  })

  it('refuses a rate limit above sixty and a delay below a second', async () => {
    const db = await connect()
    for (const [column, value, constraint] of [
      ['rate_limit_rpm', 61, /rate_limit_sane/i],
      ['request_delay_ms', 999, /delay_sane/i],
      ['concurrency', 5, /concurrency_sane/i],
    ] as const) {
      let error = ''
      try {
        await db.query(`update research_sources set ${column} = $1 where id = $2`, [
          value,
          SOURCE_ID,
        ])
      } catch (thrown) {
        error = thrown instanceof Error ? thrown.message : String(thrown)
      }
      expect(error, column).toMatch(constraint)
    }
  })

  it('requires https for a real host and admits loopback for a fixture server', async () => {
    const db = await connect()
    await db.query('begin')
    try {
      // A SAVEPOINT, BECAUSE THE FIRST HALF OF THIS TEST IS SUPPOSED TO FAIL. A refused statement
      // aborts the whole transaction, so without one the second insert reports "current transaction
      // is aborted" and the test proves nothing about the loopback exception.
      await db.query('savepoint plain_host')
      let error = ''
      try {
        await db.query(
          `insert into research_sources (slug, name, base_url)
           values ('p26-plain', 'Plain', 'http://plain.example')`,
        )
      } catch (thrown) {
        error = thrown instanceof Error ? thrown.message : String(thrown)
      }
      expect(error).toMatch(/base_url_is_http/i)
      await db.query('rollback to savepoint plain_host')

      // The named exception: the tests that prove a request was NOT made need a server this
      // repository starts, and such a server cannot present a certificate.
      const { rowCount } = await db.query(
        `insert into research_sources (slug, name, base_url)
         values ('p26-loopback', 'Loopback', 'http://127.0.0.1:4319/')`,
      )
      expect(rowCount).toBe(1)
    } finally {
      await db.query('rollback')
    }
  })

  it('refuses a readiness value outside the three the workflow knows', async () => {
    const db = await connect()
    let error = ''
    try {
      await db.query('update research_sources set readiness = $1 where id = $2', [
        'APPROVED',
        SOURCE_ID,
      ])
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    }
    // 'APPROVED' is deliberately chosen: it is a legal `policy_status` and an illegal `readiness`,
    // which is the confusion the two columns exist to prevent.
    expect(error).toMatch(/readiness_allowlist/i)
  })

  it('refuses any timezone but UTC, rather than storing one the scheduler ignores', async () => {
    const db = await connect()
    let error = ''
    try {
      await db.query('update research_source_schedules set timezone = $1 where id = $2', [
        'Asia/Kolkata',
        SCHEDULE_ID,
      ])
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    }
    expect(error).toMatch(/timezone_supported/i)
  })
})

describeDb('Phase 26 — I1: exactly one foreign key crosses the boundary', () => {
  it('names the one crossing, and it is the category mapping', async () => {
    const db = await connect()
    const { rows } = await db.query<{ constraint_name: string; child: string; parent: string }>(`
      select tc.constraint_name, tc.table_name as child, ccu.table_name as parent
      from information_schema.table_constraints tc
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name
       and ccu.table_schema = tc.table_schema
      where tc.constraint_type = 'FOREIGN KEY'
        and tc.table_schema = 'public'
        and ccu.table_schema = 'public'
        and ((tc.table_name like 'research\\_%') <> (ccu.table_name like 'research\\_%'))
    `)
    expect(rows.map((row) => row.constraint_name)).toEqual([
      'research_source_category_map_category_fk',
    ])
    expect(rows[0]?.parent).toBe('categories')
  })

  it('still holds a published product that no research row can reach', async () => {
    // A sanity assertion rather than a boundary one: the fixture's product exists, so the emptiness
    // of the crossing list above is not the emptiness of the schema.
    const db = await connect()
    const { rows } = await db.query('select id from products where id = $1', [
      FIXTURE_IDS.publishedProduct,
    ])
    expect(rows).toHaveLength(1)
  })
})
