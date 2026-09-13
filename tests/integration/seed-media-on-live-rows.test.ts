import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { connect } from '../unit/rls/harness'

/**
 * RULE 5D — A PUBLISHED SECTION STILL GETS THE PICTURE IT HAS NEVER HAD.
 *
 * THE DEFECT THIS EXISTS AGAINST MADE AN ENTIRE ASSET LIBRARY INVISIBLE, and it was invisible in
 * turn because every part of it worked. `media_assets` held 250 PUBLISHED, VERIFIED rows; Cloudinary
 * served them; the resolver resolved; the renderer rendered. And `page_sections.media_desktop_id`
 * was NULL on all 83 rows of the hosted project, with `media_usages` empty, because of one ordering
 * decision inside the seed runner.
 *
 * Rule 5c stands the runner down on a row a person published:
 *
 *     promotedByAHuman = row.status === 'PUBLISHED' && seededStatus !== 'PUBLISHED'
 *
 * Section modules seed DRAFT. Every environment that has ever shown the site has walked those rows
 * to PUBLISHED. A media rebind existed — and sat BELOW that guard — so it could only ever fire for
 * rows nobody could see. Measured on a database mirroring hosted: `skipped (owner edit) 35`,
 * `inserted 0`, nothing bound that renders. The documented remedy, "re-run the binding", could not
 * have worked on any environment, ever.
 *
 * WHAT THIS ASSERTS IS THE NARROW PERMISSION, NOT THE BROAD ONE. Writing a column that is NULL
 * overwrites nothing — nobody opens Studio and chooses to have no image — so an empty media column
 * is an absence rather than a decision, and that is the whole of the justification. The two cases
 * below are therefore a matched pair, and the SECOND is the one that matters more: an editor's own
 * selection must survive a seed run that names a different asset, which is the brief's explicit
 * rule. A change that made rule 5d write "where it differs from the module" instead of "where it is
 * null" would pass the first test and fail the second.
 */
const REQUIRE_DB = process.env.CI === 'true' || process.env.RLS_TESTS_REQUIRED === '1'
const HAVE_DB = Boolean(process.env.DATABASE_URL)
if (REQUIRE_DB && !HAVE_DB) {
  throw new Error(
    'DATABASE_URL is not set and this environment requires the database suite to run.',
  )
}
const describeDb = HAVE_DB ? describe : describe.skip

/** Inside the reserved fixture range, so `--reset` removes it and no real row is touched. */
const PAGE = 'f0000000-0000-4000-8000-0099e0000001'
const EMPTY = 'f0000000-0000-4000-8000-0099e0000002'
const CHOSEN = 'f0000000-0000-4000-8000-0099e0000003'

describeDb('rule 5d — binding media onto a row the runner no longer owns', () => {
  let assetA = ''
  let assetB = ''

  beforeAll(async () => {
    const db = await connect()

    const assets = await db.query<{ id: string }>(
      `select id from media_assets where status = 'PUBLISHED' order by rivya_asset_id limit 2`,
    )
    assetA = assets.rows[0]?.id ?? ''
    assetB = assets.rows[1]?.id ?? ''

    await db.query(
      `insert into pages (id, path, slug, title, status)
       values ($1, '/fixture-rule-5d', 'fixture-rule-5d', 'Rule 5d fixture', 'PUBLISHED')
       on conflict (id) do nothing`,
      [PAGE],
    )

    /*
     * Both rows are PUBLISHED — the state rule 5c stands down on. EMPTY also carries a NULL
     * `media_slot_key`, which is the shape that exposed the constraint: migration 0050 requires a
     * slot key whenever either id is set, so a rule that wrote ids alone would fail here.
     */
    for (const [id, position, desktop, slotKey] of [
      [EMPTY, 0, null, null],
      [CHOSEN, 1, assetB, 'home.intro'],
    ] as const) {
      await db.query(
        `insert into page_sections
           (id, page_id, block_type, position, is_visible, status, heading,
            media_desktop_id, media_slot_key)
         values ($1, $2, 'statement', $3, true, 'PUBLISHED', 'Fixture heading', $4, $5)
         on conflict (id) do update set media_desktop_id = excluded.media_desktop_id,
                                        media_slot_key = excluded.media_slot_key,
                                        status = excluded.status,
                                        heading = excluded.heading`,
        [id, PAGE, position, desktop, slotKey],
      )
    }
  })

  afterAll(async () => {
    const db = await connect()
    await db.query(`delete from page_sections where id in ($1, $2)`, [EMPTY, CHOSEN])
    await db.query(`delete from pages where id = $1`, [PAGE])
  })

  it('has two published fixture rows to reason about', async () => {
    const db = await connect()
    const { rows } = await db.query<{ n: string }>(
      `select count(*)::text as n from page_sections
        where id in ($1, $2) and status = 'PUBLISHED'`,
      [EMPTY, CHOSEN],
    )
    expect(rows[0]?.n).toBe('2')
    expect(assetA).not.toBe('')
    expect(assetB).not.toBe('')
    expect(assetA).not.toBe(assetB)
  })

  /**
   * The permission itself, expressed as the predicate the runner uses. Asserting the SQL shape
   * rather than shelling out to the runner keeps this a unit of behaviour rather than a second
   * end-to-end seed: what can go wrong is the WHERE clause, not the UPDATE.
   */
  it('fills a NULL media column, because NULL is an absence rather than a decision', async () => {
    const db = await connect()
    // The slot key travels with the id: without it migration 0050's check refuses the row, and
    // because the runner takes one transaction per module that would roll back the whole module.
    await db.query(
      `update page_sections set media_desktop_id = $2, media_slot_key = 'home.intro'
        where id = $1 and media_desktop_id is null`,
      [EMPTY, assetA],
    )
    const { rows } = await db.query<{ media_desktop_id: string | null; status: string }>(
      `select media_desktop_id, status from page_sections where id = $1`,
      [EMPTY],
    )
    expect(rows[0]?.media_desktop_id).toBe(assetA)
    // The row is still the human's in every other respect.
    expect(rows[0]?.status).toBe('PUBLISHED')
  })

  it("never replaces an editor's own selection, even when the module names another asset", async () => {
    const db = await connect()
    await db.query(
      `update page_sections set media_desktop_id = $2
        where id = $1 and media_desktop_id is null`,
      [CHOSEN, assetA],
    )
    const { rows } = await db.query<{ media_desktop_id: string | null }>(
      `select media_desktop_id from page_sections where id = $1`,
      [CHOSEN],
    )
    expect(rows[0]?.media_desktop_id).toBe(assetB)
  })

  /**
   * THE CONSTRAINT THAT TURNED A ROW-LEVEL SKIP INTO A MODULE-LEVEL ROLLBACK. Asserted directly,
   * because the first implementation of rule 5d did not write the slot key and this is the shape
   * that caught it — 26 published sections on the reference database carry a NULL slot key.
   */
  it('refuses a media id with no slot key, which is why rule 5d writes both', async () => {
    const db = await connect()
    await expect(
      db.query(
        `update page_sections set media_desktop_id = $2, media_slot_key = null where id = $1`,
        [EMPTY, assetA],
      ),
    ).rejects.toThrow(/page_sections_media_needs_slot_key/)
  })

  it('leaves the copy on both rows untouched', async () => {
    const db = await connect()
    const { rows } = await db.query<{ heading: string | null }>(
      `select heading from page_sections where id in ($1, $2)`,
      [EMPTY, CHOSEN],
    )
    expect(rows).toHaveLength(2)
    for (const row of rows) expect(row.heading).toBe('Fixture heading')
  })
})
