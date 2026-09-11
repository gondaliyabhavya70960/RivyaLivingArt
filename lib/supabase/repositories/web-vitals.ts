import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'
import {
  VITALS_METRICS,
  vitalsRowSchema,
  type VitalsMetric,
  type VitalsSampleInput,
} from '../schemas/vitals'
import { parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'web vitals sample'

/** Retention, fixed by the phase document. Pruned by the Phase 38 cron at 04:15 UTC. */
export const VITALS_RETENTION_DAYS = 90

/** How far back the Studio panel looks. Four weeks, so a week-on-week change is visible. */
export const VITALS_WINDOW_DAYS = 28

/** The sample rate the reporter applies, restated here because the caption must name it. */
export const VITALS_SAMPLE_RATE = 0.1

/**
 * Insert one sample as the service role.
 *
 * THE CALLER MUST ALREADY HAVE VALIDATED AND RATE-LIMITED. This is the one write path to a table
 * with no session write policy, and it runs with the service role, so everything that makes the
 * endpoint safe happens before this function is reached — `vitalsSampleSchema.strict()` and
 * `consume()` in `app/api/vitals/route.ts`. The type on `sample` is the parsed type precisely so
 * an unparsed body cannot be passed by mistake.
 */
export async function insertVitalsSample(admin: Client, sample: VitalsSampleInput): Promise<void> {
  const { error } = await admin.from('web_vitals_samples').insert({
    route_pattern: sample.route_pattern,
    metric: sample.metric,
    value: sample.value,
    rating: sample.rating,
    nav_type: sample.nav_type ?? null,
    effective_type: sample.effective_type ?? null,
    device_memory_bucket: sample.device_memory_bucket ?? null,
    viewport_bucket: sample.viewport_bucket ?? null,
  })
  if (error !== null) throw toRepositoryError(ENTITY, 'insert', sample.route_pattern, error)
}

/** Delete samples older than the retention window. Returns how many went. */
export async function purgeVitalsSamples(admin: Client, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - VITALS_RETENTION_DAYS * 86_400_000).toISOString()
  const { count, error } = await admin
    .from('web_vitals_samples')
    .delete({ count: 'exact' })
    .lt('occurred_at', cutoff)
  if (error !== null) throw toRepositoryError(ENTITY, 'purge', 'retention', error)
  return count ?? 0
}

export interface VitalsRouteSummary {
  readonly routePattern: string
  /** p75 per metric, in the order of `VITALS_METRICS`. Null where the route has no sample. */
  readonly p75: Readonly<Record<VitalsMetric, number | null>>
  /** How many samples each figure was computed from. */
  readonly n: Readonly<Record<VitalsMetric, number>>
}

/**
 * The 75th percentile per metric per route over the window.
 *
 * WHY p75 AND NOT A MEAN. Google's thresholds are defined at the 75th percentile, and a mean hides
 * exactly the visitors this data exists to find: one slow tail on an old phone disappears into an
 * average of fast desktop loads. The phase document's targets are p75 targets, so the figure that
 * is compared to them has to be one too.
 *
 * COMPUTED IN THE APPLICATION, NOT IN SQL, and that is a deliberate trade. PostgREST exposes no
 * `percentile_cont`, so the alternative is a database function — a migration, a policy question and
 * a second place for the window length to live. The row count is bounded by the sample rate and the
 * 90-day retention, the panel is an authenticated Studio page behind `analytics.read`, and the
 * fetch is capped below, so sorting in Node is the cheaper honest answer. If the corpus ever
 * outgrows the cap the fix is a view, not a bigger cap.
 */
export async function vitalsSummary(
  client: Client,
  options: { readonly now: Date; readonly windowDays?: number; readonly limit?: number },
): Promise<VitalsRouteSummary[]> {
  const windowDays = options.windowDays ?? VITALS_WINDOW_DAYS
  const since = new Date(options.now.getTime() - windowDays * 86_400_000).toISOString()
  const { data, error } = await client
    .from('web_vitals_samples')
    .select(
      'id, route_pattern, metric, value, rating, nav_type, effective_type, device_memory_bucket, viewport_bucket, occurred_at',
    )
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: false })
    .limit(options.limit ?? 50_000)
  if (error !== null) throw toRepositoryError(ENTITY, 'list', 'summary', error)

  const rows = parseRows(ENTITY, vitalsRowSchema, data ?? [])
  const byRoute = new Map<string, Map<VitalsMetric, number[]>>()
  for (const row of rows) {
    let metrics = byRoute.get(row.route_pattern)
    if (metrics === undefined) {
      metrics = new Map()
      byRoute.set(row.route_pattern, metrics)
    }
    const values = metrics.get(row.metric) ?? []
    values.push(row.value)
    metrics.set(row.metric, values)
  }

  return [...byRoute.entries()]
    .map(([routePattern, metrics]) => {
      const p75 = {} as Record<VitalsMetric, number | null>
      const n = {} as Record<VitalsMetric, number>
      for (const metric of VITALS_METRICS) {
        const values = metrics.get(metric) ?? []
        p75[metric] = percentile(values, 0.75)
        n[metric] = values.length
      }
      return { routePattern, p75, n }
    })
    .sort((a, b) => a.routePattern.localeCompare(b.routePattern))
}

/**
 * The nearest-rank percentile: sort, take the ceil(p × n)-th value.
 *
 * NEAREST RANK RATHER THAN INTERPOLATION because an interpolated p75 is a number no visitor
 * experienced. Every figure this panel shows should be a measurement somebody's browser actually
 * reported, which also makes it defensible when the number is bad.
 */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.max(1, Math.ceil(p * sorted.length))
  return sorted[rank - 1] ?? null
}
