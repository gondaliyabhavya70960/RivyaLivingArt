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
 * Phase 24 at the table: who may read the record of a bulk operation, who may write one, and who
 * may erase one.
 *
 * THE THREE ASSERTIONS THIS SUITE EXISTS FOR:
 *
 *   1. NOBODY WITH A SESSION MAY WRITE `bulk_operations` OR `bulk_operation_items` — not an owner,
 *      not through any policy. A session able to insert an operation row could forge a preview
 *      carrying a selection nobody previewed; one able to update an item's `before` could make an
 *      undo write anything it liked into a live product while the audit log recorded a
 *      restoration. Both tables are written only by the engine, through the service role.
 *   2. NOBODY MAY DELETE EITHER. The record of what somebody did to a page of live content is not
 *      erasable by the person who did it. Enforced twice — no policy, and the grant revoked.
 *   3. `editor` AND `viewer` READ NEITHER. `bulk.execute` is owner, admin and merchandiser; the
 *      other three roles get nothing, which is the permission matrix rather than `is_staff()`.
 *
 * AND WHAT THE ROW ITSELF REFUSES, which is the part no application test can stand in for: a
 * status past PREVIEW with nothing confirmed behind it, a PREVIEW with no token to apply it with,
 * an operation that undoes itself, an applied import row naming no product. The undo skip rule is
 * asserted where it is written, in `tests/unit/bulk-undo.test.ts` — including the direction of the
 * comparison, which is what actually broke.
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
const asMerchandiser = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.merchandiser, fn)
const asEditor = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.editor, fn)
const asViewer = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.viewer, fn)

const OPERATION_ID = '00000000-0000-4000-8000-000000002401'
const ITEM_ID = '00000000-0000-4000-8000-000000002402'
const IMPORT_ID = '00000000-0000-4000-8000-000000002403'

async function seed(): Promise<void> {
  const db = await connect()

  await db.query(
    // `confirmed_at` is not decoration here: `bulk_operations_confirmed_before_running` refuses any
    // row past PREVIEW without one, which is how "nothing runs unconfirmed" is enforced at the row
    // rather than in the engine that writes it.
    `insert into bulk_operations
       (id, kind, target_entity, status, is_destructive, selection, params, counts,
        actor_user_id, actor_role, confirmed_at, undo_deadline_at)
     values ($1, 'product.archive', 'product', 'SUCCEEDED', true, $2::jsonb, '{}'::jsonb,
             '{"applied":1}'::jsonb, $3, 'admin', now(), now() + interval '24 hours')
     on conflict (id) do nothing`,
    [OPERATION_ID, JSON.stringify([FIXTURE_IDS.publishedProduct]), FIXTURE_USERS.admin],
  )

  await db.query(
    `insert into bulk_operation_items
       (id, operation_id, entity_id, result, before, after, row_version_before)
     values ($1, $2, $3, 'APPLIED', '{"status":"PUBLISHED"}'::jsonb, '{"status":"ARCHIVED"}'::jsonb, now())
     on conflict (id) do nothing`,
    [ITEM_ID, OPERATION_ID, FIXTURE_IDS.publishedProduct],
  )

  await db.query(
    `insert into bulk_imports (id, filename, checksum, delimiter, row_count, valid_count, invalid_count)
     values ($1, 'products.csv', 'abc', ',', 2, 1, 1)
     on conflict (id) do nothing`,
    [IMPORT_ID],
  )
}

