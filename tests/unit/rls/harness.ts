import pg from 'pg'

/**
 * The RLS test harness.
 *
 * Every assertion runs inside a transaction that sets the request's JWT claims and switches to the
 * Postgres role PostgREST would switch to, then rolls back. That is exactly the shape of a real
 * request: PostgREST logs in as `authenticator`, verifies the JWT, and issues
 * `set local role <the role claim>` for the duration of that request's transaction.
 *
 * THREE WAYS THIS KIND OF TEST LIES, AND WHAT STOPS EACH
 * -----------------------------------------------------
 * 1. FORGETTING TO SWITCH ROLE. DATABASE_URL connects as `postgres`, which locally is a superuser
 *    AND the table owner — both bypass RLS unconditionally. A test that forgets `set local role`
 *    passes while proving nothing. Every helper here asserts `current_user` is the role it asked
 *    for, before running a single assertion, and throws if it is not.
 *
 * 2. MISSING GRANTS. On Supabase, `anon` and `authenticated` hold full DML on every table in
 *    `public` — GRANT is not the security boundary there, RLS is the whole of it. If the local
 *    shim omitted those grants, a denied query would fail with "permission denied for table"
 *    rather than returning zero rows, every deny assertion would pass, and a table that shipped
 *    with RLS switched off would look safe. supabase/local/00-auth-shim.sql reproduces the grants,
 *    and assertHarnessIsHonest() below proves the harness can still SEE a missing-RLS bug.
 *
 * 3. CONFUSING "NO ERROR" WITH "ALLOWED" ON UPDATE AND DELETE. An UPDATE whose USING clause matches
 *    no rows affects zero rows and SUCCEEDS — it does not raise. A test that only watches for
 *    exceptions reports every role as able to update everything. `affectedRows()` exists so the
 *    question asked is "how many rows did it touch", which is also what PostgREST turns into a
 *    204/404 rather than a 403.
 *
 * `set local` is used throughout and every block is rolled back, so nothing leaks between tests on
 * a pooled connection — a suite that leaks settings is green in one order and red in another.
 */

export type SessionRole = 'anon' | 'authenticated' | 'service_role'

export type Sql = {
  /** Run a query and return its rows. */
  rows: <T = Record<string, unknown>>(text: string, values?: unknown[]) => Promise<T[]>
  /** Run a statement and return how many rows it actually affected. */
  affectedRows: (text: string, values?: unknown[]) => Promise<number>
  /** Run a statement, returning whether it was refused outright rather than simply matching nothing. */
  attempt: (text: string, values?: unknown[]) => Promise<{ ok: boolean; error?: string }>
}

let client: pg.Client | null = null

/**
 * The key every RLS suite serialises on. Arbitrary, but fixed and shared.
 *
 * WHY A DATABASE LOCK RATHER THAN A RUNNER SETTING. `loadFixture` is not a private setup: it runs
 * `alter table … disable trigger`, which is committed DDL every other connection sees, and it
 * DELETEs and re-INSERTs the fixture rows outside any transaction. Two suites overlapping means one
 * file's wipe lands in the middle of another's assertions — a count that was 1 a moment ago reads 0,
 * and a guard that fired correctly reports a row it can no longer see.
 *
 * The obvious fix is to tell the runner not to overlap them, and the obvious fix does not hold.
 * `fileParallelism: false` inside a project is silently ignored; `maxWorkers: 1` on a project did
 * not isolate it either; and even with `fileParallelism` at the root the failures came back. Each of
 * those was tried, and each looked like it worked for a run or two — green runs were luck, not
 * evidence, and only a captured failure showed why.
 *
 * IT IS TAKEN ON CONNECT, NOT ON `loadFixture`, and that distinction is the whole of the second
 * bug. Taking it in `loadFixture` covered four of the five suites and missed
 * `phase08-render.test.tsx`, which builds its own page and sections rather than using the shared
 * fixture — so it never took the lock, and `phase08.test.ts` deleting every `page_sections` row
 * went on landing in the middle of it. Every suite connects; not every suite loads the fixture.
 * The first database touch is the honest place for it.
 *
 * This works because it does not depend on the runner at all. Whoever holds the lock owns the
 * database until they disconnect, whatever process they are in and however the files were
 * scheduled. Session-level, so a crashed worker releases it when its connection dies rather than
 * wedging the suite.
 */
