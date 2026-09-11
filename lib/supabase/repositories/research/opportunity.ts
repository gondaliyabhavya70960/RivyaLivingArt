import type { SupabaseClient } from '@supabase/supabase-js'

import { quantileEdges, bandIndex } from '@/lib/scraper/analytics/bands'
import {
  densityKey,
  type OccupiedBands,
  type ScoringContext,
  type ScoringRow,
} from '@/lib/scraper/analytics/opportunity/context'
import {
  scoringModelDocumentSchema,
  type ScoringModel,
  type ScoringModelDocument,
} from '@/lib/scraper/analytics/opportunity/model'
import type { ScoreResult } from '@/lib/scraper/analytics/opportunity/score'
import { PRICED_STATES } from '@/lib/scraper/analytics/price-architecture'
import type {
  DimensionsMm,
  ParseState,
  ResearchPriceState,
} from '@/lib/scraper/normalization/schema'

import type { Database } from '../../database.types'
import { toRepositoryError } from '../support'

type Client = SupabaseClient<Database>

const ENTITY = 'research opportunity'

/**
 * Models, scores, components — and the context the signals read.
 *
 * THE FIRST-PARTY SIDE IS READ, NEVER JOINED AND NEVER WRITTEN. `publishedCatalogueCounts` and
 * `materialVocabulary` are `select`s on `products` and `materials`; the comparison with a research
 * row happens in `lib/scraper/analytics/opportunity/signals/`, in TypeScript. This module imports no
 * first-party repository (the no-auto-import guard) and writes no first-party table (I4).
 *
 * TWO CLIENTS, AS EVERY RESEARCH REPOSITORY SINCE PHASE 28. Models are written as the PERSON under
 * `research.score.manage`; scores and components have no session write policy and are written by
 * the service role — the CLI, the cron and the Studio recompute action.
 */

export type ScoringModelRow = Database['public']['Tables']['research_scoring_models']['Row']
export type OpportunityScoreRow = Database['public']['Tables']['research_opportunity_scores']['Row']
export type OpportunityComponentRow =
  Database['public']['Tables']['research_opportunity_components']['Row']

const MODEL_COLUMNS =
  'id, version, name, description, signals, weights_total, min_confidence, lifecycle, activated_at, ' +
  'activated_by, retired_at, created_at, created_by, updated_at, updated_by'
const SCORE_COLUMNS =
  'id, research_product_id, model_id, model_version, score, raw, confidence, completeness, state, ' +
  'analytics_snapshot_id, computed_at, computed_by'
const COMPONENT_COLUMNS =
  'id, score_id, signal_key, raw_input, normalised, weight, contribution, included, exclusion_reason'

// --- models -------------------------------------------------------------------------------------

export function toScoringModel(row: ScoringModelRow): ScoringModel {
  const signals = scoringModelDocumentSchema.parse(row.signals)
  return {
    id: row.id,
    version: row.version,
    name: row.name,
    lifecycle: row.lifecycle as ScoringModel['lifecycle'],
    minConfidence: Number(row.min_confidence),
    signals,
  }
}

export async function listScoringModels(client: Client): Promise<readonly ScoringModelRow[]> {
  const { data, error } = await client
    .from('research_scoring_models')
    .select(MODEL_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error !== null) throw toRepositoryError(ENTITY, 'list', 'models', error)
  return (data ?? []) as unknown as ScoringModelRow[]
}

export async function getScoringModel(client: Client, id: string): Promise<ScoringModelRow | null> {
  const { data, error } = await client
    .from('research_scoring_models')
    .select(MODEL_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'get', id, error)
  return (data ?? null) as unknown as ScoringModelRow | null
}

export async function getScoringModelByVersion(
  client: Client,
  version: string,
): Promise<ScoringModelRow | null> {
  const { data, error } = await client
    .from('research_scoring_models')
    .select(MODEL_COLUMNS)
    .eq('version', version)
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'get', version, error)
  return (data ?? null) as unknown as ScoringModelRow | null
}

