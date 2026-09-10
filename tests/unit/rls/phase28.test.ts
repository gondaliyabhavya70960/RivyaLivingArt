import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FIXTURE_USERS, asAnon, asSession, connect, disconnect, loadFixture } from './harness'

/**
 * Phase 28 at the table: the column split, the two backstops, and the second and final crossing.
 *
 * THE COLUMN SPLIT IS THE ASSERTION THIS FILE IS FOR, AND RLS CANNOT MAKE IT ALONE. PostgreSQL
 * gates a ROW, not a COLUMN: as far as it is concerned, a researcher who may correct a normalised
 * price on `research_products` may also write `duplicate_of_id` on the same row. The line between
 * "correct a value" and "decide an identity" is drawn by the Server Actions in
 * `app/(studio)/studio/(shell)/research/explorer/actions.ts`, and what RLS contributes is the layer
 * underneath: `research_match_candidates` — the only route to a duplicate flag that does not go
 * through those actions — is `research.confirm` to write, so a researcher cannot reach the decision
 * sideways. That is what the second describe block proves.
 *
 * TWO TABLES HAVE NO INSERT POLICY FOR ANY ROLE, OWNER INCLUDED. An `ERROR` in
 * `research_validation_issues` is what holds a row back, so a hand-written one is a way to
 * quarantine a competitor's product with nothing in the pipeline log saying it was done by hand. A
 * row in `research_match_candidates` is a proposal the matcher made from evidence it recorded; one
 * somebody inserted is a duplicate claim with no evidence behind it, arriving in a merchandiser's
 * queue looking exactly like a real one.
 *
 * THE TWO BACKSTOPS ARE ASSERTED AS BACKSTOPS. `research_price_state_coherent` and
 * `research_dimensions_sane` are proved to refuse a hand-written `UPDATE` — which is the only thing
 * they are for. The normalizer never offers a value either of them would refuse, and
 * `tests/unit/validation-rules.test.ts` proves that half.
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
const asResearcher = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.researcher, fn)
const asEditor = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.editor, fn)
const asMerchandiser = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.merchandiser, fn)

const SOURCE_ID = '00000000-0000-4000-8000-000000002801'
const PRODUCT_ID = '00000000-0000-4000-8000-000000002802'
const OTHER_PRODUCT_ID = '00000000-0000-4000-8000-000000002803'
const VERSION_ID = '00000000-0000-4000-8000-000000002804'
const ISSUE_ID = '00000000-0000-4000-8000-000000002805'
const CANDIDATE_ID = '00000000-0000-4000-8000-000000002806'
const LEXICON_ID = '00000000-0000-4000-8000-000000002807'

const PHASE_28_TABLES = [
  'research_validation_issues',
  'research_match_candidates',
  'research_material_lexicon',
] as const

const DRAFT = JSON.stringify({
  title: 'A Long Table',
  priceText: '£1,299.00',
  currencyText: 'GBP',
  skuText: null,
  availabilityText: null,
  leadTimeText: null,
  descriptionHtml: null,
  externalId: null,
  canonicalUrl: 'https://p28.example/p/1',
  dimensionTexts: ['200 x 90 x 75 cm'],
  materialTexts: ['Solid oak'],
  variantTexts: [],
  customizationTexts: [],
  imageUrls: [],
  categoryLabels: ['Long Tables'],
  confidence: { title: 1, priceText: 1 },
  provenance: { title: 'jsonld', priceText: 'jsonld' },
})

async function seed(): Promise<void> {
  const db = await connect()

  await db.query(
    `insert into research_sources (id, slug, name, base_url, currency)
     values ($1, 'p28-source', 'Phase 28 Source', 'https://p28.example', 'GBP')
     on conflict (id) do nothing`,
    [SOURCE_ID],
  )
  await db.query(
    `insert into research_products (id, source_id, source_url, stage, title_normalized,
                                    currency, price_state, price_min_minor, material_tokens)
     values ($1, $2, 'https://p28.example/p/1', 'VALIDATED', 'A Long Table',
             'GBP', 'FIXED', 129900, array['oak'])
     on conflict (id) do nothing`,
    [PRODUCT_ID, SOURCE_ID],
  )
  await db.query(
    `insert into research_products (id, source_id, source_url, stage, title_normalized)
     values ($1, $2, 'https://p28.example/p/2', 'VALIDATED', 'A Long Table (2026)')
     on conflict (id) do nothing`,
    [OTHER_PRODUCT_ID, SOURCE_ID],
  )
  await db.query(
    `insert into research_product_versions
       (id, research_product_id, raw, content_hash, adapter_key, adapter_version)
     values ($1, $2, $3::jsonb, 'p28-hash', 'generic', '2.0.0')
     on conflict (id) do nothing`,
    [VERSION_ID, PRODUCT_ID, DRAFT],
  )
  await db.query(
    `insert into research_validation_issues
       (id, research_product_id, version_id, rule, severity, field, detail)
     values ($1, $2, $3, 'dimension_ambiguous', 'WARNING', 'dimensions', 'No unit was given.')
     on conflict (id) do nothing`,
    [ISSUE_ID, PRODUCT_ID, VERSION_ID],
  )
  await db.query(
    `insert into research_match_candidates
       (id, research_product_id, candidate_id, method, score, evidence)
     values ($1, $2, $3, 'TRIGRAM_DIMENSION', 0.880, '{"similarity": 0.88}'::jsonb)
     on conflict (id) do nothing`,
    [CANDIDATE_ID, PRODUCT_ID, OTHER_PRODUCT_ID],
  )
  await db.query(
    `insert into research_material_lexicon (id, token, patterns, family)
     values ($1, 'p28_test_term', array['p28 test term'], 'wood')
     on conflict (id) do nothing`,
    [LEXICON_ID],
  )
}

async function cleanup(): Promise<void> {
  const db = await connect()
  await db.query('delete from research_material_lexicon where token like $1', ['p28%'])
  // Everything else cascades from the source.
  await db.query("delete from research_sources where slug like 'p28-%'")
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

describeDb('Phase 28 — I2: anon reads nothing from any of the three tables', () => {
  it.each(PHASE_28_TABLES)('anon reads zero rows from %s', async (table) => {
    const rows = await asAnon((sql) => sql.rows(`select 1 from ${table}`))
    expect(rows).toHaveLength(0)
  })

  it('proves the seed landed, so the zeros above mean something', async () => {
    const db = await connect()
    for (const table of PHASE_28_TABLES) {
      const { rows } = await db.query(`select count(*)::int as count from ${table}`)
      expect(Number(rows[0].count), table).toBeGreaterThan(0)
    }
  })

  it('refuses an EDITOR, the one staff role without research.read', async () => {
    for (const table of PHASE_28_TABLES) {
      const rows = await asEditor((sql) => sql.rows(`select 1 from ${table}`))
      expect(rows, table).toHaveLength(0)
    }
  })

  it('admits a researcher and a merchandiser to all three', async () => {
    for (const table of PHASE_28_TABLES) {
      expect(
        (await asResearcher((sql) => sql.rows(`select 1 from ${table}`))).length,
        table,
      ).toBeGreaterThan(0)
      expect(
        (await asMerchandiser((sql) => sql.rows(`select 1 from ${table}`))).length,
        table,
      ).toBeGreaterThan(0)
    }
  })
})

describeDb('Phase 28 — nobody with a session raises a finding or invents a proposal', () => {
  const roles = [
    ['owner', asOwner],
    ['researcher', asResearcher],
    ['merchandiser', asMerchandiser],
  ] as const

  it.each(roles)('refuses %s an INSERT into research_validation_issues', async (_name, as) => {
    // AN ERROR IS WHAT HOLDS A ROW BACK. A hand-written one is a way to quarantine a competitor's
    // product with nothing in the pipeline log saying a person did it.
    const result = await as((sql) =>
      sql.attempt(
        `insert into research_validation_issues (research_product_id, rule, severity)
         values ($1, 'missing_title', 'ERROR')`,
        [PRODUCT_ID],
      ),
    )
    expect(result.ok).toBe(false)
  })

  it.each(roles)('refuses %s an INSERT into research_match_candidates', async (_name, as) => {
    const result = await as((sql) =>
      sql.attempt(
        `insert into research_match_candidates (research_product_id, candidate_id, method, score)
         values ($1, $2, 'EXTERNAL_ID', 1.000)`,
        [OTHER_PRODUCT_ID, PRODUCT_ID],
      ),
    )
    expect(result.ok).toBe(false)
  })

  it.each(roles)('refuses %s a DELETE of a finding', async (_name, as) => {
    // An issue that was wrong is a fact about the rule that raised it; deleting it deletes the
    // evidence that the rule needs changing.
    const changed = await as((sql) =>
      sql.affectedRows('delete from research_validation_issues where id = $1', [ISSUE_ID]),
    )
    expect(changed).toBe(0)
  })
})

describeDb('Phase 28 — the column split: who may dismiss, and who may decide', () => {
  it('lets a RESEARCHER dismiss a finding', async () => {
    const changed = await asResearcher((sql) =>
      sql.affectedRows(
        `update research_validation_issues
            set is_dismissed = true, dismissed_by = $2, dismissed_at = now(),
                dismiss_reason = 'The page lists this in a footnote.'
          where id = $1`,
        [ISSUE_ID, FIXTURE_USERS.researcher],
      ),
    )
    expect(changed).toBe(1)

    const db = await connect()
    await db.query(
      `update research_validation_issues
          set is_dismissed = false, dismissed_by = null, dismissed_at = null, dismiss_reason = null
        where id = $1`,
      [ISSUE_ID],
    )
  })

  it('REFUSES A DISMISSAL WITH NO REASON, at the row', async () => {
    const result = await asResearcher((sql) =>
      sql.attempt(`update research_validation_issues set is_dismissed = true where id = $1`, [
        ISSUE_ID,
      ]),
    )
    expect(result.ok).toBe(false)
  })

  it('REFUSES A RESEARCHER A MATCH-CANDIDATE DECISION', async () => {
    /*
     * THE SIDEWAYS ROUTE, CLOSED. Accepting a candidate writes `duplicate_of_id` and `disposition`
     * on the product, which are a merchandiser's columns; if this table took `research.write` a
     * researcher could reach a decision they are not permitted to make directly.
     */
    const changed = await asResearcher((sql) =>
      sql.affectedRows(
        `update research_match_candidates
            set decided = 'ACCEPTED', decided_by = $2, decided_at = now()
          where id = $1`,
        [CANDIDATE_ID, FIXTURE_USERS.researcher],
      ),
    )
    expect(changed).toBe(0)
  })

  it('lets a MERCHANDISER decide one', async () => {
    const changed = await asMerchandiser((sql) =>
      sql.affectedRows(
        `update research_match_candidates
            set decided = 'REJECTED', decided_by = $2, decided_at = now()
          where id = $1`,
        [CANDIDATE_ID, FIXTURE_USERS.merchandiser],
      ),
    )
    expect(changed).toBe(1)

    const db = await connect()
    await db.query(
      `update research_match_candidates
          set decided = 'PENDING', decided_by = null, decided_at = null where id = $1`,
      [CANDIDATE_ID],
    )
  })

  it('refuses a decision that names nobody', async () => {
    const result = await asMerchandiser((sql) =>
      sql.attempt(`update research_match_candidates set decided = 'ACCEPTED' where id = $1`, [
        CANDIDATE_ID,
      ]),
    )
    expect(result.ok).toBe(false)
  })
})

