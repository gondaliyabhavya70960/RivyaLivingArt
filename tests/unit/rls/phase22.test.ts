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
 * Phase 22 at the table: what a visitor may read of a slot and its entries, who may curate, and
 * that the database refuses what the ladder could never keep.
 *
 * THE WINDOW IS PART OF "PUBLIC". An entry is readable by anon only while PUBLISHED, inside its
 * half-open window, and inside a PUBLISHED slot — proved by moving the window and the slot's status
 * and reading again. A plan saved for next week must not be readable the moment it is saved.
 *
 * CURATION IS THE MERCHANDISER'S. `merchandising.write` is owner, admin and merchandiser; an editor
 * holds `content.write` and may not curate, and anon may not write at all. The Server Action says so
 * in words; this proves the database says so without it.
 *
 * THE GUARDS ARE THE ROW'S. A concept collection is refused, a type the slot does not admit is
 * refused, an entity that does not exist is refused — for the owner as much as for anyone, because
 * these are facts about the reference rather than permissions.
 *
 * THE SWEEP IS THE SERVICE ROLE'S. `merch_run_schedule()` is not callable by anon or by a session;
 * `merch_move_entry()` is SECURITY INVOKER and filters to nothing for a role without the write.
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
const asEditor = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.editor, fn)
const asMerchandiser = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.merchandiser, fn)

const SLOT_KEY = 'HOMEPAGE_SELECTED_WORKS'
const FEATURED_KEY = 'HOMEPAGE_FEATURED_COLLECTIONS'
const ENTRY = '00000000-0000-4000-8000-00000000f101'
const ENTRY_TWO = '00000000-0000-4000-8000-00000000f102'

async function slotId(key: string): Promise<string> {
  const db = await connect()
  const { rows } = await db.query<{ id: string }>(
    `select id from merchandising_slots where key = $1`,
    [key],
  )
  const id = rows[0]?.id
  if (id === undefined) throw new Error(`slot ${key} is not on this database`)
  return id
}

/** A committed fixture: two PUBLISHED entries on the Selected Works slot, both windowless. */
async function seed(): Promise<void> {
  const db = await connect()
  const slot = await slotId(SLOT_KEY)
  await db.query(
    `insert into merchandising_entries (id, slot_id, entity_type, entity_id, position, status)
     values ($1, $2, 'PRODUCT', $3, 0, 'PUBLISHED'), ($4, $2, 'PRODUCT', $5, 1, 'PUBLISHED')
     on conflict (id) do nothing`,
    [ENTRY, slot, FIXTURE_IDS.publishedProduct, ENTRY_TWO, FIXTURE_IDS.draftProduct],
  )
}

async function cleanup(): Promise<void> {
  const db = await connect()
  await db.query(`delete from merchandising_entries where id in ($1, $2)`, [ENTRY, ENTRY_TWO])
  await db.query(`update merchandising_slots set status = 'PUBLISHED' where key = $1`, [SLOT_KEY])
}

async function setWindow(publishAt: string | null, unpublishAt: string | null): Promise<void> {
  const db = await connect()
  await db.query(
    `update merchandising_entries set publish_at = $2, unpublish_at = $3 where id = $1`,
    [ENTRY, publishAt, unpublishAt],
  )
}

async function setSlotStatus(status: 'DRAFT' | 'PUBLISHED'): Promise<void> {
  const db = await connect()
  await db.query(`update merchandising_slots set status = $2 where key = $1`, [SLOT_KEY, status])
}

const READ_ENTRY = `select id from merchandising_entries where id = $1`

/**
 * The fixture products this suite pins entries to are created by `loadFixture`, not by the content
 * seed. Every other database suite loads the fixture itself; relying on a neighbour having done so
 * made this file pass or fail on the runner's file order — the first suite on a fresh database
 * found no `publishedProduct` and its seed threw inside `beforeAll`.
 */
beforeAll(async () => {
  if (HAVE_DB) await loadFixture()
})
afterAll(async () => {
  await disconnect()
})

