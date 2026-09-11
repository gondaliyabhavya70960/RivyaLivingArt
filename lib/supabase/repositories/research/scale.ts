import type { SupabaseClient } from '@supabase/supabase-js'

import {
  SCALE_BANDS,
  type LargeFormatSource,
  type ScaleBand,
  type ScalePredicate,
  type ScaleRule,
} from '@/lib/scraper/analytics/scale'

import type { Database } from '../../database.types'
import { toRepositoryError } from '../support'

type Client = SupabaseClient<Database>

const ENTITY = 'research scale'

export type ScaleRuleRow = Database['public']['Tables']['research_large_format_rules']['Row']

const RULE_COLUMNS =
  'id, priority, predicate, result_band, result_is_large, is_enabled, notes, status, ' +
  'created_at, updated_at, updated_by'

/**
 * The scale rules, and the classification they write onto a row.
 *
 * THE WHOLE RULE SET IS READ AT ONCE, for `change-rules.ts`'s reason: it is five rows, and
 * resolving order in TypeScript is what lets `classifyScale` be a pure function over a list that a
 * fixture table can exercise with no database at all.
 *
 * ONLY PUBLISHED, ENABLED RULES CLASSIFY ANYTHING. A draft rule is somebody thinking about a
 * threshold; applying it the moment it is typed would re-band a corpus under a colleague who is
 * reading it.
 */

/**
 * A stored predicate, narrowed to the three keys the classifier reads.
 *
 * ANYTHING ELSE IS DROPPED HERE RATHER THAN PASSED THROUGH. `predicate` is jsonb a Studio form
 * writes into, and the guarantee the classifier's header makes — that an invented key is inert —
 * is only true if something narrows the object. This is that something.
 */
function readPredicate(value: unknown): ScalePredicate {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
  const raw = value as Record<string, unknown>
  const predicate: {
    parseState?: ScalePredicate['parseState']
    minLongestAxisMm?: number
    categoryInLargeFormatSet?: boolean
  } = {}

  const parseState = raw['parseState']
  if (
    parseState === 'NOT_PARSED' ||
    parseState === 'PARSED' ||
    parseState === 'AMBIGUOUS' ||
    parseState === 'UNPARSED' ||
    parseState === 'ABSENT'
  ) {
    predicate.parseState = parseState
  }

  const min = raw['minLongestAxisMm']
  if (typeof min === 'number' && Number.isFinite(min) && min > 0) predicate.minLongestAxisMm = min

  const category = raw['categoryInLargeFormatSet']
  if (typeof category === 'boolean') predicate.categoryInLargeFormatSet = category

  return predicate
}

function toRule(row: ScaleRuleRow): ScaleRule {
  const band = row.result_band
  return {
    id: row.id,
    priority: row.priority,
    predicate: readPredicate(row.predicate),
    resultBand:
      band !== null && (SCALE_BANDS as readonly string[]).includes(band)
        ? (band as ScaleBand)
        : null,
    resultIsLarge: row.result_is_large,
    isEnabled: row.is_enabled,
  }
}

export async function readScaleRules(client: Client): Promise<readonly ScaleRule[]> {
  const { data, error } = await client
    .from('research_large_format_rules')
    .select(RULE_COLUMNS)
    .order('priority', { ascending: true })
    .limit(500)
  if (error !== null) throw toRepositoryError(ENTITY, 'read', 'rules', error)
  return ((data ?? []) as unknown as ScaleRuleRow[])
    .filter((row) => row.status === 'PUBLISHED')
    .map(toRule)
}

/** Every rule row, draft included, for the Studio editor. */
export async function listScaleRules(client: Client): Promise<readonly ScaleRuleRow[]> {
  const { data, error } = await client
    .from('research_large_format_rules')
    .select(RULE_COLUMNS)
    .order('priority', { ascending: true })
    .limit(500)
  if (error !== null) throw toRepositoryError(ENTITY, 'list', 'rules', error)
  return (data ?? []) as unknown as ScaleRuleRow[]
}

export async function upsertScaleRule(
  client: Client,
  input: {
    readonly id?: string
    readonly priority: number
    readonly predicate: ScalePredicate
    readonly resultBand: ScaleBand | null
    readonly resultIsLarge: boolean | null
    readonly isEnabled: boolean
    readonly notes: string | null
    readonly status: 'DRAFT' | 'PUBLISHED'
    readonly actorUserId: string
  },
): Promise<void> {
  const row = {
    ...(input.id === undefined ? {} : { id: input.id }),
    priority: input.priority,
    predicate: input.predicate as never,
    result_band: input.resultBand,
    result_is_large: input.resultIsLarge,
    is_enabled: input.isEnabled,
    notes: input.notes,
    status: input.status,
    updated_at: new Date().toISOString(),
    updated_by: input.actorUserId,
  }
  // The upsert key is `priority`, which is unique: editing rule 20 is an update, and adding one at
  // 25 is an insert, without the form having to know which it is doing.
  const { error } = await client
    .from('research_large_format_rules')
    .upsert(row, { onConflict: 'priority' })
  if (error !== null) throw toRepositoryError(ENTITY, 'upsert', String(input.priority), error)
}

