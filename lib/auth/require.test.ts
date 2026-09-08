import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuditEntry } from './audit'
import type { Role } from './permissions'

/**
 * withPermission writes EXACTLY ONE audit row per outcome.
 *
 * WHY THIS FILE EXISTS. Phase 04 verification step 8 reads a role change back out of `audit_logs`
 * and expects "one SUCCESS row naming the action and the target", then "one DENIED row" for the
 * refused attempt. It could not be run — it needs a Studio session against real Supabase Auth —
 * and while it could not be run, the wrapper quietly wrote TWO rows for every refusal and two for
 * every rich success: the detailed row from whoever knew what happened, plus a second, poorer row
 * from the wrapper catching the same event on its way past.
 *
 * Duplicate rows in a security log are not untidiness. Every count taken from the table is wrong,
 * and the two rows disagree — one names the record and the rule, the other names neither.
 *
 * The cardinality is the whole property, so it is asserted directly, at the layer where it is
 * decided, with no database involved. What still needs Supabase is whether the rows reach the
 * table; what is settled here is how many there are and what they say — which is the half that was
 * actually broken.
 */

const rows: AuditEntry[] = []
let session: { userId: string; role: Role } | null = { userId: 'u-actor', role: 'admin' }

vi.mock('./session', () => ({
  getStaffSession: async () => session,
}))

vi.mock('./audit', async (importOriginal) => {
  // markAudited/isAudited are the real implementations: the marker is the mechanism under test,
  // and a fake one would let a broken marker pass.
  const actual = await importOriginal<typeof import('./audit')>()
  return {
    ...actual,
    writeAudit: async (entry: AuditEntry) => {
      rows.push(entry)
    },
  }
})

const { withPermission, requirePermission, AuthorizationError, AuthenticationError } =
  await import('./require')
const { markAudited } = await import('./audit')

beforeEach(() => {
  rows.length = 0
  session = { userId: 'u-actor', role: 'admin' }
})

describe('withPermission — one row per outcome', () => {
  it('writes a single SUCCESS row naming the record', async () => {
    const action = withPermission(
      {
        permission: 'system.users.manage',
        action: 'system.users.role.change',
        entityType: 'staff profile',
        entityId: (input: { userId: string }) => input.userId,
      },
      async () => 'done',
    )

    await expect(action({ userId: 'u-target' })).resolves.toBe('done')

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      result: 'SUCCESS',
      action: 'system.users.role.change',
      entityType: 'staff profile',
      entityId: 'u-target',
      actorUserId: 'u-actor',
      actorRole: 'admin',
    })
  })

  it('writes NO row of its own when the action records its own outcome', async () => {
    // The rich path: the action holds `before`, which is gone by the time the wrapper resumes.
    const action = withPermission(
      {
        permission: 'system.users.manage',
        action: 'system.users.role.change',
        entityType: 'staff profile',
        recordsOwnOutcome: true,
        entityId: (input: { userId: string }) => input.userId,
      },
      async (_session, _input: { userId: string }) => 'done',
    )

    await action({ userId: 'u-target' })
    expect(rows).toHaveLength(0)
  })

  it('writes a single ERROR row for an unrecorded failure', async () => {
    const action = withPermission(
      { permission: 'system.users.manage', action: 'system.users.invite' },
      async () => {
        throw new Error('the database was unreachable')
      },
    )

    await expect(action()).rejects.toThrow('the database was unreachable')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ result: 'ERROR', summary: 'the database was unreachable' })
  })

  it('writes NO second row when the failure already recorded itself', async () => {
    // This is the regression. The refusal below is exactly the shape of the last-owner rule:
    // something further in recognised it, wrote the row that names the record, and threw.
    const action = withPermission(
      {
        permission: 'system.users.manage',
        action: 'system.users.role.change',
        entityType: 'staff profile',
        entityId: (input: { userId: string }) => input.userId,
      },
      async (_session, input: { userId: string }) => {
        rows.push({
          action: 'system.users.role.change',
          result: 'DENIED',
          entityType: 'staff profile',
          entityId: input.userId,
          summary: 'refused by enforce_last_owner',
        })
        throw markAudited(new Error('the last active owner cannot be demoted'))
      },
    )

    await expect(action({ userId: 'u-target' })).rejects.toThrow('last active owner')

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ result: 'DENIED', entityId: 'u-target' })
  })

  it('records a refused permission once, and does not run the action', async () => {
    session = { userId: 'u-actor', role: 'viewer' }
    const body = vi.fn(async () => 'should not happen')

    const action = withPermission(
      { permission: 'system.users.manage', action: 'system.users.role.change' },
      body,
    )

    await expect(action()).rejects.toBeInstanceOf(AuthorizationError)
    expect(body).not.toHaveBeenCalled()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      result: 'DENIED',
      action: 'auth.denied.system.users.manage',
      actorRole: 'viewer',
    })
  })

  it('records an unauthenticated attempt once', async () => {
    session = null
    const action = withPermission(
      { permission: 'system.users.manage', action: 'system.users.role.change' },
      async () => 'x',
    )

    await expect(action()).rejects.toBeInstanceOf(AuthenticationError)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ result: 'DENIED' })
  })

  it('lets a resolver that throws fail the action rather than writing a row with no record', async () => {
    // A resolver written against the wrong argument shape is a bug in the call site. Swallowing it
    // would produce audit rows that silently stop naming their target.
    const action = withPermission(
      {
        permission: 'system.users.manage',
        action: 'system.users.role.change',
        entityId: (input: { userId: string }) => input.userId.toUpperCase(),
      },
      async () => 'done',
    )

    await expect(action(undefined as never)).rejects.toThrow()
    expect(rows).toHaveLength(0)
  })
})

describe('requirePermission', () => {
  it('returns the session when the role holds the permission, and writes nothing', async () => {
    const result = await requirePermission('system.users.manage')
    expect(result).toMatchObject({ userId: 'u-actor', role: 'admin' })
    expect(rows).toHaveLength(0)
  })

  it('names the permission in the denial row, so probing is visible in the log', async () => {
    session = { userId: 'u-actor', role: 'researcher' }
    await expect(requirePermission('destructive.execute')).rejects.toBeInstanceOf(
      AuthorizationError,
    )
    expect(rows[0]?.action).toBe('auth.denied.destructive.execute')
  })
})
