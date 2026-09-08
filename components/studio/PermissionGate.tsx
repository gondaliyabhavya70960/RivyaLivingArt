import type { Permission, Role } from '@/lib/auth/permissions'
import { roleHasPermission } from '@/lib/auth/permissions'

/**
 * Hides a control the current role cannot use.
 *
 * THIS IS NOT A SECURITY BOUNDARY, AND THE NAME IS THE ONLY MISLEADING THING ABOUT IT. It removes a
 * button from the page. It does not stop the Server Action behind that button from being invoked —
 * a Server Action is an HTTP endpoint, reachable with `curl` and a session cookie, and it never
 * passes through this component or any other rendering code.
 *
 * The action's own `withPermission(...)` wrapper is the decision, and RLS refuses underneath it if
 * that is ever forgotten. Both still apply to everything wrapped here; this is a courtesy to the
 * reader, so the interface does not offer something that will be refused.
 *
 * It is a separate component rather than an inline `&&` precisely so this comment has somewhere to
 * live: `{canWrite && <Button/>}` is the same logic with nowhere to say that it protects nothing.
 */
export function PermissionGate({
  role,
  permission,
  children,
  fallback = null,
}: {
  role: Role | null
  permission: Permission
  children: React.ReactNode
  /** Shown instead. Usually nothing — an explanation of a control you cannot use is rarely wanted. */
  fallback?: React.ReactNode
}) {
  if (role === null || !roleHasPermission(role, permission)) return <>{fallback}</>
  return <>{children}</>
}
