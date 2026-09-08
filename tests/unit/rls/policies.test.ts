// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PERMISSION_ROLES, ROLES, type Role } from '../../../lib/auth/permissions'
import {
  asAnon,
  asUser,
  assertHarnessIsHonest,
  connect,
  disconnect,
  FIXTURE_IDS,
  FIXTURE_USERS,
  loadFixture,
} from './harness'

/**
 * What the database does, per role — asserted against a real PostgreSQL, not a mock.
 *
 * These are the tests the phase exists for. RLS is the layer that still holds when a
 * requirePermission() call is forgotten, when a query reaches the database by an unexpected route,
 * or when the anon key leaks. If it is wrong, nothing above it can compensate.
 *
 * The expectations are derived from lib/auth/permissions.ts rather than written out again. A test
 * that restates the matrix by hand only proves the two hand-written copies agree; deriving means a
 * changed cell changes the test, and a policy that no longer matches the matrix fails here.
 */

const REQUIRE_DB = process.env.CI === 'true' || process.env.RLS_TESTS_REQUIRED === '1'
const HAVE_DB = Boolean(process.env.DATABASE_URL)

// A silently skipped security suite is the same failure as a vacuous one: green, and meaningless.
// In CI the absence of a database is a hard failure rather than a skip.
if (REQUIRE_DB && !HAVE_DB) {
  throw new Error(
    'DATABASE_URL is not set and this environment requires the RLS suite to run. ' +
      'Refusing to skip: a skipped RLS suite reports success while proving nothing.',
  )
}

const describeDb = HAVE_DB ? describe : describe.skip

