import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../../database.types'
import { toRepositoryError } from '../support'

type Client = SupabaseClient<Database>

const ENTITY = 'research search document'

export type ResearchSearchRow = Database['public']['Tables']['research_search_documents']['Row']

export type ResearchEntityType = 'research_product' | 'research_source' | 'research_run'

/**
 * Search the research corpus.
 *
 * A SEPARATE FUNCTION FROM `searchDocuments`, AGAINST A SEPARATE TABLE, AND THAT IS THE WHOLE
 * DESIGN. The public index and the research index share a shape and nothing else: no query touches
 * both, no union exists, and the two `entity_type` allowlists have an empty intersection. A single
 * function with a `corpus` parameter would be one wrong argument away from putting a competitor's
 * product in a visitor's search results, which is precisely the change Phase 23 built two tables
 * to make impossible.
 *
 * IT USES `ilike` RATHER THAN THE tsvector, deliberately, and only for now. The corpus at this
 * phase is a handful of sources and their runs — tens of rows, not thousands — and a trigram-backed
 * `ilike` over an indexed `title` is both simpler and better at the thing the palette actually does:
 * matching a partial word as somebody types. `search_vector` is populated and indexed and waiting;
 * Phase 28, which fills this table with real products, is the phase that will need it and the phase
 * that can measure whether it helps.
 */
export async function searchResearchDocuments(
  client: Client,
  query: string,
  options: { readonly types?: readonly ResearchEntityType[]; readonly limit?: number } = {},
): Promise<ResearchSearchRow[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  // `%` and `_` are wildcards in LIKE. A query containing one would otherwise match far more than
  // the operator typed — `_` matching any character is the surprising one.
  const escaped = trimmed.replace(/[%_\\]/g, (character) => `\\${character}`)

  let request = client
    .from('research_search_documents')
    .select('*')
    .ilike('title', `%${escaped}%`)
    .order('indexed_at', { ascending: false })
    .limit(options.limit ?? 10)

  if (options.types !== undefined && options.types.length > 0) {
    request = request.in('entity_type', options.types as string[])
  }

  const { data, error } = await request
  if (error) throw toRepositoryError(ENTITY, 'search', trimmed, error)
  return (data ?? []) as unknown as ResearchSearchRow[]
}
