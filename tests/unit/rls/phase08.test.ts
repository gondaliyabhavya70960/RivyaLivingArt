import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { isLive } from '@/lib/cms/windowing'
import { slotKeyOf } from '@/lib/media/gaps'

import { FIXTURE_USERS, asAnon, asUser, connect, disconnect, loadFixture } from './harness'

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

/** A raw read as the anon role — what a visitor's browser can see. */
async function asSessionAnon<T>(text: string): Promise<{ rows: T }> {
  const rows = await asAnon((sql) => sql.rows(text))
  return { rows: rows as T }
}

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

describeDb('cms_publish_section — the media cascade', () => {
  const PAGE_ID = '00000000-0000-4000-8000-0000000000f0'
  const GOOD = '00000000-0000-4000-8000-0000000000f1'
  const NOT_APPROVED = '00000000-0000-4000-8000-0000000000f2'
  const UNVERIFIED = '00000000-0000-4000-8000-0000000000f3'
  let section = ''

  const asset = async (
    id: string,
    ref: string,
    status: string,
    verification: string,
  ): Promise<void> => {
    const db = await connect()
    await db.query(
      `insert into media_assets (id, rivya_asset_id, provider, resource_type, public_id, folder,
                                 filename, kind, source, alt_text, is_ai_generated, is_concept,
                                 status, owner_verification)
       values ($1,$2,'cloudinary','image',$3,'rivya/casc',$4,'IMAGE','HIGGSFIELD','a',true,true,$5,$6)`,
      [id, ref, `rivya/casc/${ref}`, ref, status, verification],
    )
  }

  beforeAll(async () => {
    const db = await connect()
    await db.query('delete from page_sections')
    await db.query(`delete from pages where id = $1`, [PAGE_ID])
    await db.query(`delete from media_assets where rivya_asset_id like 'CASC-%'`)
    // activity_events is append-only and survives the rows it describes, so a second run of this
    // suite would count this run's cascade events plus the last one's. A suite that passes once on
    // a fresh database and fails on every later run is the failure mode harness.ts already warns
    // about for staff_profiles; this is the same shape, arriving through a different table.
    await db.query(`delete from activity_events where entity_id = any($1::uuid[])`, [
      [GOOD, NOT_APPROVED, UNVERIFIED],
    ])
    await db.query(
      `insert into pages (id, slug, kind, title, path) values ($1,'casc','PAGE','C','/casc')`,
      [PAGE_ID],
    )
    await asset(GOOD, 'CASC-GOOD', 'APPROVED', 'VERIFIED')
    await asset(NOT_APPROVED, 'CASC-DRAFT', 'DRAFT', 'VERIFIED')
    await asset(UNVERIFIED, 'CASC-UNVER', 'APPROVED', 'OWNER_VERIFICATION_REQUIRED')
  })

  afterAll(disconnect)

  /** Walk a fresh section to APPROVED with the given asset bound to BOTH media columns. */
  const approvedSectionWith = async (mediaId: string): Promise<string> => {
    const db = await connect()
    await db.query('delete from page_sections where page_id = $1', [PAGE_ID])
    const { rows } = await db.query<{ id: string }>(
      `insert into page_sections (page_id, block_type, position, media_slot_key,
                                  media_desktop_id, media_mobile_id)
       values ($1,'hero',0,'home.hero.poster',$2,$2) returning id`,
      [PAGE_ID, mediaId],
    )
    const id = rows[0]!.id
    await db.query(`update page_sections set status = 'REVIEW' where id = $1`, [id])
    await db.query(`update page_sections set status = 'APPROVED' where id = $1`, [id])
    return id
  }

  it('promotes an APPROVED bound asset and writes one cascade event', async () => {
    // Verification step 8's first half. The asset is bound to BOTH media columns on purpose: one
    // asset, two bindings, and still exactly one promotion — an earlier version used GROUP BY to
    // dedupe, which PostgreSQL refuses alongside FOR UPDATE, and dropping the dedupe would have
    // written two cascade rows for one event.
    const db = await connect()
    section = await approvedSectionWith(GOOD)
    await db.query(`select cms_publish_section($1,'PUBLISHED',null,'test')`, [section])

    const { rows: after } = await db.query<{ status: string }>(
      `select status from media_assets where id = $1`,
      [GOOD],
    )
    expect(after[0]?.status).toBe('PUBLISHED')

    const { rows: events } = await db.query<{ n: string }>(
      `select count(*)::text as n from activity_events
        where action = 'media.publish.cascade' and entity_id = $1`,
      [GOOD],
    )
    expect(Number(events[0]!.n)).toBe(1)
  })

  it('makes the promoted asset readable by the anon role', async () => {
    // The point of the whole cascade. Phase 06's RLS gives anon SELECT on media_assets only where
    // status = 'PUBLISHED', so without the promotion a published page renders copy with holes and
    // no error anywhere.
    const { rows } = await asSessionAnon<{ id: string }[]>(
      `select id from media_assets where id = '${GOOD}'`,
    )
    expect(rows).toHaveLength(1)
  })

  it('refuses with RV003 naming an unapproved asset', async () => {
    const db = await connect()
    const id = await approvedSectionWith(NOT_APPROVED)
    try {
      await db.query(`select cms_publish_section($1,'PUBLISHED',null,null)`, [id])
      throw new Error('the publish was allowed')
    } catch (error) {
      const e = error as { code?: string; message?: string }
      expect(e.code).toBe('RV003')
      expect(e.message).toContain('CASC-DRAFT')
    }
  })

  it('refuses with RV006 naming an unverified asset, not a bare check violation', async () => {
    /**
     * THE COLLISION THIS PRE-CHECK EXISTS FOR. Phase 07 imports all 250 Higgsfield assets as
     * APPROVED *and* OWNER_VERIFICATION_REQUIRED, while `media_assets_verified_before_publish`
     * (Phase 03) forbids PUBLISHED while that flag stands. Without the pre-check the promotion
     * raises a bare 23514 naming a constraint, and the person reading it cannot tell which asset
     * or why. Nothing can go live until those 250 are verified — that is an owner action, and
     * this error is what tells them so.
     */
    const db = await connect()
    const id = await approvedSectionWith(UNVERIFIED)
    try {
      await db.query(`select cms_publish_section($1,'PUBLISHED',null,null)`, [id])
      throw new Error('the publish was allowed')
    } catch (error) {
      const e = error as { code?: string; message?: string }
      expect(e.code).toBe('RV006')
      expect(e.message).toContain('CASC-UNVER')
    }
  })

  it('demotes nothing when the section is unpublished', async () => {
    // Deliberately asymmetric: an asset may be bound to several sections, and demoting it would
    // break the others without warning.
    const db = await connect()
    const id = await approvedSectionWith(GOOD)
    await db.query(`select cms_publish_section($1,'PUBLISHED',null,null)`, [id])
    await db.query(`select cms_publish_section($1,'DRAFT',null,null)`, [id])
    const { rows } = await db.query<{ status: string }>(
      `select status from media_assets where id = $1`,
      [GOOD],
    )
    expect(rows[0]?.status).toBe('PUBLISHED')
  })

  it('refuses cms_unpublish_media_asset with RV004 while a published section uses it', async () => {
    const db = await connect()
    const id = await approvedSectionWith(GOOD)
    await db.query(`select cms_publish_section($1,'PUBLISHED',null,null)`, [id])
    try {
      await db.query(`select cms_unpublish_media_asset($1, null)`, [GOOD])
      throw new Error('the unpublish was allowed')
    } catch (error) {
      expect((error as { code?: string }).code).toBe('RV004')
    }
  })

  it('refuses an illegal edge before promoting anything', async () => {
    // DRAFT -> PUBLISHED. The assertion that matters is not the code but that no promotion
    // happened: refusals come before writes so the error names the real problem.
    const db = await connect()
    await db.query('delete from page_sections where page_id = $1', [PAGE_ID])
    await db.query(`update media_assets set status = 'APPROVED' where id = $1`, [GOOD])
    const { rows: created } = await db.query<{ id: string }>(
      `insert into page_sections (page_id, block_type, position, media_slot_key, media_desktop_id)
       values ($1,'hero',0,'home.hero.poster',$2) returning id`,
      [PAGE_ID, GOOD],
    )
    try {
      await db.query(`select cms_publish_section($1,'PUBLISHED',null,null)`, [created[0]!.id])
      throw new Error('the publish was allowed')
    } catch (error) {
      expect((error as { code?: string }).code).toBe('RV001')
    }
    const { rows } = await db.query<{ status: string }>(
      `select status from media_assets where id = $1`,
      [GOOD],
    )
    expect(rows[0]?.status).toBe('APPROVED')
  })
})

