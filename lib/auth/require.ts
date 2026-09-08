import 'server-only'

import { getStaffSession, type StaffSession } from './session'
import { roleHasPermission, type Permission, type Role } from './permissions'
import { isAudited, markAudited, writeAudit } from './audit'

/**
 * The fine net.
 *
 * MIDDLEWARE IS NOT AUTHORISATION. proxy.ts redirects an unauthenticated request to the login
 * page and does nothing else — it cannot see which record is being touched, it runs before the
 * page decides anything, and a request that reaches a Server Action never passes through a page's
 * matcher at all. These functions are where "may this person do this" is actually decided, and
 * they are called in the body of every Studio page and every privileged mutation.
 *
 * RLS is the coarse net underneath: even if one of these calls is forgotten, the database still
 * refuses what the role may not touch. Two layers, on purpose. Neither is a reason to skip the
 * other — RLS cannot express "may this person publish, as opposed to edit", and a server check
 * cannot survive a query that bypasses it.
 *
 * EVERY DENIAL IS LOGGED. A security log that records only successes cannot show you someone
 * probing for what they cannot reach, so the throw is preceded by an audit row.
 */

export class AuthenticationError extends Error {
  readonly kind = 'authentication' as const
  constructor() {
    super('not signed in')
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends Error {
  readonly kind = 'authorization' as const
  constructor(
    /**
     * What was required — a permission name, or a role list when the call site used requireRole.
     * Typed as a string rather than Permission so both callers can report accurately; the message
     * is for the log, never for the visitor.
     */
    readonly requirement: string,
    readonly role: Role,
  ) {
    super(`role "${role}" does not satisfy "${requirement}"`)
    this.name = 'AuthorizationError'
  }
}

/**
 * Demand a permission. Returns the session so the caller does not fetch it twice.
 *
 * Throws AuthenticationError when nobody is signed in and AuthorizationError when they are but may
 * not. The two are distinguished HERE because the responses differ — one is a redirect to login,
 * the other a 403 — but neither message tells the caller anything about what exists.
 */
export async function requirePermission(permission: Permission): Promise<StaffSession> {
  const session = await getStaffSession()

  if (!session) {
    await writeAudit({
      action: `auth.denied.${permission}`,
      result: 'DENIED',
      summary: 'unauthenticated request to a permissioned surface',
    })
    // The DENIED row above IS this event's audit row; withPermission must not add an ERROR row
    // for the same throw.
    throw markAudited(new AuthenticationError())
  }

  if (!roleHasPermission(session.role, permission)) {
    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: `auth.denied.${permission}`,
      result: 'DENIED',
      summary: `role "${session.role}" attempted an action requiring "${permission}"`,
    })
    throw markAudited(new AuthorizationError(permission, session.role))
  }

  return session
}

/** Demand one of a set of roles. Prefer requirePermission — a role check hard-codes today's matrix
 *  into a call site, and the matrix is the thing that changes. */
export async function requireRole(...roles: Role[]): Promise<StaffSession> {
  const session = await getStaffSession()

  if (!session) {
    await writeAudit({
      action: 'auth.denied.role',
      result: 'DENIED',
      summary: `unauthenticated request to a surface requiring ${roles.join(' or ')}`,
    })
    throw markAudited(new AuthenticationError())
  }

  if (!roles.includes(session.role)) {
    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'auth.denied.role',
      result: 'DENIED',
      summary: `role "${session.role}" is not one of ${roles.join(', ')}`,
    })
    throw markAudited(new AuthorizationError(roles.join(' or '), session.role))
  }

  return session
}

/**
 * What a wrapped action is, for the permission check and for the audit row.
 *
 * `entityId` is a function of the action's own arguments rather than a value, because the wrapper
 * is built once at module scope and the record is only known per call.
 */
export type PermittedAction<Args extends unknown[]> = {
  /** Checked before the action runs; a refusal is recorded and throws. */
  permission: Permission
  /** The audited action name, e.g. `system.users.role-change`. */
  action: string
  /** What kind of record this touches. Omit only for actions that touch no single record. */
  entityType?: string
  /** Which record, read from the arguments the action was called with. */
  entityId?: (...args: Args) => string | null
  /**
   * Set when the action writes its OWN success row, and it must then actually write one.
   *
   * Needed because a rich audit row carries `before` — the state prior to the mutation — and only
   * the action can read that, since by the time the wrapper regains control it is gone. So for
   * those actions the wrapper would be adding a second, poorer row describing the same event: the
   * duplication that made `audit_logs` counts untrustworthy.
   *
   * It changes NOTHING about the failure paths. A refusal is still recorded exactly once, by
   * whoever recognised it, and an unexpected error is still recorded by the wrapper.
   */
  recordsOwnOutcome?: boolean
}

/**
 * Wrap a server action so it cannot run without the permission, and so that both outcomes are
 * recorded.
 *
 * The wrapper exists because the alternative — remembering to call requirePermission() at the top
 * of every action — fails silently the one time somebody forgets. Here the permission is part of
 * the action's declaration.
 *
 * TWO THINGS IT DOES THAT IT USED NOT TO, both fixing rows that were wrong rather than missing:
 *
 * It NAMES THE RECORD. The old signature took no entity, so every row it wrote said what was
 * attempted and not what it was attempted on — which is the first question anyone reading a
 * security log asks, and it could not be answered afterwards from the row.
 *
 * It does not write a SECOND row for an error that already wrote its own. A refusal recognised
 * further in — the last-owner rule, say — records a DENIED row naming the record and the rule, and
 * then throws; this wrapper used to catch that throw and add an ERROR row for the same event. Two
 * rows, disagreeing, for one refusal. `isAudited()` is how the thrower says it has already been
 * recorded.
 *
 * `entityId` is read inside the try, because a resolver written against the wrong argument shape
 * throws — and that must fail the action loudly rather than silently producing a row with no
 * record on it.
 */
export function withPermission<Args extends unknown[], Result>(
  spec: PermittedAction<Args>,
  fn: (session: StaffSession, ...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  return async (...args: Args): Promise<Result> => {
    const session = await requirePermission(spec.permission)
    const entity = {
      entityType: spec.entityType,
      entityId: spec.entityId?.(...args) ?? undefined,
    }

    try {
      const result = await fn(session, ...args)
      if (!spec.recordsOwnOutcome) {
        await writeAudit({
          actorUserId: session.userId,
          actorRole: session.role,
          action: spec.action,
          result: 'SUCCESS',
          ...entity,
        })
      }
      return result
    } catch (error) {
      if (!isAudited(error)) {
        await writeAudit({
          actorUserId: session.userId,
          actorRole: session.role,
          action: spec.action,
          result: 'ERROR',
          summary: error instanceof Error ? error.message : 'unknown error',
          ...entity,
        })
      }
      throw error
    }
  }
}
