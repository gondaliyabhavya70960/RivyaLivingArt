import type { SupabaseClient } from '@supabase/supabase-js'

import type { CoverageRecord } from '@/lib/scraper/analytics/coverage'
import type { AnalyticsRow } from '@/lib/scraper/analytics/rows'
import type {
  DimensionsMm,
  ParseState,
  ResearchPriceState,
} from '@/lib/scraper/normalization/schema'
import {
  analyticsSnapshotRowSchema,
  comparisonMemberRowSchema,
  comparisonSetRowSchema,
  metricCoverageRowSchema,
  type AnalyticsPayload,
  type AnalyticsSnapshotRow,
  type ComparisonMemberRow,
  type ComparisonSetRow,
  type MemberType,
  type MetricCoverageRow,
  type MetricFamily,
  type ScopeType,
} from '@/lib/supabase/schemas/research-analytics'

import type { Database } from '../../database.types'
import { parseRow, parseRows, toRepositoryError } from '../support'

type Client = SupabaseClient<Database>

const ENTITY = 'research analytics'

const SET_COLUMNS =
  'id, name, slug, description, scope_note, band_rule, band_edges, last_computed_at, status, ' +
  'created_at, created_by, updated_at, updated_by'
const MEMBER_COLUMNS =
  'id, set_id, member_type, source_id, research_product_id, position, note, created_at, created_by'
const SNAPSHOT_COLUMNS =
  'id, scope_type, scope_id, metric_family, currency, payload, row_count, computed_at, ' +
  'computed_by, input_run_max_id'
const COVERAGE_COLUMNS =
  'id, snapshot_id, metric_key, n, denominator, coverage_pct, excluded_reasons, as_of'

/**
 * Comparison sets, their members, and the snapshots computed over them.
 *
 * TWO CLIENTS, AND THE SPLIT IS THE SECURITY MODEL. Sets and members are written as the PERSON —
 * the session client — so RLS judges every write against `research.write`. Snapshots and coverage
 * have NO session write policy at all and are written through the admin client by the CLI, the
 * cron and the Studio recompute action; a session that could insert a snapshot could insert a
 * market figure nobody computed. `writeSnapshot` takes a parameter named `admin` for that reason
 * and the reason is repeated at its call sites.
 *
 * THE ANALYSIS ROWS ARE FETCHED HERE AND COMPUTED ELSEWHERE. `listAnalyticsRows` maps
 * `research_products` into `AnalyticsRow` once; the four pure modules never see a Supabase type.
 * Only rows with `disposition = 'NONE'` are analysed — a row a person rejected, ignored or marked
 * duplicate is not part of the market being described.
 */

// --- sets -----------------------------------------------------------------------------------------

export async function listComparisonSets(client: Client): Promise<readonly ComparisonSetRow[]> {
  const { data, error } = await client
    .from('research_comparison_sets')
    .select(SET_COLUMNS)
    .order('updated_at', { ascending: false })
    .limit(500)
  if (error !== null) throw toRepositoryError(ENTITY, 'list', 'sets', error)
  return parseRows(ENTITY, comparisonSetRowSchema, data ?? [])
}

export async function getComparisonSet(
  client: Client,
  id: string,
): Promise<ComparisonSetRow | null> {
  const { data, error } = await client
    .from('research_comparison_sets')
    .select(SET_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'get', id, error)
  return data === null ? null : parseRow(ENTITY, comparisonSetRowSchema, data)
}

export interface ComparisonSetInput {
  readonly name: string
  readonly slug: string
  readonly description: string | null
  readonly scopeNote: string | null
  readonly bandRule: 'QUANTILE' | 'FIXED'
  readonly bandEdges: readonly number[] | null
  readonly actorUserId: string
}

export async function createComparisonSet(
  client: Client,
  input: ComparisonSetInput,
): Promise<ComparisonSetRow> {
  const { data, error } = await client
    .from('research_comparison_sets')
    .insert({
      name: input.name,
      slug: input.slug,
      description: input.description,
      scope_note: input.scopeNote,
      band_rule: input.bandRule,
      band_edges: input.bandEdges === null ? null : [...input.bandEdges],
      created_by: input.actorUserId,
      updated_by: input.actorUserId,
    })
    .select(SET_COLUMNS)
    .single()
  if (error !== null) throw toRepositoryError(ENTITY, 'create', input.slug, error)
  return parseRow(ENTITY, comparisonSetRowSchema, data)
}