export async function getActiveScoringModel(client: Client): Promise<ScoringModelRow | null> {
  const { data, error } = await client
    .from('research_scoring_models')
    .select(MODEL_COLUMNS)
    .eq('lifecycle', 'ACTIVE')
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'active', 'models', error)
  return (data ?? null) as unknown as ScoringModelRow | null
}

export async function createDraftModel(
  client: Client,
  input: {
    readonly version: string
    readonly name: string
    readonly description: string | null
    readonly signals: ScoringModelDocument
    readonly minConfidence: number
    readonly actorUserId: string
  },
): Promise<string> {
  const { data, error } = await client
    .from('research_scoring_models')
    .insert({
      version: input.version,
      name: input.name,
      description: input.description,
      signals: input.signals as never,
      weights_total: input.signals.reduce((sum, signal) => sum + signal.weight, 0),
      min_confidence: input.minConfidence,
      lifecycle: 'DRAFT',
      created_by: input.actorUserId,
      updated_by: input.actorUserId,
    })
    .select('id')
    .single()
  if (error !== null) throw toRepositoryError(ENTITY, 'create', input.version, error)
  return data.id
}

export async function updateDraftModel(
  client: Client,
  id: string,
  input: {
    readonly name: string
    readonly description: string | null
    readonly signals: ScoringModelDocument
    readonly minConfidence: number
    readonly actorUserId: string
  },
): Promise<void> {
  const { error } = await client
    .from('research_scoring_models')
    .update({
      name: input.name,
      description: input.description,
      signals: input.signals as never,
      weights_total: input.signals.reduce((sum, signal) => sum + signal.weight, 0),
      min_confidence: input.minConfidence,
      updated_at: new Date().toISOString(),
      updated_by: input.actorUserId,
    })
    .eq('id', id)
    .eq('lifecycle', 'DRAFT')
  if (error !== null) throw toRepositoryError(ENTITY, 'update', id, error)
}

/**
 * Activate a draft: retire the current ACTIVE model first, then flip the draft. Two statements as
 * the person, so RLS judges both; the partial unique index refuses a second ACTIVE if the first
 * statement did not run.
 */
export async function activateModel(
  client: Client,
  id: string,
  actorUserId: string,
): Promise<void> {
  const now = new Date().toISOString()
  const { error: retireError } = await client
    .from('research_scoring_models')
    .update({ lifecycle: 'RETIRED', retired_at: now, updated_at: now, updated_by: actorUserId })
    .eq('lifecycle', 'ACTIVE')
  if (retireError !== null) throw toRepositoryError(ENTITY, 'retire', 'active', retireError)
  const { error } = await client
    .from('research_scoring_models')
    .update({
      lifecycle: 'ACTIVE',
      activated_at: now,
      activated_by: actorUserId,
      updated_at: now,
      updated_by: actorUserId,
    })
    .eq('id', id)
    .eq('lifecycle', 'DRAFT')
  if (error !== null) throw toRepositoryError(ENTITY, 'activate', id, error)
}

// --- scores -------------------------------------------------------------------------------------

export interface ScoreWrite {
  readonly productId: string
  readonly modelId: string
  readonly modelVersion: string
  readonly result: ScoreResult
  readonly analyticsSnapshotId: string | null
  readonly computedAt: string
  readonly computedBy: string | null
}

