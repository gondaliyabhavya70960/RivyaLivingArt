import 'server-only'

import { listCategoriesForStudio } from '@/lib/supabase/repositories/catalog-admin'
import {
  latestSnapshots,
  listCoverageForSnapshots,
  listMembers,
} from '@/lib/supabase/repositories/research/analytics'
import { listExplorerRows } from '@/lib/supabase/repositories/research/explorer'
import {
  getActiveScoringModel,
  listLatestComponents,
  listLatestScores,
} from '@/lib/supabase/repositories/research/opportunity'
import { listTags, listTagsForProducts } from '@/lib/supabase/repositories/research/review'
import { listScaleRows } from '@/lib/supabase/repositories/research/scale'
import {
  listConfirmations,
  listOpenShortlistEntries,
  resolveStartedProducts,
} from '@/lib/supabase/repositories/research/shortlist'

import { FILTER_SCHEMAS, type Cell } from '../definitions'
import { SheetsError } from '../errors'
import { sourceNames, text, type Client, type Record_ } from './shared'

/**
 * The five research-side builders — Phase 36.
 *
 * `listCategoriesForStudio` is the taxonomy read amendment A26 admits (a research row labelled
 * with the category slug its source map matched it to). It is the only catalogue import under
 * `lib/sheets/`, and it is in this module and not `shared.ts` so the direction builder never
 * shares a file with it (I4).
 */

async function categorySlugs(client: Client): Promise<ReadonlyMap<string, string>> {
  const categories = await listCategoriesForStudio(client)
  return new Map(categories.map((category) => [category.id, category.slug]))
}

export async function researchProducts(
  client: Client,
  filter: Record<string, unknown>,
): Promise<Record_[]> {
  const parsed = FILTER_SCHEMAS.RESEARCH_PRODUCTS.parse(filter) as {
    sourceId?: string
    stage?: string
    disposition?: string
  }
  const [{ rows }, sources, categories] = await Promise.all([
    listExplorerRows(client, {
      ...(parsed.sourceId === undefined ? {} : { sourceId: parsed.sourceId }),
      ...(parsed.stage === undefined ? {} : { stage: parsed.stage as never }),
      ...(parsed.disposition === undefined ? {} : { disposition: parsed.disposition as never }),
      limit: 5_000,
    }),
    sourceNames(client),
    categorySlugs(client),
  ])
  return rows.map((row) => ({
    source: sources.get(row.source_id) ?? row.source_id,
    title_normalized: text(row.title_normalized),
    category:
      row.matched_category_id === null ? null : (categories.get(row.matched_category_id) ?? null),
    price_state: text(row.price_state),
    price_min_minor: text(row.price_min_minor),
    price_max_minor: text(row.price_max_minor),
    currency: text(row.currency),
    dimensions_mm: text(row.dimensions_mm),
    dimension_parse_state: text(row.dimension_parse_state),
    stage: row.stage,
    disposition: row.disposition,
    first_seen_at: row.first_seen_at,
    last_seen_at: row.last_seen_at,
    source_url: row.source_url,
  }))
}

export async function comparisonSet(client: Client, scopeId: string | null): Promise<Record_[]> {
  if (scopeId === null) throw new SheetsError('NO_SCOPE')
  const [members, sources, categories, snapshots] = await Promise.all([
    listMembers(client, scopeId),
    sourceNames(client),
    categorySlugs(client),
    latestSnapshots(client, { scopeType: 'SET', scopeId }),
  ])
  const newest = snapshots.reduce<string | null>(
    (latest, row) => (latest === null || row.computed_at > latest ? row.computed_at : latest),
    null,
  )
  const coverage = await listCoverageForSnapshots(
    client,
    snapshots.map((row) => row.id),
  )
  const coveragePct = coverage.reduce<number | null>(
    (best, row) => (best === null || row.coverage_pct > best ? row.coverage_pct : best),
    null,
  )
  const records: Record_[] = []
  for (const member of members) {
    const rows =
      member.member_type === 'SOURCE'
        ? await listScaleRows(client, { sourceId: member.source_id ?? undefined, limit: 2_000 })
        : (await listScaleRows(client, { limit: 5_000 })).filter(
            (row) => row.id === member.research_product_id,
          )
    for (const row of rows) {
      records.push({
        member_type: member.member_type,
        member: text(row.title_normalized) ?? row.source_url,
        source: sources.get(row.source_id) ?? row.source_id,
        category:
          row.matched_category_id === null
            ? null
            : (categories.get(row.matched_category_id) ?? null),
        price_state: text(row.price_state),
        price_min_minor: text(row.price_min_minor),
        currency: text(row.currency),
        longest_axis_mm: text(row.longest_axis_mm),
        scale_band: text(row.scale_band),
        snapshot_computed_at: newest,
        coverage_pct: coveragePct,
      })
    }
  }
  return records
}