export async function updateComparisonSet(
  client: Client,
  id: string,
  input: Omit<ComparisonSetInput, 'slug'>,
): Promise<void> {
  const { error } = await client
    .from('research_comparison_sets')
    .update({
      name: input.name,
      description: input.description,
      scope_note: input.scopeNote,
      band_rule: input.bandRule,
      band_edges: input.bandEdges === null ? null : [...input.bandEdges],
      updated_at: new Date().toISOString(),
      updated_by: input.actorUserId,
    })
    .eq('id', id)
  if (error !== null) throw toRepositoryError(ENTITY, 'update', id, error)
}

export async function deleteComparisonSet(client: Client, id: string): Promise<void> {
  const { error } = await client.from('research_comparison_sets').delete().eq('id', id)
  if (error !== null) throw toRepositoryError(ENTITY, 'delete', id, error)
}

/** Stamp the set's `last_computed_at`. Admin, because it runs beside the snapshot write. */
export async function markSetComputed(admin: Client, id: string, at: string): Promise<void> {
  const { error } = await admin
    .from('research_comparison_sets')
    .update({ last_computed_at: at })
    .eq('id', id)
  if (error !== null) throw toRepositoryError(ENTITY, 'mark computed', id, error)
}

// --- members ------------------------------------------------------------------------------------

