import { SAMPLE_FLOOR } from '@/lib/scraper/analytics/coverage'

import { RECENT_RUN_DAYS } from '../availability'
import type { CorpusSnapshotFacts } from '../reads'
import {
  arrayField,
  available,
  bandLabel,
  daysBetween,
  isRecord,
  median,
  numberField,
  percent,
  tally,
  topN,
  unavailable,
} from './shared'
import type { MetricModule } from './types'

/**
 * The ten competitive metrics — Phase 37, FEAT §28's second line.
 *
 * NONE OF THESE COMPUTES COMPETITIVE ANALYTICS. The three Phase 31 families are READ from the
 * newest corpus snapshot `research_analytics_snapshots` holds; a snapshot older than the run
 * window is reported stale rather than recomputed. Three (`resin_styles`, `colours`,
 * `production_model`) are unavailable by declaration until an adapter can extract them, and the
 * availability resolver says so before `compute()` is reached. Every figure here is a reading of
 * competitor data and sits behind `research.read` at the row (0351), not at the page.
 */

const SNAPSHOT_MAX_AGE_DAYS = RECENT_RUN_DAYS
const SCORE_EDGES = [20, 40, 60, 80] as const

function newest(snapshots: readonly CorpusSnapshotFacts[]): CorpusSnapshotFacts | null {
  return snapshots.reduce<CorpusSnapshotFacts | null>(
    (best, row) => (best === null || row.computedAt > best.computedAt ? row : best),
    null,
  )
}

function staleReason(snapshot: CorpusSnapshotFacts, now: Date): string | null {
  const age = daysBetween(snapshot.computedAt, now)
  return age > SNAPSHOT_MAX_AGE_DAYS
    ? `latest snapshot is ${String(age)} days old (computed ${snapshot.computedAt.slice(0, 10)}); run npm run research:analytics -- --snapshot`
    : null
}

function coverageOf(snapshot: CorpusSnapshotFacts): { n: number; denominator: number } {
  const first = snapshot.coverage[0]
  return first === undefined ? { n: 0, denominator: 0 } : first
}

export const assortment: MetricModule = {
  id: 'assortment',
  labelKey: 'studio.analytics.metric.assortment',
  dimension: 'COMPETITIVE',
  definition:
    'The Phase 31 assortment snapshot for the whole corpus: live products per source and per category, and the large-format share. Needs a successful research run in the last 30 days.',
  coverage: "n and denominator are the snapshot's own coverage record (rows in scope).",
  requires: { tables: ['research_analytics_snapshots', 'research_runs'], recentRun: true },
  availableFrom: 31,
  async compute({ reads, now }) {
    const snapshot = newest(await reads.latestCorpusSnapshots('ASSORTMENT'))
    if (snapshot === null) {
      return unavailable(
        'no assortment snapshot has been written; run npm run research:analytics -- --snapshot',
      )
    }
    const stale = staleReason(snapshot, now)
    if (stale !== null) return unavailable(stale)
    const { n, denominator } = coverageOf(snapshot)
    const byCategory = arrayField(snapshot.result, 'byCategory')
      .filter(isRecord)
      .map((entry) => ({
        label: typeof entry.slug === 'string' ? entry.slug : 'unmapped',
        value: numberField(entry, 'count') ?? 0,
      }))
    const sources = arrayField(snapshot.result, 'sources')
      .filter(isRecord)
      .map((entry) => ({
        label: typeof entry.sourceId === 'string' ? entry.sourceId.slice(0, 8) : 'source',
        value: numberField(entry, 'liveCount') ?? 0,
      }))
    const largeFormat = isRecord(snapshot.result.largeFormat) ? snapshot.result.largeFormat : {}
    return available(n, denominator, {
      figure: numberField(snapshot.result, 'n') ?? n,
      unit: 'count',
      series: byCategory,
      groups: sources,
      notes: [`snapshot computed ${snapshot.computedAt.slice(0, 10)}`],
      detail: { large_format: largeFormat },
    })
  },
}