describeDb('cms_reorder_sections', () => {
  const PAGE_ID = '00000000-0000-4000-8000-0000000000f9'

  beforeAll(async () => {
    const db = await connect()
    await db.query('delete from page_sections')
    await db.query(`delete from pages where id = $1`, [PAGE_ID])
    await db.query(
      `insert into pages (id, slug, kind, title, path) values ($1,'reorder','PAGE','R','/reorder')`,
      [PAGE_ID],
    )
  })

  afterAll(disconnect)

  const three = async (): Promise<string[]> => {
    const db = await connect()
    await db.query('delete from page_sections where page_id = $1', [PAGE_ID])
    const ids: string[] = []
    for (const [i, type] of ['hero', 'statement', 'divider'].entries()) {
      const { rows } = await db.query<{ id: string }>(
        `insert into page_sections (page_id, block_type, position) values ($1,$2,$3) returning id`,
        [PAGE_ID, type, i],
      )
      ids.push(rows[0]!.id)
    }
    return ids
  }

  it('rewrites every position in one statement', async () => {
    // The deferrable unique constraint is what makes this legal — a reorder transiently duplicates
    // positions, and PostgREST cannot give the repository layer a transaction to do it in N steps.
    const db = await connect()
    const ids = await three()
    await db.query(`select cms_reorder_sections($1, $2::uuid[], null)`, [
      PAGE_ID,
      [ids[2], ids[0], ids[1]],
    ])
    const { rows } = await db.query<{ id: string; position: number }>(
      `select id, position from page_sections where page_id = $1 order by position`,
      [PAGE_ID],
    )
    expect(rows.map((r) => r.id)).toEqual([ids[2], ids[0], ids[1]])
    expect(rows.map((r) => r.position)).toEqual([0, 1, 2])
  })

  it('refuses a partial list with RV005', async () => {
    // A list naming only some sections would leave the unnamed ones at positions that now collide
    // with the new ordering — and the failure would surface as a constraint violation on some
    // later, unrelated save.
    const db = await connect()
    const ids = await three()
    try {
      await db.query(`select cms_reorder_sections($1, $2::uuid[], null)`, [PAGE_ID, [ids[0]]])
      throw new Error('the partial reorder was allowed')
    } catch (error) {
      expect((error as { code?: string }).code).toBe('RV005')
    }
  })

  it('refuses an id that belongs to another page', async () => {
    const db = await connect()
    const ids = await three()
    try {
      await db.query(`select cms_reorder_sections($1, $2::uuid[], null)`, [
        PAGE_ID,
        [ids[0], ids[1], '00000000-0000-4000-8000-00000000ffff'],
      ])
      throw new Error('the foreign id was accepted')
    } catch (error) {
      expect((error as { code?: string }).code).toBe('RV005')
    }
  })
})

