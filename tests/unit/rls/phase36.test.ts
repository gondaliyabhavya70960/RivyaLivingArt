import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FIXTURE_USERS, asAnon, asSession, connect, disconnect, loadFixture } from './harness'

/**
 * Phase 36 at the table: the two tables with row security and no anon leg; the seven seeded
 * definitions, all MANUAL and all without PII; the manage/run split — an admin creates and edits
 * a definition, a merchandiser and a researcher cannot, every staff role reads; PII on any entity
 * but INQUIRIES is refused by CHECK; one RUNNING run per definition by partial unique index; a
 * session cannot insert a run.
 */

const REQUIRE_DB = process.env.CI === 'true' || process.env.RLS_TESTS_REQUIRED === '1'
const HAVE_DB = Boolean(process.env.DATABASE_URL)
if (REQUIRE_DB && !HAVE_DB) {
  throw new Error(
    'DATABASE_URL is not set and this environment requires the database suite to run.',
  )
}
const describeDb = HAVE_DB ? describe : describe.skip

const asAdmin = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.admin, fn)
const asMerchandiser = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.merchandiser, fn)
const asResearcher = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.researcher, fn)
const asViewer = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.viewer, fn)

const DEFINITION_ID = '00000000-0000-4000-8000-000000003601'

async function cleanup(): Promise<void> {
  const db = await connect()
  await db.query("delete from sheets_export_definitions where slug like 'p36-%'")
}

beforeAll(async () => {
  await loadFixture()
  await cleanup()
})
afterAll(async () => {
  await cleanup()
  await disconnect()
})

describeDb('Phase 36 — the schema and the seed', () => {
  it('creates the two tables with row security on and no anon leg', async () => {
    const db = await connect()
    const rows = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class
        where relname in ('sheets_export_definitions', 'sheets_sync_runs') and relkind = 'r'`,
    )
    expect(rows.rows).toHaveLength(2)
    for (const row of rows.rows) expect(row.relrowsecurity).toBe(true)
    const anon = await db.query(
      `select policyname from pg_policies
        where tablename in ('sheets_export_definitions', 'sheets_sync_runs') and 'anon' = any(roles)`,
    )
    expect(anon.rows).toHaveLength(0)
  })

  it('seeds the seven definitions, all MANUAL, all without PII', async () => {
    const db = await connect()
    const rows = await db.query<{
      slug: string
      entity: string
      schedule: string
      includes_pii: boolean
    }>(
      `select slug::text as slug, entity, schedule, includes_pii from sheets_export_definitions
        where slug not like 'p36-%' order by slug`,
    )
    expect(rows.rows.map((row) => row.slug)).toEqual([
      'comparison-set',
      'confirmed',
      'direction-briefs',
      'inquiries',
      'opportunity-scores',
      'research-products',
      'shortlist',
    ])
    for (const row of rows.rows) {
      expect(row.schedule).toBe('MANUAL')
      expect(row.includes_pii).toBe(false)
    }
  })

  it('refuses an anon read of either table', async () => {
    for (const table of ['sheets_export_definitions', 'sheets_sync_runs']) {
      const rows = await asAnon((sql) => sql.rows(`select id from ${table} limit 1`))
      expect(rows).toEqual([])
    }
  })

  it('refuses personal data on any entity but INQUIRIES', async () => {
    const db = await connect()
    await expect(
      db.query(
        `insert into sheets_export_definitions (slug, name, entity, columns, tab_name, includes_pii)
         values ('p36-pii-wrong', 'x', 'SHORTLIST', array['reason'], 'x', true)`,
      ),
    ).rejects.toThrow(/pii_only_inquiries/u)
  })
})

describeDb('Phase 36 — manage versus run', () => {
  it('lets an admin create and edit a definition and refuses a merchandiser and a researcher', async () => {
    const created = await asAdmin(async (sql) => {
      await sql.rows(
        `insert into sheets_export_definitions (id, slug, name, entity, columns, tab_name)
         values ($1, 'p36-admin', 'Admin', 'SHORTLIST', array['reason'], 'Tab')`,
        [DEFINITION_ID],
      )
      return sql.affectedRows(
        `update sheets_export_definitions set name = 'Admin edited' where id = $1`,
        [DEFINITION_ID],
      )
    })
    expect(created).toBe(1)

    for (const as of [asMerchandiser, asResearcher, asViewer]) {
      const result = await as((sql) =>
        sql.attempt(
          `insert into sheets_export_definitions (slug, name, entity, columns, tab_name)
           values ('p36-refused', 'x', 'SHORTLIST', array['reason'], 'x')`,
        ),
      )
      expect(result.ok).toBe(false)
    }
  })

  it('lets every staff role read the definitions', async () => {
    for (const as of [asAdmin, asMerchandiser, asResearcher, asViewer]) {
      const rows = await as((sql) =>
        sql.rows<{ count: string }>('select count(*) from sheets_export_definitions'),
      )
      expect(Number(rows[0]?.count)).toBeGreaterThanOrEqual(7)
    }
  })

  it('refuses a session insert of a run and admits one RUNNING run per definition', async () => {
    const db = await connect()
    await db.query(
      `insert into sheets_export_definitions (id, slug, name, entity, columns, tab_name)
       values ($1, 'p36-runs', 'Runs', 'SHORTLIST', array['reason'], 'Tab') on conflict (id) do nothing`,
      [DEFINITION_ID],
    )
    const refused = await asAdmin((sql) =>
      sql.attempt(
        `insert into sheets_sync_runs (definition_id, status, trigger) values ($1, 'RUNNING', 'MANUAL')`,
        [DEFINITION_ID],
      ),
    )
    expect(refused.ok).toBe(false)

    await db.query(
      `insert into sheets_sync_runs (definition_id, status, trigger) values ($1, 'RUNNING', 'MANUAL')`,
      [DEFINITION_ID],
    )
    await expect(
      db.query(
        `insert into sheets_sync_runs (definition_id, status, trigger) values ($1, 'RUNNING', 'CRON')`,
        [DEFINITION_ID],
      ),
    ).rejects.toThrow(/one_running_idx/u)

    // A finished run has a finish time; the error code is a fixed vocabulary.
    await expect(
      db.query(
        `update sheets_sync_runs set status = 'FAILED', error_code = 'Something went wrong: https://...'
          where definition_id = $1`,
        [DEFINITION_ID],
      ),
    ).rejects.toThrow(/error_code_allowed|finished_together/u)
    await db.query(
      `update sheets_sync_runs set status = 'FAILED', error_code = 'AUTH', finished_at = now()
        where definition_id = $1`,
      [DEFINITION_ID],
    )
  })
})