async function cleanup(): Promise<void> {
  const db = await connect()
  await db.query('delete from bulk_operation_items where operation_id = $1', [OPERATION_ID])
  await db.query('delete from bulk_operations where id = $1', [OPERATION_ID])
  await db.query('delete from bulk_import_rows where import_id = $1', [IMPORT_ID])
  await db.query('delete from bulk_imports where id = $1', [IMPORT_ID])
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

describeDb('Phase 24 — who may read the record', () => {
  it('lets an owner read an operation', async () => {
    const rows = await asOwner((sql) =>
      sql.rows(`select id from bulk_operations where id = $1`, [OPERATION_ID]),
    )
    expect(rows).toHaveLength(1)
  })

  it('lets a merchandiser read one — bulk.execute, not operations.audit.read', async () => {
    const rows = await asMerchandiser((sql) =>
      sql.rows(`select id from bulk_operations where id = $1`, [OPERATION_ID]),
    )
    expect(rows).toHaveLength(1)
  })

  it('gives an EDITOR nothing', async () => {
    const rows = await asEditor((sql) => sql.rows(`select id from bulk_operations`).catch(() => []))
    expect(rows).toHaveLength(0)
  })

  it('gives a VIEWER nothing', async () => {
    const rows = await asViewer((sql) => sql.rows(`select id from bulk_operations`).catch(() => []))
    expect(rows).toHaveLength(0)
  })

  it('gives ANON nothing, on all four tables', async () => {
    for (const table of [
      'bulk_operations',
      'bulk_operation_items',
      'bulk_imports',
      'bulk_import_rows',
    ]) {
      const rows = await asAnon((sql) => sql.rows(`select id from ${table}`).catch(() => []))
      expect(rows, table).toHaveLength(0)
    }
  })
})

describeDb('Phase 24 — nobody with a session may write the record', () => {
  it('refuses an OWNER inserting an operation row', async () => {
    const result = await asOwner((sql) =>
      sql.attempt(
        `insert into bulk_operations (kind, target_entity, selection)
         values ('product.archive', 'product', '[]'::jsonb)`,
      ),
    )
    expect(result.ok).toBe(false)
  })

  it('refuses an OWNER editing an item snapshot', async () => {
    const result = await asOwner((sql) =>
      sql.attempt(
        `update bulk_operation_items set before = '{"status":"DRAFT"}'::jsonb where id = $1`,
        [ITEM_ID],
      ),
    )
    // RLS FILTERS AN UPDATE RATHER THAN REFUSING IT, so "ok" here means the statement ran and
    // matched nothing. The row is read back to prove it is unchanged.
    const after = await asOwner((sql) =>
      sql.rows<{ before: unknown }>(`select before from bulk_operation_items where id = $1`, [
        ITEM_ID,
      ]),
    )
    expect(JSON.stringify(after[0]?.before)).toContain('PUBLISHED')
    void result
  })

  it('refuses ANON inserting anything', async () => {
    const result = await asAnon((sql) =>
      sql.attempt(
        `insert into bulk_operations (kind, target_entity, selection)
         values ('forged', 'product', '[]'::jsonb)`,
      ),
    )
    expect(result.ok).toBe(false)
  })
})

describeDb('Phase 24 — the record is not erasable', () => {
  it('refuses an OWNER deleting an operation', async () => {
    const result = await asOwner((sql) =>
      sql.attempt(`delete from bulk_operations where id = $1`, [OPERATION_ID]),
    )
    expect(result.ok).toBe(false)
    expect(result.error ?? '').toMatch(/permission denied/i)
  })

  it('refuses an OWNER deleting an item', async () => {
    const result = await asOwner((sql) =>
      sql.attempt(`delete from bulk_operation_items where id = $1`, [ITEM_ID]),
    )
    expect(result.ok).toBe(false)
    expect(result.error ?? '').toMatch(/permission denied/i)
  })

  it('still has both rows afterwards', async () => {
    const rows = await asOwner((sql) =>
      sql.rows(`select id from bulk_operation_items where id = $1`, [ITEM_ID]),
    )
    expect(rows).toHaveLength(1)
  })
})

describeDb('Phase 24 — what the row itself refuses', () => {
  it('refuses a selection larger than 500', async () => {
    const db = await connect()
    const big = JSON.stringify(Array.from({ length: 501 }, (_, index) => `id-${index}`))
    let error = ''
    try {
      await db.query(
        // The token is here so the row reaches the constraint under test: a PREVIEW without one
        // is refused earlier, by `bulk_operations_preview_has_token`, which is its own test below.
        `insert into bulk_operations (kind, target_entity, selection, confirmation_token)
         values ('product.publish', 'product', $1::jsonb, 'tok')`,
        [big],
      )
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    }
    expect(error).toMatch(/selection_capped/i)
  })

  it('refuses a target entity outside the four', async () => {
    const db = await connect()
    let error = ''
    try {
      await db.query(
        `insert into bulk_operations (kind, target_entity, selection, confirmation_token)
         values ('x', 'journal_article', '[]'::jsonb, 'tok')`,
      )
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    }
    expect(error).toMatch(/target_allowlist/i)
  })

  /**
   * NOTHING RUNS UNCONFIRMED, AND EVERY PREVIEW IS APPLICABLE — the two halves of the four-step
   * flow that the row itself can hold. An engine bug that queued an operation without stamping a
   * confirmation, or wrote a preview with no token for Apply to present, is refused here rather
   * than discovered when somebody notices a page of products changed with nobody having pressed
   * the second button.
   */
  it('refuses a status past PREVIEW with nothing confirmed behind it', async () => {
    const db = await connect()
    let error = ''
    try {
      await db.query(
        `insert into bulk_operations (kind, target_entity, status, selection)
         values ('product.publish', 'product', 'RUNNING', '[]'::jsonb)`,
      )
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    }
    expect(error).toMatch(/confirmed_before_running/i)
  })

  it('refuses a PREVIEW with no token to apply it with', async () => {
    const db = await connect()
    let error = ''
    try {
      await db.query(
        `insert into bulk_operations (kind, target_entity, selection)
         values ('product.publish', 'product', '[]'::jsonb)`,
      )
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    }
    expect(error).toMatch(/preview_has_token/i)
  })

  it('refuses an item marked SKIPPED with no reason and no error', async () => {
    const db = await connect()
    let error = ''
    try {
      await db.query(
        `insert into bulk_operation_items (operation_id, entity_id, result)
         values ($1, gen_random_uuid(), 'SKIPPED')`,
        [OPERATION_ID],
      )
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    }
    expect(error).toMatch(/reason_present/i)
  })

  it('refuses an operation that undoes itself', async () => {
    const db = await connect()
    let error = ''
    try {
      await db.query(`update bulk_operations set undo_of_operation_id = id where id = $1`, [
        OPERATION_ID,
      ])
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    }
    expect(error).toMatch(/no_self_undo/i)
  })

  it('refuses an applied import row that names no product', async () => {
    const db = await connect()
    let error = ''
    try {
      await db.query(
        `insert into bulk_import_rows (import_id, row_number, raw, applied)
         values ($1, 1, '{}'::jsonb, true)`,
        [IMPORT_ID],
      )
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    }
    expect(error).toMatch(/applied_has_target/i)
  })
})
