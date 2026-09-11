import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

import type { AnalyticsReads, CorpusFamily, CorpusSnapshotFacts } from '@/lib/analytics/reads'
import type { SnapshotWriter } from '@/lib/analytics/snapshot'
import { listAdapterDescriptors } from '@/lib/scraper/adapters/registry'

import type { Database, Json } from '../database.types'
import {
  analyticsSnapshotRowSchema,
  type AnalyticsSnapshotInput,
  type AnalyticsSnapshotRow,
} from '../schemas/analytics'
import { latestSnapshots } from './research/analytics'
import { getActiveScoringModel, listLatestScores } from './research/opportunity'
import { listSourceHealth } from './research/source-health'
import { listResearchSources } from './research/sources'
import { parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'analytics snapshot'
const SNAPSHOT_COLUMNS =
  'id, metric_id, dimension, as_of, value, n, denominator, availability, unavailable_reason, computed_at, computed_by'

/** Enough for every row a small studio holds; a metric that needs a slice says so with a filter. */
const READ_LIMIT = 20_000

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fail(action: string, subject: string, error: PostgrestError): never {
  throw toRepositoryError(ENTITY, action, subject, error)
}

/* --- The reads every metric computes from ------------------------------------------------------ */

/**
 * `AnalyticsReads` over the service role — Phase 37.
 *
 * THE ONLY IMPLEMENTATION THAT TOUCHES A TABLE. Every select is written out with its columns, so
 * the shape a metric sees is the shape declared in `lib/analytics/reads.ts` and nothing wider: the
 * enquiry read names five columns and none of them is a person. Runs as the service role because
 * the snapshot writer has no user — it is a cron tick or a CLI — and the rows it produces are then
 * read under RLS by the tab.
 */
export function createAnalyticsReads(admin: Client): AnalyticsReads {
  return {
    async products() {
      const { data, error } = await admin
        .from('products')
        .select(
          'id, status, category_id, is_large_format, dimensions, hero_media_id, created_at, publication_readiness',
        )
        .limit(READ_LIMIT)
      if (error !== null) fail('read', 'products', error)
      return (data ?? []).map((row) => {
        const readiness = isRecord(row.publication_readiness) ? row.publication_readiness : null
        const unmet = readiness?.unmet_required
        return {
          id: row.id,
          status: row.status,
          categoryId: row.category_id,
          isLargeFormat: row.is_large_format,
          dimensions: row.dimensions,
          heroMediaId: row.hero_media_id,
          createdAt: row.created_at,
          unmetRequired: Array.isArray(unmet) ? unmet.length : null,
        }
      })
    },
    async categories() {
      const { data, error } = await admin.from('categories').select('id, slug').limit(READ_LIMIT)
      if (error !== null) fail('read', 'categories', error)
      return (data ?? []).map((row) => ({ id: row.id, slug: row.slug }))
    },
    async collections() {
      const { data, error } = await admin.from('collections').select('id, status').limit(READ_LIMIT)
      if (error !== null) fail('read', 'collections', error)
      return (data ?? []).map((row) => ({ id: row.id, status: row.status }))
    },
    async productCollections() {
      const { data, error } = await admin
        .from('product_collections')
        .select('product_id, collection_id')
        .limit(READ_LIMIT)
      if (error !== null) fail('read', 'product_collections', error)
      return (data ?? []).map((row) => ({
        productId: row.product_id,
        collectionId: row.collection_id,
      }))
    },
    async productMediaCounts() {
      const { data, error } = await admin
        .from('product_media')
        .select('product_id')
        .limit(READ_LIMIT)
      if (error !== null) fail('read', 'product_media', error)
      const counts = new Map<string, number>()
      for (const row of data ?? []) {
        counts.set(row.product_id, (counts.get(row.product_id) ?? 0) + 1)
      }
      return counts
    },
    async inquiries() {
      // FIVE COLUMNS AND NO PERSON. Name, phone, email and message are never read here.
      const { data, error } = await admin
        .from('inquiries')
        .select('kind, pipeline_status, whatsapp_state, created_at, source_path')
        .limit(READ_LIMIT)
      if (error !== null) fail('read', 'inquiries', error)
      return (data ?? []).map((row) => ({
        kind: row.kind,
        pipelineStatus: row.pipeline_status,
        whatsappState: row.whatsapp_state,
        createdAt: row.created_at,
        sourcePath: row.source_path,
      }))
    },
    async pages() {
      const { data, error } = await admin
        .from('pages')
        .select('id, kind, status, updated_at')
        .limit(READ_LIMIT)
      if (error !== null) fail('read', 'pages', error)
      return (data ?? []).map((row) => ({
        id: row.id,
        kind: row.kind,
        status: row.status,
        updatedAt: row.updated_at,
      }))
    },
    async sections() {
      const { data, error } = await admin
        .from('page_sections')
        .select('page_id, media_desktop_id, media_mobile_id')
        .limit(READ_LIMIT)
      if (error !== null) fail('read', 'page_sections', error)
      return (data ?? []).map((row) => ({
        pageId: row.page_id,
        hasDesktopMedia: row.media_desktop_id !== null,
        hasMobileMedia: row.media_mobile_id !== null,
      }))
    },
    async media() {
      const { data, error } = await admin
        .from('media_assets')
        .select('id, is_concept, alt_text')
        .limit(READ_LIMIT)
      if (error !== null) fail('read', 'media_assets', error)
      return (data ?? []).map((row) => ({
        id: row.id,
        isConcept: row.is_concept,
        altText: row.alt_text,
      }))
    },
    async mediaUsedIds() {
      const used = new Set<string>()
      const usages = await admin.from('media_usages').select('media_id').limit(READ_LIMIT)
      if (usages.error !== null) fail('read', 'media_usages', usages.error)
      for (const row of usages.data ?? []) used.add(row.media_id)
      const gallery = await admin.from('product_media').select('media_asset_id').limit(READ_LIMIT)
      if (gallery.error !== null) fail('read', 'product_media', gallery.error)
      for (const row of gallery.data ?? []) used.add(row.media_asset_id)
      const heroes = await admin
        .from('products')
        .select('hero_media_id')
        .not('hero_media_id', 'is', null)
        .limit(READ_LIMIT)
      if (heroes.error !== null) fail('read', 'product heroes', heroes.error)
      for (const row of heroes.data ?? [])
        if (row.hero_media_id !== null) used.add(row.hero_media_id)
      const sections = await admin
        .from('page_sections')
        .select('media_desktop_id, media_mobile_id')
        .limit(READ_LIMIT)
      if (sections.error !== null) fail('read', 'section media', sections.error)
      for (const row of sections.data ?? []) {
        if (row.media_desktop_id !== null) used.add(row.media_desktop_id)
        if (row.media_mobile_id !== null) used.add(row.media_mobile_id)
      }
      return used
    },
    async sources() {
      const rows = await listResearchSources(admin)
      return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        isEnabled: row.is_enabled,
        adapterKey: row.adapter_key,
        attributeKeys: (Array.isArray(row.attribute_extraction)
          ? (row.attribute_extraction as unknown[])
          : []
        )
          .filter(isRecord)
          .map((rule) => (typeof rule.key === 'string' ? rule.key : null))
          .filter((key): key is string => key !== null),
      }))
    },
    async adapters() {
      return listAdapterDescriptors().map((descriptor) => ({
        key: descriptor.key,
        capabilities: descriptor.capabilities,
      }))
    },
    async sourceHealth() {
      const rows = await listSourceHealth(admin)
      return rows.map((row) => ({
        sourceId: row.sourceId,
        health: row.health,
        lastRunAt: row.lastRunAt,
        lastRunStatus: row.lastRunStatus,
        successRate7d: row.successRate7d,
        queueDepth: row.queueDepth,
      }))
    },
    async researchProductCountsBySource() {
      const { data, error } = await admin
        .from('research_products')
        .select('source_id')
        .limit(READ_LIMIT)
      if (error !== null) fail('read', 'research_products', error)
      const counts = new Map<string, number>()
      for (const row of data ?? []) counts.set(row.source_id, (counts.get(row.source_id) ?? 0) + 1)
      return counts
    },
    async successfulRunsSince(since) {
      const { count, error } = await admin
        .from('research_runs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'SUCCEEDED')
        .gte('finished_at', since.toISOString())
      if (error !== null) fail('count', 'research_runs', error)
      return count ?? 0
    },
    async latestCorpusSnapshots(family: CorpusFamily): Promise<readonly CorpusSnapshotFacts[]> {
      const rows = await latestSnapshots(admin, {
        scopeType: 'CORPUS',
        scopeId: null,
        metricFamily: family,
      })
      return rows.map((row) => ({
        family,
        currency: row.currency,
        computedAt: row.computed_at,
        result: isRecord(row.payload.result) ? row.payload.result : {},
        coverage: row.payload.coverage.map((record) => ({
          n: record.n,
          denominator: record.denominator,
        })),
      }))
    },
    async materialTokens() {
      const { data, error } = await admin
        .from('research_products')
        .select('material_tokens')
        .limit(READ_LIMIT)
      if (error !== null) fail('read', 'material tokens', error)
      return (data ?? []).map((row) => row.material_tokens)
    },
    async activeModel() {
      const model = await getActiveScoringModel(admin)
      return model === null ? null : { id: model.id, version: model.version }
    },
    async latestScores(modelId) {
      const rows = await listLatestScores(admin, modelId, { limit: READ_LIMIT })
      return rows.map((row) => ({
        score: row.score,
        state: row.state === 'SCORED' ? ('SCORED' as const) : ('INSUFFICIENT_DATA' as const),
        categoryId: row.matched_category_id,
      }))
    },
  }
}

