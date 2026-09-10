import type { SupabaseClient } from '@supabase/supabase-js'

import type { IssueSeverity } from '@/lib/scraper/validation/rules'

import type { Database } from '../../database.types'
import { toRepositoryError } from '../support'

type Client = SupabaseClient<Database>

const ENTITY = 'research explorer'

export type ExplorerRow = {
  readonly id: string
  readonly source_id: string
  readonly source_url: string
  readonly stage: Database['public']['Enums']['research_stage']
  readonly disposition: Database['public']['Enums']['research_disposition']
  readonly title_normalized: string | null
  readonly currency: string | null
  readonly price_state: string | null
  readonly price_min_minor: number | null
  readonly price_max_minor: number | null
  readonly dimension_parse_state: string | null
  readonly dimensions_mm: unknown
  readonly material_tokens: readonly string[]
  readonly availability: string | null
  readonly matched_category_id: string | null
  readonly match_method: string | null
  readonly match_confidence: number | null
  readonly duplicate_of_id: string | null
  readonly normalized_overrides: unknown
  readonly current_version_id: string | null
  readonly first_seen_at: string
  readonly last_seen_at: string
}

export interface ExplorerFilter {
  readonly sourceId?: string
  readonly stage?: Database['public']['Enums']['research_stage']
  readonly disposition?: Database['public']['Enums']['research_disposition']
  readonly severity?: IssueSeverity
  readonly categoryId?: string
  readonly priceState?: string
  readonly currency?: string
  readonly dimensionParseState?: string
  readonly search?: string
  readonly limit?: number
}

export const EXPLORER_PAGE_SIZE = 100

/**
 * The explorer's query, and the one filter that is not a column.
 *
 * SEVERITY IS RESOLVED IN TWO STEPS RATHER THAN AS AN EMBEDDED FILTER, and the reason is the same
 * one `product-versions.ts` gives about embeddings: PostgREST names an embedded relation after the
 * FOREIGN KEY CONSTRAINT when a table is reachable by more than one, and `research_validation_issues`
 * is reachable from `research_products` and from `research_product_versions`. Putting a migration's
 * constraint identifier inside a select string that nothing typechecks is how `sources.ts` ended up
 * with a column that did not exist sitting in a select list for a whole phase. Two round trips are
 * cheaper than that, and the first of them reads a partial index built for exactly this predicate.
 *
 * THE READ RUNS AS THE SESSION, NOT THE SERVICE ROLE. RLS is the layer under the permission check
 * the page has already made, and a research table has no `anon` policy at all — so a query that
 * bypassed RLS to render a screen would be removing the only protection that survives a bug in the
 * page's own gate.
 */
