import { t, type StudioStringKey } from '@/components/studio/strings'
import type { Permission } from '@/lib/auth/permissions'
import {
  searchResearchDocuments,
  type ResearchEntityType,
} from '@/lib/supabase/repositories/research/search'
import { createClient } from '@/lib/supabase/server'

import { registerCommandProvider, type CommandResult } from '../registry'

/**
 * The research providers for the Studio command palette.
 *
 * A SEPARATE FILE FROM THE EIGHT PUBLIC ONES, AND THE SEPARATION IS THE POINT. `providers/index.ts`
 * ends with the sentence "Nothing research-shaped is registered here", and that stays true: the two
 * corpora are two tables, two repository functions and two provider files, so there is no place
 * where a wrong argument mixes them. Phase 23 built the second table for exactly this moment.
 *
 * BOTH DECLARE `research.read`, which the registry enforces BEFORE the provider runs. An editor —
 * the one role that does not hold it — gets no research group, no count, and no query issued on
 * their behalf. Not a filtered-empty group, which would still tell them the group exists.
 *
 * TWO PROVIDERS AND NOT THREE. `research_product` is indexed by 0234's trigger and will be
 * searchable the moment Phase 28 puts real products in it, but no provider is registered for it
 * here: at this phase a research product is a URL and a stage, so a palette result would be a bare
 * link with nothing to recognise it by. Phase 29 builds the explorer those results should open,
 * and registers the provider that reaches it.
 */

interface ResearchProvider {
  readonly id: string
  readonly entityType: ResearchEntityType
  readonly permission: Permission
  readonly groupKey: StudioStringKey
  readonly href: (row: { entity_id: string; url_path: string | null }) => string
}

export const RESEARCH_PROVIDERS: readonly ResearchProvider[] = [
  {
    id: 'research-sources',
    entityType: 'research_source',
    permission: 'research.read',
    groupKey: 'studio.research.sourcesHeading',
    // The index stores the path the refresh function computed, so the Studio route lives in one
    // place; the fallback is the list, which is always a correct destination for a source.
    href: (row) => row.url_path ?? '/studio/research/sources',
  },
  {
    id: 'research-runs',
    entityType: 'research_run',
    permission: 'research.read',
    groupKey: 'studio.research.runsHeading',
    href: (row) => row.url_path ?? `/studio/research/runs/${row.entity_id}`,
  },
]

export function registerResearchProviders(): void {
  for (const provider of RESEARCH_PROVIDERS) {
    registerCommandProvider({
      id: provider.id,
      permission: provider.permission,
      search: async (query): Promise<CommandResult[]> => {
        const hits = await searchResearchDocuments(await createClient(), query, {
          types: [provider.entityType],
          limit: 10,
        })
        return hits.map((hit) => ({
          id: `${provider.id}:${hit.entity_id}`,
          label: hit.title,
          // THE STATUS RATHER THAN THE SUBTITLE, which inverts the public providers' choice and is
          // right here: for a source the status is its POLICY REVIEW, and "may we read this" is
          // the first thing anybody looking one up wants to know.
          hint: hit.status,
          href: provider.href({ entity_id: hit.entity_id, url_path: hit.url_path }),
          group: t(provider.groupKey),
        }))
      },
    })
  }
}

registerResearchProviders()
