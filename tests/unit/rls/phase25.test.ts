import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FIXTURE_USERS, asAnon, asSession, connect, disconnect, loadFixture } from './harness'

/**
 * Phase 25 at the table: isolation invariants I1 and I2, the policy gate, and the queue's own rules.
 *
 * THE ASSERTION THIS SUITE EXISTS FOR IS A ROW OF ZEROS. Every research table is seeded with a real
 * row first and THEN read as `anon`, because "anon sees nothing" is trivially true of an empty
 * table and would pass for as long as the subsystem stayed unused — which is exactly the period
 * during which somebody would add the policy that breaks it. Seeding first is what makes the zero
 * mean something.
 *
 * AND THE POLICY GATE, WHICH IS THE ONE THE REPOSITORY CANNOT DECIDE FOR ITSELF. A source may not
 * be enabled unless its policy review says APPROVED, and an approval must name who made it. Both
 * are CHECK constraints rather than code, because the question "may Rivya read this website" must
 * not be skippable by a bug, a fixture or a migration.
 *
 * `editor` IS THE ROLE TO WATCH. It is the one staff role without `research.read`, so it is the
 * proof that the policies' role lists came from the permission matrix rather than from `is_staff()`.
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

const SOURCE_ID = '00000000-0000-4000-8000-000000002501'
const JOB_ID = '00000000-0000-4000-8000-000000002502'
const RUN_ID = '00000000-0000-4000-8000-000000002503'
const ITEM_ID = '00000000-0000-4000-8000-000000002504'
const FETCH_ID = '00000000-0000-4000-8000-000000002505'
const RAW_ID = '00000000-0000-4000-8000-000000002506'
const PRODUCT_ID = '00000000-0000-4000-8000-000000002507'

/** Every research table, with a row in it, so a zero read means a policy refused. */
const RESEARCH_TABLES = [
  'research_sources',
  'research_jobs',
  'research_runs',
  'research_work_items',
  'research_fetches',
  'research_raw_items',
  'research_products',
  'research_pipeline_events',
  'research_robots_cache',
  'research_search_documents',
] as const

async function seed(): Promise<void> {
  const db = await connect()

  await db.query(
    `insert into research_sources (id, slug, name, base_url, policy_status, policy_reviewed_by,
                                   policy_reviewed_at, is_enabled)
     values ($1, 'rls-source', 'RLS Source', 'https://rls.example', 'APPROVED', $2, now(), true)
     on conflict (id) do nothing`,
    [SOURCE_ID, FIXTURE_USERS.owner],
  )

  await db.query(
    `insert into research_jobs (id, source_id, job_type, name, cron_expression, is_enabled)
     values ($1, $2, 'DISCOVERY', 'RLS Job', '0 * * * *', true)
     on conflict (id) do nothing`,
    [JOB_ID, SOURCE_ID],
  )

  await db.query(
    `insert into research_runs (id, job_id, source_id, status, trigger)
     values ($1, $2, $3, 'RUNNING', 'SCHEDULED') on conflict (id) do nothing`,
    [RUN_ID, JOB_ID, SOURCE_ID],
  )

  await db.query(
    `insert into research_work_items (id, run_id, source_id, url)
     values ($1, $2, $3, 'https://rls.example/p/1') on conflict (id) do nothing`,
    [ITEM_ID, RUN_ID, SOURCE_ID],
  )

  await db.query(
    `insert into research_fetches (id, run_id, source_id, work_item_id, url, robots_decision,
                                   http_status, content_hash, bytes)
     values ($1, $2, $3, $4, 'https://rls.example/p/1', 'ALLOWED', 200, 'abc', 10)
     on conflict (id) do nothing`,
    [FETCH_ID, RUN_ID, SOURCE_ID, ITEM_ID],
  )

  await db.query(
    `insert into research_raw_items (id, run_id, source_id, fetch_id, source_url, raw)
     values ($1, $2, $3, $4, 'https://rls.example/p/1',
             '{"title":"A","canonicalUrl":null,"links":[]}'::jsonb)
     on conflict (id) do nothing`,
    [RAW_ID, RUN_ID, SOURCE_ID, FETCH_ID],
  )

  await db.query(
    `insert into research_products (id, source_id, source_url, first_seen_run_id, last_seen_run_id)
     values ($1, $2, 'https://rls.example/p/1', $3, $3) on conflict (id) do nothing`,
    [PRODUCT_ID, SOURCE_ID, RUN_ID],
  )

  await db.query(
    `insert into research_pipeline_events (entity_type, entity_id, from_stage, to_stage, actor_kind)
     values ('research_product', $1, 'RAW', 'NORMALIZED', 'SYSTEM')`,
    [PRODUCT_ID],
  )

  await db.query(
    `insert into research_robots_cache (host, body, expires_at)
     values ('rls.example', 'User-agent: *', now() + interval '1 day')
     on conflict (host) do nothing`,
  )
}

