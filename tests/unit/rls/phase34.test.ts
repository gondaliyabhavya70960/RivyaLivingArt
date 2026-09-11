import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FIXTURE_USERS, asAnon, asSession, connect, disconnect, loadFixture } from './harness'

/**
 * Phase 34 at the table: PUBLISHED is refused by CHECK; the category is a checked slug and no
 * foreign key from the three tables reaches a public table (I1); no anon leg (I2); who may write
 * and who may approve — the trigger refuses a researcher's APPROVED and admits a merchandiser's,
 * stamping approver and time; evidence needs a non-empty rationale and a volatile kind needs a
 * captured value; every save writes a revision and restore puts the prose back, never the status.
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
const asEditor = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.editor, fn)

const BRIEF_ID = '00000000-0000-4000-8000-000000003401'
const TABLES = [
  'research_direction_briefs',
  'research_direction_brief_evidence',
  'research_direction_brief_revisions',
] as const

async function cleanup(): Promise<void> {
  const db = await connect()
  await db.query("delete from research_direction_briefs where slug like 'p34-%'")
}

beforeAll(async () => {
  await loadFixture()
  await cleanup()
})
afterAll(async () => {
  await cleanup()
  await disconnect()
})

describeDb('Phase 34 — the tables and the boundary', () => {
  it('creates the three tables with row security on and no anon leg', async () => {
    const db = await connect()
    const rows = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class where relname = any($1::text[]) and relkind = 'r'`,
      [[...TABLES]],
    )
    expect(rows.rows).toHaveLength(3)
    for (const row of rows.rows) expect(row.relrowsecurity).toBe(true)
    const anon = await db.query<{ n: string }>(
      `select count(*)::text as n from pg_policies where tablename = any($1::text[]) and 'anon' = any(roles)`,
      [[...TABLES]],
    )
    expect(anon.rows[0]?.n).toBe('0')
  })

  it('I1: no foreign key from the three tables reaches a public table', async () => {
    const db = await connect()
    const { rows } = await db.query<{ child: string; parent: string }>(
      `select tc.table_name as child, ccu.table_name as parent
       from information_schema.table_constraints tc
       join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
       where tc.constraint_type = 'FOREIGN KEY' and tc.table_name = any($1::text[])`,
      [[...TABLES]],
    )
    for (const row of rows) {
      expect(row.parent === 'users' || row.parent.startsWith('research_direction')).toBe(true)
    }
    const category = await db.query<{ data_type: string }>(
      `select data_type from information_schema.columns where table_name = 'research_direction_briefs' and column_name = 'target_category_slug'`,
    )
    expect(category.rows[0]?.data_type).toBe('text')
  })

  it('refuses PUBLISHED, an unknown category, and an approval without a date', async () => {
    const db = await connect()
    await db.query(
      `insert into research_direction_briefs (id, slug, title) values ($1, 'p34-brief', 'A Phase 34 brief')`,
      [BRIEF_ID],
    )
    await expect(
      db.query(`update research_direction_briefs set status = 'PUBLISHED' where id = $1`, [
        BRIEF_ID,
      ]),
    ).rejects.toThrow(/status_allowlist/u)
    await expect(
      db.query(
        `update research_direction_briefs set target_category_slug = 'sofas' where id = $1`,
        [BRIEF_ID],
      ),
    ).rejects.toThrow(/category_allowlist/u)
    await db.query(
      `update research_direction_briefs set target_category_slug = 'furniture' where id = $1`,
      [BRIEF_ID],
    )
    await expect(
      db.query(`update research_direction_briefs set status = 'APPROVED' where id = $1`, [
        BRIEF_ID,
      ]),
    ).rejects.toThrow(/approval_is_dated/u)
  })
})

describeDb('Phase 34 — who may write, who may approve', () => {
  it('a viewer reads and may not write; an editor sees nothing', async () => {
    const seen = await asViewer((sql) =>
      sql.rows<{ id: string }>('select id from research_direction_briefs where id = $1', [
        BRIEF_ID,
      ]),
    )
    expect(seen).toHaveLength(1)
    const touched = await asViewer((sql) =>
      sql.affectedRows(`update research_direction_briefs set title = 'x' where id = $1`, [
        BRIEF_ID,
      ]),
    )
    expect(touched).toBe(0)
    const editor = await asEditor((sql) =>
      sql.rows<{ id: string }>('select id from research_direction_briefs'),
    )
    expect(editor).toEqual([])
  })

  it('a researcher writes prose and moves to REVIEW, and may not APPROVE', async () => {
    const wrote = await asResearcher((sql) =>
      sql.attempt(
        `update research_direction_briefs set intent = 'Why now, in prose.', status = 'REVIEW', updated_by = $2 where id = $1`,
        [BRIEF_ID, FIXTURE_USERS.researcher],
      ),
    )
    expect(wrote.ok).toBe(true)
    const approve = await asResearcher((sql) =>
      sql.attempt(
        `update research_direction_briefs set status = 'APPROVED', approved_at = now(), approved_by = $2 where id = $1`,
        [BRIEF_ID, FIXTURE_USERS.researcher],
      ),
    )
    expect(approve.ok).toBe(false)
    expect(approve.error).toMatch(/research\.direction\.approve/u)
  })

  it('a merchandiser approves, and the row carries approver and time', async () => {
    // The harness rolls a session back at the end of its callback, so the assertion reads the
    // row inside the same callback as the update.
    const result = await asMerchandiser(async (sql) => {
      const approve = await sql.attempt(
        `update research_direction_briefs set status = 'APPROVED', approved_at = now(), approved_by = $2, updated_by = $2 where id = $1`,
        [BRIEF_ID, FIXTURE_USERS.merchandiser],
      )
      const rows = await sql.rows<{ status: string; approved_by: string | null }>(
        'select status, approved_by from research_direction_briefs where id = $1',
        [BRIEF_ID],
      )
      return { approve, rows }
    })
    expect(result.approve.ok).toBe(true)
    expect(result.rows[0]).toEqual({ status: 'APPROVED', approved_by: FIXTURE_USERS.merchandiser })
  })
})

describeDb('Phase 34 — evidence and revisions', () => {
  it('evidence needs a non-empty rationale, and a volatile kind needs a captured value', async () => {
    const db = await connect()
    await expect(
      db.query(
        `insert into research_direction_brief_evidence (brief_id, evidence_type, evidence_id, rationale, created_by)
         values ($1, 'RESEARCH_PRODUCT', gen_random_uuid(), '   ', $2)`,
        [BRIEF_ID, FIXTURE_USERS.researcher],
      ),
    ).rejects.toThrow(/rationale_not_blank/u)
    await expect(
      db.query(
        `insert into research_direction_brief_evidence (brief_id, evidence_type, evidence_id, rationale, created_by)
         values ($1, 'OPPORTUNITY_SCORE', gen_random_uuid(), 'a reason', $2)`,
        [BRIEF_ID, FIXTURE_USERS.researcher],
      ),
    ).rejects.toThrow(/volatile_is_captured/u)
    const ok = await asResearcher((sql) =>
      sql.attempt(
        `insert into research_direction_brief_evidence (brief_id, evidence_type, evidence_id, captured, rationale, created_by)
         values ($1, 'OPPORTUNITY_SCORE', gen_random_uuid(), '{"score": 82}'::jsonb, 'The highest-ranked dining row.', $2)`,
        [BRIEF_ID, FIXTURE_USERS.researcher],
      ),
    )
    expect(ok.ok).toBe(true)
  })

  it('every save wrote a revision; nobody edits or deletes one; restore puts the prose back and keeps the status', async () => {
    const db = await connect()
    // Committed state for the rest of the test: prose written, then approved (as the system,
    // which the trigger admits — a session's approval is asserted above).
    await db.query(
      `update research_direction_briefs set intent = 'Why now, in prose.', status = 'REVIEW' where id = $1`,
      [BRIEF_ID],
    )
    await db.query(
      `update research_direction_briefs set status = 'APPROVED', approved_at = now(), approved_by = $2 where id = $1`,
      [BRIEF_ID, FIXTURE_USERS.merchandiser],
    )
    const before = await db.query<{ n: string }>(
      'select count(*)::text as n from research_direction_brief_revisions where brief_id = $1',
      [BRIEF_ID],
    )
    // CREATE, the category update, the prose update, the approval: four snapshots.
    expect(Number(before.rows[0]?.n)).toBeGreaterThanOrEqual(4)
    const deleted = await asResearcher((sql) =>
      sql.affectedRows(`delete from research_direction_brief_revisions where brief_id = $1`, [
        BRIEF_ID,
      ]),
    )
    expect(deleted).toBe(0)

    // Revision 1 is the CREATE snapshot: empty intent. Restore it as a researcher and read back
    // inside the same session.
    const restored = await asResearcher(async (sql) => {
      const call = await sql.attempt('select public.research_restore_brief_revision($1, 1, $2)', [
        BRIEF_ID,
        FIXTURE_USERS.researcher,
      ])
      const rows = await sql.rows<{ intent: string | null; status: string; action: string }>(
        `select b.intent, b.status, r.action from research_direction_briefs b
         join research_direction_brief_revisions r on r.brief_id = b.id
         where b.id = $1 order by r.revision desc limit 1`,
        [BRIEF_ID],
      )
      return { call, rows }
    })
    expect(restored.call.ok).toBe(true)
    expect(restored.rows[0]?.intent).toBeNull()
    expect(restored.rows[0]?.status).toBe('APPROVED')
    expect(restored.rows[0]?.action).toBe('RESTORE')

    const viewer = await asViewer((sql) =>
      sql.attempt('select public.research_restore_brief_revision($1, 1, $2)', [
        BRIEF_ID,
        FIXTURE_USERS.viewer,
      ]),
    )
    expect(viewer.ok).toBe(false)
  })

  it('anon sees nothing', async () => {
    const rows = await asAnon((sql) =>
      sql.rows<{ id: string }>('select id from research_direction_briefs'),
    )
    expect(rows).toEqual([])
  })
})