export async function listExplorerRows(
  client: Client,
  filter: ExplorerFilter = {},
): Promise<readonly ExplorerRow[]> {
  let allowedIds: readonly string[] | null = null

  if (filter.severity !== undefined) {
    const { data, error } = await client
      .from('research_validation_issues')
      .select('research_product_id')
      .eq('severity', filter.severity)
      .eq('is_dismissed', false)
      .limit(20_000)
    if (error !== null) throw toRepositoryError(ENTITY, 'severity', filter.severity, error)
    allowedIds = [...new Set((data ?? []).map((row) => row.research_product_id))]
    // AN EMPTY ANSWER IS AN ANSWER. `in ()` is not valid, and a filter that silently stopped being
    // applied would show every row under a heading saying "errors only".
    if (allowedIds.length === 0) return []
  }

  let query = client
    .from('research_products')
    .select(
      'id, source_id, source_url, stage, disposition, title_normalized, currency, price_state, price_min_minor, price_max_minor, dimension_parse_state, dimensions_mm, material_tokens, availability, matched_category_id, match_method, match_confidence, duplicate_of_id, normalized_overrides, current_version_id, first_seen_at, last_seen_at',
    )
    .order('last_seen_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(filter.limit ?? EXPLORER_PAGE_SIZE)

  if (allowedIds !== null) query = query.in('id', allowedIds)
  if (filter.sourceId !== undefined) query = query.eq('source_id', filter.sourceId)
  if (filter.stage !== undefined) query = query.eq('stage', filter.stage)
  if (filter.disposition !== undefined) query = query.eq('disposition', filter.disposition)
  if (filter.categoryId !== undefined) query = query.eq('matched_category_id', filter.categoryId)
  if (filter.priceState !== undefined) query = query.eq('price_state', filter.priceState)
  if (filter.currency !== undefined) query = query.eq('currency', filter.currency)
  if (filter.dimensionParseState !== undefined) {
    query = query.eq('dimension_parse_state', filter.dimensionParseState)
  }
  if (filter.search !== undefined && filter.search.trim() !== '') {
    // `ilike` on the normalised title. The trigram index serves `similarity()`; a contains-match is
    // what a person typing into a box means, and at this table's size it is a scan nobody notices.
    query = query.ilike('title_normalized', `%${filter.search.trim()}%`)
  }

  const { data, error } = await query
  if (error !== null) throw toRepositoryError(ENTITY, 'list', 'rows', error)
  return (data ?? []) as unknown as ExplorerRow[]
}

export async function getExplorerRow(client: Client, id: string): Promise<ExplorerRow | null> {
  const { data, error } = await client
    .from('research_products')
    .select(
      'id, source_id, source_url, stage, disposition, title_normalized, currency, price_state, price_min_minor, price_max_minor, dimension_parse_state, dimensions_mm, material_tokens, availability, matched_category_id, match_method, match_confidence, duplicate_of_id, normalized_overrides, current_version_id, first_seen_at, last_seen_at',
    )
    .eq('id', id)
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'get', id, error)
  return (data ?? null) as unknown as ExplorerRow | null
}

/**
 * How many rows failed to parse each field, per source.
 *
 * COUNTED FROM THE COLUMNS RATHER THAN FROM THE ISSUES, and the two answer different questions. An
 * issue row says a RULE fired; a parse state says the value was not read. A page with no dimensions
 * at all raises nothing and has nothing to compare — it is `ABSENT`, not a failure — and a
 * data-quality tab built on issue counts alone would report a source with no measurements anywhere
 * as perfectly healthy.
 */
export interface ParseCoverage {
  readonly sourceId: string
  readonly total: number
  readonly dimensionsUnparsed: number
  readonly dimensionsAmbiguous: number
  readonly priceUnknown: number
  readonly noMaterials: number
  readonly unmatched: number
}

export async function parseCoverage(client: Client): Promise<readonly ParseCoverage[]> {
  const { data, error } = await client
    .from('research_products')
    .select('source_id, dimension_parse_state, price_state, material_tokens, matched_category_id')
    .neq('stage', 'RAW')
    .limit(20_000)
  if (error !== null) throw toRepositoryError(ENTITY, 'coverage', 'all', error)

  const bySource = new Map<string, ParseCoverage>()
  for (const row of data ?? []) {
    const current: ParseCoverage = bySource.get(row.source_id) ?? {
      sourceId: row.source_id,
      total: 0,
      dimensionsUnparsed: 0,
      dimensionsAmbiguous: 0,
      priceUnknown: 0,
      noMaterials: 0,
      unmatched: 0,
    }
    bySource.set(row.source_id, {
      ...current,
      total: current.total + 1,
      dimensionsUnparsed:
        current.dimensionsUnparsed + (row.dimension_parse_state === 'UNPARSED' ? 1 : 0),
      dimensionsAmbiguous:
        current.dimensionsAmbiguous + (row.dimension_parse_state === 'AMBIGUOUS' ? 1 : 0),
      priceUnknown: current.priceUnknown + (row.price_state === 'UNKNOWN' ? 1 : 0),
      noMaterials: current.noMaterials + (row.material_tokens.length === 0 ? 1 : 0),
      unmatched: current.unmatched + (row.matched_category_id === null ? 1 : 0),
    })
  }
  return [...bySource.values()].sort((a, b) => b.total - a.total)
}
