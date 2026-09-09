import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FIXTURE_IDS, FIXTURE_USERS, asAnon, asSession, disconnect, loadFixture } from './harness'

/**
 * Phase 16 at the table: the two publish gates, the concept authority, and `entity_relations`.
 *
 * THE FIRST BLOCK ASSERTS SOMETHING THE APPLICATION CANNOT. FEAT §9's instruction — "Do not
 * fabricate them as real published collections" — is a rule about a row, and the only place a rule
 * about a row holds against `curl`, a future import and a Studio form somebody refactored is the
 * database.
 *
 * THE SECOND GATE IS THE ONE THAT SURPRISES PEOPLE. `collections` has carried
 * `collections_verified_before_publish` since Phase 03, so publishing needs BOTH an owner-confirmed
 * concept AND an owner_verification that is not OWNER_VERIFICATION_REQUIRED. Seeding the ten
 * concepts as OWNER_VERIFICATION_REQUIRED — the instinct, given D10 — would mean confirming one
 * still does not let it publish, and the refusal would name a Phase 03 constraint nobody is looking
 * at. That interaction is asserted here so the seed's choice is not silently undone later.
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

describeDb('the collection publish gates', () => {
  beforeAll(loadFixture)
  afterAll(disconnect)

  it('refuses to publish a concept nobody has confirmed, naming the collection', async () => {
    const result = await asOwner((sql) =>
      sql.attempt("update collections set status = 'PUBLISHED' where slug = 'rls-drf-coll'"),
    )
    expect(result.ok).toBe(false)
    expect(result.error).toContain('cannot be published while concept_state')
    // The slug, not the id: the person reading this is looking at a list of collections.
    expect(result.error).toContain('rls-drf-coll')
  })

  it('still refuses after confirmation while the verification flag is outstanding', async () => {
    // The Phase 03 gate, which is easy to forget exists. Both must be satisfied.
    const result = await asOwner((sql) =>
      sql.attempt(`update collections
                      set concept_state = 'OWNER_CONFIRMED',
                          owner_verification = 'OWNER_VERIFICATION_REQUIRED',
                          status = 'PUBLISHED'
                    where slug = 'rls-drf-coll'`),
    )
    expect(result.ok).toBe(false)
    expect(result.error).toContain('collections_verified_before_publish')
  })

  it('allows publishing once the concept is confirmed and nothing is outstanding', async () => {
    const result = await asOwner((sql) =>
      sql.attempt(`update collections
                      set concept_state = 'OWNER_CONFIRMED', status = 'PUBLISHED'
                    where slug = 'rls-drf-coll'`),
    )
    expect(result.ok).toBe(true)
  })

  it('stamps who confirmed a concept, from the session rather than the submission', async () => {
    const rows = await asOwner(async (sql) => {
      await sql.rows(
        "update collections set concept_state = 'OWNER_CONFIRMED' where slug = 'rls-drf-coll'",
      )
      return sql.rows<{ by: string | null; at: string | null }>(
        "select owner_confirmed_by as by, owner_confirmed_at as at from collections where slug = 'rls-drf-coll'",
      )
    })
    expect(rows[0]?.by).toBe(FIXTURE_USERS.owner)
    expect(rows[0]?.at).not.toBeNull()
  })

  it('refuses a merchandiser the confirmation, with a permission error', async () => {
    // RLS lets a merchandiser UPDATE collections — only this trigger stops the confirm. That is
    // why the Studio needs its own requirePermission as well: this refusal arrives after the
    // request reached the database, with no audit row.
    const result = await asMerchandiser((sql) =>
      sql.attempt(
        "update collections set concept_state = 'OWNER_CONFIRMED' where slug = 'rls-drf-coll'",
      ),
    )
    expect(result.ok).toBe(false)
    expect(result.error).toContain('may not confirm a collection concept')
  })

  it('clears the confirmation stamp when a concept is withdrawn', async () => {
    const rows = await asOwner(async (sql) => {
      await sql.rows(
        "update collections set concept_state = 'OWNER_CONFIRMED' where slug = 'rls-drf-coll'",
      )
      await sql.rows("update collections set concept_state = 'RETIRED' where slug = 'rls-drf-coll'")
      return sql.rows<{ by: string | null }>(
        "select owner_confirmed_by as by from collections where slug = 'rls-drf-coll'",
      )
    })
    expect(rows[0]?.by).toBeNull()
  })
})

describeDb('the curated products a collection shows', () => {
  beforeAll(loadFixture)
  afterAll(disconnect)

  /**
   * THE PREMISE `listCuratedProducts` RESTS ON. That read joins `product_collections` to `products`
   * with `!inner` and relies on RLS to drop the pieces a visitor may not see — so if `products`
   * ever became publicly readable in DRAFT, an exhibition page would start listing unfinished work
   * and the repository would look entirely correct. The fixture curates BOTH a published and a
   * draft product into the published collection precisely so this can be asserted.
   */
  it('hides a draft piece curated into a published collection from an anonymous visitor', async () => {
    const rows = await asAnon((sql) =>
      sql.rows<{ slug: string }>(
        `select p.slug
           from product_collections pc
           join products p on p.id = pc.product_id
          where pc.collection_id = $1
          order by pc.sort_order, pc.product_id`,
        [FIXTURE_IDS.publishedCollection],
      ),
    )
    expect(rows.map((row) => row.slug)).toEqual(['rls-published'])
  })

  it('shows staff both, so the assertion above is about RLS and not about the fixture', async () => {
    const rows = await asOwner((sql) =>
      sql.rows<{ slug: string }>(
        `select p.slug
           from product_collections pc
           join products p on p.id = pc.product_id
          where pc.collection_id = $1`,
        [FIXTURE_IDS.publishedCollection],
      ),
    )
    expect(rows.map((row) => row.slug).sort()).toEqual(['rls-draft', 'rls-published'])
  })
})

