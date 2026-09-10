import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FIXTURE_USERS, asAnon, asSession, connect, disconnect } from './harness'

/**
 * Phase 21 at the table: what a visitor may read of a model's labels, who may write them, who may
 * verify them, and that associating a model is one transaction or none.
 *
 * THE LABEL FOLLOWS ITS MODEL. `model_variant_labels` is shape B on a media parent: anon reads a
 * label exactly when the model is PUBLISHED and never otherwise, and a `status` of its own would
 * be a second switch that could disagree with the first. Tested by flipping the parent.
 *
 * VERIFIED IS THE OWNER'S. A merchandiser holds `media.write` and may label a finish; marking it
 * VERIFIED asserts a material is in a real object (D10), and the Phase 08 authority trigger refuses
 * that role. The Server Action says so in words; this proves the database says so without it.
 *
 * ASSOCIATION IS ATOMIC. `set_model_association()` is SECURITY INVOKER: an editor may write the
 * asset side but not `products.model_media_id`, so the call must fail as a whole — the asset must
 * not be left saying it belongs to a product the product does not know about.
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
const asResearcher = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.researcher, fn)

const MODEL = '00000000-0000-4000-8000-00000000f001'
const POSTER = '00000000-0000-4000-8000-00000000f002'
const LABEL = '00000000-0000-4000-8000-00000000f003'
const PRODUCT = '00000000-0000-4000-8000-00000000f004'

const INSERT_LABEL = `insert into model_variant_labels (media_asset_id, variant_key, label) values ($1, 'oak', 'Oak')`
const ASSOCIATE = `select set_model_association($1, $2, null)`
const BOTH_SIDES = `select m.associated_product_id, p.model_media_id
                      from media_assets m, products p where m.id = $1 and p.id = $2`

type Sides = { associated_product_id: string | null; model_media_id: string | null }

/**
 * A committed fixture, written outside the harness's transaction (see phase20.test.ts for why):
 * a PUBLISHED poster, a DRAFT model with that poster, one label on it, and a DRAFT product.
 */
async function seed(): Promise<void> {
  const db = await connect()
  await db.query(
    `insert into media_assets (id, public_id, folder, resource_type, kind, source, alt_text,
                               is_ai_generated, is_concept, status)
     values ($1, 'rivya/models/rls-probe/poster.jpg', 'rivya/models', 'image', 'IMAGE', 'USER_UPLOAD',
             'probe poster', false, false, 'PUBLISHED')
     on conflict (id) do nothing`,
    [POSTER],
  )
  await db.query(
    `insert into media_assets (id, public_id, folder, resource_type, kind, source, alt_text,
                               is_ai_generated, is_concept, status, model_format, model_poster_id)
     values ($1, 'rivya/models/rls-probe/model.glb', 'rivya/models', 'raw', 'MODEL_3D', 'USER_UPLOAD',
             'probe model', false, false, 'DRAFT', 'GLB', $2)
     on conflict (id) do nothing`,
    [MODEL, POSTER],
  )
  await db.query(
    `insert into model_variant_labels (id, media_asset_id, variant_key, label)
     values ($1, $2, 'walnut', 'Walnut') on conflict (id) do nothing`,
    [LABEL, MODEL],
  )
  await db.query(
    `insert into products (id, slug, title, price_state, status)
     values ($1, 'rls-probe-model-product', 'Probe', 'REQUEST_QUOTE', 'DRAFT')
     on conflict (id) do nothing`,
    [PRODUCT],
  )
}

async function cleanup(): Promise<void> {
  const db = await connect()
  await db.query(`update products set model_media_id = null where id = $1`, [PRODUCT])
  await db.query(`delete from products where id = $1`, [PRODUCT])
  await db.query(`delete from media_assets where id in ($1, $2)`, [MODEL, POSTER])
}

async function setModelStatus(status: 'DRAFT' | 'PUBLISHED'): Promise<void> {
  const db = await connect()
  await db.query(`update media_assets set status = $2 where id = $1`, [MODEL, status])
}

async function firstMaterialId(): Promise<string> {
  const rows = await asOwner((sql) =>
    sql.rows<{ id: string }>(`select id from materials order by id limit 1`),
  )
  const id = rows[0]?.id
  if (id === undefined) throw new Error('the fixture has no materials row')
  return id
}

