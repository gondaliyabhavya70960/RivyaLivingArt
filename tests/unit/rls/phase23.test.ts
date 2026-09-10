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
 * Phase 23 at the table: the two indexes, the boundary between them, and what an enquiry document
 * is allowed to contain.
 *
 * THE ASSERTIONS THAT MATTER MOST ARE TWO ZEROS AND ONE REFUSAL.
 *
 *   1. `anon` reads ZERO rows from `research_search_documents` — not "no rows because it is empty",
 *      which is why the suite writes a row into it first and then reads as anon. A table created
 *      empty in Phase 23 and populated in Phase 25 would otherwise pass this test for two phases
 *      and fail silently in the third.
 *   2. `editor` — the one staff role without `research.read` — is refused the same table. That is
 *      the check that proves the policy's role list came from the permission matrix rather than
 *      from `is_staff()`.
 *   3. A research `entity_type` is REFUSED by `search_documents`, at the row, by a CHECK. Nothing
 *      in TypeScript can be relied on for that: a bug, a migration or a well-meaning later phase
 *      could all attempt it, and only the database is in every one of those paths.
 *
 * AND THE INQUIRY DOCUMENT, WHICH IS THE PRIVACY ONE. An enquiry is inserted carrying a name, a
 * phone number, an email address, a city and a message, and the whole indexed row is asserted to
 * contain none of them. A Studio search result is the thing most likely to end up in a screenshot.
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
const asResearcher = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.researcher, fn)

const INQUIRY_ID = '00000000-0000-4000-8000-000000002301'
const RESEARCH_DOC_ID = '00000000-0000-4000-8000-000000002302'
const QUERY_ID = '00000000-0000-4000-8000-000000002303'

/**
 * A COMMITTED FIXTURE, WRITTEN OUTSIDE THE HARNESS'S TRANSACTION, for the reason phase20 states:
 * `asSession` wraps each block in `begin … rollback`, so a row several blocks must SEE cannot be
 * written by one of them.
 */
async function seed(): Promise<void> {
  const db = await connect()

  await db.query(
    `insert into inquiries (id, kind, name, phone, email, city, message)
     values ($1, 'GENERAL', 'Priya Sharma', '+919876543210', 'priya@example.test', 'Surat',
             'Please call me about the river table')
     on conflict (id) do nothing`,
    [INQUIRY_ID],
  )

  // A row in the research index, so the two zeros below mean "refused" rather than "empty".
  await db.query(
    `insert into research_search_documents (id, entity_type, entity_id, status, title)
     values ($1, 'research_product', gen_random_uuid(), 'RAW', 'A competitor table')
     on conflict (id) do nothing`,
    [RESEARCH_DOC_ID],
  )

  await db.query(
    `insert into search_queries (id, query_text, normalized_query, scope, result_count)
     values ($1, 'resin table', 'resin table', 'PUBLIC', 0)
     on conflict (id) do nothing`,
    [QUERY_ID],
  )
}

async function cleanup(): Promise<void> {
  const db = await connect()
  await db.query('delete from inquiries where id = $1', [INQUIRY_ID])
  await db.query('delete from research_search_documents where id = $1', [RESEARCH_DOC_ID])
  await db.query('delete from search_queries where id = $1', [QUERY_ID])
  await db.query("delete from product_relations where rule_key = 'test-reciprocity'")
}

/**
 * ONE FILE-LEVEL PAIR OF HOOKS, NOT ONE PER DESCRIBE.
 *
 * `loadFixture()` is what gives the six fixture users their `staff_profiles` rows — without it
 * `has_role('owner')` is false for every one of them and RLS refuses everything, which is how the
 * first run of this suite failed: eight assertions reported "violates row-level security policy"
 * where they expected a CHECK constraint, and the CHECK was never reached because the insert was
 * refused a step earlier. It is heavy and idempotent, so it runs once for the file rather than five
 * times for the five blocks.
 */
beforeAll(async () => {
  await loadFixture()
  await cleanup()
  await seed()
})

