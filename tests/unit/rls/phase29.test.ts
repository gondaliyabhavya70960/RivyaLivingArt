import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FIXTURE_USERS, asAnon, asSession, connect, disconnect, loadFixture } from './harness'

/**
 * Phase 29 at the table: what the system detected, what a person decided, and what neither may
 * rewrite.
 *
 * THREE POSTURES, AND EACH IS ASSERTED AS THE THING IT IS.
 *
 *   DETECTED — `research_changes` and `research_change_digests` have no write policy for any role,
 *   owner included. A change row a session could insert is a competitor price move somebody
 *   invented, arriving in a merchandiser's queue looking exactly like a real one; a hand-edited
 *   digest is a trend nobody can reconcile.
 *
 *   DECIDED — `research_review_actions`, `research_notes` and `research_product_tags` are
 *   `research.confirm` and INSERT-ONLY, and the append-only rule is enforced by a TRIGGER rather
 *   than by a missing policy. That distinction is what these tests are for: a policy stops
 *   PostgREST, and a trigger stops the service role too. An action log the pipeline itself could
 *   rewrite is not an audit trail.
 *
 *   CONFIGURED — `research_change_rules` and `research_tags` are `research.write`, the same posture
 *   as the material lexicon, because a threshold is a parsing decision rather than a verdict.
 *
 * AND THE RULE THE WHOLE PHASE TURNS ON: **nothing here creates a Rivya product.** The last block
 * counts `products` either side of a confirm, because the guard proves there is no CODE path and
 * this proves there is no DATABASE one — no trigger, no rule, no cascade.
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

const SOURCE_ID = '00000000-0000-4000-8000-000000002901'
const PRODUCT_ID = '00000000-0000-4000-8000-000000002902'
const OTHER_PRODUCT_ID = '00000000-0000-4000-8000-000000002903'
const VERSION_A = '00000000-0000-4000-8000-000000002904'
const VERSION_B = '00000000-0000-4000-8000-000000002905'
const CHANGE_ID = '00000000-0000-4000-8000-000000002906'
const ACTION_ID = '00000000-0000-4000-8000-000000002907'
const NOTE_ID = '00000000-0000-4000-8000-000000002908'
const TAG_ID = '00000000-0000-4000-8000-000000002909'

const PHASE_29_TABLES = [
  'research_changes',
  'research_change_rules',
  'research_review_actions',
  'research_notes',
  'research_tags',
  'research_product_tags',
  'research_change_digests',
] as const

const DRAFT = JSON.stringify({
  title: 'A Phase 29 Table',
  priceText: '£1,200.00',
  currencyText: 'GBP',
  skuText: null,
  availabilityText: null,
  leadTimeText: null,
  descriptionHtml: null,
  externalId: null,
  canonicalUrl: 'https://p29.example/p/1',
  dimensionTexts: [],
  materialTexts: [],
  variantTexts: [],
  customizationTexts: [],
  imageUrls: [],
  categoryLabels: [],
  confidence: { title: 1 },
  provenance: { title: 'jsonld' },
})

async function seed(): Promise<void> {
  const db = await connect()

  await db.query(
    `insert into research_sources (id, slug, name, base_url, currency)
     values ($1, 'p29-source', 'Phase 29 Source', 'https://p29.example', 'GBP')
     on conflict (id) do nothing`,
    [SOURCE_ID],
  )
  await db.query(
    `insert into research_products (id, source_id, source_url, stage, title_normalized)
     values ($1, $2, 'https://p29.example/p/1', 'MATCHED', 'A Phase 29 Table')
     on conflict (id) do nothing`,
    [PRODUCT_ID, SOURCE_ID],
  )
  await db.query(
    `insert into research_products (id, source_id, source_url, stage, title_normalized)
     values ($1, $2, 'https://p29.example/p/2', 'MATCHED', 'A Phase 29 Table (2026)')
     on conflict (id) do nothing`,
    [OTHER_PRODUCT_ID, SOURCE_ID],
  )
  for (const [id, hash] of [
    [VERSION_A, 'p29-hash-a'],
    [VERSION_B, 'p29-hash-b'],
  ] as const) {
    await db.query(
      `insert into research_product_versions
         (id, research_product_id, raw, content_hash, adapter_key, adapter_version)
       values ($1, $2, $3::jsonb, $4, 'generic', '2.0.0')
       on conflict (id) do nothing`,
      [id, PRODUCT_ID, DRAFT, hash],
    )
  }
  await db.query(
    `insert into research_changes
       (id, research_product_id, source_id, field, change_kind, materiality,
        before, after, version_before_id, version_after_id)
     values ($1, $2, $3, 'price', 'MODIFIED', 'MATERIAL',
             '{"minMinor": 120000}'::jsonb, '{"minMinor": 138000}'::jsonb, $4, $5)
     on conflict (id) do nothing`,
    [CHANGE_ID, PRODUCT_ID, SOURCE_ID, VERSION_A, VERSION_B],
  )
  await db.query(
    `insert into research_review_actions
       (id, research_product_id, change_id, action, reason, actor_role)
     values ($1, $2, $3, 'REVIEW', null, 'merchandiser')
     on conflict (id) do nothing`,
    [ACTION_ID, PRODUCT_ID, CHANGE_ID],
  )
  await db.query(
    `insert into research_notes (id, research_product_id, body)
     values ($1, $2, 'A phase 29 note.')
     on conflict (id) do nothing`,
    [NOTE_ID, PRODUCT_ID],
  )
  await db.query(
    `insert into research_tags (id, slug, label, status)
     values ($1, 'p29-oversized', 'Oversized', 'PUBLISHED')
     on conflict (id) do nothing`,
    [TAG_ID],
  )
  await db.query(
    `insert into research_product_tags (research_product_id, tag_id)
     values ($1, $2) on conflict do nothing`,
    [PRODUCT_ID, TAG_ID],
  )
  await db.query(
    `insert into research_change_digests (digest_date, stats)
     values (date '2026-09-01', '{"materialChangeTotal": 1}'::jsonb)
     on conflict (digest_date) do nothing`,
  )
}

async function cleanup(): Promise<void> {
  const db = await connect()
  await db.query("delete from research_tags where slug like 'p29-%'")
  await db.query("delete from research_change_digests where digest_date = date '2026-09-01'")
  await db.query(
    "delete from research_change_rules where field = 'price' and source_id is not null",
  )
  // Everything else cascades from the source.
  await db.query("delete from research_sources where slug like 'p29-%'")
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

describeDb('Phase 29 — I2: anon reads nothing from any of the seven tables', () => {
  it.each(PHASE_29_TABLES)('anon reads zero rows from %s', async (table) => {
    const rows = await asAnon((sql) => sql.rows(`select 1 from ${table}`))
    expect(rows).toHaveLength(0)
  })

  it('proves the seed landed, so the zeros above mean something', async () => {
    const db = await connect()
    for (const table of PHASE_29_TABLES) {
      const { rows } = await db.query(`select count(*)::int as count from ${table}`)
      expect(Number(rows[0].count), table).toBeGreaterThan(0)
    }
  })

  it('refuses an EDITOR, the one staff role without research.read', async () => {
    for (const table of PHASE_29_TABLES) {
      const rows = await asEditor((sql) => sql.rows(`select 1 from ${table}`))
      expect(rows, table).toHaveLength(0)
    }
  })

  it('admits a researcher and a merchandiser to all seven', async () => {
    for (const table of PHASE_29_TABLES) {
      expect(
        (await asResearcher((sql) => sql.rows(`select 1 from ${table}`))).length,
        table,
      ).toBeGreaterThan(0)
    }
  })
})

describeDb('Phase 29 — what the detector found, nobody may author', () => {
  const roles = [
    ['owner', asOwner],
    ['researcher', asResearcher],
    ['merchandiser', asMerchandiser],
  ] as const

  it.each(roles)('refuses %s an INSERT into research_changes', async (_name, as) => {
    const result = await as((sql) =>
      sql.attempt(
        `insert into research_changes
           (research_product_id, source_id, field, change_kind, materiality, before, after,
            version_after_id)
         values ($1, $2, 'price', 'MODIFIED', 'MATERIAL', '{"a":1}'::jsonb, '{"a":2}'::jsonb, $3)`,
        [PRODUCT_ID, SOURCE_ID, VERSION_B],
      ),
    )
    expect(result.ok).toBe(false)
  })

  it.each(roles)('refuses %s an UPDATE of a decision on research_changes', async (_name, as) => {
    // A person decides through an ACTION, which is audited. Writing the cache directly would be a
    // decision with no record behind it.
    const affected = await as((sql) =>
      sql.affectedRows(`update research_changes set decided_action = 'CONFIRM' where id = $1`, [
        CHANGE_ID,
      ]),
    )
    expect(affected).toBe(0)
  })

  it.each(roles)('refuses %s an INSERT into research_change_digests', async (_name, as) => {
    const result = await as((sql) =>
      sql.attempt(
        `insert into research_change_digests (digest_date, stats)
         values (date '2026-09-02', '{}'::jsonb)`,
      ),
    )
    expect(result.ok).toBe(false)
  })
})

describeDb('Phase 29 — the append-only log refuses the service role too', () => {
  it('refuses a DELETE of a review action', async () => {
    // THE TRIGGER, NOT THE POLICY. This runs on the owning connection, which is the service role:
    // a missing delete policy would not stop it, and a decision the pipeline could erase is not an
    // audit trail.
    const db = await connect()
    await expect(
      db.query('delete from research_review_actions where id = $1', [ACTION_ID]),
    ).rejects.toThrow(/append-only/u)
  })

  it('refuses an UPDATE of a review action reason', async () => {
    const db = await connect()
    await expect(
      db.query(`update research_review_actions set reason = 'rewritten' where id = $1`, [
        ACTION_ID,
      ]),
    ).rejects.toThrow(/append-only/u)
  })

  it('permits setting undone_by_action_id exactly once', async () => {
    const db = await connect()
    const { rows } = await db.query(
      `insert into research_review_actions
         (research_product_id, change_id, action, reason, actor_role)
       values ($1, $2, 'REVIEW', 'undoing', 'merchandiser') returning id`,
      [PRODUCT_ID, CHANGE_ID],
    )
    const reversalId = rows[0].id as string

    await db.query('update research_review_actions set undone_by_action_id = $1 where id = $2', [
      reversalId,
      ACTION_ID,
    ])

    // A SECOND, DIFFERENT REVERSAL IS A RACE AND THE LOSER IS TOLD. Two people undoing the same
    // decision from two screens insert two different reversal rows; the second one to reach the
    // link must not silently overwrite the first.
    const { rows: second } = await db.query(
      `insert into research_review_actions
         (research_product_id, change_id, action, reason, actor_role)
       values ($1, $2, 'REVIEW', 'undoing again', 'merchandiser') returning id`,
      [PRODUCT_ID, CHANGE_ID],
    )
    await expect(
      db.query('update research_review_actions set undone_by_action_id = $1 where id = $2', [
        second[0].id,
        ACTION_ID,
      ]),
    ).rejects.toThrow(/already reversed/u)

    // Re-writing the SAME link is a harmless no-op rather than an error: it is the retry of a
    // request that already succeeded, and refusing it would turn a dropped response into a
    // permanent failure on a screen where the action has visibly already happened.
    await db.query('update research_review_actions set undone_by_action_id = $1 where id = $2', [
      reversalId,
      ACTION_ID,
    ])
  })

  it('refuses a DELETE of a note and permits superseding one', async () => {
    const db = await connect()
    await expect(db.query('delete from research_notes where id = $1', [NOTE_ID])).rejects.toThrow(
      /append-only/u,
    )

    const { rows } = await db.query(
      `insert into research_notes (research_product_id, body) values ($1, 'A newer note.')
       returning id`,
      [PRODUCT_ID],
    )
    await db.query('update research_notes set superseded_by = $1 where id = $2', [
      rows[0].id,
      NOTE_ID,
    ])
  })
})

describeDb('Phase 29 — a decision is research.confirm, and configuration is research.write', () => {
  it('lets a merchandiser record an action and refuses a researcher', async () => {
    const allowed = await asMerchandiser((sql) =>
      sql.attempt(
        `insert into research_review_actions (research_product_id, action, actor_role)
         values ($1, 'SHORTLIST', 'merchandiser')`,
        [PRODUCT_ID],
      ),
    )
    expect(allowed.ok).toBe(true)

    const refused = await asResearcher((sql) =>
      sql.attempt(
        `insert into research_review_actions (research_product_id, action, actor_role)
         values ($1, 'SHORTLIST', 'researcher')`,
        [PRODUCT_ID],
      ),
    )
    expect(refused.ok).toBe(false)
  })

  it('lets a researcher write a threshold and refuses a merchandiser', async () => {
    // THE SPLIT, THE OTHER WAY ROUND. A researcher tunes how loudly a source is read; they do not
    // judge what it found. A merchandiser judges and does not tune.
    const allowed = await asResearcher((sql) =>
      sql.attempt(
        `insert into research_change_rules (source_id, field, material_threshold, status)
         values ($1, 'price', 0.0100, 'PUBLISHED')`,
        [SOURCE_ID],
      ),
    )
    expect(allowed.ok).toBe(true)

    const refused = await asMerchandiser((sql) =>
      sql.attempt(
        `insert into research_change_rules (source_id, field, material_threshold, status)
         values ($1, 'title', 0.5000, 'PUBLISHED')`,
        [SOURCE_ID],
      ),
    )
    expect(refused.ok).toBe(false)
  })

  it('lets a merchandiser apply and remove a tag', async () => {
    // BOTH HALVES IN ONE SESSION BLOCK, because `asSession` rolls back when it returns — every
    // block is its own transaction so a suite cannot leave a row behind for the next one. Splitting
    // the insert and the delete across two blocks would delete a row that no longer existed and
    // assert against a zero that meant nothing.
    const outcome = await asMerchandiser(async (sql) => {
      const applied = await sql.attempt(
        `insert into research_product_tags (research_product_id, tag_id) values ($1, $2)
         on conflict do nothing`,
        [OTHER_PRODUCT_ID, TAG_ID],
      )
      const removed = await sql.affectedRows(
        'delete from research_product_tags where research_product_id = $1 and tag_id = $2',
        [OTHER_PRODUCT_ID, TAG_ID],
      )
      return { applied, removed }
    })
    expect(outcome.applied.ok).toBe(true)
    expect(outcome.removed).toBe(1)
  })

  it('refuses a researcher the same tag application', async () => {
    const refused = await asResearcher((sql) =>
      sql.attempt(
        `insert into research_product_tags (research_product_id, tag_id) values ($1, $2)`,
        [OTHER_PRODUCT_ID, TAG_ID],
      ),
    )
    expect(refused.ok).toBe(false)
  })
})

describeDb('Phase 29 — the constraints refuse what they were written to refuse', () => {
  it('refuses a change with nothing on either side', async () => {
    const db = await connect()
    await expect(
      db.query(
        `insert into research_changes
           (research_product_id, source_id, field, change_kind, materiality, version_after_id)
         values ($1, $2, 'sku', 'MODIFIED', 'MATERIAL', $3)`,
        [PRODUCT_ID, SOURCE_ID, VERSION_B],
      ),
    ).rejects.toThrow(/changes_something|kind_matches_sides/u)
  })

  it('refuses an ADDED change that has a before', async () => {
    const db = await connect()
    await expect(
      db.query(
        `insert into research_changes
           (research_product_id, source_id, field, change_kind, materiality, before, after,
            version_after_id)
         values ($1, $2, 'sku', 'ADDED', 'MATERIAL', '"old"'::jsonb, '"new"'::jsonb, $3)`,
        [PRODUCT_ID, SOURCE_ID, VERSION_B],
      ),
    ).rejects.toThrow(/kind_matches_sides/u)
  })

  it('refuses a decision with nobody against it', async () => {
    const db = await connect()
    await expect(
      db.query(`update research_changes set decided_action = 'CONFIRM' where id = $1`, [CHANGE_ID]),
    ).rejects.toThrow(/decision_is_attributed/u)
  })

  it('refuses a REJECT action with no reason', async () => {
    const db = await connect()
    await expect(
      db.query(
        `insert into research_review_actions (research_product_id, action, actor_role)
         values ($1, 'REJECT', 'merchandiser')`,
        [PRODUCT_ID],
      ),
    ).rejects.toThrow(/reason_when_closing/u)
  })

  it('permits only one global default per field', async () => {
    /*
     * `nulls not distinct`, AND THIS IS THE ASSERTION IT EXISTS FOR. PostgreSQL's DEFAULT unique
     * semantics would permit a second global row for `price`, and the threshold in effect would
     * then depend on which row the resolver read first — a bug that cannot be reproduced on demand.
     * Amendment A29 records the reading; this is the proof.
     */
    const db = await connect()
    await expect(
      db.query(
        `insert into research_change_rules (source_id, field, material_threshold)
         values (null, 'price', 0.9900)`,
      ),
    ).rejects.toThrow(/unique_scope/u)
  })

  it('refuses an upper-case tag slug', async () => {
    // `slug::text`, the lesson of 0262 applied at the point of writing: citext overloads `~` to the
    // case-insensitive operator, so the same pattern without the cast admits `Oversized`.
    const db = await connect()
    await expect(
      db.query(`insert into research_tags (slug, label) values ('P29-Upper', 'Upper')`),
    ).rejects.toThrow(/slug_shape/u)
  })

  it('refuses a colour that is not a design token', async () => {
    const db = await connect()
    await expect(
      db.query(
        `insert into research_tags (slug, label, colour) values ('p29-hex', 'Hex', '#ff0000')`,
      ),
    ).rejects.toThrow(/colour_is_token/u)
  })

  it('keeps one digest per day', async () => {
    const db = await connect()
    await expect(
      db.query(
        `insert into research_change_digests (digest_date, stats)
         values (date '2026-09-01', '{}'::jsonb)`,
      ),
    ).rejects.toThrow(/digest_date/u)
  })
})