describeDb('model_variant_labels — a label follows its model', () => {
  beforeAll(seed)
  afterAll(cleanup)

  it('is invisible to anon while the model is DRAFT', async () => {
    await setModelStatus('DRAFT')
    const rows = await asAnon((sql) =>
      sql.rows(`select id from model_variant_labels where media_asset_id = $1`, [MODEL]),
    )
    expect(rows).toEqual([])
  })

  it('is readable by anon once the model is PUBLISHED, and hidden again when it is not', async () => {
    await setModelStatus('PUBLISHED')
    const visible = await asAnon((sql) =>
      sql.rows<{ label: string; material_id: string | null }>(
        `select label, material_id from model_variant_labels where media_asset_id = $1`,
        [MODEL],
      ),
    )
    expect(visible).toEqual([{ label: 'Walnut', material_id: null }])
    await setModelStatus('DRAFT')
    const hidden = await asAnon((sql) =>
      sql.rows(`select id from model_variant_labels where media_asset_id = $1`, [MODEL]),
    )
    expect(hidden).toEqual([])
  })

  it('cannot be written by anon or by the researcher', async () => {
    expect((await asAnon((sql) => sql.attempt(INSERT_LABEL, [MODEL]))).ok).toBe(false)
    expect((await asResearcher((sql) => sql.attempt(INSERT_LABEL, [MODEL]))).ok).toBe(false)
  })

  it('can be labelled by an editor, who holds media.write', async () => {
    const rows = await asEditor(async (sql) => {
      expect(await sql.affectedRows(INSERT_LABEL, [MODEL])).toBe(1)
      return sql.rows<{ variant_key: string }>(
        `select variant_key from model_variant_labels where media_asset_id = $1 order by variant_key`,
        [MODEL],
      )
    })
    expect(rows.map((row) => row.variant_key)).toEqual(['oak', 'walnut'])
  })

  it('refuses a material on a NOT_REQUIRED label, for every role', async () => {
    const materialId = await firstMaterialId()
    const refused = await asOwner((sql) =>
      sql.attempt(`update model_variant_labels set material_id = $2 where id = $1`, [
        LABEL,
        materialId,
      ]),
    )
    expect(refused.ok).toBe(false)
    expect(refused.error).toMatch(/model_variant_labels_material_needs_verification/)
  })

  it('lets a merchandiser mark a label as awaiting the owner, and refuses VERIFIED from that role', async () => {
    const materialId = await firstMaterialId()
    const pending = await asMerchandiser(async (sql) => {
      expect(
        await sql.affectedRows(
          `update model_variant_labels
              set material_id = $2, owner_verification = 'OWNER_VERIFICATION_REQUIRED'
            where id = $1`,
          [LABEL, materialId],
        ),
      ).toBe(1)
      return sql.rows<{ owner_verification: string }>(
        `select owner_verification from model_variant_labels where id = $1`,
        [LABEL],
      )
    })
    expect(pending).toEqual([{ owner_verification: 'OWNER_VERIFICATION_REQUIRED' }])

    const refused = await asMerchandiser((sql) =>
      sql.attempt(`update model_variant_labels set owner_verification = 'VERIFIED' where id = $1`, [
        LABEL,
      ]),
    )
    expect(refused.ok).toBe(false)
    expect(refused.error).toMatch(/may not mark/)

    const verified = await asOwner(async (sql) => {
      expect(
        await sql.affectedRows(
          `update model_variant_labels
              set material_id = $2, owner_verification = 'VERIFIED'
            where id = $1`,
          [LABEL, materialId],
        ),
      ).toBe(1)
      return sql.rows<{ owner_verification: string }>(
        `select owner_verification from model_variant_labels where id = $1`,
        [LABEL],
      )
    })
    expect(verified).toEqual([{ owner_verification: 'VERIFIED' }])
  })
})

describeDb('set_model_association() — one transaction or none', () => {
  beforeAll(seed)
  afterAll(cleanup)

  it('is not callable by anon', async () => {
    const refused = await asAnon((sql) => sql.attempt(ASSOCIATE, [MODEL, PRODUCT]))
    expect(refused.ok).toBe(false)
    expect(refused.error).toMatch(/permission denied/)
  })

  it('fails as a whole for an editor, who may write the asset but not the product', async () => {
    const refused = await asEditor((sql) => sql.attempt(ASSOCIATE, [MODEL, PRODUCT]))
    expect(refused.ok).toBe(false)
    const after = await asOwner((sql) => sql.rows<Sides>(BOTH_SIDES, [MODEL, PRODUCT]))
    expect(after).toEqual([{ associated_product_id: null, model_media_id: null }])
  })

  it('writes both sides for the owner', async () => {
    const linked = await asOwner(async (sql) => {
      expect((await sql.attempt(ASSOCIATE, [MODEL, PRODUCT])).ok).toBe(true)
      return sql.rows<Sides>(BOTH_SIDES, [MODEL, PRODUCT])
    })
    expect(linked).toEqual([{ associated_product_id: PRODUCT, model_media_id: MODEL }])
  })

  it('refuses association of a model with no poster, even for the owner', async () => {
    const db = await connect()
    await db.query(`update media_assets set model_poster_id = null where id = $1`, [MODEL])
    const refused = await asOwner((sql) => sql.attempt(ASSOCIATE, [MODEL, PRODUCT]))
    expect(refused.ok).toBe(false)
    expect(refused.error).toMatch(/media_assets_model_poster_before_association/)
    await db.query(`update media_assets set model_poster_id = $2 where id = $1`, [MODEL, POSTER])
  })
})

describeDb('harness', () => {
  afterAll(disconnect)
  it('releases the connection last', () => {
    expect(true).toBe(true)
  })
})
