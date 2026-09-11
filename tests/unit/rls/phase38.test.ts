import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FIXTURE_USERS, asAnon, asSession, connect, disconnect, loadFixture } from './harness'

/**
 * Phase 38 at the table: `system_logs` has row security and no anon leg; only owner and admin read;
 * no session may insert, update or delete, the owner included (append-only, proved by the
 * `update system_logs set message='x'` the phase document names); `system_log_write()` is not
 * executable by anon or authenticated; 1,000 identical writes inside the window are one row with
 * `occurrence_count = 1000`; a different dedupe key is a second row; `workflow_runs_v` exists,
 * is security-invoker, and unions the five run tables.
 */

const REQUIRE_DB = process.env.CI === 'true' || process.env.RLS_TESTS_REQUIRED === '1'
const HAVE_DB = Boolean(process.env.DATABASE_URL)
if (REQUIRE_DB && !HAVE_DB) {
  throw new Error(
    'DATABASE_URL is not set and this environment requires the database suite to run.',
  )
}
const describeDb = HAVE_DB ? describe : describe.skip

const asOwner = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.owner, fn)
const asAdmin = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.admin, fn)
const asEditor = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.editor, fn)

const KEY = 'p38:test:dedupe'

async function cleanup(): Promise<void> {
  const db = await connect()
  await db.query("delete from system_logs where dedupe_key like 'p38:%'")
}

async function write(key: string, message = 'the same line'): Promise<string> {
  const db = await connect()
  const result = await db.query<{ id: string }>(
    `select system_log_write('INFO', 'SYSTEM', 'p38.test', $2, '{"k":"v"}'::jsonb,
       null, null, null, null, null, null, null, $1) as id`,
    [key, message],
  )
  return result.rows[0]?.id ?? ''
}

beforeAll(async () => {
  await loadFixture()
  await cleanup()
})

afterAll(async () => {
  await cleanup()
  await disconnect()
})

describeDb('system_logs — Phase 38', () => {
  it('has row security on, no anon policy, and a select for owner and admin only', async () => {
    const db = await connect()
    const rls = await db.query("select relrowsecurity from pg_class where relname = 'system_logs'")
    expect(rls.rows[0]?.relrowsecurity).toBe(true)
    const anon = await db.query(
      "select count(*)::int as n from pg_policies where tablename = 'system_logs' and 'anon' = any(roles)",
    )
    expect(anon.rows[0]?.n).toBe(0)
    await write('p38:visibility')
    expect(
      await asAnon((sql) =>
        sql.rows("select id from system_logs where dedupe_key = 'p38:visibility'"),
      ),
    ).toHaveLength(0)
    expect(
      await asEditor((sql) =>
        sql.rows("select id from system_logs where dedupe_key = 'p38:visibility'"),
      ),
    ).toHaveLength(0)
    expect(
      await asAdmin((sql) =>
        sql.rows("select id from system_logs where dedupe_key = 'p38:visibility'"),
      ),
    ).toHaveLength(1)
  })

  it('is append-only: no session inserts, updates or deletes, the owner included', async () => {
    await write('p38:immutable')
    const insert = await asOwner((sql) =>
      sql.attempt(
        "insert into system_logs (level, channel, event, message, dedupe_key) values ('INFO','SYSTEM','p38.forged','x','p38:forged')",
      ),
    )
    expect(insert.ok).toBe(false)
    // `revoke update, delete` makes these permission errors, not silent zero-row updates —
    // the phase document's verification 1 asks for exactly that.
    const updated = await asOwner((sql) =>
      sql.attempt("update system_logs set message = 'x' where dedupe_key = 'p38:immutable'"),
    )
    expect(updated.ok).toBe(false)
    const deleted = await asOwner((sql) =>
      sql.attempt("delete from system_logs where dedupe_key = 'p38:immutable'"),
    )
    expect(deleted.ok).toBe(false)
  })

  it('does not let anon or a session call the writer', async () => {
    const db = await connect()
    const grants = await db.query<{ role: string; ok: boolean }>(
      `select r.rolname as role, has_function_privilege(r.rolname, p.oid, 'execute') as ok
         from pg_proc p, pg_roles r
        where p.proname = 'system_log_write' and r.rolname in ('anon', 'authenticated', 'service_role')`,
    )
    const byRole = new Map(grants.rows.map((row) => [row.role, row.ok]))
    expect(byRole.get('anon')).toBe(false)
    expect(byRole.get('authenticated')).toBe(false)
    expect(byRole.get('service_role')).toBe(true)
  })

  it('collapses 1,000 identical events inside the window into one row counting 1000', async () => {
    const ids = new Set<string>()
    for (let i = 0; i < 1_000; i += 1) ids.add(await write(KEY))
    expect(ids.size).toBe(1)
    const db = await connect()
    const rows = await db.query<{ occurrence_count: number; n: string }>(
      'select occurrence_count, count(*) over () as n from system_logs where dedupe_key = $1',
      [KEY],
    )
    expect(rows.rows).toHaveLength(1)
    expect(rows.rows[0]?.occurrence_count).toBe(1_000)
  })

  it('keeps a different dedupe key as its own row', async () => {
    const first = await write('p38:one')
    const second = await write('p38:two')
    expect(first).not.toBe(second)
  })

  it('refuses a malformed event name and a blank message', async () => {
    const db = await connect()
    for (const [event, message] of [
      ['Bad Event', 'x'],
      ['p38.ok', '   '],
    ]) {
      const outcome = await db
        .query(
          `select system_log_write('INFO','SYSTEM',$1,$2,'{}'::jsonb,null,null,null,null,null,null,null,'p38:shape')`,
          [event, message],
        )
        .then(
          () => 'stored',
          (error: unknown) => (error instanceof Error ? error.message : 'error'),
        )
      expect(outcome).not.toBe('stored')
    }
  })

  it('unions the five run tables in workflow_runs_v as security invoker', async () => {
    const db = await connect()
    const view = await db.query<{ options: string[] | null }>(
      "select reloptions as options from pg_class where relname = 'workflow_runs_v'",
    )
    expect(view.rows[0]?.options ?? []).toContain('security_invoker=true')
    const kinds = await db.query<{ kind: string }>(
      'select distinct kind from workflow_runs_v order by kind',
    )
    // The fixture holds no run yet; the view still parses and names the five kinds in its SQL.
    const definition = await db.query<{ def: string }>(
      "select pg_get_viewdef('workflow_runs_v'::regclass) as def",
    )
    for (const kind of ['RESEARCH', 'SHEETS', 'SEED', 'HIGGSFIELD', 'BULK']) {
      expect(definition.rows[0]?.def).toContain(`'${kind}'`)
    }
    expect(Array.isArray(kinds.rows)).toBe(true)
  })
})