describeDb('merchandising slots and entries — what a visitor may read', () => {
  beforeAll(seed)
  afterAll(cleanup)

  it('lets anon read the eleven PUBLISHED slots', async () => {
    const rows = await asAnon((sql) =>
      sql.rows<{ key: string }>(`select key from merchandising_slots`),
    )
    expect(rows.length).toBeGreaterThanOrEqual(11)
    expect(rows.map((row) => row.key)).toContain(SLOT_KEY)
  })

  it('lets anon read a PUBLISHED, windowless entry in a PUBLISHED slot', async () => {
    await setWindow(null, null)
    const rows = await asAnon((sql) => sql.rows(READ_ENTRY, [ENTRY]))
    expect(rows).toHaveLength(1)
  })

  it('hides an entry before its window opens and after it closes', async () => {
    await setWindow('2999-01-01T00:00:00Z', null)
    expect(await asAnon((sql) => sql.rows(READ_ENTRY, [ENTRY]))).toEqual([])
    await setWindow(null, '2000-01-01T00:00:00Z')
    expect(await asAnon((sql) => sql.rows(READ_ENTRY, [ENTRY]))).toEqual([])
    await setWindow('2000-01-01T00:00:00Z', '2999-01-01T00:00:00Z')
    expect(await asAnon((sql) => sql.rows(READ_ENTRY, [ENTRY]))).toHaveLength(1)
    await setWindow(null, null)
  })

  it('hides every entry of a slot that is not itself PUBLISHED', async () => {
    await setSlotStatus('DRAFT')
    expect(await asAnon((sql) => sql.rows(READ_ENTRY, [ENTRY]))).toEqual([])
    await setSlotStatus('PUBLISHED')
    expect(await asAnon((sql) => sql.rows(READ_ENTRY, [ENTRY]))).toHaveLength(1)
  })

  it('shows staff the entry whatever its window', async () => {
    await setWindow('2999-01-01T00:00:00Z', null)
    expect(await asEditor((sql) => sql.rows(READ_ENTRY, [ENTRY]))).toHaveLength(1)
    await setWindow(null, null)
  })
})

describeDb('merchandising — who may curate', () => {
  beforeAll(seed)
  afterAll(cleanup)

  it('refuses anon and the editor a write, and lets the merchandiser through', async () => {
    const slot = await slotId(SLOT_KEY)
    const insert = `insert into merchandising_entries (slot_id, entity_type, entity_id, position)
                    values ($1, 'PRODUCT', $2, 9)`

    const anon = await asAnon((sql) => sql.attempt(insert, [slot, FIXTURE_IDS.publishedProduct]))
    expect(anon.ok).toBe(false)

    const editor = await asEditor((sql) =>
      sql.attempt(insert, [slot, FIXTURE_IDS.publishedProduct]),
    )
    expect(editor.ok).toBe(false)

    const merchandiser = await asMerchandiser(async (sql) => {
      const first = await sql.attempt(insert, [slot, FIXTURE_IDS.publishedProduct])
      // The unique target refuses the same product twice; the write itself was admitted.
      return first.ok || (first.error ?? '').includes('merchandising_entries_unique_target')
    })
    expect(merchandiser).toBe(true)
  })

  it('lets the merchandiser publish, reorder and remove, and the editor none of it', async () => {
    const editorUpdate = await asEditor((sql) =>
      sql.affectedRows(`update merchandising_entries set is_pinned = true where id = $1`, [ENTRY]),
    )
    expect(editorUpdate).toBe(0)

    const merchandiserUpdate = await asMerchandiser((sql) =>
      sql.affectedRows(`update merchandising_entries set is_pinned = true where id = $1`, [ENTRY]),
    )
    expect(merchandiserUpdate).toBe(1)

    // The harness rolls each session back, so the pin above is gone by now: this session moves
    // ENTRY below ENTRY_TWO and reads the order back within the same transaction.
    const moved = await asMerchandiser(async (sql) => {
      await sql.rows(`select merch_move_entry($1, 'down')`, [ENTRY])
      return sql.rows<{ id: string }>(
        `select id from merchandising_entries where id in ($1, $2)
         order by is_pinned desc, position asc, id asc`,
        [ENTRY, ENTRY_TWO],
      )
    })
    expect(moved.map((row) => row.id)).toEqual([ENTRY_TWO, ENTRY])

    const editorMove = await asEditor((sql) =>
      sql.attempt(`select merch_move_entry($1, 'up')`, [ENTRY]),
    )
    // SECURITY INVOKER: the editor's SELECT sees nothing, so the function reports not found.
    expect(editorMove.ok).toBe(false)

    const editorDelete = await asEditor((sql) =>
      sql.affectedRows(`delete from merchandising_entries where id = $1`, [ENTRY_TWO]),
    )
    expect(editorDelete).toBe(0)
  })

  it('refuses the slot settings to the editor and admits the merchandiser', async () => {
    const slot = await slotId(SLOT_KEY)
    const editor = await asEditor((sql) =>
      sql.affectedRows(`update merchandising_slots set min_items = 2 where id = $1`, [slot]),
    )
    expect(editor).toBe(0)
    const merchandiser = await asMerchandiser((sql) =>
      sql.affectedRows(`update merchandising_slots set min_items = min_items where id = $1`, [
        slot,
      ]),
    )
    expect(merchandiser).toBe(1)
  })
})

