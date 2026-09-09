import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FIXTURE_IDS, FIXTURE_USERS, asSession, disconnect, loadFixture } from './harness'

/**
 * The Phase 14 catalogue guards, in the database.
 *
 * WHY THESE ARE ASSERTED AT THE TABLE AND NOT THROUGH `lib/catalog/validation.ts`. That module
 * refuses the same rows and produces the readable message, and `tests/unit/catalog-validation.test.ts`
 * covers it. This file asserts the OTHER copy — the constraints and the trigger — because
 * PostgREST is reachable with an anon key and a session cookie and never runs a line of our
 * TypeScript. Every statement below goes straight at the table, exactly as a `curl` would.
 *
 * THE ONE THAT MATTERS MOST is the third block. A quote-only product carrying a number is how a
 * visitor comes to read a price Rivya never gave, and the database is the layer that makes it
 * unstorable rather than merely unrendered.
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

/** A merchandiser: the least-privileged role `products_insert_staff` admits. */
const asMerchandiser = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.merchandiser, fn)

const INSERT = `insert into products (slug, sku, title, price_state, price_minor,
                                      price_from_minor, currency, edition_state, edition_size)
                values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`

async function insertProduct(values: readonly unknown[]): Promise<{ ok: boolean; error?: string }> {
  return asMerchandiser(async (sql) => sql.attempt(INSERT, [...values]))
}

describeDb('0120 — the commerce enums exist and carry exactly their members', () => {
  beforeAll(loadFixture)
  afterAll(disconnect)

  it('price_state gained FIXED and kept the other three', async () => {
    const rows = await asMerchandiser(async (sql) =>
      sql.rows<{ label: string }>(
        `select e.enumlabel as label from pg_enum e
           join pg_type t on t.oid = e.enumtypid
          where t.typname = 'price_state' order by e.enumlabel`,
      ),
    )
    expect(rows.map((row) => row.label).sort()).toEqual([
      'FIXED',
      'PRICE_ON_REQUEST',
      'REQUEST_QUOTE',
      'STARTING_FROM',
    ])
  })

  it('availability_state and edition_state exist with their specified members', async () => {
    const members = async (name: string) =>
      asMerchandiser(async (sql) =>
        sql.rows<{ label: string }>(
          `select e.enumlabel as label from pg_enum e
             join pg_type t on t.oid = e.enumtypid
            where t.typname = $1 order by e.enumsortorder`,
          [name],
        ),
      )

    expect((await members('availability_state')).map((row) => row.label)).toEqual([
      'READY_STOCK',
      'MADE_TO_ORDER',
    ])
    expect((await members('edition_state')).map((row) => row.label)).toEqual([
      'ONE_OF_ONE',
      'LIMITED_EDITION',
      'OPEN_EDITION',
    ])
  })
})

describeDb('0122 — products_price_state_coherent', () => {
  beforeAll(loadFixture)
  afterAll(disconnect)

  it('refuses a quote-only product carrying a price — the phase document’s own case', async () => {
    const result = await insertProduct([
      'guard-quote-price',
      'GQP',
      'Quote with a price',
      'REQUEST_QUOTE',
      100,
      null,
      'INR',
      null,
      null,
    ])
    expect(result.ok).toBe(false)
    expect(result.error).toContain('products_price_state_coherent')
  })

  it('refuses a quote-only product carrying zero, which is still a number', async () => {
    const result = await insertProduct([
      'guard-quote-zero',
      'GQZ',
      'Quote with zero',
      'PRICE_ON_REQUEST',
      0,
      null,
      null,
      null,
      null,
    ])
    expect(result.ok).toBe(false)
  })

  it('refuses a fixed price with no amount, and one with no currency', async () => {
    const noAmount = await insertProduct([
      'guard-fixed-none',
      'GFN',
      'Fixed, no amount',
      'FIXED',
      null,
      null,
      'INR',
      null,
      null,
    ])
    const noCurrency = await insertProduct([
      'guard-fixed-nocur',
      'GFC',
      'Fixed, no currency',
      'FIXED',
      1000,
      null,
      null,
      null,
      null,
    ])
    expect(noAmount.ok).toBe(false)
    expect(noCurrency.ok).toBe(false)
  })

  it('refuses a fixed price that also carries a from-amount', async () => {
    const result = await insertProduct([
      'guard-fixed-both',
      'GFB',
      'Fixed and from',
      'FIXED',
      1000,
      500,
      'INR',
      null,
      null,
    ])
    expect(result.ok).toBe(false)
  })

  it('accepts each of the four states in its coherent form', async () => {
    const cases: readonly (readonly unknown[])[] = [
      ['guard-ok-fixed', 'GOF', 'Fixed', 'FIXED', 1_250_000, null, 'INR', null, null],
      ['guard-ok-from', 'GOR', 'From', 'STARTING_FROM', null, 450_000, 'INR', null, null],
      ['guard-ok-quote', 'GOQ', 'Quote', 'REQUEST_QUOTE', null, null, null, null, null],
      ['guard-ok-por', 'GOP', 'On request', 'PRICE_ON_REQUEST', null, null, null, null, null],
    ]
    for (const values of cases) {
      const result = await insertProduct(values)
      expect(result.ok, String(values[0])).toBe(true)
    }
  })
})