export const priceArchitecture: MetricModule = {
  id: 'price_architecture',
  labelKey: 'studio.analytics.metric.price_architecture',
  dimension: 'COMPETITIVE',
  definition:
    'The Phase 31 price snapshot per currency: minimum, percentiles and bands over priced rows. Needs at least twelve priced rows in a currency; currencies are never mixed.',
  coverage:
    'n = priced rows in the reported currency; denominator = rows in scope for that currency.',
  requires: { tables: ['research_analytics_snapshots', 'research_runs'], recentRun: true },
  availableFrom: 31,
  async compute({ reads, now }) {
    const snapshots = await reads.latestCorpusSnapshots('PRICE_ARCHITECTURE')
    if (snapshots.length === 0) {
      return unavailable(
        'no price snapshot has been written; run npm run research:analytics -- --snapshot',
      )
    }
    const usable = snapshots
      .filter((row) => (numberField(row.result, 'n') ?? 0) >= SAMPLE_FLOOR)
      .sort((a, b) => (numberField(b.result, 'n') ?? 0) - (numberField(a.result, 'n') ?? 0))
    const best = usable[0]
    if (best === undefined) {
      const largest = snapshots.reduce<{ currency: string; n: number }>(
        (acc, row) => {
          const n = numberField(row.result, 'n') ?? 0
          return n > acc.n ? { currency: row.currency ?? '???', n } : acc
        },
        { currency: '???', n: 0 },
      )
      return unavailable(
        `fewer than ${String(SAMPLE_FLOOR)} priced rows in any currency (best: ${largest.currency} ${String(largest.n)})`,
        largest.n,
        null,
      )
    }
    const stale = staleReason(best, now)
    if (stale !== null) return unavailable(stale)
    const { n, denominator } = coverageOf(best)
    const percentiles = isRecord(best.result.percentiles) ? best.result.percentiles : {}
    const histogram = arrayField(best.result, 'histogram')
      .filter(isRecord)
      .map((bin) => ({
        label: `${String(numberField(bin, 'fromMinor') ?? 0)}–${String(numberField(bin, 'toMinor') ?? 0)}`,
        value: numberField(bin, 'count') ?? 0,
      }))
    return available(n, denominator, {
      figure: numberField(percentiles, 'median'),
      unit: 'minor',
      currency: best.currency,
      series: histogram,
      groups: [
        { label: 'p10', value: numberField(percentiles, 'p10') ?? 0 },
        { label: 'median', value: numberField(percentiles, 'median') ?? 0 },
        { label: 'p90', value: numberField(percentiles, 'p90') ?? 0 },
      ],
      notes: [
        `snapshot computed ${best.computedAt.slice(0, 10)}`,
        ...(usable.length < snapshots.length
          ? [
              `${String(snapshots.length - usable.length)} currency snapshot(s) below the sample floor omitted`,
            ]
          : []),
      ],
      detail: { currencies_reported: usable.map((row) => row.currency) },
    })
  },
}

export const dimensions: MetricModule = {
  id: 'dimensions',
  labelKey: 'studio.analytics.metric.dimensions',
  dimension: 'COMPETITIVE',
  definition:
    'The Phase 31 dimensions snapshot: axis percentiles and the longest-axis distribution over rows whose dimensions parsed. Needs at least twelve parsed rows.',
  coverage: 'n = rows with parsed dimensions; denominator = rows in scope.',
  requires: { tables: ['research_analytics_snapshots', 'research_runs'], recentRun: true },
  availableFrom: 31,
  async compute({ reads, now }) {
    const snapshot = newest(await reads.latestCorpusSnapshots('DIMENSIONS'))
    if (snapshot === null) {
      return unavailable(
        'no dimensions snapshot has been written; run npm run research:analytics -- --snapshot',
      )
    }
    const parsed = numberField(snapshot.result, 'n') ?? 0
    if (parsed < SAMPLE_FLOOR) {
      return unavailable(
        `fewer than ${String(SAMPLE_FLOOR)} rows with parsed dimensions (${String(parsed)})`,
        parsed,
        coverageOf(snapshot).denominator,
      )
    }
    const stale = staleReason(snapshot, now)
    if (stale !== null) return unavailable(stale)
    const { n, denominator } = coverageOf(snapshot)
    const longestAxis = arrayField(snapshot.result, 'longestAxis')
      .filter(isRecord)
      .map((entry) => ({
        label: typeof entry.label === 'string' ? entry.label : 'band',
        value: numberField(entry, 'count') ?? 0,
      }))
    const axes = arrayField(snapshot.result, 'axes')
      .filter(isRecord)
      .map((axis) => ({
        label: typeof axis.axis === 'string' ? `${axis.axis} p50` : 'axis p50',
        value: numberField(axis, 'p50') ?? 0,
      }))
    return available(n, denominator, {
      figure: parsed,
      unit: 'count',
      series: longestAxis,
      groups: axes,
      notes: [`snapshot computed ${snapshot.computedAt.slice(0, 10)}`],
    })
  },
}

