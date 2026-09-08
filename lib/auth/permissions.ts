/**
 * The permission matrix — the single source of truth for who may do what.
 *
 * This file is transcribed cell-for-cell from the table headed "Permission matrix" in
 * docs/project/phases/PHASE-00-04.md §PHASE 04. It is laid out permission-by-permission, in the
 * same orientation as that table, so the two can be diffed by eye. Do not "tidy" it into a
 * role-major shape: ROLE_PERMISSIONS below is derived, and the derivation is what keeps them
 * consistent.
 *
 * WHAT DEPENDS ON THIS FILE
 * -------------------------
 * Two enforcement layers, deliberately:
 *
 *   RLS is the coarse net — role-level, per table, in the database, always on. It answers
 *   "may this role see this table at all". Its policy role lists are GENERATED from this file by
 *   scripts/auth/gen-role-sql.ts, and scripts/auth/check-rls.ts reads pg_policies back and fails
 *   the build if a policy's list has drifted from the roles here.
 *
 *   requirePermission() is the fine net — permission-level, in the server, per action. It answers
 *   "may this role take this action, now".
 *
 * So a wrong cell here is not a typo. It is either a locked-out administrator or a data leak, in
 * the database and in the application at once.
 */

export const ROLES = ['owner', 'admin', 'editor', 'merchandiser', 'researcher', 'viewer'] as const

export type Role = (typeof ROLES)[number]

/** Every role. Named rather than repeated, because "all six" is a claim worth being able to grep. */
const ALL: readonly Role[] = ROLES

/**
 * Permission -> the roles holding it.
 *
 * `satisfies` rather than a type annotation, so the keys stay literal and `Permission` below is a
 * union of the actual names instead of `string`.
 */
export const PERMISSION_ROLES = {
  // Catalogue -----------------------------------------------------------------------------------
  'catalog.read': ALL,
  'catalog.write': ['owner', 'admin', 'merchandiser'],
  'catalog.publish': ['owner', 'admin', 'merchandiser'],

  // Content -------------------------------------------------------------------------------------
  'content.read': ALL,
  'content.write': ['owner', 'admin', 'editor'],
  'content.publish': ['owner', 'admin', 'editor'],

  // Media ---------------------------------------------------------------------------------------
  'media.read': ALL,
  'media.write': ['owner', 'admin', 'editor', 'merchandiser'],
  'media.delete': ['owner', 'admin'],

  'merchandising.write': ['owner', 'admin', 'merchandiser'],

  // Inquiries -----------------------------------------------------------------------------------
  // Note the researcher is absent from `inquiries.read`. That gap is the reason the staff-select
  // role list on `inquiries` (Phase 20) must be written out explicitly rather than copied from a
  // catalogue table: the shorthand would hand a researcher every customer's name and phone number.
  'inquiries.read': ['owner', 'admin', 'editor', 'merchandiser', 'viewer'],
  'inquiries.write': ['owner', 'admin', 'merchandiser'],
  'inquiries.export': ['owner', 'admin', 'merchandiser'],

  // Research ------------------------------------------------------------------------------------
  // These three look interchangeable and are not:
  //   read    — viewing any /studio/research/** surface
  //   write   — source, job and schedule CONFIGURATION; queueing and cancelling runs
  //   confirm — the nine row actions (Review, Ignore, Shortlist, Reject, Mark Duplicate, Confirm,
  //             Add Note, Add Tag, Compare)
  // The merchandiser holds `confirm` without `write`, and the researcher the reverse. That is the
  // whole design: a researcher gathers, a merchandiser decides.
  'research.read': ['owner', 'admin', 'merchandiser', 'researcher', 'viewer'],
  'research.write': ['owner', 'admin', 'researcher'],
  'research.confirm': ['owner', 'admin', 'merchandiser'],

  'analytics.read': ALL,

  'bulk.execute': ['owner', 'admin', 'merchandiser'],
  'destructive.execute': ['owner', 'admin'],

  // Operations ----------------------------------------------------------------------------------
  'operations.audit.read': ['owner', 'admin'],
  'operations.logs.read': ['owner', 'admin'],

  // System --------------------------------------------------------------------------------------
  'system.settings.write': ['owner', 'admin'],
  'system.flags.write': ['owner', 'admin'],
  'system.users.manage': ['owner', 'admin'],
  /** The one permission no role but `owner` can ever hold. */
  'system.owner.transfer': ['owner'],
} as const satisfies Record<string, readonly Role[]>

export type Permission = keyof typeof PERMISSION_ROLES

export const PERMISSIONS = Object.keys(PERMISSION_ROLES) as Permission[]

/**
 * Role -> the permissions it holds. DERIVED, never hand-maintained.
 *
 * Inverting the matrix in code rather than writing it out twice is the point: two hand-written
 * copies of the same truth drift, and the drift is invisible until someone is denied something
 * they should have — or granted something they should not.
 */
const rolePermissions = {} as Record<Role, Permission[]>
for (const role of ROLES) {
  rolePermissions[role] = PERMISSIONS.filter((permission) =>
    (PERMISSION_ROLES[permission] as readonly Role[]).includes(role),
  )
}

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = rolePermissions

/** Does this role hold this permission? The single question the fine net asks. */
export function roleHasPermission(role: Role | null, permission: Permission): boolean {
  if (role === null) return false
  return (PERMISSION_ROLES[permission] as readonly Role[]).includes(role)
}

/** The roles holding a permission, in canonical ROLES order — the order policy SQL is emitted in. */
export function rolesWithPermission(permission: Permission): readonly Role[] {
  const holders = PERMISSION_ROLES[permission] as readonly Role[]
  return ROLES.filter((role) => holders.includes(role))
}

/** True when every role holds it. The one case where DATA_MODEL §1.5's `is_staff()` shorthand is
 *  equivalent to an explicit role list — and therefore the only case check-rls.ts accepts it. */
export function isHeldByEveryRole(permission: Permission): boolean {
  return rolesWithPermission(permission).length === ROLES.length
}