describeDb('the window means the same thing in SQL and in TypeScript', () => {
  /**
   * THE ONE TEST THAT CANNOT BE WRITTEN ON EITHER SIDE ALONE.
   *
   * `lib/cms/windowing.ts` predicts what a visitor can see; the RLS `publicClause` on `pages`
   * decides it. Both encode `[publish_at, unpublish_at)`. If they ever drift, a section is live to
   * a visitor and invisible to the editor looking at the Studio — reproducible only at the moment
   * it stops happening, which is the worst kind of bug to be handed.
   *
   * So each case below is put to BOTH: the database is asked as the anon role, `isLive` is asked
   * in process against the same instant, and the two answers must match. A unit test of the
   * TypeScript proves the TypeScript; only this proves the RULE.
   */
  const NOW_SQL = "timestamptz '2026-09-08 12:00:00+00'"
  const NOW = new Date('2026-09-08T12:00:00.000Z')

  const CASES = [
    { name: 'both bounds null', publish: null, unpublish: null },
    { name: 'publish_at exactly now', publish: '2026-09-08 12:00:00+00', unpublish: null },
    {
      name: 'publish_at 1ms in the future',
      publish: '2026-09-08 12:00:00.001+00',
      unpublish: null,
    },
    { name: 'unpublish_at exactly now', publish: null, unpublish: '2026-09-08 12:00:00+00' },
    { name: 'unpublish_at 1ms away', publish: null, unpublish: '2026-09-08 12:00:00.001+00' },
    {
      name: 'inside a two-sided window',
      publish: '2026-09-08 11:00:00+00',
      unpublish: '2026-09-08 13:00:00+00',
    },
    {
      name: 'after a two-sided window',
      publish: '2026-09-01 00:00:00+00',
      unpublish: '2026-09-02 00:00:00+00',
    },
  ] as const

  beforeAll(async () => {
    const db = await connect()
    await db.query('delete from page_sections')
    await db.query(`delete from pages where slug like 'win-%'`)
    for (const [i, c] of CASES.entries()) {
      await db.query(
        `insert into pages (slug, kind, title, path, status, publish_at, unpublish_at)
         values ($1,'PAGE','W',$2,'DRAFT',$3::timestamptz,$4::timestamptz)`,
        [`win-${String(i)}`, `/win-${String(i)}`, c.publish, c.unpublish],
      )
      // Walk to PUBLISHED: no edge skipping, even in a fixture.
      for (const s of ['REVIEW', 'APPROVED', 'PUBLISHED']) {
        await db.query(`update pages set status = $2 where slug = $1`, [`win-${String(i)}`, s])
      }
    }
  })

  afterAll(disconnect)

  for (const [i, c] of CASES.entries()) {
    it(`agrees on: ${c.name}`, async () => {
      const db = await connect()
      // Ask the DATABASE, with the RLS predicate evaluated at the fixed instant rather than at
      // real `now()` — the same expression the generated policy uses.
      const { rows } = await db.query<{ visible: boolean }>(
        `select (status = 'PUBLISHED' and path is not null
                 and (publish_at is null or publish_at <= ${NOW_SQL})
                 and (unpublish_at is null or unpublish_at > ${NOW_SQL})) as visible
           from pages where slug = $1`,
        [`win-${String(i)}`],
      )
      const sqlSays = rows[0]!.visible

      // Ask the TYPESCRIPT, against the same instant.
      const tsSays = isLive(
        {
          status: 'PUBLISHED',
          publish_at: c.publish === null ? null : new Date(c.publish).toISOString(),
          unpublish_at: c.unpublish === null ? null : new Date(c.unpublish).toISOString(),
        },
        NOW,
      )

      expect(tsSays, `${c.name}: SQL said ${String(sqlSays)}, TS said ${String(tsSays)}`).toBe(
        sqlSays,
      )
    })
  }
})

