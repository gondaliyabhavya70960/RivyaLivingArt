import 'server-only'

import { revalidatePath } from 'next/cache'

import { logActivity } from '../logging/activity'
import { createClient } from '../supabase/server'
import {
  DEFAULT_PREFERENCES,
  findMyPreferences,
  saveMyPreferences,
  type StudioPreferences,
} from '../supabase/repositories/preferences'
import { roleHasPermission } from './permissions'
import { leafForPath } from './studio-nav'
import { requirePermission } from './require'

/**
 * Studio chrome state, per person.
 *
 * READS NEVER THROW. The sidebar must render whether or not this table is reachable — a preferences
 * outage that turns every Studio page into a 500 is far worse than a sidebar that forgot it was
 * collapsed. A failed read falls back to the defaults, which is also what a brand-new account gets,
 * and the two are indistinguishable ON PURPOSE here: nothing downstream behaves differently, so
 * distinguishing them would only be a distinction to maintain.
 *
 * That is the opposite of the rule for the activity feed and the dashboard cards, where a failed
 * read MUST be told apart from an empty one. The difference is what the reader concludes: an empty
 * feed asserts "nothing happened", an uncollapsed sidebar asserts nothing at all.
 */
export type StudioChrome = Omit<StudioPreferences, 'user_id'>

export async function readMyChrome(): Promise<StudioChrome> {
  try {
    const supabase = await createClient()
    const found = await findMyPreferences(supabase)
    return found === null
      ? DEFAULT_PREFERENCES
      : {
          sidebar_collapsed: found.sidebar_collapsed,
          pinned_routes: found.pinned_routes,
          dashboard_card_order: found.dashboard_card_order,
        }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

/**
 * Collapse or expand the sidebar.
 *
 * Gated by `studio.access` like every other Studio surface. It is somebody's own chrome, so the
 * permission is the weakest in the system — but the ROW is protected by RLS's owner scope, which is
 * what stops one staff member collapsing another's sidebar. The permission answers "may you be
 * here"; the scope answers "whose row is this".
 *
 * Not audited: `audit_logs` records privileged mutations, and a sidebar toggle is neither
 * privileged nor a mutation anyone will ever investigate. It IS logged to the activity feed, which
 * is the honest place for "somebody changed something small".
 */
export async function setSidebarCollapsed(collapsed: boolean): Promise<void> {
  const session = await requirePermission('studio.access')
  const supabase = await createClient()

  await saveMyPreferences(supabase, session.userId, { sidebar_collapsed: collapsed })
  revalidatePath('/studio')
}

/**
 * Pin or unpin a Studio route.
 *
 * THE PATH IS VALIDATED AGAINST THE NAVIGATION MANIFEST, not merely against a prefix. `pinned_routes`
 * is rendered as links in the sidebar, so an unvalidated value would let anyone who can reach this
 * action put an arbitrary path — including an off-origin one — into their own chrome, and any
 * screenshot or shared session would carry it. `leafForPath` returning null is the whole check:
 * only a real D4 leaf can be pinned.
 *
 * It also refuses to pin a route the person cannot open. A pinned link that always refuses is not a
 * shortcut, it is a permanent reminder of something they cannot do.
 */
export async function togglePinnedRoute(path: string): Promise<void> {
  const session = await requirePermission('studio.access')

  // `leaf.href !== path` as well as a null check: leafForPath resolves a NESTED path to its parent
  // leaf, so `/studio/catalog/products/anything` would otherwise pin as the products leaf under a
  // path that is not in the manifest at all.
  const leaf = leafForPath(path)
  if (leaf === null || leaf.href !== path) return
  if (!roleHasPermission(session.role, leaf.permission)) return

  const supabase = await createClient()
  const current = await readMyChrome()
  const pinned = current.pinned_routes.includes(path)

  await saveMyPreferences(supabase, session.userId, {
    pinned_routes: pinned
      ? current.pinned_routes.filter((route) => route !== path)
      : [...current.pinned_routes, path],
  })

  await logActivity({
    action: 'preferences.updated',
    actorId: session.userId,
    actorRole: session.role,
    entityType: 'studio preferences',
    entityId: session.userId,
    summary: pinned ? `Unpinned ${path}` : `Pinned ${path}`,
  })

  revalidatePath('/studio')
}
