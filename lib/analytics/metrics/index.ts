import { COMPETITIVE_METRICS } from './competitive'
import { FIRST_PARTY_METRICS } from './first-party'
import type { MetricId } from './ids'
import type { MetricModule } from './types'

/**
 * The registry — Phase 37. Eighteen modules in FEAT §28's order, and the only list the tab and the
 * snapshot writer read. `tests/unit/analytics-registry.test.ts` holds it to `METRIC_IDS` exactly.
 */
export const METRICS: readonly MetricModule[] = [...FIRST_PARTY_METRICS, ...COMPETITIVE_METRICS]

const BY_ID = new Map<MetricId, MetricModule>(METRICS.map((metric) => [metric.id, metric]))

export function metricById(id: MetricId): MetricModule {
  const metric = BY_ID.get(id)
  if (metric === undefined) throw new Error(`metric ${id} is not registered`)
  return metric
}

export { METRIC_IDS, FIRST_PARTY_METRIC_IDS, COMPETITIVE_METRIC_IDS, isMetricId } from './ids'
export type { MetricId } from './ids'
export type { MetricContext, MetricModule, MetricOutcome } from './types'