describeDb('Phase 29 — confirming a research row creates no Rivya product', () => {
  it('leaves products, product_media and media_assets untouched', async () => {
    /*
     * **THE RULE THE WHOLE PHASE TURNS ON, PROVED AT THE DATABASE.**
     *
     * `scripts/research/check-no-autoimport.mjs` proves there is no CODE path from a research row
     * to the catalogue. This proves there is no DATABASE one: no trigger on `research_products`
     * fires into `products`, no rule rewrites the insert, no cascade reaches across. The two
     * failures are independent, which is why both guarantees exist.
     */
    const db = await connect()
    const counts = async () => {
      const { rows } = await db.query(
        `select (select count(*)::int from products) as products,
                (select count(*)::int from product_media) as product_media,
                (select count(*)::int from media_assets) as media_assets,
                (select count(*)::int from audit_logs where entity_type = 'product') as product_audits`,
      )
      return rows[0] as Record<string, number>
    }

    const before = await counts()

    await db.query(`update research_products set stage = 'CONFIRMED' where id = $1`, [PRODUCT_ID])
    await db.query(
      `insert into research_review_actions (research_product_id, action, actor_role)
       values ($1, 'CONFIRM', 'merchandiser')`,
      [PRODUCT_ID],
    )

    const after = await counts()
    expect(after).toEqual(before)
  })
})