/** ADMIN ONLY — the tables have no session write policy. One score row and its component rows. */
export async function writeScore(admin: Client, input: ScoreWrite): Promise<string> {
  const { data, error } = await admin
    .from('research_opportunity_scores')
    .insert({
      research_product_id: input.productId,
      model_id: input.modelId,
      model_version: input.modelVersion,
      score: input.result.score,
      raw: input.result.raw,
      confidence: input.result.confidence,
      completeness: input.result.completeness,
      state: input.result.state,
      analytics_snapshot_id: input.analyticsSnapshotId,
      computed_at: input.computedAt,
      computed_by: input.computedBy,
    })
    .select('id')
    .single()
  if (error !== null) throw toRepositoryError(ENTITY, 'write score', input.productId, error)
  const scoreId = data.id
  const { error: componentError } = await admin.from('research_opportunity_components').insert(
    input.result.components.map((component) => ({
      score_id: scoreId,
      signal_key: component.signalKey,
      raw_input: component.rawInput,
      normalised: component.normalised,
      weight: component.weight,
      contribution: component.contribution,
      included: component.included,
      exclusion_reason: component.exclusionReason,
    })),
  )
  if (componentError !== null)
    throw toRepositoryError(ENTITY, 'write components', scoreId, componentError)
  return scoreId
}

export interface RankedScore extends OpportunityScoreRow {
  readonly title_normalized: string | null
  readonly source_id: string
  readonly matched_category_id: string | null
  readonly currency: string | null
  readonly price_min_minor: number | null
  readonly scale_band: string | null
}

/**
 * The newest score per product under one model, ranked. Read as the session. PostgREST cannot
 * express "latest per product", so the newest N rows are read and deduplicated here; the limit is
 * generous because a product scores once per run and runs are nightly.
 */
export async function listLatestScores(
  client: Client,
  modelId: string,
  filter: {
    readonly state?: 'SCORED' | 'INSUFFICIENT_DATA'
    readonly sourceId?: string
    readonly categoryId?: string
    readonly limit?: number
  } = {},
): Promise<readonly RankedScore[]> {
  const { data, error } = await client
    .from('research_opportunity_scores')
    .select(
      `${SCORE_COLUMNS}, research_products!inner(title_normalized, source_id, matched_category_id, currency, price_min_minor, scale_band)`,
    )
    .eq('model_id', modelId)
    .order('computed_at', { ascending: false })
    .limit(20_000)
  if (error !== null) throw toRepositoryError(ENTITY, 'ranked', modelId, error)
  const seen = new Set<string>()
  const rows: RankedScore[] = []
  for (const raw of (data ?? []) as unknown as (OpportunityScoreRow & {
    research_products: Omit<RankedScore, keyof OpportunityScoreRow>
  })[]) {
    if (seen.has(raw.research_product_id)) continue
    seen.add(raw.research_product_id)
    const { research_products: product, ...score } = raw
    const row: RankedScore = { ...score, ...product }
    if (filter.state !== undefined && row.state !== filter.state) continue
    if (filter.sourceId !== undefined && row.source_id !== filter.sourceId) continue
    if (filter.categoryId !== undefined && row.matched_category_id !== filter.categoryId) continue
    rows.push(row)
  }
  rows.sort(
    (a, b) =>
      (b.score ?? -1) - (a.score ?? -1) ||
      b.confidence - a.confidence ||
      a.research_product_id.localeCompare(b.research_product_id),
  )
  return rows.slice(0, filter.limit ?? 500)
}

export async function getScore(
  client: Client,
  scoreId: string,
): Promise<OpportunityScoreRow | null> {
  const { data, error } = await client
    .from('research_opportunity_scores')
    .select(SCORE_COLUMNS)
    .eq('id', scoreId)
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'get score', scoreId, error)
  return (data ?? null) as unknown as OpportunityScoreRow | null
}

export async function listComponents(
  client: Client,
  scoreId: string,
): Promise<readonly OpportunityComponentRow[]> {
  const { data, error } = await client
    .from('research_opportunity_components')
    .select(COMPONENT_COLUMNS)
    .eq('score_id', scoreId)
    .order('signal_key')
  if (error !== null) throw toRepositoryError(ENTITY, 'components', scoreId, error)
  return (data ?? []) as unknown as OpportunityComponentRow[]
}