const FIXTURE_LOCK = 918_273_645

/** Whether THIS module instance holds it. Advisory locks are re-entrant, so unlocks must match. */
let holdsFixtureLock = false

export async function connect(): Promise<pg.Client> {
  if (client) return client
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set — the RLS suite has nothing to assert against.')
  }
  client = new pg.Client({ connectionString })
  await client.connect()
  await client.query('select pg_advisory_lock($1)', [FIXTURE_LOCK])
  holdsFixtureLock = true
  return client
}

export async function disconnect(): Promise<void> {
  if (client) {
    // Released before the socket closes so the next waiter starts immediately rather than after
    // the server notices a dead connection.
    if (holdsFixtureLock) {
      await client.query('select pg_advisory_unlock($1)', [FIXTURE_LOCK])
      holdsFixtureLock = false
    }
    await client.end()
    client = null
  }
}

/** The claims PostgREST would put in `request.jwt.claims`. An anon key is itself a JWT, so the
 *  claims object is always SET — never absent. Simulating anon by setting nothing is wrong: it
 *  makes auth.role() null locally where it is 'anon' in production. */
function claimsFor(role: SessionRole, userId?: string): Record<string, unknown> {
  const base: Record<string, unknown> = {
    iss: 'https://local.test/auth/v1',
    aud: role === 'authenticated' ? 'authenticated' : 'local',
    role,
    // Fixed timestamps: the workflow runtime forbids Date.now(), and a test does not need real ones.
    iat: 1_757_000_000,
    exp: 1_757_003_600,
  }
  if (role === 'authenticated' && userId) {
    base.sub = userId
    base.aal = 'aal1'
    base.session_id = '11111111-1111-1111-1111-111111111111'
    base.is_anonymous = false
  }
  return base
}

/**
 * Run a block as a given role, inside a transaction that is always rolled back.
 *
 * Throws if the role switch did not take effect — see failure mode 1 in the header.
 */
export async function asSession<T>(
  role: SessionRole,
  userId: string | undefined,
  fn: (sql: Sql) => Promise<T>,
): Promise<T> {
  const db = await connect()
  await db.query('begin')
  try {
    await db.query('select set_config($1, $2, true)', [
      'request.jwt.claims',
      JSON.stringify(claimsFor(role, userId)),
    ])
    // The role name cannot be a bound parameter. It comes from a closed union, never from input.
    await db.query(`set local role ${role}`)

    const check = await db.query<{ current_user: string }>('select current_user')
    const actual = check.rows[0]?.current_user
    if (actual !== role) {
      throw new Error(
        `HARNESS BROKEN: expected to be running as "${role}" but current_user is "${actual}". ` +
          `Every assertion in this block would have run with RLS bypassed.`,
      )
    }

    const sql: Sql = {
      rows: async <R>(text: string, values?: unknown[]) => {
        const result = await db.query(text, values)
        return result.rows as R[]
      },
      affectedRows: async (text: string, values?: unknown[]) => {
        const result = await db.query(text, values)
        return result.rowCount ?? 0
      },
      attempt: async (text: string, values?: unknown[]) => {
        // A statement can fail for two very different reasons, and they must not be conflated:
        // a WITH CHECK violation is a refusal (PostgREST: 403), while matching no rows is not an
        // error at all. This reports only the first.
        try {
          await db.query('savepoint attempt')
          await db.query(text, values)
          await db.query('release savepoint attempt')
          return { ok: true }
        } catch (error) {
          await db.query('rollback to savepoint attempt')
          return { ok: false, error: error instanceof Error ? error.message : String(error) }
        }
      },
    }

    return await fn(sql)
  } finally {
    await db.query('rollback')
  }
}