describeDb('cms_restore_revision', () => {
  const PAGE = '00000000-0000-4000-8000-000000000bb1'
  const A1 = '00000000-0000-4000-8000-000000000bb2'
  const A2 = '00000000-0000-4000-8000-000000000bb3'

  beforeAll(async () => {
    const db = await connect()
    await db.query('delete from page_sections')
    await db.query(`delete from pages where id = $1`, [PAGE])
    await db.query(`delete from media_assets where rivya_asset_id like 'REST-%'`)
    await db.query(
      `insert into pages (id, slug, kind, title, path) values ($1,'restore','PAGE','R','/restore')`,
      [PAGE],
    )
    for (const [id, ref] of [
      [A1, 'REST-1'],
      [A2, 'REST-2'],
    ] as const) {
      await db.query(
        `insert into media_assets (id, rivya_asset_id, provider, resource_type, public_id, folder,
                                   filename, kind, source, alt_text, is_ai_generated, is_concept)
         values ($1,$2,'cloudinary','image',$3,'rivya/rest',$4,'IMAGE','HIGGSFIELD','a',true,true)`,
        [id, ref, `rivya/rest/${ref}`, ref],
      )
    }
  })

  afterAll(disconnect)

  it('re-syncs media_usages, which the mitigation itself could have broken', async () => {
    /**
     * THE SUBTLE ONE. `sync_media_usages` fires `after update OF media_desktop_id, ..., payload` —
     * a column list, which is what stops a status-only publish from rebuilding every usage row.
     * The cost is that an UPDATE not naming those columns does not re-sync, so a restore that
     * skipped them would leave media_usages describing the row as it was BEFORE the restore.
     *
     * That is the phase document's own "restoring a revision loses the media binding" risk
     * arriving THROUGH its mitigation. cms_restore_revision names the media columns
     * unconditionally, even when unchanged, and this is what proves it.
     */
    const db = await connect()
    const { rows: created } = await db.query<{ id: string }>(
      `insert into page_sections (page_id, block_type, position, heading, media_slot_key, media_desktop_id)
       values ($1,'hero',0,'Original','home.hero.poster',$2) returning id`,
      [PAGE, A1],
    )
    const section = created[0]!.id
    const { rows: rev1 } = await db.query<{ n: number }>(
      `select max(revision_no) as n from content_revisions where entity_id = $1`,
      [section],
    )

    // Move to the other asset, then restore.
    await db.query(
      `update page_sections set heading = 'Changed', media_desktop_id = $2 where id = $1`,
      [section, A2],
    )
    await db.query(`select cms_restore_revision('page_section', $1, $2, null)`, [
      section,
      rev1[0]!.n,
    ])

    const { rows: usages } = await db.query<{ media_id: string }>(
      `select media_id from media_usages where context_id = $1`,
      [section],
    )
    expect(usages.map((u) => u.media_id)).toEqual([A1])
  })

  it('labels the restore RESTORE, and a later edit UPDATE again', async () => {
    // The GUC must be reset inside the function, or every subsequent write in the same transaction
    // is mislabelled and the history stops meaning anything.
    //
    // Self-contained on purpose. My first version read "the latest revision ordered by
    // revision_no" across every section — but revision_no is allocated PER ENTITY, so that picks
    // whichever section happens to have the highest number, not the most recent event. It also
    // leaned on a section the previous test created.
    const db = await connect()
    const { rows: created } = await db.query<{ id: string }>(
      `insert into page_sections (page_id, block_type, position, heading)
       values ($1,'statement',40,'v1') returning id`,
      [PAGE],
    )
    const section = created[0]!.id
    const { rows: first } = await db.query<{ n: number }>(
      `select min(revision_no) as n from content_revisions where entity_id = $1`,
      [section],
    )

    await db.query(`update page_sections set heading = 'v2' where id = $1`, [section])
    await db.query(`select cms_restore_revision('page_section', $1, $2, null)`, [
      section,
      first[0]!.n,
    ])

    const latest = async () => {
      const { rows } = await db.query<{ action: string }>(
        `select action from content_revisions where entity_id = $1
          order by revision_no desc limit 1`,
        [section],
      )
      return rows[0]?.action
    }
    expect(await latest()).toBe('RESTORE')

    await db.query(`update page_sections set heading = 'v3' where id = $1`, [section])
    expect(await latest()).toBe('UPDATE')
  })

  it('leaves status alone', async () => {
    // A revision records what the CONTENT was, not whether it was live. Restoring copy from last
    // Tuesday must not also change what the public can see.
    const db = await connect()
    const { rows: sections } = await db.query<{ id: string }>(
      `select id from page_sections where page_id = $1 limit 1`,
      [PAGE],
    )
    const section = sections[0]!.id
    await db.query(`update page_sections set status = 'REVIEW' where id = $1`, [section])
    const { rows: revs } = await db.query<{ n: number }>(
      `select min(revision_no) as n from content_revisions where entity_id = $1`,
      [section],
    )
    await db.query(`select cms_restore_revision('page_section', $1, $2, null)`, [
      section,
      revs[0]!.n,
    ])
    const { rows } = await db.query<{ status: string }>(
      `select status from page_sections where id = $1`,
      [section],
    )
    expect(rows[0]?.status).toBe('REVIEW')
  })

  it('refuses with RV007 when the snapshot names media that no longer exists', async () => {
    // Reachable only once the row itself has moved off the asset — `on delete restrict` from
    // Phase 06 stops the asset being deleted while anything still points at it, which is how my
    // first attempt at this test failed.
    const db = await connect()
    const { rows: sections } = await db.query<{ id: string }>(
      `select id from page_sections where page_id = $1 limit 1`,
      [PAGE],
    )
    const section = sections[0]!.id
    const { rows: revs } = await db.query<{ n: number }>(
      `select min(revision_no) as n from content_revisions where entity_id = $1`,
      [section],
    )
    await db.query(`update page_sections set media_desktop_id = $2 where id = $1`, [section, A2])
    await db.query(`delete from media_usages where media_id = $1`, [A1])
    await db.query(`delete from media_assets where id = $1`, [A1])

    try {
      await db.query(`select cms_restore_revision('page_section', $1, $2, null)`, [
        section,
        revs[0]!.n,
      ])
      throw new Error('the restore was allowed')
    } catch (error) {
      expect((error as { code?: string }).code).toBe('RV007')
    }
  })
})