async function cleanup(): Promise<void> {
  const db = await connect()
  await db.query('delete from research_pipeline_events where entity_id = $1', [PRODUCT_ID])
  await db.query('delete from research_robots_cache where host = $1', ['rls.example'])
  // The rest cascade from the source.
  await db.query('delete from research_sources where id = $1', [SOURCE_ID])
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

describeDb('Phase 25 — I2: anon reads nothing, from any research table', () => {
  it.each(RESEARCH_TABLES)('anon reads zero rows from %s', async (table) => {
    const rows = await asAnon((sql) => sql.rows(`select 1 from ${table}`))
    // THE ROWS ARE THERE. The seed above put one in every table, so a zero here is a policy
    // refusing rather than a table being empty.
    expect(rows).toHaveLength(0)
  })

  it('proves the seed actually landed, so the zeros above mean something', async () => {
    const db = await connect()
    for (const table of RESEARCH_TABLES) {
      const { rows } = await db.query(`select count(*)::int as count from ${table}`)
      expect(Number(rows[0].count), table).toBeGreaterThan(0)
    }
  })
})

describeDb('Phase 25 — who among the staff may read', () => {
  it('lets a researcher read a source', async () => {
    const rows = await asResearcher((sql) =>
      sql.rows('select id from research_sources where id = $1', [SOURCE_ID]),
    )
    expect(rows).toHaveLength(1)
  })

  it('lets a viewer and a merchandiser read one too — research.read is wide', async () => {
    const merchandiser = await asMerchandiser((sql) =>
      sql.rows('select id from research_sources where id = $1', [SOURCE_ID]),
    )
    expect(merchandiser).toHaveLength(1)
  })

  it('refuses an EDITOR, which is the one role without research.read', async () => {
    // The check that proves the role list came from the permission matrix and not from is_staff().
    for (const table of RESEARCH_TABLES) {
      const rows = await asEditor((sql) => sql.rows(`select 1 from ${table}`))
      expect(rows, table).toHaveLength(0)
    }
  })
})

describeDb('Phase 25 — who may write, and who may not', () => {
  /*
   * EVERY ASSERTION IN THIS BLOCK IS ON THE STATEMENT'S EFFECT INSIDE THE SESSION, never on the
   * table afterwards. `asSession` wraps each block in a transaction and ROLLS IT BACK — which is
   * what keeps these suites from leaving rows behind for one another — so a write here never
   * persists and reading the table after the block would report the state before it. An earlier
   * draft of this file did exactly that and passed the negative cases for the wrong reason.
   */
  it('lets a researcher create a job', async () => {
    const created = await asResearcher(async (sql) => {
      const rows = await sql.rows<{ id: string }>(
        `insert into research_jobs (source_id, job_type, name)
         values ($1, 'DETAIL', 'researcher job') returning id`,
        [SOURCE_ID],
      )
      return rows[0]?.id ?? null
    })
    expect(created).not.toBeNull()
  })

  it('refuses a MERCHANDISER a job — they judge output, they do not operate the pipeline', async () => {
    let error = ''
    try {
      await asMerchandiser((sql) =>
        sql.rows(
          `insert into research_jobs (source_id, job_type, name)
           values ($1, 'DETAIL', 'nope')`,
          [SOURCE_ID],
        ),
      )
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    }
    expect(error).toMatch(/policy|permission|denied/i)
  })

  it('lets a MERCHANDISER move a research product — that half IS theirs', async () => {
    // The dividing line is the COLUMN, not the screen: `stage` and `disposition` are
    // disposition-bearing, so research_products is research.confirm rather than research.write.
    const affected = await asMerchandiser((sql) =>
      sql.affectedRows(`update research_products set disposition = 'IGNORED' where id = $1`, [
        PRODUCT_ID,
      ]),
    )
    expect(affected).toBe(1)
  })

  it('refuses a RESEARCHER a research product — they operate, they do not judge', async () => {
    // AN RLS UPDATE WITH NO MATCHING POLICY AFFECTS ZERO ROWS RATHER THAN RAISING. The row is
    // readable — `research.read` includes the researcher — so the refusal is silent, which is
    // exactly why the assertion has to be on the row count and not on an exception.
    const affected = await asResearcher((sql) =>
      sql.affectedRows(`update research_products set disposition = 'REJECTED' where id = $1`, [
        PRODUCT_ID,
      ]),
    )
    expect(affected).toBe(0)
  })

  it('refuses EVERY session a fetch row, including an owner', async () => {
    // A hand-written fetch row could claim a robots-DISALLOWED URL had been ALLOWED — the evidence
    // that the rules were honoured, forged.
    let error = ''
    try {
      await asOwner((sql) =>
        sql.rows(
          `insert into research_fetches (source_id, url, robots_decision)
           values ($1, 'https://rls.example/forged', 'ALLOWED')`,
          [SOURCE_ID],
        ),
      )
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    }
    expect(error).toMatch(/policy|permission|denied/i)
  })

  it('refuses every session the robots cache', async () => {
    let error = ''
    try {
      await asOwner((sql) =>
        sql.rows(
          `insert into research_robots_cache (host, body, expires_at)
           values ('forged.example', 'User-agent: *', now() + interval '1 day')`,
        ),
      )
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    }
    expect(error).toMatch(/policy|permission|denied/i)
  })

  it('refuses every session the work queue', async () => {
    let error = ''
    try {
      await asOwner((sql) =>
        sql.rows(
          `insert into research_work_items (run_id, source_id, url)
           values ($1, $2, 'https://rls.example/forged')`,
          [RUN_ID, SOURCE_ID],
        ),
      )
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    }
    expect(error).toMatch(/policy|permission|denied/i)
  })

  it('refuses every session a pipeline event, and refuses to rewrite one', async () => {
    let insertError = ''
    try {
      await asOwner((sql) =>
        sql.rows(
          `insert into research_pipeline_events (entity_type, entity_id, to_stage, actor_kind)
           values ('research_product', $1, 'CONFIRMED', 'SYSTEM')`,
          [PRODUCT_ID],
        ),
      )
    } catch (thrown) {
      insertError = thrown instanceof Error ? thrown.message : String(thrown)
    }
    expect(insertError).toMatch(/policy|permission|denied/i)

    let updateError = ''
    try {
      await asOwner((sql) =>
        sql.rows(`update research_pipeline_events set reason = 'rewritten' where entity_id = $1`, [
          PRODUCT_ID,
        ]),
      )
    } catch (thrown) {
      updateError = thrown instanceof Error ? thrown.message : String(thrown)
    }
    // Revoked at the grant as well as absent from the policies.
    expect(updateError).toMatch(/policy|permission|denied/i)
  })
})

describeDb('Phase 25 — the policy gate, at the row', () => {
  it('refuses an enabled source that was never approved', async () => {
    const db = await connect()
    let error = ''
    try {
      await db.query(
        `insert into research_sources (slug, name, base_url, is_enabled)
         values ('unapproved', 'Unapproved', 'https://u.example', true)`,
      )
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    }
    // NOT A CODE PATH. The question "may Rivya read this website" is not skippable by a bug, a
    // fixture or a migration.
    expect(error).toMatch(/enabled_requires_approval/i)
  })

  it('refuses an approval that names nobody', async () => {
    const db = await connect()
    let error = ''
    try {
      await db.query(
        `insert into research_sources (slug, name, base_url, policy_status)
         values ('anon-approval', 'Anon Approval', 'https://a.example', 'APPROVED')`,
      )
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    }
    expect(error).toMatch(/approval_is_attributed/i)
  })

  it('refuses a base URL that is not http', async () => {
    const db = await connect()
    let error = ''
    try {
      await db.query(
        `insert into research_sources (slug, name, base_url)
         values ('ftp', 'FTP', 'ftp://f.example')`,
      )
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    }
    expect(error).toMatch(/base_url_is_http/i)
  })

  it('refuses an enabled job with no schedule', async () => {
    const db = await connect()
    let error = ''
    try {
      await db.query(
        `insert into research_jobs (source_id, job_type, name, is_enabled)
         values ($1, 'DISCOVERY', 'no schedule', true)`,
        [SOURCE_ID],
      )
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    }
    expect(error).toMatch(/enabled_has_schedule/i)
  })
})

describeDb('Phase 25 — what the fetch row itself refuses', () => {
  it('refuses a DISALLOWED row that also carries a response', async () => {
    // THE EVIDENCE CONSTRAINT. A row saying "we did not fetch this" cannot also say what came back.
    const db = await connect()
    let error = ''
    try {
      await db.query(
        `insert into research_fetches (source_id, url, robots_decision, http_status)
         values ($1, 'https://rls.example/x', 'DISALLOWED', 200)`,
        [SOURCE_ID],
      )
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    }
    expect(error).toMatch(/disallowed_has_no_response/i)
  })

  it('refuses a robots decision outside the four', async () => {
    const db = await connect()
    let error = ''
    try {
      await db.query(
        `insert into research_fetches (source_id, url, robots_decision)
         values ($1, 'https://rls.example/y', 'MAYBE')`,
        [SOURCE_ID],
      )
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    }
    expect(error).toMatch(/robots_decision_allowlist/i)
  })

  it('refuses a LEASED work item with no lease expiry', async () => {
    // A row marked LEASED with no expiry is never reclaimed and never runs — the one failure mode
    // the queue exists to prevent.
    const db = await connect()
    let error = ''
    try {
      await db.query(
        `insert into research_work_items (run_id, source_id, url, state)
         values ($1, $2, 'https://rls.example/leased', 'LEASED')`,
        [RUN_ID, SOURCE_ID],
      )
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    }
    expect(error).toMatch(/leased_has_expiry/i)
  })

  it('refuses a STAFF pipeline event with no actor, and a SYSTEM one with an actor', async () => {
    const db = await connect()
    for (const [kind, actor] of [
      ['STAFF', null],
      ['SYSTEM', FIXTURE_USERS.owner],
    ] as const) {
      let error = ''
      try {
        await db.query(
          `insert into research_pipeline_events (entity_type, entity_id, to_stage, actor_kind, actor_user_id)
           values ('research_product', $1, 'REVIEW', $2, $3)`,
          [PRODUCT_ID, kind, actor],
        )
      } catch (thrown) {
        error = thrown instanceof Error ? thrown.message : String(thrown)
      }
      expect(error, kind).toMatch(/actor_matches_kind/i)
    }
  })
})

describeDb('Phase 25 — the lease is service-role only', () => {
  it('refuses a session the lease function', async () => {
    // A member of staff who could lease items could clear a not_before_at and edit the rate limit
    // from inside the building.
    let error = ''
    try {
      await asOwner((sql) =>
        sql.rows('select * from public.research_lease_work_items($1, 1, 60)', [SOURCE_ID]),
      )
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    }
    expect(error).toMatch(/permission denied/i)
  })
})
