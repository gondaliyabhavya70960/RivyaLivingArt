import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FIXTURE_IDS, FIXTURE_USERS, asAnon, asSession, disconnect, loadFixture } from './harness'

/**
 * Phase 15 at the table: the `product_specs` guards, and the RLS asymmetry the Studio's writes are
 * shaped around.
 *
 * THE SECOND BLOCK IS THE IMPORTANT ONE, and it asserts something uncomfortable rather than
 * something reassuring. `lib/supabase/repositories/product-edges.ts` reads every row back after a
 * removal, which looks like paranoia until you see what a filtered DELETE actually does. These
 * tests pin that behaviour down: a merchandiser's delete on any of the three join tables removes
 * NOTHING and reports NO ERROR. If a future migration gives merchandisers the delete policy, these
 * tests fail — and the read-backs become redundant rather than wrong, which is the right way round
 * for the reminder to arrive.
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

const asMerchandiser = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.merchandiser, fn)
const asOwner = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.owner, fn)

const SPEC = `insert into product_specs (product_id, label, value, unit, sort_order, status)
              values ($1,$2,$3,$4,$5,$6)`

describeDb('product_specs — the shape of an owner-entered fact', () => {
  beforeAll(loadFixture)
  afterAll(disconnect)

  it('refuses a blank label and a blank value, so no row can render as an empty line', async () => {
    const blankLabel = await asOwner((sql) =>
      sql.attempt(SPEC, [FIXTURE_IDS.publishedProduct, '   ', '450', 'mm', 0, 'DRAFT']),
    )
    expect(blankLabel.ok).toBe(false)
    expect(blankLabel.error).toContain('product_specs_label_present')

    const blankValue = await asOwner((sql) =>
      sql.attempt(SPEC, [FIXTURE_IDS.publishedProduct, 'Seat height', ' ', 'mm', 0, 'DRAFT']),
    )
    expect(blankValue.ok).toBe(false)
    expect(blankValue.error).toContain('product_specs_value_present')
  })

  it('refuses a blank unit rather than storing one that renders as a stray space', async () => {
    const result = await asOwner((sql) =>
      sql.attempt(SPEC, [FIXTURE_IDS.publishedProduct, 'Depth', '400', '', 0, 'DRAFT']),
    )
    expect(result.ok).toBe(false)
    expect(result.error).toContain('product_specs_unit_present')
  })

  it('refuses a duplicated label on one product', async () => {
    await asOwner(async (sql) => {
      const first = await sql.attempt(SPEC, [
        FIXTURE_IDS.publishedProduct,
        'Seat height',
        '450',
        'mm',
        0,
        'DRAFT',
      ])
      expect(first.ok).toBe(true)

      // The second row is what a visitor would read as two different answers to one question.
      const second = await sql.attempt(SPEC, [
        FIXTURE_IDS.publishedProduct,
        'Seat height',
        '460',
        'mm',
        1,
        'DRAFT',
      ])
      expect(second.ok).toBe(false)
      expect(second.error).toContain('product_specs_unique_label')
    })
  })

  it('will not publish a row still flagged OWNER_VERIFICATION_REQUIRED', async () => {
    const result = await asOwner((sql) =>
      sql.attempt(
        `insert into product_specs (product_id, label, value, status, owner_verification)
         values ($1,'Weight','12','PUBLISHED','OWNER_VERIFICATION_REQUIRED')`,
        [FIXTURE_IDS.publishedProduct],
      ),
    )
    expect(result.ok).toBe(false)
    expect(result.error).toContain('product_specs_verified_before_publish')
  })

  it('hides a draft spec from anonymous readers and shows a published one', async () => {
    // Both rows come from the fixture, not from this test: `asSession` rolls back, so a row written
    // as the owner here would not exist for the anonymous read below.
    const visible = await asAnon((sql) =>
      sql.rows<{ label: string }>('select label from product_specs where product_id = $1', [
        FIXTURE_IDS.publishedProduct,
      ]),
    )
    const labels = visible.map((row) => row.label)
    expect(labels).toContain('Published fact')
    expect(labels).not.toContain('Draft fact')
  })

  it('hides even a PUBLISHED spec when its parent product is not published', async () => {
    // The fixture's third row says PUBLISHED. What makes it private is the product it measures —
    // otherwise a draft piece's dimensions would be readable before the piece itself existed.
    const visible = await asAnon((sql) =>
      sql.rows<{ label: string }>('select label from product_specs where product_id = $1', [
        FIXTURE_IDS.draftProduct,
      ]),
    )
    expect(visible).toHaveLength(0)
  })
})

describeDb('products.dimensions — constrained at the database, not only in Zod', () => {
  beforeAll(loadFixture)
  afterAll(disconnect)

  const setDimensions = (value: string) =>
    asOwner((sql) =>
      sql.attempt('update products set dimensions = $2::jsonb where id = $1', [
        FIXTURE_IDS.publishedProduct,
        value,
      ]),
    )

  it('accepts the declared keys with positive values', async () => {
    const result = await setDimensions('{"length_mm": 1800, "seats": 3}')
    expect(result.ok).toBe(true)
  })

  it('rejects a key outside the declared set, so no renderer meets one', async () => {
    // The unit-conversion hazard, refused at the storage layer: an inches key cannot be written, so
    // nothing downstream is ever tempted to convert it.
    const result = await setDimensions('{"length_inches": 90}')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('products_dimensions_shape')
  })

  it('rejects a zero or negative measurement', async () => {
    expect((await setDimensions('{"length_mm": 0}')).ok).toBe(false)
    expect((await setDimensions('{"width_mm": -10}')).ok).toBe(false)
  })

  it('accepts null, which is how a product with no measurements is stored', async () => {
    const result = await asOwner((sql) =>
      sql.attempt('update products set dimensions = null where id = $1', [
        FIXTURE_IDS.publishedProduct,
      ]),
    )
    expect(result.ok).toBe(true)
  })
})

/**
 * WHY THE STUDIO'S WRITES READ EVERY ROW BACK.
 *
 * `destructive.execute` keeps DELETE on the join tables to owner and admin, while INSERT admits
 * merchandiser. Under that split a merchandiser's delete is not refused — it is FILTERED, matching
 * zero rows and returning success. A "replace" implemented as delete-then-insert would therefore
 * quietly become an append, and the editor would be told it saved.
 */
