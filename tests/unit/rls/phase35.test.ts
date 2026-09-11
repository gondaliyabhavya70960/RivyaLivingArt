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
 * Phase 35 at the table: the two decision records, the stage-writer guard (the phase document's
 * `stage-guard-trigger.test.ts` — it needs a database, so it lives in the RLS project), the
 * orthogonality of stage and disposition, archival as a column, the partial unique indexes, the
 * permission split (a researcher is refused, a merchandiser admitted), no anon leg, no foreign key
 * from `research_confirmations` to `products` — and the database half of the field-provenance
 * test: a research row of sentinels, the bridge's exact insert, and no sentinel in any column of
 * the product or its three join tables.
 */

const REQUIRE_DB = process.env.CI === 'true' || process.env.RLS_TESTS_REQUIRED === '1'
const HAVE_DB = Boolean(process.env.DATABASE_URL)
if (REQUIRE_DB && !HAVE_DB) {
  throw new Error(
    'DATABASE_URL is not set and this environment requires the database suite to run.',
  )
}
const describeDb = HAVE_DB ? describe : describe.skip

const asResearcher = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.researcher, fn)
const asMerchandiser = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.merchandiser, fn)
const asViewer = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.viewer, fn)

const SOURCE_ID = '00000000-0000-4000-8000-000000003501'
const PRODUCT_ID = '00000000-0000-4000-8000-000000003502'
const SENTINEL_PRODUCT_ID = '00000000-0000-4000-8000-000000003503'
const CONFIRMATION_ID = '00000000-0000-4000-8000-000000003504'
const DRAFT_PRODUCT_ID = '00000000-0000-4000-8000-000000003505'
const CATEGORY_ID = '00000000-0000-4000-8000-000000003506'

const SENTINELS = {
  title: 'SENTINEL-TITLE-7f3a',
  url: 'https://sentinel-9c1d.example/p/1',
  material: 'SENTINEL-MATERIAL-8a2b',
  note: 'SENTINEL-NOTE-3c9a',
  reason: 'SENTINEL-REASON-6b4d',
  currency: 'SEN',
} as const

async function seed(): Promise<void> {
  const db = await connect()
  await db.query(
    `insert into research_sources (id, slug, name, base_url, currency)
     values ($1, 'p35-source', 'Phase 35 Source', 'https://p35.example', 'GBP')
     on conflict (id) do nothing`,
    [SOURCE_ID],
  )
  await db.query(
    `insert into research_products (id, source_id, source_url, stage, title_normalized)
     values ($1, $2, 'https://p35.example/p/1', 'REVIEW', 'A Phase 35 Console')
     on conflict (id) do nothing`,
    [PRODUCT_ID, SOURCE_ID],
  )
  await db.query(
    `insert into research_products
       (id, source_id, source_url, stage, title_normalized, material_tokens, currency, price_min_minor)
     values ($1, $2, $3, 'CONFIRMED', $4, array[$5]::text[], $6, 987654)
     on conflict (id) do nothing`,
    [
      SENTINEL_PRODUCT_ID,
      SOURCE_ID,
      SENTINELS.url,
      SENTINELS.title,
      SENTINELS.material,
      SENTINELS.currency,
    ],
  )
}