/**
 * Write one row's classification.
 *
 * `research.write`, NOT `research.confirm`, and the four columns are the reason: a band, a
 * three-valued verdict, a longest axis and a provenance are all classifications. None of them is a
 * disposition, and this phase writes no `disposition`, no `duplicate_of_id` and no `stage`.
 *
 * TAKES AN ADMIN CLIENT for the same reason `writeNormalizedOverride` does: RLS gates a TABLE, not
 * a COLUMN, and `research_products`' single update policy is written for `research.confirm`. The
 * column split is enforced by the caller's own permission check, which is where it can produce a
 * readable refusal.
 */
export async function writeClassification(
  admin: Client,
  input: {
    readonly productId: string
    readonly band: ScaleBand
    readonly isLargeFormat: boolean | null
    readonly longestAxisMm: number | null
    readonly source: LargeFormatSource
    readonly ruleId: string | null
    readonly actorUserId: string | null
  },
): Promise<void> {
  const { error } = await admin
    .from('research_products')
    .update({
      scale_band: input.band,
      is_large_format: input.isLargeFormat,
      longest_axis_mm: input.longestAxisMm,
      large_format_source: input.source,
      classified_rule_id: input.ruleId,
      classified_at: new Date().toISOString(),
      updated_by: input.actorUserId,
    })
    .eq('id', input.productId)
  if (error !== null) throw toRepositoryError(ENTITY, 'classify', input.productId, error)
}

export interface ScaleRow {
  readonly id: string
  readonly source_id: string
  readonly title_normalized: string | null
  readonly source_url: string
  readonly scale_band: string | null
  readonly is_large_format: boolean | null
  readonly longest_axis_mm: number | null
  readonly large_format_source: string | null
  readonly dimensions_mm: unknown
  readonly dimension_parse_state: string
  readonly material_tokens: readonly string[] | null
  readonly currency: string | null
  readonly price_state: string | null
  readonly price_min_minor: number | null
  readonly matched_category_id: string | null
  readonly availability: string | null
  readonly last_seen_at: string
}

const SCALE_ROW_COLUMNS =
  'id, source_id, title_normalized, source_url, scale_band, is_large_format, longest_axis_mm, ' +
  'large_format_source, dimensions_mm, dimension_parse_state, material_tokens, currency, ' +
  'price_state, price_min_minor, matched_category_id, availability, last_seen_at'

export interface ScaleFilter {
  readonly sourceId?: string
  readonly band?: ScaleBand
  readonly largeOnly?: boolean
  readonly currency?: string
  readonly limit?: number
}

/** How many rows one workspace panel reads. Bounded, and the coverage banner states the bound. */
export const WORKSPACE_LIMIT = 2_000

/**
 * The workspace's row set.
 *
 * IT COMPOSES THE EXPLORER'S COLUMNS RATHER THAN INVENTING A QUERY LAYER. The risk this phase
 * carries, named in its own document, is becoming a second explorer with duplicated filtering — so
 * the filter vocabulary here is deliberately small (source, band, large-only, currency) and every
 * richer filter is the explorer's, reached through a saved view.
 *
 * `largeOnly` USES `is` RATHER THAN `eq`, and the difference is the whole three-valued design:
 * `eq('is_large_format', false)` would silently drop every null, so "not large" would mean "not
 * large that we know of" and the unknown rows would vanish from a count that claims to be complete.
 */
export async function listScaleRows(
  client: Client,
  filter: ScaleFilter = {},
): Promise<readonly ScaleRow[]> {
  let query = client
    .from('research_products')
    .select(SCALE_ROW_COLUMNS)
    .order('longest_axis_mm', { ascending: false, nullsFirst: false })
    .order('id', { ascending: true })
    .limit(filter.limit ?? WORKSPACE_LIMIT)

  if (filter.sourceId !== undefined) query = query.eq('source_id', filter.sourceId)
  if (filter.band !== undefined) query = query.eq('scale_band', filter.band)
  if (filter.largeOnly === true) query = query.is('is_large_format', true)
  if (filter.currency !== undefined) query = query.eq('currency', filter.currency)

  const { data, error } = await query
  if (error !== null) throw toRepositoryError(ENTITY, 'list', 'workspace', error)
  return (data ?? []) as unknown as ScaleRow[]
}

/** Every product the reclassification pass may touch, oldest classification first. */
export async function listClassifiableProducts(
  admin: Client,
  limit = 5_000,
): Promise<
  readonly {
    readonly id: string
    readonly dimensions_mm: unknown
    // NULLABLE, BECAUSE PHASE 28 MADE IT SO for rows written before normalisation ran. The
    // classifier treats anything that is not 'PARSED' as unmeasured, and a null is exactly that.
    readonly dimension_parse_state: string | null
    readonly matched_category_id: string | null
    readonly scale_band: string | null
    readonly large_format_source: string | null
  }[]
> {
  const { data, error } = await admin
    .from('research_products')
    .select(
      'id, dimensions_mm, dimension_parse_state, matched_category_id, scale_band, large_format_source',
    )
    .order('classified_at', { ascending: true, nullsFirst: true })
    .limit(limit)
  if (error !== null) throw toRepositoryError(ENTITY, 'list', 'classifiable', error)
  return data ?? []
}