describeDb('a filtered DELETE reports success and removes nothing', () => {
  beforeAll(loadFixture)
  afterAll(disconnect)

  const cases = [
    { table: 'product_media', column: 'product_id' },
    { table: 'product_materials', column: 'product_id' },
  ] as const

  for (const { table, column } of cases) {
    it(`${table}: a merchandiser's delete succeeds and removes nothing`, async () => {
      const before = await asOwner((sql) =>
        sql.rows<{ n: string }>(`select count(*) as n from ${table} where ${column} = $1`, [
          FIXTURE_IDS.publishedProduct,
        ]),
      )
      expect(Number(before[0]?.n)).toBeGreaterThan(0)

      const attempt = await asMerchandiser((sql) =>
        sql.attempt(`delete from ${table} where ${column} = $1`, [FIXTURE_IDS.publishedProduct]),
      )
      // NO ERROR. This is the assertion the read-backs exist for.
      expect(attempt.ok).toBe(true)

      const removed = await asMerchandiser((sql) =>
        sql.affectedRows(`delete from ${table} where ${column} = $1`, [
          FIXTURE_IDS.publishedProduct,
        ]),
      )
      expect(removed).toBe(0)

      const after = await asOwner((sql) =>
        sql.rows<{ n: string }>(`select count(*) as n from ${table} where ${column} = $1`, [
          FIXTURE_IDS.publishedProduct,
        ]),
      )
      expect(Number(after[0]?.n)).toBe(Number(before[0]?.n))
    })
  }

  it('an owner CAN delete, so the rows are removable by somebody', async () => {
    // Without this the block above would also pass against a table nobody can write at all, which
    // would be a different bug wearing the same result.
    const removed = await asOwner((sql) =>
      sql.affectedRows('delete from product_materials where product_id = $1', [
        FIXTURE_IDS.publishedProduct,
      ]),
    )
    expect(removed).toBeGreaterThan(0)
  })
})
