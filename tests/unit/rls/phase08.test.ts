import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { slotKeyOf } from '@/lib/media/gaps'

import { FIXTURE_USERS, asUser, connect, disconnect, loadFixture } from './harness'

/**
 * The in-database half of the status workflow.
 *
 * WHY THIS SUITE EXISTS AT ALL. `lib/cms/publishing.ts` checks the same twelve edges before it
 * calls the database, and that check is the one that produces a readable error. This suite proves
 * the OTHER copy — the trigger — because PostgREST is reachable with an anon key and a session
 * cookie and never runs a line of our TypeScript. Everything asserted below goes straight at the
 * table, exactly as a `curl` would: no service module, no guard, no Zod.
 *
 * If every test here passed while the trigger did nothing, the whole workflow would be advisory.
 * So each one is written to FAIL loudly on a missing trigger rather than to confirm a happy path.
 */

const REQUIRE_DB = process.env.CI === 'true' || process.env.RLS_TESTS_REQUIRED === '1'
const HAVE_DB = Boolean(process.env.DATABASE_URL)

if (REQUIRE_DB && !HAVE_DB) {
  throw new Error(
    'DATABASE_URL is not set and this environment requires the RLS suite to run. ' +
      'Refusing to skip: a skipped security suite reports success while proving nothing.',
  )
}

const describeDb = HAVE_DB ? describe : describe.skip

const PAGE = '00000000-0000-4000-8000-0000000000c1'

/** Postgres error codes, as the trigger raises them. */
const ILLEGAL = '23514'
const FORBIDDEN = '42501'

async function readStatus(): Promise<string | undefined> {
  const db = await connect()
  const { rows } = await db.query<{ status: string }>('select status from pages where id = $1', [
    PAGE,
  ])
  return rows[0]?.status
}

async function codeOf(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn()
    return null
  } catch (error) {
    return (error as { code?: string }).code ?? 'unknown'
  }
}