describeDb('Phase 28 — the lexicon is editable, and deleting one is destructive', () => {
  it('lets a researcher edit a term', async () => {
    const changed = await asResearcher((sql) =>
      sql.affectedRows('update research_material_lexicon set is_enabled = false where id = $1', [
        LEXICON_ID,
      ]),
    )
    expect(changed).toBe(1)
  })

  it('lets a researcher add one, because a vocabulary nobody can extend is a hard-coded list', async () => {
    const result = await asResearcher((sql) =>
      sql.attempt(
        `insert into research_material_lexicon (token, patterns) values ('p28_added', array['p28 added'])`,
      ),
    )
    expect(result.ok).toBe(true)
  })

  it('REFUSES A MERCHANDISER A DELETE, because removing a term unmatches it everywhere', async () => {
    // `destructive.execute` — owner and admin — rather than `research.confirm`, which a
    // merchandiser holds. The Studio action checks the same permission, so a merchandiser is never
    // shown a control RLS would then refuse.
    const changed = await asMerchandiser((sql) =>
      sql.affectedRows('delete from research_material_lexicon where id = $1', [LEXICON_ID]),
    )
    expect(changed).toBe(0)
  })

  it('lets an OWNER delete one', async () => {
    const changed = await asOwner((sql) =>
      sql.affectedRows('delete from research_material_lexicon where id = $1', [LEXICON_ID]),
    )
    expect(changed).toBe(1)
  })

  it('refuses a token that is not a token', async () => {
    for (const token of ['Oak Wood', 'oak-wood', '1oak', '']) {
      const result = await asResearcher((sql) =>
        sql.attempt(
          `insert into research_material_lexicon (token, patterns) values ($1, array['x'])`,
          [token],
        ),
      )
      expect(result.ok, token).toBe(false)
    }
  })

  it('refuses a term with no patterns, which would match nothing while looking configured', async () => {
    /*
     * THIS ASSERTION FOUND A REAL DEFECT AND IS THE REASON THE CONSTRAINT NOW READS `cardinality`.
     * It was written as `array_length(patterns, 1) >= 1`, and `array_length` on an empty array is
     * NULL rather than 0 — a CHECK evaluating to NULL PASSES. So the constraint admitted exactly
     * the row it was written to refuse, and would have gone on doing so silently. Asserting the
     * refusal rather than assuming it is the whole difference.
     */
    const result = await asResearcher((sql) =>
      sql.attempt(
        `insert into research_material_lexicon (token, patterns) values ('p28_empty', array[]::text[])`,
      ),
    )
    expect(result.ok).toBe(false)
  })

  it('REFUSES A BLANK PATTERN, which would tag every product in the system', async () => {
    // `matchMaterials` builds a word-boundary expression per pattern; an empty one is two
    // look-arounds with nothing between them, which matches at almost any word boundary. One blank
    // row would put that material on every scraped product and on every breakdown built from them.
    for (const patterns of ["array['']", "array['oak', '   ']"]) {
      const result = await asResearcher((sql) =>
        sql.attempt(
          `insert into research_material_lexicon (token, patterns) values ('p28_blank', ${patterns})`,
        ),
      )
      expect(result.ok, patterns).toBe(false)
    }
  })
})