describeDb('RLS policies', () => {
  beforeAll(async () => {
    await connect()
    // Before anything else: prove this harness can still see a missing-RLS bug.
    await assertHarnessIsHonest()
    await loadFixture()
  }, 60_000)

  afterAll(async () => {
    await disconnect()
  })

  // ---------------------------------------------------------------------------------------------
  describe('the anonymous visitor', () => {
    it('sees published content rows and nothing else', async () => {
      await asAnon(async (sql) => {
        for (const table of ['products', 'collections', 'materials', 'media_assets'] as const) {
          const rows = await sql.rows<{ status: string }>(`select status from ${table}`)
          expect(rows.length, `${table} row count`).toBeGreaterThan(0)
          expect(
            rows.every((r) => r.status === 'PUBLISHED'),
            `${table} exposed a non-published row to anon`,
          ).toBe(true)
        }
      })
    })

    it('cannot see staff tables at all', async () => {
      await asAnon(async (sql) => {
        for (const table of ['staff_profiles', 'audit_logs', 'content_seed_runs'] as const) {
          const rows = await sql.rows(`select * from ${table}`)
          expect(rows, `${table} leaked to anon`).toHaveLength(0)
        }
      })
    })

    it('cannot insert', async () => {
      await asAnon(async (sql) => {
        const result = await sql.attempt(
          `insert into products (slug, title, price_state) values ('anon-insert','x','REQUEST_QUOTE')`,
        )
        expect(result.ok).toBe(false)
        expect(result.error).toMatch(/row-level security/i)
      })
    })

    it('cannot update or delete a published row', async () => {
      // Not "does it raise" — an UPDATE whose USING clause matches nothing succeeds and affects
      // zero rows. Zero is the denial.
      await asAnon(async (sql) => {
        expect(
          await sql.affectedRows(
            `update products set title = 'hijacked' where status = 'PUBLISHED'`,
          ),
        ).toBe(0)
        expect(await sql.affectedRows(`delete from products where status = 'PUBLISHED'`)).toBe(0)
      })
    })
  })

  // ---------------------------------------------------------------------------------------------
  describe('per-role read access, derived from the permission matrix', () => {
    // catalog.read and media.read are held by all six, so every role sees drafts too.
    for (const role of ROLES) {
      it(`${role} sees both published and draft catalogue rows`, async () => {
        await asUser(FIXTURE_USERS[role], async (sql) => {
          const rows = await sql.rows(`select id from products`)
          expect(rows.length).toBeGreaterThanOrEqual(2)
        })
      })
    }

    const auditReaders = PERMISSION_ROLES['operations.audit.read'] as readonly Role[]
    for (const role of ROLES) {
      const shouldSee = auditReaders.includes(role)
      it(`${role} ${shouldSee ? 'reads' : 'cannot read'} the audit log`, async () => {
        const db = await connect()
        await db.query(
          `insert into audit_logs (action, result, summary) values ('rls.test','SUCCESS','probe')`,
        )
        await asUser(FIXTURE_USERS[role], async (sql) => {
          const rows = await sql.rows(`select id from audit_logs`)
          if (shouldSee) expect(rows.length).toBeGreaterThan(0)
          else expect(rows).toHaveLength(0)
        })
        await db.query(`delete from audit_logs where action = 'rls.test'`)
      })
    }

    const seedReaders = PERMISSION_ROLES['operations.logs.read'] as readonly Role[]
    for (const role of ROLES) {
      const shouldSee = seedReaders.includes(role)
      it(`${role} ${shouldSee ? 'reads' : 'cannot read'} seed run records`, async () => {
        const db = await connect()
        await db.query(`insert into content_seed_runs (seed_version) values ('rls-test')`)
        await asUser(FIXTURE_USERS[role], async (sql) => {
          const rows = await sql.rows(`select id from content_seed_runs`)
          if (shouldSee) expect(rows.length).toBeGreaterThan(0)
          else expect(rows).toHaveLength(0)
        })
        await db.query(`delete from content_seed_runs where seed_version = 'rls-test'`)
      })
    }
  })

  // ---------------------------------------------------------------------------------------------
  describe('per-role write access, derived from the permission matrix', () => {
    const catalogWriters = PERMISSION_ROLES['catalog.write'] as readonly Role[]
    const mediaWriters = PERMISSION_ROLES['media.write'] as readonly Role[]
    const deleters = PERMISSION_ROLES['destructive.execute'] as readonly Role[]

    for (const role of ROLES) {
      const mayWrite = catalogWriters.includes(role)
      it(`${role} ${mayWrite ? 'may' : 'may not'} insert a product`, async () => {
        await asUser(FIXTURE_USERS[role], async (sql) => {
          const result = await sql.attempt(
            `insert into products (slug, title, price_state)
             values ('rls-${role}', 'x', 'REQUEST_QUOTE')`,
          )
          expect(result.ok, result.error ?? '').toBe(mayWrite)
        })
      })

      it(`${role} ${mayWrite ? 'may' : 'may not'} update a product`, async () => {
        await asUser(FIXTURE_USERS[role], async (sql) => {
          const affected = await sql.affectedRows(
            `update products set title = 'changed' where id = $1`,
            [FIXTURE_IDS.publishedProduct],
          )
          expect(affected).toBe(mayWrite ? 1 : 0)
        })
      })

      const mayDelete = deleters.includes(role)
      it(`${role} ${mayDelete ? 'may' : 'may not'} delete a product`, async () => {
        await asUser(FIXTURE_USERS[role], async (sql) => {
          const affected = await sql.affectedRows(`delete from products where id = $1`, [
            FIXTURE_IDS.draftProduct,
          ])
          expect(affected).toBe(mayDelete ? 1 : 0)
        })
      })

      const mayWriteMedia = mediaWriters.includes(role)
      it(`${role} ${mayWriteMedia ? 'may' : 'may not'} insert a media asset`, async () => {
        await asUser(FIXTURE_USERS[role], async (sql) => {
          // Every not-null column is supplied, `source` included. The point of this probe is that
          // the ONLY thing which can reject the insert is the policy: if a constraint could reject
          // it too, the four "may not" cases would pass without RLS being involved at all.
          const result = await sql.attempt(
            `insert into media_assets (resource_type, public_id, folder, kind, alt_text,
                                       is_ai_generated, is_concept, source)
             values ('image', 'rls-${role}', 'f', 'IMAGE', 'alt', true, true, 'FALLBACK')`,
          )
          expect(result.ok, result.error ?? '').toBe(mayWriteMedia)
        })
      })
    }

    it('nobody may write the audit log through a session — not even the owner', async () => {
      // There is no insert policy for `authenticated` at all. If there were, any signed-in staff
      // member could forge entries implicating somebody else.
      await asUser(FIXTURE_USERS.owner, async (sql) => {
        const result = await sql.attempt(
          `insert into audit_logs (action, result) values ('forged','SUCCESS')`,
        )
        expect(result.ok).toBe(false)
      })
    })

    it('the audit log cannot be updated or deleted, by anyone', async () => {
      const db = await connect()
      await db.query(
        `insert into audit_logs (action, result, summary) values ('rls.immutable','SUCCESS','x')`,
      )
      await asUser(FIXTURE_USERS.owner, async (sql) => {
        // Revoked at the privilege level, so this RAISES rather than matching zero rows — a
        // stronger guarantee than a policy, because a privilege has to be granted back visibly.
        const updated = await sql.attempt(`update audit_logs set summary = 'rewritten'`)
        expect(updated.ok).toBe(false)
        expect(updated.error).toMatch(/permission denied/i)

        const deleted = await sql.attempt(`delete from audit_logs`)
        expect(deleted.ok).toBe(false)
        expect(deleted.error).toMatch(/permission denied/i)
      })
      await db.query(`delete from audit_logs where action = 'rls.immutable'`)
    })
  })

  // ---------------------------------------------------------------------------------------------
  describe('staff_profiles', () => {
    const managers = PERMISSION_ROLES['system.users.manage'] as readonly Role[]

    for (const role of ROLES) {
      const isManager = managers.includes(role)
      it(`${role} sees ${isManager ? 'every profile' : 'only their own'}`, async () => {
        await asUser(FIXTURE_USERS[role], async (sql) => {
          const rows = await sql.rows<{ user_id: string }>(`select user_id from staff_profiles`)
          if (isManager) {
            expect(rows.length).toBeGreaterThan(1)
          } else {
            expect(rows).toHaveLength(1)
            expect(rows[0]?.user_id).toBe(FIXTURE_USERS[role])
          }
        })
      })
    }

    it('a non-manager cannot promote themselves', async () => {
      // The escalation that matters most: if this succeeded, every other policy in the schema
      // would be advisory.
      await asUser(FIXTURE_USERS.viewer, async (sql) => {
        const affected = await sql.affectedRows(
          `update staff_profiles set role = 'owner' where user_id = $1`,
          [FIXTURE_USERS.viewer],
        )
        expect(affected).toBe(0)
      })
    })
  })

  // ---------------------------------------------------------------------------------------------
  describe('suspension is enforced by the database, not by hiding a button', () => {
    it('a SUSPENDED admin sees exactly what an anonymous visitor sees', async () => {
      const anonCount = await asAnon(async (sql) => {
        const rows = await sql.rows(`select id from products`)
        return rows.length
      })
      await asUser(FIXTURE_USERS.suspendedAdmin, async (sql) => {
        const rows = await sql.rows(`select id from products`)
        expect(rows.length).toBe(anonCount)
      })
    })

    it('a SUSPENDED admin cannot read the audit log', async () => {
      await asUser(FIXTURE_USERS.suspendedAdmin, async (sql) => {
        expect(await sql.rows(`select id from audit_logs`)).toHaveLength(0)
      })
    })

    it('a SUSPENDED admin cannot write', async () => {
      await asUser(FIXTURE_USERS.suspendedAdmin, async (sql) => {
        const result = await sql.attempt(
          `insert into products (slug, title, price_state) values ('susp','x','REQUEST_QUOTE')`,
        )
        expect(result.ok).toBe(false)
      })
    })
  })

  // ---------------------------------------------------------------------------------------------
  describe('Shape B — a join row is visible exactly when its parents are', () => {
    it("product_media: only the published product's row", async () => {
      await asAnon(async (sql) => {
        const rows = await sql.rows<{ product_id: string }>(`select product_id from product_media`)
        expect(rows).toHaveLength(1)
        expect(rows[0]?.product_id).toBe(FIXTURE_IDS.publishedProduct)
      })
    })

    it('product_collections: BOTH parents must be published', async () => {
      // The fixture holds three rows: published+published, published+draft, draft+published.
      // Only the first may be visible. A single-parent clause would expose the second, revealing
      // the existence and id of an unannounced collection.
      await asAnon(async (sql) => {
        const rows = await sql.rows<{ collection_id: string }>(
          `select collection_id from product_collections`,
        )
        expect(rows).toHaveLength(1)
        expect(rows[0]?.collection_id).toBe(FIXTURE_IDS.publishedCollection)
      })
    })

    it('product_materials: BOTH parents must be published', async () => {
      await asAnon(async (sql) => {
        const rows = await sql.rows<{ material_id: string }>(
          `select material_id from product_materials`,
        )
        expect(rows).toHaveLength(1)
        expect(rows[0]?.material_id).toBe(FIXTURE_IDS.publishedMaterial)
      })
    })

    it('staff see every join row regardless of parent status', async () => {
      await asUser(FIXTURE_USERS.viewer, async (sql) => {
        expect((await sql.rows(`select * from product_collections`)).length).toBe(3)
      })
    })
  })
})