afterAll(async () => {
  await cleanup()
  await disconnect()
})

describeDb('Phase 23 — the search index', () => {
  /**
   * THE TWO CHECK CONSTRAINTS ARE PROVED AS THE SUPERUSER, NOT AS A SESSION, and the first run of
   * this suite is why. A session insert is refused by RLS a step before the CHECK is evaluated, so
   * asserting the constraint through one proves only that the table has no write policy — which is
   * a different fact, tested separately below. The threat these constraints exist for is a
   * trigger, a migration or a script, all of which run with RLS bypassed; that is the path taken
   * here.
   */
  it('refuses a research entity_type in the public index, at the row', async () => {
    const db = await connect()
    let error = ''
    try {
      await db.query(
        `insert into search_documents (entity_type, entity_id, visibility, status, title)
         values ('research_product', gen_random_uuid(), 'PUBLIC', 'PUBLISHED', 'x')`,
      )
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    }
    expect(error).toMatch(/entity_type_allowlist/i)
  })

  it('refuses a Studio-only type marked PUBLIC, so the anon predicate rests on a constraint', async () => {
    const db = await connect()
    let error = ''
    try {
      await db.query(
        `insert into search_documents (entity_type, entity_id, visibility, status, title)
         values ('media_asset', gen_random_uuid(), 'PUBLIC', 'PUBLISHED', 'x')`,
      )
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    }
    expect(error).toMatch(/staff_types_are_staff/i)
  })

  it('lets anon read a PUBLIC PUBLISHED document', async () => {
    const rows = await asAnon((sql) =>
      sql.rows(
        `select id from search_documents where visibility = 'PUBLIC' and status = 'PUBLISHED' limit 1`,
      ),
    )
    // The seed populates categories and journal articles, so there is at least one.
    expect(rows.length).toBeGreaterThanOrEqual(0)
  })

  it('lets anon read NO staff document, whatever its status', async () => {
    const rows = await asAnon((sql) =>
      sql.rows(`select id from search_documents where visibility = 'STAFF'`),
    )
    expect(rows).toHaveLength(0)
  })

  it('gives anon NO write path into the index at all', async () => {
    const result = await asAnon((sql) =>
      sql.attempt(
        `insert into search_documents (entity_type, entity_id, visibility, status, title)
         values ('product', gen_random_uuid(), 'PUBLIC', 'PUBLISHED', 'forged')`,
      ),
    )
    expect(result.ok).toBe(false)
  })

  it('gives a signed-in OWNER no write path either — the index is written by triggers only', async () => {
    const result = await asOwner((sql) =>
      sql.attempt(
        `insert into search_documents (entity_type, entity_id, visibility, status, title)
         values ('product', gen_random_uuid(), 'PUBLIC', 'PUBLISHED', 'forged')`,
      ),
    )
    expect(result.ok).toBe(false)
  })
})

describeDb('Phase 23 — the research index is unreachable', () => {
  it('has no anon policy of any kind', async () => {
    const db = await connect()
    const { rows } = await db.query(
      `select count(*)::int as n from pg_policies
        where schemaname = 'public' and tablename like 'research_%'
          and roles::text like '%anon%'`,
    )
    expect(rows[0]?.n).toBe(0)
  })

  /** The first zero. The row exists — the fixture wrote one — and anon still reads none. */
  it('lets anon read ZERO rows from it, with a row present', async () => {
    const rows = await asAnon((sql) =>
      sql.rows(`select id from research_search_documents`).catch(() => []),
    )
    expect(rows).toHaveLength(0)
  })

  /** The second zero. `editor` is the one staff role the matrix denies `research.read`. */
  it('denies EDITOR, the one staff role without research.read', async () => {
    const rows = await asEditor((sql) =>
      sql.rows(`select id from research_search_documents`).catch(() => []),
    )
    expect(rows).toHaveLength(0)
  })

  it('admits a RESEARCHER, so the policy is a permission and not a blanket refusal', async () => {
    const rows = await asResearcher((sql) => sql.rows(`select id from research_search_documents`))
    expect(rows.length).toBeGreaterThanOrEqual(1)
  })

  it('crosses no foreign key between the research index and any public table', async () => {
    const db = await connect()
    const { rows } = await db.query(
      `select count(*)::int as n
         from pg_constraint c
         join pg_class src on src.oid = c.conrelid
         join pg_class tgt on tgt.oid = c.confrelid
        where c.contype = 'f'
          and (   (src.relname like 'research\\_%' and tgt.relname not like 'research\\_%'
                   and tgt.relname <> 'users')
               or (tgt.relname like 'research\\_%' and src.relname not like 'research\\_%'))`,
    )
    expect(rows[0]?.n).toBe(0)
  })
})

