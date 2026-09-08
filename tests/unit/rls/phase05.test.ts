// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ROLES } from '../../../lib/auth/permissions'
import {
  asAnon,
  asUser,
  assertHarnessIsHonest,
  connect,
  disconnect,
  FIXTURE_USERS,
  loadFixture,
} from './harness'

/**
 * `activity_events` and `studio_preferences`, per role, against a real PostgreSQL.
 *
 * WHY THIS FILE REPLACES THE PHASE DOCUMENT'S VERIFICATION STEP 7. That step says:
 *
 *     psql -c "select count(*) from activity_events" as the anon role — expect a permission error,
 *     proving RLS.
 *
 * There is no permission error. RLS denial is ZERO ROWS, not an exception — the grant is present
 * (Supabase grants `anon` full DML on every table in `public`), and the policy simply matches
 * nothing. Run as written, the step returns `0` and someone has to decide whether that counts.
 *
 * Worse, `0` on an empty table is the same `0`. So the step as written is satisfied identically by
 * a correctly-locked table, an empty table, and a table with RLS switched off — which is the
 * vacuous pass this project has already been bitten by once.
 *
 * Every test below therefore SEEDS A ROW FIRST and proves the owner can see it. Only then does a
 * role seeing zero mean it was refused.
 *
 * WHAT `auth:check-rls` CANNOT CATCH, AND THIS FILE CAN. That gate compares each policy's GRANTEE
 * ROLE LIST against the permission matrix. `studio_preferences`' security is not in its role list —
 * every role is on it — but in the `user_id = auth.uid()` predicate ANDed onto every policy. Drop
 * that scope while leaving the role list intact and the gate still passes; two tests here fail.
 * Verified by doing exactly that against the live database before this file was committed. The two
 * checks are complementary, and neither is sufficient.
 */

const REQUIRE_DB = process.env.CI === 'true' || process.env.RLS_TESTS_REQUIRED === '1'
const HAVE_DB = Boolean(process.env.DATABASE_URL)

if (REQUIRE_DB && !HAVE_DB) {
  throw new Error('DATABASE_URL is not set and this environment requires the RLS suite to run.')
}

const describeDb = HAVE_DB ? describe : describe.skip

const EVENT_ID = '00000000-0000-4000-8000-0000000000c1'
const PREF_OWNER = '00000000-0000-4000-8000-0000000000c2'
const PREF_EDITOR = '00000000-0000-4000-8000-0000000000c3'

