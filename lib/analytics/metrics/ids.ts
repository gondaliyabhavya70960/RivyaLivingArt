/**
 * The eighteen FEAT §28 metric ids, in the specification's order — Phase 37.
 *
 * THE ONLY LIST. The registry (`index.ts`) is built from it, the tab renders whatever the registry
 * holds, and `tests/unit/analytics-registry.test.ts` asserts the two agree with FEAT §28 exactly:
 * eight first-party, ten competitive, nothing added, nothing renamed.
 */
export const FIRST_PARTY_METRIC_IDS = [
  'catalog',
  'product_categories',
  'product_scale',
  'large_format_share',
  'collection_mix',
  'inquiry_trends',
  'content_performance',
  'media_coverage',
] as const

export const COMPETITIVE_METRIC_IDS = [
  'assortment',
  'price_architecture',
  'dimensions',
  'materials',
  'resin_styles',
  'colours',
  'customization',
  'production_model',
  'opportunity_scores',
  'source_freshness',
] as const

export const METRIC_IDS = [...FIRST_PARTY_METRIC_IDS, ...COMPETITIVE_METRIC_IDS] as const

export type MetricId = (typeof METRIC_IDS)[number]

export function isMetricId(value: string): value is MetricId {
  return (METRIC_IDS as readonly string[]).includes(value)
}
