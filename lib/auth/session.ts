import 'server-only'

import { createClient } from '../supabase/server'
import { ROLES, type Role } from './permissions'

/**
 * Who is making this request?
 *
 * Returns the staff session or null. Null covers every "not staff" case without distinguishing
 * them — not signed in, signed in but never invited, invited but not accepted, suspended. The
 * caller's decision is the same in all four, and telling them apart at this boundary would leak
 * account state to whoever is probing.
 */

export type StaffSession = {
  userId: string
  email: string | null
  displayName: string | null
  role: Role
  status: 'ACTIVE'
}

/**
 * Read the current staff session.
 *
 * `getUser()` rather than `getSession()`, deliberately: getSession() returns whatever is in the
 * cookie, which the browser can edit. getUser() revalidates the token with the auth server. On a
 * page that decides whether to show the Studio, the difference is the whole security property.
 *
 * The profile lookup goes through the caller's own RLS-bound client, not the admin client, so the
 * self-select policy is what makes it visible. A suspended user's row is readable but their status
 * is not ACTIVE, so they resolve to null here AND to a null role in every database policy — the
 * two layers agree without being told to.
 */
export async function getStaffSession(): Promise<StaffSession | null> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) return null

  const { data, error } = await supabase
    .from('staff_profiles')
    .select('user_id, email, display_name, role, status')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !data) return null
  if (data.status !== 'ACTIVE') return null
  if (!(ROLES as readonly string[]).includes(data.role)) return null

  return {
    userId: data.user_id,
    email: data.email,
    displayName: data.display_name,
    role: data.role as Role,
    status: 'ACTIVE',
  }
}

/** The role alone, or null. For call sites that only need to branch on capability. */
export async function getStaffRole(): Promise<Role | null> {
  return (await getStaffSession())?.role ?? null
}