async function cleanup(): Promise<void> {
  const db = await connect()
  await db.query('delete from products where id = $1', [DRAFT_PRODUCT_ID])
  await db.query('delete from categories where id = $1', [CATEGORY_ID])
  await db.query('delete from research_products where source_id = $1', [SOURCE_ID])
  await db.query('delete from research_sources where id = $1', [SOURCE_ID])
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

describeDb('Phase 35 — the schema', () => {
  it('alters no enum: seven stages and four dispositions, exactly', async () => {
    const db = await connect()
    const stages = await db.query<{ v: string }>(
      `select unnest(enum_range(null::research_stage))::text as v`,
    )
    expect(stages.rows.map((row) => row.v)).toEqual([
      'RAW',
      'NORMALIZED',
      'VALIDATED',
      'MATCHED',
      'REVIEW',
      'SHORTLISTED',
      'CONFIRMED',
    ])
    const dispositions = await db.query<{ v: string }>(
      `select unnest(enum_range(null::research_disposition))::text as v`,
    )
    expect(dispositions.rows).toHaveLength(4)
  })

  it('creates the two tables with row security on, no anon leg, and no key to products', async () => {
    const db = await connect()
    const rows = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class
        where relname in ('research_shortlist_entries', 'research_confirmations') and relkind = 'r'`,
    )
    expect(rows.rows).toHaveLength(2)
    for (const row of rows.rows) expect(row.relrowsecurity).toBe(true)

    const anon = await db.query(
      `select policyname from pg_policies
        where tablename in ('research_shortlist_entries', 'research_confirmations')
          and 'anon' = any(roles)`,
    )
    expect(anon.rows).toHaveLength(0)

    const keys = await db.query<{ conname: string; target: string }>(
      `select c.conname, c.confrelid::regclass::text as target
         from pg_constraint c
        where c.conrelid = 'research_confirmations'::regclass and c.contype = 'f'`,
    )
    expect(keys.rows.map((row) => row.target)).not.toContain('products')
  })

  it('refuses an anon read of either table', async () => {
    for (const table of ['research_shortlist_entries', 'research_confirmations']) {
      const rows = await asAnon((sql) => sql.rows(`select id from ${table} limit 1`))
      expect(rows).toEqual([])
    }
  })
})

describeDb('Phase 35 — the stage-writer guard (stage-guard-trigger)', () => {
  it('refuses a bare update to stage, naming the row', async () => {
    const db = await connect()
    await expect(
      db.query(`update research_products set stage = 'CONFIRMED' where id = $1`, [PRODUCT_ID]),
    ).rejects.toThrow(/may only be changed by lib\/scraper\/core\/stage\.ts/u)
  })

  it('refuses a bare update to disposition', async () => {
    const db = await connect()
    await expect(
      db.query(`update research_products set disposition = 'REJECTED' where id = $1`, [PRODUCT_ID]),
    ).rejects.toThrow(/may only be changed by/u)
  })

  it('admits an update to any other column without the flag', async () => {
    const db = await connect()
    await expect(
      db.query(
        `update research_products set title_normalized = 'A Phase 35 Console' where id = $1`,
        [PRODUCT_ID],
      ),
    ).resolves.toBeDefined()
  })

  it('research_write_stage() carries the flag, moves the row, and is service-role only', async () => {
    const db = await connect()
    await db.query(`select research_write_stage($1, 'SHORTLISTED', null, null)`, [PRODUCT_ID])
    const after = await db.query<{ stage: string }>(
      'select stage from research_products where id = $1',
      [PRODUCT_ID],
    )
    expect(after.rows[0]?.stage).toBe('SHORTLISTED')

    const grants = await db.query<{ grantee: string }>(
      `select grantee from information_schema.routine_privileges
        where routine_name = 'research_write_stage' and privilege_type = 'EXECUTE'`,
    )
    const grantees = grants.rows.map((row) => row.grantee)
    expect(grantees).toContain('service_role')
    expect(grantees).not.toContain('anon')
    expect(grantees).not.toContain('authenticated')

    const refused = await asMerchandiser((sql) =>
      sql.attempt(`select research_write_stage($1, 'CONFIRMED', null, null)`, [PRODUCT_ID]),
    )
    expect(refused.ok).toBe(false)
  })
})

describeDb('Phase 35 — the two decision records', () => {
  it('lets a merchandiser open an entry and refuses a researcher and a viewer', async () => {
    const opened = await asMerchandiser(async (sql) => {
      await sql.rows(
        `insert into research_shortlist_entries (research_product_id, reason, opened_by)
         values ($1, 'Right scale for the atrium.', $2)`,
        [PRODUCT_ID, FIXTURE_USERS.merchandiser],
      )
      return sql.rows<{ count: string }>(
        'select count(*) from research_shortlist_entries where research_product_id = $1',
        [PRODUCT_ID],
      )
    })
    expect(Number(opened[0]?.count)).toBe(1)

    for (const as of [asResearcher, asViewer]) {
      const result = await as((sql) =>
        sql.attempt(
          `insert into research_shortlist_entries (research_product_id, reason, opened_by)
           values ($1, 'nope', $2)`,
          [PRODUCT_ID, FIXTURE_USERS.researcher],
        ),
      )
      expect(result.ok).toBe(false)
    }
  })

  it('requires a non-blank reason and a non-blank decision note', async () => {
    const db = await connect()
    await expect(
      db.query(
        `insert into research_shortlist_entries (research_product_id, reason, opened_by)
         values ($1, '   ', $2)`,
        [PRODUCT_ID, FIXTURE_USERS.merchandiser],
      ),
    ).rejects.toThrow(/reason_not_blank/u)
    await expect(
      db.query(
        `insert into research_confirmations (research_product_id, decision_note, confirmed_by)
         values ($1, '', $2)`,
        [PRODUCT_ID, FIXTURE_USERS.merchandiser],
      ),
    ).rejects.toThrow(/note_not_blank/u)
  })

  it('admits one open entry per row and frees the row when it closes', async () => {
    const db = await connect()
    await db.query(
      `insert into research_shortlist_entries (research_product_id, reason, opened_by)
       values ($1, 'first', $2) on conflict do nothing`,
      [PRODUCT_ID, FIXTURE_USERS.merchandiser],
    )
    await expect(
      db.query(
        `insert into research_shortlist_entries (research_product_id, reason, opened_by)
         values ($1, 'second', $2)`,
        [PRODUCT_ID, FIXTURE_USERS.merchandiser],
      ),
    ).rejects.toThrow(/one_open_idx/u)

    // Closed means closed for a reason, by somebody — all three or none.
    await expect(
      db.query(
        `update research_shortlist_entries set closed_at = now()
          where research_product_id = $1 and closed_at is null`,
        [PRODUCT_ID],
      ),
    ).rejects.toThrow(/closed_together/u)

    await db.query(
      `update research_shortlist_entries
          set closed_at = now(), closed_reason = 'confirmed', closed_by = $2
        where research_product_id = $1 and closed_at is null`,
      [PRODUCT_ID, FIXTURE_USERS.merchandiser],
    )
    await expect(
      db.query(
        `insert into research_shortlist_entries (research_product_id, reason, opened_by)
         values ($1, 'again', $2)`,
        [PRODUCT_ID, FIXTURE_USERS.merchandiser],
      ),
    ).resolves.toBeDefined()
  })

  it('keeps stage and disposition orthogonal: a rejection leaves CONFIRMED where it is', async () => {
    const db = await connect()
    await db.query(`select research_write_stage($1, 'CONFIRMED', null, null)`, [PRODUCT_ID])
    await db.query(`select research_write_stage($1, null, 'REJECTED', null)`, [PRODUCT_ID])
    const row = await db.query<{ stage: string; disposition: string }>(
      'select stage, disposition from research_products where id = $1',
      [PRODUCT_ID],
    )
    expect(row.rows[0]).toEqual({ stage: 'CONFIRMED', disposition: 'REJECTED' })
    await db.query(`select research_write_stage($1, null, 'NONE', null)`, [PRODUCT_ID])
  })

  it('archives a decision as a column, touches no stage, and admits a fresh decision', async () => {
    const db = await connect()
    await db.query(
      `insert into research_confirmations (id, research_product_id, decision_note, confirmed_by)
       values ($1, $2, 'A reference for the console family.', $3)`,
      [CONFIRMATION_ID, PRODUCT_ID, FIXTURE_USERS.merchandiser],
    )
    await expect(
      db.query(
        `insert into research_confirmations (research_product_id, decision_note, confirmed_by)
         values ($1, 'twice', $2)`,
        [PRODUCT_ID, FIXTURE_USERS.merchandiser],
      ),
    ).rejects.toThrow(/one_live_idx/u)

    // Archived means archived for a reason.
    await expect(
      db.query(`update research_confirmations set archived_at = now() where id = $1`, [
        CONFIRMATION_ID,
      ]),
    ).rejects.toThrow(/archived_together/u)

    const events = async () =>
      Number(
        (
          await db.query<{ count: string }>(
            `select count(*) from research_pipeline_events where entity_id = $1`,
            [PRODUCT_ID],
          )
        ).rows[0]?.count,
      )
    const before = await events()
    await db.query(
      `update research_confirmations set archived_at = now(), archived_reason = 'superseded'
        where id = $1`,
      [CONFIRMATION_ID],
    )
    expect(await events()).toBe(before)
    const stage = await db.query<{ stage: string }>(
      'select stage from research_products where id = $1',
      [PRODUCT_ID],
    )
    expect(stage.rows[0]?.stage).toBe('CONFIRMED')

    await expect(
      db.query(
        `insert into research_confirmations (research_product_id, decision_note, confirmed_by)
         values ($1, 'A fresh decision.', $2)`,
        [PRODUCT_ID, FIXTURE_USERS.merchandiser],
      ),
    ).resolves.toBeDefined()
  })

  it('stamps a started product with when and by whom, or not at all', async () => {
    const db = await connect()
    await expect(
      db.query(
        `update research_confirmations set created_product_id = gen_random_uuid()
          where research_product_id = $1 and archived_at is null`,
        [PRODUCT_ID],
      ),
    ).rejects.toThrow(/product_started_together/u)
  })
})

describeDb('Phase 35 — the field-provenance test at the database (confirmation-no-import)', () => {
  it('the bridge’s insert carries no sentinel from the research row', async () => {
    const db = await connect()
    await db.query(
      `insert into research_confirmations (research_product_id, decision_note, confirmed_by)
       values ($1, $2, $3) on conflict do nothing`,
      [SENTINEL_PRODUCT_ID, SENTINELS.note, FIXTURE_USERS.merchandiser],
    )

    // THE PROJECTION THE BRIDGE MAY READ: id, stage, archived_at. Nothing else is selected.
    const projection = await db.query<{ id: string; stage: string; archived_at: string | null }>(
      `select c.id, p.stage, c.archived_at
         from research_confirmations c join research_products p on p.id = c.research_product_id
        where c.research_product_id = $1 and c.archived_at is null`,
      [SENTINEL_PRODUCT_ID],
    )
    expect(projection.rows[0]?.stage).toBe('CONFIRMED')
    expect(Object.keys(projection.rows[0] ?? {}).sort()).toEqual(['archived_at', 'id', 'stage'])

    // THE INSERT THE BRIDGE WRITES: five fields, the slug typed, the category chosen. A bare
    // reset seeds no category, so the test brings its own when the seed has not run.
    await db.query(
      `insert into categories (id, slug, name) values ($1, 'furniture', 'Furniture')
       on conflict do nothing`,
      [CATEGORY_ID],
    )
    const category = await db.query<{ id: string }>(
      `select id from categories where slug = 'furniture' limit 1`,
    )
    const categoryId = category.rows[0]?.id
    expect(categoryId).toBeDefined()
    await db.query(
      `insert into products (id, slug, title, category_id, status, price_state)
       values ($1, 'demo-console', 'Demo Console', $2, 'DRAFT', 'PRICE_ON_REQUEST')`,
      [DRAFT_PRODUCT_ID, categoryId],
    )
    await db.query(
      `update research_confirmations
          set created_product_id = $2, product_started_at = now(), product_started_by = $3
        where research_product_id = $1 and archived_at is null and created_product_id is null`,
      [SENTINEL_PRODUCT_ID, DRAFT_PRODUCT_ID, FIXTURE_USERS.owner],
    )

    const product = await db.query(`select * from products where id = $1`, [DRAFT_PRODUCT_ID])
    const row = product.rows[0] as Record<string, unknown>
    const text = JSON.stringify(row)
    for (const sentinel of Object.values(SENTINELS)) expect(text).not.toContain(sentinel)
    expect(row['title']).toBe('Demo Console')
    expect(row['status']).toBe('DRAFT')
    expect(row['price_state']).toBe('PRICE_ON_REQUEST')
    expect(row['price_from_minor']).toBeNull()
    expect(row['price_minor']).toBeNull()
    expect(row['dimensions']).toBeNull()
    expect(row['description']).toBeNull()

    for (const table of ['product_media', 'product_materials', 'product_collections']) {
      const joins = await db.query<{ count: string }>(
        `select count(*) from ${table} where product_id = $1`,
        [DRAFT_PRODUCT_ID],
      )
      expect(Number(joins.rows[0]?.count), table).toBe(0)
    }

    // The link back is an opaque id the research side holds; the product knows nothing of it.
    const back = await db.query<{ created_product_id: string }>(
      `select created_product_id from research_confirmations where research_product_id = $1 and archived_at is null`,
      [SENTINEL_PRODUCT_ID],
    )
    expect(back.rows[0]?.created_product_id).toBe(DRAFT_PRODUCT_ID)
    expect(FIXTURE_IDS.draftProduct).not.toBe(DRAFT_PRODUCT_ID)
  })
})