describeDb(
  'Phase 28 — the two backstops fire for a hand-written UPDATE and for nothing else',
  () => {
    it('REFUSES A QUOTE-ONLY ROW CARRYING A PRICE', async () => {
      // `research_price_state_coherent`, mirroring the Phase 03 rule on `products`. A "price on
      // request" row stored as a number drags every average, band and comparison towards it, and
      // nothing downstream can tell it from a real price.
      const db = await connect()
      await expect(
        db.query(
          `update research_products set price_state = 'REQUEST_QUOTE', price_min_minor = 129900
          where id = $1`,
          [PRODUCT_ID],
        ),
      ).rejects.toThrow(/research_price_state_coherent/u)
    })

    it('refuses a priced row with no currency', async () => {
      const db = await connect()
      await expect(
        db.query(
          `update research_products set price_state = 'FIXED', price_min_minor = 129900, currency = null
          where id = $1`,
          [PRODUCT_ID],
        ),
      ).rejects.toThrow(/research_price_state_coherent/u)
    })

    it('REFUSES AN IMPOSSIBLE DIMENSION', async () => {
      const db = await connect()
      await expect(
        db.query(`update research_products set dimensions_mm = $2::jsonb where id = $1`, [
          PRODUCT_ID,
          '{"length_mm": 99999}',
        ]),
      ).rejects.toThrow(/research_dimensions_sane/u)
    })

    it('refuses a dimension key that is not a millimetre measurement', async () => {
      // A normalizer that invented `depth_cm` — a unit in a key that promises millimetres — is
      // refused rather than stored.
      const db = await connect()
      await expect(
        db.query(`update research_products set dimensions_mm = $2::jsonb where id = $1`, [
          PRODUCT_ID,
          '{"depth_cm": 60}',
        ]),
      ).rejects.toThrow(/research_dimensions_sane/u)
    })

    it('ADMITS A RANGE, which is a real shape a furniture page publishes', async () => {
      const db = await connect()
      await db.query(`update research_products set dimensions_mm = $2::jsonb where id = $1`, [
        PRODUCT_ID,
        '{"length_mm": 1800, "length_mm_max": 2400, "height_mm": 750}',
      ])
      const { rows } = await db.query(
        `select dimensions_mm ->> 'length_mm_max' as max from research_products where id = $1`,
        [PRODUCT_ID],
      )
      expect(rows[0].max).toBe('2400')
    })

    it('refuses a row that is its own duplicate', async () => {
      const db = await connect()
      await expect(
        db.query('update research_products set duplicate_of_id = id where id = $1', [PRODUCT_ID]),
      ).rejects.toThrow(/research_products_duplicate_is_another/u)
    })
  },
)

