import { MANAGED_TABLES } from '@/lib/auth/table-permissions'
import type { AnalyticsSnapshotInput } from '@/lib/supabase/schemas/analytics'

import { RECENT_RUN_DAYS, resolveAvailability, type AvailabilityFacts } from './availability'
import { METRICS, type MetricId, type MetricModule, type MetricOutcome } from './metrics'
import type { AnalyticsReads } from './reads'

/**
 * The snapshot writer — Phase 37. The one caller of every metric's `compute()`.
 *
 * ONE ROW PER METRIC PER DAY, IDEMPOTENT: a second run for the same date updates rather than
 * duplicates (the writer upserts on `(metric_id, as_of)`). A metric the availability resolver
 * refuses is stored UNAVAILABLE with that reason and its `compute()` is never called; a metric
 * whose `compute()` throws is stored UNAVAILABLE with the error's NAME — never a figure, never the
 * message, which could carry a row's contents.
 *
 * NOTHING HERE ESTIMATES. When the reads return nothing, the metrics return true zeros with
 * `n = 0` or a named reason, and that is what is written.
 */

export const RETENTION_DAYS = 400

export interface SnapshotWriter {
  upsert(row: AnalyticsSnapshotInput): Promise<void>
  /** Delete rows whose `as_of` is before the date; returns how many. */
  prune(beforeAsOf: string): Promise<number>
}

export interface SnapshotRunOptions {
  /** `YYYY-MM-DD`; defaults to today in UTC. */
  readonly date?: string
  readonly only?: MetricId
  readonly dryRun?: boolean
  readonly now?: Date
  readonly computedBy?: string | null
}

export interface SnapshotLine {
  readonly id: MetricId
  readonly dimension: MetricModule['dimension']
  readonly availability: MetricOutcome['availability']
  readonly reason: string | null
  readonly n: number | null
  readonly denominator: number | null
  readonly figure: number | null
}

export interface SnapshotRunResult {
  readonly asOf: string
  readonly dryRun: boolean
  readonly lines: readonly SnapshotLine[]
  readonly written: number
  readonly pruned: number
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function retentionCutoff(now: Date): string {
  return isoDate(new Date(now.getTime() - RETENTION_DAYS * 86_400_000))
}

async function gatherFacts(reads: AnalyticsReads, now: Date): Promise<AvailabilityFacts> {
  const since = new Date(now.getTime() - RECENT_RUN_DAYS * 86_400_000)
  const [sources, adapters, successfulRunsInWindow, model] = await Promise.all([
    reads.sources(),
    reads.adapters(),
    reads.successfulRunsSince(since),
    reads.activeModel(),
  ])
  return {
    tables: MANAGED_TABLES,
    sources,
    adapters,
    successfulRunsInWindow,
    hasActiveModel: model !== null,
  }
}

async function outcomeFor(
  metric: MetricModule,
  facts: AvailabilityFacts,
  reads: AnalyticsReads,
  now: Date,
): Promise<MetricOutcome> {
  const verdict = resolveAvailability(metric.requires, facts)
  if (!verdict.ok) {
    return { availability: 'UNAVAILABLE', reason: verdict.reason, n: null, denominator: null }
  }
  try {
    return await metric.compute({ reads, now })
  } catch (error) {
    const name = error instanceof Error ? error.name : 'Error'
    return {
      availability: 'UNAVAILABLE',
      reason: `computation failed (${name}); see the server log`,
      n: null,
      denominator: null,
    }
  }
}

export function toSnapshotInput(
  metric: MetricModule,
  outcome: MetricOutcome,
  asOf: string,
  computedAt: string,
  computedBy: string | null,
): AnalyticsSnapshotInput {
  if (outcome.availability === 'AVAILABLE') {
    return {
      metricId: metric.id,
      dimension: metric.dimension,
      asOf,
      value: outcome.value,
      n: outcome.n,
      denominator: outcome.denominator,
      availability: 'AVAILABLE',
      unavailableReason: null,
      computedAt,
      computedBy,
    }
  }
  return {
    metricId: metric.id,
    dimension: metric.dimension,
    asOf,
    value: { figure: null, unit: 'count' },
    n: outcome.n,
    denominator: outcome.denominator,
    availability: 'UNAVAILABLE',
    unavailableReason: outcome.reason,
    computedAt,
    computedBy,
  }
}

export async function runSnapshots(
  reads: AnalyticsReads,
  writer: SnapshotWriter | null,
  options: SnapshotRunOptions = {},
): Promise<SnapshotRunResult> {
  const now = options.now ?? new Date()
  const asOf = options.date ?? isoDate(now)
  const dryRun = options.dryRun === true || writer === null
  const facts = await gatherFacts(reads, now)
  const selected =
    options.only === undefined ? METRICS : METRICS.filter((m) => m.id === options.only)

  const lines: SnapshotLine[] = []
  let written = 0
  for (const metric of selected) {
    const outcome = await outcomeFor(metric, facts, reads, now)
    lines.push({
      id: metric.id,
      dimension: metric.dimension,
      availability: outcome.availability,
      reason: outcome.availability === 'UNAVAILABLE' ? outcome.reason : null,
      n: outcome.n,
      denominator: outcome.denominator,
      figure: outcome.availability === 'AVAILABLE' ? outcome.value.figure : null,
    })
    if (!dryRun && writer !== null) {
      await writer.upsert(
        toSnapshotInput(metric, outcome, asOf, now.toISOString(), options.computedBy ?? null),
      )
      written += 1
    }
  }

  const pruned = !dryRun && writer !== null ? await writer.prune(retentionCutoff(now)) : 0
  return { asOf, dryRun, lines, written, pruned }
}

/** One line per metric, for the CLI and the cron's log: `id  AVAILABLE  n/denominator  figure`. */
export function formatLine(line: SnapshotLine): string {
  const id = line.id.padEnd(20)
  if (line.availability === 'AVAILABLE') {
    const coverage = `${String(line.n ?? 0)}/${String(line.denominator ?? 0)}`
    return `${id} AVAILABLE    ${coverage.padEnd(12)} ${line.figure === null ? '' : String(line.figure)}`
  }
  return `${id} UNAVAILABLE  ${line.reason ?? ''}`
}