export const materials: MetricModule = {
  id: 'materials',
  labelKey: 'studio.analytics.metric.materials',
  dimension: 'COMPETITIVE',
  definition:
    'How often each normalised material token appears across research rows. Needs an enabled source configured to extract materials.',
  coverage: 'n = research rows with at least one material token; denominator = research rows read.',
  requires: {
    tables: ['research_products', 'research_sources'],
    attributeKeys: [{ key: 'materials', label: 'materials' }],
  },
  availableFrom: 28,
  async compute({ reads }) {
    const rows = await reads.materialTokens()
    const withTokens = rows.filter((tokens) => tokens.length > 0)
    const frequency = topN(
      tally(
        withTokens.flatMap((tokens) => [...new Set(tokens)]),
        (token) => token,
      ),
      12,
    )
    return available(withTokens.length, rows.length, {
      figure: frequency.length,
      unit: 'count',
      series: frequency,
    })
  },
}

export const resinStyles: MetricModule = {
  id: 'resin_styles',
  labelKey: 'studio.analytics.metric.resin_styles',
  dimension: 'COMPETITIVE',
  definition:
    'How often each normalised resin-style term appears across research rows. Unavailable until an adapter declares the capability to extract it.',
  coverage: 'Not computable until an adapter declares the capability; no n exists.',
  requires: { tables: ['research_products'], missingCapability: 'resin style' },
  availableFrom: 37,
  async compute() {
    return unavailable('no enabled adapter captures resin style')
  },
}

export const colours: MetricModule = {
  id: 'colours',
  labelKey: 'studio.analytics.metric.colours',
  dimension: 'COMPETITIVE',
  definition:
    'How often each normalised colour term appears across research rows. Unavailable until an adapter declares the capability to extract it.',
  coverage: 'Not computable until an adapter declares the capability; no n exists.',
  requires: { tables: ['research_products'], missingCapability: 'colour' },
  availableFrom: 37,
  async compute() {
    return unavailable('no enabled adapter captures colour')
  },
}

export const customization: MetricModule = {
  id: 'customization',
  labelKey: 'studio.analytics.metric.customization',
  dimension: 'COMPETITIVE',
  definition:
    'The share of research rows whose source states a customisation option. Needs an enabled source configured to extract customisation.',
  coverage: 'n = research rows stating customisation; denominator = research rows read.',
  requires: {
    tables: ['research_products', 'research_sources'],
    attributeKeys: [{ key: 'customization', label: 'customisation' }],
  },
  availableFrom: 28,
  async compute() {
    // The key can be configured on a source (Phase 26) and read by the adapter (Phase 27), but
    // Phase 28's normaliser maps dimensions, materials, availability, lead time and variants —
    // no column carries customisation yet. Saying so is the honest figure.
    return unavailable(
      'customisation is extracted but not normalised: no research column carries it (Phase 28 maps dimensions, materials, availability, lead time and variants)',
    )
  },
}