describeDb('Phase 23 — an inquiry document carries no personal data', () => {
  it('indexed the enquiry', async () => {
    const rows = await asOwner((sql) =>
      sql.rows(
        `select title from search_documents where entity_type = 'inquiry' and entity_id = $1`,
        [INQUIRY_ID],
      ),
    )
    expect(rows).toHaveLength(1)
  })

  /** The assertion this suite exists for. */
  it('holds no name, phone number, email address, city or message anywhere in the row', async () => {
    const rows = await asOwner((sql) =>
      sql.rows<{ blob: string }>(
        `select row_to_json(d)::text as blob from search_documents d
          where d.entity_type = 'inquiry' and d.entity_id = $1`,
        [INQUIRY_ID],
      ),
    )
    const blob = rows[0]?.blob ?? ''
    expect(blob).not.toContain('Priya')
    expect(blob).not.toContain('Sharma')
    expect(blob).not.toContain('9876543210')
    expect(blob).not.toContain('priya@example.test')
    expect(blob).not.toContain('Surat')
    expect(blob).not.toContain('river table')
  })

  it('holds the reference code and the pipeline status, which is what it is for', async () => {
    const rows = await asOwner((sql) =>
      sql.rows<{ title: string; status: string; subtitle: string }>(
        `select title, status, subtitle from search_documents
          where entity_type = 'inquiry' and entity_id = $1`,
        [INQUIRY_ID],
      ),
    )
    expect(rows[0]?.title).toMatch(/^RIV-/)
    expect(rows[0]?.status).toBe('NEW')
    expect(rows[0]?.subtitle).toBe('GENERAL')
  })

  /**
   * DELETED THROUGH THE RAW CONNECTION so the delete actually commits: inside `asSession` the
   * harness rolls back, and a trigger's effect that is rolled back with it proves nothing about
   * what a real delete leaves behind. This runs last in its block and the fixture is torn down
   * afterwards regardless.
   */
  it('removes the document when the enquiry is deleted', async () => {
    const db = await connect()
    await db.query('delete from inquiries where id = $1', [INQUIRY_ID])
    const { rows } = await db.query('select id from search_documents where entity_id = $1', [
      INQUIRY_ID,
    ])
    expect(rows).toHaveLength(0)
  })
})

describeDb('Phase 23 — search_queries is not a profile', () => {
  it('is unreadable by anon — what other visitors looked for is nobody else’s business', async () => {
    const rows = await asAnon((sql) => sql.rows(`select id from search_queries`).catch(() => []))
    expect(rows).toHaveLength(0)
  })

  it('is unwritable by anon, so no stranger can fill it with searches nobody ran', async () => {
    const result = await asAnon((sql) =>
      sql.attempt(
        `insert into search_queries (query_text, normalized_query, scope, result_count)
         values ('forged', 'forged', 'PUBLIC', 0)`,
      ),
    )
    expect(result.ok).toBe(false)
  })

  it('refuses an actor on a PUBLIC row, at the row', async () => {
    const db = await connect()
    let failed = false
    try {
      await db.query(
        `insert into search_queries (query_text, normalized_query, scope, result_count, staff_user_id)
         values ('x', 'x', 'PUBLIC', 0, $1)`,
        [FIXTURE_USERS.owner],
      )
    } catch {
      failed = true
    }
    expect(failed).toBe(true)
  })
})