describeDb('entity_relations', () => {
  beforeAll(loadFixture)
  afterAll(disconnect)

  const INSERT = `insert into entity_relations
                    (source_type, source_id, target_type, target_id, relation_type, created_by)
                  values ($1,$2,$3,$4,$5,$6)`

  it('is invisible to anonymous readers entirely', async () => {
    // Shape C. Not "filtered to published" — absent. The row carries an editorial note and the
    // existence of edges pointing at unpublished work.
    //
    // AGAINST THE FIXTURE'S COMMITTED EDGE, NOT ONE INSERTED HERE. `asSession` rolls back, so an
    // edge written in a previous block does not exist for this read and the assertion would hold
    // against an empty table — passing while proving nothing. The owner read below is what makes
    // the anonymous zero mean something.
    const visible = await asAnon((sql) => sql.rows('select id from entity_relations'))
    expect(visible).toHaveLength(0)

    const toOwner = await asOwner((sql) => sql.rows('select id from entity_relations'))
    expect(toOwner.length).toBeGreaterThan(0)
  })

  it('refuses a duplicate edge rather than storing the same claim twice', async () => {
    const result = await asOwner(async (sql) => {
      await sql.rows(INSERT, [
        'COLLECTION',
        FIXTURE_IDS.publishedCollection,
        'PRODUCT',
        FIXTURE_IDS.draftProduct,
        'RELATED',
        FIXTURE_USERS.owner,
      ])
      return sql.attempt(INSERT, [
        'COLLECTION',
        FIXTURE_IDS.publishedCollection,
        'PRODUCT',
        FIXTURE_IDS.draftProduct,
        'RELATED',
        FIXTURE_USERS.owner,
      ])
    })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('entity_relations_unique_edge')
  })

  it('refuses an edge from a thing to itself', async () => {
    const result = await asOwner((sql) =>
      sql.attempt(INSERT, [
        'COLLECTION',
        FIXTURE_IDS.publishedCollection,
        'COLLECTION',
        FIXTURE_IDS.publishedCollection,
        'RELATED',
        FIXTURE_USERS.owner,
      ]),
    )
    expect(result.ok).toBe(false)
    expect(result.error).toContain('entity_relations_no_self')
  })

  it('refuses a blank note, which would render as an empty line under a card', async () => {
    const result = await asOwner((sql) =>
      sql.attempt(
        `insert into entity_relations
           (source_type, source_id, target_type, target_id, relation_type, note, created_by)
         values ('COLLECTION',$1,'PRODUCT',$2,'FEATURES','   ',$3)`,
        [FIXTURE_IDS.publishedCollection, FIXTURE_IDS.publishedProduct, FIXTURE_USERS.owner],
      ),
    )
    expect(result.ok).toBe(false)
    expect(result.error).toContain('entity_relations_note_present')
  })

  /**
   * The asymmetry `setRelations` reads rows back for. Same shape as Phase 15's finding, one table
   * along: a merchandiser's DELETE is FILTERED, not refused — zero rows and no error — so a
   * "replace" written as delete-then-insert silently becomes an append.
   */
  it("filters a merchandiser's DELETE to nothing while reporting success", async () => {
    const attempt = await asMerchandiser((sql) =>
      sql.attempt("delete from entity_relations where source_type = 'COLLECTION'"),
    )
    expect(attempt.ok).toBe(true)

    const removed = await asMerchandiser((sql) =>
      sql.affectedRows("delete from entity_relations where source_type = 'COLLECTION'"),
    )
    expect(removed).toBe(0)

    // And an owner CAN remove the very same row, so the zero above is the policy rather than an
    // empty table. Rolled back with the block, so the fixture edge survives for the next test.
    const byOwner = await asOwner((sql) =>
      sql.affectedRows("delete from entity_relations where source_type = 'COLLECTION'"),
    )
    expect(byOwner).toBeGreaterThan(0)
  })
})
