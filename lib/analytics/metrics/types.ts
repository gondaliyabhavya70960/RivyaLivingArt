import type { StudioStringKey } from '@/components/studio/strings'
import type { MetricDimension, MetricValue } from '@/lib/supabase/schemas/analytics'

import type { MetricRequirement } from '../availability'
import type { AnalyticsReads } from '../reads'
import type { MetricId } from './ids'

/**
 * One metric — Phase 37.
 *
 * `definition` IS THE SENTENCE THE TAB SHOWS AND THE GUIDE PRINTS. `tests/unit/analytics-registry.
 * test.ts` asserts every definition appears verbatim in `docs/studio/STUDIO_GUIDE.md`, so the
 * documentation cannot drift from what the code measures. `coverage` states, in the same voice,
 * what `n` and the denominator count.
 *
 * `compute()` IS CALLED BY THE SNAPSHOT WRITER AND NOTHING ELSE. The tab reads `analytics_snapshots`;
 * nothing scans a table in the request path. A unit test greps for the call.
 */

export interface MetricContext {
  readonly reads: AnalyticsReads
  readonly now: Date
}

export type MetricOutcome =
  | {
      readonly availability: 'AVAILABLE'
      readonly n: number
      readonly denominator: number
      readonly value: MetricValue
    }
  | {
      readonly availability: 'UNAVAILABLE'
      readonly reason: string
      readonly n: number | null
      readonly denominator: number | null
    }

export interface MetricModule {
  readonly id: MetricId
  readonly labelKey: StudioStringKey
  readonly dimension: MetricDimension
  readonly definition: string
  readonly coverage: string
  readonly requires: MetricRequirement
  /** The phase whose tables the metric reads; every one is ≤ 37. */
  readonly availableFrom: number
  compute(context: MetricContext): Promise<MetricOutcome>
}
