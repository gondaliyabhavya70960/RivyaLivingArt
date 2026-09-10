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
 * THREE PROVIDERS NOW, AND THE THIRD ARRIVED WHEN IT HAD SOMETHING TO SHOW. Phase 25 registered
 * two and wrote, here, that `research_product` was indexed but not offered "because at this phase a
 * research product is a URL and a stage, so a palette result would be a bare link with nothing to
 * recognise it by". Phase 28 gives it a normalised title, a source name and a stage, and builds the
 * explorer drawer a result opens — so the condition that held it back is gone and the provider is
 * registered. That note said Phase 29 would do it; the explorer landed a phase earlier than the
 * plan expected, which is the only reason this is early rather than late (amendment A28).
 *
 * A THIRD ROW IN THE TABLE RATHER THAN THE `providers/research-products.ts` THE PHASE DOCUMENT
 * NAMES, and `providers/index.ts` has already made the argument at length: eight near-identical
 * files differing in three literals each is eight places to get a permission wrong, and the one
 * that matters is the one nobody re-reads. This file is that argument applied to research; a
 * fourth file holding six lines would contradict the file it sits beside. Recorded as amendment
 * A28 rather than done quietly.
 *
 * NOTHING HERE BECOMES PUBLIC. `research_search_documents` has no `anon` policy (I2), and the
 * public `search_documents` cannot hold a research row at all — its `entity_type` allowlist does
 * not admit one, by a constraint Phase 23 wrote three phases before there was anything to index.
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
  {
    // FEAT §18's *Scraped Products* scope. `0260`'s search function writes `url_path` as
    // `/studio/research/explorer?row=<id>`, so a result opens the ROW's drawer rather than the
    // list — a palette hit that landed on an unfiltered table would make the searcher find the row
    // twice.
    id: 'research-products',
    entityType: 'research_product',
    permission: 'research.read',
    groupKey: 'studio.research.explorerHeading',
    href: (row) => row.url_path ?? `/studio/research/explorer?row=${row.entity_id}`,
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