export const asAnon = <T>(fn: (sql: Sql) => Promise<T>) => asSession('anon', undefined, fn)
export const asUser = <T>(userId: string, fn: (sql: Sql) => Promise<T>) =>
  asSession('authenticated', userId, fn)

/**
 * Prove the harness can still detect the bug it exists to detect.
 *
 * Creates a table with RLS switched OFF, confirms anon can read it, and drops it. If this ever
 * stops holding, the grants have gone missing and every deny assertion in the suite has become
 * vacuous — passing because of a missing GRANT that does not exist on Supabase, rather than
 * because a policy refused.
 *
 * A test suite that cannot fail is worse than no test suite, because it is believed.
 */
export async function assertHarnessIsHonest(): Promise<void> {
  const db = await connect()
  await db.query('create table if not exists rls_harness_canary (id int)')
  await db.query('truncate rls_harness_canary')
  await db.query('insert into rls_harness_canary values (1)')
  await db.query('grant all on rls_harness_canary to anon, authenticated, service_role')

  try {
    const visible = await asAnon(async (sql) => {
      const rows = await sql.rows<{ count: string }>(
        'select count(*)::text as count from rls_harness_canary',
      )
      return Number(rows[0]?.count ?? 0)
    })
    if (visible !== 1) {
      throw new Error(
        `HARNESS IS DISHONEST: a table with RLS disabled was NOT visible to anon (saw ${visible} rows). ` +
          `That means denials in this suite may be coming from missing GRANTs rather than from ` +
          `policies, and every "anon cannot see X" assertion is vacuous. Check the grants in ` +
          `supabase/local/00-auth-shim.sql.`,
      )
    }
  } finally {
    await db.query('drop table if exists rls_harness_canary')
  }
}

/** The six fixture users, one per role, plus a suspended one. Ids are fixed so tests can name them. */
export const FIXTURE_USERS = {
  owner: '00000000-0000-4000-8000-0000000000a1',
  admin: '00000000-0000-4000-8000-0000000000a2',
  editor: '00000000-0000-4000-8000-0000000000a3',
  merchandiser: '00000000-0000-4000-8000-0000000000a4',
  researcher: '00000000-0000-4000-8000-0000000000a5',
  viewer: '00000000-0000-4000-8000-0000000000a6',
  /** An ADMIN whose status is SUSPENDED — proves suspension is enforced by the database. */
  suspendedAdmin: '00000000-0000-4000-8000-0000000000a7',
} as const

export const FIXTURE_IDS = {
  publishedProduct: '00000000-0000-4000-8000-0000000000b1',
  draftProduct: '00000000-0000-4000-8000-0000000000b2',
  publishedCollection: '00000000-0000-4000-8000-0000000000b3',
  draftCollection: '00000000-0000-4000-8000-0000000000b4',
  publishedMaterial: '00000000-0000-4000-8000-0000000000b5',
  draftMaterial: '00000000-0000-4000-8000-0000000000b6',
  publishedAsset: '00000000-0000-4000-8000-0000000000b7',
  draftAsset: '00000000-0000-4000-8000-0000000000b8',
  /**
   * A CONCEPT render, attached to nothing.
   *
   * Added in Phase 14 with `reject_concept_product_media`. The two assets above used to be concept
   * renders and are no longer, because the trigger refuses one on a `product_media` row — so a
   * fixture that kept them concept could not be loaded at all. This one exists so the refusal has
   * something to refuse.
   */
  conceptAsset: '00000000-0000-4000-8000-0000000000b9',
} as const

/**
 * Load the fixture, as the service role (which bypasses RLS — it is how a migration or the seed
 * runner writes). Idempotent, so the suite can be re-run without a reset.
 */