/** Components for the latest score per product under a model — the input to the model diff. */
export async function listLatestComponents(
  client: Client,
  modelId: string,
): Promise<
  readonly {
    productId: string
    completeness: number
    components: readonly { signalKey: string; normalised: number | null }[]
  }[]
> {
  const scores = await listLatestScores(client, modelId, { limit: 5_000 })
  if (scores.length === 0) return []
  const ids = scores.map((score) => score.id)
  const { data, error } = await client
    .from('research_opportunity_components')
    .select('score_id, signal_key, normalised')
    .in('score_id', ids)
    .limit(50_000)
  if (error !== null) throw toRepositoryError(ENTITY, 'latest components', modelId, error)
  const byScore = new Map<string, { signalKey: string; normalised: number | null }[]>()
  for (const row of (data ?? []) as {
    score_id: string
    signal_key: string
    normalised: number | null
  }[]) {
    const list = byScore.get(row.score_id) ?? []
    list.push({
      signalKey: row.signal_key,
      normalised: row.normalised === null ? null : Number(row.normalised),
    })
    byScore.set(row.score_id, list)
  }
  return scores.map((score) => ({
    productId: score.research_product_id,
    completeness: Number(score.completeness),
    components: byScore.get(score.id) ?? [],
  }))
}

/** Exclusion counts per signal per source, for the dashboard tile that surfaces a broken adapter. */
export async function tallyExclusions(
  client: Client,
  modelId: string,
): Promise<readonly { signalKey: string; reason: string; count: number }[]> {
  const scores = await listLatestScores(client, modelId, { limit: 5_000 })
  if (scores.length === 0) return []
  const { data, error } = await client
    .from('research_opportunity_components')
    .select('signal_key, exclusion_reason')
    .in(
      'score_id',
      scores.map((score) => score.id),
    )
    .eq('included', false)
    .limit(50_000)
  if (error !== null) throw toRepositoryError(ENTITY, 'exclusions', modelId, error)
  const counts = new Map<string, number>()
  for (const row of (data ?? []) as { signal_key: string; exclusion_reason: string | null }[]) {
    const key = `${row.signal_key}|${row.exclusion_reason ?? ''}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([key, count]) => {
      const [signalKey, reason] = key.split('|')
      return { signalKey: signalKey ?? '', reason: reason ?? '', count }
    })
    .sort((a, b) => b.count - a.count)
}

// --- the rows to score, and the context they are scored in ---------------------------------------

const ROW_COLUMNS =
  'id, source_id, matched_category_id, is_large_format, currency, price_state, price_min_minor, ' +
  'price_max_minor, dimensions_mm, dimension_parse_state, longest_axis_mm, first_seen_at, last_seen_at, ' +
  'material_tokens, title_normalized, availability, current_version_id'

type RawScoringRow = {
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
  material_tokens: string[] | null
  title_normalized: string | null
  availability: string | null
  current_version_id: string | null
}

export async function listScoringRows(
  client: Client,
  categorySlugs: ReadonlyMap<string, string>,
  sourceId?: string,
): Promise<readonly ScoringRow[]> {
  let query = client
    .from('research_products')
    .select(ROW_COLUMNS)
    .eq('disposition', 'NONE')
    .order('id')
    .limit(20_000)
  if (sourceId !== undefined) query = query.eq('source_id', sourceId)
  const { data, error } = await query
  if (error !== null) throw toRepositoryError(ENTITY, 'rows', 'products', error)
  const raws = (data ?? []) as unknown as RawScoringRow[]

  // The current versions' normalised payloads, read in one query per 200 ids.
  const versionIds = raws
    .map((raw) => raw.current_version_id)
    .filter((id): id is string => id !== null)
  const normalizedByVersion = new Map<string, Record<string, unknown>>()
  for (let i = 0; i < versionIds.length; i += 200) {
    const slice = versionIds.slice(i, i + 200)
    const { data: versions, error: versionError } = await client
      .from('research_product_versions')
      .select('id, normalized')
      .in('id', slice)
    if (versionError !== null)
      throw toRepositoryError(ENTITY, 'versions', 'normalized', versionError)
    for (const version of (versions ?? []) as { id: string; normalized: unknown }[]) {
      if (version.normalized !== null && typeof version.normalized === 'object') {
        normalizedByVersion.set(version.id, version.normalized as Record<string, unknown>)
      }
    }
  }

  return raws.map((raw) => ({
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
    dimensionParseState: (raw.dimension_parse_state ?? 'ABSENT') as ParseState,
    longestAxisMm: raw.longest_axis_mm,
    firstSeenAt: raw.first_seen_at,
    lastSeenAt: raw.last_seen_at,
    materialTokens: raw.material_tokens ?? [],
    normalized:
      raw.current_version_id === null
        ? null
        : (normalizedByVersion.get(raw.current_version_id) ?? null),
    titleNormalized: raw.title_normalized,
    availability: raw.availability,
  }))
}

/**
 * Everything the signals read, gathered once.
 *
 * `products` AND `materials` ARE READ HERE WITH A SELECT AND NOTHING ELSE. The counts and the
 * vocabulary cross into the context as plain numbers and strings; no research row is ever joined
 * to a first-party row in SQL.
 */
export async function buildScoringContext(
  client: Client,
  rows: readonly ScoringRow[],
  categories: readonly { readonly id: string; readonly slug: string }[],
  asOf: Date,
): Promise<ScoringContext> {
  const { data: products, error: productError } = await client
    .from('products')
    .select('category_id, currency, price_state, price_minor, price_from_minor')
    .eq('status', 'PUBLISHED')
    .limit(10_000)
  if (productError !== null) throw toRepositoryError(ENTITY, 'catalogue', 'products', productError)

  const publishedCountByCategory = new Map<string, number>()
  const rivyaPricesByCurrency = new Map<string, number[]>()
  for (const product of (products ?? []) as {
    category_id: string | null
    currency: string | null
    price_state: string
    price_minor: number | null
    price_from_minor: number | null
  }[]) {
    if (product.category_id !== null) {
      publishedCountByCategory.set(
        product.category_id,
        (publishedCountByCategory.get(product.category_id) ?? 0) + 1,
      )
    }
    const amount =
      product.price_state === 'FIXED'
        ? product.price_minor
        : product.price_state === 'STARTING_FROM'
          ? product.price_from_minor
          : null
    if (amount !== null && product.currency !== null) {
      const list = rivyaPricesByCurrency.get(product.currency.toUpperCase()) ?? []
      list.push(amount)
      rivyaPricesByCurrency.set(product.currency.toUpperCase(), list)
    }
  }

  // Band edges per currency from the RESEARCH rows (Phase 31's quantile rule), then which of those
  // bands Rivya's published prices occupy.
  const researchPricesByCurrency = new Map<string, number[]>()
  for (const row of rows) {
    if (
      row.priceState !== null &&
      PRICED_STATES.has(row.priceState) &&
      row.priceMinMinor !== null &&
      row.currency !== null
    ) {
      const list = researchPricesByCurrency.get(row.currency.toUpperCase()) ?? []
      list.push(row.priceMinMinor)
      researchPricesByCurrency.set(row.currency.toUpperCase(), list)
    }
  }
  const occupiedBandsByCurrency = new Map<string, OccupiedBands>()
  for (const [currency, amounts] of researchPricesByCurrency) {
    const edges = quantileEdges(amounts)
    const rivya = rivyaPricesByCurrency.get(currency) ?? []
    occupiedBandsByCurrency.set(currency, {
      edges,
      occupied: new Set(rivya.map((amount) => bandIndex(amount, edges))),
      pricedProducts: rivya.length,
      snapshotId: null,
    })
  }

  const sourcesByCategoryBand = new Map<string, Set<string>>()
  for (const row of rows) {
    const edges =
      row.currency === null
        ? []
        : (occupiedBandsByCurrency.get(row.currency.toUpperCase())?.edges ?? [])
    const priced =
      row.priceState !== null && PRICED_STATES.has(row.priceState) && row.priceMinMinor !== null
    const band = priced && edges.length > 0 ? bandIndex(row.priceMinMinor ?? 0, edges) : null
    const key = densityKey(row.matchedCategoryId, band)
    const set = sourcesByCategoryBand.get(key) ?? new Set<string>()
    set.add(row.sourceId)
    sourcesByCategoryBand.set(key, set)
  }

  const { data: sources, error: sourceError } = await client
    .from('research_sources')
    .select('id, is_enabled, attribute_extraction')
    .limit(1_000)
  if (sourceError !== null) throw toRepositoryError(ENTITY, 'sources', 'context', sourceError)
  let enabledSourceCount = 0
  const attributeKeysBySource = new Map<string, Set<string>>()
  for (const source of (sources ?? []) as {
    id: string
    is_enabled: boolean
    attribute_extraction: unknown
  }[]) {
    if (source.is_enabled) enabledSourceCount += 1
    const keys = new Set<string>()
    if (Array.isArray(source.attribute_extraction)) {
      for (const rule of source.attribute_extraction as { key?: unknown }[]) {
        if (typeof rule.key === 'string') keys.add(rule.key)
      }
    }
    attributeKeysBySource.set(source.id, keys)
  }

  const { data: runs, error: runError } = await client
    .from('research_runs')
    .select('source_id, queued_at')
    .order('queued_at', { ascending: true })
    .limit(10_000)
  if (runError !== null) throw toRepositoryError(ENTITY, 'runs', 'context', runError)
  const runHistoryDaysBySource = new Map<string, number | null>()
  for (const run of (runs ?? []) as { source_id: string; queued_at: string }[]) {
    if (runHistoryDaysBySource.has(run.source_id)) continue
    runHistoryDaysBySource.set(
      run.source_id,
      Math.floor((asOf.getTime() - Date.parse(run.queued_at)) / 86_400_000),
    )
  }

  const since = new Date(asOf.getTime() - 90 * 86_400_000).toISOString()
  const { data: changes, error: changeError } = await client
    .from('research_changes')
    .select('research_product_id')
    .eq('materiality', 'MATERIAL')
    .gte('detected_at', since)
    .limit(50_000)
  if (changeError !== null) throw toRepositoryError(ENTITY, 'changes', 'context', changeError)
  const categoryByProduct = new Map(
    rows.map((row) => [row.id, row.matchedCategoryId ?? 'unmapped']),
  )
  const materialChanges90dByCategory = new Map<string, number>()
  for (const change of (changes ?? []) as { research_product_id: string }[]) {
    const key = categoryByProduct.get(change.research_product_id) ?? 'unmapped'
    materialChanges90dByCategory.set(key, (materialChanges90dByCategory.get(key) ?? 0) + 1)
  }

  const { data: materials, error: materialError } = await client
    .from('materials')
    .select('slug, name')
    .limit(1_000)
  if (materialError !== null) throw toRepositoryError(ENTITY, 'materials', 'context', materialError)
  const materialVocabulary = new Set<string>()
  for (const material of (materials ?? []) as { slug: string; name: string }[]) {
    materialVocabulary.add(material.slug.toLowerCase())
    for (const word of material.name.toLowerCase().split(/[^a-z0-9]+/u)) {
      if (word.length >= 3) materialVocabulary.add(word)
    }
  }

  return {
    asOf,
    categories,
    publishedCountByCategory,
    occupiedBandsByCurrency,
    enabledSourceCount,
    runHistoryDaysBySource,
    materialChanges90dByCategory,
    sourcesByCategoryBand,
    attributeKeysBySource,
    materialVocabulary,
  }
}