describeDb('merchandising — what the row refuses for everyone', () => {
  it('refuses a concept collection, even for the owner', async () => {
    const featured = await slotId(FEATURED_KEY)
    const result = await asOwner((sql) =>
      sql.attempt(
        `insert into merchandising_entries (slot_id, entity_type, entity_id, position)
         values ($1, 'COLLECTION', $2, 0)`,
        [featured, FIXTURE_IDS.draftCollection],
      ),
    )
    expect(result.ok).toBe(false)
    expect(result.error ?? '').toMatch(/concept/)
  })

  it('refuses a type the slot does not admit, and an entity that does not exist', async () => {
    const slot = await slotId(SLOT_KEY)
    const wrongType = await asOwner((sql) =>
      sql.attempt(
        `insert into merchandising_entries (slot_id, entity_type, entity_id, position)
         values ($1, 'CATEGORY', $2, 0)`,
        [slot, FIXTURE_IDS.publishedProduct],
      ),
    )
    expect(wrongType.ok).toBe(false)
    expect(wrongType.error ?? '').toMatch(/does not admit/)

    const missing = await asOwner((sql) =>
      sql.attempt(
        `insert into merchandising_entries (slot_id, entity_type, entity_id, position)
         values ($1, 'PRODUCT', '00000000-0000-4000-8000-00000000ffff', 0)`,
        [slot],
      ),
    )
    expect(missing.ok).toBe(false)
    expect(missing.error ?? '').toMatch(/does not exist/)
  })

  it('refuses a window that closes before it opens, and auto_fill without a rule', async () => {
    const slot = await slotId(SLOT_KEY)
    const window = await asOwner((sql) =>
      sql.attempt(
        `insert into merchandising_entries (slot_id, entity_type, entity_id, position, publish_at, unpublish_at)
         values ($1, 'PRODUCT', $2, 0, now(), now() - interval '1 day')`,
        [slot, FIXTURE_IDS.publishedProduct],
      ),
    )
    expect(window.ok).toBe(false)

    const rule = await asOwner((sql) =>
      sql.attempt(
        `update merchandising_slots set auto_fill = true, auto_fill_rule = null where id = $1`,
        [slot],
      ),
    )
    expect(rule.ok).toBe(false)
  })

  it('keeps the sweep for the service role', async () => {
    const anon = await asAnon((sql) => sql.attempt(`select merch_run_schedule(now())`))
    expect(anon.ok).toBe(false)
    const owner = await asOwner((sql) => sql.attempt(`select merch_run_schedule(now())`))
    expect(owner.ok).toBe(false)
    const service = await asSession('service_role', undefined, (sql) =>
      sql.rows<{ merch_run_schedule: { paths: string[] } }>(`select merch_run_schedule(now())`),
    )
    expect(Array.isArray(service[0]?.merch_run_schedule.paths)).toBe(true)
  })
})