describeDb('0122 — products_edition_size_coherent', () => {
  beforeAll(loadFixture)
  afterAll(disconnect)

  it('refuses a limited edition that does not say how many exist', async () => {
    const result = await insertProduct([
      'guard-limited-nosize',
      'GLN',
      'Limited, no size',
      'REQUEST_QUOTE',
      null,
      null,
      null,
      'LIMITED_EDITION',
      null,
    ])
    expect(result.ok).toBe(false)
    expect(result.error).toContain('products_edition_size_coherent')
  })

  it('refuses a limited edition of zero — a typo, not a scarcity claim', async () => {
    const result = await insertProduct([
      'guard-limited-zero',
      'GLZ',
      'Limited of zero',
      'REQUEST_QUOTE',
      null,
      null,
      null,
      'LIMITED_EDITION',
      0,
    ])
    expect(result.ok).toBe(false)
  })

  it('refuses "One of One, edition of 12" — a contradiction a card would render straight', async () => {
    const result = await insertProduct([
      'guard-one-of-many',
      'GOM',
      'One of many',
      'REQUEST_QUOTE',
      null,
      null,
      null,
      'ONE_OF_ONE',
      12,
    ])
    expect(result.ok).toBe(false)
  })

  it('accepts a limited edition that states a positive size', async () => {
    const result = await insertProduct([
      'guard-limited-ok',
      'GLO',
      'Limited of twelve',
      'REQUEST_QUOTE',
      null,
      null,
      null,
      'LIMITED_EDITION',
      12,
    ])
    expect(result.ok).toBe(true)
  })
})

describeDb('0122 — product_media_reject_concept', () => {
  beforeAll(loadFixture)
  afterAll(disconnect)

  it('refuses a concept render on a product, naming the asset', async () => {
    const result = await asMerchandiser(async (sql) =>
      sql.attempt(
        `insert into product_media (product_id, media_asset_id, role) values ($1, $2, 'hero')`,
        [FIXTURE_IDS.draftProduct, FIXTURE_IDS.conceptAsset],
      ),
    )
    expect(result.ok).toBe(false)
    expect(result.error).toContain('concept media cannot be attached to a product')
    expect(result.error).toContain(FIXTURE_IDS.conceptAsset)
  })

  it('refuses one arriving by UPDATE as well as by INSERT', async () => {
    const result = await asMerchandiser(async (sql) =>
      sql.attempt(
        `update product_media set media_asset_id = $1
          where product_id = $2 and media_asset_id = $3`,
        [FIXTURE_IDS.conceptAsset, FIXTURE_IDS.publishedProduct, FIXTURE_IDS.publishedAsset],
      ),
    )
    expect(result.ok).toBe(false)
  })

  it('allows a non-concept asset', async () => {
    const result = await asMerchandiser(async (sql) =>
      sql.attempt(
        `insert into product_media (product_id, media_asset_id, role) values ($1, $2, 'gallery')`,
        [FIXTURE_IDS.draftProduct, FIXTURE_IDS.publishedAsset],
      ),
    )
    expect(result.ok).toBe(true)
  })
})

describeDb('products_verified_before_publish — already present, still enforced', () => {
  beforeAll(loadFixture)
  afterAll(disconnect)

  it('refuses publishing a product asserting an unverified claim', async () => {
    const result = await asMerchandiser(async (sql) =>
      sql.attempt(
        `update products
            set owner_verification = 'OWNER_VERIFICATION_REQUIRED', status = 'PUBLISHED'
          where id = $1`,
        [FIXTURE_IDS.draftProduct],
      ),
    )
    expect(result.ok).toBe(false)
    expect(result.error).toContain('products_verified_before_publish')
  })
})

describeDb('the catalogue write policies', () => {
  beforeAll(loadFixture)
  afterAll(disconnect)

  it('lets a merchandiser insert a product and refuses a viewer', async () => {
    const merchandiser = await insertProduct([
      'guard-role-merch',
      'GRM',
      'By a merchandiser',
      'REQUEST_QUOTE',
      null,
      null,
      null,
      null,
      null,
    ])
    expect(merchandiser.ok).toBe(true)

    const viewer = await asSession('authenticated', FIXTURE_USERS.viewer, async (sql) =>
      sql.attempt(INSERT, [
        'guard-role-viewer',
        'GRV',
        'By a viewer',
        'REQUEST_QUOTE',
        null,
        null,
        null,
        null,
        null,
      ]),
    )
    expect(viewer.ok).toBe(false)
  })

  it('refuses an anonymous visitor outright', async () => {
    const anon = await asSession('anon', undefined, async (sql) =>
      sql.attempt(INSERT, [
        'guard-role-anon',
        'GRA',
        'By nobody',
        'REQUEST_QUOTE',
        null,
        null,
        null,
        null,
        null,
      ]),
    )
    expect(anon.ok).toBe(false)
  })
})
