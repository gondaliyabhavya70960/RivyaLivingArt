import { ROLE_PERMISSIONS, type Permission, type Role } from './permissions'

/**
 * Which Studio routes a role may SEE.
 *
 * VISIBILITY IS NOT AUTHORISATION. This module exists so the Studio does not show a researcher a
 * link to a page that will refuse them — a navigation problem, not a security one. Every page
 * still calls requirePermission() in its own body, and the database still enforces RLS beneath
 * that. Hiding a link protects nobody; it just stops the interface lying about what is available.
 *
 * Phase 05 consumes this to build the shell. It is declared here because the mapping is a fact
 * about the permission matrix, and the matrix lives in this directory.
 */

/** A D4 route prefix and the permission that governs it. */
export const ROUTE_PERMISSIONS = {
  '/studio': 'analytics.read',
  '/studio/catalog': 'catalog.read',
  '/studio/merchandising': 'merchandising.write',
  '/studio/content': 'content.read',
  '/studio/media': 'media.read',
  '/studio/inquiries': 'inquiries.read',
  '/studio/research': 'research.read',
  '/studio/operations': 'operations.logs.read',
  '/studio/operations/audit': 'operations.audit.read',
  '/studio/system': 'system.settings.write',
  '/studio/system/users': 'system.users.manage',
} as const satisfies Record<string, Permission>

export type StudioRoute = keyof typeof ROUTE_PERMISSIONS

/** Every Studio route this role may see, longest-prefix entries included. */
export function visibleRoutes(role: Role | null): StudioRoute[] {
  if (role === null) return []
  const held = new Set<Permission>(ROLE_PERMISSIONS[role])
  return (Object.keys(ROUTE_PERMISSIONS) as StudioRoute[]).filter((route) =>
    held.has(ROUTE_PERMISSIONS[route]),
  )
}

/**
 * May this role see this exact path?
 *
 * Resolved by LONGEST matching prefix, so `/studio/system/users` is governed by
 * `system.users.manage` rather than by `/studio/system`'s broader entry. Shortest-prefix matching
 * would show an editor the user-management link.
 */
export function canSeeRoute(role: Role | null, path: string): boolean {
  if (role === null) return false
  const prefixes = (Object.keys(ROUTE_PERMISSIONS) as StudioRoute[])
    .filter((route) => path === route || path.startsWith(`${route}/`))
    .sort((a, b) => b.length - a.length)

  const governing = prefixes[0]
  if (!governing) return false
  return new Set<Permission>(ROLE_PERMISSIONS[role]).has(ROUTE_PERMISSIONS[governing])
}