describeDb('Phase 28 — I1: the second and FINAL crossing', () => {
  it('has exactly two research → public foreign keys, named', async () => {
    /*
     * THE INVARIANT THE WHOLE RESEARCH SUBSYSTEM RESTS ON, ASKED OF THE DATABASE RATHER THAN OF THE
     * migration files. `scripts/research/check-research-isolation.mjs` asks the same question in
     * CI; this asks it here so a local run catches a third crossing before it is pushed.
     */
    const db = await connect()
    const { rows } = await db.query(`
      select c.conname
        from pg_constraint c
        join pg_class child on child.oid = c.conrelid
        join pg_class parent on parent.oid = c.confrelid
       where c.contype = 'f'
         and child.relname like 'research\\_%'
         and parent.relname not like 'research\\_%'
         and parent.relnamespace = 'public'::regnamespace
       order by c.conname
    `)
    expect(rows.map((row: { conname: string }) => row.conname)).toEqual([
      'research_products_matched_category_fk',
      'research_source_category_map_category_fk',
    ])
  })

  it('unmatches rather than deletes when a category goes', async () => {
    // `on delete set null`. A category removed from Rivya's taxonomy must not take a competitor's
    // product row with it — the research is evidence about somebody else, not about the taxonomy.
    const db = await connect()
    const { rows } = await db.query(`
      select confdeltype from pg_constraint where conname = 'research_products_matched_category_fk'
    `)
    expect(rows[0].confdeltype).toBe('n')
  })
})