export const productionModel: MetricModule = {
  id: 'production_model',
  labelKey: 'studio.analytics.metric.production_model',
  dimension: 'COMPETITIVE',
  definition:
    'Made-to-order versus stocked, where a source states it. Unavailable until an adapter declares the capability to extract it.',
  coverage: 'Not computable until an adapter declares the capability; no n exists.',
  requires: { tables: ['research_products'], missingCapability: 'production model' },
  availableFrom: 37,
  async compute() {
    return unavailable('no enabled adapter captures production model')
  },
}

export const opportunityScores: MetricModule = {
  id: 'opportunity_scores',
  labelKey: 'studio.analytics.metric.opportunity_scores',
  dimension: 'COMPETITIVE',
  definition:
    'The Phase 32 score distribution under the active model, in bands and per category, with the model version. Needs an active model and at least one scored row.',
  coverage:
    'n = rows with a score; denominator = rows the model looked at (scored or insufficient).',
  requires: {
    tables: ['research_opportunity_scores', 'research_scoring_models'],
    activeModel: true,
  },
  availableFrom: 32,
  async compute({ reads }) {
    const model = await reads.activeModel()
    if (model === null) return unavailable('no ACTIVE scoring model')
    const [scores, categories] = await Promise.all([
      reads.latestScores(model.id),
      reads.categories(),
    ])
    const scored = scores.filter(
      (row): row is typeof row & { score: number } => row.state === 'SCORED' && row.score !== null,
    )
    if (scored.length === 0) {
      return unavailable(`no scored row under model ${model.version}`, 0, scores.length)
    }
    const slugs = new Map(categories.map((category) => [category.id, category.slug]))
    const bands = tally(scored, (row) => bandLabel(row.score, SCORE_EDGES, 'pts'))
    const perCategory = topN(
      tally(scored, (row) =>
        row.categoryId === null ? 'unmapped' : (slugs.get(row.categoryId) ?? 'unmapped'),
      ),
      8,
    )
    return available(scored.length, scores.length, {
      figure: median(scored.map((row) => row.score)),
      unit: 'score',
      series: bands,
      groups: perCategory,
      notes: [`model ${model.version}`],
      detail: { insufficient_data_rows: scores.length - scored.length },
    })
  },
}

export const sourceFreshness: MetricModule = {
  id: 'source_freshness',
  labelKey: 'studio.analytics.metric.source_freshness',
  dimension: 'COMPETITIVE',
  definition:
    'Per research source: last run, last status, seven-day success rate, queue depth, health state and rows captured.',
  coverage: 'n = sources reading HEALTHY; denominator = research sources.',
  requires: { tables: ['research_sources', 'research_runs', 'research_work_items'] },
  availableFrom: 26,
  async compute({ reads }) {
    const [sources, health, counts] = await Promise.all([
      reads.sources(),
      reads.sourceHealth(),
      reads.researchProductCountsBySource(),
    ])
    const healthBySource = new Map(health.map((row) => [row.sourceId, row]))
    const rows = sources.map((source) => {
      const state = healthBySource.get(source.id)
      return {
        slug: source.slug,
        health: state?.health ?? (source.isEnabled ? 'STALE' : 'DISABLED'),
        last_run_at: state?.lastRunAt ?? null,
        last_run_status: state?.lastRunStatus ?? null,
        success_rate_7d: state?.successRate7d ?? null,
        queue_depth: state?.queueDepth ?? 0,
        rows_captured: counts.get(source.id) ?? 0,
      }
    })
    const healthy = rows.filter((row) => row.health === 'HEALTHY').length
    return available(healthy, sources.length, {
      figure: healthy,
      unit: 'count',
      groups: tally(rows, (row) => row.health),
      series: rows.map((row) => ({ label: row.slug, value: row.rows_captured })),
      detail: { sources: rows, healthy_percent: percent(healthy, sources.length) },
    })
  },
}

export const COMPETITIVE_METRICS: readonly MetricModule[] = [
  assortment,
  priceArchitecture,
  dimensions,
  materials,
  resinStyles,
  colours,
  customization,
  productionModel,
  opportunityScores,
  sourceFreshness,
]