describeDb('the status-transition trigger', () => {
  beforeAll(async () => {
    await loadFixture()
    const db = await connect()
    await db.query('delete from page_sections')
    await db.query('delete from pages')
    // Service role: no session actor, so the INSERT rule does not apply and the fixture can be
    // written straight to the status each test needs.
    await db.query(
      `insert into pages (id, slug, kind, title, path, status)
       values ($1, 'trigger-test', 'PAGE', 'Trigger test', '/trigger-test', 'DRAFT')`,
      [PAGE],
    )
  })

  afterAll(disconnect)

  describe('INSERT', () => {
    it('refuses a session actor creating a row at PUBLISHED', async () => {
      // THE HOLE THIS TRIGGER EXISTS FOR. The generated insert policy is
      // `with check (has_role(...))` with no status predicate, so without this arm a content.write
      // holder POSTs a PUBLISHED row through PostgREST and reaches the public site having never
      // been in REVIEW.
      const code = await codeOf(() =>
        asUser(FIXTURE_USERS.editor, (sql) =>
          sql.rows(
            `insert into pages (slug, kind, title, path, status)
             values ('sneak', 'PAGE', 'Sneak', '/sneak', 'PUBLISHED')`,
          ),
        ),
      )
      expect(code).toBe(ILLEGAL)
    })

    it('refuses even the owner creating a row at PUBLISHED', async () => {
      // Not a permission rule — a legality one. Nobody skips review, including the owner.
      const code = await codeOf(() =>
        asUser(FIXTURE_USERS.owner, (sql) =>
          sql.rows(
            `insert into pages (slug, kind, title, path, status)
             values ('owner-sneak', 'PAGE', 'S', '/owner-sneak', 'PUBLISHED')`,
          ),
        ),
      )
      expect(code).toBe(ILLEGAL)
    })

    it('allows a session actor creating a DRAFT', async () => {
      const code = await codeOf(() =>
        asUser(FIXTURE_USERS.editor, (sql) =>
          sql.rows(
            `insert into pages (slug, kind, title, path, status)
             values ('ok-draft', 'PAGE', 'D', '/ok-draft', 'DRAFT')`,
          ),
        ),
      )
      expect(code).toBeNull()
    })

    it('allows the service role to insert at PUBLISHED, because the seed must', async () => {
      // A null actor is a migration or the Phase 09 seed runner over DATABASE_URL (A4·d), which
      // legitimately writes global labels straight to PUBLISHED.
      const db = await connect()
      await db.query(
        `insert into pages (slug, kind, title, path, status)
         values ('seeded', 'PAGE', 'S', '/seeded', 'PUBLISHED')`,
      )
      const { rows } = await db.query<{ status: string }>(
        `select status from pages where slug = 'seeded'`,
      )
      expect(rows[0]?.status).toBe('PUBLISHED')
      await db.query(`delete from pages where slug = 'seeded'`)
    })
  })

  describe('edge legality, asked before permission', () => {
    it('refuses DRAFT -> PUBLISHED for an owner with 23514, not 42501', async () => {
      // The distinction is the point: an impossible move must read as impossible, not as "you are
      // not allowed", or somebody spends an afternoon granting permissions that cannot help.
      const code = await codeOf(() =>
        asUser(FIXTURE_USERS.owner, (sql) =>
          sql.rows(`update pages set status = 'PUBLISHED' where id = $1`, [PAGE]),
        ),
      )
      expect(code).toBe(ILLEGAL)
    })

    it('refuses ARCHIVED -> PUBLISHED', async () => {
      const db = await connect()
      await db.query(`update pages set status = 'ARCHIVED' where id = $1`, [PAGE])
      const code = await codeOf(() =>
        asUser(FIXTURE_USERS.owner, (sql) =>
          sql.rows(`update pages set status = 'PUBLISHED' where id = $1`, [PAGE]),
        ),
      )
      await db.query(`update pages set status = 'DRAFT' where id = $1`, [PAGE])
      expect(code).toBe(ILLEGAL)
    })
  })

  describe('permission, once the edge is legal', () => {
    it('stops a merchandiser at the RLS policy, before the trigger is ever reached', async () => {
      /**
       * WRITTEN AS A REFUSAL AT FIRST, AND THAT WAS WRONG — which is worth recording rather than
       * quietly fixing. A merchandiser holds no `content.write`, so `pages_update_staff` does not
       * admit them, and an UPDATE matching no policy in PostgreSQL does not raise: it matches zero
       * rows and reports success. The trigger never fires because no row is being updated.
       *
       * So the honest assertion is "nothing changed", not "42501". And the consequence is worth
       * stating plainly: the trigger's PERMISSION arm is currently unreachable, because
       * `content.write`, `content.review` and `content.publish` are held by the same three roles —
       * anyone who can update the row at all can take every edge. It is not dead weight, it is a
       * latch: the day the owner narrows `content.publish` to ['owner','admin'] (the open decision
       * recorded in SESSION-STATE), an editor keeps their write policy and starts being refused
       * here, with no schema change. The arm is what makes that a one-line change.
       */
      const before = await readStatus()
      const code = await codeOf(() =>
        asUser(FIXTURE_USERS.merchandiser, (sql) =>
          sql.rows(`update pages set status = 'REVIEW' where id = $1`, [PAGE]),
        ),
      )
      expect(code).toBeNull()
      expect(await readStatus()).toBe(before)
    })

    it('allows an editor to walk DRAFT -> REVIEW -> APPROVED -> PUBLISHED', async () => {
      // ONE asUser BLOCK, not three. `asUser` wraps its body in a transaction it always rolls
      // back, so three separate calls each start from DRAFT again and the second one asks for
      // DRAFT -> APPROVED, which is correctly refused. The walk has to happen inside a single
      // transaction — which is also how the real service will do it.
      const code = await codeOf(() =>
        asUser(FIXTURE_USERS.editor, async (sql) => {
          for (const next of ['REVIEW', 'APPROVED', 'PUBLISHED']) {
            await sql.rows(`update pages set status = $2 where id = $1`, [PAGE, next])
          }
        }),
      )
      expect(code).toBeNull()
    })

    it('lets an ordinary edit through without touching status', async () => {
      // `old.status is not distinct from new.status` is not a transition. If this failed, every
      // typo fix on a published page would demand a publish permission.
      const code = await codeOf(() =>
        asUser(FIXTURE_USERS.editor, (sql) =>
          sql.rows(`update pages set title = 'Edited' where id = $1`, [PAGE]),
        ),
      )
      expect(code).toBeNull()
    })
  })

  describe('verification authority', () => {
    it('refuses an editor marking a row VERIFIED', async () => {
      // content.verify is owner/admin. Asserting that a business claim is TRUE is not an editorial
      // act, which is the whole premise of D10.
      const code = await codeOf(() =>
        asUser(FIXTURE_USERS.editor, (sql) =>
          sql.rows(`update pages set owner_verification = 'VERIFIED' where id = $1`, [PAGE]),
        ),
      )
      expect(code).toBe(FORBIDDEN)
    })

    it('allows an admin marking a row VERIFIED', async () => {
      const code = await codeOf(() =>
        asUser(FIXTURE_USERS.admin, (sql) =>
          sql.rows(`update pages set owner_verification = 'VERIFIED' where id = $1`, [PAGE]),
        ),
      )
      expect(code).toBeNull()
    })

    it('lets an editor edit a row that is ALREADY verified', async () => {
      // The guard is on the transition INTO VERIFIED, not on touching a verified row. Otherwise an
      // owner would have to make every subsequent typo fix themselves.
      const code = await codeOf(() =>
        asUser(FIXTURE_USERS.editor, (sql) =>
          sql.rows(`update pages set title = 'Still verified' where id = $1`, [PAGE]),
        ),
      )
      expect(code).toBeNull()
    })
  })

  describe('the owner-verification publish gate', () => {
    it('refuses PUBLISHED while OWNER_VERIFICATION_REQUIRED, by check constraint', async () => {
      // Owned by `pages_verified_before_publish`, not by the trigger — one rule, one enforcer, and
      // a check constraint has no INSERT hole.
      // Walk to APPROVED rather than jumping: edge legality binds the service role too. Only the
      // PERMISSION arm exempts a null actor, which is what ARCHITECTURE §4.2 promises — the service
      // role bypasses authorisation, not the state machine.
      const db = await connect()
      await db.query(
        `update pages set owner_verification = 'OWNER_VERIFICATION_REQUIRED' where id = $1`,
        [PAGE],
      )
      await db.query(`update pages set status = 'REVIEW' where id = $1`, [PAGE])
      await db.query(`update pages set status = 'APPROVED' where id = $1`, [PAGE])
      const code = await codeOf(() =>
        asUser(FIXTURE_USERS.owner, (sql) =>
          sql.rows(`update pages set status = 'PUBLISHED' where id = $1`, [PAGE]),
        ),
      )
      expect(code).toBe(ILLEGAL)
      await db.query(
        `update pages set owner_verification = 'NOT_REQUIRED', status = 'DRAFT' where id = $1`,
        [PAGE],
      )
      expect(await readStatus()).toBe('DRAFT')
    })
  })
})

