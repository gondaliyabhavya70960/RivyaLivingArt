import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FIXTURE_USERS, asAnon, asSession, connect, disconnect, loadFixture } from './harness'

/**
 * Phase 33 at the table: the five tables exist and are empty of competitor bytes; the research
 * tables reference research tables only and `media_asset_hashes` references `media_assets` only
 * (I1 — no third crossing); no anon leg anywhere (I2); who may open a run, who may dismiss a pair,
 * and that no session — owner included — may insert a hash on either side; and the CHECKs that
 * make a stored pair honest: ordered, within the ceiling, banded by its own distance, and a media
 * scope that stores no pairs.
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
const asMerchandiser = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.merchandiser, fn)
const asViewer = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.viewer, fn)
const asEditor = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.editor, fn)

const SOURCE_ID = '00000000-0000-4000-8000-000000003301'
const PRODUCT_ID = '00000000-0000-4000-8000-000000003302'
const HASH_A = '00000000-0000-4000-8000-000000003303'
const HASH_B = '00000000-0000-4000-8000-000000003304'
const RUN_ID = '00000000-0000-4000-8000-000000003305'
const MEDIA_ID = '00000000-0000-4000-8000-000000003306'

const SHA = 'a'.repeat(64)
const BITS = '0'.repeat(64)
const BITS_FAR = '1'.repeat(64)

const RESEARCH_TABLES = [
  'research_image_hashes',
  'research_similarity_runs',
  'research_similarity_pairs',
  'research_similarity_suppressions',
] as const

async function seed(): Promise<void> {
  const db = await connect()
  await db.query(
    `insert into research_sources (id, slug, name, base_url, currency)
     values ($1, 'p33-source', 'Phase 33 Source', 'https://p33.example', 'INR')
     on conflict (id) do nothing`,
    [SOURCE_ID],
  )
  await db.query(
    `insert into research_products (id, source_id, source_url, stage, title_normalized)
     values ($1, $2, 'https://p33.example/p/1', 'MATCHED', 'A Phase 33 Row')
     on conflict (id) do nothing`,
    [PRODUCT_ID, SOURCE_ID],
  )
  // Two research hashes, planted as the service role would — nothing in the repository writes
  // them, and the test needs rows to exercise the pair constraints.
  await db.query(
    `insert into research_image_hashes (id, research_product_id, source_id, source_image_url, source_image_key, checksum, phash, dhash)
     values ($1, $3, $4, 'https://p33.example/a.jpg', $5, $6, $7::bit(64), $7::bit(64)),
            ($2, $3, $4, 'https://p33.example/b.jpg', $8, $6, $9::bit(64), $9::bit(64))
     on conflict (id) do nothing`,
    [HASH_A, HASH_B, PRODUCT_ID, SOURCE_ID, 'b'.repeat(64), SHA, BITS, 'c'.repeat(64), BITS_FAR],
  )
  await db.query(
    `insert into research_similarity_runs (id, scope_type, method, status, finished_at)
     values ($1, 'CORPUS', 'PHASH', 'SUCCEEDED', now()) on conflict (id) do nothing`,
    [RUN_ID],
  )
  await db.query(
    `insert into media_assets (id, provider, resource_type, public_id, folder, kind, alt_text, is_ai_generated, is_concept, source)
     values ($1, 'cloudinary', 'image', 'rivya/test/p33', 'rivya/test', 'IMAGE', 'A Phase 33 test asset', false, false, 'RENDER')
     on conflict (id) do nothing`,
    [MEDIA_ID],
  )
}

async function cleanup(): Promise<void> {
  const db = await connect()
  await db.query('delete from research_similarity_suppressions where left_hash_id = $1', [HASH_A])
  await db.query('delete from research_similarity_pairs where run_id = $1', [RUN_ID])
  await db.query(
    "delete from research_similarity_runs where id = $1 or scope_type = 'MEDIA_ASSET'",
    [RUN_ID],
  )
  await db.query('delete from research_image_hashes where source_id = $1', [SOURCE_ID])
  await db.query('delete from media_asset_hashes where media_asset_id = $1', [MEDIA_ID])
  await db.query('delete from media_assets where id = $1', [MEDIA_ID])
  await db.query("delete from research_sources where slug like 'p33-%'")
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

describeDb('Phase 33 — the tables and the boundary', () => {
  it('creates the five tables with row security on', async () => {
    const db = await connect()
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class
       where relname = any($1::text[]) and relkind = 'r'`,
      [[...RESEARCH_TABLES, 'media_asset_hashes']],
    )
    expect(rows).toHaveLength(5)
    for (const row of rows) expect(row.relrowsecurity).toBe(true)
  })

  it('I1: the research tables reference research tables only; media_asset_hashes references media_assets only', async () => {
    const db = await connect()
    const { rows } = await db.query<{ child: string; parent: string }>(
      `select tc.table_name as child, ccu.table_name as parent
       from information_schema.table_constraints tc
       join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
       where tc.constraint_type = 'FOREIGN KEY'
         and tc.table_name = any($1::text[])`,
      [[...RESEARCH_TABLES, 'media_asset_hashes']],
    )
    for (const row of rows) {
      if (row.child === 'media_asset_hashes') {
        expect(row.parent).toBe('media_assets')
      } else {
        expect(row.parent === 'users' || row.parent.startsWith('research_')).toBe(true)
        expect(row.parent).not.toBe('media_assets')
        expect(row.parent).not.toBe('media_asset_hashes')
      }
    }
  })

  it('I2: no anon policy on any of the five', async () => {
    const db = await connect()
    const { rows } = await db.query<{ n: string }>(
      `select count(*)::text as n from pg_policies
       where tablename = any($1::text[]) and 'anon' = any(roles)`,
      [[...RESEARCH_TABLES, 'media_asset_hashes']],
    )
    expect(rows[0]?.n).toBe('0')
    const anon = await asAnon((sql) =>
      sql.rows<{ id: string }>('select id from media_asset_hashes'),
    )
    expect(anon).toEqual([])
  })

  it('the per-source opt-in refuses an unapproved source', async () => {
    const db = await connect()
    await expect(
      db.query('update research_sources set image_hashing_enabled = true where id = $1', [
        SOURCE_ID,
      ]),
    ).rejects.toThrow(/image_hashing_needs_approval/u)
  })
})

describeDb('Phase 33 — who may write what', () => {
  it('a viewer reads runs and hashes; an editor reads neither', async () => {
    const seen = await asViewer((sql) =>
      sql.rows<{ id: string }>('select id from research_similarity_runs where id = $1', [RUN_ID]),
    )
    expect(seen).toHaveLength(1)
    const hashes = await asViewer((sql) =>
      sql.rows<{ id: string }>('select id from research_image_hashes'),
    )
    expect(hashes.length).toBeGreaterThanOrEqual(2)
    const editor = await asEditor((sql) =>
      sql.rows<{ id: string }>('select id from research_similarity_runs'),
    )
    expect(editor).toEqual([])
  })

  it('a researcher opens a run; a merchandiser may not', async () => {
    const opened = await asResearcher((sql) =>
      sql.attempt(
        "insert into research_similarity_runs (scope_type, method, created_by) values ('MEDIA_ASSET', 'PHASH', $1)",
        [FIXTURE_USERS.researcher],
      ),
    )
    expect(opened.ok).toBe(true)
    const refused = await asMerchandiser((sql) =>
      sql.attempt(
        "insert into research_similarity_runs (scope_type, method) values ('MEDIA_ASSET', 'PHASH')",
      ),
    )
    expect(refused.ok).toBe(false)
  })

  it('no session inserts a research hash or a pair — the owner included', async () => {
    const hash = await asOwner((sql) =>
      sql.attempt(
        `insert into research_image_hashes (research_product_id, source_id, source_image_url, source_image_key, checksum, phash, dhash)
         values ($1, $2, 'https://p33.example/c.jpg', $3, $4, $5::bit(64), $5::bit(64))`,
        [PRODUCT_ID, SOURCE_ID, 'd'.repeat(64), SHA, BITS],
      ),
    )
    expect(hash.ok).toBe(false)
    const pair = await asOwner((sql) =>
      sql.attempt(
        `insert into research_similarity_pairs (run_id, left_hash_id, right_hash_id, method, distance, band)
         values ($1, $2, $3, 'PHASH', 0, 'NEAR_DUPLICATE')`,
        [RUN_ID, HASH_A, HASH_B],
      ),
    )
    expect(pair.ok).toBe(false)
  })

  it('no session inserts a Rivya hash either; media.read reads it', async () => {
    const owner = await asOwner((sql) =>
      sql.attempt(
        `insert into media_asset_hashes (media_asset_id, kind, checksum, phash, dhash) values ($1, 'IMAGE', $2, $3::bit(64), $3::bit(64))`,
        [MEDIA_ID, SHA, BITS],
      ),
    )
    expect(owner.ok).toBe(false)
    const db = await connect()
    await db.query(
      `insert into media_asset_hashes (media_asset_id, kind, checksum, phash, dhash) values ($1, 'IMAGE', $2, $3::bit(64), $3::bit(64))`,
      [MEDIA_ID, SHA, BITS],
    )
    const editor = await asEditor((sql) =>
      sql.rows<{ checksum: string }>(
        'select checksum from media_asset_hashes where media_asset_id = $1',
        [MEDIA_ID],
      ),
    )
    expect(editor).toEqual([{ checksum: SHA }])
  })

  it('a researcher dismisses a pair with a reason, and may not without one', async () => {
    const blank = await asResearcher((sql) =>
      sql.attempt(
        "insert into research_similarity_suppressions (left_hash_id, right_hash_id, reason, created_by) values ($1, $2, '  ', $3)",
        [HASH_A, HASH_B, FIXTURE_USERS.researcher],
      ),
    )
    expect(blank.ok).toBe(false)
    const ok = await asResearcher((sql) =>
      sql.attempt(
        "insert into research_similarity_suppressions (left_hash_id, right_hash_id, reason, created_by) values ($1, $2, 'Same stock photograph on two listings', $3)",
        [HASH_A, HASH_B, FIXTURE_USERS.researcher],
      ),
    )
    expect(ok.ok).toBe(true)
    const viewer = await asViewer((sql) =>
      sql.attempt(
        "insert into research_similarity_suppressions (left_hash_id, right_hash_id, reason, created_by) values ($2, $1, 'x', $3)",
        [HASH_A, HASH_B, FIXTURE_USERS.viewer],
      ),
    )
    expect(viewer.ok).toBe(false)
  })
})

describeDb('Phase 33 — what the pair row refuses', () => {
  it('a mirrored pair, a distance beyond the ceiling, and a band its distance contradicts', async () => {
    const db = await connect()
    await expect(
      db.query(
        `insert into research_similarity_pairs (run_id, left_hash_id, right_hash_id, method, distance, band)
         values ($1, $3, $2, 'PHASH', 0, 'NEAR_DUPLICATE')`,
        [RUN_ID, HASH_A, HASH_B],
      ),
    ).rejects.toThrow(/research_similarity_pairs_ordered/u)
    await expect(
      db.query(
        `insert into research_similarity_pairs (run_id, left_hash_id, right_hash_id, method, distance, band)
         values ($1, $2, $3, 'PHASH', 19, 'WEAK')`,
        [RUN_ID, HASH_A, HASH_B],
      ),
    ).rejects.toThrow(/distance_within_ceiling/u)
    await expect(
      db.query(
        `insert into research_similarity_pairs (run_id, left_hash_id, right_hash_id, method, distance, band)
         values ($1, $2, $3, 'PHASH', 3, 'WEAK')`,
        [RUN_ID, HASH_A, HASH_B],
      ),
    ).rejects.toThrow(/band_matches_distance/u)
    const stored = await db.query(
      `insert into research_similarity_pairs (run_id, left_hash_id, right_hash_id, method, distance, band)
       values ($1, $2, $3, 'PHASH', 12, 'PROBABLE_VARIANT') returning id`,
      [RUN_ID, HASH_A, HASH_B],
    )
    expect(stored.rowCount).toBe(1)
  })

  it('checksum is not unique on either table: two rows may share one', async () => {
    const db = await connect()
    const { rows } = await db.query<{ n: string }>(
      'select count(*)::text as n from research_image_hashes where checksum = $1',
      [SHA],
    )
    expect(rows[0]?.n).toBe('2')
    const unique = await db.query<{ indexdef: string }>(
      `select indexdef from pg_indexes where tablename in ('research_image_hashes', 'media_asset_hashes') and indexdef ilike '%checksum%'`,
    )
    expect(unique.rows.length).toBe(2)
    for (const row of unique.rows) expect(row.indexdef.toLowerCase()).not.toContain('unique')
  })

  it('a MEDIA_ASSET run stores no pairs, by CHECK', async () => {
    const db = await connect()
    await expect(
      db.query(
        `insert into research_similarity_runs (scope_type, method, status, finished_at, pairs_stored)
         values ('MEDIA_ASSET', 'PHASH', 'SUCCEEDED', now(), 1)`,
      ),
    ).rejects.toThrow(/media_scope_stores_no_pairs/u)
  })

  it('a video hash row carries null hashes and an image row must not', async () => {
    const db = await connect()
    await expect(
      db.query(
        `insert into media_asset_hashes (media_asset_id, kind, checksum) values ($1, 'IMAGE', $2)`,
        ['00000000-0000-4000-8000-000000003399', SHA],
      ),
    ).rejects.toThrow(/image_has_phash|violates foreign key/u)
  })
})
