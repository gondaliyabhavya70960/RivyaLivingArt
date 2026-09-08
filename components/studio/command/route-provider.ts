import { t } from '@/components/studio/strings'
import { STUDIO_LEAVES } from '@/lib/auth/studio-nav'
import type { Permission } from '@/lib/auth/permissions'
import { registerCommandProvider, type CommandResult } from './registry'

/**
 * The only provider Phase 05 ships: jump to a Studio route.
 *
 * It is also the reference implementation. Later phases follow this shape — declare the permission
 * the results require, search, return at most a handful — and the registry enforces the rest.
 *
 * IT SEARCHES LABELS AND PATHS BOTH. Somebody who knows the Studio types "products"; somebody who
 * knows the URL types "catalog/prod". Matching only labels makes the palette useless to the second
 * person, which is the one most likely to be using a keyboard shortcut in the first place.
 *
 * NO PERMISSION FILTERING HERE, and that is not an omission: the registry skips a provider whose
 * permission the role lacks, but every ROUTE has its own permission, which is finer. The filter is
 * therefore applied per result below, against the leaf's own permission — otherwise `studio.access`
 * (held by everyone) would let a viewer see `/studio/system/users` in the palette.
 */
export const ROUTE_PROVIDER_ID = 'studio-routes'

/** Case-insensitive substring, on the label and on the path. */
function matches(query: string, label: string, href: string): boolean {
  const needle = query.toLowerCase()
  return label.toLowerCase().includes(needle) || href.toLowerCase().includes(needle)
}

export function searchRoutes(query: string, held: readonly Permission[]): CommandResult[] {
  return STUDIO_LEAVES.filter((leaf) => held.includes(leaf.permission))
    .filter((leaf) => matches(query, t(leaf.labelKey), leaf.href))
    .map((leaf) => ({
      id: leaf.href,
      label: t(leaf.labelKey),
      hint: leaf.href,
      href: leaf.href,
      group: t('studio.command.groupRoutes'),
    }))
}

/**
 * Registered once, at module load. The role arrives per search through the context, so there is no
 * per-request registration and no module-level state that differs between readers.
 */
registerCommandProvider({
  id: ROUTE_PROVIDER_ID,
  // Every staff member may navigate; WHICH routes they see is decided per result above.
  permission: 'studio.access',
  search: async (query, context) => searchRoutes(query, context.held),
})