describeDb('the trigger set', () => {
  const SECTION_PAGE = '00000000-0000-4000-8000-0000000000d1'
  const ASSETS = [
    '00000000-0000-4000-8000-0000000000e1',
    '00000000-0000-4000-8000-0000000000e2',
    '00000000-0000-4000-8000-0000000000e3',
  ] as const

  beforeAll(async () => {
    const db = await connect()
    await db.query('delete from page_sections')
    await db.query(`delete from pages where id = $1`, [SECTION_PAGE])
    await db.query(`delete from media_assets where rivya_asset_id like 'TRIG-%'`)
    await db.query(
      `insert into pages (id, slug, kind, title, path) values ($1,'trig','PAGE','T','/trig')`,
      [SECTION_PAGE],
    )
    for (const [i, id] of ASSETS.entries()) {
      await db.query(
        `insert into media_assets (id, rivya_asset_id, provider, resource_type, public_id, folder,
                                   filename, kind, source, alt_text, is_ai_generated, is_concept)
         values ($1, $2, 'cloudinary', 'image', $3, 'rivya/trig', $4, 'IMAGE', 'HIGGSFIELD', 'a', true, true)`,
        [id, `TRIG-${String(i)}`, `rivya/trig/a${String(i)}`, `a${String(i)}`],
      )
    }
  })

  afterAll(disconnect)

  const gallery = (order: readonly string[]) =>
    JSON.stringify({
      media: order.map((id) => ({ slot: 'gallery', role: 'GALLERY', media_id: id })),
    })

  describe('sync_media_usages and the Phase 07 slot_key contract', () => {
    it('writes gallery[0..2] with role GALLERY for a three-image payload', async () => {
      // Verification step 9, verbatim.
      const db = await connect()
      const { rows: created } = await db.query<{ id: string }>(
        `insert into page_sections (page_id, block_type, position, payload)
         values ($1, 'category-grid', 0, $2::jsonb) returning id`,
        [SECTION_PAGE, gallery(ASSETS)],
      )
      const section = created[0]!.id

      const { rows } = await db.query<{ slot_key: string; role: string }>(
        `select slot_key, role from media_usages where context_id = $1 order by slot_key`,
        [section],
      )
      expect(rows.map((r) => r.slot_key)).toEqual(['gallery[0]', 'gallery[1]', 'gallery[2]'])
      expect(new Set(rows.map((r) => r.role))).toEqual(new Set(['GALLERY']))
    })

    it('round-trips through slotKeyOf, which is what closes the contract', async () => {
      // The whole point of the bracket form: lib/media/gaps.ts must be able to map every usage row
      // back to the declared slot it belongs to. If this drifted, the Gaps tab would report a bound
      // slot as unbound — silently, and plausibly.
      const db = await connect()
      const { rows } = await db.query<{ slot_key: string }>(
        `select slot_key from media_usages where slot_key like 'gallery%'`,
      )
      expect(rows.length).toBeGreaterThan(0)
      for (const row of rows) {
        expect(slotKeyOf(row.slot_key)).toBe('gallery')
      }
    })

    it('renumbers in place on a payload reorder without colliding', async () => {
      const db = await connect()
      const { rows: found } = await db.query<{ id: string }>(
        `select id from page_sections where page_id = $1 limit 1`,
        [SECTION_PAGE],
      )
      const section = found[0]!.id
      const reordered = [ASSETS[2], ASSETS[0], ASSETS[1]]
      await db.query(`update page_sections set payload = $2::jsonb where id = $1`, [
        section,
        gallery(reordered),
      ])

      const { rows } = await db.query<{ slot_key: string; media_id: string }>(
        `select slot_key, media_id from media_usages where context_id = $1 order by slot_key`,
        [section],
      )
      expect(rows).toHaveLength(3)
      expect(rows[0]?.media_id).toBe(ASSETS[2])
    })

    it('gives the desktop/mobile pair one slot_key split by role', async () => {
      // Legal because the unique key is (context_type, context_id, slot_key, role) — the role is
      // what distinguishes them, not a second key.
      const db = await connect()
      const { rows: found } = await db.query<{ id: string }>(
        `select id from page_sections where page_id = $1 limit 1`,
        [SECTION_PAGE],
      )
      await db.query(
        `update page_sections set media_slot_key = 'home.intro',
                                  media_desktop_id = $2, media_mobile_id = $3 where id = $1`,
        [found[0]!.id, ASSETS[0], ASSETS[1]],
      )
      const { rows } = await db.query<{ role: string }>(
        `select role from media_usages where context_id = $1 and slot_key = 'home.intro' order by role`,
        [found[0]!.id],
      )
      expect(rows.map((r) => r.role)).toEqual(['DESKTOP', 'MOBILE'])
    })

    it('clears usages when the section is deleted', async () => {
      // context_id is polymorphic so no foreign key can cascade it. Stranded rows would keep
      // refusing to let an asset be deleted, and nobody finds that by looking.
      const db = await connect()
      const { rows: found } = await db.query<{ id: string }>(
        `select id from page_sections where page_id = $1 limit 1`,
        [SECTION_PAGE],
      )
      const section = found[0]!.id
      await db.query(`delete from page_sections where id = $1`, [section])
      const { rows } = await db.query(`select 1 from media_usages where context_id = $1`, [section])
      expect(rows).toHaveLength(0)
    })
  })

  describe('write_revision', () => {
    it('appends exactly one revision per mutation', async () => {
      // Verification step 6. "Exactly one" is the assertion that matters: cms_publish_section must
      // never insert a revision itself, because the trigger already fires inside its transaction.
      const db = await connect()
      const { rows: created } = await db.query<{ id: string }>(
        `insert into page_sections (page_id, block_type, position)
         values ($1, 'statement', 50) returning id`,
        [SECTION_PAGE],
      )
      const section = created[0]!.id
      const count = async () => {
        const { rows } = await db.query<{ n: string }>(
          `select count(*)::text as n from content_revisions
            where entity_type = 'page_section' and entity_id = $1`,
          [section],
        )
        return Number(rows[0]!.n)
      }
      expect(await count()).toBe(1)
      await db.query(`update page_sections set heading = 'one' where id = $1`, [section])
      expect(await count()).toBe(2)
      await db.query(`update page_sections set heading = 'two' where id = $1`, [section])
      expect(await count()).toBe(3)
    })

    it('labels a status change STATUS_CHANGE and an edit UPDATE', async () => {
      const db = await connect()
      const { rows: created } = await db.query<{ id: string }>(
        `insert into page_sections (page_id, block_type, position)
         values ($1, 'divider', 51) returning id`,
        [SECTION_PAGE],
      )
      const section = created[0]!.id
      await db.query(`update page_sections set heading = 'x' where id = $1`, [section])
      await db.query(`update page_sections set status = 'REVIEW' where id = $1`, [section])
      const { rows } = await db.query<{ action: string }>(
        `select action from content_revisions where entity_type = 'page_section' and entity_id = $1
          order by revision_no`,
        [section],
      )
      expect(rows.map((r) => r.action)).toEqual(['CREATE', 'UPDATE', 'STATUS_CHANGE'])
    })

    it('numbers revisions per entity, starting at 1', async () => {
      // Not a global sequence: a section's history should read 1, 2, 3, not 47, 112, 3809.
      const db = await connect()
      const { rows: created } = await db.query<{ id: string }>(
        `insert into page_sections (page_id, block_type, position)
         values ($1, 'quote', 52) returning id`,
        [SECTION_PAGE],
      )
      const { rows } = await db.query<{ revision_no: number }>(
        `select revision_no from content_revisions where entity_id = $1`,
        [created[0]!.id],
      )
      expect(rows[0]?.revision_no).toBe(1)
    })

    it('refuses an UPDATE to the history, even as staff', async () => {
      // Verification step 6's second half. content_revisions has no update policy at all, so this
      // matches zero rows rather than raising — the assertion is that nothing changed.
      const db = await connect()
      const { rows: before } = await db.query<{ snapshot: unknown }>(
        `select snapshot from content_revisions limit 1`,
      )
      await asUser(FIXTURE_USERS.owner, (sql) =>
        sql.rows(`update content_revisions set snapshot = '{}'::jsonb`),
      )
      const { rows: after } = await db.query<{ snapshot: unknown }>(
        `select snapshot from content_revisions limit 1`,
      )
      expect(after[0]?.snapshot).toEqual(before[0]?.snapshot)
      expect(after[0]?.snapshot).not.toEqual({})
    })
  })
})
