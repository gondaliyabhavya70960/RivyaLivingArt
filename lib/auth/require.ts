import 'server-only'

import { getStaffSession, type StaffSession } from './session'
import { roleHasPermission, type Permission, type Role } from './permissions'
import { writeAudit } from './audit'

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
    throw new AuthenticationError()
  }

  if (!roleHasPermission(session.role, permission)) {
    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: `auth.denied.${permission}`,
      result: 'DENIED',
      summary: `role "${session.role}" attempted an action requiring "${permission}"`,
    })
    throw new AuthorizationError(permission, session.role)
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
    throw new AuthenticationError()
  }

  if (!roles.includes(session.role)) {
    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'auth.denied.role',
      result: 'DENIED',
      summary: `role "${session.role}" is not one of ${roles.join(', ')}`,
    })
    throw new AuthorizationError(roles.join(' or '), session.role)
  }

  return session
}

/**
 * Wrap a server action so it cannot run without the permission, and so that both outcomes are
 * recorded.
 *
 * The wrapper exists because the alternative — remembering to call requirePermission() at the top
 * of every action — fails silently the one time somebody forgets. Here the permission is part of
 * the action's declaration.
 */
export function withPermission<Args extends unknown[], Result>(
  permission: Permission,
  action: string,
  fn: (session: StaffSession, ...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  return async (...args: Args): Promise<Result> => {
    const session = await requirePermission(permission)
    try {
      const result = await fn(session, ...args)
      await writeAudit({
        actorUserId: session.userId,
        actorRole: session.role,
        action,
        result: 'SUCCESS',
      })
      return result
    } catch (error) {
      await writeAudit({
        actorUserId: session.userId,
        actorRole: session.role,
        action,
        result: 'ERROR',
        summary: error instanceof Error ? error.message : 'unknown error',
      })
      throw error
    }
  }
}
