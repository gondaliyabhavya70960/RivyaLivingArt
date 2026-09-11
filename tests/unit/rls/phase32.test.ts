import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FIXTURE_USERS, asAnon, asSession, connect, disconnect, loadFixture } from './harness'

/**
 * Phase 32 at the table: the seeded draft, the one-ACTIVE index, the immutability trigger, who may
 * write a model, and the fact that no session — owner included — may insert a score.
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
const asResearcher = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.researcher, fn)
const asEditor = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.editor, fn)

const SOURCE_ID = '00000000-0000-4000-8000-000000003201'
const PRODUCT_ID = '00000000-0000-4000-8000-000000003202'
const PHASE_32_TABLES = [
  'research_scoring_models',
  'research_opportunity_scores',
  'research_opportunity_components',
] as const

const SIGNALS = JSON.stringify([
  {
    key: 'category_gap',
    weight: 50,
    direction: 'HIGHER_IS_BETTER',
    normalisation: 'x',
    minimumCoverage: 'x',
  },
  {
    key: 'material_adjacency',
    weight: 50,
    direction: 'HIGHER_IS_BETTER',
    normalisation: 'x',
    minimumCoverage: 'x',
  },
])

async function seed(): Promise<void> {
  const db = await connect()
  await db.query(
    `insert into research_sources (id, slug, name, base_url, currency) values ($1, 'p32-source', 'Phase 32 Source', 'https://p32.example', 'INR') on conflict (id) do nothing`,
    [SOURCE_ID],
  )
  await db.query(
    `insert into research_products (id, source_id, source_url, stage, title_normalized) values ($1, $2, 'https://p32.example/p/1', 'MATCHED', 'A Phase 32 Row') on conflict (id) do nothing`,
    [PRODUCT_ID, SOURCE_ID],
  )
}

async function cleanup(): Promise<void> {
  const db = await connect()
  await db.query("delete from research_scoring_models where version like 'v9%'")
  await db.query(
    "update research_scoring_models set lifecycle = 'DRAFT', activated_at = null, activated_by = null, retired_at = null where version = 'v1'",
  )
  await db.query("delete from research_sources where slug like 'p32-%'")
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

describeDb('Phase 32 — the seeded model and isolation', () => {
  it('ships v1 as a DRAFT with weights totalling 100', async () => {
    const db = await connect()
    const { rows } = await db.query(
      `select version, lifecycle, weights_total from research_scoring_models where version = 'v1'`,
    )
    expect(rows).toEqual([{ version: 'v1', lifecycle: 'DRAFT', weights_total: 100 }])
  })
  it('has no anon policy on any of the three tables', async () => {
    const db = await connect()
    const { rows } = await db.query(
      `select tablename from pg_policies where schemaname = 'public' and tablename = any($1) and 'anon' = any(roles)`,
      [[...PHASE_32_TABLES]],
    )
    expect(rows).toEqual([])
    for (const table of PHASE_32_TABLES) {
      const seen = await asAnon((sql) =>
        sql.rows<{ n: number }>(`select count(*)::int as n from ${table}`),
      )
      expect(Number(seen[0]?.n ?? 0)).toBe(0)
    }
  })
})

describeDb('Phase 32 — models', () => {
  it('refuses a weights_total that is not 100 and a lifecycle outside the three', async () => {
    const db = await connect()
    await expect(
      db.query(
        `insert into research_scoring_models (version, name, signals, weights_total) values ('v9.1', 'x', $1::jsonb, 90)`,
        [SIGNALS],
      ),
    ).rejects.toThrow(/weights_total/u)
    await expect(
      db.query(
        `insert into research_scoring_models (version, name, signals, weights_total, lifecycle, activated_at) values ('v9.1', 'x', $1::jsonb, 100, 'LIVE', now())`,
        [SIGNALS],
      ),
    ).rejects.toThrow(/lifecycle_allowlist/u)
  })

  it('permits exactly one ACTIVE model', async () => {
    const db = await connect()
    await db.query(
      `update research_scoring_models set lifecycle = 'ACTIVE', activated_at = now() where version = 'v1'`,
    )
    await expect(
      db.query(
        `insert into research_scoring_models (version, name, signals, weights_total, lifecycle, activated_at) values ('v9.2', 'x', $1::jsonb, 100, 'ACTIVE', now())`,
        [SIGNALS],
      ),
    ).rejects.toThrow(/one_active/u)
  })

  it('freezes a non-draft definition by trigger, naming the version', async () => {
    const db = await connect()
    await expect(
      db.query(`update research_scoring_models set signals = '[]'::jsonb where version = 'v1'`),
    ).rejects.toThrow(/scoring model v1 is ACTIVE and its definition is immutable/u)
    await expect(
      db.query(`update research_scoring_models set min_confidence = 0.9 where version = 'v1'`),
    ).rejects.toThrow(/immutable/u)
    // Name and lifecycle still move.
    await db.query(`update research_scoring_models set name = 'renamed' where version = 'v1'`)
    await db.query(
      `update research_scoring_models set lifecycle = 'RETIRED', retired_at = now() where version = 'v1'`,
    )
    await db.query(
      `update research_scoring_models set lifecycle = 'DRAFT', activated_at = null, retired_at = null, name = 'Seven declared signals' where version = 'v1'`,
    )
  })

  it('lets an owner create a draft and refuses a researcher', async () => {
    const created = await asOwner((sql) =>
      sql.attempt(
        `insert into research_scoring_models (version, name, signals, weights_total, created_by) values ('v9.3', 'x', $1::jsonb, 100, $2)`,
        [SIGNALS, FIXTURE_USERS.owner],
      ),
    )
    expect(created.ok).toBe(true)
    const refused = await asResearcher((sql) =>
      sql.attempt(
        `insert into research_scoring_models (version, name, signals, weights_total, created_by) values ('v9.4', 'x', $1::jsonb, 100, $2)`,
        [SIGNALS, FIXTURE_USERS.researcher],
      ),
    )
    expect(refused.ok).toBe(false)
    expect(refused.error).toMatch(/row-level security/u)
    const seenByEditor = await asEditor((sql) =>
      sql.rows(`select id from research_scoring_models where version = 'v9.3'`),
    )
    expect(seenByEditor).toHaveLength(0)
  })
})

describeDb('Phase 32 — scores are the machine’s record', () => {
  it('refuses every session a score insert, the owner included', async () => {
    const db = await connect()
    const { rows } = await db.query<{ id: string }>(
      `select id from research_scoring_models where version = 'v1'`,
    )
    const modelId = rows[0]!.id
    const refused = await asOwner((sql) =>
      sql.attempt(
        `insert into research_opportunity_scores (research_product_id, model_id, model_version, confidence, completeness, state) values ($1, $2, 'v1', 1, 1, 'INSUFFICIENT_DATA')`,
        [PRODUCT_ID, modelId],
      ),
    )
    expect(refused.ok).toBe(false)
    expect(refused.error).toMatch(/row-level security/u)
  })

  it('keeps excluded ≠ zero at the row', async () => {
    const db = await connect()
    const { rows } = await db.query<{ id: string }>(
      `select id from research_scoring_models where version = 'v1'`,
    )
    const score = await db.query<{ id: string }>(
      `insert into research_opportunity_scores (research_product_id, model_id, model_version, score, confidence, completeness, state) values ($1, $2, 'v1', 40, 0.5, 1, 'SCORED') returning id`,
      [PRODUCT_ID, rows[0]!.id],
    )
    const scoreId = score.rows[0]!.id
    await expect(
      db.query(
        `insert into research_opportunity_components (score_id, signal_key, normalised, weight, included, exclusion_reason) values ($1, 'category_gap', 0, 20, false, 'x')`,
        [scoreId],
      ),
    ).rejects.toThrow(/included_means_value/u)
    await expect(
      db.query(
        `insert into research_opportunity_components (score_id, signal_key, normalised, weight, included) values ($1, 'category_gap', null, 20, false)`,
        [scoreId],
      ),
    ).rejects.toThrow(/excluded_has_reason/u)
    await db.query(
      `insert into research_opportunity_components (score_id, signal_key, normalised, weight, included, exclusion_reason) values ($1, 'category_gap', null, 20, false, 'unmapped_category')`,
      [scoreId],
    )
    await expect(
      db.query(
        `insert into research_opportunity_scores (research_product_id, model_id, model_version, score, confidence, completeness, state) values ($1, $2, 'v1', null, 0.9, 1, 'SCORED')`,
        [PRODUCT_ID, rows[0]!.id],
      ),
    ).rejects.toThrow(/scored_has_score/u)
    await db.query(`delete from research_opportunity_scores where id = $1`, [scoreId])
  })
})