export async function loadFixture(): Promise<void> {
  // `connect` already holds FIXTURE_LOCK, so this wipe cannot land inside another suite's run.
  const db = await connect()
  const u = FIXTURE_USERS
  const f = FIXTURE_IDS

  // The last-owner constraint trigger refuses any change leaving the project with no active owner
  // — including wiping the fixture, since one of these rows IS the owner. That rule is right in
  // production and wrong for a teardown, so the triggers come off for the wipe and go straight back
  // on. Without this the suite passes once on a fresh database and then fails on every later run,
  // reporting 62 SKIPPED — a security suite that stops running while still looking green.
  await db.query('alter table staff_profiles disable trigger staff_profiles_last_owner_update')
  await db.query('alter table staff_profiles disable trigger staff_profiles_last_owner_delete')
  try {
    await db.query('delete from staff_profiles where user_id = any($1::uuid[])', [Object.values(u)])
    // `content_revisions.created_by` references auth.users with no ON DELETE action, and the table
    // is append-only by design — nothing ever removes a revision in production. So any suite that
    // attributes a write to a fixture user (an editor saving a section, say) leaves a row that
    // makes the NEXT loadFixture() fail on a foreign key, in a different file, for a reason that
    // has nothing to do with what that file is testing. Detaching them rather than deleting keeps
    // the trail intact and lets the user go.
    await db.query(
      'update content_revisions set created_by = null where created_by = any($1::uuid[])',
      [Object.values(u)],
    )
    await db.query('delete from auth.users where id = any($1::uuid[])', [Object.values(u)])
  } finally {
    await db.query('alter table staff_profiles enable trigger staff_profiles_last_owner_update')
    await db.query('alter table staff_profiles enable trigger staff_profiles_last_owner_delete')
  }

  await db.query(
    `insert into auth.users (id, email) values
       ($1,'owner@rls.test'), ($2,'admin@rls.test'), ($3,'editor@rls.test'),
       ($4,'merch@rls.test'), ($5,'research@rls.test'), ($6,'viewer@rls.test'),
       ($7,'suspended@rls.test')`,
    Object.values(u),
  )

  // The trigger created each profile as INVITED/viewer. Elevating is the invite-then-promote path.
  const set = async (id: string, role: string, status: string) =>
    db.query('update staff_profiles set role = $2::user_role, status = $3 where user_id = $1', [
      id,
      role,
      status,
    ])
  await set(u.owner, 'owner', 'ACTIVE')
  await set(u.admin, 'admin', 'ACTIVE')
  await set(u.editor, 'editor', 'ACTIVE')
  await set(u.merchandiser, 'merchandiser', 'ACTIVE')
  await set(u.researcher, 'researcher', 'ACTIVE')
  await set(u.viewer, 'viewer', 'ACTIVE')
  await set(u.suspendedAdmin, 'admin', 'SUSPENDED')

  await db.query('delete from product_collections')
  await db.query('delete from product_materials')
  await db.query('delete from product_media')
  // Before the products, since the cascade would take these anyway — being explicit keeps the wipe
  // readable as a list of what this fixture owns.
  await db.query('delete from product_specs')
  await db.query('delete from product_relations')
  await db.query('delete from products where id = any($1::uuid[])', [
    [f.publishedProduct, f.draftProduct],
  ])
  await db.query('delete from collections where id = any($1::uuid[])', [
    [f.publishedCollection, f.draftCollection],
  ])
  await db.query('delete from materials where id = any($1::uuid[])', [
    [f.publishedMaterial, f.draftMaterial],
  ])
  await db.query('delete from media_assets where id = any($1::uuid[])', [
    [f.publishedAsset, f.draftAsset, f.conceptAsset],
  ])

  await db.query(
    `insert into products (id, slug, title, price_state, status) values
       ($1,'rls-published','Published','REQUEST_QUOTE','PUBLISHED'),
       ($2,'rls-draft','Draft','REQUEST_QUOTE','DRAFT')`,
    [f.publishedProduct, f.draftProduct],
  )
  /**
   * THE PUBLISHED COLLECTION IS ALSO OWNER_CONFIRMED, and it has to be as of Phase 16.
   *
   * This fixture used to insert a PUBLISHED collection with the default
   * `concept_state = DRAFT_COLLECTION_CONCEPT`, and `enforce_collection_publish_gate` now refuses
   * that row outright. The gate is right and the fixture was wrong: FEAT §9 says a collection is a
   * CONCEPT until the owner confirms it is real, so "published but unconfirmed" was a state the
   * business does not have, and five suites were resting on it.
   *
   * The draft collection stays a plain concept, which is what every seeded collection is.
   */
  await db.query(
    `insert into collections (id, slug, name, status, concept_state) values
       ($1,'rls-pub-coll','Published Collection','PUBLISHED','OWNER_CONFIRMED'),
       ($2,'rls-drf-coll','Draft Collection','DRAFT','DRAFT_COLLECTION_CONCEPT')`,
    [f.publishedCollection, f.draftCollection],
  )
  await db.query(
    `insert into materials (id, slug, name, family, status) values
       ($1,'rls-pub-mat','Published Material','resin','PUBLISHED'),
       ($2,'rls-drf-mat','Draft Material','timber','DRAFT')`,
    [f.publishedMaterial, f.draftMaterial],
  )
  // `source` is stated rather than defaulted because 0030 gives the column no default: an insert
  // that omits it fails outright. FALLBACK is the honest value for a synthetic fixture — it is not
  // real Rivya media, not a user upload, not a Higgsfield asset and not a render.
  //
  // `is_concept` IS FALSE ON THE TWO PRODUCT ASSETS, and that changed in Phase 14. Both were
  // concept renders until `reject_concept_product_media` made that combination impossible: a
  // concept asset may illustrate a material or a process, never a product (D6, D10). The join rows
  // below attach these two to products, so a fixture that kept them concept would fail to load.
  // `conceptAsset` carries the flag instead, attached to nothing, for the test that proves the
  // refusal.
  await db.query(
    `insert into media_assets (id, resource_type, public_id, folder, kind, alt_text,
                               is_ai_generated, is_concept, status, source) values
       ($1,'image','rls-pub','rivya/test','IMAGE','published asset',true,false,'PUBLISHED','FALLBACK'),
       ($2,'image','rls-drf','rivya/test','IMAGE','draft asset',true,false,'DRAFT','FALLBACK'),
       ($3,'image','rls-concept','rivya/test','IMAGE','concept render',true,true,'PUBLISHED','FALLBACK')`,
    [f.publishedAsset, f.draftAsset, f.conceptAsset],
  )

  // Join rows covering every combination the Shape B policies must distinguish.
  await db.query(
    `insert into product_media (product_id, media_asset_id, role) values
       ($1,$3,'hero'), ($2,$4,'hero')`,
    [f.publishedProduct, f.draftProduct, f.publishedAsset, f.draftAsset],
  )
  await db.query(
    `insert into product_collections (product_id, collection_id) values
       ($1,$3), ($1,$4), ($2,$3)`,
    [f.publishedProduct, f.draftProduct, f.publishedCollection, f.draftCollection],
  )
  await db.query(
    `insert into product_materials (product_id, material_id) values
       ($1,$3), ($1,$4), ($2,$3)`,
    [f.publishedProduct, f.draftProduct, f.publishedMaterial, f.draftMaterial],
  )

  /**
   * Phase 15 specification rows, covering the three cases the policy must tell apart.
   *
   * WRITTEN HERE RATHER THAN IN THE TEST, because `asSession` rolls its transaction back — a row
   * inserted as the owner is invisible to the anonymous read that follows, so a cross-role
   * assertion can only be made against rows the fixture committed. That is not a limitation to
   * work around: it is what keeps one suite's writes out of another's assertions.
   *
   * The third row is the one worth naming: PUBLISHED itself, on a DRAFT product. If the policy
   * tested only the spec's own status, a draft piece's dimensions would be public before the piece
   * was.
   */
  await db.query(
    `insert into product_specs (product_id, label, value, unit, sort_order, status) values
       ($1,'Published fact','yes',null,0,'PUBLISHED'),
       ($1,'Draft fact','no',null,1,'DRAFT'),
       ($2,'Leaked fact','yes',null,0,'PUBLISHED')`,
    [f.publishedProduct, f.draftProduct],
  )
}