describeDb('activity_events and studio_preferences', () => {
  beforeAll(async () => {
    await loadFixture()
    await assertHarnessIsHonest()

    const db = await connect()
    // Seeded as the table owner, which bypasses RLS — exactly how logActivity's service-role client
    // and a migration write. Without this row every "sees 0" assertion below would be vacuous.
    await db.query('delete from activity_events where id = $1', [EVENT_ID])
    await db.query(
      `insert into activity_events (id, actor_id, actor_role, action, entity_type, entity_label, summary)
       values ($1, $2, 'admin', 'staff.role-changed', 'staff profile', 'A Person', 'changed a role')`,
      [EVENT_ID, FIXTURE_USERS.admin],
    )

    await db.query('delete from studio_preferences where id = any($1::uuid[])', [
      [PREF_OWNER, PREF_EDITOR],
    ])
    await db.query(
      `insert into studio_preferences (id, user_id, sidebar_collapsed) values ($1,$2,true), ($3,$4,false)`,
      [PREF_OWNER, FIXTURE_USERS.owner, PREF_EDITOR, FIXTURE_USERS.editor],
    )
  })

  afterAll(async () => {
    const db = await connect()
    await db.query('delete from activity_events where id = $1', [EVENT_ID])
    await db.query('delete from studio_preferences where id = any($1::uuid[])', [
      [PREF_OWNER, PREF_EDITOR],
    ])
    await disconnect()
  })

  describe('activity_events — the feed', () => {
    it('is genuinely populated, so every "sees 0" below means refused', async () => {
      // The guard against a vacuous suite. If this is 0, nothing else in this file proves anything.
      const db = await connect()
      const { rows } = await db.query(
        'select count(*)::int as n from activity_events where id = $1',
        [EVENT_ID],
      )
      expect(rows[0]?.n).toBe(1)
    })

    it('is invisible to anon', async () => {
      const seen = await asAnon((sql) =>
        sql.rows<{ n: number }>('select count(*)::int as n from activity_events'),
      )
      expect(seen[0]?.n).toBe(0)
    })

    it('is visible to every one of the six staff roles', async () => {
      // activity.read is held by all six deliberately: the Activity tab is on the Overview page
      // that every role lands on.
      for (const role of ROLES) {
        const seen = await asUser(FIXTURE_USERS[role], (sql) =>
          sql.rows<{ n: number }>('select count(*)::int as n from activity_events where id = $1', [
            EVENT_ID,
          ]),
        )
        expect(seen[0]?.n, `${role} cannot see the activity feed`).toBe(1)
      }
    })

    it('is invisible to a SUSPENDED staff member', async () => {
      // Suspension is enforced in the database, not only by the session resolver.
      const seen = await asUser(FIXTURE_USERS.suspendedAdmin, (sql) =>
        sql.rows<{ n: number }>('select count(*)::int as n from activity_events'),
      )
      expect(seen[0]?.n).toBe(0)
    })

    it('refuses an INSERT from a staff member, so the feed cannot be forged', async () => {
      // The sharp case: the feed is readable by EVERY role, so a staff member who could insert
      // could write "editor published X" naming a colleague into the record colleagues read.
      const outcome = await asUser(FIXTURE_USERS.owner, (sql) =>
        sql.attempt("insert into activity_events (action) values ('forged.event')"),
      )
      expect(outcome.ok).toBe(false)
      expect(outcome.error).toMatch(/row-level security/i)
    })

    it('refuses an UPDATE and a DELETE at the privilege level', async () => {
      // Revoked, not merely unpolicied: a policy can be added by anyone who can write a migration.
      for (const statement of [
        "update activity_events set summary = 'rewritten'",
        'delete from activity_events',
      ]) {
        const outcome = await asUser(FIXTURE_USERS.owner, (sql) => sql.attempt(statement))
        expect(outcome.ok, statement).toBe(false)
        expect(outcome.error, statement).toMatch(/permission denied/i)
      }
    })
  })

  describe('studio_preferences — one row per person, and only their own', () => {
    it('is genuinely populated', async () => {
      const db = await connect()
      const { rows } = await db.query('select count(*)::int as n from studio_preferences')
      expect(rows[0]?.n).toBeGreaterThanOrEqual(2)
    })

    it('lets a staff member read their OWN row', async () => {
      const seen = await asUser(FIXTURE_USERS.owner, (sql) =>
        sql.rows<{ n: number }>('select count(*)::int as n from studio_preferences'),
      )
      expect(seen[0]?.n).toBe(1)
    })

    it("never lets one staff member read another's", async () => {
      // THE WHOLE POINT OF THE OWNER SCOPE. Both permissions are held by all six roles, so the
      // role list grants nothing useful — `user_id = auth.uid()` is what carries the security.
      const seen = await asUser(FIXTURE_USERS.owner, (sql) =>
        sql.rows<{ n: number }>('select count(*)::int as n from studio_preferences where id = $1', [
          PREF_EDITOR,
        ]),
      )
      expect(seen[0]?.n).toBe(0)
    })

    it("never lets one staff member OVERWRITE another's", async () => {
      // The danger an extra SELECT policy would not have addressed. An UPDATE matching no rows
      // SUCCEEDS and affects nothing, so the assertion is on the row count, not on a throw.
      const affected = await asUser(FIXTURE_USERS.owner, (sql) =>
        sql.affectedRows('update studio_preferences set sidebar_collapsed = true where id = $1', [
          PREF_EDITOR,
        ]),
      )
      // ZERO ROWS, NOT AN ERROR. An UPDATE whose USING clause matches nothing SUCCEEDS and changes
      // nothing, so asserting "it threw" would fail and asserting "no error" would pass whether or
      // not the row was protected. The affected-row count is the only honest assertion here — the
      // same trap that made a Phase 04 write-matrix report every role able to update everything.
      expect(affected).toBe(0)

      const db = await connect()
      const { rows } = await db.query(
        'select sidebar_collapsed from studio_preferences where id = $1',
        [PREF_EDITOR],
      )
      expect(rows[0]?.sidebar_collapsed, "the editor's row was overwritten").toBe(false)
    })

    it('is invisible to anon', async () => {
      const seen = await asAnon((sql) =>
        sql.rows<{ n: number }>('select count(*)::int as n from studio_preferences'),
      )
      expect(seen[0]?.n).toBe(0)
    })

    it('refuses an insert for somebody else', async () => {
      const outcome = await asUser(FIXTURE_USERS.owner, (sql) =>
        sql.attempt('insert into studio_preferences (user_id) values ($1)', [FIXTURE_USERS.editor]),
      )
      expect(outcome.ok).toBe(false)
      expect(outcome.error).toMatch(/row-level security/i)
    })
  })
})