/* --- The writer --------------------------------------------------------------------------------- */

export function createSnapshotWriter(admin: Client): SnapshotWriter {
  return {
    async upsert(row: AnalyticsSnapshotInput) {
      const { error } = await admin.from('analytics_snapshots').upsert(
        {
          metric_id: row.metricId,
          dimension: row.dimension,
          as_of: row.asOf,
          // The payload is validated by `analyticsSnapshotInputSchema` at the boundary; the
          // generated Json type cannot see through a Zod object, hence the cast.
          value: row.value as unknown as Json,
          n: row.n,
          denominator: row.denominator,
          availability: row.availability,
          unavailable_reason: row.unavailableReason,
          computed_at: row.computedAt,
          computed_by: row.computedBy,
        },
        { onConflict: 'metric_id,as_of' },
      )
      if (error !== null) fail('upsert', row.metricId, error)
    },
    async prune(beforeAsOf) {
      const { count, error } = await admin
        .from('analytics_snapshots')
        .delete({ count: 'exact' })
        .lt('as_of', beforeAsOf)
      if (error !== null) fail('prune', beforeAsOf, error)
      return count ?? 0
    },
  }
}

/* --- What the tab reads, under the session's own policies ------------------------------------- */

/** The newest row per metric. RLS decides which metrics a role sees at all. */
export async function listLatestAnalyticsSnapshots(
  client: Client,
): Promise<readonly AnalyticsSnapshotRow[]> {
  const { data, error } = await client
    .from('analytics_snapshots')
    .select(SNAPSHOT_COLUMNS)
    .order('as_of', { ascending: false })
    .limit(400)
  if (error !== null) fail('latest', 'all', error)
  const rows = parseRows(ENTITY, analyticsSnapshotRowSchema, data ?? [])
  const seen = new Set<string>()
  return rows.filter((row) => {
    if (seen.has(row.metric_id)) return false
    seen.add(row.metric_id)
    return true
  })
}

/** Every row of the last `days` days, oldest first, for the trend lines. */
export async function listAnalyticsSeries(
  client: Client,
  days: number,
): Promise<readonly AnalyticsSnapshotRow[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
  const { data, error } = await client
    .from('analytics_snapshots')
    .select(SNAPSHOT_COLUMNS)
    .gte('as_of', since)
    .order('as_of', { ascending: true })
    .limit(2_000)
  if (error !== null) fail('series', since, error)
  return parseRows(ENTITY, analyticsSnapshotRowSchema, data ?? [])
}