export async function opportunityScores(
  client: Client,
  filter: Record<string, unknown>,
): Promise<Record_[]> {
  const parsed = FILTER_SCHEMAS.OPPORTUNITY_SCORES.parse(filter) as {
    sourceId?: string
    state?: 'SCORED' | 'INSUFFICIENT_DATA'
  }
  const model = await getActiveScoringModel(client)
  if (model === null) return []
  const [scores, components, sources] = await Promise.all([
    listLatestScores(client, model.id, {
      ...(parsed.sourceId === undefined ? {} : { sourceId: parsed.sourceId }),
      ...(parsed.state === undefined ? {} : { state: parsed.state }),
      limit: 5_000,
    }),
    listLatestComponents(client, model.id),
    sourceNames(client),
  ])
  const byProduct = new Map(components.map((entry) => [entry.productId, entry.components]))
  return scores.map((score) => {
    const record: Record<string, Cell> = {
      research_product: text(score.title_normalized),
      source: sources.get(score.source_id) ?? score.source_id,
      score: text(score.score),
      confidence: text(Number(score.confidence)),
      state: score.state,
      model_version: score.model_version,
      computed_at: score.computed_at,
    }
    for (const component of byProduct.get(score.research_product_id) ?? []) {
      record[`signal:${component.signalKey}`] = component.normalised
    }
    return record
  })
}

export async function shortlist(
  client: Client,
  filter: Record<string, unknown>,
): Promise<Record_[]> {
  const parsed = FILTER_SCHEMAS.SHORTLIST.parse(filter) as { sourceId?: string }
  const [entries, sources, tags] = await Promise.all([
    listOpenShortlistEntries(client),
    sourceNames(client),
    listTags(client),
  ])
  const filtered = entries.filter(
    (entry) => parsed.sourceId === undefined || entry.source_id === parsed.sourceId,
  )
  const links = await listTagsForProducts(
    client,
    filtered.map((entry) => entry.research_product_id),
  )
  const labels = new Map(tags.map((tag) => [tag.id, tag.label]))
  const tagsByProduct = new Map<string, string[]>()
  for (const link of links) {
    const list = tagsByProduct.get(link.research_product_id) ?? []
    list.push(labels.get(link.tag_id) ?? link.tag_id)
    tagsByProduct.set(link.research_product_id, list)
  }
  return filtered.map((entry) => {
    const captured = entry.captured as { score?: unknown; confidence?: unknown }
    return {
      research_product: text(entry.title_normalized),
      source: sources.get(entry.source_id) ?? entry.source_id,
      reason: entry.reason,
      tags: (tagsByProduct.get(entry.research_product_id) ?? []).join(', '),
      score_at_entry: typeof captured.score === 'number' ? captured.score : null,
      confidence_at_entry: typeof captured.confidence === 'number' ? captured.confidence : null,
      opened_at: entry.opened_at,
      opened_by: entry.opened_by,
    }
  })
}

export async function confirmed(
  client: Client,
  filter: Record<string, unknown>,
): Promise<Record_[]> {
  const parsed = FILTER_SCHEMAS.CONFIRMED.parse(filter) as { includeArchived?: boolean }
  const [rows, sources] = await Promise.all([
    listConfirmations(client, { includeArchived: parsed.includeArchived === true }),
    sourceNames(client),
  ])
  const started = await resolveStartedProducts(
    client,
    rows.map((row) => row.created_product_id ?? ''),
  )
  return rows.map((row) => ({
    research_product: text(row.title_normalized),
    source: sources.get(row.source_id) ?? row.source_id,
    decision_note: row.decision_note,
    confirmed_by: row.confirmed_by,
    confirmed_at: row.confirmed_at,
    product_started:
      row.created_product_id === null
        ? 'no'
        : (started.get(row.created_product_id)?.slug ?? 'yes (product no longer exists)'),
    archived_at: row.archived_at,
  }))
}