export async function listMembers(
  client: Client,
  setId: string,
): Promise<readonly ComparisonMemberRow[]> {
  const { data, error } = await client
    .from('research_comparison_members')
    .select(MEMBER_COLUMNS)
    .eq('set_id', setId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(2000)
  if (error !== null) throw toRepositoryError(ENTITY, 'list', 'members', error)
  return parseRows(ENTITY, comparisonMemberRowSchema, data ?? [])
}

export async function addMember(
  client: Client,
  input: {
    readonly setId: string
    readonly memberType: MemberType
    readonly sourceId: string | null
    readonly researchProductId: string | null
    readonly position: number
    readonly note: string | null
    readonly actorUserId: string
  },
): Promise<void> {
  const { error } = await client.from('research_comparison_members').insert({
    set_id: input.setId,
    member_type: input.memberType,
    source_id: input.sourceId,
    research_product_id: input.researchProductId,
    position: input.position,
    note: input.note,
    created_by: input.actorUserId,
  })
  if (error !== null) throw toRepositoryError(ENTITY, 'add member', input.setId, error)
}

export async function removeMember(client: Client, setId: string, memberId: string): Promise<void> {
  const { error } = await client
    .from('research_comparison_members')
    .delete()
    .eq('id', memberId)
    .eq('set_id', setId)
  if (error !== null) throw toRepositoryError(ENTITY, 'remove member', memberId, error)
}

/** Re-number members in the given order. Ids not in the list keep their position. */
export async function reorderMembers(
  client: Client,
  setId: string,
  orderedIds: readonly string[],
): Promise<void> {
  for (const [index, id] of orderedIds.entries()) {
    const { error } = await client
      .from('research_comparison_members')
      .update({ position: index })
      .eq('id', id)
      .eq('set_id', setId)
    if (error !== null) throw toRepositoryError(ENTITY, 'reorder', id, error)
  }
}

// --- the rows an analysis reads --------------------------------------------------------------------

const ROW_COLUMNS =
  'id, source_id, matched_category_id, is_large_format, currency, price_state, price_min_minor, ' +
  'price_max_minor, dimensions_mm, dimension_parse_state, longest_axis_mm, first_seen_at, ' +
  'last_seen_at'

type RawRow = {
  id: string
  source_id: string
  matched_category_id: string | null
  is_large_format: boolean | null
  currency: string | null
  price_state: string | null
  price_min_minor: number | null
  price_max_minor: number | null
  dimensions_mm: unknown
  dimension_parse_state: string | null
  longest_axis_mm: number | null
  first_seen_at: string
  last_seen_at: string
}

export type AnalyticsScope =
  | { readonly type: 'CORPUS' }
  | { readonly type: 'SOURCE'; readonly sourceId: string }
  | { readonly type: 'CATEGORY'; readonly categoryId: string }
  | {
      readonly type: 'SET'
      readonly sourceIds: readonly string[]
      readonly productIds: readonly string[]
    }

export const ANALYSIS_ROW_LIMIT = 20_000

function toAnalyticsRow(raw: RawRow, categorySlugs: ReadonlyMap<string, string>): AnalyticsRow {
  const parseState = (raw.dimension_parse_state ?? 'ABSENT') as ParseState
  return {
    id: raw.id,
    sourceId: raw.source_id,
    matchedCategoryId: raw.matched_category_id,
    categorySlug:
      raw.matched_category_id === null
        ? null
        : (categorySlugs.get(raw.matched_category_id) ?? null),
    isLargeFormat: raw.is_large_format,
    currency: raw.currency,
    priceState: raw.price_state as ResearchPriceState | null,
    priceMinMinor: raw.price_min_minor,
    priceMaxMinor: raw.price_max_minor,
    dimensionsMm:
      raw.dimensions_mm !== null && typeof raw.dimensions_mm === 'object'
        ? (raw.dimensions_mm as DimensionsMm)
        : null,
    dimensionParseState: parseState,
    longestAxisMm: raw.longest_axis_mm,
    firstSeenAt: raw.first_seen_at,
    lastSeenAt: raw.last_seen_at,
  }
}

/**
 * The rows in scope, mapped once. Only `disposition = 'NONE'` rows — a rejected, ignored or
 * duplicate row is not part of the market being described. A SET scope is the union of its whole
 * sources and its individual products, deduplicated by id.
 */
export async function listAnalyticsRows(
  client: Client,
  scope: AnalyticsScope,
  categorySlugs: ReadonlyMap<string, string>,
): Promise<readonly AnalyticsRow[]> {
  const base = () =>
    client
      .from('research_products')
      .select(ROW_COLUMNS)
      .eq('disposition', 'NONE')
      .order('id', { ascending: true })
      .limit(ANALYSIS_ROW_LIMIT)

  const run = async (query: ReturnType<typeof base>): Promise<RawRow[]> => {
    const { data, error } = await query
    if (error !== null) throw toRepositoryError(ENTITY, 'rows', scope.type, error)
    return (data ?? []) as unknown as RawRow[]
  }

  let raws: RawRow[]
  switch (scope.type) {
    case 'CORPUS':
      raws = await run(base())
      break
    case 'SOURCE':
      raws = await run(base().eq('source_id', scope.sourceId))
      break
    case 'CATEGORY':
      raws = await run(base().eq('matched_category_id', scope.categoryId))
      break
    case 'SET': {
      const bySource =
        scope.sourceIds.length === 0 ? [] : await run(base().in('source_id', [...scope.sourceIds]))
      const byProduct =
        scope.productIds.length === 0 ? [] : await run(base().in('id', [...scope.productIds]))
      const seen = new Map<string, RawRow>()
      for (const raw of [...bySource, ...byProduct]) seen.set(raw.id, raw)
      raws = [...seen.values()]
      break
    }
  }
  return raws.map((raw) => toAnalyticsRow(raw, categorySlugs))
}

/** The newest run id the corpus has seen, stamped on every snapshot as `input_run_max_id`. */
export async function latestRunId(client: Client): Promise<string | null> {
  const { data, error } = await client
    .from('research_runs')
    .select('id')
    .order('queued_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'latest run', 'runs', error)
  return data?.id ?? null
}

// --- snapshots ----------------------------------------------------------------------------------

export interface SnapshotInput {
  readonly scopeType: ScopeType
  readonly scopeId: string | null
  readonly metricFamily: MetricFamily
  readonly currency: string | null
  readonly payload: AnalyticsPayload
  readonly rowCount: number
  readonly computedAt: string
  readonly computedBy: string | null
  readonly inputRunMaxId: string | null
  readonly coverage: readonly CoverageRecord[]
}

/**
 * One snapshot and its coverage rows. ADMIN ONLY — the tables have no session write policy, which
 * is the design and not an omission (see the header).
 */
export async function writeSnapshot(admin: Client, input: SnapshotInput): Promise<string> {
  const { data, error } = await admin
    .from('research_analytics_snapshots')
    .insert({
      scope_type: input.scopeType,
      scope_id: input.scopeId,
      metric_family: input.metricFamily,
      currency: input.currency,
      payload: input.payload as never,
      row_count: input.rowCount,
      computed_at: input.computedAt,
      computed_by: input.computedBy,
      input_run_max_id: input.inputRunMaxId,
    })
    .select('id')
    .single()
  if (error !== null) throw toRepositoryError(ENTITY, 'write snapshot', input.metricFamily, error)

  const snapshotId = data.id
  const rows = input.coverage.map((record) => ({
    snapshot_id: snapshotId,
    metric_key: record.metricKey,
    n: record.n,
    denominator: record.denominator,
    excluded_reasons: record.excludedReasons as never,
    as_of: record.asOf,
  }))
  if (rows.length > 0) {
    const { error: coverageError } = await admin.from('research_metric_coverage').insert(rows)
    if (coverageError !== null) {
      throw toRepositoryError(ENTITY, 'write coverage', snapshotId, coverageError)
    }
  }
  return snapshotId
}

export interface LatestSnapshotFilter {
  readonly scopeType: ScopeType
  readonly scopeId: string | null
  readonly metricFamily?: MetricFamily
}

/**
 * The newest snapshot per (family, currency) for a scope. Read as the session so RLS applies —
 * this is what the workbench and the dashboard render instead of scanning the corpus.
 */
export async function latestSnapshots(
  client: Client,
  filter: LatestSnapshotFilter,
): Promise<readonly AnalyticsSnapshotRow[]> {
  let query = client
    .from('research_analytics_snapshots')
    .select(SNAPSHOT_COLUMNS)
    .eq('scope_type', filter.scopeType)
    .order('computed_at', { ascending: false })
    .limit(200)
  query =
    filter.scopeId === null ? query.is('scope_id', null) : query.eq('scope_id', filter.scopeId)
  if (filter.metricFamily !== undefined) query = query.eq('metric_family', filter.metricFamily)
  const { data, error } = await query
  if (error !== null) throw toRepositoryError(ENTITY, 'latest', filter.scopeType, error)
  const rows = parseRows(ENTITY, analyticsSnapshotRowSchema, data ?? [])
  // Newest per (family, currency): the list is already newest-first, so the first seen wins.
  const seen = new Set<string>()
  return rows.filter((row) => {
    const key = `${row.metric_family}:${row.currency ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Every snapshot for a scope, newest first — the history a set carries. */
export async function listSnapshotHistory(
  client: Client,
  filter: LatestSnapshotFilter,
  limit = 50,
): Promise<readonly AnalyticsSnapshotRow[]> {
  let query = client
    .from('research_analytics_snapshots')
    .select(SNAPSHOT_COLUMNS)
    .eq('scope_type', filter.scopeType)
    .order('computed_at', { ascending: false })
    .limit(limit)
  query =
    filter.scopeId === null ? query.is('scope_id', null) : query.eq('scope_id', filter.scopeId)
  if (filter.metricFamily !== undefined) query = query.eq('metric_family', filter.metricFamily)
  const { data, error } = await query
  if (error !== null) throw toRepositoryError(ENTITY, 'history', filter.scopeType, error)
  return parseRows(ENTITY, analyticsSnapshotRowSchema, data ?? [])
}

export async function listCoverageForSnapshots(
  client: Client,
  snapshotIds: readonly string[],
): Promise<readonly MetricCoverageRow[]> {
  if (snapshotIds.length === 0) return []
  const { data, error } = await client
    .from('research_metric_coverage')
    .select(COVERAGE_COLUMNS)
    .in('snapshot_id', [...snapshotIds])
    .limit(2000)
  if (error !== null) throw toRepositoryError(ENTITY, 'coverage', 'snapshots', error)
  return parseRows(ENTITY, metricCoverageRowSchema, data ?? [])
}

/** Per-source captured / priced / parsed counts for the dashboard's coverage panel. */
export interface SourceCoverageCounts {
  readonly sourceId: string
  readonly captured: number
  readonly priced: number
  readonly parsed: number
}

export async function countSourceCoverage(
  client: Client,
): Promise<readonly SourceCoverageCounts[]> {
  const { data, error } = await client
    .from('research_products')
    .select('source_id, price_state, price_min_minor, dimension_parse_state')
    .eq('disposition', 'NONE')
    .limit(ANALYSIS_ROW_LIMIT)
  if (error !== null) throw toRepositoryError(ENTITY, 'source coverage', 'products', error)
  const counts = new Map<string, { captured: number; priced: number; parsed: number }>()
  for (const row of (data ?? []) as {
    source_id: string
    price_state: string | null
    price_min_minor: number | null
    dimension_parse_state: string | null
  }[]) {
    const entry = counts.get(row.source_id) ?? { captured: 0, priced: 0, parsed: 0 }
    entry.captured += 1
    if (
      (row.price_state === 'FIXED' || row.price_state === 'STARTING_FROM') &&
      row.price_min_minor !== null
    ) {
      entry.priced += 1
    }
    if (row.dimension_parse_state === 'PARSED') entry.parsed += 1
    counts.set(row.source_id, entry)
  }
  return [...counts.entries()].map(([sourceId, entry]) => ({ sourceId, ...entry }))
}
