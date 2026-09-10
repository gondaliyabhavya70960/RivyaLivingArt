import { t, type StudioStringKey } from '@/components/studio/strings'
import type { Permission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { searchDocuments } from '@/lib/supabase/repositories/search'
import type { SearchEntityType } from '@/lib/supabase/schemas'

import { registerCommandProvider, type CommandResult } from '../registry'

/**
 * The eight entity providers for the Studio command palette — one per indexed type.
 *
 * ONE FILE, NOT EIGHT, AND THE PHASE DOCUMENT ASKED FOR EIGHT. The deliverable table lists
 * `providers/{products,categories,…}.ts`, which would be eight files differing in three literals
 * each: an entity type, a permission and a group string. Eight copies of the same fifteen lines is
 * eight places for the permission to be got wrong, and the one that matters — `inquiries.read`,
 * which a researcher does NOT hold — would be the one nobody re-read. The table below is the whole
 * configuration and every provider is built from it, so the permission sits beside the type it
 * guards and a reviewer checks eight rows rather than eight files.
 *
 * PERMISSIONS ARE PER PROVIDER AND THE REGISTRY ENFORCES THEM BEFORE THE PROVIDER RUNS. That
 * ordering is the disclosure boundary: a researcher gets no inquiry group, no inquiry count, and
 * no query issued on their behalf — not a filtered-empty group, which would still tell them the
 * group exists.
 *
 * THE SEARCH RUNS AS THE READER, NOT AS THE SERVICE ROLE, and that was a correction rather than
 * the first draft. `search_documents` has one staff-select policy admitting every active role, so
 * the service role would return exactly the same rows a session does — it would buy nothing and put
 * an RLS-bypassing client inside a component that renders. The palette's permission model is finer
 * than the table's (RLS cannot say "may search enquiries but not materials" about one table), so
 * the narrowing happens in the registry BEFORE the provider runs, and the query underneath is the
 * reader's own. Two layers, in the order Phase 04 fixed: permission first, RLS underneath.
 *
 * NOTHING RESEARCH-SHAPED IS REGISTERED HERE. Phases 25, 26 and 28 add their own providers against
 * `research_search_documents`; this file names neither the table nor any research type.
 */

interface EntityProvider {
  readonly id: string
  readonly entityType: SearchEntityType
  readonly permission: Permission
  readonly groupKey: StudioStringKey
  /** Where a result opens. The index stores no Studio path — that is a Studio concern. */
  readonly href: (entityId: string) => string
}

export const ENTITY_PROVIDERS: readonly EntityProvider[] = [
  {
    id: 'entity-products',
    entityType: 'product',
    permission: 'catalog.read',
    groupKey: 'studio.command.groupProducts',
    href: (id) => `/studio/catalog/products/${id}`,
  },
  {
    id: 'entity-categories',
    entityType: 'category',
    permission: 'catalog.read',
    groupKey: 'studio.command.groupCategories',
    href: (id) => `/studio/catalog/categories/${id}`,
  },
  {
    id: 'entity-collections',
    entityType: 'collection',
    permission: 'catalog.read',
    groupKey: 'studio.command.groupCollections',
    href: (id) => `/studio/catalog/collections/${id}`,
  },
  {
    id: 'entity-materials',
    entityType: 'material',
    permission: 'catalog.read',
    groupKey: 'studio.command.groupMaterials',
    href: (id) => `/studio/catalog/materials/${id}`,
  },
  {
    id: 'entity-portfolio',
    entityType: 'portfolio_project',
    permission: 'content.read',
    groupKey: 'studio.command.groupPortfolio',
    href: (id) => `/studio/content/portfolio/${id}`,
  },
  {
    id: 'entity-journal',
    entityType: 'journal_article',
    permission: 'content.read',
    groupKey: 'studio.command.groupJournal',
    href: (id) => `/studio/content/journal/${id}`,
  },
  {
    id: 'entity-media',
    entityType: 'media_asset',
    permission: 'media.read',
    groupKey: 'studio.command.groupMedia',
    href: (id) => `/studio/media/all?asset=${id}`,
  },
  {
    /**
     * THE ONE ROW WHOSE PERMISSION IS NOT HELD BY EVERY ROLE. `inquiries.read` excludes the
     * researcher, deliberately (Phase 20): an enquiry carries a customer's name and phone number.
     * The document itself carries neither — only a reference code, a kind, the related piece's
     * title and a status — but the group's very existence would tell a researcher that enquiries
     * matching their query exist, and the registry drops the provider before it runs.
     */
    id: 'entity-inquiries',
    entityType: 'inquiry',
    permission: 'inquiries.read',
    groupKey: 'studio.command.groupInquiries',
    href: (id) => `/studio/inquiries/all?inquiry=${id}`,
  },
]

export function registerEntityProviders(): void {
  for (const provider of ENTITY_PROVIDERS) {
    registerCommandProvider({
      id: provider.id,
      permission: provider.permission,
      search: async (query): Promise<CommandResult[]> => {
        const hits = await searchDocuments(await createClient(), query, {
          scope: 'STAFF',
          types: [provider.entityType],
          limit: 10,
        })
        return hits.map((hit) => ({
          id: `${provider.id}:${hit.entity_id}`,
          label: hit.title,
          // The subtitle when there is one, otherwise the status — enough to tell two similarly
          // named drafts apart, which is the case the palette is most often used for.
          ...(hit.subtitle === null ? { hint: hit.status } : { hint: hit.subtitle }),
          href: provider.href(hit.entity_id),
          group: t(provider.groupKey),
        }))
      },
    })
  }
}

registerEntityProviders()