describeDb(
  'Phase 28 — a research product is indexed for Studio search and for nothing public',
  () => {
    it('writes a research_search_documents row with a normalised title', async () => {
      const db = await connect()
      await db.query(
        `update research_products set title_normalized = 'A Long Table', material_tokens = array['oak']
        where id = $1`,
        [PRODUCT_ID],
      )
      const { rows } = await db.query(
        `select title, visibility, url_path, keywords from research_search_documents
        where entity_type = 'research_product' and entity_id = $1`,
        [PRODUCT_ID],
      )
      expect(rows).toHaveLength(1)
      expect(rows[0].title).toBe('A Long Table')
      expect(rows[0].visibility).toBe('STAFF')
      expect(String(rows[0].url_path)).toContain('/studio/research/explorer?row=')
      expect(String(rows[0].keywords)).toContain('oak')
    })

    it('PUTS NOTHING IN THE PUBLIC INDEX', async () => {
      const db = await connect()
      const { rows } = await db.query(
        `select count(*)::int as count from search_documents where entity_type like 'research%'`,
      )
      expect(Number(rows[0].count)).toBe(0)
    })

    it('refuses anon the research index outright', async () => {
      const rows = await asAnon((sql) => sql.rows('select 1 from research_search_documents'))
      expect(rows).toHaveLength(0)
    })
  },
)
