import { ROLE_PERMISSIONS, type Permission, type Role } from './permissions'
import {
  leafForPath,
  STUDIO_LEAVES,
  STUDIO_NAV,
  type StudioNavGroup,
  type StudioNavLeaf,
} from './studio-nav'

/**
 * Which Studio routes a role may SEE.
 *
 * VISIBILITY IS NOT AUTHORISATION. This module exists so the Studio does not show a researcher a
 * link to a page that will refuse them — a navigation problem, not a security one. Every page
 * still calls requirePermission() in its own body, and the database still enforces RLS beneath
 * that. Hiding a link protects nobody; it just stops the interface lying about what is available.
 *
 * IT WRITES DOWN NO ROUTE OF ITS OWN. Until Phase 05 this file held its own prefix-to-permission
 * table, which was a second copy of the D4 map and free to drift from the first. Everything below
 * now reads `lib/auth/studio-nav.ts`, so a route added there is filtered here with no edit, and a
 * route that exists only here is unrepresentable.
 */

/** Does this role hold this permission? */
function holds(role: Role, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[role] as readonly Permission[]).includes(permission)
}

/**
 * May this role see this exact path?
 *
 * Resolved by the LONGEST matching leaf, so `/studio/system/users` is governed by
 * `system.users.manage` rather than by `/studio`'s `studio.access`, which every role holds.
 * Shortest-prefix matching would show an editor the user-management link — and, worse, would gate
 * every future nested detail route on the weakest permission in the system.
 *
 * A path outside the Studio matches no leaf and is refused: this answers "may they see this Studio
 * link", and the honest answer for `/product/x` is no, not "yes, it is public".
 */
export function canSeeRoute(role: Role | null, path: string): boolean {
  if (role === null) return false
  const leaf = leafForPath(path)
  return leaf !== null && holds(role, leaf.permission)
}

/** Every Studio path this role may see, in manifest order. */
export function visibleRoutes(role: Role | null): string[] {
  if (role === null) return []
  return STUDIO_LEAVES.filter((leaf) => holds(role, leaf.permission)).map((leaf) => leaf.href)
}

/** The leaves of one group this role may see. */
export function visibleLeaves(role: Role | null, group: StudioNavGroup): StudioNavLeaf[] {
  if (role === null) return []
  return group.leaves.filter((leaf) => holds(role, leaf.permission))
}

/**
 * The sidebar for a role: every group with at least one visible leaf, carrying only those leaves.
 *
 * A GROUP IS NOT ITS OWN PERMISSION. It is shown when any leaf below it is, which is what lets a
 * merchandiser see Operations for `data-quality`, `imports` and `exports` without seeing `audit` or
 * `logs`. A hand-written group-level matrix — the obvious alternative, and what an earlier draft of
 * STUDIO_GUIDE §2.2 implied — gets this wrong in both directions: it hides whole groups containing
 * a leaf the role can reach by typing the URL, and it shows groups whose every leaf refuses them.
 */
export function visibleNav(role: Role | null): StudioNavGroup[] {
  if (role === null) return []
  return STUDIO_NAV.map((group) => ({ ...group, leaves: visibleLeaves(role, group) })).filter(
    (group) => group.leaves.length > 0,
  )
}

/** May this role change anything on this surface? Used to hide write controls, never to allow. */
export function canWriteRoute(role: Role | null, path: string): boolean {
  if (role === null) return false
  const leaf = leafForPath(path)
  if (leaf?.writePermission === undefined) return false
  return holds(role, leaf.writePermission)
}