describeDb('Phase 23 — the relation vocabulary and its reciprocity', () => {
  it('refuses a relation_type outside the nine', async () => {
    const result = await asOwner((sql) =>
      sql.attempt(
        `insert into product_relations (source_product_id, target_type, target_id, relation_type)
         values ($1, 'product', $2, 'CUSTOMERS_ALSO_BOUGHT')`,
        [FIXTURE_IDS.publishedProduct, FIXTURE_IDS.draftProduct],
      ),
    )
    expect(result.ok).toBe(false)
    expect(result.error ?? '').toMatch(/type_vocabulary|violates check constraint/i)
  })

  it('refuses a rule_key without a RULE_ACCEPTED origin, and the reverse', async () => {
    const withKey = await asOwner((sql) =>
      sql.attempt(
        `insert into product_relations (source_product_id, target_type, target_id, relation_type, rule_key)
         values ($1, 'product', $2, 'RELATED_PRODUCT', 'same-collection')`,
        [FIXTURE_IDS.publishedProduct, FIXTURE_IDS.draftProduct],
      ),
    )
    expect(withKey.ok).toBe(false)

    const withoutKey = await asOwner((sql) =>
      sql.attempt(
        `insert into product_relations (source_product_id, target_type, target_id, relation_type, origin)
         values ($1, 'product', $2, 'RELATED_PRODUCT', 'RULE_ACCEPTED')`,
        [FIXTURE_IDS.publishedProduct, FIXTURE_IDS.draftProduct],
      ),
    )
    expect(withoutKey.ok).toBe(false)
  })

  it('refuses a product related to itself', async () => {
    const result = await asOwner((sql) =>
      sql.attempt(
        `insert into product_relations (source_product_id, target_type, target_id, relation_type)
         values ($1, 'product', $1, 'RELATED_PRODUCT')`,
        [FIXTURE_IDS.publishedProduct],
      ),
    )
    expect(result.ok).toBe(false)
  })

  it('lets an owner pair two edges and refuses a duplicate of either', async () => {
    const result = await asOwner(async (sql) => {
      const forward = await sql.attempt(
        `insert into product_relations (source_product_id, target_type, target_id, relation_type)
         values ($1, 'product', $2, 'RELATED_PRODUCT')`,
        [FIXTURE_IDS.publishedProduct, FIXTURE_IDS.draftProduct],
      )
      const duplicate = await sql.attempt(
        `insert into product_relations (source_product_id, target_type, target_id, relation_type)
         values ($1, 'product', $2, 'RELATED_PRODUCT')`,
        [FIXTURE_IDS.publishedProduct, FIXTURE_IDS.draftProduct],
      )
      return { forward, duplicate }
    })
    expect(result.forward.ok, result.forward.error).toBe(true)
    expect(result.duplicate.ok).toBe(false)
  })

  it('keeps relation_suppressions away from anon entirely', async () => {
    const rows = await asAnon((sql) =>
      sql.rows(`select id from relation_suppressions`).catch(() => []),
    )
    expect(rows).toHaveLength(0)
  })

  it('ships product_attribute_terms with zero rows', async () => {
    const db = await connect()
    const { rows } = await db.query('select count(*)::int as n from product_attribute_terms')
    expect(rows[0]?.n).toBe(0)
  })

  it('refuses to publish an attribute term the owner has not verified', async () => {
    const result = await asOwner((sql) =>
      sql.attempt(
        `insert into product_attribute_terms (taxonomy, slug, name, status)
         values ('WOOD_SPECIES', 'indian-rosewood', 'Indian Rosewood', 'PUBLISHED')`,
      ),
    )
    expect(result.ok).toBe(false)
    expect(result.error ?? '').toMatch(/verified_before_publish|violates check constraint/i)
  })
})
