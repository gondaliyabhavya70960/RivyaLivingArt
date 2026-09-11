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
  // Studio ----------------------------------------------------------------------------------------
  /**
   * May enter the Studio at all. Held by every role, and that is the point rather than an
   * oversight: it is the permission the shell demands, so "is this person staff, active, and
   * allowed through the front door" is asked in the same vocabulary as every other question, is
   * refused through the same path, and is recorded in the same audit row shape. A bespoke
   * `requireStaff()` would be a second answer to a question the matrix already answers.
   */
  'studio.access': ALL,
  /**
   * May read the Studio activity feed. Every role, because the feed is part of the Overview page
   * that every role lands on. Distinct from `operations.audit.read` (owner and admin only): that
   * is the authorisation log, this is "who changed what", and merging them would put the security
   * log in front of a viewer.
   */
  'activity.read': ALL,

  // Catalogue -----------------------------------------------------------------------------------
  'catalog.read': ALL,
  'catalog.write': ['owner', 'admin', 'merchandiser'],
  'catalog.publish': ['owner', 'admin', 'merchandiser'],

  // Content -------------------------------------------------------------------------------------
  //
  // FOUR PERMISSIONS, NOT THREE, AND THE TWO NEW ONES GATE DIFFERENT ACTS (Phase 08, amendment A7).
  //
  // `content.review` gates the REVIEW edges — REVIEW -> DRAFT, APPROVED, ARCHIVED. Without it the
  // review state is decorative: every edge out of REVIEW would have to be spelled `content.write`
  // or `content.publish`, and a workflow whose middle state anyone can leave in either direction
  // is not a workflow. It is also unwriteable otherwise — `Permission` is `keyof typeof
  // PERMISSION_ROLES`, so `requirePermission('content.review')` does not compile until the key
  // exists.
  //
  // `content.verify` gates setting `owner_verification = 'VERIFIED'`, and it is the narrow one.
  // Publishing copy is an editorial act; asserting that a business claim is TRUE — that Rivya
  // really does offer architectural installation, really has that lead time — is the owner's, and
  // D10 exists because nobody else can know. Nothing in the matrix expressed it before, which is
  // why the same three roles could both write a claim and mark it verified.
  //
  // `content.publish` deliberately KEEPS the editor. The Phase 08 spec's verification step 3 reads
  // "as editor, attempt APPROVED -> PUBLISHED -> refused", which contradicts this cell as shipped
  // in Phase 04 — and the cell wins. Narrowing a shipped authorisation through a sentence in a
  // later phase's verification list is the wrong direction of travel, and the thing that sentence
  // was protecting (an unverified business claim reaching the public) is held by `content.verify`
  // above, not by publish. The phase document is corrected instead; see A7.
  'content.read': ALL,
  'content.write': ['owner', 'admin', 'editor'],
  'content.review': ['owner', 'admin', 'editor'],
  'content.publish': ['owner', 'admin', 'editor'],
  'content.verify': ['owner', 'admin'],

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
  /**
   * Phase 32. Who may create, edit and ACTIVATE a scoring model. Owner and admin only, because a
   * model's weights decide which competitor rows sort first and the phase document's named risk is
   * weights quietly tuned until a favoured row ranks first. Recomputing scores under the active
   * model is `research.write` — operating the pipeline, not changing what it measures.
   */
  'research.score.manage': ['owner', 'admin'],
  /**
   * Phase 33. Starting a similarity run — a comparison over stored hashes, never a fetch under
   * amendment A33. Operators: the same three roles that may queue a research run.
   */
  'research.similarity.run': ['owner', 'admin', 'researcher'],
  /**
   * Phase 34. Writing a direction brief — the nine prose sections, the evidence rail. Everyone who
   * reads research and may act on it; a viewer reads briefs and writes none.
   */
  'research.direction.write': ['owner', 'admin', 'merchandiser', 'researcher'],
  /**
   * Phase 34. Approving a brief: "the studio agrees this direction is worth exploring". The three
   * roles that record verdicts (research.confirm), because approval is a judgement, not an edit.
   */
  'research.direction.approve': ['owner', 'admin', 'merchandiser'],

  /**
   * Phase 36. Creating, editing, pausing and resuming a Google Sheets export definition — and the
   * only two roles that may flip `includes_pii`. Owner and admin: the definition is where a
   * spreadsheet's contents are decided, and personal data leaves the building through it.
   */
  'integrations.sheets.manage': ['owner', 'admin'],
  /**
   * Phase 36. Pressing Run now. Everyone who operates or judges research; the INQUIRIES entity
   * additionally needs `inquiries.export`, checked in the action, so a researcher can run every
   * research export and no enquiry export.
   */
  'integrations.sheets.run': ['owner', 'admin', 'merchandiser', 'researcher'],

  'analytics.read': ALL,

  'bulk.execute': ['owner', 'admin', 'merchandiser'],
  'destructive.execute': ['owner', 'admin'],

  // Operations ----------------------------------------------------------------------------------
  'operations.audit.read': ['owner', 'admin'],
  'operations.logs.read': ['owner', 'admin'],

  // System --------------------------------------------------------------------------------------
  /**
   * Two READ permissions for System surfaces, added in Phase 05 because every D4 leaf needs one to
   * be gated by — a stub with no permission is a route nobody has decided the audience for, and it
   * would have to be invented again when Phase 38 fills it.
   *
   * Both are proposed with these exact role sets in STUDIO_GUIDE §2.3. Note the asymmetry, which is
   * deliberate: the environment page reports reachability of production services, so it stays with
   * owner and admin, while the documentation viewer is how everyone else finds out how the system
   * works and would be useless restricted to the two roles least likely to need it. `viewer` holds
   * neither — it sees System only for the feature-flag register, under `studio.access`.
   */
  'system.environment.read': ['owner', 'admin'],
  'system.docs.read': ['owner', 'admin', 'editor', 'merchandiser', 'researcher'],

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
